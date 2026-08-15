import { ref } from 'vue'
import {
  base64ToBytes,
  buildAvcDescription,
  bytesEqual,
  codecFromSps,
  isKeyframeData,
  prepareEncodedData,
} from '../utils/h264.js'

const VIDEO_DECODER_SUPPORTED = typeof VideoDecoder !== 'undefined'

function toUint8Array(data) {
  if (data instanceof Uint8Array)
    return data
  if (typeof data === 'string')
    return base64ToBytes(data)
  if (data == null)
    return new Uint8Array(0)
  return new Uint8Array(data)
}

const STATE = {
  IDLE: 'idle',
  CONFIGURING: 'configuring',
  READY: 'ready',
  ERROR: 'error',
}

class DeviceVideoPipeline {
  constructor(serial, onRendered, onError) {
    this.serial = serial
    this.onRendered = onRendered
    this.onError = onError
    this.canvas = null
    this.decoder = null
    this.sps = null
    this.pps = null
    this.state = STATE.IDLE
    this.active = true
    this.timestamp = 0
    this.bufferedKeyframe = null
    this.bufferedDataFrames = []
    this._configPromise = null
    this.streamWidth = 0
    this.streamHeight = 0
    this.displayWidth = 0
    this.displayHeight = 0
    this.lastReportedWidth = 0
    this.lastReportedHeight = 0
    this._firstFrameLogged = false
    this._configAttempts = 0
  }

  setCanvas(el) {
    this.canvas = el || null
    if (el && this.state === STATE.READY && this.bufferedKeyframe) {
      const kf = this.bufferedKeyframe
      this.bufferedKeyframe = null
      this._decodeData(kf.data, true)
    }
  }

  destroy() {
    this.active = false
    this._cleanup()
    this.canvas = null
    this.sps = null
    this.pps = null
    this.state = STATE.IDLE
    this.bufferedKeyframe = null
    this.bufferedDataFrames = []
    this._configPromise = null
  }

  _cleanup() {
    if (this.decoder?.state !== 'closed') {
      try {
        this.decoder?.close()
      }
      catch {}
    }
    this.decoder = null
  }

  async _ensureConfigured() {
    if (this.state === STATE.READY)
      return true
    if (this.state === STATE.CONFIGURING)
      return this._configPromise

    if (!VIDEO_DECODER_SUPPORTED) {
      this.state = STATE.ERROR
      this.onError?.(this.serial, 'VideoDecoder 不可用')
      return false
    }

    if (!this.sps?.length || !this.pps?.length) {
      this.state = STATE.ERROR
      this.onError?.(this.serial, '等待 sps/pps 配置数据')
      return false
    }

    this.state = STATE.CONFIGURING
    this._configAttempts++

    this._configPromise = (async () => {
      try {
        this._cleanup()

        const codec = codecFromSps(this.sps)
        const description = buildAvcDescription(this.sps, this.pps)
        const config = { codec, description, optimizeForLatency: true }

        let support
        try {
          support = await VideoDecoder.isConfigSupported(config)
        }
        catch (e) {
          this.state = STATE.ERROR
          this.onError?.(this.serial, `isConfigSupported 异常: ${e.message}`)
          return false
        }

        if (!support?.supported) {
          this.state = STATE.ERROR
          this.onError?.(this.serial, `编码不支持: ${codec}`)
          return false
        }

        this.decoder = new VideoDecoder({
          output: (frame) => {
            try {
              this._drawFrame(frame)
            }
            catch (e) {
              console.error(`[cluster][${this.serial}] drawFrame error:`, e)
            }
          },
          error: (error) => {
            console.warn(`[cluster][${this.serial}] Decoder error:`, error.message)
            this._cleanup()
            this.state = STATE.IDLE
            this.onError?.(this.serial, `解码器错误: ${error.message}`)
            if (this.sps?.length && this.pps?.length && this.active)
              this._ensureConfigured()
          },
        })

        await this.decoder.configure(config)
        this.state = STATE.READY
        this._configAttempts = 0
        this.onError?.(this.serial, '')

        if (this.bufferedKeyframe) {
          const kf = this.bufferedKeyframe
          this.bufferedKeyframe = null
          this._decodeData(kf.data, true)
        }

        for (const frame of this.bufferedDataFrames)
          this._decodeData(frame.data, false)
        this.bufferedDataFrames = []

        console.log(`[cluster][${this.serial}] decoder configured (attempt ${this._configAttempts})`)
        return true
      }
      catch (e) {
        this.state = STATE.ERROR
        this.onError?.(this.serial, `解码器创建失败: ${e.message}`)
        console.error(`[cluster][${this.serial}] _ensureConfigured error:`, e)
        this._cleanup()
        return false
      }
      finally {
        this._configPromise = null
      }
    })()

    return this._configPromise
  }

  _drawFrame(frame) {
    try {
      if (!this.active)
        return

      const codedW = frame.codedWidth || frame.displayWidth || 0
      const codedH = frame.codedHeight || frame.displayHeight || 0
      if (codedW <= 0 || codedH <= 0)
        return

      this.streamWidth = codedW
      this.streamHeight = codedH
      this._reportStreamSize(codedW, codedH)

      if (!this.canvas)
        return

      const canvas = this.canvas
      if (this.displayWidth !== codedW || this.displayHeight !== codedH) {
        canvas.width = codedW
        canvas.height = codedH
        this.displayWidth = codedW
        this.displayHeight = codedH
      }

      let ctx = canvas.__ctx
      if (!ctx) {
        ctx = canvas.getContext('2d', { alpha: false })
        canvas.__ctx = ctx
      }
      if (!ctx)
        return

      ctx.drawImage(frame, 0, 0, codedW, codedH)
      if (!this._firstFrameLogged) {
        this._firstFrameLogged = true
        console.log(`[cluster][${this.serial}] first frame ${codedW}x${codedH}`)
      }
      this.onRendered(this.serial)
    }
    catch (e) {
      console.error(`[cluster][${this.serial}] drawFrame exception:`, e)
    }
    finally {
      try {
        frame.close()
      }
      catch {}
    }
  }

  _reportStreamSize(width, height) {
    if (!width || !height)
      return
    if (this.lastReportedWidth === width && this.lastReportedHeight === height)
      return
    this.lastReportedWidth = width
    this.lastReportedHeight = height
    window.$preload.ipcRenderer?.send('cluster-control:streamSize', {
      serial: this.serial,
      width,
      height,
    })
  }

  _decodeData(data, isKeyframe) {
    if (!this.active)
      return
    if (!this.decoder || this.decoder.state !== 'configured')
      return

    this.timestamp += 33333
    const chunk = new EncodedVideoChunk({
      type: isKeyframe ? 'key' : 'delta',
      timestamp: this.timestamp,
      data: prepareEncodedData(data),
    })

    try {
      this.decoder.decode(chunk)
    }
    catch (e) {
      console.error(`[cluster][${this.serial}] decode error:`, e)
      this.state = STATE.IDLE
      this._cleanup()
      if (this.sps?.length && this.pps?.length && this.active)
        this._ensureConfigured()
    }
  }

  handleConfig(spsData, ppsData) {
    const nextSps = toUint8Array(spsData)
    const nextPps = toUint8Array(ppsData)

    if (!nextSps.length || !nextPps.length) {
      this.onError?.(this.serial, '收到空的 sps/pps')
      return
    }

    const changed = !this.sps || !this.pps
      || !bytesEqual(this.sps, nextSps)
      || !bytesEqual(this.pps, nextPps)

    this.sps = nextSps
    this.pps = nextPps

    if (changed && (this.state === STATE.READY || this.state === STATE.CONFIGURING)) {
      this.state = STATE.IDLE
      this._cleanup()
      this._configPromise = null
    }

    if (this.state === STATE.IDLE || this.state === STATE.ERROR)
      this._ensureConfigured()
  }

  handleFrame(payload) {
    const { data, keyframe } = payload
    if (!data)
      return

    const uintData = toUint8Array(data)
    const isKey = !!keyframe || isKeyframeData(uintData)

    if (isKey)
      this.bufferedKeyframe = { data: uintData }

    if (this.state !== STATE.READY) {
      if (this.sps?.length && this.pps?.length && this.state !== STATE.CONFIGURING)
        this._ensureConfigured()

      if (!isKey && this.bufferedDataFrames.length < 60)
        this.bufferedDataFrames.push({ data: uintData })

      return
    }

    this._decodeData(uintData, isKey)
  }
}

export function useClusterVideo() {
  const renderedSerials = ref(new Set())
  const pipelineErrors = ref({})
  const pipelines = new Map()
  let frameSession = 0

  function setPipelineError(serial, message) {
    if (!message) {
      delete pipelineErrors.value[serial]
      pipelineErrors.value = { ...pipelineErrors.value }
    }
    else {
      pipelineErrors.value = { ...pipelineErrors.value, [serial]: message }
    }
  }

  function markRendered(serial) {
    if (renderedSerials.value.has(serial))
      return
    const next = new Set(renderedSerials.value)
    next.add(serial)
    renderedSerials.value = next
  }

  function getPipeline(serial) {
    if (!pipelines.has(serial))
      pipelines.set(serial, new DeviceVideoPipeline(serial, markRendered, setPipelineError))
    return pipelines.get(serial)
  }

  function setFrameSession(session) {
    if (session === frameSession)
      return
    frameSession = session
    for (const pipeline of pipelines.values())
      pipeline.destroy()
    pipelines.clear()
    renderedSerials.value = new Set()
    pipelineErrors.value = {}
  }

  function acceptSession(session) {
    frameSession = session
  }

  function setCanvasRef(serial, el) {
    const pipeline = getPipeline(serial)
    pipeline.setCanvas(el)
  }

  function initDevice(serial) {
    getPipeline(serial)
  }

  function onVideoFrame(payload) {
    const { serial, config, sps, pps, data } = payload
    if (!serial)
      return

    if (config) {
      const pipeline = getPipeline(serial)
      pipeline.handleConfig(sps, pps)
      return
    }

    if (payload?.session != null && payload.session !== frameSession)
      return

    const pipeline = getPipeline(serial)
    if (data)
      pipeline.handleFrame(payload)
  }

  function isDeviceRendered(serial) {
    return renderedSerials.value.has(serial)
  }

  function getPipelineError(serial) {
    return pipelineErrors.value[serial] || ''
  }

  function getStreamSize(serial) {
    const pipeline = pipelines.get(serial)
    if (!pipeline?.streamWidth || !pipeline?.streamHeight)
      return null
    return { width: pipeline.streamWidth, height: pipeline.streamHeight }
  }

  function destroy() {
    for (const pipeline of pipelines.values())
      pipeline.destroy()
    pipelines.clear()
    renderedSerials.value = new Set()
    pipelineErrors.value = {}
  }

  return {
    VIDEO_DECODER_SUPPORTED,
    renderedSerials,
    pipelineErrors,
    setFrameSession,
    acceptSession,
    setCanvasRef,
    initDevice,
    onVideoFrame,
    destroy,
    isDeviceRendered,
    getPipelineError,
    getStreamSize,
  }
}

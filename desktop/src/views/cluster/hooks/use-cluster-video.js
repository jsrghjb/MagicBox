import { ref } from 'vue'
import {
  base64ToBytes,
  buildAvcDescription,
  bytesEqual,
  codecFromSps,
  isKeyframeData,
  prepareEncodedData,
} from '../utils/h264.js'

function toUint8Array(data) {
  if (data instanceof Uint8Array)
    return data
  if (typeof data === 'string')
    return base64ToBytes(data)
  return new Uint8Array(data)
}

/**
 * 单设备解码管线：config → 关键帧 → P 帧，串行处理避免竞态。
 */
class DeviceVideoPipeline {
  constructor(serial, onRendered) {
    this.serial = serial
    this.onRendered = onRendered
    this.canvas = null
    this.decoder = null
    this.sps = null
    this.pps = null
    this.configured = false
    this.gotFirstFrame = false
    /** configure / 出错后必须等到关键帧再喂 P 帧 */
    this.awaitingKeyframe = true
    this.timestamp = 0
    this.queue = Promise.resolve()
    this.pendingFrames = 0
    this.active = true
    /** 视频流编码尺寸（触控坐标系） */
    this.streamWidth = 0
    this.streamHeight = 0
    this.displayWidth = 0
    this.displayHeight = 0
    this.lastReportedWidth = 0
    this.lastReportedHeight = 0
  }

  setCanvas(el) {
    this.canvas = el || null
  }

  destroy() {
    this.active = false
    this.resetDecoder()
    this.canvas = null
    this.sps = null
    this.pps = null
    this.configured = false
    this.gotFirstFrame = false
    this.awaitingKeyframe = true
    this.queue = Promise.resolve()
    this.pendingFrames = 0
    this.streamWidth = 0
    this.streamHeight = 0
    this.displayWidth = 0
    this.displayHeight = 0
    this.lastReportedWidth = 0
    this.lastReportedHeight = 0
  }

  resetQueue() {
    this.queue = Promise.resolve()
    this.pendingFrames = 0
  }

  enqueue(task) {
    if (this.pendingFrames > 15) {
      this.resetQueue()
      this.awaitingKeyframe = true
    }

    this.pendingFrames += 1
    this.queue = this.queue.then(async () => {
      if (!this.active)
        return
      try {
        await task()
      }
      finally {
        this.pendingFrames = Math.max(0, this.pendingFrames - 1)
      }
    }).catch((error) => {
      console.error(`[cluster][${this.serial}] pipeline error:`, error)
    })
    return this.queue
  }

  resetDecoder() {
    if (this.decoder?.state !== 'closed') {
      try {
        this.decoder?.close()
      }
      catch {}
    }
    this.decoder = null
    this.configured = false
    this.gotFirstFrame = false
    this.awaitingKeyframe = true
    this.timestamp = 0
  }

  reportStreamSize(width, height) {
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

  async applyCodec(sps, pps) {
    if (!sps?.length || !pps?.length)
      return false

    const sameCodec = this.sps && this.pps
      && bytesEqual(this.sps, sps)
      && bytesEqual(this.pps, pps)

    this.sps = sps
    this.pps = pps

    if (sameCodec && this.configured && this.decoder?.state === 'configured')
      return true

    this.resetDecoder()

    const config = {
      codec: codecFromSps(sps),
      description: buildAvcDescription(sps, pps),
      optimizeForLatency: true,
    }

    const support = await VideoDecoder.isConfigSupported(config)
    if (!support.supported) {
      console.error(`[cluster][${this.serial}] codec not supported:`, config.codec)
      return false
    }

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.drawFrame(frame)
      },
      error: (error) => {
        console.warn(`[cluster][${this.serial}] Decoder error, wait for keyframe:`, error.message)
        this.resetDecoder()
      },
    })

    this.decoder.configure(config)
    this.configured = true
    this.awaitingKeyframe = true
    this.gotFirstFrame = false
    this.timestamp = 0
    return true
  }

  drawFrame(frame) {
    try {
      if (!this.active)
        return

      const codedW = frame.codedWidth || frame.displayWidth || 0
      const codedH = frame.codedHeight || frame.displayHeight || 0
      if (codedW <= 0 || codedH <= 0)
        return

      this.streamWidth = codedW
      this.streamHeight = codedH
      this.reportStreamSize(codedW, codedH)

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
      this.gotFirstFrame = true
      this.onRendered(this.serial)
    }
    finally {
      frame.close()
    }
  }

  decodeFrame(data, keyframeFlag) {
    if (!this.active || !this.configured)
      return

    const isKey = keyframeFlag || isKeyframeData(data)
    if (this.awaitingKeyframe && !isKey)
      return
    if (!this.gotFirstFrame && !isKey)
      return

    const decoder = this.decoder
    if (!decoder || decoder.state !== 'configured')
      return

    if (isKey)
      this.awaitingKeyframe = false

    this.timestamp += 33333
    const chunk = new EncodedVideoChunk({
      type: isKey ? 'key' : 'delta',
      timestamp: this.timestamp,
      data: prepareEncodedData(data),
    })

    decoder.decode(chunk)
  }

  handleConfig(spsData, ppsData) {
    const nextSps = toUint8Array(spsData)
    const nextPps = toUint8Array(ppsData)
    const changed = !this.sps || !this.pps
      || !bytesEqual(this.sps, nextSps)
      || !bytesEqual(this.pps, nextPps)

    if (changed) {
      this.resetQueue()
      this.resetDecoder()
    }

    return this.enqueue(async () => {
      await this.applyCodec(nextSps, nextPps)
    })
  }

  handleFrame(payload) {
    const { data, keyframe } = payload
    if (!data)
      return this.queue

    const isKey = !!keyframe
    if (this.awaitingKeyframe && !isKey)
      return this.queue

    if (!isKey && this.pendingFrames > 24) {
      this.resetQueue()
      this.resetDecoder()
      if (this.sps && this.pps) {
        return this.enqueue(async () => {
          await this.applyCodec(this.sps, this.pps)
        })
      }
      return this.queue
    }

    return this.enqueue(async () => {
      const bytes = toUint8Array(data)
      const resolvedKey = isKey || isKeyframeData(bytes)

      if (this.awaitingKeyframe && !resolvedKey)
        return

      try {
        if (resolvedKey && !this.configured && this.sps && this.pps)
          await this.applyCodec(this.sps, this.pps)

        this.decodeFrame(bytes, resolvedKey)
      }
      catch (error) {
        this.resetDecoder()
        if (!resolvedKey)
          return

        console.error(`[cluster][${this.serial}] Decode error:`, error)
        if (this.sps && this.pps)
          await this.applyCodec(this.sps, this.pps)
        this.decodeFrame(bytes, true)
      }
    })
  }
}

export function useClusterVideo() {
  const renderedSerials = ref(new Set())
  const pipelines = new Map()
  let frameSession = 0

  function markRendered(serial) {
    if (renderedSerials.value.has(serial))
      return
    const next = new Set(renderedSerials.value)
    next.add(serial)
    renderedSerials.value = next
  }

  function getPipeline(serial) {
    if (!pipelines.has(serial))
      pipelines.set(serial, new DeviceVideoPipeline(serial, markRendered))
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
  }

  function setCanvasRef(serial, el) {
    getPipeline(serial).setCanvas(el)
  }

  function initDevice(serial) {
    getPipeline(serial)
  }

  function onVideoFrame(payload) {
    if (payload?.session != null && payload.session !== frameSession)
      return

    const { serial, config, sps, pps, data } = payload
    if (!serial)
      return

    const pipeline = getPipeline(serial)
    if (config)
      return pipeline.handleConfig(sps, pps)
    if (data)
      return pipeline.handleFrame(payload)
  }

  function isDeviceRendered(serial) {
    return renderedSerials.value.has(serial)
  }

  function getCanvas(serial) {
    return pipelines.get(serial)?.canvas || null
  }

  function getStreamSize(serial) {
    const pipeline = pipelines.get(serial)
    if (!pipeline?.streamWidth || !pipeline?.streamHeight)
      return null
    return {
      width: pipeline.streamWidth,
      height: pipeline.streamHeight,
    }
  }

  function destroy() {
    for (const pipeline of pipelines.values())
      pipeline.destroy()
    pipelines.clear()
    renderedSerials.value = new Set()
  }

  return {
    renderedSerials,
    setFrameSession,
    setCanvasRef,
    initDevice,
    onVideoFrame,
    destroy,
    isDeviceRendered,
    getCanvas,
    getStreamSize,
  }
}

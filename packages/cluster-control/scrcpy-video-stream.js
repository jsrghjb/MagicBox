/**
 * scrcpy 4.0 标准视频流解析（非 raw_stream）。
 * @see https://github.com/Genymobile/scrcpy/blob/v4.0/app/src/demuxer.c
 */

const PACKET_HEADER_SIZE = 12
const PACKET_FLAG_CONFIG = 0x4000000000000000n
const PACKET_FLAG_KEY_FRAME = 0x2000000000000000n

function getNalType(nal) {
  return nal[0] & 0x1F
}

function parseAvccNals(buffer) {
  const nals = []
  let offset = 0

  while (offset + 4 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    if (length <= 0 || length > 8 * 1024 * 1024)
      break
    if (offset + 4 + length > buffer.length)
      break

    nals.push(buffer.subarray(offset + 4, offset + 4 + length))
    offset += 4 + length
  }

  return { nals, consumed: offset }
}

function parseRawNal(buffer) {
  if (buffer.length < 2)
    return null
  const type = getNalType(buffer)
  if ([1, 5, 7, 8].includes(type))
    return buffer
  return null
}

/** 从 MediaCodec config 包提取 SPS/PPS */
export function extractSpsPps(configBuffer) {
  if (!configBuffer?.length)
    return { sps: null, pps: null }

  let sps = null
  let pps = null

  const avcc = parseAvccNals(configBuffer)
  for (const nal of avcc.nals) {
    const type = getNalType(nal)
    if (type === 7)
      sps = Buffer.from(nal)
    if (type === 8)
      pps = Buffer.from(nal)
  }
  if (sps && pps)
    return { sps, pps }

  const raw = parseRawNal(configBuffer)
  if (raw) {
    const type = getNalType(raw)
    if (type === 7)
      sps = Buffer.from(raw)
    if (type === 8)
      pps = Buffer.from(raw)
  }

  return { sps, pps }
}

export class ScrcpyVideoStreamParser {
  constructor() {
    this.buffer = Buffer.alloc(0)
    this.phase = 'dummy'
    this.pendingHeader = null
    this.pendingPayloadSize = 0
    this.storedConfig = null
    this.codecId = null
    this.videoWidth = 0
    this.videoHeight = 0
  }

  /**
   * @param {Buffer} chunk
   * @returns {Array<object>}
   */
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    const events = []

    while (true) {
      if (this.phase === 'dummy') {
        if (this.buffer.length < 1)
          break
        this.buffer = this.buffer.subarray(1)
        this.phase = 'codec'
        continue
      }

      if (this.phase === 'codec') {
        if (this.buffer.length < 4)
          break
        this.codecId = this.buffer.readUInt32BE(0)
        this.buffer = this.buffer.subarray(4)
        this.phase = 'header'
        continue
      }

      if (this.phase === 'header') {
        if (this.buffer.length < PACKET_HEADER_SIZE)
          break

        const header = this.buffer.subarray(0, PACKET_HEADER_SIZE)
        this.buffer = this.buffer.subarray(PACKET_HEADER_SIZE)

        if (header[0] & 0x80) {
          this.videoWidth = header.readUInt32BE(4)
          this.videoHeight = header.readUInt32BE(8)
          events.push({
            type: 'session',
            width: this.videoWidth,
            height: this.videoHeight,
          })
          continue
        }

        const ptsFlags = header.readBigUInt64BE(0)
        const packetSize = header.readUInt32BE(8)
        if (!packetSize) {
          this.phase = 'header'
          continue
        }

        this.pendingHeader = {
          config: (ptsFlags & PACKET_FLAG_CONFIG) !== 0n,
          keyframe: (ptsFlags & PACKET_FLAG_KEY_FRAME) !== 0n,
        }
        this.pendingPayloadSize = packetSize
        this.phase = 'payload'
        continue
      }

      if (this.phase === 'payload') {
        if (this.buffer.length < this.pendingPayloadSize)
          break

        const payload = this.buffer.subarray(0, this.pendingPayloadSize)
        this.buffer = this.buffer.subarray(this.pendingPayloadSize)
        this.phase = 'header'

        if (this.pendingHeader.config) {
          this.storedConfig = Buffer.from(payload)
          const { sps, pps } = extractSpsPps(payload)
          if (sps && pps) {
            events.push({
              type: 'config',
              sps,
              pps,
              width: this.videoWidth,
              height: this.videoHeight,
            })
          }
          continue
        }

        const event = {
          type: 'frame',
          keyframe: this.pendingHeader.keyframe,
          data: Buffer.from(payload),
          width: this.videoWidth,
          height: this.videoHeight,
        }

        if (this.storedConfig) {
          const { sps, pps } = extractSpsPps(this.storedConfig)
          if (sps && pps) {
            event.sps = sps
            event.pps = pps
          }
          this.storedConfig = null
        }

        events.push(event)
      }
    }

    return events
  }
}

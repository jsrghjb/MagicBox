/**
 * 解析 scrcpy raw_stream H.264。
 * 设备侧常见 Annex B（00 00 00 01）；部分机型为 AVCC 长度前缀。
 */

function getNalType(nal) {
  return nal[0] & 0x1F
}

function findStartCodes(data) {
  const positions = []
  const target = Buffer.from([0, 0, 1])
  let pos = data.indexOf(target, 0)
  while (pos !== -1) {
    if (pos > 0 && data[pos - 1] === 0) {
      positions.push(pos - 1)
    }
    else {
      positions.push(pos)
    }
    pos = data.indexOf(target, pos + 3)
  }
  return positions
}

function startsWithAnnexB(buffer) {
  if (buffer.length < 3)
    return false
  if (buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1)
    return true
  return buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 0 && buffer[3] === 1
}

function nalToAvcc(nal) {
  const out = Buffer.alloc(4 + nal.length)
  out.writeUInt32BE(nal.length, 0)
  nal.copy(out, 4)
  return out
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

/** Annex B：消费已有下一 start code 界碑的 NAL；SPS/PPS 单包可立即消费 */
function parseAnnexBNals(buffer) {
  const starts = findStartCodes(buffer)
  if (!starts.length)
    return { nals: [], consumed: 0 }

  if (starts.length === 1) {
    const headerSize = buffer[starts[0] + 2] === 1 ? 3 : 4
    const nalStart = starts[0] + headerSize
    const nal = buffer.subarray(nalStart)
    if (!nal.length)
      return { nals: [], consumed: 0 }

    const type = getNalType(nal)
    // SPS/PPS 体积小，通常单次 TCP 即完整
    if (type === 7 || type === 8)
      return { nals: [nal], consumed: buffer.length }

    return { nals: [], consumed: 0 }
  }

  const nals = []
  for (let i = 0; i < starts.length - 1; i++) {
    const headerSize = buffer[starts[i] + 2] === 1 ? 3 : 4
    const nalStart = starts[i] + headerSize
    const nalEnd = starts[i + 1]
    if (nalStart < nalEnd)
      nals.push(buffer.subarray(nalStart, nalEnd))
  }

  return {
    nals,
    consumed: starts[starts.length - 1],
  }
}

function isValidSliceNal(nal) {
  const type = getNalType(nal)
  if (type !== 1 && type !== 5)
    return false
  return nal.length >= 4
}

function maybeEmitConfig(state, frames) {
  if (!state.sps || !state.pps || state.sps.length < 4 || state.pps.length < 1)
    return

  const spsKey = state.sps.toString('hex')
  const ppsKey = state.pps.toString('hex')
  if (state.configSent && state.lastSpsKey === spsKey && state.lastPpsKey === ppsKey)
    return

  state.configSent = true
  state.lastSpsKey = spsKey
  state.lastPpsKey = ppsKey
  frames.push({
    config: true,
    sps: state.sps,
    pps: state.pps,
  })
}

function classifyNal(nal, state, frames) {
  const type = getNalType(nal)

  if (type === 7) {
    state.sps = Buffer.from(nal)
    maybeEmitConfig(state, frames)
    return
  }
  if (type === 8) {
    state.pps = Buffer.from(nal)
    maybeEmitConfig(state, frames)
    return
  }
  if (type === 6 || type === 9)
    return

  if (!isValidSliceNal(nal))
    return

  frames.push({
    keyframe: type === 5,
    data: nalToAvcc(nal),
  })
}

export class H264StreamParser {
  constructor() {
    this.buffer = Buffer.alloc(0)
    this.sps = null
    this.pps = null
    this.lastSpsKey = null
    this.lastPpsKey = null
    /** @type {'annex-b' | 'avcc' | null} */
    this.format = null
  }

  resolveFormat(buffer) {
    if (this.format)
      return this.format
    if (buffer.length < 4)
      return null
    this.format = startsWithAnnexB(buffer) ? 'annex-b' : 'avcc'
    return this.format
  }

  /**
   * @param {Buffer} chunk
   * @returns {Array<{ keyframe?: boolean, data?: Buffer, config?: boolean, sps?: Buffer, pps?: Buffer }>}
   */
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    const frames = []
    const state = {
      sps: this.sps,
      pps: this.pps,
      configSent: !!(this.sps && this.pps),
      lastSpsKey: this.lastSpsKey || null,
      lastPpsKey: this.lastPpsKey || null,
    }

    let safety = 0
    while (this.buffer.length > 0 && safety++ < 512) {
      const format = this.resolveFormat(this.buffer)
      if (!format)
        break

      const parsed = format === 'annex-b'
        ? parseAnnexBNals(this.buffer)
        : parseAvccNals(this.buffer)

      if (!parsed.nals.length) {
        if (parsed.consumed > 0)
          this.buffer = this.buffer.subarray(parsed.consumed)
        break
      }

      for (const nal of parsed.nals)
        classifyNal(nal, state, frames)

      this.sps = state.sps
      this.pps = state.pps
      this.lastSpsKey = state.lastSpsKey
      this.lastPpsKey = state.lastPpsKey
      this.buffer = this.buffer.subarray(parsed.consumed)
    }

    return frames
  }
}

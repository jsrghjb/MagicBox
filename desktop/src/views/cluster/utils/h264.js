/**
 * Annex B H.264 工具：解析 NAL、构建 WebCodecs avcC description。
 */

export function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function findStartCodes(data) {
  const positions = []
  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] === 0 && data[i + 1] === 0) {
      if (data[i + 2] === 1) {
        positions.push(i)
        i += 2
      }
      else if (data[i + 2] === 0 && data[i + 3] === 1) {
        positions.push(i)
        i += 3
      }
    }
  }
  return positions
}

export function splitAnnexBNals(data) {
  const starts = findStartCodes(data)
  if (!starts.length)
    return data.length ? [data] : []

  const nals = []
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]
    const headerSize = data[start + 2] === 1 ? 3 : 4
    const nalStart = start + headerSize
    const nalEnd = i + 1 < starts.length ? starts[i + 1] : data.length
    if (nalStart < nalEnd)
      nals.push(data.subarray(nalStart, nalEnd))
  }
  return nals
}

export function getNalType(nal) {
  return nal[0] & 0x1F
}

export function isKeyframeNal(nal) {
  const type = getNalType(nal)
  return type === 5
}

/** 判断编码帧是否为关键帧（AVCC access unit 或裸 NAL） */
export function isKeyframeData(data) {
  if (!data?.length)
    return false

  const nals = splitAnnexBNals(data)
  if (nals.length)
    return nals.some(nal => getNalType(nal) === 5)

  if (isAvccAccessUnit(data)) {
    let offset = 0
    while (offset + 4 < data.length) {
      const length = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
      if (length <= 0 || offset + 4 + length > data.length)
        break
      if (getNalType(data.subarray(offset + 4, offset + 4 + length)) === 5)
        return true
      offset += 4 + length
    }
    return false
  }

  return getNalType(data) === 5
}

export function bytesEqual(a, b) {
  if (!a || !b || a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}

export function buildAvcDescription(sps, pps) {
  const spsLen = sps.length
  const ppsLen = pps.length
  const description = new Uint8Array(11 + spsLen + ppsLen)
  let offset = 0

  description[offset++] = 1
  description[offset++] = sps[1]
  description[offset++] = sps[2]
  description[offset++] = sps[3]
  description[offset++] = 0xFF
  description[offset++] = 0xE1
  description[offset++] = (spsLen >> 8) & 0xFF
  description[offset++] = spsLen & 0xFF
  description.set(sps, offset)
  offset += spsLen
  description[offset++] = 1
  description[offset++] = (ppsLen >> 8) & 0xFF
  description[offset++] = ppsLen & 0xFF
  description.set(pps, offset)

  return description
}

export function codecFromSps(sps) {
  const hex = n => n.toString(16).toUpperCase().padStart(2, '0')
  return `avc1.${hex(sps[1])}${hex(sps[2])}${hex(sps[3])}`
}

export function annexBNalToAvcc(nal) {
  const avcc = new Uint8Array(4 + nal.length)
  avcc[0] = (nal.length >> 24) & 0xFF
  avcc[1] = (nal.length >> 16) & 0xFF
  avcc[2] = (nal.length >> 8) & 0xFF
  avcc[3] = nal.length & 0xFF
  avcc.set(nal, 4)
  return avcc
}

/** 判断是否为 scrcpy / MediaCodec 输出的 AVCC access unit（可含 1 个或多个 NAL） */
export function isAvccAccessUnit(data) {
  if (!data?.length || data.length < 5)
    return false

  let offset = 0
  while (offset < data.length) {
    if (offset + 4 > data.length)
      return false

    const length = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]
    if (length <= 0 || length > 8 * 1024 * 1024)
      return false
    if (offset + 4 + length > data.length)
      return false

    offset += 4 + length
    if (offset === data.length)
      return true
  }

  return false
}

/** WebCodecs 需要 AVCC access unit，输入可以是 AVCC、裸 NAL 或 Annex B 包 */
export function prepareEncodedData(data) {
  if (isAvccAccessUnit(data))
    return data

  const nals = splitAnnexBNals(data)
  if (!nals.length)
    return annexBNalToAvcc(data)

  const parts = nals.map(annexBNalToAvcc)
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const merged = new Uint8Array(total)

  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }

  return merged
}

/** @deprecated 使用 prepareEncodedData */
export function toAvccChunk(data) {
  return prepareEncodedData(data)
}

export function parseH264Stream(buffer) {
  const nals = splitAnnexBNals(buffer)
  const accessUnits = []
  let currentUnit = []
  let sps = null
  let pps = null

  for (const nal of nals) {
    const type = getNalType(nal)

    if (type === 7) {
      sps = nal
      continue
    }
    if (type === 8) {
      pps = nal
      continue
    }
    if (type === 6 || type === 9) {
      continue
    }

    if (type === 5) {
      if (currentUnit.length) {
        accessUnits.push({ nals: currentUnit, keyframe: false })
        currentUnit = []
      }
      currentUnit.push(nal)
      accessUnits.push({ nals: currentUnit, keyframe: true })
      currentUnit = []
      continue
    }

    if (type === 1) {
      currentUnit.push(nal)
      accessUnits.push({ nals: currentUnit, keyframe: false })
      currentUnit = []
    }
  }

  return { sps, pps, accessUnits }
}

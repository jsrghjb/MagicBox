/**
 * 将 Escrcpy 首选项中的 scrcpy 视频 CLI 参数映射为 scrcpy-server 4.0 启动项。
 * 仅包含 scrcpy-server 支持的字段；客户端专用项（如 --video-buffer）会被忽略。
 */

const VIDEO_PREFERENCE_KEYS = [
  '--max-size',
  '--video-bit-rate',
  '--max-fps',
  '--video-code',
  '--video-codec',
  '--video-encoder',
  '--video-source',
  '--display-orientation',
  '--angle',
  '--crop',
  '--display-id',
  '--no-video',
]

/**
 * @param {Record<string, unknown>} globalPrefs
 * @param {Record<string, unknown>} devicePrefs
 */
export function mergeDevicePreferenceData(globalPrefs = {}, devicePrefs = {}) {
  const merged = { ...globalPrefs }

  for (const [key, value] of Object.entries(devicePrefs)) {
    if (value === undefined || value === '')
      continue
    merged[key] = value
  }

  return merged
}

function applyVideoCodecOptions(preferenceData, serverOptions) {
  const videoCode = preferenceData['--video-code']
  if (typeof videoCode === 'string' && videoCode.trim()) {
    const [codec, encoder] = videoCode.split('&').map(part => part.trim())
    if (codec)
      serverOptions.video_codec = codec
    if (encoder)
      serverOptions.video_encoder = encoder
    return
  }

  if (preferenceData['--video-codec'])
    serverOptions.video_codec = String(preferenceData['--video-codec'])

  if (preferenceData['--video-encoder'])
    serverOptions.video_encoder = String(preferenceData['--video-encoder'])
}

/**
 * @param {Record<string, unknown>} preferenceData
 * @returns {Record<string, string | number | boolean>}
 */
export function buildVideoServerOptions(preferenceData = {}) {
  const options = {}

  if (preferenceData['--no-video']) {
    options.video = false
    return options
  }

  const maxSize = preferenceData['--max-size']
  if (maxSize != null && maxSize !== '')
    options.max_size = Number(maxSize)

  const bitRate = preferenceData['--video-bit-rate']
  if (bitRate != null && bitRate !== '')
    options.video_bit_rate = Number(bitRate)

  const maxFps = preferenceData['--max-fps']
  if (maxFps != null && maxFps !== '')
    options.max_fps = Number(maxFps)

  const angle = preferenceData['--angle']
  if (angle != null && angle !== '')
    options.angle = Number(angle)

  const crop = preferenceData['--crop']
  if (crop != null && String(crop).trim())
    options.crop = String(crop).trim()

  const displayId = preferenceData['--display-id']
  if (displayId != null && displayId !== '')
    options.display_id = Number(displayId)

  const videoSource = preferenceData['--video-source']
  if (videoSource != null && String(videoSource).trim())
    options.video_source = String(videoSource).trim()

  const displayOrientation = preferenceData['--display-orientation']
  if (displayOrientation != null && displayOrientation !== '')
    options.capture_orientation = String(displayOrientation)

  applyVideoCodecOptions(preferenceData, options)

  return options
}

/**
 * @param {Record<string, unknown>} preferenceData
 */
export function pickVideoPreferenceData(preferenceData = {}) {
  return VIDEO_PREFERENCE_KEYS.reduce((result, key) => {
    if (preferenceData[key] !== undefined && preferenceData[key] !== '')
      result[key] = preferenceData[key]
    return result
  }, {})
}

export function getEffectiveMaxVideoSize(serverOptions = {}) {
  const maxSize = Number(serverOptions.max_size)
  if (Number.isFinite(maxSize) && maxSize > 0)
    return maxSize
  return 1024
}

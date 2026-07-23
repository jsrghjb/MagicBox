/**
 * scrcpy 4.0 控制消息序列化（与 SDL 客户端相同协议）
 * @see https://github.com/Genymobile/scrcpy/blob/v4.0/app/src/control_msg.c
 */

export const CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT = 2
export const CONTROL_MSG_TYPE_INJECT_SCROLL_EVENT = 3

export const MOTION_EVENT_ACTION_DOWN = 0
export const MOTION_EVENT_ACTION_UP = 1
export const MOTION_EVENT_ACTION_MOVE = 2

export const MOTION_EVENT_BUTTON_PRIMARY = 1

/** scrcpy SC_POINTER_ID_GENERIC_FINGER = (uint64_t)-2 */
export const POINTER_ID_FINGER = 0xFFFFFFFFFFFFFFFEn

function writeU16BE(buf, offset, value) {
  buf.writeUInt16BE(value & 0xFFFF, offset)
}

function writeU32BE(buf, offset, value) {
  buf.writeUInt32BE(value >>> 0, offset)
}

function writeU64BE(buf, offset, value) {
  const big = typeof value === 'bigint' ? value : BigInt(value)
  buf.writeBigUInt64BE(big, offset)
}

function writePosition(buf, offset, x, y, screenWidth, screenHeight) {
  writeU32BE(buf, offset, x)
  writeU32BE(buf, offset + 4, y)
  writeU16BE(buf, offset + 8, screenWidth)
  writeU16BE(buf, offset + 10, screenHeight)
}

function floatToU16fp(value) {
  const clamped = Math.max(0, Math.min(1, value))
  return Math.round(clamped * 0xFFFF)
}

function floatToI16fp(value) {
  const clamped = Math.max(-1, Math.min(1, value))
  return Math.round(clamped * 0x8000)
}

/**
 * @param {{ action: number, x: number, y: number, screenWidth: number, screenHeight: number, pressure?: number, pointerId?: bigint, buttons?: number }} params
 */
export function serializeInjectTouchEvent(params) {
  const {
    action,
    x,
    y,
    screenWidth,
    screenHeight,
    pressure = 1,
    pointerId = POINTER_ID_FINGER,
    buttons = MOTION_EVENT_BUTTON_PRIMARY,
  } = params

  const buf = Buffer.alloc(32)
  buf[0] = CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT
  buf[1] = action
  writeU64BE(buf, 2, pointerId)
  writePosition(buf, 10, x, y, screenWidth, screenHeight)
  writeU16BE(buf, 22, floatToU16fp(pressure))

  const actionButton = action === MOTION_EVENT_ACTION_UP ? 0 : MOTION_EVENT_BUTTON_PRIMARY
  writeU32BE(buf, 24, actionButton)
  writeU32BE(buf, 28, action === MOTION_EVENT_ACTION_UP ? 0 : buttons)
  return buf
}

/**
 * @param {{ x: number, y: number, screenWidth: number, screenHeight: number, hscroll?: number, vscroll?: number, buttons?: number }} params
 */
export function serializeInjectScrollEvent(params) {
  const {
    x,
    y,
    screenWidth,
    screenHeight,
    hscroll = 0,
    vscroll = 0,
    buttons = MOTION_EVENT_BUTTON_PRIMARY,
  } = params

  const buf = Buffer.alloc(21)
  buf[0] = CONTROL_MSG_TYPE_INJECT_SCROLL_EVENT
  writePosition(buf, 1, x, y, screenWidth, screenHeight)

  const hNorm = Math.max(-16, Math.min(16, hscroll)) / 16
  const vNorm = Math.max(-16, Math.min(16, vscroll)) / 16
  writeU16BE(buf, 13, floatToI16fp(hNorm) & 0xFFFF)
  writeU16BE(buf, 15, floatToI16fp(vNorm) & 0xFFFF)
  writeU32BE(buf, 17, buttons)
  return buf
}

export function touchActionFromName(name) {
  switch (name) {
    case 'down': return MOTION_EVENT_ACTION_DOWN
    case 'move': return MOTION_EVENT_ACTION_MOVE
    case 'up': return MOTION_EVENT_ACTION_UP
    default: return MOTION_EVENT_ACTION_DOWN
  }
}

export function mapPercentToVideoPoint(xPercent, yPercent, videoWidth, videoHeight) {
  const w = Math.max(1, videoWidth || 1)
  const h = Math.max(1, videoHeight || 1)
  return {
    x: Math.max(0, Math.min(w, Math.round(xPercent * w))),
    y: Math.max(0, Math.min(h, Math.round(yPercent * h))),
    screenWidth: w,
    screenHeight: h,
  }
}

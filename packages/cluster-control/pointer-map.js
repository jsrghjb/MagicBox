/**
 * 将屏幕指针坐标映射到视频内容区百分比（object-fit: contain 黑边修正）。
 */

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRectReadOnly | { left: number, top: number, width: number, height: number }} containerRect
 * @param {number} videoWidth - canvas 实际像素宽
 * @param {number} videoHeight - canvas 实际像素高
 * @returns {{ xPercent: number, yPercent: number, inBounds: boolean }}
 */
export function mapPointerToPercent(clientX, clientY, containerRect, videoWidth, videoHeight) {
  const displayW = containerRect.width
  const displayH = containerRect.height

  if (!displayW || !displayH) {
    return { xPercent: 0, yPercent: 0, inBounds: false }
  }

  let contentW = displayW
  let contentH = displayH
  let offsetX = 0
  let offsetY = 0

  if (videoWidth > 0 && videoHeight > 0) {
    const videoAspect = videoWidth / videoHeight
    const displayAspect = displayW / displayH

    if (videoAspect > displayAspect) {
      contentW = displayW
      contentH = displayW / videoAspect
      offsetY = (displayH - contentH) / 2
    }
    else {
      contentH = displayH
      contentW = displayH * videoAspect
      offsetX = (displayW - contentW) / 2
    }
  }

  const localX = clientX - containerRect.left - offsetX
  const localY = clientY - containerRect.top - offsetY

  const inBounds = localX >= 0 && localY >= 0 && localX <= contentW && localY <= contentH
  const xPercent = Math.max(0, Math.min(1, localX / contentW))
  const yPercent = Math.max(0, Math.min(1, localY / contentH))

  return { xPercent, yPercent, inBounds }
}

/**
 * @param {number} displayDistancePx
 * @returns {{ action: 'tap' | 'swipe', duration?: number }}
 */
export function classifyGesture(displayDistancePx) {
  const SWIPE_THRESHOLD_PX = 15

  if (displayDistancePx >= SWIPE_THRESHOLD_PX) {
    return {
      action: 'swipe',
      duration: Math.min(900, Math.max(180, Math.round(displayDistancePx * 1.2))),
    }
  }

  return { action: 'tap' }
}

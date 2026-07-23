import { onUnmounted } from 'vue'
import { mapPointerToPercent } from '@escrcpy/cluster-control/pointer-map.js'
import { getDeviceMaxVideoSize } from '$/utils/cluster-preference-config.js'

const MOVE_INTERVAL_MS = 16
function scaledVideoSize(device, serial) {
  if (!device?.width || !device?.height)
    return { width: 0, height: 0 }

  const maxVideoSize = getDeviceMaxVideoSize(serial)
  const maxDim = Math.max(device.width, device.height)
  if (maxDim <= maxVideoSize)
    return { width: device.width, height: device.height }

  const scale = maxVideoSize / maxDim
  return {
    width: Math.round(device.width * scale),
    height: Math.round(device.height * scale),
  }
}

/**
 * 集群视图指针：连续 touch down/move/up，对齐 SDL/scrcpy 控制体验。
 */
export function useClusterPointer({ getStreamSize, masterSerialRef, getDeviceBySerial, onTouch, onScroll }) {
  /** @type {null | { serial: string, pointerId: number, containerEl: Element, lastMoveAt: number, ended: boolean }} */
  let session = null

  function resolveVideoSize(serial) {
    const stream = getStreamSize?.(serial)
    if (stream?.width && stream?.height)
      return stream

    return scaledVideoSize(getDeviceBySerial?.(serial), serial)
  }

  function buildPayload(serial, action, clientX, clientY) {
    if (!session?.containerEl)
      return null

    const rect = session.containerEl.getBoundingClientRect()
    const { width: videoWidth, height: videoHeight } = resolveVideoSize(serial)
    const percent = mapPointerToPercent(clientX, clientY, rect, videoWidth, videoHeight)
    const device = getDeviceBySerial?.(serial)

    return {
      action,
      xPercent: percent.xPercent,
      yPercent: percent.yPercent,
      videoWidth,
      videoHeight,
      sourceSerial: serial,
      masterSerial: masterSerialRef?.value || null,
      broadcast: !!(masterSerialRef?.value && masterSerialRef.value === serial),
      deviceWidth: device?.width || 0,
      deviceHeight: device?.height || 0,
      pointerId: session?.pointerId ?? 0,
    }
  }

  function emitTouch(action, clientX, clientY) {
    if (!session)
      return
    const payload = buildPayload(session.serial, action, clientX, clientY)
    if (!payload?.videoWidth || !payload?.videoHeight)
      return
    onTouch(payload)
  }

  function endSession(event) {
    if (!session || session.ended || event.pointerId !== session.pointerId)
      return false

    session.ended = true
    const el = session.containerEl
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', endSession)
    el.removeEventListener('pointercancel', endSession)
    el.removeEventListener('lostpointercapture', endSession)

    emitTouch('up', event.clientX, event.clientY)

    try {
      el.releasePointerCapture(event.pointerId)
    }
    catch {}

    session = null
    return true
  }

  function onPointerMove(event) {
    if (!session || session.ended || event.pointerId !== session.pointerId)
      return

    const now = Date.now()
    if (now - session.lastMoveAt < MOVE_INTERVAL_MS)
      return
    session.lastMoveAt = now
    emitTouch('move', event.clientX, event.clientY)
  }

  function onPointerDown(event, serial) {
    if (event.button !== 0)
      return

    event.stopPropagation()

    if (session)
      endSession(event)

    const el = event.currentTarget
    session = {
      serial,
      pointerId: event.pointerId,
      containerEl: el,
      lastMoveAt: 0,
      ended: false,
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endSession)
    el.addEventListener('pointercancel', endSession)
    el.addEventListener('lostpointercapture', endSession)

    try {
      el.setPointerCapture(event.pointerId)
    }
    catch {}

    emitTouch('down', event.clientX, event.clientY)
  }

  function onWheel(event, serial) {
    event.preventDefault()
    event.stopPropagation()

    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    const { width: videoWidth, height: videoHeight } = resolveVideoSize(serial)
    if (!videoWidth || !videoHeight)
      return

    const percent = mapPointerToPercent(event.clientX, event.clientY, rect, videoWidth, videoHeight)
    onScroll?.({
      xPercent: percent.xPercent,
      yPercent: percent.yPercent,
      videoWidth,
      videoHeight,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      sourceSerial: serial,
      masterSerial: masterSerialRef?.value || null,
      broadcast: !!(masterSerialRef?.value && masterSerialRef.value === serial),
    })
  }

  onUnmounted(() => {
    if (session) {
      session.ended = true
      session = null
    }
  })

  return {
    onPointerDown,
    onWheel,
  }
}

/**
 * 集群控制主进程模块
 * 负责批量启动 scrcpy-server 实例，处理输入事件广播
 */

import { ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { initializeCluster, stopScrcpyInstances } from '@escrcpy/cluster-control'
import { getEffectiveMaxVideoSize } from '@escrcpy/cluster-control/preference-video-config.js'
import { H264StreamParser } from '@escrcpy/cluster-control/h264-stream.js'
import {
  mapPercentToVideoPoint,
  serializeInjectScrollEvent,
  serializeInjectTouchEvent,
  touchActionFromName,
} from '@escrcpy/cluster-control/scrcpy-control.js'
import { getAdbPath } from '$electron/configs/which/index.js'
import { extraResolve } from '$electron/process/resources.js'
import { trySend } from '$electron/helpers/index.js'
import {
  assertClusterVideoEnabled,
  getDeviceVideoServerOptions,
  getMergedDevicePreferenceData,
} from './preference-loader.js'

const serverPath = process.env.SCRCPY_SERVER_PATH || `${extraResolve('common/scrcpy')}/scrcpy-server`
const FALLBACK_CLUSTER_MAX_VIDEO_SIZE = 1024
/** @type {Map<string, number>} */
const deviceMaxVideoSizes = new Map()

/** @type {Set<ReturnType<typeof setTimeout>>} */
const pendingTimers = new Set()
let runningInstances = []
/** @type {Map<string, import('node:net').Socket>} */
const clients = new Map()
/** @type {Map<string, import('node:net').Socket>} */
const controlClients = new Map()
/** @type {Map<string, import('node:net').Socket>} */
const audioClients = new Map()
/** @type {Map<string, H264StreamParser>} */
const streamParsers = new Map()
/** @type {Set<string>} */
const controlConnectScheduled = new Set()
/** @type {Map<string, { xPercent: number, yPercent: number }>} */
const adbTouchStarts = new Map()
/** @type {Map<string, 'scrcpy' | 'adb'>} */
const touchGesturePaths = new Map()
/** @type {Map<string, number>} */
const lastTouchUpAt = new Map()
/** @type {Map<string, { width: number, height: number }>} */
const deviceStreamSizes = new Map()
/** @type {string | null} */
let currentMasterSerial = null
let clusterSession = 0

/** stdout 管道断开时 console 会抛 EPIPE，避免未捕获异常死循环弹窗 */
function safeLog(level, ...args) {
  try {
    console[level](...args)
  }
  catch (error) {
    if (error?.code !== 'EPIPE' && error?.errno !== -32)
      throw error
  }
}

function scheduleTimer(fn, delayMs) {
  const id = setTimeout(() => {
    pendingTimers.delete(id)
    try {
      fn()
    }
    catch (error) {
      if (error?.code !== 'EPIPE' && error?.errno !== -32)
        safeLog('error', '[cluster-control] timer error:', error?.message || error)
    }
  }, delayMs)
  pendingTimers.add(id)
  return id
}

function clearAllTimers() {
  for (const id of pendingTimers)
    clearTimeout(id)
  pendingTimers.clear()
}

function cancelTimer(id) {
  if (id == null)
    return
  clearTimeout(id)
  pendingTimers.delete(id)
}

function isSessionActive(session, webContents) {
  return session === clusterSession && !webContents?.isDestroyed?.()
}

ipcMain.handle('cluster-control:initialize', async (event, config = {}) => {
  stopAll()

  const session = clusterSession

  try {
    const { devices, instances } = await initializeCluster({
      ...config,
      adbPath: getAdbPath(),
      serverPath,
      getDeviceConfig: (device) => {
        const serverOptions = getDeviceVideoServerOptions(device.serial)
        assertClusterVideoEnabled(serverOptions)
        deviceMaxVideoSizes.set(device.serial, getEffectiveMaxVideoSize(serverOptions))
        const preferenceData = getMergedDevicePreferenceData(device.serial)
        return {
          adbPath: getAdbPath(),
          serverPath,
          serverOptions,
          enableAudio: !(preferenceData['--no-audio'] === true),
        }
      },
    })
    runningInstances = instances

    instances.forEach((instance, index) => {
      const { videoPort, serial } = instance
      scheduleTimer(() => {
        if (!isSessionActive(session, event.sender))
          return
        connectToVideoStream(serial, videoPort, event.sender, 0, session)
      }, 1500 + index * 350)
    })

    return {
      success: true,
      session,
      devices: devices.map(d => ({
        serial: d.serial,
        model: d.model,
        width: d.width,
        height: d.height,
        density: d.density,
        videoPort: runningInstances.find(i => i.serial === d.serial)?.videoPort,
      })),
    }
  }
  catch (error) {
    safeLog('error', '[cluster-control] 初始化失败', error)
    return {
      success: false,
      error: error.message,
    }
  }
})

function destroyVideoClient(serial, intentional = true) {
  const client = clients.get(serial)
  if (!client)
    return

  if (intentional)
    client._intentionalClose = true

  client.destroy()
  clients.delete(serial)
  streamParsers.delete(serial)
}

function destroyAudioClient(serial, intentional = true) {
  const client = audioClients.get(serial)
  if (!client)
    return

  if (intentional)
    client._intentionalClose = true

  client.destroy()
  audioClients.delete(serial)
}

function connectToAudioStream(serial, port, session, attempt = 0, onConnected = null) {
  if (session !== clusterSession)
    return

  destroyAudioClient(serial, true)

  const client = new net.Socket()
  client._intentionalClose = false

  client.connect(port, '127.0.0.1', () => {
    if (session !== clusterSession) {
      client._intentionalClose = true
      client.destroy()
      return
    }
    audioClients.set(serial, client)
    safeLog('log', `[cluster-control][${serial}] 音频通道已连接: ${port}`)
    onConnected?.()
  })

  // Drain audio bytes to prevent scrcpy-server from blocking.
  client.on('data', () => {})

  client.on('error', (error) => {
    if (client._intentionalClose || session !== clusterSession)
      return
    safeLog('warn', `[cluster-control][${serial}] 音频通道错误 (attempt ${attempt + 1}):`, error.message)
    destroyAudioClient(serial, true)
    if (attempt < 8) {
      scheduleTimer(() => connectToAudioStream(serial, port, session, attempt + 1, onConnected), 800)
    }
  })

  client.on('close', () => {
    destroyAudioClient(serial, false)
  })
}

function destroyControlClient(serial, intentional = true) {
  const client = controlClients.get(serial)
  if (!client)
    return

  if (intentional)
    client._intentionalClose = true

  client.destroy()
  controlClients.delete(serial)
  controlConnectScheduled.delete(serial)
}

function connectToControlStream(serial, port, session, attempt = 0, onConnected = null) {
  if (session !== clusterSession)
    return

  destroyControlClient(serial, true)
  controlConnectScheduled.add(serial)

  const client = new net.Socket()
  client._intentionalClose = false

  client.connect(port, '127.0.0.1', () => {
    if (session !== clusterSession) {
      client._intentionalClose = true
      client.destroy()
      return
    }
    controlClients.set(serial, client)
    safeLog('log', `[cluster-control][${serial}] 控制通道已连接: ${port}`)
    onConnected?.()
  })

  client.on('error', (error) => {
    if (client._intentionalClose || session !== clusterSession)
      return
    safeLog('warn', `[cluster-control][${serial}] 控制通道错误 (attempt ${attempt + 1}):`, error.message)
    destroyControlClient(serial, true)
    if (attempt < 8) {
      scheduleTimer(() => connectToControlStream(serial, port, session, attempt + 1, onConnected), 600)
    }
  })

  client.on('close', () => {
    if (client._intentionalClose || session !== clusterSession) {
      controlClients.delete(serial)
      return
    }
    controlClients.delete(serial)
    if (attempt < 8) {
      scheduleTimer(() => connectToControlStream(serial, port, session, attempt + 1, onConnected), 800)
    }
  })
}

function connectToVideoStream(serial, port, webContents, attempt = 0, session = clusterSession) {
  if (!isSessionActive(session, webContents))
    return

  destroyVideoClient(serial, true)

  const client = new net.Socket()
  client._intentionalClose = false
  const parser = new H264StreamParser()
  streamParsers.set(serial, parser)

  let gotData = false
  let dataTimer = null
  let reconnectTimer = null

  const cleanup = () => {
    if (dataTimer) {
      cancelTimer(dataTimer)
      dataTimer = null
    }
    if (reconnectTimer) {
      cancelTimer(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = (delayMs) => {
    if (!isSessionActive(session, webContents))
      return
    if (attempt >= 15)
      return
    if (reconnectTimer)
      return

    reconnectTimer = scheduleTimer(() => {
      reconnectTimer = null
      connectToVideoStream(serial, port, webContents, attempt + 1, session)
    }, delayMs)
  }

  const retry = () => {
    cleanup()
    client._intentionalClose = true
    client.destroy()
    streamParsers.delete(serial)
    clients.delete(serial)
    destroyControlClient(serial, true)
    destroyAudioClient(serial, true)
    controlConnectScheduled.delete(serial)
    scheduleReconnect(800)
  }

  client.connect(port, '127.0.0.1', () => {
    if (session !== clusterSession) {
      client._intentionalClose = true
      client.destroy()
      return
    }

    safeLog('log', `[cluster-control][${serial}] 视频流已连接: ${port} (attempt ${attempt + 1})`)
    clients.set(serial, client)

    const instance = runningInstances.find(item => item.serial === serial)
    if (instance?.enableAudio) {
      connectToAudioStream(serial, port, session, 0, () => {
        connectToControlStream(serial, port, session, 0)
      })
    }
    else {
      connectToControlStream(serial, port, session, 0)
    }

    dataTimer = scheduleTimer(() => {
      if (!isSessionActive(session, webContents))
        return
      if (!gotData) {
        safeLog('warn', `[cluster-control][${serial}] 连接无数据，重试...`)
        retry()
      }
    }, 5000)
  })

  client.on('data', (data) => {
    if (session !== clusterSession)
      return

    gotData = true
    cleanup()

    const frames = parser.push(data)
    for (const frame of frames) {
      if (frame.config) {
        trySend(webContents, 'cluster-control:frame', {
          session,
          serial,
          config: true,
          sps: frame.sps,
          pps: frame.pps,
        })
        continue
      }

      trySend(webContents, 'cluster-control:frame', {
        session,
        serial,
        keyframe: frame.keyframe,
        data: frame.data,
      })
    }
  })

  client.on('error', (error) => {
    if (client._intentionalClose || session !== clusterSession)
      return
    safeLog('error', `[cluster-control][${serial}] 视频流连接错误 (attempt ${attempt + 1})`, error.message)
    retry()
  })

  client.on('close', () => {
    cleanup()
    if (client._intentionalClose || session !== clusterSession) {
      clients.delete(serial)
      streamParsers.delete(serial)
      return
    }

    safeLog('log', `[cluster-control][${serial}] 视频流已关闭，准备重连...`)
    clients.delete(serial)
    streamParsers.delete(serial)
    destroyControlClient(serial, true)
    controlConnectScheduled.delete(serial)
    scheduleReconnect(1000)
  })
}

function resolveTargets(sourceSerial, broadcast) {
  return broadcast
    ? runningInstances
    : runningInstances.filter(item => item.serial === sourceSerial)
}

function shouldBroadcastInput(sourceSerial, touch) {
  if (touch?.broadcast)
    return true

  const master = touch?.masterSerial || currentMasterSerial
  return !!(master && sourceSerial === master)
}

function scaledDeviceVideoSize(device) {
  const dw = device?.width || 0
  const dh = device?.height || 0
  if (!dw || !dh)
    return { width: 0, height: 0 }

  const maxDim = Math.max(dw, dh)
  const maxVideoSize = deviceMaxVideoSizes.get(device?.serial)
    || deviceMaxVideoSizes.get(device?.id)
    || FALLBACK_CLUSTER_MAX_VIDEO_SIZE
  if (maxDim <= maxVideoSize)
    return { width: dw, height: dh }

  const scale = maxVideoSize / maxDim
  return {
    width: Math.round(dw * scale),
    height: Math.round(dh * scale),
  }
}

function resolveTouchVideoSize(serial, device, touch) {
  const stream = deviceStreamSizes.get(serial)
  if (stream?.width && stream?.height)
    return stream

  if (serial === touch.sourceSerial && touch.videoWidth && touch.videoHeight) {
    return { width: touch.videoWidth, height: touch.videoHeight }
  }

  const scaled = scaledDeviceVideoSize(device)
  if (scaled.width && scaled.height)
    return scaled

  return {
    width: touch.videoWidth || device?.width || touch.deviceWidth || 0,
    height: touch.videoHeight || device?.height || touch.deviceHeight || 0,
  }
}

function writeScrcpyTouch(serial, touch, point) {
  const control = controlClients.get(serial)
  if (!control || control.destroyed)
    return false

  try {
    control.write(serializeInjectTouchEvent({
      action: touchActionFromName(touch.action),
      x: point.x,
      y: point.y,
      screenWidth: point.screenWidth,
      screenHeight: point.screenHeight,
    }))
    return true
  }
  catch (error) {
    safeLog('warn', `[cluster-control][${serial}] control write failed:`, error?.message || error)
    return false
  }
}

ipcMain.handle('cluster-control:setMaster', (_event, serial) => {
  currentMasterSerial = serial || null
  return { success: true, masterSerial: currentMasterSerial }
})

ipcMain.on('cluster-control:streamSize', (_event, payload) => {
  const { serial, width, height } = payload || {}
  if (!serial || !width || !height)
    return
  deviceStreamSizes.set(serial, { width, height })
})

/** scrcpy 原生 touch 注入（低延迟，与 SDL 窗口一致） */
ipcMain.on('cluster-control:touch', (event, touch) => {
  if (!touch?.sourceSerial || !touch?.action)
    return

  const broadcast = shouldBroadcastInput(touch.sourceSerial, touch)
  for (const instance of resolveTargets(touch.sourceSerial, broadcast))
    injectScrcpyTouch(instance.serial, instance.deviceInfo, touch)
})

/** 滚轮滚动 */
ipcMain.on('cluster-control:scroll', (event, scroll) => {
  if (!scroll?.sourceSerial)
    return

  const broadcast = shouldBroadcastInput(scroll.sourceSerial, scroll)
  for (const instance of resolveTargets(scroll.sourceSerial, broadcast))
    injectScrcpyScroll(instance.serial, instance.deviceInfo, scroll)
})

/** 兼容旧 gesture 通道 */
ipcMain.handle('cluster-control:input', (event, gesture) => {
  if (!gesture?.sourceSerial)
    return { success: false, reason: 'missing sourceSerial' }

  const touch = gestureToTouch(gesture)
  const broadcast = shouldBroadcastInput(gesture.sourceSerial, gesture)
  if (touch) {
    for (const instance of resolveTargets(gesture.sourceSerial, broadcast))
      injectScrcpyTouch(instance.serial, instance.deviceInfo, touch)
    return { success: true, count: resolveTargets(gesture.sourceSerial, broadcast).length }
  }

  for (const instance of resolveTargets(gesture.sourceSerial, broadcast))
    injectAdbGesture(instance.serial, instance.deviceInfo, gesture)

  return { success: true, count: resolveTargets(gesture.sourceSerial, broadcast).length }
})

ipcMain.on('cluster-control:broadcast-input', (event, eventData) => {
  runningInstances.forEach((instance) => {
    injectLegacyTap(instance.serial, instance.deviceInfo, eventData)
  })
})

function gestureToTouch(gesture) {
  if (gesture?.xPercent == null || gesture?.yPercent == null)
    return null

  if (gesture.action === 'tap') {
    return {
      action: 'down',
      ...gesture,
    }
  }

  return null
}

function injectScrcpyTouch(serial, device, touch) {
  const { width: videoW, height: videoH } = resolveTouchVideoSize(serial, device, touch)
  if (!videoW || !videoH)
    return

  if (touch.action === 'up') {
    const now = Date.now()
    if (now - (lastTouchUpAt.get(serial) || 0) < 100)
      return
    lastTouchUpAt.set(serial, now)
  }

  const point = mapPercentToVideoPoint(touch.xPercent, touch.yPercent, videoW, videoH)

  if (touch.action === 'down') {
    adbTouchStarts.delete(serial)
    const usedScrcpy = writeScrcpyTouch(serial, touch, point)
    touchGesturePaths.set(serial, usedScrcpy ? 'scrcpy' : 'adb')
    if (!usedScrcpy) {
      adbTouchStarts.set(serial, {
        xPercent: touch.xPercent,
        yPercent: touch.yPercent,
        endXPercent: touch.xPercent,
        endYPercent: touch.yPercent,
      })
    }
    return
  }

  const path = touchGesturePaths.get(serial) || 'adb'

  if (path === 'scrcpy') {
    if (writeScrcpyTouch(serial, touch, point)) {
      if (touch.action === 'up')
        touchGesturePaths.delete(serial)
      return
    }

    if (touch.action === 'up') {
      touchGesturePaths.delete(serial)
      injectAdbTouchFallback(serial, device, touch, point)
      return
    }

    touchGesturePaths.set(serial, 'adb')
  }

  injectAdbTouchFallback(serial, device, touch, point)
  if (touch.action === 'up')
    touchGesturePaths.delete(serial)
}

function injectAdbTouchFallback(serial, device, touch, point) {
  const w = device?.width || touch.deviceWidth || point.screenWidth || 0
  const h = device?.height || touch.deviceHeight || point.screenHeight || 0
  if (!w || !h)
    return

  if (touch.action === 'down') {
    adbTouchStarts.set(serial, {
      xPercent: touch.xPercent,
      yPercent: touch.yPercent,
      endXPercent: touch.xPercent,
      endYPercent: touch.yPercent,
    })
    return
  }

  if (touch.action === 'move') {
    const start = adbTouchStarts.get(serial)
    if (!start) {
      adbTouchStarts.set(serial, {
        xPercent: touch.xPercent,
        yPercent: touch.yPercent,
        endXPercent: touch.xPercent,
        endYPercent: touch.yPercent,
      })
      return
    }

    start.endXPercent = touch.xPercent
    start.endYPercent = touch.yPercent
    return
  }

  if (touch.action !== 'up')
    return

  const start = adbTouchStarts.get(serial) || {
    xPercent: touch.xPercent,
    yPercent: touch.yPercent,
    endXPercent: touch.xPercent,
    endYPercent: touch.yPercent,
  }
  adbTouchStarts.delete(serial)

  const x1 = Math.round(start.xPercent * w)
  const y1 = Math.round(start.yPercent * h)
  const x2 = Math.round((start.endXPercent ?? touch.xPercent) * w)
  const y2 = Math.round((start.endYPercent ?? touch.yPercent) * h)
  const dist = Math.hypot(x2 - x1, y2 - y1)

  if (dist < 20) {
    spawn(getAdbPath(), ['-s', serial, 'shell', 'input', 'tap', String(x2), String(y2)])
    return
  }

  const duration = Math.max(150, Math.min(900, Math.round(dist * 1.5)))
  spawn(getAdbPath(), [
    '-s', serial, 'shell', 'input', 'swipe',
    String(x1), String(y1), String(x2), String(y2), String(duration),
  ])
}

function injectScrcpyScroll(serial, device, scroll) {
  const { width: videoW, height: videoH } = resolveTouchVideoSize(serial, device, scroll)
  if (!videoW || !videoH)
    return

  const point = mapPercentToVideoPoint(scroll.xPercent, scroll.yPercent, videoW, videoH)
  const control = controlClients.get(serial)
  if (!control || control.destroyed)
    return

  const vscroll = Math.max(-16, Math.min(16, scroll.deltaY / 30))
  const hscroll = Math.max(-16, Math.min(16, scroll.deltaX / 30))
  const buf = serializeInjectScrollEvent({
    x: point.x,
    y: point.y,
    screenWidth: point.screenWidth,
    screenHeight: point.screenHeight,
    hscroll,
    vscroll,
  })
  control.write(buf)
}

function injectAdbTap(serial, device, touch) {
  const w = device?.width || touch.deviceWidth || 0
  const h = device?.height || touch.deviceHeight || 0
  if (!w || !h)
    return

  const x = Math.round(touch.xPercent * w)
  const y = Math.round(touch.yPercent * h)
  spawn(getAdbPath(), ['-s', serial, 'shell', 'input', 'tap', String(x), String(y)])
}

function injectAdbGesture(serial, device, gesture) {
  const w = device?.width || gesture.deviceWidth || 0
  const h = device?.height || gesture.deviceHeight || 0
  if (!serial || !w || !h)
    return

  const x1 = Math.round(gesture.xPercent * w)
  const y1 = Math.round(gesture.yPercent * h)

  if (gesture.action === 'swipe') {
    const x2 = Math.round((gesture.x2Percent ?? gesture.xPercent) * w)
    const y2 = Math.round((gesture.y2Percent ?? gesture.yPercent) * h)
    const duration = Math.max(120, Math.min(1200, gesture.duration || 300))
    spawn(getAdbPath(), [
      '-s', serial, 'shell', 'input', 'swipe',
      String(x1), String(y1), String(x2), String(y2), String(duration),
    ])
    return
  }

  spawn(getAdbPath(), ['-s', serial, 'shell', 'input', 'tap', String(x1), String(y1)])
}

function injectLegacyTap(serial, device, event) {
  if (event.type !== 'click' && event.type !== 'mousedown')
    return

  let x = event.x
  let y = event.y

  if ((x == null || y == null) && device && event.xPercent != null && event.yPercent != null) {
    x = Math.round(event.xPercent * device.width)
    y = Math.round(event.yPercent * device.height)
  }

  if (x == null || y == null)
    return

  spawn(getAdbPath(), ['-s', serial, 'shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))])
}

ipcMain.handle('cluster-control:stopAll', () => {
  stopAll()
  return { success: true }
})

function stopAll() {
  clusterSession++
  clearAllTimers()

  for (const serial of [...clients.keys()])
    destroyVideoClient(serial, true)

  for (const serial of [...controlClients.keys()])
    destroyControlClient(serial, true)

  for (const serial of [...audioClients.keys()])
    destroyAudioClient(serial, true)

  controlConnectScheduled.clear()
  adbTouchStarts.clear()
  touchGesturePaths.clear()
  lastTouchUpAt.clear()
  deviceStreamSizes.clear()
  deviceMaxVideoSizes.clear()
  currentMasterSerial = null
  stopScrcpyInstances(runningInstances)
  runningInstances = []
}

process.on('exit', () => {
  stopAll()
})

export default {
  name: 'clusterControl',
  apply() {},
}

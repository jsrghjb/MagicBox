/**
 * 集群控制主进程模块
 * 负责批量启动 scrcpy-server 实例，处理输入事件广播
 */

import { ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { getAdbDevices, startScrcpyInstances, stopScrcpyInstances } from '@escrcpy/cluster-control'
import { getEffectiveMaxVideoSize } from '@escrcpy/cluster-control/preference-video-config.js'
import { H264StreamParser } from '@escrcpy/cluster-control/h264-stream.js'
import {
  mapPercentToVideoPoint,
  MOTION_EVENT_ACTION_DOWN,
  MOTION_EVENT_ACTION_MOVE,
  MOTION_EVENT_ACTION_UP,
  serializeInjectScrollEvent,
  serializeInjectTouchEvent,
  touchActionFromName,
} from '@escrcpy/cluster-control/scrcpy-control.js'
import { getAdbPath, getScrcpyPath } from '$electron/configs/which/index.js'
import { extraResolve } from '$electron/process/resources.js'
import { trySend } from '$electron/helpers/index.js'
import { getSecret } from '$electron/helpers/secure-store/index.js'
import { getMachineId } from '../license/machine.js'
import { parseAndVerifyKey } from '../license/index.js'
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

/** 帧率节流：多设备场景下限制 IPC 帧传输频率 */
const frameThrottleMap = new Map() // serial -> { lastTime, minIntervalMs }
const configSent = new Set()

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
    // 1. 许可证设备数量限制
    const machineId = await getMachineId()
    const savedKey = getSecret('license_key') || ''
    const license = parseAndVerifyKey(savedKey, machineId)
    const maxDevices = license.deviceLimit || 2
    safeLog('info', `[cluster-control] 许可证: tier=${license.tier}, deviceLimit=${maxDevices}`)

    // 2. 先探测设备，再根据许可证限制数量
    const allDevices = await getAdbDevices({ adbPath: getAdbPath() })
    if (allDevices.length === 0) {
      safeLog('warn', '[cluster-control] 未探测到任何在线 ADB 设备')
      return { success: true, session, maxDevices, devices: [] }
    }

    safeLog('info', `[cluster-control] 探测到 ${allDevices.length} 台设备，许可证限制 ${maxDevices} 台`)

    const limitedDevices = allDevices.slice(0, maxDevices)
    const exceededCount = allDevices.length - limitedDevices.length
    if (exceededCount > 0) {
      safeLog('warn', `[cluster-control] 许可证限制 ${maxDevices} 台，跳过 ${exceededCount} 台设备`)
    }

    // 3. 只为限量设备启动 scrcpy
    const instances = await startScrcpyInstances(limitedDevices, {
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

    // 视频流连接：并行连接，渐进间隔避免瞬间冲击
    const initialBatch = Math.min(3, instances.length)
    instances.forEach((instance, index) => {
      const { videoPort, serial } = instance
      const delay = index < initialBatch
        ? 200 + index * 100
        : 500 + index * 150
      scheduleTimer(() => {
        if (!isSessionActive(session, event.sender))
          return
        connectToVideoStream(serial, videoPort, event.sender, 0, session)
      }, delay)
    })

    return {
      success: true,
      session,
      maxDevices,
      devices: limitedDevices.map(d => ({
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
  configSent.delete(serial)
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

  // 检查 scrcpy 进程是否存活
  const instance = runningInstances.find(item => item.serial === serial)
  if (instance?.process?.exitCode !== null && instance?.process?.exitCode !== undefined) {
    safeLog('warn', `[cluster-control][${serial}] scrcpy 进程已退出，跳过控制通道`)
    return
  }

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
    if (attempt < 3)
      safeLog('warn', `[cluster-control][${serial}] 控制通道错误 (attempt ${attempt + 1}):`, error.message)
    destroyControlClient(serial, true)
    if (attempt < 5) {
      scheduleTimer(() => connectToControlStream(serial, port, session, attempt + 1, onConnected), 1000 + attempt * 500)
    }
  })

  client.on('close', () => {
    if (client._intentionalClose || session !== clusterSession) {
      controlClients.delete(serial)
      return
    }
    controlClients.delete(serial)
    if (attempt < 5) {
      scheduleTimer(() => connectToControlStream(serial, port, session, attempt + 1, onConnected), 1000 + attempt * 500)
    }
  })
}

function connectToVideoStream(serial, port, webContents, attempt = 0, session = clusterSession, onReady = null) {
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
  let readyFired = false

  const fireReady = () => {
    if (readyFired)
      return
    readyFired = true
    try {
      onReady?.()
    }
    catch {}
  }

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
      connectToVideoStream(serial, port, webContents, attempt + 1, session, onReady)
    }, delayMs)
  }

  const retry = () => {
    cleanup()
    client._intentionalClose = true
    client.destroy()
    streamParsers.delete(serial)
    clients.delete(serial)
    configSent.delete(serial)
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

    // 延迟连接控制/音频通道，确保 scrcpy-server 准备就绪
    scheduleTimer(() => {
      if (!isSessionActive(session, webContents))
        return

      // 检查 scrcpy 进程是否存活
      const instance = runningInstances.find(item => item.serial === serial)
      if (instance?.process?.exitCode !== null && instance?.process?.exitCode !== undefined) {
        safeLog('warn', `[cluster-control][${serial}] scrcpy 进程已退出，跳过控制通道`)
        return
      }

      if (instance?.enableAudio) {
        connectToAudioStream(serial, port, session, 0, () => {
          connectToControlStream(serial, port, session, 0)
        })
      }
      else {
        connectToControlStream(serial, port, session, 0)
      }
    }, 500)

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

    if (!gotData) {
      gotData = true
      fireReady()
    }
    cleanup()

    const frames = parser.push(data)
    // 帧率节流：非关键帧超过最小间隔则跳过
    const throttle = frameThrottleMap.get(serial) || { lastTime: 0, minIntervalMs: 16 }
    const now = Date.now()

    for (const frame of frames) {
      if (frame.config) {
        if (!configSent.has(serial)) {
          configSent.add(serial)
          safeLog('log', `[cluster-control][${serial}] 首次发送 config 到渲染进程`)
        }
        trySend(webContents, 'cluster-control:frame', {
          session,
          serial,
          config: true,
          sps: frame.sps,
          pps: frame.pps,
        })
        continue
      }

      // 关键帧不节流，非关键帧按间隔节流
      if (!frame.keyframe && now - throttle.lastTime < throttle.minIntervalMs)
        continue

      throttle.lastTime = now
      frameThrottleMap.set(serial, throttle)

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

ipcMain.handle('cluster-control:hasControl', (_event, serial) => {
  if (!serial)
    return { connected: false }
  const client = controlClients.get(serial)
  return { connected: Boolean(client && !client.destroyed) }
})

/**
 * 注入高精度贝塞尔触控轨迹流（Scrcpy Socket 直连）
 */
ipcMain.handle('cluster-control:injectTrajectory', async (_event, payload) => {
  const { serial, trajectory, duration = 300 } = payload || {}
  if (!serial || !trajectory?.length) {
    return { success: false, reason: 'invalid_params' }
  }

  const control = controlClients.get(serial)
  if (control && !control.destroyed) {
    const device = runningInstances.find(i => i.serial === serial)?.deviceInfo
    const streamSize = deviceStreamSizes.get(serial)
    const videoW = streamSize?.width || device?.width || 1080
    const videoH = streamSize?.height || device?.height || 1920

    try {
      // 1. 发送按下 DOWN 事件
      const pStart = trajectory[0]
      control.write(serializeInjectTouchEvent({
        action: MOTION_EVENT_ACTION_DOWN,
        x: pStart.x,
        y: pStart.y,
        screenWidth: videoW,
        screenHeight: videoH,
        pressure: pStart.pressure || 0.8,
      }))

      // 2. 毫秒级流式下发贝塞尔中间插值点 MOVE 事件
      for (let i = 1; i < trajectory.length - 1; i++) {
        const pt = trajectory[i]
        const prevPt = trajectory[i - 1]
        const delay = Math.max(1, (pt.timeOffset || 0) - (prevPt.timeOffset || 0))
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        control.write(serializeInjectTouchEvent({
          action: MOTION_EVENT_ACTION_MOVE,
          x: pt.x,
          y: pt.y,
          screenWidth: videoW,
          screenHeight: videoH,
          pressure: pt.pressure || 0.7,
        }))
      }

      // 3. 发送抬起 UP 事件
      const pEnd = trajectory[trajectory.length - 1]
      const lastDelay = Math.max(1, (pEnd.timeOffset || 0) - (trajectory[trajectory.length - 2]?.timeOffset || 0))
      if (lastDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, lastDelay))
      }
      control.write(serializeInjectTouchEvent({
        action: MOTION_EVENT_ACTION_UP,
        x: pEnd.x,
        y: pEnd.y,
        screenWidth: videoW,
        screenHeight: videoH,
        pressure: 0,
      }))

      return { success: true, channel: 'scrcpy_socket' }
    }
    catch (err) {
      safeLog('warn', `[cluster-control][${serial}] injectTrajectory error:`, err?.message || err)
      return { success: false, fallback: true }
    }
  }

  return { success: false, channel: 'none' }
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

/** 独立 SDL 窗口：只允许同时打开一个 */
let standaloneProcess = null

ipcMain.handle('cluster-control:openStandalone', (_event, { serial, model }) => {
  // 关闭上一个独立窗口
  if (standaloneProcess && !standaloneProcess.killed) {
    try {
      standaloneProcess.kill('SIGTERM')
    }
    catch {}
    standaloneProcess = null
  }

  const scrcpyPath = getScrcpyPath()
  const title = model ? `${model} (${serial})` : serial

  standaloneProcess = spawn(scrcpyPath, [
    '--serial', serial,
    '--window-title', title,
    '--stay-awake',
    '--turn-screen-off',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  standaloneProcess.on('exit', () => {
    standaloneProcess = null
  })

  standaloneProcess.stderr?.on('data', (data) => {
    safeLog('debug', `[cluster-control][standalone] ${data.toString().trim()}`)
  })

  safeLog('log', `[cluster-control] 已打开独立窗口: ${serial}`)
  return { success: true }
})

ipcMain.handle('cluster-control:closeStandalone', () => {
  if (standaloneProcess && !standaloneProcess.killed) {
    try {
      standaloneProcess.kill('SIGTERM')
    }
    catch {}
    standaloneProcess = null
    safeLog('log', '[cluster-control] 已关闭独立窗口')
  }
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
  frameThrottleMap.clear()
  configSent.clear()
  currentMasterSerial = null
  stopScrcpyInstances(runningInstances)
  runningInstances = []

  // 关闭独立 SDL 窗口
  if (standaloneProcess && !standaloneProcess.killed) {
    try {
      standaloneProcess.kill('SIGTERM')
    }
    catch {}
    standaloneProcess = null
  }
}

process.on('exit', () => {
  stopAll()
})

export default {
  name: 'clusterControl',
  apply() {},
}

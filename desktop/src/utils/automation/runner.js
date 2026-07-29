import dayjs from 'dayjs'
import { RunnerStatus } from './runner-status.js'
import { buildVariableMap, interpolateStep } from './variables.js'

export { RunnerStatus }

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('STOPPED'))
      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer)
      reject(new Error('STOPPED'))
    }, { once: true })
  })
}
function withTimeout(promise, ms, signal, errorMessage = '指令执行超时') {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMessage))
    }, ms)

    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer)
      reject(new Error('STOPPED'))
    }, { once: true })
  })

  return Promise.race([
    promise,
    timeoutPromise,
  ]).finally(() => {
    clearTimeout(timer)
  })
}

function waitWhilePaused(controller) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (controller.signal.aborted) {
        reject(new Error('STOPPED'))
        return
      }

      if (!controller.paused) {
        resolve()
        return
      }

      setTimeout(check, 100)
    }

    check()
  })
}

function randomGaussian() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function applyRandomOffset(value, randomRange = 0, axis = 'coord') {
  const range = Number(randomRange || 0)
  if (!range) {
    return Number(value || 0)
  }

  const factor = axis === 'time' ? 500 : 5
  // Use Box-Muller transform for coordinates to simulate human Gaussian click distribution.
  // Standard deviation is scaled by 0.5 so ~95% of offsets stay within range.
  const offsetMultiplier = axis === 'time' ? (Math.random() * 2 - 1) : (randomGaussian() * 0.5)
  const offset = offsetMultiplier * range * factor
  return Math.round(Number(value || 0) + offset)
}

function escapeInputText(text = '') {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/ /g, '%s')
    .replace(/(['"`$!&|;<>(){}[\]])/g, '\\$1')
}

function joinPath(...parts) {
  return window.$preload.path.join(...parts)
}

function dirname(filePath) {
  return window.$preload.path.dirname(filePath)
}

function encodeUtf8Base64(text = '') {
  return btoa(unescape(encodeURIComponent(text)))
}

// Clamp a coordinate safely within screen bounds.
// margin: extra inset beyond the default 10px edge padding (used for pre-offset safe zones)
function clampCoord(value, max, margin = 0) {
  if (!max)
    return Math.round(Number(value || 0))
  const inset = 10 + margin
  return Math.max(inset, Math.min(max - inset, Math.round(Number(value || 0))))
}

function resolveSavePath(step, deviceId) {
  if (step.savePath) {
    return step.savePath
  }

  const desktop = window.$preload.configs?.desktopPath || ''
  const ext = step.type === 'record' ? 'mp4' : 'png'
  const fileName = `Automation-${deviceId}-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.${ext}`
  return joinPath(desktop, fileName)
}

function resolveTempScreenshotPath(deviceId) {
  const tempDir = window.$preload.configs?.tempPath
    || window.$preload.configs?.desktopPath
    || ''
}

const LAUNCHER_PACKAGES = [
  'com.huawei.android.launcher',
  'com.miui.home',
  'com.android.launcher3',
  'com.sec.android.app.launcher',
  'com.oppo.launcher',
  'com.vivo.launcher',
  'com.google.android.apps.nexuslauncher',
  'unihomelauncher',
  'launcher',
]

export async function checkDeviceActivity(deviceId, adb) {
  if (!adb?.deviceShell) {
    return null
  }
  try {
    const raw = await adb.deviceShell(deviceId, 'dumpsys window | grep -E "mCurrentFocus|mFocusedApp"')
    if (raw) {
      const text = String(raw).trim()
      if (!text) {
        return null
      }

      const focusMatch = text.match(/([\w.]+\/[\w.$]+)/)
      if (focusMatch) {
        return focusMatch[1]
      }
    }
  }
  catch {}

  try {
    const raw2 = await adb.deviceShell(deviceId, 'dumpsys activity activities | grep -A1 "ResumedActivity"')
    if (raw2) {
      const match = String(raw2).match(/([\w.]+\/[\w.$]+)/)
      if (match) {
        return match[1]
      }
    }
  }
  catch {}

  return null
}

export async function getCurrentTaskId(deviceId, adb) {
  if (!adb?.deviceShell)
    return null
  try {
    const raw = await adb.deviceShell(deviceId, 'dumpsys activity activities | grep -A2 "ResumedActivity"')
    if (raw) {
      const match = String(raw).match(/taskId=(\d+)/)
      if (match)
        return match[1]
    }
  }
  catch {}
  return null
}

export async function enableTaskLock(deviceId, adb, taskId) {
  if (!adb?.deviceShell || !taskId)
    return false
  try {
    await adb.deviceShell(deviceId, `am task lock ${taskId}`)
    return true
  }
  catch {
    return false
  }
}

export async function disableTaskLock(deviceId, adb) {
  if (!adb?.deviceShell)
    return false
  try {
    await adb.deviceShell(deviceId, 'am task unlock')
    return true
  }
  catch {
    return false
  }
}

export async function recoverDeviceState({ deviceId, adb, expectedActivity, onLog, signal }) {
  onLog?.({ level: 'info', message: '🔄 检测到页面不符，正在尝试自动触发自愈复位...' })
  // Attempt 1: Send BACK key (4) to dismiss popups or sub-activities
  try {
    await adb.deviceShell(deviceId, 'input keyevent 4')
    await sleep(800, signal)
    if (expectedActivity) {
      const current = await checkDeviceActivity(deviceId, adb)
      if (current && current.includes(expectedActivity)) {
        onLog?.({ level: 'info', message: '✅ 复位成功，已退回目标页面' })
        return true
      }
    }
  }
  catch {}

  // Attempt 2: Send HOME key (3) to return to home screen cleanly
  try {
    await adb.deviceShell(deviceId, 'input keyevent 3')
    await sleep(800, signal)
    onLog?.({ level: 'info', message: '✅ 已复位返回系统桌面' })
    return true
  }
  catch {}

  return false
}

const MAIN_ACTIVITY_PATTERNS = [
  'mainactivity',
  'homeactivity',
  'indexactivity',
  'maintabactivity',
  'feedactivity',
  'splashactivity',
  'launcheractivity',
  'detailactivity',
  'videoactivity',
  'awemedetail',
  'feeds',
  'listactivity',
  'chatactivity',
  'homefragment',
  'mainfragment',
  'recommend',
  'discover',
  'explore',
  'homepage',
  'dashboard',
]

const SUB_PAGE_PATTERNS = [
  'subactivity',
  'fragmentactivity',
  'dialogactivity',
  'popupactivity',
  'commentactivity',
  'commentlistactivity',
  'postdetailactivity',
  'notedetailactivity',
  'dialog',
  'popup',
]

function isSubPageActivity(activityName = '', expectedActivity = '') {
  if (!activityName) {
    return false
  }
  if (expectedActivity && activityName.includes(expectedActivity)) {
    return false
  }

  const actLower = activityName.toLowerCase()

  const isMainPattern = MAIN_ACTIVITY_PATTERNS.some(pat => actLower.includes(pat))
  if (isMainPattern) {
    return false
  }

  return SUB_PAGE_PATTERNS.some(pat => actLower.includes(pat))
}

export async function alignAndResumeContext({ deviceId, adb, step, steps = [], startIndex = 0, targetPackageName = '', onLog, signal }) {
  onLog?.({ level: 'info', message: '🔍 启动断点恢复上下文校验与环境对齐...' })
  if (!step && !steps.length) {
    return true
  }

  let expectedActivity = step?.pageAnchor?.activity || step?.expectedActivity
  let expectedDeeplink = step?.pageAnchor?.deeplink || step?.deeplink
  let expectedPackage = step?.pageAnchor?.package || step?.package || targetPackageName

  // Inherit target package/activity context from preceding steps if step doesn't specify one
  if (!expectedPackage && !expectedActivity && !expectedDeeplink && steps.length) {
    for (let i = Math.min(startIndex, steps.length - 1); i >= 0; i--) {
      const prev = steps[i]
      if (!prev) {
        continue
      }
      if (prev.package || prev.pageAnchor?.package) {
        expectedPackage = prev.package || prev.pageAnchor?.package
      }
      if (prev.expectedActivity || prev.pageAnchor?.activity) {
        expectedActivity = prev.expectedActivity || prev.pageAnchor?.activity
      }
      if (prev.deeplink || prev.pageAnchor?.deeplink) {
        expectedDeeplink = prev.deeplink || prev.pageAnchor?.deeplink
      }
      if (expectedPackage || expectedActivity || expectedDeeplink) {
        break
      }
    }
  }

  // 0. Auto Wakeup, Unlock & Soft Keyboard Dismissal
  if (adb) {
    try {
      await adb.deviceShell(deviceId, 'input keyevent 224') // KEYCODE_WAKEUP
      await adb.deviceShell(deviceId, 'input keyevent 82') // KEYCODE_UNLOCK
      await adb.deviceShell(deviceId, 'input keyevent 111') // KEYCODE_ESCAPE (close keyboard)
      await sleep(300, signal)
    }
    catch {}
  }

  // 1. Context check: Is device currently in target Activity or Package?
  if (adb) {
    const current = await checkDeviceActivity(deviceId, adb)
    if (current) {
      // Direct match with expectedActivity
      if (expectedActivity && current.includes(expectedActivity)) {
        onLog?.({ level: 'info', message: `✅ 页面上下文一致 (${current})，即将恢复执行` })
        return true
      }

      // Inside target package, check if human intervention clicked into a sub-page/dialog!
      if (expectedPackage && current.includes(expectedPackage)) {
        const subPageDetected = isSubPageActivity(current, expectedActivity)
        if (subPageDetected) {
          onLog?.({ level: 'warning', message: `⚠️ 检测到人工干预进入了子页面/弹窗 (${current})，正在发送返回键自动归位...` })
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await adb.deviceShell(deviceId, 'input keyevent 4') // BACK KEY
              await sleep(650, signal)
              const newFocus = await checkDeviceActivity(deviceId, adb)
              if (newFocus && newFocus.includes(expectedPackage)) {
                const isStillSub = isSubPageActivity(newFocus, expectedActivity)
                if (expectedActivity ? newFocus.includes(expectedActivity) : !isStillSub) {
                  onLog?.({ level: 'info', message: `✅ 已成功自动退回主界面 (${newFocus})！` })
                  return true
                }
              }
            }
            catch {}
          }
        }
        else {
          if (expectedPackage && (expectedPackage.includes('xingin.xhs') || expectedPackage.includes('aweme'))) {
            try {
              const screenSize = await adb.getScreenSize(deviceId)
              if (screenSize) {
                const homeTabX = Math.round(screenSize.width * 0.12)
                const homeTabY = Math.round(screenSize.height * 0.96)
                onLog?.({ level: 'info', message: '📌 断点复位对齐：点击左下角 [首页] Tab 确保切回主 Feed 流...' })
                await adb.deviceShell(deviceId, `input tap ${homeTabX} ${homeTabY}`)
                await sleep(500, signal)
              }
            }
            catch {}
          }

          onLog?.({ level: 'info', message: `✅ 应用主界面上下文一致 (${current})，即将恢复执行` })
          return true
        }
      }
    }
  }

  // 2. Level 1: Deeplink Direct Jump
  if (expectedDeeplink && adb) {
    onLog?.({ level: 'info', message: `⚡ 正在尝试通过 Deeplink 直达断点页面: ${expectedDeeplink}` })
    try {
      await adb.deviceShell(deviceId, `am start -a android.intent.action.VIEW -d "${expectedDeeplink}"`)
      await sleep(1200, signal)
      const current = await checkDeviceActivity(deviceId, adb)
      if (!expectedActivity || (current && current.includes(expectedActivity))) {
        onLog?.({ level: 'info', message: '✅ Deeplink 直达成功！页面环境已对齐' })
        return true
      }
    }
    catch (e) {
      onLog?.({ level: 'warning', message: `Deeplink 直达未成功: ${e.message || e}` })
    }
  }

  // 3. Level 2: Target Activity Launch
  if (expectedActivity && expectedPackage && adb) {
    onLog?.({ level: 'info', message: `⚡ 正在尝试直接拉起目标 Activity: ${expectedPackage}/${expectedActivity}` })
    try {
      const actTarget = expectedActivity.startsWith('.') ? `${expectedPackage}${expectedActivity}` : expectedActivity
      await adb.deviceShell(deviceId, `am start -n "${expectedPackage}/${actTarget}"`)
      await sleep(1200, signal)
      const current = await checkDeviceActivity(deviceId, adb)
      if (current && current.includes(expectedActivity)) {
        onLog?.({ level: 'info', message: '✅ Target Activity 拉起成功！页面已对齐' })
        return true
      }
    }
    catch (e) {
      onLog?.({ level: 'warning', message: `Activity 拉起失败: ${e.message || e}` })
    }
  }

  // 4. Level 3: Android Task Stack Single-Top Heat-Wakeup (0-Restart, zero progress loss)
  if (expectedPackage && adb) {
    onLog?.({ level: 'info', message: `⚡ 检测到界面偏离，正在通过任务栈热唤醒切回前台 (${expectedPackage})...` })
    try {
      if (expectedActivity) {
        const actTarget = expectedActivity.startsWith('.') ? `${expectedPackage}${expectedActivity}` : expectedActivity
        await adb.deviceShell(deviceId, `am start -W --activity-single-top -n "${expectedPackage}/${actTarget}"`)
      }
      else {
        await adb.deviceShell(deviceId, `monkey -p ${expectedPackage} -c android.intent.category.LAUNCHER 1`)
      }
      await sleep(1000, signal)
      onLog?.({ level: 'info', message: '✅ 目标应用已无缝热唤醒至前台（保持原进度与登录状态）' })
      return true
    }
    catch (e) {
      onLog?.({ level: 'warning', message: `任务栈热唤醒失败: ${e.message || e}` })
    }
  }

  // 5. Level 4: Fallback recoverDeviceState (BACK / HOME)
  if (adb) {
    const recovered = await recoverDeviceState({
      deviceId,
      adb,
      expectedActivity: expectedActivity || expectedPackage,
      onLog,
      signal,
    })

    if (recovered) {
      onLog?.({ level: 'info', message: '✅ 已完成自愈复位对齐，准备恢复执行' })
      return true
    }
  }

  onLog?.({ level: 'info', message: 'ℹ️ 未检测到特定页面锚点或强约束，将在当前界面恢复执行' })
  return true
}

async function evaluateIfCondition({ step, deviceId, adb, onLog, signal }) {
  if (step.condition === 'always') {
    return true
  }
  if (step.condition === 'never') {
    return false
  }
  if (step.condition === 'imageFound') {
    if (!step.imagePath) {
      onLog?.({ level: 'warning', message: 'if.imageFound 缺少 imagePath，按 true 处理' })
      return true
    }
    const screenPath = resolveTempScreenshotPath(deviceId)
    try {
      await adb.screencap(deviceId, { savePath: screenPath })
      const result = await window.$preload.ipcRenderer.invoke('automation:findImage', {
        screenPath,
        needlePath: step.imagePath,
        threshold: Number(step.threshold ?? 0.85),
        region: step.matchRegion || null,
      })
      onLog?.({ level: 'info', message: `findImage score=${result?.score} found=${result?.found}` })
      return Boolean(result?.found)
    }
    catch (e) {
      onLog?.({ level: 'error', message: `findImage 失败: ${e.message || e}` })
      return false
    }
  }
  return true
}

async function runFindImage({ step, deviceId, adb, onLog, signal }) {
  if (!step.imagePath) {
    throw new Error('imagePath is required')
  }
  const screenPath = resolveTempScreenshotPath(deviceId)
  await adb.screencap(deviceId, { savePath: screenPath })
  return await window.$preload.ipcRenderer.invoke('automation:findImage', {
    screenPath,
    needlePath: step.imagePath,
    threshold: Number(step.threshold ?? 0.85),
    region: step.matchRegion || null,
  })
}

async function runWaitFor({ step, deviceId, adb, onLog, signal }) {
  if (!step.imagePath) {
    throw new Error('imagePath is required')
  }
  const timeout = Math.max(1000, Number(step.timeout || 10000))
  const pollInterval = Math.max(100, Number(step.pollInterval || 500))
  const threshold = Number(step.threshold ?? 0.85)
  const deadline = Date.now() + timeout
  let lastResult = null
  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('STOPPED')
    }
    lastResult = await runFindImage({ step, deviceId, adb, onLog, signal })
    if (lastResult?.found) {
      onLog?.({ level: 'info', message: `waitFor 找到目标 (score=${lastResult.score})` })
      return lastResult
    }
    await sleep(pollInterval, signal)
  }
  onLog?.({ level: 'warning', message: `waitFor 超时未找到目标 (last score=${lastResult?.score ?? 0})` })
  if (step.notFound === 'skip') {
    return lastResult
  }
  throw new Error('waitFor: 等待图片超时')
}

const MONITORED_STEP_TYPES = ['tap', 'swipe', 'input', 'wait', 'key', 'launch', 'command', 'install', 'screenshot', 'record', 'findImage', 'waitFor', 'if', 'loop', 'end']

async function executeStep(deviceId, step, adb, signal, onLog, screenSize = null) {
  switch (step.type) {
    case 'tap': {
      let x, y

      if (step.tapZone && step.tapZone.x1 != null && step.tapZone.x2 != null) {
        // Priority 1: User-defined safe zone — uniformly random within rectangle (100% in-bounds)
        const zx1 = Math.min(step.tapZone.x1, step.tapZone.x2)
        const zx2 = Math.max(step.tapZone.x1, step.tapZone.x2)
        const zy1 = Math.min(step.tapZone.y1, step.tapZone.y2)
        const zy2 = Math.max(step.tapZone.y1, step.tapZone.y2)
        x = Math.round(zx1 + Math.random() * (zx2 - zx1))
        y = Math.round(zy1 + Math.random() * (zy2 - zy1))
      }
      else {
        // Fallback: use center point (Gaussian offset already applied in run loop)
        x = Number(step.x || 0)
        y = Number(step.y || 0)
      }

      if (step.randomRange > 0) {
        // Simulate human finger press duration: 40~150ms with Gaussian variation
        const pressDuration = Math.round(Math.max(40, 80 + randomGaussian() * step.randomRange * 15))
        await adb.deviceShell(deviceId, `input swipe ${x} ${y} ${x} ${y} ${pressDuration}`)
      }
      else {
        await adb.deviceShell(deviceId, `input tap ${x} ${y}`)
      }
      break
    }
    case 'swipe': {
      const duration = Number(step.duration || 300)
      let sx = Number(step.startX || 0)
      let sy = Number(step.startY || 0)
      let ex = Number(step.endX || 0)
      let ey = Number(step.endY || 0)

      if (step.randomRange > 0) {
        // Apply a random start/end offset to mimic natural deviation
        const offset = Math.ceil(step.randomRange * 5)
        sx = clampCoord(sx + Math.round((Math.random() * 2 - 1) * offset), screenSize?.width)
        sy = clampCoord(sy + Math.round((Math.random() * 2 - 1) * offset), screenSize?.height)
        ex = clampCoord(ex + Math.round((Math.random() * 2 - 1) * offset), screenSize?.width)
        ey = clampCoord(ey + Math.round((Math.random() * 2 - 1) * offset), screenSize?.height)
      }

      await adb.deviceShell(
        deviceId,
        `input swipe ${sx} ${sy} ${ex} ${ey} ${duration}`,
      )
      break
    }
    case 'input': {
      const text = step.text || ''
      let installed = await adb.isInstalledAdbKeyboard?.(deviceId)

      if (!installed) {
        onLog?.({ level: 'info', message: 'ADB Keyboard not found. Attempting auto-install...' })
        try {
          await adb.installAdbKeyboard?.(deviceId)
          installed = await adb.isInstalledAdbKeyboard?.(deviceId)
        }
        catch (e) {
          console.warn('Failed to auto-install ADB Keyboard:', e)
        }
      }

      if (installed) {
        const setIME = await adb.deviceShell(deviceId, 'ime set com.android.adbkeyboard/.AdbIME').catch(e => String(e))
        let useKeyboard = true
        if (setIME && (setIME.includes('SecurityException') || setIME.includes('Error') || setIME.includes('permission'))) {
          onLog?.({
            level: 'warning',
            message: `设置 ADB 键盘被系统拦截 (${setIME.trim().split('\n')[0]})，将尝试使用剪贴板粘贴功能进行输入`,
          })
          useKeyboard = false
        }

        if (useKeyboard) {
          if (step.randomRange > 0 && text.length > 1) {
            for (let i = 0; i < text.length; i++) {
              if (signal?.aborted)
                break
              const char = text[i]
              const encoded = encodeUtf8Base64(char)
              await adb.deviceShell(deviceId, `am broadcast -a ADB_INPUT_B64 --es msg ${encoded}`).catch(() => {})
              const delay = Math.max(50, 120 + (Math.random() * 2 - 1) * step.randomRange * 30)
              await sleep(delay, signal)
            }
          }
          else {
            const encoded = encodeUtf8Base64(text)
            const broadcastRes = await adb.deviceShell(deviceId, `am broadcast -a ADB_INPUT_B64 --es msg ${encoded}`).catch(e => String(e))
            if (broadcastRes && !broadcastRes.includes('Broadcast completed')) {
              onLog?.({ level: 'info', message: `发送广播结果: ${broadcastRes.trim()}` })
            }
          }
          break
        }
      }

      // Clipboard fallback
      onLog?.({ level: 'info', message: '正在尝试通过剪贴板写入并粘贴...' })
      try {
        const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')
        await adb.deviceShell(deviceId, `cmd clipboard set "${escaped}"`)
        await sleep(200, signal) // Small delay to let clipboard sync
        await adb.deviceShell(deviceId, 'input keyevent 279')
      }
      catch (err) {
        onLog?.({ level: 'warning', message: `剪贴板粘贴失败: ${err.message || err}，尝试原生输入法...` })
        await adb.deviceShell(deviceId, `input text ${escapeInputText(text)}`)
      }
      break
    }
    case 'wait': {
      await sleep(Number(step.duration || 1000), signal)
      break
    }
    case 'key': {
      await adb.deviceShell(deviceId, `input keyevent ${step.key || 4}`)
      break
    }
    case 'launch': {
      const pkg = step.package || ''
      if (!pkg) {
        throw new Error('Package name is required')
      }

      if (step.forceStop) {
        await adb.deviceShell(deviceId, `am force-stop ${pkg}`)
      }

      await adb.deviceShell(deviceId, `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`)
      break
    }
    case 'command': {
      const command = step.command || ''
      if (!command) {
        throw new Error('Command is required')
      }
      await adb.deviceShell(deviceId, command)
      break
    }
    case 'install': {
      const apkPath = step.apkPath || ''
      if (!apkPath) {
        throw new Error('APK path is required')
      }

      if (step.uninstallBefore && step.package) {
        await adb.uninstall(deviceId, step.package).catch(() => {})
      }

      await adb.install(deviceId, apkPath)
      break
    }
    case 'screenshot': {
      const savePath = resolveSavePath(step, deviceId)
      await adb.screencap(deviceId, { savePath })
      break
    }
    case 'record': {
      const duration = Number(step.duration || 10)
      const remotePath = '/sdcard/automation_record.mp4'
      const savePath = resolveSavePath(step, deviceId)

      await adb.deviceShell(deviceId, `screenrecord --time-limit ${duration} ${remotePath}`)
      await adb.pull(deviceId, remotePath, { savePath: dirname(savePath) })
      await adb.deviceShell(deviceId, `rm ${remotePath}`).catch(() => {})
      break
    }
    case 'findImage': {
      return await runFindImage({ step, deviceId, adb, onLog, signal })
    }
    case 'waitFor': {
      return await runWaitFor({ step, deviceId, adb, onLog, signal })
    }
    default:
      throw new Error(`Unknown step type: ${step.type}`)
  }
}

export function createRunner() {
  const controller = {
    status: RunnerStatus.IDLE,
    paused: false,
    signal: null,
    abortController: null,
  }

  function pause() {
    controller.paused = true
    controller.status = RunnerStatus.PAUSED
  }

  function resume() {
    controller.paused = false
    controller.status = RunnerStatus.RUNNING
  }

  function stop() {
    controller.abortController?.abort()
    controller.paused = false
    controller.status = RunnerStatus.STOPPED
  }

  async function run({
    deviceId,
    steps = [],
    vars = {},
    stepIndexes = null,
    isResume = false,
    onStepStart,
    onStepEnd,
    onLog,
    onHumanIntervention,
    referenceScreenWidth = 1080,
    referenceScreenHeight = 1920,
  } = {}) {
    if (!deviceId) {
      throw new Error('NO_DEVICE')
    }

    if (!steps.length) {
      throw new Error('NO_STEPS')
    }

    const adb = window.$preload.adb
    const indexes = stepIndexes ?? steps.map((_, index) => index)

    let screenSize = null
    try {
      screenSize = await adb.getScreenSize(deviceId)
    }
    catch {}

    // Compute coordinate scale factors for cross-device resolution adaptation
    let scaleX = 1
    let scaleY = 1
    if (screenSize && referenceScreenWidth && referenceScreenHeight) {
      scaleX = screenSize.width / referenceScreenWidth
      scaleY = screenSize.height / referenceScreenHeight
      if (scaleX !== 1 || scaleY !== 1) {
        onLog?.({
          level: 'info',
          message: `📐 坐标缩放：脚本参考分辨率 ${referenceScreenWidth}×${referenceScreenHeight} → 设备实际分辨率 ${screenSize.width}×${screenSize.height} (X×${scaleX.toFixed(3)}, Y×${scaleY.toFixed(3)})`,
        })
      }
    }

    function scaleCoord(value, axis) {
      if (value == null)
        return value
      const scale = axis === 'x' ? scaleX : scaleY
      return Math.round(value * scale)
    }

    controller.abortController = new AbortController()
    controller.signal = controller.abortController.signal
    controller.paused = false
    controller.status = RunnerStatus.RUNNING

    let isAligningContext = false
    let targetPackageName = ''
    for (const s of steps) {
      if (s?.package || s?.pageAnchor?.package) {
        targetPackageName = s.package || s.pageAnchor?.package
        break
      }
    }

    let lockedTaskId = null
    let taskLockEnabled = false

    // Phase 1: Try to enable Task Lock (screen pinning) before execution
    if (adb) {
      onLog?.({ level: 'info', message: '🔒 正在启用屏幕锁定模式，防止意外切换...' })
      try {
        if (targetPackageName) {
          const taskId = await getCurrentTaskId(deviceId, adb)
          if (taskId) {
            const ok = await enableTaskLock(deviceId, adb, taskId)
            if (ok) {
              taskLockEnabled = true
              lockedTaskId = taskId
              onLog?.({ level: 'success', message: '✅ 屏幕锁定已启用，脚本执行期间将无法意外切换应用' })
            }
            else {
              onLog?.({ level: 'warning', message: '⚠️ 设备可能不支持屏幕锁定，将使用后台监控' })
            }
          }
        }
      }
      catch {
        onLog?.({ level: 'warning', message: '⚠️ 屏幕锁定启用失败，将使用后台监控' })
      }
    }

    // Phase 2: Resolve targetPackageName if not found in steps
    if (!targetPackageName && adb) {
      try {
        const current = await checkDeviceActivity(deviceId, adb)
        if (current) {
          const pkg = current.split('/')[0]
          if (pkg && !LAUNCHER_PACKAGES.some(lp => pkg.toLowerCase().includes(lp))) {
            targetPackageName = pkg
            onLog?.({ level: 'info', message: `📌 初始环境检测: 当前前台应用 ${pkg}` })
          }
        }
      }
      catch {
        onLog?.({ level: 'warning', message: '⚠️ 初始环境检测失败' })
      }
    }

    if (!targetPackageName) {
      onLog?.({ level: 'info', message: 'ℹ️ 未锁定目标包名，后台监控将检测任意Activity变化' })
    }
    else {
      onLog?.({ level: 'info', message: `📌 目标应用包名: ${targetPackageName}` })
    }

    // Phase 3: Start background activity monitor
    let lastKnownActivity = ''
    let monitorRunning = true
    let interventionDetected = false

    const startBackgroundMonitor = async () => {
      if (!adb)
        return
      onLog?.({ level: 'info', message: '🔍 后台Activity监控已启动 (每1秒检测)' })

      // eslint-disable-next-line no-unmodified-loop-condition
      while (monitorRunning && !controller.signal.aborted) {
        await sleep(1000, controller.signal)
        if (controller.signal.aborted || !monitorRunning)
          break

        try {
          const current = await checkDeviceActivity(deviceId, adb)
          if (!current)
            continue

          if (!lastKnownActivity) {
            lastKnownActivity = current
            continue
          }

          if (current !== lastKnownActivity) {
            const newPkg = current.split('/')[0]
            const oldPkg = lastKnownActivity.split('/')[0]
            const isLauncher = LAUNCHER_PACKAGES.some(p => newPkg.toLowerCase().includes(p))
            const isInputMethod = newPkg.toLowerCase().includes('inputmethod')
            const isStatusBar = newPkg.toLowerCase().includes('statusbar')

            if (!isLauncher && !isInputMethod && !isStatusBar) {
              if (newPkg !== oldPkg) {
                onLog?.({
                  level: 'warning',
                  message: `🖐️ 后台监控检测到Activity变化: ${lastKnownActivity} → ${current}`,
                })
                interventionDetected = true
                pause()
                onHumanIntervention?.({ deviceId, currentActivity: current })
                lastKnownActivity = current
                break
              }
            }
          }
          lastKnownActivity = current
        }
        catch {}
      }
    }

    const monitorPromise = startBackgroundMonitor()

    const stopMonitor = () => {
      monitorRunning = false
    }

    // Phase 4: Release Task Lock when done
    const releaseTaskLock = async () => {
      if (taskLockEnabled) {
        try {
          await disableTaskLock(deviceId, adb)
          onLog?.({ level: 'info', message: '🔓 屏幕锁定已解除' })
        }
        catch {}
        taskLockEnabled = false
      }
    }

    try {
      // Control-flow walker: steps is a flat list but `if` / `loop` open a block
      // that is closed by the next matching `end` (handling nesting). The walker
      // maintains a stack of frames; when a frame is closed (matched `end`,
      // iteration cap reached, or condition becomes false) the walker pops it
      // and either restarts (loop) or advances to the next index.
      const totalSteps = steps.length
      const frameStack = [] // each frame: { start, end, iter, maxIter, type, skipBody, negated }
      const varsMap = buildVariableMap(vars, { deviceId })
      const frameEndSet = new Set()

      // Pre-compute matching `end` index for every `if` / `loop` to avoid
      // scanning the whole array on every iteration.
      const matchingEnd = Array.from({ length: totalSteps }).fill(-1)
      const stack = []
      for (let i = 0; i < totalSteps; i++) {
        const t = steps[i]?.type
        if (t === 'if' || t === 'loop') {
          stack.push(i)
        }
        else if (t === 'end') {
          if (stack.length) {
            const open = stack.pop()
            matchingEnd[open] = i
            matchingEnd[i] = open
            frameEndSet.add(open)
            frameEndSet.add(i)
          }
        }
      }
      // Mark any orphan opener/closer to be skipped
      const skipIndex = new Set()
      for (let i = 0; i < totalSteps; i++) {
        const t = steps[i]?.type
        if (t === 'if' || t === 'loop') {
          if (matchingEnd[i] === -1) {
            skipIndex.add(i)
          }
        }
        else if (t === 'end') {
          if (matchingEnd[i] === -1) {
            skipIndex.add(i)
          }
        }
      }

      let index = indexes[0] ?? 0

      if (isResume && steps[index]) {
        isAligningContext = true
        try {
          await alignAndResumeContext({
            deviceId,
            adb,
            step: steps[index],
            steps,
            startIndex: index,
            targetPackageName,
            onLog,
            signal: controller.signal,
          })
        }
        finally {
          isAligningContext = false
        }
      }

      let loopGuard = 0
      const maxIterations = totalSteps * 50

      while (index < totalSteps) {
        loopGuard++
        if (loopGuard > maxIterations) {
          throw new Error('LOOP_LIMIT_EXCEEDED')
        }
        if (controller.signal?.aborted) {
          throw new Error('STOPPED')
        }

        if (stepIndexes && !frameStack.length && !stepIndexes.includes(index)) {
          const next = stepIndexes.find(i => i > index)
          if (next == null) {
            break
          }
          index = next
          continue
        }

        const rawStep = steps[index]
        await waitWhilePaused(controller)

        // 🛡️ Fast-path pre-step check (complements the background monitor)
        if (adb && !isAligningContext && MONITORED_STEP_TYPES.includes(rawStep?.type)) {
          try {
            const current = await checkDeviceActivity(deviceId, adb)
            if (current && lastKnownActivity && current !== lastKnownActivity) {
              const newPkg = current.split('/')[0]
              const oldPkg = lastKnownActivity.split('/')[0]
              const isLauncher = LAUNCHER_PACKAGES.some(p => newPkg.toLowerCase().includes(p))
              const isInputMethod = newPkg.toLowerCase().includes('inputmethod')
              const isStatusBar = newPkg.toLowerCase().includes('statusbar')

              if (!isLauncher && !isInputMethod && !isStatusBar && newPkg !== oldPkg) {
                onLog?.({
                  level: 'warning',
                  message: `🖐️ 快速检测到Activity变化: ${lastKnownActivity} → ${current}`,
                })
                interventionDetected = true
                pause()
                onHumanIntervention?.({ deviceId, currentActivity: current })
                await waitWhilePaused(controller)
              }
            }
          }
          catch {}
        }

        // Skip orphan control-flow nodes silently
        if (skipIndex.has(index)) {
          index += 1
          continue
        }

        // Honour skipBody pushed by a previous `if` evaluating to false
        if (frameStack.length && frameStack[frameStack.length - 1].skipBody) {
          // Jump to matching end of innermost frame
          const top = frameStack[frameStack.length - 1]
          if (top.type === 'if' || top.type === 'loop') {
            const endIdx = matchingEnd[top.start]
            if (endIdx === -1 || endIdx <= index) {
              index += 1
            }
            else {
              index = endIdx + 1
            }
            // pop the frame we just closed
            frameStack.pop()
            continue
          }
        }

        const step = interpolateStep(rawStep, varsMap)
        const loopCount = Math.max(1, Number(step.loopCount || 1))

        onStepStart?.({ stepIndex: index, step })

        // Handle control-flow openers/closers directly without invoking executeStep
        if (step.type === 'if') {
          const cond = await evaluateIfCondition({ step, deviceId, adb, onLog, signal: controller.signal })
          const effective = step.negate ? !cond : cond
          onLog?.({ level: 'info', message: `[${index + 1}] if(${step.condition || 'always'}) => ${effective ? 'true' : 'false'}` })
          frameStack.push({
            type: 'if',
            start: index,
            iter: 1,
            maxIter: 1,
            skipBody: !effective,
          })
          index += 1
          continue
        }

        if (step.type === 'loop') {
          const maxIter = Math.max(1, Number(step.iterations || 1))
          frameStack.push({
            type: 'loop',
            start: index,
            iter: 0,
            maxIter,
            skipBody: false,
            breakOnFail: !!step.breakOnFail,
            failed: false,
          })
          index += 1
          continue
        }

        if (step.type === 'end') {
          // Close innermost open frame
          const top = frameStack.pop()
          if (!top) {
            index += 1
            continue
          }
          if (top.type === 'loop') {
            top.iter += 1
            if (top.iter < top.maxIter && (!top.breakOnFail || !top.failed)) {
              // restart the loop body
              frameStack.push(top)
              index = top.start + 1
            }
            else {
              index = matchingEnd[top.start] + 1
            }
          }
          else {
            index = matchingEnd[top.start] + 1
          }
          continue
        }

        for (let loop = 0; loop < loopCount; loop++) {
          await waitWhilePaused(controller)

          // Check loop frame `breakOnFail` / `failed` propagation
          if (frameStack.length) {
            const top = frameStack[frameStack.length - 1]
            if (top.breakOnFail && top.failed) {
              break
            }
          }

          const loopStep = { ...step }

          // Perform cross-device resolution coordinate mapping
          if (screenSize) {
            const targetW = screenSize.width
            const targetH = screenSize.height
            const hasPercentCoords = loopStep.xPercent != null || loopStep.yPercent != null
              || loopStep.startXPercent != null || loopStep.startYPercent != null
              || loopStep.endXPercent != null || loopStep.endYPercent != null

            if (hasPercentCoords) {
              // Priority 1: Percentage-based mapping (recorded with explicit percent fields)
              if (loopStep.xPercent != null) {
                loopStep.x = Math.round(loopStep.xPercent * targetW)
              }
              if (loopStep.yPercent != null) {
                loopStep.y = Math.round(loopStep.yPercent * targetH)
              }
              if (loopStep.startXPercent != null) {
                loopStep.startX = Math.round(loopStep.startXPercent * targetW)
              }
              if (loopStep.startYPercent != null) {
                loopStep.startY = Math.round(loopStep.startYPercent * targetH)
              }
              if (loopStep.endXPercent != null) {
                loopStep.endX = Math.round(loopStep.endXPercent * targetW)
              }
              if (loopStep.endYPercent != null) {
                loopStep.endY = Math.round(loopStep.endYPercent * targetH)
              }
            }
            else if (scaleX !== 1 || scaleY !== 1) {
              // Priority 2: Scale absolute coordinates from reference resolution to target resolution
              if (loopStep.x != null) {
                loopStep.x = scaleCoord(loopStep.x, 'x')
              }
              if (loopStep.y != null) {
                loopStep.y = scaleCoord(loopStep.y, 'y')
              }
              if (loopStep.startX != null) {
                loopStep.startX = scaleCoord(loopStep.startX, 'x')
              }
              if (loopStep.startY != null) {
                loopStep.startY = scaleCoord(loopStep.startY, 'y')
              }
              if (loopStep.endX != null) {
                loopStep.endX = scaleCoord(loopStep.endX, 'x')
              }
              if (loopStep.endY != null) {
                loopStep.endY = scaleCoord(loopStep.endY, 'y')
              }
              // Also scale tapZone coordinates if present
              if (loopStep.tapZone) {
                if (loopStep.tapZone.x1 != null)
                  loopStep.tapZone.x1 = scaleCoord(loopStep.tapZone.x1, 'x')
                if (loopStep.tapZone.y1 != null)
                  loopStep.tapZone.y1 = scaleCoord(loopStep.tapZone.y1, 'y')
                if (loopStep.tapZone.x2 != null)
                  loopStep.tapZone.x2 = scaleCoord(loopStep.tapZone.x2, 'x')
                if (loopStep.tapZone.y2 != null)
                  loopStep.tapZone.y2 = scaleCoord(loopStep.tapZone.y2, 'y')
              }
            }
          }

          if (loopStep.randomRange) {
            // 3σ of applyRandomOffset Gaussian = range * 5 * 3 * 0.5 = range * 7.5px
            // Pre-shrink to a safe zone so offsets can never push coords out of bounds (Layer 1)
            const maxCoordDelta = Math.ceil(loopStep.randomRange * 7.5)

            if (loopStep.delayBefore) {
              loopStep.delayBefore = Math.max(0, applyRandomOffset(loopStep.delayBefore, loopStep.randomRange, 'time'))
            }
            if (loopStep.type === 'tap') {
              // Skip Gaussian coord offset when tapZone is defined (tapZone handles randomization in executeStep)
              if (!loopStep.tapZone) {
                // Layer 1: Pre-clamp base coord into safe zone before applying offset
                if (screenSize) {
                  loopStep.x = clampCoord(loopStep.x, screenSize.width, maxCoordDelta)
                  loopStep.y = clampCoord(loopStep.y, screenSize.height, maxCoordDelta)
                }
                loopStep.x = applyRandomOffset(loopStep.x, loopStep.randomRange, 'coord')
                loopStep.y = applyRandomOffset(loopStep.y, loopStep.randomRange, 'coord')
                // Layer 2: Post-clamp hard limit to catch any statistical outliers
                if (screenSize) {
                  loopStep.x = clampCoord(loopStep.x, screenSize.width)
                  loopStep.y = clampCoord(loopStep.y, screenSize.height)
                }
              }
            }
            else if (loopStep.type === 'swipe') {
              // Layer 1: Pre-clamp all four swipe coords into safe zone
              if (screenSize) {
                loopStep.startX = clampCoord(loopStep.startX, screenSize.width, maxCoordDelta)
                loopStep.startY = clampCoord(loopStep.startY, screenSize.height, maxCoordDelta)
                loopStep.endX = clampCoord(loopStep.endX, screenSize.width, maxCoordDelta)
                loopStep.endY = clampCoord(loopStep.endY, screenSize.height, maxCoordDelta)
              }
              loopStep.startX = applyRandomOffset(loopStep.startX, loopStep.randomRange, 'coord')
              loopStep.startY = applyRandomOffset(loopStep.startY, loopStep.randomRange, 'coord')
              loopStep.endX = applyRandomOffset(loopStep.endX, loopStep.randomRange, 'coord')
              loopStep.endY = applyRandomOffset(loopStep.endY, loopStep.randomRange, 'coord')
              loopStep.duration = applyRandomOffset(loopStep.duration, loopStep.randomRange, 'time')
              // Layer 2: Post-clamp hard limit
              if (screenSize) {
                loopStep.startX = clampCoord(loopStep.startX, screenSize.width)
                loopStep.startY = clampCoord(loopStep.startY, screenSize.height)
                loopStep.endX = clampCoord(loopStep.endX, screenSize.width)
                loopStep.endY = clampCoord(loopStep.endY, screenSize.height)
              }
            }
            else if (loopStep.type === 'wait') {
              loopStep.duration = applyRandomOffset(loopStep.duration, loopStep.randomRange, 'time')
            }
          }

          if (loopStep.resetHomeBefore) {
            onLog?.({ level: 'info', message: '🏠 前置发送 HOME 键重置桌面状态' })
            try {
              await adb.deviceShell(deviceId, 'input keyevent 3')
              await sleep(800, controller.signal)
            }
            catch {}
          }

          if (loopStep.expectedActivity) {
            const currentAct = await checkDeviceActivity(deviceId, adb)
            if (currentAct && !currentAct.includes(loopStep.expectedActivity)) {
              onLog?.({ level: 'warning', message: `⚠️ 页面不匹配 (当前: ${currentAct}, 预期包含: ${loopStep.expectedActivity})` })
              const recovered = await recoverDeviceState({
                deviceId,
                adb,
                expectedActivity: loopStep.expectedActivity,
                onLog,
                signal: controller.signal,
              })
              if (!recovered) {
                onLog?.({ level: 'error', message: '⛔ 单机触发熔断断路保护：复位依然脱节，已安全停止当前设备任务。' })
                throw new Error(`[STATE_MISMATCH_BREAKER] 页面不匹配且复位失败 (${currentAct})`)
              }
            }
          }

          const delayBefore = Number(loopStep.delayBefore || 0)
          if (delayBefore > 0) {
            await sleep(delayBefore, controller.signal)
          }

          onLog?.({
            level: 'info',
            message: `[${index + 1}] ${loopStep.name || loopStep.type}${loopCount > 1 ? ` (${loop + 1}/${loopCount})` : ''}`,
          })

          let stepTimeout = Number(loopStep.timeout || 15000)
          if (loopStep.type === 'wait') {
            const waitMs = Number(loopStep.duration || 1000)
            stepTimeout = Math.max(stepTimeout, waitMs + 5000)
          }

          try {
            const stepResult = await withTimeout(
              executeStep(deviceId, loopStep, adb, controller.signal, onLog, screenSize),
              stepTimeout,
              controller.signal,
              `步骤 [${loopStep.name || loopStep.type}] 执行超时 (${stepTimeout / 1000}s)`,
            )
            onStepEnd?.({ stepIndex: index, step: loopStep, success: true })

            if (stepResult && (loopStep.type === 'findImage' || loopStep.type === 'waitFor')) {
              const saveAs = loopStep.saveAs || 'x,y'
              const parts = saveAs.split(',').map(p => p.trim()).filter(Boolean)
              if (parts.length >= 2) {
                const [xVar, yVar] = parts
                varsMap[xVar] = String(stepResult.x ?? '')
                varsMap[yVar] = String(stepResult.y ?? '')
                onLog?.({ level: 'info', message: `保存坐标到变量: ${xVar}=${varsMap[xVar]}, ${yVar}=${varsMap[yVar]}` })
              }
              else if (parts.length === 1) {
                const [posVar] = parts
                varsMap[posVar] = `${stepResult.x ?? ''},${stepResult.y ?? ''}`
                onLog?.({ level: 'info', message: `保存坐标到变量: ${posVar}=${varsMap[posVar]}` })
              }
            }
          }
          catch (stepErr) {
            if (loopStep.continueOnError || loopStep.ignoreError) {
              onLog?.({
                level: 'warning',
                message: `⚠️ 步骤 [${loopStep.name || loopStep.type}] 报错已安全忽略 (continueOnError): ${stepErr.message || stepErr}`,
              })
              onStepEnd?.({ stepIndex: index, step: loopStep, success: false, ignored: true })
              continue
            }
            // Find the nearest loop frame in frameStack
            let loopFrameIdx = -1
            for (let i = frameStack.length - 1; i >= 0; i--) {
              if (frameStack[i].type === 'loop') {
                loopFrameIdx = i
                break
              }
            }

            if (loopFrameIdx !== -1 && frameStack[loopFrameIdx].breakOnFail) {
              const loopFrame = frameStack[loopFrameIdx]
              onLog?.({
                level: 'warning',
                message: `步骤 [${loopStep.name || loopStep.type}] 执行失败: ${stepErr.message || stepErr}。触发 breakOnFail，退出循环。`,
              })
              // Pop all frames from loopFrameIdx to the top of the stack
              frameStack.splice(loopFrameIdx)
              index = matchingEnd[loopFrame.start]
              break
            }
            else {
              if (frameStack.length) {
                const top = frameStack[frameStack.length - 1]
                top.failed = true
              }
              throw stepErr
            }
          }
        }

        // Plan 3: Random breathing pause between steps (15% chance when randomRange > 0)
        if (step.randomRange > 0 && Math.random() < 0.15) {
          const breathMs = Math.round(3000 + Math.random() * 5000)
          onLog?.({ level: 'info', message: `💤 模拟用户分神暂停 ${(breathMs / 1000).toFixed(1)}s...` })
          await sleep(breathMs, controller.signal)
        }

        index += 1
      }

      controller.status = RunnerStatus.IDLE
      return { success: true }
    }
    catch (error) {
      if (error?.message === 'STOPPED') {
        controller.status = RunnerStatus.STOPPED
        return { success: false, stopped: true }
      }

      controller.status = RunnerStatus.IDLE
      onLog?.({ level: 'error', message: error?.message || String(error) })
      throw error
    }
    finally {
      stopMonitor()
      try {
        await monitorPromise
      }
      catch {}
      await releaseTaskLock()
    }
  }

  return {
    controller,
    run,
    pause,
    resume,
    stop,
  }
}

export async function runAutomationOnDevices({
  devices = [],
  steps = [],
  vars = {},
  onDeviceLog,
} = {}) {
  return runAutomationMatrix({ devices, rows: [vars], steps, onDeviceLog })
}

/**
 * Run an automation script across a devices × variable-rows matrix in true parallel.
 * Concurrency is capped via `common.concurrencyLimit` (default 3) to avoid swamping ADB.
 * Returns a flat list of results for every (device, row) pair.
 */
export async function runAutomationMatrix({
  devices = [],
  rows = [{}],
  steps,
  script,
  baseVars = {},
  onDeviceLog,
  onTaskStart,
  onTaskEnd,
  concurrencyLimit,
  referenceScreenWidth = 1080,
  referenceScreenHeight = 1920,
} = {}) {
  const finalSteps = steps || script?.steps || []
  const deviceList = (devices || []).map(item => (typeof item === 'string' ? { id: item } : item)).filter(Boolean)
  const rowList = rows?.length ? rows : [{}]
  const limit = Math.max(1, Number(
    concurrencyLimit
    ?? Number(window.$preload?.store?.get?.('common.concurrencyLimit'))
    ?? 3,
  ))

  const total = deviceList.length * rowList.length
  let done = 0

  const tasks = []
  for (const device of deviceList) {
    for (let r = 0; r < rowList.length; r++) {
      const rowVars = rowList[r] || {}
      const deviceId = device.id
      const label = rowList.length > 1
        ? `${deviceId} #${r + 1}`
        : deviceId

      tasks.push(async () => {
        const runner = createRunner()
        onTaskStart?.({ deviceId, rowIndex: r, total })
        try {
          await runner.run({
            deviceId,
            steps: finalSteps,
            vars: { ...baseVars, ...rowVars },
            referenceScreenWidth,
            referenceScreenHeight,
            onLog: entry => onDeviceLog?.(deviceId, entry),
            onHumanIntervention: async ({ currentActivity }) => {
              onDeviceLog?.(deviceId, {
                level: 'warning',
                message: `🖐️ 捕获到物理界面变动 (${currentActivity})，3 秒后自动环境复位归位...`,
              })
              await sleep(3000)
              await alignAndResumeContext({
                deviceId,
                adb: window.$preload.adb,
                steps: finalSteps,
                onLog: entry => onDeviceLog?.(deviceId, entry),
              })
              runner.resume()
            },
          })
          done += 1
          const result = { deviceId, rowIndex: r, label, success: true }
          onTaskEnd?.(result)
          return result
        }
        catch (error) {
          done += 1
          const result = { deviceId, rowIndex: r, label, success: false, error: error?.message || String(error) }
          onTaskEnd?.(result)
          return result
        }
      })
    }
  }

  const results = Array.from({ length: tasks.length }).fill(null)
  const queue = tasks.map((task, idx) => ({ task, idx }))
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item)
        break
      results[item.idx] = await item.task()
    }
  })
  await Promise.all(workers)

  return { total, results }
}

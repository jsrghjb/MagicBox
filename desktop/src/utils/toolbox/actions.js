const adb = () => window.$preload.adb

const VENDOR_IMES = [
  'com.baidu.input_huawei',
  'com.sohu.inputmethod.sogou.huawei',
  'com.sohu.inputmethod.sogou',
  'com.sogou.inputmethod',
  'com.baidu.input_oppo',
  'com.baidu.input_vivo',
  'com.baidu.input_mi',
  'com.sohu.inputmethod.sogou.xiaomi',
  'com.iflytek.inputmethod',
  'com.iflytek.inputmethod.huawei',
  'com.huawei.ohos.inputmethod',
]

const ADB_KEYBOARD = 'com.android.adbkeyboard/.AdbIME'
const ADB_KEYBOARD_PKG = 'com.android.adbkeyboard'

const VENDOR_IME_LABELS = {
  'com.baidu.input_huawei': '华为百度输入法',
  'com.sohu.inputmethod.sogou.huawei': '华为搜狗输入法',
  'com.sohu.inputmethod.sogou': '搜狗输入法',
  'com.sogou.inputmethod': '搜狗输入法',
  'com.baidu.input_oppo': 'OPPO 百度输入法',
  'com.baidu.input_vivo': 'vivo 百度输入法',
  'com.baidu.input_mi': '小米百度输入法',
  'com.sohu.inputmethod.sogou.xiaomi': '小米搜狗输入法',
  'com.iflytek.inputmethod': '讯飞输入法',
  'com.iflytek.inputmethod.huawei': '华为讯飞输入法',
  'com.huawei.ohos.inputmethod': '华为输入法',
}

const CAPABILITIES = [
  { id: 'manageStorage', label: '全部文件访问（MANAGE_EXTERNAL_STORAGE）', minSdk: 30, minAndroid: '11' },
  { id: 'bgLocation', label: '后台定位', minSdk: 29, minAndroid: '10' },
  { id: 'bluetoothRuntime', label: '蓝牙运行时权限', minSdk: 31, minAndroid: '12' },
  { id: 'postNotifications', label: '通知运行时权限', minSdk: 33, minAndroid: '13' },
  { id: 'readMedia', label: '照片/视频/音频媒体权限', minSdk: 33, minAndroid: '13' },
]

const DANGEROUS_PERMISSIONS = [
  { name: 'android.permission.CAMERA', minSdk: 23 },
  { name: 'android.permission.RECORD_AUDIO', minSdk: 23 },
  { name: 'android.permission.ACCESS_FINE_LOCATION', minSdk: 23 },
  { name: 'android.permission.ACCESS_COARSE_LOCATION', minSdk: 23 },
  { name: 'android.permission.ACCESS_BACKGROUND_LOCATION', minSdk: 29 },
  { name: 'android.permission.READ_PHONE_STATE', minSdk: 23 },
  { name: 'android.permission.CALL_PHONE', minSdk: 23 },
  { name: 'android.permission.READ_CONTACTS', minSdk: 23 },
  { name: 'android.permission.WRITE_CONTACTS', minSdk: 23 },
  { name: 'android.permission.GET_ACCOUNTS', minSdk: 23 },
  { name: 'android.permission.READ_CALENDAR', minSdk: 23 },
  { name: 'android.permission.WRITE_CALENDAR', minSdk: 23 },
  { name: 'android.permission.READ_SMS', minSdk: 23 },
  { name: 'android.permission.SEND_SMS', minSdk: 23 },
  { name: 'android.permission.RECEIVE_SMS', minSdk: 23 },
  { name: 'android.permission.READ_EXTERNAL_STORAGE', minSdk: 23 },
  { name: 'android.permission.WRITE_EXTERNAL_STORAGE', minSdk: 23 },
  { name: 'android.permission.BODY_SENSORS', minSdk: 23 },
  { name: 'android.permission.ACTIVITY_RECOGNITION', minSdk: 29 },
  { name: 'android.permission.BLUETOOTH_CONNECT', minSdk: 31 },
  { name: 'android.permission.BLUETOOTH_SCAN', minSdk: 31 },
  { name: 'android.permission.BLUETOOTH_ADVERTISE', minSdk: 31 },
  { name: 'android.permission.POST_NOTIFICATIONS', minSdk: 33 },
  { name: 'android.permission.READ_MEDIA_IMAGES', minSdk: 33 },
  { name: 'android.permission.READ_MEDIA_VIDEO', minSdk: 33 },
  { name: 'android.permission.READ_MEDIA_AUDIO', minSdk: 33 },
  { name: 'android.permission.NEARBY_WIFI_DEVICES', minSdk: 33 },
]

const APPOPS = [
  { name: 'SYSTEM_ALERT_WINDOW', minSdk: 23 },
  { name: 'GET_USAGE_STATS', minSdk: 21 },
  { name: 'WRITE_SETTINGS', minSdk: 23 },
  { name: 'REQUEST_INSTALL_PACKAGES', minSdk: 26 },
  { name: 'RUN_IN_BACKGROUND', minSdk: 26 },
  { name: 'RUN_ANY_IN_BACKGROUND', minSdk: 26 },
  { name: 'MANAGE_EXTERNAL_STORAGE', minSdk: 30 },
]

const TARGET_KEYWORDS = /同意并继续|同意并使用|始终允许|仅使用期间允许|仅在使用该应用时允许|仅在使用中允许|使用时允许|允许本次|允许这台|允许访问|允许安装|继续安装|仍要安装|我知道了|知道了|我同意|同意授权|始终同意|立即开始|继续|下一步|跳过|确定|允许|忽略|以后再说|传输文件|传输照片|文件传输|关闭纯净模式|关闭限制|取消限制|Allow|ALLOW|While using|Only this time|Continue|Next|Skip|Got it|OK|permission_allow_button|btn_allow/
const NEGATIVE_KEYWORDS = /不同意|拒绝|取消|退出|不允许|Don't allow|Deny|Cancel|Reject/

async function shell(deviceId, command) {
  const out = await adb().deviceShell(deviceId, command)
  return String(out ?? '').replace(/\r/g, '').trim()
}

async function tryShell(deviceId, command) {
  try {
    return await shell(deviceId, command)
  }
  catch {
    return ''
  }
}

function parseBatteryLevel(dump) {
  const match = String(dump || '').match(/level:\s*(\d+)/)
  return match ? `${match[1]}%` : '-'
}

function parseStorageLine(dump) {
  const line = String(dump || '')
    .split('\n')
    .map(item => item.trim())
    .find(item => item.includes('/data') || /^\S+\s+\d/.test(item))
  return line || '-'
}

function parseStorageFree(dump) {
  const line = String(dump || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
    .find(item => item.includes('/data'))
  if (!line) {
    return ''
  }

  const parts = line.split(/\s+/)
  const avail = Number(parts[3])
  if (!Number.isFinite(avail) || avail <= 0) {
    return ''
  }
  if (avail >= 1024 * 1024) {
    return `${(avail / 1024 / 1024).toFixed(1)} GB 可用`
  }
  if (avail >= 1024) {
    return `${Math.round(avail / 1024)} MB 可用`
  }
  return `${avail} KB 可用`
}

function parseBatteryVitals(dump) {
  const text = String(dump || '')
  const level = text.match(/level:\s*(\d+)/)?.[1]
  const charging = /powered:\s*true|status:\s*(2|5)|status:\s*charging/i.test(text)
  return {
    text: level ? `${level}%${charging ? ' 充电中' : ''}` : '-',
    charging,
    low: Number(level) > 0 && Number(level) < 15 && !charging,
  }
}

function packageList(raw) {
  return String(raw || '')
    .split('\n')
    .map(line => line.replace(/^package:/, '').trim())
    .filter(Boolean)
}

function isIdleWhitelisted(whitelist, pkg) {
  const text = String(whitelist || '')
  return text.includes(`+${pkg}`) || text.includes(`,${pkg}`)
}

function shortIme(ime) {
  const value = String(ime || '').trim()
  if (!value || value === 'null') {
    return '未设置'
  }
  if (value.includes('adbkeyboard')) {
    return 'ADB Keyboard'
  }
  const pkg = value.split('/')[0]
  return VENDOR_IME_LABELS[pkg] || pkg.replace(/^.*\./, '')
}

export async function getDeviceProfile(deviceId) {
  const [sdk, release, model, manufacturer, emui, serial] = await Promise.all([
    tryShell(deviceId, 'getprop ro.build.version.sdk'),
    tryShell(deviceId, 'getprop ro.build.version.release'),
    tryShell(deviceId, 'getprop ro.product.model'),
    tryShell(deviceId, 'getprop ro.product.manufacturer'),
    tryShell(deviceId, 'getprop ro.build.version.emui'),
    tryShell(deviceId, 'getprop ro.serialno'),
  ])

  return {
    sdk: Number.parseInt(sdk, 10) || 0,
    release: release || '-',
    model: model || deviceId,
    manufacturer: manufacturer || '',
    emui: emui || '',
    serial: serial || deviceId,
  }
}

function describeDevice(profile) {
  return `${profile.manufacturer || ''} ${profile.model} · Android ${profile.release}（API ${profile.sdk}）`.trim()
}

function isHuaweiLike(profile) {
  const text = `${profile.manufacturer} ${profile.emui}`.toLowerCase()
  return /huawei|honor|emui|harmony/.test(text)
}

function capabilityGap(cap, profile) {
  if (profile.sdk >= cap.minSdk) {
    return ''
  }
  return `${cap.label} 需要 Android ${cap.minAndroid}+（API ${cap.minSdk}+），当前是 ${describeDevice(profile)}，该机型做不到`
}

function listCapabilityGaps(profile) {
  const gaps = CAPABILITIES
    .map(cap => capabilityGap(cap, profile))
    .filter(Boolean)

  if (profile.sdk >= 26) {
    gaps.push('Android 8+ 未知来源改为按应用授权，全局开关可能无效；从电脑 ADB 安装仍可用')
  }

  if (isHuaweiLike(profile)) {
    gaps.push('华为/荣耀 EMUI 的自启动、关联启动、后台弹出界面无法通过 ADB 完整放开，可用弹窗消杀辅助点掉')
  }

  return gaps
}

export async function inspectDevice(deviceId) {
  const profile = await getDeviceProfile(deviceId)
  const [ime, size, density, proxy, batteryDump, storage, stayOn] = await Promise.all([
    tryShell(deviceId, 'settings get secure default_input_method'),
    tryShell(deviceId, 'wm size'),
    tryShell(deviceId, 'wm density'),
    tryShell(deviceId, 'settings get global http_proxy'),
    tryShell(deviceId, 'dumpsys battery'),
    tryShell(deviceId, 'df /data'),
    tryShell(deviceId, 'settings get global stay_on_while_plugged_in'),
  ])

  let batteryText = parseBatteryLevel(batteryDump)
  try {
    const battery = await adb().battery(deviceId)
    const percent = battery?.computed?.batteryPercentage
    if (percent != null) {
      batteryText = `${percent}%`
    }
  }
  catch {
    // keep dumpsys fallback
  }

  const lines = [
    `厂商 ${profile.manufacturer || '-'} / 型号 ${profile.model}`,
    `Android ${profile.release} (SDK ${profile.sdk})  序列号 ${profile.serial}`,
    `电量 ${batteryText}  存储 ${parseStorageLine(storage)}`,
    `输入法 ${ime || '-'}`,
    `${size || 'wm size -'}  /  ${density || 'wm density -'}`,
    `代理 ${proxy && proxy !== 'null' ? proxy : '未设置'}  充电常亮 ${stayOn || '0'}`,
  ]

  return {
    profile,
    report: lines.join('\n'),
    summary: `${profile.manufacturer} ${profile.model} · Android ${profile.release} · ${batteryText}`,
  }
}

export async function skipSetupWizard(deviceId, enabled = true) {
  const value = enabled ? '1' : '0'
  await tryShell(deviceId, `settings put secure user_setup_complete ${value}`)
  await tryShell(deviceId, `settings put global device_provisioned ${value}`)
}

export async function setAnimations(deviceId, enabled) {
  const value = enabled ? '1' : '0'
  await tryShell(deviceId, `settings put global window_animation_scale ${value}`)
  await tryShell(deviceId, `settings put global transition_animation_scale ${value}`)
  await tryShell(deviceId, `settings put global animator_duration_scale ${value}`)
}

export async function setUnknownSources(deviceId, enabled) {
  if (enabled) {
    await tryShell(deviceId, 'settings put global package_verifier_enable 0')
    await tryShell(deviceId, 'settings put secure install_non_market_apps 1')
    await tryShell(deviceId, 'settings put secure package_verifier_user_consent -1')
    return
  }

  await tryShell(deviceId, 'settings put global package_verifier_enable 1')
  await tryShell(deviceId, 'settings put secure install_non_market_apps 0')
}

export async function setPlayProtect(deviceId, enabled) {
  const value = enabled ? '1' : '0'
  await tryShell(deviceId, `settings put global package_verifier_enable ${value}`)
  await tryShell(deviceId, `settings put global verifier_verify_adb_installs ${value}`)
}

export async function setResolution(deviceId, { width, height, reset = false } = {}) {
  if (reset || !width || !height) {
    await tryShell(deviceId, 'wm size reset')
    return
  }

  await tryShell(deviceId, `wm size ${Number(width)}x${Number(height)}`)
}

export async function wakeUnlock(deviceId) {
  await tryShell(deviceId, 'input keyevent KEYCODE_WAKEUP')
  await tryShell(deviceId, 'wm dismiss-keyguard')
  await tryShell(deviceId, 'input keyevent 82')
}

export async function sleepDevice(deviceId) {
  await tryShell(deviceId, 'input keyevent KEYCODE_SLEEP')
}

export async function rebootDevice(deviceId) {
  await tryShell(deviceId, 'reboot')
}

export async function installAdbKeyboardApk(deviceId, onStep) {
  onStep?.('安装 ADB Keyboard')
  if (typeof adb().installAdbKeyboard !== 'function') {
    throw new Error('当前版本不支持安装 ADB Keyboard')
  }

  await adb().installAdbKeyboard(deviceId)
  const listed = await tryShell(deviceId, 'pm list packages com.android.adbkeyboard')
  if (!listed.includes('com.android.adbkeyboard')) {
    throw new Error('ADB Keyboard 安装失败')
  }
  onStep?.('APK 已安装')
}

export async function enableAdbKeyboard(deviceId, onStep) {
  const listed = await tryShell(deviceId, 'pm list packages com.android.adbkeyboard')
  if (!listed.includes('com.android.adbkeyboard')) {
    onStep?.('未检测到 ADB Keyboard，先安装')
    await installAdbKeyboardApk(deviceId, onStep)
  }

  onStep?.('启用并切换为默认输入法')
  await tryShell(deviceId, `ime enable ${ADB_KEYBOARD}`)
  await tryShell(deviceId, `ime set ${ADB_KEYBOARD}`)
  await tryShell(deviceId, `settings put secure default_input_method ${ADB_KEYBOARD}`)
}

export async function setupAdbKeyboard(deviceId, onStep) {
  await installAdbKeyboardApk(deviceId, onStep)
  await enableAdbKeyboard(deviceId, onStep)
}

export async function getCurrentIme(deviceId) {
  return tryShell(deviceId, 'settings get secure default_input_method')
}

export async function restoreSystemIme(deviceId, savedIme = '') {
  const listed = await tryShell(deviceId, 'ime list -s')
  const imes = listed.split('\n').map(item => item.trim()).filter(Boolean)
  const candidate = [savedIme, ...imes].find(ime => ime && !ime.includes('adbkeyboard'))

  if (!candidate) {
    return false
  }

  await tryShell(deviceId, `ime enable ${candidate}`)
  await tryShell(deviceId, `ime set ${candidate}`)
  await tryShell(deviceId, `settings put secure default_input_method ${candidate}`)
  return candidate
}

export async function freezeVendorIme(deviceId, enabled = true, onItem) {
  const handled = []

  for (const ime of VENDOR_IMES) {
    const listed = await tryShell(deviceId, `pm list packages ${ime}`)
    if (!listed.includes(ime)) {
      continue
    }

    if (enabled) {
      await tryShell(deviceId, `pm disable-user --user 0 ${ime}`)
      await tryShell(deviceId, `pm disable ${ime}`)
    }
    else {
      await tryShell(deviceId, `pm enable ${ime}`)
    }

    handled.push(ime)
    onItem?.(ime)
  }

  return handled
}

async function listThirdPartyPackages(deviceId) {
  const raw = await tryShell(deviceId, 'pm list packages -3')
  return raw
    .split('\n')
    .map(line => line.replace(/^package:/, '').trim())
    .filter(Boolean)
}

function parseRequestedPermissions(dump) {
  const requested = new Set()
  const ungranted = new Set()
  const lines = String(dump || '').split('\n')
  let section = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (/^requested permissions:/i.test(line)) {
      section = 'requested'
      continue
    }
    if (/^install permissions:/i.test(line) || /^runtime permissions:/i.test(line) || /^declared permissions:/i.test(line)) {
      section = /runtime permissions:/i.test(line) ? 'runtime' : ''
      continue
    }
    if (section && !line.startsWith('android.permission.') && !line.startsWith('com.')) {
      if (line.endsWith(':') && !line.includes('permission')) {
        section = ''
      }
      continue
    }

    const name = line.replace(/:.*/, '').trim()
    if (!name.startsWith('android.permission.') && !name.startsWith('com.')) {
      continue
    }

    if (section === 'requested') {
      requested.add(name)
    }
    if (section === 'runtime') {
      requested.add(name)
      if (/granted=false/i.test(line)) {
        ungranted.add(name)
      }
    }
  }

  return { requested, ungranted }
}

async function grantRuntimePermissions(deviceId, pkg, profile, onStep) {
  const dump = await tryShell(deviceId, `dumpsys package ${pkg}`)
  const { requested } = parseRequestedPermissions(dump)
  const targets = DANGEROUS_PERMISSIONS.filter((item) => {
    if (profile.sdk < item.minSdk) {
      return false
    }
    if (!requested.size) {
      return true
    }
    return requested.has(item.name)
  })

  let granted = 0
  for (const item of targets) {
    const output = await tryShell(deviceId, `pm grant --user 0 ${pkg} ${item.name}`)
    if (output && /Unknown permission|not a dangerous|has not requested/i.test(output)) {
      continue
    }
    granted += 1
  }

  for (const item of APPOPS) {
    if (profile.sdk < item.minSdk) {
      continue
    }
    await tryShell(deviceId, `appops set ${pkg} ${item.name} allow`)
    await tryShell(deviceId, `cmd appops set ${pkg} ${item.name} allow`)
  }

  await tryShell(deviceId, `dumpsys deviceidle whitelist +${pkg}`)
  onStep?.(`${pkg} 已处理 ${granted} 项运行时权限`)
}

export async function grantThirdPartyPermissions(deviceId, enabled = true, onItem) {
  const profile = await getDeviceProfile(deviceId)
  const packages = await listThirdPartyPackages(deviceId)

  if (enabled) {
    const skipped = DANGEROUS_PERMISSIONS
      .filter(item => profile.sdk < item.minSdk)
      .map(item => `${item.name.replace('android.permission.', '')}（需 API ${item.minSdk}+）`)
    if (skipped.length) {
      onItem?.(`当前 ${describeDevice(profile)}，跳过：${skipped.slice(0, 4).join('、')}${skipped.length > 4 ? ' 等' : ''}`, packages.length)
    }
    if (isHuaweiLike(profile)) {
      onItem?.('华为/荣耀自启动、关联启动无法通过 pm grant 完成', packages.length)
    }
  }

  for (const pkg of packages) {
    if (enabled) {
      await grantRuntimePermissions(deviceId, pkg, profile, () => {})
    }
    else {
      for (const item of DANGEROUS_PERMISSIONS) {
        if (profile.sdk >= item.minSdk) {
          await tryShell(deviceId, `pm revoke --user 0 ${pkg} ${item.name}`)
        }
      }
    }
    onItem?.(pkg, packages.length)
  }

  return packages.length
}

export async function setBatteryOptimization(deviceId, enabled, onItem) {
  if (enabled) {
    await tryShell(deviceId, 'dumpsys deviceidle enable')
  }
  else {
    await tryShell(deviceId, 'dumpsys deviceidle disable')
    await tryShell(deviceId, 'settings put global low_power 0')
  }

  const packages = await listThirdPartyPackages(deviceId)
  for (const pkg of packages) {
    if (enabled) {
      await tryShell(deviceId, `dumpsys deviceidle whitelist -${pkg}`)
    }
    else {
      await tryShell(deviceId, `dumpsys deviceidle whitelist +${pkg}`)
      await tryShell(deviceId, `cmd appops set ${pkg} RUN_IN_BACKGROUND allow`)
      await tryShell(deviceId, `cmd appops set ${pkg} RUN_ANY_IN_BACKGROUND allow`)
    }
    onItem?.(pkg, packages.length)
  }

  return packages.length
}

export async function forceStopThirdParty(deviceId, onItem) {
  const packages = await listThirdPartyPackages(deviceId)
  for (const pkg of packages) {
    await tryShell(deviceId, `am force-stop ${pkg}`)
    onItem?.(pkg, packages.length)
  }
  return packages.length
}

export async function clearThirdPartyData(deviceId, onItem) {
  const packages = await listThirdPartyPackages(deviceId)
  for (const pkg of packages) {
    await tryShell(deviceId, `pm clear ${pkg}`)
    onItem?.(pkg, packages.length)
  }
  return packages.length
}

export async function uninstallThirdParty(deviceId, onItem) {
  const packages = await listThirdPartyPackages(deviceId)
  for (const pkg of packages) {
    await tryShell(deviceId, `pm uninstall --user 0 ${pkg}`)
    onItem?.(pkg, packages.length)
  }
  return packages.length
}

export async function setBluetooth(deviceId, enabled) {
  await tryShell(deviceId, `svc bluetooth ${enabled ? 'enable' : 'disable'}`)
}

export async function setMobileData(deviceId, enabled) {
  await tryShell(deviceId, `svc data ${enabled ? 'enable' : 'disable'}`)
}

export async function setWirelessAdb(deviceId, enabled, port = 5555) {
  if (enabled) {
    if (typeof adb().tcpip === 'function') {
      await adb().tcpip(deviceId, port)
      return
    }
    await tryShell(deviceId, `setprop service.adb.tcp.port ${port}`)
    return
  }

  if (typeof adb().shell === 'function') {
    await adb().shell(`-s ${deviceId} usb`).catch(() => false)
  }
  await tryShell(deviceId, 'setprop service.adb.tcp.port -1')
}

export async function runCustomShell(deviceId, command) {
  const text = String(command || '').trim()
  if (!text) {
    throw new Error('命令为空')
  }
  return shell(deviceId, text)
}

export async function runFullInit(deviceId, onStep) {
  const profile = await getDeviceProfile(deviceId)
  onStep?.(`识别设备 ${describeDevice(profile)}`)
  for (const gap of listCapabilityGaps(profile)) {
    onStep?.(`做不到：${gap}`)
  }

  onStep?.('跳过开机向导')
  await skipSetupWizard(deviceId, true)

  onStep?.('关闭动画')
  await setAnimations(deviceId, false)

  onStep?.('允许未知来源并关闭安装校验')
  await setUnknownSources(deviceId, true)
  await setPlayProtect(deviceId, false)
  if (profile.sdk >= 26) {
    onStep?.('Android 8+ 未知来源是按应用授权，全局开关可能无效；电脑 ADB 安装不受影响')
  }

  onStep?.('安装并切换 ADB 键盘')
  await setupAdbKeyboard(deviceId, onStep)

  onStep?.('冻结厂商输入法')
  await freezeVendorIme(deviceId, true, ime => onStep?.(`已冻结 ${ime}`))

  onStep?.('忽略电池优化')
  await setBatteryOptimization(deviceId, false, (pkg, total) => {
    onStep?.(`白名单 ${pkg}（共 ${total} 个）`)
  })

  onStep?.('为第三方应用授权')
  const count = await grantThirdPartyPermissions(deviceId, true, (pkg, total) => {
    onStep?.(`授权 ${pkg}（共 ${total} 个）`)
  })

  onStep?.(`初始化完成，已处理 ${count} 个第三方应用`)
  return profile
}

function logHealthItem(onStep, item) {
  const mark = item.status === 'ok' ? '通过' : item.status === 'fail' ? '待处理' : item.status === 'warn' ? '注意' : '跳过'
  onStep?.(`${mark}  ${item.label}${item.detail ? ` · ${item.detail}` : ''}`)
}

async function collectHealthReport(deviceId, profile, onStep) {
  const items = []
  const add = (item) => {
    items.push(item)
    logHealthItem(onStep, item)
  }

  const [
    setup,
    provisioned,
    anim,
    verifier,
    unknown,
    ime,
    allPackagesRaw,
    enabledRaw,
    thirdPartyRaw,
    whitelist,
    batteryDump,
    storageDump,
    stayOn,
  ] = await Promise.all([
    tryShell(deviceId, 'settings get secure user_setup_complete'),
    tryShell(deviceId, 'settings get global device_provisioned'),
    tryShell(deviceId, 'settings get global window_animation_scale'),
    tryShell(deviceId, 'settings get global package_verifier_enable'),
    tryShell(deviceId, 'settings get secure install_non_market_apps'),
    tryShell(deviceId, 'settings get secure default_input_method'),
    tryShell(deviceId, 'pm list packages'),
    tryShell(deviceId, 'pm list packages -e'),
    tryShell(deviceId, 'pm list packages -3'),
    tryShell(deviceId, 'dumpsys deviceidle whitelist'),
    tryShell(deviceId, 'dumpsys battery'),
    tryShell(deviceId, 'df /data'),
    tryShell(deviceId, 'settings get global stay_on_while_plugged_in'),
  ])

  let battery = parseBatteryVitals(batteryDump)
  try {
    const live = await adb().battery(deviceId)
    const percent = live?.computed?.batteryPercentage
    if (percent != null) {
      battery = {
        ...battery,
        text: `${percent}%${battery.charging ? ' 充电中' : ''}`,
        low: Number(percent) > 0 && Number(percent) < 15 && !battery.charging,
      }
    }
  }
  catch {
    // keep dumpsys fallback
  }

  const packages = packageList(thirdPartyRaw)
  const installed = new Set(packageList(allPackagesRaw))
  const enabled = new Set(packageList(enabledRaw))
  const storage = parseStorageFree(storageDump)
  const vitals = {
    title: describeDevice(profile),
    battery: battery.text,
    storage,
    ime: shortIme(ime),
    stayOn: stayOn && stayOn !== '0' && stayOn !== 'null',
  }
  onStep?.(`概况  电量 ${vitals.battery}${storage ? ` · ${storage}` : ''} · 输入法 ${vitals.ime}`)

  if (battery.low) {
    add({ id: 'battery', label: '电量偏低', detail: battery.text, status: 'warn' })
  }

  add(setup === '1' && provisioned === '1'
    ? { id: 'skipSetup', label: '开机向导', detail: '已跳过', status: 'ok' }
    : { id: 'skipSetup', label: '开机向导', detail: '未跳过，会反复弹出设置', status: 'fail' })

  add(anim === '0' || anim === '0.0'
    ? { id: 'animation', label: '系统动画', detail: '已关闭', status: 'ok' }
    : { id: 'animation', label: '系统动画', detail: `当前 ${anim || '默认'}，脚本点击会变慢`, status: 'fail' })

  add(verifier === '0'
    ? { id: 'playProtect', label: '安装校验', detail: '已关闭', status: 'ok' }
    : { id: 'playProtect', label: '安装校验', detail: '未关闭，装包容易被拦', status: 'fail' })

  if (profile.sdk < 26) {
    add(unknown === '1'
      ? { id: 'unknownSource', label: '未知来源', detail: '已允许', status: 'ok' }
      : { id: 'unknownSource', label: '未知来源', detail: '未允许，侧载会失败', status: 'fail' })
  }
  else {
    add({
      id: 'unknownSource',
      label: '未知来源',
      detail: 'Android 8+ 按应用授权，电脑 ADB 安装不受影响',
      status: 'skip',
    })
  }

  const keyboardInstalled = installed.has(ADB_KEYBOARD_PKG) || enabled.has(ADB_KEYBOARD_PKG)
  const keyboardEnabled = String(ime).includes('adbkeyboard')
  if (!keyboardInstalled) {
    add({ id: 'keyboard', label: 'ADB 键盘', detail: '未安装', status: 'fail' })
  }
  else if (!keyboardEnabled) {
    add({ id: 'keyboard', label: 'ADB 键盘', detail: `已安装，当前却是 ${shortIme(ime)}`, status: 'fail' })
  }
  else {
    add({ id: 'keyboard', label: 'ADB 键盘', detail: '已启用', status: 'ok' })
  }

  const activeVendors = VENDOR_IMES.filter(pkg => installed.has(pkg) && enabled.has(pkg))
  if (activeVendors.length) {
    add({
      id: 'freezeIme',
      label: '厂商输入法',
      detail: `未冻结：${activeVendors.map(pkg => VENDOR_IME_LABELS[pkg] || pkg).join('、')}`,
      status: 'fail',
    })
  }
  else {
    add({ id: 'freezeIme', label: '厂商输入法', detail: '没有在用的厂商输入法', status: 'ok' })
  }

  if (!packages.length) {
    add({ id: 'batteryOpt', label: '电池优化', detail: '没有第三方应用', status: 'ok' })
    add({ id: 'grant', label: '应用权限', detail: '没有第三方应用', status: 'ok' })
  }
  else {
    const missingIdle = packages.filter(pkg => !isIdleWhitelisted(whitelist, pkg))
    add(missingIdle.length
      ? {
          id: 'batteryOpt',
          label: '电池优化',
          detail: `${missingIdle.length}/${packages.length} 个第三方应用未进白名单`,
          status: 'fail',
        }
      : { id: 'batteryOpt', label: '电池优化', detail: `${packages.length} 个应用已进白名单`, status: 'ok' })

    const sample = packages.slice(0, 4)
    const dumps = await Promise.all(sample.map(pkg => tryShell(deviceId, `dumpsys package ${pkg}`)))
    const ungranted = dumps.reduce((sum, dump) => sum + parseRequestedPermissions(dump).ungranted.size, 0)
    add(ungranted
      ? {
          id: 'grant',
          label: '应用权限',
          detail: `抽查 ${sample.length} 个应用，还有 ${ungranted} 项运行时权限未授予`,
          status: 'fail',
        }
      : { id: 'grant', label: '应用权限', detail: `抽查 ${sample.length} 个应用，运行时权限已授予`, status: 'ok' })
  }

  if (isHuaweiLike(profile)) {
    add({
      id: 'autostart',
      label: '自启动 / 关联启动',
      detail: '华为/荣耀无法用 ADB 完整放开，弹窗用「弹窗消杀」点掉',
      status: 'skip',
    })
  }

  const issues = items.filter(item => item.status === 'fail')
  const warns = items.filter(item => item.status === 'warn')
  const skips = items.filter(item => item.status === 'skip')
  return { items, issues, warns, skips, vitals }
}

export async function diagnoseDevice(deviceId, onStep) {
  const profile = await getDeviceProfile(deviceId)
  onStep?.(`识别 ${describeDevice(profile)}`)

  const collected = await collectHealthReport(deviceId, profile, onStep)
  if (collected.issues.length) {
    onStep?.(`结论  ${collected.issues.length} 项待处理，跑脚本前建议先「一键初始化」`)
  }
  else if (collected.warns.length) {
    onStep?.(`结论  脚本相关项已就绪，另有 ${collected.warns.length} 项需要留意`)
  }
  else {
    onStep?.('结论  脚本环境已就绪')
  }

  return {
    profile,
    gaps: collected.skips.map(item => item.detail || item.label),
    ...collected,
  }
}

export function formatDiagnosis(report) {
  const vitals = report.vitals || {}
  const issues = report.issues || []
  const warns = report.warns || []
  const skips = report.skips || []
  const okCount = (report.items || []).filter(item => item.status === 'ok').length
  const lines = [
    vitals.title || describeDevice(report.profile || {}),
    ['电量 ' + (vitals.battery || '-'), vitals.storage, vitals.ime ? `输入法 ${vitals.ime}` : '']
      .filter(Boolean)
      .join(' · '),
    '',
  ]

  if (!issues.length && !warns.length) {
    lines.push(`脚本环境已就绪 · 通过 ${okCount} 项`)
  }
  else {
    lines.push(`待处理 ${issues.length} · 通过 ${okCount}${warns.length ? ` · 注意 ${warns.length}` : ''}`)
  }

  for (const item of issues) {
    lines.push(`✗ ${item.label}${item.detail ? `：${item.detail}` : ''}`)
  }
  for (const item of warns) {
    lines.push(`! ${item.label}${item.detail ? `：${item.detail}` : ''}`)
  }
  if (issues.length) {
    lines.push('', '用「一键初始化」可把待处理项一次修掉')
  }
  for (const item of skips) {
    lines.push(`— ${item.label}：${item.detail || '当前系统做不到'}`)
  }

  return lines.filter((line, index, list) => line !== '' || list[index - 1] !== '').join('\n')
}

export async function optimizeDevice(deviceId, onStep) {
  const report = await diagnoseDevice(deviceId, onStep)
  const unique = [...new Map(report.issues.map(item => [item.id, item])).values()]
  if (!unique.length) {
    onStep?.('没有需要优化的项目')
    return formatDiagnosis(report)
  }

  for (const issue of unique) {
    onStep?.(`优化：${issue.label}`)
    if (issue.id === 'skipSetup') {
      await skipSetupWizard(deviceId, true)
    }
    else if (issue.id === 'animation') {
      await setAnimations(deviceId, false)
    }
    else if (issue.id === 'unknownSource') {
      await setUnknownSources(deviceId, true)
    }
    else if (issue.id === 'playProtect') {
      await setPlayProtect(deviceId, false)
    }
    else if (issue.id === 'keyboard') {
      await setupAdbKeyboard(deviceId, onStep)
    }
    else if (issue.id === 'freezeIme') {
      await freezeVendorIme(deviceId, true, ime => onStep?.(`已冻结 ${ime}`))
    }
    else if (issue.id === 'batteryOpt') {
      await setBatteryOptimization(deviceId, false, (pkg, total) => onStep?.(`白名单 ${pkg}（共 ${total} 个）`))
    }
    else if (issue.id === 'grant') {
      await grantThirdPartyPermissions(deviceId, true, (pkg, total) => onStep?.(`授权 ${pkg}（共 ${total} 个）`))
    }
  }

  onStep?.(`已优化 ${unique.length} 项`)
  return `已优化 ${unique.length} 项`
}

function findAllowTap(xml) {
  const chunks = String(xml || '').split('>')

  for (const chunk of chunks) {
    if (!TARGET_KEYWORDS.test(chunk) || NEGATIVE_KEYWORDS.test(chunk)) {
      continue
    }

    const match = chunk.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!match) {
      continue
    }

    const x1 = Number(match[1])
    const y1 = Number(match[2])
    const x2 = Number(match[3])
    const y2 = Number(match[4])

    return {
      x: Math.floor((x1 + x2) / 2),
      y: Math.floor((y1 + y2) / 2),
    }
  }

  return null
}

export async function dismissPermissionPopup(deviceId) {
  await tryShell(deviceId, 'uiautomator dump /data/local/tmp/ui_dump.xml')
  const xml = await tryShell(deviceId, 'cat /data/local/tmp/ui_dump.xml')
  const point = findAllowTap(xml)

  if (!point) {
    return false
  }

  await tryShell(deviceId, `input tap ${point.x} ${point.y}`)
  return point
}

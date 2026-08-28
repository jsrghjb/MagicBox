import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { sleep } from '$/utils/index.js'
import { findTool } from '$/utils/toolbox/catalog.js'
import {
  diagnoseDevice,
  dismissPermissionPopup,
  enableAdbKeyboard,
  formatDiagnosis,
  freezeVendorIme,
  getCurrentIme,
  grantThirdPartyPermissions,
  restoreSystemIme,
  runCustomShell,
  runFullInit,
  setAnimations,
  setBatteryOptimization,
  setPlayProtect,
  setUnknownSources,
  setupAdbKeyboard,
  skipSetupWizard,
} from '$/utils/toolbox/actions.js'

const MAX_LOGS = 200
const STORE_KEY = 'toolbox'
const DEFAULT_CONCURRENCY = 4
let activeRun = null

function loadPersisted() {
  return window.$preload.store.get(STORE_KEY) || {}
}

function persist(patch) {
  window.$preload.store.set(STORE_KEY, {
    ...loadPersisted(),
    ...patch,
  })
}

async function runPool(items, limit, worker, shouldStop) {
  const executing = new Set()
  const results = []

  for (const [index, item] of items.entries()) {
    if (shouldStop?.()) {
      break
    }

    const promise = Promise.resolve()
      .then(() => worker(item, index))
      .finally(() => {
        executing.delete(promise)
      })

    results.push(promise)
    executing.add(promise)

    if (executing.size >= limit) {
      await Promise.race([...executing])
    }
  }

  return Promise.allSettled(results)
}

function deviceLabel(device) {
  return device.remark || device.name || device.id
}

export const useToolboxStore = defineStore('app-toolbox', () => {
  const persisted = loadPersisted()

  const selectedIds = ref([])
  const runningId = ref('')
  const aborting = ref(false)
  const watchingIds = ref([])
  const logs = ref([])
  const parallel = ref(persisted.parallel !== false)
  const customCommands = ref(Array.isArray(persisted.customCommands) ? persisted.customCommands : [])
  const savedImeByDevice = ref({})
  const lastRun = ref({
    title: '',
    items: [],
  })

  const watchingSet = computed(() => new Set(watchingIds.value))

  const resultSummary = computed(() => {
    const items = lastRun.value.items || []
    return {
      total: items.length,
      success: items.filter(item => item.status === 'success').length,
      error: items.filter(item => item.status === 'error').length,
      running: items.filter(item => item.status === 'running' || item.status === 'pending').length,
      paused: items.filter(item => item.status === 'paused').length,
    }
  })

  function nowTime() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function appendLog(message, level = 'info', extra = {}) {
    logs.value = [
      ...logs.value,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        time: nowTime(),
        level,
        kind: extra.kind || level,
        deviceId: extra.deviceId || '',
        deviceLabel: extra.deviceLabel || '',
        message,
      },
    ].slice(-MAX_LOGS)
  }

  function clearLogs() {
    logs.value = []
  }

  function clearResults() {
    lastRun.value = {
      title: '',
      items: [],
    }
  }

  function setSelectedIds(ids) {
    selectedIds.value = [...new Set(ids.filter(Boolean))]
  }

  function toggleSelected(id) {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter(item => item !== id)
      return
    }
    selectedIds.value = [...selectedIds.value, id]
  }

  function persistState() {
    persist({
      parallel: parallel.value,
      customCommands: customCommands.value,
    })
  }

  function setParallel(value) {
    parallel.value = Boolean(value)
    persistState()
  }

  function resetResults(title, devices) {
    lastRun.value = {
      title,
      items: devices.map(device => ({
        id: device.id,
        label: deviceLabel(device),
        status: 'pending',
        message: '',
        steps: [],
      })),
    }
  }

  function patchResult(deviceId, patch) {
    lastRun.value = {
      ...lastRun.value,
      items: lastRun.value.items.map((item) => {
        if (item.id !== deviceId) {
          return item
        }
        const next = { ...item, ...patch }
        if (patch.message && patch.message !== item.message) {
          next.steps = [...(item.steps || []), patch.message].slice(-24)
        }
        return next
      }),
    }
  }

  function getConcurrency() {
    return parallel.value ? DEFAULT_CONCURRENCY : 1
  }

  const actionRunners = {
    async init(deviceId, _mode, _params, onStep) {
      await runFullInit(deviceId, onStep)
    },
    async diagnose(deviceId, _mode, _params, onStep) {
      const report = await diagnoseDevice(deviceId, onStep)
      return formatDiagnosis(report)
    },
    async skipSetup(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '跳过开机向导' : '恢复开机向导标记')
      await skipSetupWizard(deviceId, enabled)
    },
    async keyboard(deviceId, mode, _params, onStep) {
      if (mode === 'off') {
        onStep?.('恢复系统输入法')
        const restored = await restoreSystemIme(deviceId, savedImeByDevice.value[deviceId])
        onStep?.(restored ? `已切换到 ${restored}` : '未找到可恢复的系统输入法')
        return
      }

      const current = await getCurrentIme(deviceId)
      if (current && !current.includes('adbkeyboard')) {
        savedImeByDevice.value = { ...savedImeByDevice.value, [deviceId]: current }
      }

      if (mode === 'install') {
        await setupAdbKeyboard(deviceId, onStep)
        return
      }

      await enableAdbKeyboard(deviceId, onStep)
    },
    async animation(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '恢复系统动画' : '关闭系统动画')
      await setAnimations(deviceId, enabled)
    },
    async unknownSource(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '允许未知来源' : '关闭未知来源')
      await setUnknownSources(deviceId, enabled)
    },
    async playProtect(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '开启安装校验' : '关闭 Play 保护 / 安装校验')
      await setPlayProtect(deviceId, enabled)
    },
    async batteryOpt(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '恢复电池优化' : '忽略电池优化')
      const count = await setBatteryOptimization(deviceId, enabled, (pkg, total) => {
        onStep?.(`${pkg}（共 ${total} 个）`)
      })
      onStep?.(`已处理 ${count} 个应用`)
    },
    async grant(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '为第三方应用批量授权' : '撤销第三方应用权限')
      const count = await grantThirdPartyPermissions(deviceId, enabled, (pkg, total) => {
        onStep?.(`${pkg}（共 ${total} 个）`)
      })
      onStep?.(`已处理 ${count} 个应用`)
    },
    async freezeIme(deviceId, mode, _params, onStep) {
      const enabled = mode !== 'off'
      onStep?.(enabled ? '冻结厂商输入法' : '解冻厂商输入法')
      const handled = await freezeVendorIme(deviceId, enabled, ime => onStep?.(ime))
      onStep?.(handled.length ? `已处理 ${handled.length} 个输入法` : '未发现可处理的厂商输入法')
    },
    async custom(deviceId, _mode, params, onStep) {
      onStep?.(`执行 ${params?.command}`)
      const output = await runCustomShell(deviceId, params?.command)
      if (output) {
        onStep?.(output.slice(0, 300))
      }
      return output
    },
  }

  function resetRunState() {
    activeRun = null
    runningId.value = ''
    aborting.value = false
  }

  function recoverIfStale() {
    if (runningId.value && !activeRun) {
      resetRunState()
    }
  }

  function requestPause() {
    if (!runningId.value) {
      return false
    }
    aborting.value = true
    appendLog(window.t('toolbox.paused'), 'info', { kind: 'run' })
    if (!activeRun) {
      resetRunState()
    }
    return true
  }

  async function runOnDevices(actionId, devices, runner, title) {
    if (runningId.value) {
      if (!activeRun) {
        resetRunState()
      }
      else {
        ElMessage.warning(window.t('toolbox.busy'))
        return false
      }
    }

    if (!devices.length) {
      ElMessage.warning(window.t('toolbox.target.empty'))
      return false
    }

    aborting.value = false
    runningId.value = actionId
    const run = { id: actionId }
    activeRun = run
    resetResults(title, devices)
    appendLog(`${title} · ${devices.length} 台 · ${parallel.value ? '并行' : '逐台'}`, 'info', { kind: 'run' })

    try {
      await runPool(devices, getConcurrency(), async (device) => {
        if (aborting.value) {
          patchResult(device.id, { status: 'paused', message: window.t('toolbox.paused') })
          return
        }

        const label = deviceLabel(device)
        patchResult(device.id, { status: 'running', message: '' })
        appendLog('开始处理', 'info', { kind: 'device', deviceId: device.id, deviceLabel: label })

        try {
          const summary = await runner(device.id, (step) => {
            appendLog(step, 'info', { kind: 'step', deviceId: device.id, deviceLabel: label })
            patchResult(device.id, { message: step })
          })
          if (aborting.value) {
            patchResult(device.id, { status: 'paused', message: typeof summary === 'string' && summary ? summary : window.t('toolbox.paused') })
            appendLog('已暂停', 'info', { kind: 'pause', deviceId: device.id, deviceLabel: label })
            return
          }
          const message = typeof summary === 'string' && summary ? summary : window.t('toolbox.done')
          patchResult(device.id, { status: 'success', message })
          appendLog('完成', 'success', { kind: 'success', deviceId: device.id, deviceLabel: label })
        }
        catch (error) {
          const message = error?.message || String(error)
          patchResult(device.id, { status: 'error', message })
          appendLog(message, 'error', { kind: 'error', deviceId: device.id, deviceLabel: label })
        }
      }, () => aborting.value)

      lastRun.value = {
        ...lastRun.value,
        items: lastRun.value.items.map((item) => {
          if (item.status === 'pending') {
            return { ...item, status: 'paused', message: window.t('toolbox.paused') }
          }
          return item
        }),
      }

      if (aborting.value) {
        ElMessage.info(window.t('toolbox.paused'))
        return false
      }

      const failed = resultSummary.value.error
      if (failed) {
        ElMessage.warning(window.t('toolbox.done.partial', { success: resultSummary.value.success, error: failed }))
      }
      else {
        ElMessage.success(window.t('toolbox.done'))
      }

      return true
    }
    finally {
      if (activeRun === run) {
        resetRunState()
      }
    }
  }

  async function runAction(actionId, devices, { mode = 'on', params = {} } = {}) {
    const tool = findTool(actionId)
    const runner = actionId.startsWith('custom-')
      ? actionRunners.custom
      : actionRunners[actionId]

    if (!runner) {
      return false
    }

    const title = tool
      ? (['action', 'toggle'].includes(tool.kind)
          ? window.t(tool.label)
          : `${window.t(tool.label)} · ${mode === 'off' ? window.t(tool.offLabel || 'toolbox.switch.off') : window.t(tool.buttons?.find(item => item.mode === mode)?.label || tool.onLabel || 'toolbox.switch.on')}`)
      : params?.name || actionId

    return runOnDevices(actionId, devices, async (deviceId, onStep) => {
      return runner(deviceId, mode, params, onStep)
    }, title)
  }

  async function watchLoop(deviceId, label) {
    while (watchingSet.value.has(deviceId)) {
      try {
        const point = await dismissPermissionPopup(deviceId)
        if (point) {
          appendLog(`点掉弹窗 (${point.x}, ${point.y})`, 'success', { kind: 'step', deviceId, deviceLabel: label })
        }
      }
      catch (error) {
        appendLog(error?.message || String(error), 'error', { kind: 'error', deviceId, deviceLabel: label })
      }

      await sleep(1000)
    }
  }

  function startWatch(devices) {
    if (!devices.length) {
      ElMessage.warning(window.t('toolbox.target.empty'))
      return false
    }

    appendLog(window.t('toolbox.watch.started'), 'info', { kind: 'run' })

    for (const device of devices) {
      if (watchingSet.value.has(device.id)) {
        continue
      }

      watchingIds.value = [...watchingIds.value, device.id]
      const label = deviceLabel(device)
      appendLog('已开启弹窗消杀', 'info', { kind: 'device', deviceId: device.id, deviceLabel: label })
      watchLoop(device.id, label)
    }

    ElMessage.success(window.t('toolbox.watch.started'))
    return true
  }

  function stopWatch(deviceIds = watchingIds.value) {
    const stopSet = new Set(deviceIds)
    watchingIds.value = watchingIds.value.filter(id => !stopSet.has(id))
    appendLog(window.t('toolbox.watch.stopped'), 'info', { kind: 'run' })
    ElMessage.info(window.t('toolbox.watch.stopped'))
  }

  function toggleWatch(devices) {
    const ids = devices.map(device => device.id)
    const allWatching = ids.length > 0 && ids.every(id => watchingSet.value.has(id))

    if (allWatching) {
      stopWatch(ids)
      return false
    }

    startWatch(devices)
    return true
  }

  function addCustomCommand({ name, command }) {
    const item = {
      id: `custom-${nanoid(8)}`,
      name: String(name || '').trim(),
      command: String(command || '').trim(),
    }

    if (!item.name || !item.command) {
      throw new Error('名称和命令都不能为空')
    }

    customCommands.value = [...customCommands.value, item]
    persistState()
    return item
  }

  function removeCustomCommand(id) {
    customCommands.value = customCommands.value.filter(item => item.id !== id)
    persistState()
  }

  return {
    selectedIds,
    runningId,
    aborting,
    watchingIds,
    watchingSet,
    logs,
    parallel,
    customCommands,
    lastRun,
    resultSummary,
    appendLog,
    clearLogs,
    clearResults,
    setSelectedIds,
    toggleSelected,
    setParallel,
    resetRunState,
    recoverIfStale,
    requestPause,
    runAction,
    startWatch,
    stopWatch,
    toggleWatch,
    addCustomCommand,
    removeCustomCommand,
  }
})

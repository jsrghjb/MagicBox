import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { automationDataStore } from '$/database/modules/automation/index.js'
import { createRunner } from '$/utils/automation/runner.js'
import { RunnerStatus } from '$/utils/automation/runner-status.js'
import { useDeviceStore } from '$/store/device/index.js'

export const useAutomationStore = defineStore('app-automation', () => {
  const currentScriptId = ref(null)
  const selectedStepId = ref(null)
  const logs = ref([])
  const runnerStatus = ref(RunnerStatus.IDLE)
  const runningStepIndex = ref(-1)
  const breakpointSnapshot = ref(loadPersistedBreakpoint())
  const autoResumeOnHumanExit = ref(true)
  const autoResumeDelay = ref(3000)

  let autoResumeTimer = null
  let isResumingFromBreakpoint = false

  function clearAutoResumeTimer() {
    if (autoResumeTimer) {
      clearTimeout(autoResumeTimer)
      autoResumeTimer = null
    }
  }

  function loadPersistedBreakpoint() {
    try {
      const raw = localStorage.getItem('escrcpy_automation_breakpoint')
      return raw ? JSON.parse(raw) : null
    }
    catch {
      return null
    }
  }

  function saveBreakpoint(snapshot) {
    breakpointSnapshot.value = snapshot
    try {
      if (snapshot) {
        localStorage.setItem('escrcpy_automation_breakpoint', JSON.stringify(snapshot))
      }
      else {
        localStorage.removeItem('escrcpy_automation_breakpoint')
      }
    }
    catch {}
  }

  function clearBreakpoint() {
    clearAutoResumeTimer()
    saveBreakpoint(null)
  }

  let runner = null

  function appendLog(entry) {
    logs.value.push({
      id: nanoid(),
      time: Date.now(),
      ...entry,
    })
  }

  function clearLogs() {
    logs.value = []
  }

  function getRunner() {
    // Only create a new runner when there isn't one already running.
    // Do NOT stop/recreate an active runner — that breaks pause/resume.
    if (!runner) {
      runner = createRunner()
    }
    return runner
  }

  function resetRunner() {
    // Explicitly stop and recreate the runner (only called before a fresh run).
    if (runner) {
      try {
        runner.stop()
      }
      catch {}
    }
    runner = createRunner()
    return runner
  }

  async function runScript({ deviceId, script, stepIndexes = null, isResume = false }) {
    clearAutoResumeTimer()
    if (!deviceId) {
      ElMessage.warning(window.t('automation.run.noDevice'))
      return false
    }

    const deviceStore = useDeviceStore()
    const activeDeviceId = deviceStore.resolveActiveDevice(deviceId) || deviceId

    if (!script?.steps?.length) {
      ElMessage.warning(window.t('automation.run.noSteps'))
      return false
    }

    const instance = resetRunner()
    runnerStatus.value = RunnerStatus.RUNNING
    let lastActionStepIndex = -1

    try {
      const runResult = await instance.run({
        deviceId: activeDeviceId,
        steps: script.steps,
        vars: script.vars || {},
        stepIndexes,
        isResume,
        referenceScreenWidth: script.referenceScreenWidth || 1080,
        referenceScreenHeight: script.referenceScreenHeight || 1920,
        onLog: entry => appendLog(entry),
        onHumanIntervention: ({ deviceId: devId }) => {
          pauseRun({
            isHumanIntervention: true,
            deviceId: devId || activeDeviceId,
            script,
          })
        },
        onStepStart: ({ stepIndex, step }) => {
          const type = step?.type || ''
          const isAction = ['tap', 'swipe', 'input', 'launch', 'command', 'key', 'install'].includes(type)
          if (isAction || lastActionStepIndex < 0) {
            lastActionStepIndex = stepIndex
          }
          const breakpointIndex = isAction ? stepIndex : (lastActionStepIndex >= 0 ? lastActionStepIndex : stepIndex)
          runningStepIndex.value = breakpointIndex
          saveBreakpoint({
            scriptId: script.id,
            deviceId: activeDeviceId,
            stepIndex: breakpointIndex,
            status: RunnerStatus.RUNNING,
            timestamp: Date.now(),
          })
        },
      })

      // If the run was stopped (e.g., superseded by a breakpoint recovery),
      // do NOT clear state or show success — return silently so the new run takes over.
      if (runResult?.stopped) {
        appendLog({ level: 'info', message: 'ℹ️ 当前执行实例已被新任务接管，正在转交控制权...' })
        return true
      }

      runnerStatus.value = RunnerStatus.IDLE
      runningStepIndex.value = -1
      clearBreakpoint()
      appendLog({ level: 'success', message: window.t('automation.run.done') })
      ElMessage.success(window.t('automation.run.done'))
      return true
    }
    catch (error) {
      const currentStatus = instance.controller.status || RunnerStatus.INTERRUPTED
      runnerStatus.value = currentStatus
      const finalIndex = runningStepIndex.value >= 0 ? runningStepIndex.value : (lastActionStepIndex >= 0 ? lastActionStepIndex : 0)

      if (currentStatus === RunnerStatus.PAUSED || currentStatus === RunnerStatus.STOPPED || error?.message !== 'STOPPED') {
        saveBreakpoint({
          scriptId: script.id,
          deviceId: activeDeviceId,
          stepIndex: finalIndex,
          status: currentStatus,
          error: error?.message || null,
          timestamp: Date.now(),
        })
      }

      runningStepIndex.value = -1

      if (error?.message !== 'STOPPED') {
        appendLog({ level: 'error', message: `${window.t('automation.run.failed')}: ${error.message || error}` })
        ElMessage.error(window.t('automation.run.failed'))
      }
      return false
    }
  }

  async function resumeFromBreakpoint({ deviceId, script }) {
    clearAutoResumeTimer()
    if (!breakpointSnapshot.value) {
      ElMessage.warning('暂无已保存的脚本断点')
      return false
    }

    const startIndex = Math.max(0, breakpointSnapshot.value.stepIndex ?? 0)
    const indexes = []
    for (let i = startIndex; i < script.steps.length; i++) {
      indexes.push(i)
    }

    appendLog({
      level: 'info',
      message: `🚀 启动断点恢复程序 (脚本: ${script.name || script.id}, 目标步: [${startIndex + 1}/${script.steps.length}])`,
    })

    return await runScript({
      deviceId,
      script,
      stepIndexes: indexes,
      isResume: true,
    })
  }

  function triggerAutoResumeOnHumanExit({ deviceId, script }) {
    if (!autoResumeOnHumanExit.value) {
      appendLog({
        level: 'info',
        message: 'ℹ️ 自动恢复功能已关闭，等待手动恢复操作',
      })
      return
    }
    if (isResumingFromBreakpoint) {
      appendLog({
        level: 'info',
        message: 'ℹ️ 断点恢复正在进行中，跳过重复触发',
      })
      return
    }
    clearAutoResumeTimer()
    appendLog({
      level: 'warning',
      message: `🖐️ 检测到人为干预，倒计时 ${autoResumeDelay.value / 1000} 秒静默检测。若人工避退将自动抢回环境并强行恢复...`,
    })
    autoResumeTimer = setTimeout(async () => {
      clearAutoResumeTimer()
      if (isResumingFromBreakpoint) {
        return
      }
      if (runnerStatus.value === RunnerStatus.PAUSED && breakpointSnapshot.value) {
        isResumingFromBreakpoint = true
        appendLog({ level: 'info', message: '⏱️ 人工静默避退结束，触发强制自动抢回与环境自愈恢复...' })
        try {
          await resumeFromBreakpoint({ deviceId, script })
        }
        finally {
          isResumingFromBreakpoint = false
        }
      }
      else if (runnerStatus.value !== RunnerStatus.PAUSED) {
        appendLog({ level: 'info', message: 'ℹ️ 检测到脚本已不在暂停状态，取消自动恢复' })
      }
    }, autoResumeDelay.value)
  }

  function pauseRun(options = {}) {
    // Use the existing runner directly — do NOT call getRunner() here as that
    // would stop and recreate the runner, severing the pause/resume link.
    if (runner) {
      runner.pause()
    }
    runnerStatus.value = RunnerStatus.PAUSED
    if (breakpointSnapshot.value) {
      saveBreakpoint({
        ...breakpointSnapshot.value,
        status: RunnerStatus.PAUSED,
        timestamp: Date.now(),
      })
    }
    ElMessage.info(window.t('automation.run.paused'))

    if (options.isHumanIntervention && options.deviceId && options.script) {
      triggerAutoResumeOnHumanExit({ deviceId: options.deviceId, script: options.script })
    }
  }

  function resumeRun() {
    clearAutoResumeTimer()
    if (runner) {
      runner.resume()
    }
    runnerStatus.value = RunnerStatus.RUNNING
    if (breakpointSnapshot.value) {
      saveBreakpoint({
        ...breakpointSnapshot.value,
        status: RunnerStatus.RUNNING,
        timestamp: Date.now(),
      })
    }
    ElMessage.info(window.t('automation.run.resumed'))
  }

  function stopRun() {
    clearAutoResumeTimer()
    if (runner) {
      runner.stop()
    }
    runnerStatus.value = RunnerStatus.STOPPED
    const finalIndex = runningStepIndex.value >= 0 ? runningStepIndex.value : 0
    if (currentScriptId.value) {
      saveBreakpoint({
        scriptId: currentScriptId.value,
        deviceId: '',
        stepIndex: finalIndex,
        status: RunnerStatus.STOPPED,
        timestamp: Date.now(),
      })
    }
    runningStepIndex.value = -1
    appendLog({ level: 'warning', message: window.t('automation.run.stopped') })
    ElMessage.warning(window.t('automation.run.stopped'))
  }

  async function loadScriptById(id) {
    const result = await automationDataStore.getById(id)
    if (!result.success) {
      return null
    }
    return result.data
  }

  return {
    currentScriptId,
    selectedStepId,
    logs,
    runnerStatus,
    runningStepIndex,
    breakpointSnapshot,
    autoResumeOnHumanExit,
    autoResumeDelay,
    RunnerStatus,
    appendLog,
    clearLogs,
    runScript,
    resumeFromBreakpoint,
    clearBreakpoint,
    pauseRun,
    resumeRun,
    stopRun,
    loadScriptById,
  }
})

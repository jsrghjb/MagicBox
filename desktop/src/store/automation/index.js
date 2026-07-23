import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { automationDataStore } from '$/database/modules/automation/index.js'
import { createRunner } from '$/utils/automation/runner.js'
import { RunnerStatus } from '$/utils/automation/runner-status.js'

export const useAutomationStore = defineStore('app-automation', () => {
  const currentScriptId = ref(null)
  const selectedStepId = ref(null)
  const logs = ref([])
  const runnerStatus = ref(RunnerStatus.IDLE)
  const runningStepIndex = ref(-1)

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
    if (!runner) {
      runner = createRunner()
    }
    return runner
  }

  async function runScript({ deviceId, script, stepIndexes = null }) {
    if (!deviceId) {
      ElMessage.warning(window.t('automation.run.noDevice'))
      return false
    }

    if (!script?.steps?.length) {
      ElMessage.warning(window.t('automation.run.noSteps'))
      return false
    }

    const instance = getRunner()
    runnerStatus.value = RunnerStatus.RUNNING

    try {
      await instance.run({
        deviceId,
        steps: script.steps,
        vars: script.vars || {},
        stepIndexes,
        onLog: entry => appendLog(entry),
        onStepStart: ({ stepIndex }) => {
          runningStepIndex.value = stepIndex
        },
      })

      runnerStatus.value = RunnerStatus.IDLE
      runningStepIndex.value = -1
      appendLog({ level: 'success', message: window.t('automation.run.done') })
      ElMessage.success(window.t('automation.run.done'))
      return true
    }
    catch (error) {
      runnerStatus.value = instance.controller.status
      runningStepIndex.value = -1

      if (error?.message !== 'STOPPED') {
        appendLog({ level: 'error', message: window.t('automation.run.failed') })
        ElMessage.error(window.t('automation.run.failed'))
      }
      return false
    }
  }

  function pauseRun() {
    getRunner().pause()
    runnerStatus.value = RunnerStatus.PAUSED
    ElMessage.info(window.t('automation.run.paused'))
  }

  function resumeRun() {
    getRunner().resume()
    runnerStatus.value = RunnerStatus.RUNNING
    ElMessage.info(window.t('automation.run.resumed'))
  }

  function stopRun() {
    getRunner().stop()
    runnerStatus.value = RunnerStatus.STOPPED
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
    RunnerStatus,
    appendLog,
    clearLogs,
    runScript,
    pauseRun,
    resumeRun,
    stopRun,
    loadScriptById,
  }
})

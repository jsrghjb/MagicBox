import { buildTemplateSteps } from '$/utils/automation/templates.js'
import { downloadScriptJson, readScriptJsonFile } from '$/utils/automation/export-import.js'

/**
 * Run / record / AI / template / import / export actions for the automation editor.
 * Wraps Pinia store + ad-hoc UX (confirm, message) so two UIs can share it.
 */
export function useAutomationEditorRuns(ctx) {
  function openMacroRecorder(mode) {
    if (!ctx.deviceId?.value) {
      ElMessage.warning('请先连接并选择设备！')
      return
    }
    ctx.recorderMode.value = mode
    ctx.recorderVisible.value = true
  }

  async function handleMacroRecordConfirm(steps) {
    ctx.recorderVisible.value = false
    if (!steps?.length) {
      return
    }

    if (ctx.recorderMode.value === 'new') {
      try {
        const script = await ctx.createScript({
          deviceId: ctx.deviceId.value || 'common',
          name: `录制宏_${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
          steps,
          vars: {},
        })
        ctx.currentScript.value = { ...script }
        ctx.automationStore.selectedStepId = script.steps[0]?.id || null
        ElMessage.success('宏指令录制并创建成功！')
      }
      catch (e) {
        console.error(e)
        ElMessage.error(`创建脚本失败: ${e.message || String(e)}`)
      }
    }
    else if (ctx.recorderMode.value === 'append' && ctx.currentScript.value) {
      const currentSteps = ctx.currentScript.value.steps || []
      ctx.currentScript.value.steps = [...currentSteps, ...steps]
      ElMessage.success(`成功追加 ${steps.length} 个步骤到当前脚本！`)
    }
  }

  async function handleImportScript(file) {
    try {
      await ElMessageBox.confirm(window.t('automation.import.confirmReplace'), { type: 'warning' })
    }
    catch {
      return
    }
    try {
      const data = await readScriptJsonFile(file)
      if (!ctx.currentScript.value) {
        const script = await ctx.createScript({
          deviceId: ctx.deviceId?.value || 'common',
          name: data.name,
          steps: data.steps,
          vars: data.vars,
        })
        ctx.currentScript.value = { ...script }
      }
      else {
        ctx.currentScript.value = {
          ...ctx.currentScript.value,
          name: data.name,
          steps: data.steps,
          vars: data.vars,
        }
        await ctx.debouncedSave()
      }
      ElMessage.success(window.t('automation.import.success'))
    }
    catch (error) {
      console.error('Failed to import script:', error)
      ElMessage.error(error.message || String(error))
    }
  }

  async function handleExportScript() {
    if (!ctx.currentScript.value) {
      ElMessage.warning(window.t('automation.export.noScripts'))
      return
    }
    await downloadScriptJson(ctx.currentScript.value)
    ElMessage.success(window.t('automation.export.success'))
  }

  function handleApplyTemplate() {
    ctx.templateDialogVisible.value = true
  }

  function handleTemplateApply(templateId) {
    const { steps, vars } = buildTemplateSteps(templateId)
    if (!ctx.currentScript.value) {
      ctx.createScript({
        deviceId: ctx.deviceId?.value || 'common',
        name: window.t('automation.script.new'),
        steps,
        vars,
      }).then((script) => {
        ctx.currentScript.value = { ...script }
        ctx.automationStore.selectedStepId = script.steps[0]?.id || null
      }).catch((error) => {
        console.error('Failed to apply template script:', error)
        ElMessage.error(error.message || String(error))
      })
    }
    else {
      ctx.currentScript.value = { ...ctx.currentScript.value, steps, vars }
    }
    ctx.templateDialogVisible.value = false
  }

  function handleAiGenerate() {
    ctx.aiDialogVisible.value = true
  }

  async function handleAiApply(generated) {
    ctx.aiDialogVisible.value = false
    try {
      const script = await ctx.createScript({
        deviceId: ctx.deviceId?.value || 'common',
        name: generated.name || `${window.t('automation.script.new')} ${ctx.scripts.value.length + 1}`,
        steps: generated.steps,
        vars: generated.vars || {},
      })
      ctx.currentScript.value = { ...script }
      ctx.automationStore.selectedStepId = script.steps[0]?.id || null
      ElMessage.success(window.t('automation.ai.applied'))
    }
    catch (error) {
      console.error('Failed to apply AI script:', error)
      ElMessage.error(`${window.t('automation.ai.error.failed')}: ${error.message || error}`)
    }
  }

  async function handleRunAll() {
    if (!ctx.deviceId?.value) {
      ElMessage.warning('请选择要执行脚本的设备！')
      return
    }
    ctx.automationStore.clearLogs()
    await ctx.automationStore.runScript({
      deviceId: ctx.deviceId.value,
      script: ctx.currentScript.value,
    })
  }

  async function handleRunSingleStep() {
    if (!ctx.selectedStep.value || !ctx.currentScript.value) {
      return
    }
    if (!ctx.deviceId?.value) {
      ElMessage.warning('请选择要执行脚本的设备！')
      return
    }
    const stepIndex = ctx.currentScript.value.steps.findIndex(step => step.id === ctx.selectedStep.value.id)
    ctx.automationStore.clearLogs()
    await ctx.automationStore.runScript({
      deviceId: ctx.deviceId.value,
      script: ctx.currentScript.value,
      stepIndexes: [stepIndex],
    })
  }

  async function handleRunSelected() {
    if (!ctx.selectedStepIds.value.length || !ctx.currentScript.value) {
      return
    }
    if (!ctx.deviceId?.value) {
      ElMessage.warning('请选择要执行脚本的设备！')
      return
    }
    const selectedId = ctx.selectedStepIds.value[0]
    const startIndex = ctx.currentScript.value.steps.findIndex(step => step.id === selectedId)
    if (startIndex < 0) {
      return
    }
    const indexes = []
    for (let i = startIndex; i < ctx.currentScript.value.steps.length; i++) {
      indexes.push(i)
    }
    ctx.automationStore.clearLogs()
    await ctx.automationStore.runScript({
      deviceId: ctx.deviceId.value,
      script: ctx.currentScript.value,
      stepIndexes: indexes,
    })
  }

  return {
    openMacroRecorder,
    handleMacroRecordConfirm,
    handleImportScript,
    handleExportScript,
    handleApplyTemplate,
    handleTemplateApply,
    handleAiGenerate,
    handleAiApply,
    handleRunAll,
    handleRunSingleStep,
    handleRunSelected,
  }
}

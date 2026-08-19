import { AUTOMATION_TEMPLATES, buildTemplateSteps } from '$/utils/automation/templates.js'
import { downloadScriptJson, readScriptJsonFile } from '$/utils/automation/export-import.js'
import { useLicenseStore } from '$/store/license/index.js'
import { useDeviceStore } from '$/store/device/index.js'

/**
 * Run / record / AI / template / import / export actions for the automation editor.
 * Wraps Pinia store + ad-hoc UX (confirm, message) so two UIs can share it.
 */
export function useAutomationEditorRuns(ctx) {
  const licenseStore = useLicenseStore()
  const deviceStore = useDeviceStore()
  function openMacroRecorder(mode) {
    if (!ctx.deviceId?.value) {
      ElMessage.warning('请先连接并选择设备！')
      return
    }
    ctx.recorderMode.value = mode
    ctx.recorderVisible.value = true
  }

  async function handleMacroRecordConfirm(steps, deviceResolution) {
    ctx.recorderVisible.value = false
    if (!steps?.length) {
      return
    }

    const refWidth = deviceResolution?.width || 1080
    const refHeight = deviceResolution?.height || 1920

    if (ctx.recorderMode.value === 'new') {
      try {
        const script = await ctx.createScript({
          deviceId: ctx.deviceId.value || 'common',
          name: `录制宏_${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
          steps,
          vars: {},
          referenceScreenWidth: refWidth,
          referenceScreenHeight: refHeight,
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
      if (refWidth && refHeight) {
        ctx.currentScript.value.referenceScreenWidth = refWidth
        ctx.currentScript.value.referenceScreenHeight = refHeight
      }
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
          referenceScreenWidth: data.referenceScreenWidth || 1080,
          referenceScreenHeight: data.referenceScreenHeight || 1920,
        })
        ctx.currentScript.value = { ...script }
      }
      else {
        ctx.currentScript.value = {
          ...ctx.currentScript.value,
          name: data.name,
          steps: data.steps,
          vars: data.vars,
          referenceScreenWidth: data.referenceScreenWidth || 1080,
          referenceScreenHeight: data.referenceScreenHeight || 1920,
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
    const template = AUTOMATION_TEMPLATES.find(t => t.id === templateId)
    const { steps, vars, category, referenceScreenWidth, referenceScreenHeight } = buildTemplateSteps(templateId)
    const scriptName = template ? template.name : window.t('automation.script.new')
    if (!ctx.currentScript.value) {
      ctx.createScript({
        deviceId: ctx.deviceId?.value || 'common',
        name: scriptName,
        category: category || 'general',
        steps,
        vars,
        referenceScreenWidth,
        referenceScreenHeight,
      }).then((script) => {
        ctx.currentScript.value = { ...script }
        ctx.automationStore.selectedStepId = script.steps[0]?.id || null
      }).catch((error) => {
        console.error('Failed to apply template script:', error)
        ElMessage.error(error.message || String(error))
      })
    }
    else {
      ctx.currentScript.value = { ...ctx.currentScript.value, name: scriptName, category: category || 'general', steps, vars, referenceScreenWidth, referenceScreenHeight }
    }
    ctx.templateDialogVisible.value = false
    ElMessage.success(`成功应用内置平台预设脚本 [${scriptName}]！`)
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
        referenceScreenWidth: generated.referenceScreenWidth || 1080,
        referenceScreenHeight: generated.referenceScreenHeight || 1920,
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

  function resolveExecutionDevice() {
    const rawDev = ctx.deviceId?.value
    const activeDev = deviceStore.resolveActiveDevice(rawDev)
    const onlineDev = deviceStore.list.find(d => d.id === activeDev && d.status === 'device')
    if (onlineDev) {
      return onlineDev.id
    }
    const anyOnline = deviceStore.list.find(d => d.status === 'device')
    if (anyOnline) {
      return anyOnline.id
    }
    return null
  }

  async function handleRunAll() {
    await deviceStore.getList()
    const targetDev = resolveExecutionDevice()
    if (!targetDev) {
      ElMessage.warning('当前没有在线连接的设备，请先连接手机或开启 USB 调试！')
      return
    }
    ctx.automationStore.clearLogs()
    await ctx.automationStore.runScript({
      deviceId: targetDev,
      script: ctx.currentScript.value,
    })
  }

  async function handleRunSingleStep() {
    if (!ctx.selectedStep.value || !ctx.currentScript.value) {
      return
    }
    await deviceStore.getList()
    const targetDev = resolveExecutionDevice()
    if (!targetDev) {
      ElMessage.warning('当前没有在线连接的设备，请先连接手机或开启 USB 调试！')
      return
    }
    const stepIndex = ctx.currentScript.value.steps.findIndex(step => step.id === ctx.selectedStep.value.id)
    ctx.automationStore.clearLogs()
    await ctx.automationStore.runScript({
      deviceId: targetDev,
      script: ctx.currentScript.value,
      stepIndexes: [stepIndex],
    })
  }

  async function handleRunSelected() {
    if (!ctx.selectedStepIds.value.length || !ctx.currentScript.value) {
      return
    }
    await deviceStore.getList()
    const targetDev = resolveExecutionDevice()
    if (!targetDev) {
      ElMessage.warning('当前没有在线连接的设备，请先连接手机或开启 USB 调试！')
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
      deviceId: targetDev,
      script: ctx.currentScript.value,
      stepIndexes: indexes,
    })
  }

  async function handleResumeFromBreakpoint() {
    if (!ctx.currentScript.value) {
      return
    }
    await deviceStore.getList()
    const targetDev = resolveExecutionDevice()
    if (!targetDev) {
      ElMessage.warning('当前没有在线连接的设备，请先连接手机或开启 USB 调试！')
      return
    }
    const cat = ctx.currentScript.value?.category || 'general'
    if (!licenseStore.checkCategoryAccess(cat)) {
      licenseStore.openUpgradeModal(cat)
      return
    }
    ctx.automationStore.clearLogs()
    await ctx.automationStore.resumeFromBreakpoint({
      deviceId: ctx.deviceId.value,
      script: ctx.currentScript.value,
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
    handleResumeFromBreakpoint,
  }
}

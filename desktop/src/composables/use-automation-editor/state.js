import { useDebounceFn } from '@vueuse/core'
import { useAutomationStore } from '$/store/automation/index.js'
import { useAutomationScripts } from '$/database/index.js'
import { RunnerStatus } from '$/utils/automation/runner-status.js'

/**
 * Reactive state holders shared between automation editor UIs.
 * - currentScript / selectedStepIds / recorder / dialogs
 * - computed helpers (selectedStep, isRunning)
 * - debounced auto-save hook
 */
export function useAutomationEditorState(deviceIdRef) {
  const automationStore = useAutomationStore()
  const { scripts, createScript, updateScript, removeScript } = useAutomationScripts(deviceIdRef)

  const currentScript = ref(null)
  const selectedStepIds = ref([])
  const templateDialogVisible = ref(false)
  const batchDialogVisible = ref(false)
  const aiDialogVisible = ref(false)
  const recorderVisible = ref(false)
  const recorderMode = ref('new')

  const isRunning = computed(() => automationStore.runnerStatus === RunnerStatus.RUNNING)

  const selectedStep = computed(() => {
    if (!currentScript.value?.steps?.length || !automationStore.selectedStepId) {
      return null
    }
    return currentScript.value.steps.find(step => step.id === automationStore.selectedStepId) || null
  })

  const debouncedSave = useDebounceFn(async () => {
    if (!currentScript.value?.id) {
      return
    }
    await updateScript(currentScript.value.id, {
      name: currentScript.value.name,
      deviceId: currentScript.value.deviceId || 'common',
      category: currentScript.value.category || 'general',
      steps: currentScript.value.steps,
      vars: currentScript.value.vars,
      referenceScreenWidth: currentScript.value.referenceScreenWidth,
      referenceScreenHeight: currentScript.value.referenceScreenHeight,
    })
  }, 300)

  watch(
    () => [
      currentScript.value?.name,
      currentScript.value?.deviceId,
      currentScript.value?.category,
      currentScript.value?.steps,
      currentScript.value?.vars,
      currentScript.value?.referenceScreenWidth,
      currentScript.value?.referenceScreenHeight,
    ],
    () => {
      if (currentScript.value?.id && currentScript.value?.name) {
        const item = scripts.value.find(s => s.id === currentScript.value.id)
        if (item && item.name !== currentScript.value.name) {
          item.name = currentScript.value.name
        }
      }
      debouncedSave()
    },
    { deep: true },
  )

  return {
    automationStore,
    scripts,
    currentScript,
    selectedStepIds,
    templateDialogVisible,
    batchDialogVisible,
    aiDialogVisible,
    recorderVisible,
    recorderMode,
    isRunning,
    selectedStep,
    createScript,
    updateScript,
    removeScript,
    debouncedSave,
  }
}

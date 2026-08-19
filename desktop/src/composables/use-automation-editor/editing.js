import { createDefaultStep } from '$/utils/automation/step-types.js'

/**
 * Step/script editing actions. Pure mutation of currentScript.
 * Persistence is handled by the auto-save watcher in state.js.
 */
export function useAutomationEditorActions(ctx) {
  function handleCreateScript(extra = {}) {
    return ctx.createScript({
      deviceId: extra.deviceId || 'common',
      category: extra.category || 'general',
      name: extra.name || `${window.t('automation.script.new')} ${ctx.scripts.value.length + 1}`,
      steps: [createDefaultStep('wait')],
      vars: {},
    }).then((script) => {
      ctx.currentScript.value = { ...script }
      ctx.automationStore.selectedStepId = script.steps[0]?.id || null
      return script
    })
  }

  function handleSelectScript(script) {
    if (!script) {
      ctx.currentScript.value = null
      ctx.automationStore.currentScriptId = null
      ctx.automationStore.selectedStepId = null
      ctx.selectedStepIds.value = []
      return
    }
    ctx.currentScript.value = { ...script }
    ctx.automationStore.currentScriptId = script.id
    ctx.automationStore.selectedStepId = script.steps?.[0]?.id || null
    ctx.selectedStepIds.value = script.steps?.[0]?.id ? [script.steps[0].id] : []
  }

  async function handleDeleteScript(script) {
    try {
      await ElMessageBox.confirm(window.t('automation.script.confirmDelete'), { type: 'warning' })
    }
    catch {
      return
    }
    await ctx.removeScript(script.id)
    if (ctx.currentScript.value?.id === script.id) {
      ctx.currentScript.value = null
      ctx.automationStore.selectedStepId = null
    }
  }

  function handleSelectStep(step) {
    ctx.automationStore.selectedStepId = step.id
    ctx.selectedStepIds.value = [step.id]
  }

  function handleAddStep(type = 'tap') {
    if (!ctx.currentScript.value) {
      return
    }
    const step = createDefaultStep(type)
    ctx.currentScript.value.steps.push(step)
    if (type === 'if' || type === 'loop') {
      const endStep = createDefaultStep('end')
      ctx.currentScript.value.steps.push(endStep)
    }
    ctx.automationStore.selectedStepId = step.id
  }

  function handleRemoveStep(stepId) {
    if (!ctx.currentScript.value) {
      return
    }
    const steps = ctx.currentScript.value.steps
    const index = steps.findIndex(step => step.id === stepId)
    if (index < 0) {
      return
    }
    const step = steps[index]
    if (step.type === 'if' || step.type === 'loop') {
      const endIndex = findMatchingEndIndex(steps, index)
      if (endIndex !== -1) {
        ctx.currentScript.value.steps = steps.filter((_, i) => i < index || i > endIndex)
      }
      else {
        ctx.currentScript.value.steps = steps.filter(s => s.id !== stepId)
      }
    }
    else if (step.type === 'end') {
      const parentIndex = findMatchingParentIndex(steps, index)
      if (parentIndex !== -1) {
        ctx.currentScript.value.steps = steps.filter((_, i) => i < parentIndex || i > index)
      }
      else {
        ctx.currentScript.value.steps = steps.filter(s => s.id !== stepId)
      }
    }
    else {
      ctx.currentScript.value.steps = steps.filter(s => s.id !== stepId)
    }

    if (ctx.automationStore.selectedStepId === stepId) {
      ctx.automationStore.selectedStepId = ctx.currentScript.value.steps[0]?.id || null
    }
  }

  function handleMoveStepUp(stepId) {
    return moveStep(ctx, stepId, -1)
  }

  function handleMoveStepDown(stepId) {
    return moveStep(ctx, stepId, 1)
  }

  function handleReorderSteps({ from, to }) {
    if (!ctx.currentScript.value) {
      return
    }
    const steps = [...ctx.currentScript.value.steps]
    const step = steps[from]
    if (step && (step.type === 'if' || step.type === 'loop')) {
      const endIndex = findMatchingEndIndex(steps, from)
      if (endIndex !== -1) {
        const slice = steps.splice(from, endIndex - from + 1)
        let insertIndex = to
        if (to > from) {
          insertIndex = to - slice.length + 1
        }
        steps.splice(insertIndex, 0, ...slice)
        ctx.currentScript.value.steps = steps
        return
      }
    }
    const [removed] = steps.splice(from, 1)
    steps.splice(to, 0, removed)
    ctx.currentScript.value.steps = steps
  }

  function handleInsertStepBefore(stepId) {
    return insertStepNear(ctx, stepId, 'before')
  }

  function handleInsertStepAfter(stepId) {
    return insertStepNear(ctx, stepId, 'after')
  }

  function handleUpdateStep(patch) {
    if (!ctx.selectedStep.value || !ctx.currentScript.value) {
      return
    }
    const index = ctx.currentScript.value.steps.findIndex(step => step.id === ctx.selectedStep.value.id)
    if (index < 0) {
      return
    }
    const oldType = ctx.currentScript.value.steps[index].type
    ctx.currentScript.value.steps[index] = {
      ...ctx.currentScript.value.steps[index],
      ...patch,
    }
    if (patch.type && patch.type !== oldType && (patch.type === 'if' || patch.type === 'loop')) {
      const endStep = createDefaultStep('end')
      ctx.currentScript.value.steps.splice(index + 1, 0, endStep)
    }
  }

  function handleUpdateVars(vars) {
    if (!ctx.currentScript.value) {
      return
    }
    ctx.currentScript.value.vars = vars
  }

  return {
    handleCreateScript,
    handleSelectScript,
    handleDeleteScript,
    handleSelectStep,
    handleAddStep,
    handleRemoveStep,
    handleMoveStepUp,
    handleMoveStepDown,
    handleReorderSteps,
    handleInsertStepBefore,
    handleInsertStepAfter,
    handleUpdateStep,
    handleUpdateVars,
  }
}

function findMatchingEndIndex(steps, startIndex) {
  const startStep = steps[startIndex]
  if (!startStep || (startStep.type !== 'if' && startStep.type !== 'loop')) {
    return -1
  }
  let depth = 1
  for (let i = startIndex + 1; i < steps.length; i++) {
    const type = steps[i].type
    if (type === 'if' || type === 'loop') {
      depth++
    }
    else if (type === 'end') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

function findMatchingParentIndex(steps, endIndex) {
  const endStep = steps[endIndex]
  if (!endStep || endStep.type !== 'end') {
    return -1
  }
  let depth = 1
  for (let i = endIndex - 1; i >= 0; i--) {
    const type = steps[i].type
    if (type === 'end') {
      depth++
    }
    else if (type === 'if' || type === 'loop') {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

function moveStep(ctx, stepId, direction) {
  const steps = ctx.currentScript.value?.steps || []
  const index = steps.findIndex(step => step.id === stepId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= steps.length) {
    return
  }
  const copy = [...steps]
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item)
  ctx.currentScript.value.steps = copy
}

function insertStepNear(ctx, stepId, position, type = 'wait') {
  const steps = ctx.currentScript.value?.steps || []
  const index = steps.findIndex(step => step.id === stepId)
  if (index < 0) {
    return
  }
  const step = createDefaultStep(type)
  const copy = [...steps]
  const insertIndex = position === 'before' ? index : index + 1
  copy.splice(insertIndex, 0, step)
  if (type === 'if' || type === 'loop') {
    const endStep = createDefaultStep('end')
    copy.splice(insertIndex + 1, 0, endStep)
  }
  ctx.currentScript.value.steps = copy
  ctx.automationStore.selectedStepId = step.id
}

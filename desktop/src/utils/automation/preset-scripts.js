import { tMaybe } from './step-types.js'
import { AUTOMATION_TEMPLATES } from './templates.js'

export const PRESET_ID_PREFIX = 'preset_'

export const SCRIPT_SOURCE = {
  PRESET: 'preset',
  CUSTOM: 'custom',
}

export function getPresetScriptId(templateId) {
  return `${PRESET_ID_PREFIX}${templateId}`
}

export function isPresetScript(script) {
  if (!script) {
    return false
  }

  if (script.source === SCRIPT_SOURCE.CUSTOM) {
    return false
  }

  if (script.source === SCRIPT_SOURCE.PRESET) {
    return true
  }

  return typeof script.id === 'string' && script.id.startsWith(PRESET_ID_PREFIX)
}

export function isLegacyPresetId(scriptId, templateId) {
  const stableId = getPresetScriptId(templateId)
  return typeof scriptId === 'string' && scriptId.startsWith(`${stableId}_`)
}

function buildStepFingerprint(steps = []) {
  return steps.map(step => step.type).join('>')
}

export function getTemplateForScript(script) {
  if (!script) {
    return null
  }

  const byId = AUTOMATION_TEMPLATES.find((tmpl) => {
    return script.id === getPresetScriptId(tmpl.id) || isLegacyPresetId(script.id, tmpl.id)
  })
  if (byId) {
    return byId
  }

  return AUTOMATION_TEMPLATES.find(tmpl => scriptBelongsToTemplate(script, tmpl)) || null
}

export function scriptBelongsToTemplate(script, tmpl) {
  if (!script || !tmpl) {
    return false
  }

  const stableId = getPresetScriptId(tmpl.id)
  if (script.id === stableId || isLegacyPresetId(script.id, tmpl.id)) {
    return true
  }

  if (script.name === tmpl.name) {
    return true
  }

  const translatedName = tMaybe(tmpl.name)
  if (script.name && translatedName && script.name === translatedName) {
    return true
  }

  const scriptSteps = script.steps || []
  const templateSteps = tmpl.buildSteps()
  if (!scriptSteps.length || !templateSteps.length) {
    return false
  }

  return buildStepFingerprint(scriptSteps) === buildStepFingerprint(templateSteps)
}

export function getScriptDisplayName(script) {
  if (!script) {
    return ''
  }

  if (script.name && !script.name.startsWith('automation.')) {
    return script.name
  }

  const translatedName = tMaybe(script.name)
  if (translatedName && !translatedName.startsWith('automation.')) {
    return translatedName
  }

  const tmpl = getTemplateForScript(script)
  if (tmpl) {
    const presetName = tMaybe(tmpl.name)
    if (presetName && !presetName.startsWith('automation.')) {
      return presetName
    }
  }

  return translatedName || script.name || ''
}

export function getOfficialPresetBadgeLabel() {
  const label = tMaybe('automation.script.preset.badge')
  if (label && !label.startsWith('automation.')) {
    return label
  }
  return '官方'
}

export const getPresetBadgeLabel = getOfficialPresetBadgeLabel

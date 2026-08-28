/**
 * Automation composables - Vue reactive hooks for scripts.
 */

import { liveQuery } from 'dexie'
import { db } from '$/database/core/database.js'
import { automationDataStore } from './store.js'

import { AUTOMATION_TEMPLATES } from '$/utils/automation/templates.js'
import {
  getPresetScriptId,
  isPresetScript,
  SCRIPT_SOURCE,
  scriptBelongsToTemplate,
} from '$/utils/automation/preset-scripts.js'

const VALID_CATEGORIES = new Set(['general', 'social', 'media', 'ecommerce', 'game', 'system', 'custom'])

function normalizeCategory(cat) {
  if (!cat || !VALID_CATEGORIES.has(cat)) {
    return 'general'
  }
  return cat
}

function buildPresetRecord(tmpl, { now = Date.now(), idx = 0 } = {}) {
  return {
    id: getPresetScriptId(tmpl.id),
    source: SCRIPT_SOURCE.PRESET,
    deviceId: 'common',
    name: tmpl.name,
    category: tmpl.category || 'general',
    steps: tmpl.buildSteps(),
    vars: tmpl.vars || {},
    schemaVersion: 2,
    referenceScreenWidth: 1080,
    referenceScreenHeight: 1920,
    createdAt: now + idx * 100,
    updatedAt: now + idx * 100,
  }
}

/**
 * Merge duplicate official presets and keep user-edited records.
 */
async function syncOfficialPresets() {
  try {
    let existing = await db.automation_scripts.toArray()

    for (const tmpl of AUTOMATION_TEMPLATES) {
      const stableId = getPresetScriptId(tmpl.id)
      const matched = existing.filter(script => scriptBelongsToTemplate(script, tmpl))
      if (!matched.length) {
        continue
      }

      const keeper = matched.find(script => script.id === stableId)
        || matched.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]

      const nextRecord = {
        ...keeper,
        id: stableId,
        source: SCRIPT_SOURCE.PRESET,
        deviceId: keeper.deviceId || 'common',
        category: keeper.category || tmpl.category || 'general',
        updatedAt: keeper.updatedAt || Date.now(),
      }

      await db.automation_scripts.put(nextRecord)

      const idsToDelete = matched
        .filter(script => script.id !== stableId)
        .map(script => script.id)

      if (keeper.id !== stableId) {
        idsToDelete.push(keeper.id)
      }

      if (idsToDelete.length > 0) {
        await db.automation_scripts.bulkDelete(idsToDelete)
      }
    }

    existing = await db.automation_scripts.toArray()
    const existingIds = new Set(existing.map(s => s.id))

    const missingTemplates = AUTOMATION_TEMPLATES.filter((tmpl) => {
      const stableId = getPresetScriptId(tmpl.id)
      if (existingIds.has(stableId)) {
        return false
      }
      return !existing.some(script => scriptBelongsToTemplate(script, tmpl))
    })

    if (missingTemplates.length > 0) {
      const now = Date.now()
      const defaultList = missingTemplates.map((tmpl, idx) => buildPresetRecord(tmpl, { now, idx }))
      await db.automation_scripts.bulkAdd(defaultList)
      console.log(`[automation] Added ${defaultList.length} new official preset script(s).`)
    }

    const refreshed = await db.automation_scripts.toArray()
    const staleRecords = refreshed.filter((script) => {
      if (script.source === SCRIPT_SOURCE.CUSTOM) {
        return false
      }
      if (!isPresetScript(script)) {
        return false
      }
      return !AUTOMATION_TEMPLATES.some(tmpl => getPresetScriptId(tmpl.id) === script.id)
    })

    if (staleRecords.length > 0) {
      await db.automation_scripts.bulkUpdate(staleRecords.map(script => ({
        ...script,
        source: SCRIPT_SOURCE.CUSTOM,
      })))
    }
  }
  catch (err) {
    console.warn('[automation] Failed to sync official preset scripts:', err)
  }
}

syncOfficialPresets().catch(() => {})

export function useAutomationScripts(deviceIdRef) {
  const scripts = ref([])
  const loading = ref(false)
  const error = ref(null)

  let subscription = null

  const subscribe = () => {
    syncOfficialPresets().catch(() => {})

    subscription?.unsubscribe()
    subscription = null

    loading.value = true
    error.value = null

    subscription = liveQuery(async () => {
      const records = await db.automation_scripts.toArray()
      return records
        .map(r => ({
          ...r,
          category: normalizeCategory(r.category),
          source: isPresetScript(r) ? SCRIPT_SOURCE.PRESET : SCRIPT_SOURCE.CUSTOM,
        }))
        .sort((a, b) => {
          const sourceOrder = Number(isPresetScript(b)) - Number(isPresetScript(a))
          if (sourceOrder !== 0) {
            return sourceOrder
          }
          return (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id))
        })
    }).subscribe({
      next(value) {
        scripts.value = value || []
        loading.value = false
        if (!value || value.length === 0) {
          syncOfficialPresets().catch(() => {})
        }
      },
      error(err) {
        console.error('[useAutomationScripts] Subscribe error:', err)
        error.value = err
        loading.value = false
      },
    })
  }

  subscribe()

  if (typeof deviceIdRef === 'object' && deviceIdRef !== null && 'value' in deviceIdRef) {
    watch(deviceIdRef, () => subscribe())
  }

  onUnmounted(() => {
    subscription?.unsubscribe()
    subscription = null
  })

  async function createScript(data = {}) {
    const dId = data.deviceId || 'common'
    const rawData = JSON.parse(
      JSON.stringify({
        category: 'general',
        source: SCRIPT_SOURCE.CUSTOM,
        ...data,
        deviceId: dId,
      }),
    )
    const result = await automationDataStore.createScript(rawData)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to create script')
    }
    return result.data
  }

  async function updateScript(id, patch) {
    const existing = await db.automation_scripts.get(id)
    const rawPatch = JSON.parse(JSON.stringify(patch))

    if (isPresetScript(existing) && rawPatch.category !== undefined) {
      delete rawPatch.category
    }

    const result = await automationDataStore.updateScript(id, rawPatch)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to update script')
    }
    return result.data
  }

  async function removeScript(id) {
    const existing = await db.automation_scripts.get(id)
    if (isPresetScript(existing)) {
      throw new Error(window.t?.('automation.script.preset.cannotDelete') || '官方预置脚本不可删除')
    }

    const result = await automationDataStore.deleteById(id)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to delete script')
    }
  }

  async function getScriptById(id) {
    const result = await automationDataStore.getById(id)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to get script')
    }
    return result.data
  }

  return {
    scripts,
    loading,
    error,
    createScript,
    updateScript,
    removeScript,
    getScriptById,
  }
}

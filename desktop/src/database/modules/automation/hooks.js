/**
 * Automation composables - Vue reactive hooks for scripts.
 */

import { liveQuery } from 'dexie'
import { db } from '$/database/core/database.js'
import { automationDataStore } from './store.js'

import { AUTOMATION_TEMPLATES } from '$/utils/automation/templates.js'

const VALID_CATEGORIES = new Set(['general', 'social', 'media', 'ecommerce', 'game', 'system', 'custom'])

function normalizeCategory(cat) {
  if (!cat || !VALID_CATEGORIES.has(cat)) {
    return 'general'
  }
  return cat
}

async function ensureDefaultScripts() {
  try {
    const existing = await db.automation_scripts.toArray()
    const existingNames = new Set(existing.map(s => s.name))
    const missingTemplates = AUTOMATION_TEMPLATES.filter(tmpl => !existingNames.has(tmpl.name))
    if (missingTemplates.length > 0) {
      const now = Date.now()
      const defaultList = missingTemplates.map((tmpl, idx) => ({
        id: `preset_${tmpl.id}_${now}_${idx}`,
        deviceId: 'common',
        name: tmpl.name,
        category: 'general',
        steps: tmpl.buildSteps(),
        vars: tmpl.vars || {},
        schemaVersion: 2,
        referenceScreenWidth: 1080,
        referenceScreenHeight: 1920,
        createdAt: now + idx * 100,
        updatedAt: now + idx * 100,
      }))
      await db.automation_scripts.bulkAdd(defaultList)
    }
  }
  catch (err) {
    console.warn('[ensureDefaultScripts] Failed to seed default templates:', err)
  }
}

ensureDefaultScripts().catch(() => {})

export function useAutomationScripts(deviceIdRef) {
  const scripts = ref([])
  const loading = ref(false)
  const error = ref(null)

  let subscription = null

  const getDeviceId = () => {
    if (typeof deviceIdRef === 'object' && deviceIdRef !== null && 'value' in deviceIdRef) {
      return deviceIdRef.value
    }
    return deviceIdRef
  }

  const subscribe = () => {
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
        }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)))
    }).subscribe({
      next(value) {
        scripts.value = value || []
        loading.value = false
        if (!value || value.length === 0) {
          ensureDefaultScripts().catch(() => {})
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
    const rawPatch = JSON.parse(JSON.stringify(patch))
    const result = await automationDataStore.updateScript(id, rawPatch)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to update script')
    }
    return result.data
  }

  async function removeScript(id) {
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

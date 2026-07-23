/**
 * Automation composables - Vue reactive hooks for scripts.
 */

import { liveQuery } from 'dexie'
import { db } from '$/database/core/database.js'
import { automationDataStore } from './store.js'

export function useAutomationScripts(deviceIdRef) {
  const scripts = shallowRef([])
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

    const deviceId = getDeviceId()
    const queryIds = ['common', '']
    if (deviceId) {
      queryIds.push(deviceId)
    }

    loading.value = true
    error.value = null

    subscription = liveQuery(async () => {
      return db.automation_scripts
        .where('deviceId')
        .anyOf(queryIds)
        .toArray()
        .then(records => records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))
    }).subscribe({
      next(value) {
        scripts.value = value || []
        loading.value = false
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
    const dId = data.deviceId || getDeviceId() || 'common'
    const rawData = JSON.parse(
      JSON.stringify({
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

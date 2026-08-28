import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useLicenseStore = defineStore('license', () => {
  const activated = ref(false)
  const tier = ref('free') // 'free' | 'personal' | 'team'
  const deviceLimit = ref(2)
  const allowedCategories = ref(['general'])
  const customCategoryLimit = ref(0)
  const machineId = ref('')
  const activeKey = ref('')
  const expiryDate = ref('')

  // UI state for PLG Hook Upgrade Modal
  const upgradeModalVisible = ref(false)
  const upgradeTargetCategory = ref('')

  const isFree = computed(() => tier.value === 'free')
  const isPersonal = computed(() => tier.value === 'personal')
  const isTeam = computed(() => tier.value === 'team')

  async function fetchStatus() {
    try {
      if (window.$preload?.ipcRenderer) {
        const res = await window.$preload.ipcRenderer.invoke('license:status')
        if (res) {
          activated.value = !!res.activated
          tier.value = res.tier || 'free'
          deviceLimit.value = Number(res.deviceLimit || 2)
          allowedCategories.value = res.allowedCategories || ['general']
          customCategoryLimit.value = Number(res.customCategoryLimit || 0)
          machineId.value = res.machineId || ''
          activeKey.value = res.activeKey || ''
          expiryDate.value = res.expiryDate || ''
        }
      }
    }
    catch (err) {
      console.warn('fetchStatus license warning:', err)
    }
  }

  // Listen for broadcasted license update events across all windows
  if (window.$preload?.ipcRenderer) {
    window.$preload.ipcRenderer.on('license:updated', () => {
      fetchStatus()
    })
  }

  async function activateKey(licenseKey) {
    if (!window.$preload?.ipcRenderer) {
      return { success: false, error: '环境不支持 IPC' }
    }
    const res = await window.$preload.ipcRenderer.invoke('license:activate', { licenseKey })
    if (res?.success) {
      await fetchStatus()
    }
    return res
  }

  async function deactivateKey() {
    if (!window.$preload?.ipcRenderer) {
      return { success: false, error: '环境不支持 IPC' }
    }
    const res = await window.$preload.ipcRenderer.invoke('license:deactivate')
    await fetchStatus()
    return res
  }

  function checkCategoryAccess(categoryId) {
    const category = categoryId || 'general'
    const allowed = allowedCategories.value || ['general']
    if (allowed.includes('*')) {
      return true
    }
    return allowed.includes(category)
  }

  function checkDeviceLimit(currentCount) {
    return currentCount < deviceLimit.value
  }

  function openUpgradeModal(category = '') {
    upgradeTargetCategory.value = category
    upgradeModalVisible.value = true
  }

  function closeUpgradeModal() {
    upgradeModalVisible.value = false
    upgradeTargetCategory.value = ''
  }

  return {
    activated,
    tier,
    deviceLimit,
    allowedCategories,
    customCategoryLimit,
    machineId,
    activeKey,
    expiryDate,
    upgradeModalVisible,
    upgradeTargetCategory,
    isFree,
    isPersonal,
    isTeam,
    fetchStatus,
    activateKey,
    deactivateKey,
    checkCategoryAccess,
    checkDeviceLimit,
    openUpgradeModal,
    closeUpgradeModal,
  }
})

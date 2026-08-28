import { defineStore } from 'pinia'

export const useLicenseStore = defineStore('license', () => {
  const activated = ref(true)
  const tier = ref('unlimited')
  const deviceLimit = ref(0)
  const allowedCategories = ref(['*'])
  const customCategoryLimit = ref(999)
  const machineId = ref('')
  const activeKey = ref('')
  const expiryDate = ref('')
  const upgradeModalVisible = ref(false)
  const upgradeTargetCategory = ref('')

  const isFree = computed(() => false)
  const isPersonal = computed(() => false)
  const isTeam = computed(() => false)

  async function fetchStatus() {
    return {
      activated: true,
      tier: 'unlimited',
      deviceLimit: 0,
    }
  }

  async function activateKey() {
    return { success: true }
  }

  async function deactivateKey() {
    return { success: true }
  }

  function checkCategoryAccess() {
    return true
  }

  function checkDeviceLimit() {
    return true
  }

  function openUpgradeModal() {}

  function closeUpgradeModal() {
    upgradeModalVisible.value = false
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

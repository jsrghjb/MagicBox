<template>
  <el-button
    type="primary"
    text
    :loading="loading"
    :icon="loading ? '' : 'Connection'"
    :title="loading ? $t('common.connecting') : $t('device.wireless.connect.name')"
    @click="handleClick(device)"
  >
  </el-button>
</template>

<script setup>
import { useDeviceStore } from '$/store/device'
import { useLicenseStore } from '$/store/license'

const props = defineProps({
  device: {
    type: Object,
    default: () => ({}),
  },
  handleConnect: {
    type: Function,
    default: () => false,
  },
})

const deviceStore = useDeviceStore()
const licenseStore = useLicenseStore()
const loading = ref(false)

async function handleClick(device) {
  const onlineCount = deviceStore.list.filter(d => d.status === 'device').length
  if (!licenseStore.checkDeviceLimit(onlineCount)) {
    licenseStore.openUpgradeModal()
    return
  }

  loading.value = true

  await props.handleConnect(device.id)

  loading.value = false
}
</script>

<style></style>

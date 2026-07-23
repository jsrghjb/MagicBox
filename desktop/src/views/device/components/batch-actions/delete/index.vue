<template>
  <slot v-bind="{ loading, trigger: handleClick }" />
</template>

<script setup>
import { removeDevices } from '$/utils/device/index.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
})

const loading = ref(false)

const deviceStore = useDeviceStore()

async function handleClick(devices) {
  const usbDevices = devices.filter(d => !d.wifi && d.status !== 'offline')
  const deletableDevices = devices.filter(d => d.wifi || d.status === 'offline')

  let targets = devices

  if (usbDevices.length > 0) {
    if (deletableDevices.length === 0) {
      try {
        await ElMessageBox.alert(
          window.t('device.remove.usb.warning'),
          window.t('common.tips'),
          {
            type: 'warning',
          },
        )
      }
      catch (error) {}
      return false
    }
    else {
      try {
        await ElMessageBox.confirm(
          window.t('device.remove.mixed.confirm'),
          window.t('common.tips'),
          {
            type: 'warning',
          },
        )
        targets = deletableDevices
      }
      catch (error) {
        return false
      }
    }
  }
  else {
    try {
      await ElMessageBox.confirm(
        window.t('device.remove.confirm'),
        window.t('common.tips'),
        {
          type: 'warning',
        },
      )
    }
    catch (error) {
      return false
    }
  }

  loading.value = true

  await removeDevices(...targets)
  await deviceStore.getList()

  loading.value = false
}
</script>

<style></style>

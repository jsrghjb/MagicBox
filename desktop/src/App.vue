<template>
  <el-config-provider :locale="locale" :size="size">
    <Layouts />
  </el-config-provider>
</template>

<script setup>
import Layouts from './layouts/index.vue'
import { automationDataStore } from '$/database/index.js'
import { runAutomationOnDevices } from '$/utils/automation/runner.js'
import { registerAutomationScheduleHandler } from '$/utils/automation/schedule-handler.js'

const router = useRouter()

const { locale, size } = useWindowStateSync()

window.$preload.ipcRenderer.on('quit-before', async () => {
  ElLoading.service({
    lock: true,
    text: window.t('appClose.quit.loading'),
  })
})

const startApp = useStartApp()
const scheduleStore = useScheduleStore()

registerAutomationScheduleHandler(scheduleStore)

window.$preload.ipcRenderer.on('execute-arguments-change', async (event, params) => {
  startApp.open(params)
})

window.$preload.ipcRenderer.on('navigate-to-route', (event, route) => {
  router.push(route)
})

window.$preload.ipcRenderer.on('dev-mode-warning', (event, message) => {
  ElMessage.warning(message)
})

window.$preload.ipcRenderer.on('trigger-macro', async (event, index) => {
  const deviceStore = useDeviceStore()
  const activeDevices = deviceStore.list.filter(d => d.status === 'device')
  if (!activeDevices.length) {
    ElMessage.warning('快捷键已触发，但没有找到任何在线且连接的设备以运行宏指令。')
    return
  }

  const targetDevice = activeDevices[0]
  const result = await automationDataStore.listByDevice(targetDevice.id)
  if (!result.success || !result.data?.length) {
    ElMessage.warning(`快捷键已触发，但在设备 [${targetDevice.name}] 上未找到任何已保存的宏指令。`)
    return
  }

  const script = result.data[index]
  if (!script) {
    ElMessage.warning(`快捷键已触发，但未找到第 ${index + 1} 个宏指令（当前设备仅有 ${result.data.length} 个指令）。`)
    return
  }

  const deviceNames = activeDevices.map(d => d.name || d.model || d.id).join(', ')
  ElMessage.success(`快捷键触发：正在设备 [${deviceNames}] 上并发执行宏指令 [${script.name}]...`)
  try {
    await runAutomationOnDevices({
      devices: activeDevices,
      steps: script.steps,
      vars: script.vars || {},
    })
  }
  catch (error) {
    ElMessage.error(`群控执行宏指令 [${script.name}] 失败: ${error?.message || String(error)}`)
  }
})

onMounted(() => {
  showTips()
  startApp.open()
  scheduleStore.recoverSchedules()
})

async function showTips() {
  const { getScrcpyPath } = window.$preload.configs || {}

  const scrcpyPath = getScrcpyPath?.({ store: window.$preload.store })

  if (scrcpyPath) {
    return false
  }

  ElMessageBox.alert(
    `<div>
      ${window.t('dependencies.lack.content', {
        name: '<a class="hover:underline text-primary-500" href="https://github.com/Genymobile/scrcpy" target="_blank">scrcpy</a>',
      })}
    <div>`,
    window.t('dependencies.lack.title'),
    {
      dangerouslyUseHTMLString: true,
    },
  )
}
</script>

<style lang="postcss">
</style>

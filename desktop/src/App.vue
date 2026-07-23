<template>
  <el-config-provider :locale="locale" :size="size">
    <Layouts v-if="licenseInfo.activated" />

    <!-- Premium Glassmorphism Activation Screen (Theme Adaptive) -->
    <div v-else class="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-100/90 dark:bg-slate-950/95 text-slate-800 dark:text-slate-100 p-6 select-none font-sans overflow-hidden transition-colors duration-300">
      <!-- Decorative Gradients -->
      <div class="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary-500/10 dark:bg-primary-500/5 blur-[120px] pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-[120px] pointer-events-none"></div>

      <div class="w-full max-w-[480px] bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-6 relative">
        <!-- Logo / Icon -->
        <div class="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-indigo-600 shadow-lg shadow-primary-500/20">
          <i class="i-bi-shield-lock-fill text-3xl text-white"></i>
        </div>

        <!-- Title -->
        <div class="text-center space-y-1.5">
          <h2 class="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            魔屏助手 软件激活
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            请输入专属激活码以在此设备上绑定授权。
          </p>
        </div>

        <!-- Expiration / Error Banner -->
        <el-alert
          v-if="licenseInfo.reason"
          :title="licenseInfo.reason"
          type="error"
          show-icon
          :closable="false"
          class="w-full"
        />

        <div class="w-full space-y-4">
          <!-- Machine ID Field -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">当前设备机器码</label>
            <div class="flex items-center gap-2 bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/40 rounded-xl p-3 font-mono text-sm text-slate-700 dark:text-slate-200">
              <span class="flex-1 select-all tracking-wider text-center">{{ licenseInfo.machineId || '正在获取...' }}</span>
              <el-button size="small" type="primary" link icon="CopyDocument" class="!text-primary-500 hover:!text-primary-600 dark:!text-primary-400 dark:hover:!text-primary-300" @click="copyMachineId">
                复制
              </el-button>
            </div>
          </div>

          <!-- License Input Field -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">输入激活码 (一机一码)</label>
            <el-input
              v-model="codeInput"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              class="license-input font-mono text-center tracking-wider text-lg"
              size="large"
              clearable
              @keydown.enter.prevent="activateLicense"
            />
          </div>
        </div>

        <!-- Action Button -->
        <el-button
          type="primary"
          class="w-full !rounded-xl !h-12 text-base font-semibold shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20 bg-gradient-to-r from-primary-500 to-indigo-600 border-none transition-all active:scale-[0.98]"
          :loading="activating"
          @click="activateLicense"
        >
          立即激活并绑定设备
        </el-button>

        <!-- Help Info -->
        <div class="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
          绑定后该激活码将与您的硬件指纹（机器码）永久锁定，<br>
          一机一码，任何其他设备无法重复使用。
        </div>
      </div>
    </div>
  </el-config-provider>
</template>

<script setup>
import Layouts from './layouts/index.vue'
import { automationDataStore } from '$/database/index.js'
import { runAutomationOnDevices } from '$/utils/automation/runner.js'

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
  const activeDevices = deviceStore.list.filter(d => d.status === 'connected' || d.status === 'synergy')
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

const licenseInfo = ref({ activated: true, machineId: '' })
const codeInput = ref('')
const activating = ref(false)

async function checkLicense() {
  try {
    const res = await window.$preload.ipcRenderer.invoke('license:status')
    licenseInfo.value = res
  }
  catch (e) {
    console.error('License check failed:', e)
  }
}

async function activateLicense() {
  if (!codeInput.value.trim()) {
    ElMessage.warning('请输入激活码')
    return
  }
  activating.value = true
  try {
    const res = await window.$preload.ipcRenderer.invoke('license:activate', { licenseKey: codeInput.value.trim() })
    if (res.success) {
      ElMessage.success('激活成功！已成功绑定此设备')
      await checkLicense()
    }
    else {
      ElMessage.error(res.error || '激活失败')
    }
  }
  catch (e) {
    ElMessage.error(`激活错误：${e.message || String(e)}`)
  }
  finally {
    activating.value = false
  }
}

function copyMachineId() {
  navigator.clipboard.writeText(licenseInfo.value.machineId)
  ElMessage.success('机器码已复制到剪贴板！')
}

onMounted(() => {
  checkLicense()
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

<template>
  <div class="h-full">
    <div class="h-full flex flex-col items-center justify-center space-y-[4vh] -mt-[4vh]">
      <div class="block">
        <img src="$electron/resources/build/logo.png" class="h-[16vh] max-h-36 drop-shadow drop-shadow-color-gray-300" alt="" />
      </div>

      <div class="text-lg lg:text-xl xl:text-2xl text-center italic text-gray-700 dark:text-white">
        {{ $t("about.description") }}
      </div>

      <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2.5">
        <span>版本 v{{ version }}</span>
        <el-button type="primary" link icon="Refresh" class="!p-0" @click="checkUpdate">
          检查更新
        </el-button>
      </div>

      <!-- License Info Section -->
      <div class="mt-4 p-5 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30 flex flex-col gap-3 max-w-[420px] w-full text-sm shadow-sm">
        <div class="flex items-center justify-between w-full border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="text-gray-500 dark:text-gray-400 font-medium">授权版本</span>
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-800 dark:text-gray-200">
              {{ licenseStore.isTeam ? '团队旗舰版' : licenseStore.isPersonal ? '个人专业版' : '免费体验版' }}
            </span>
            <el-tag :type="licenseStore.activated ? 'success' : 'info'" size="small" effect="light" class="font-medium">
              {{ licenseStore.activated ? '已激活' : '免费版' }}
            </el-tag>
          </div>
        </div>

        <div v-if="licenseStore.activated" class="flex items-center justify-between w-full border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="text-gray-500 dark:text-gray-400 font-medium">有效期至</span>
          <span class="font-mono text-gray-800 dark:text-gray-200 font-semibold">
            {{ licenseStore.expiryDate === '永久' || licenseStore.expiryDate === '2099-12-31' ? '永久授权' : licenseStore.expiryDate }}
          </span>
        </div>

        <!-- 原生机器码 -->
        <div class="flex flex-col gap-1 w-full border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="text-gray-500 dark:text-gray-400 font-medium text-xs">原生设备机器码</span>
          <div class="flex items-center gap-2 bg-gray-100/70 dark:bg-slate-900/70 border border-gray-200/50 dark:border-gray-800/50 rounded-lg px-2.5 py-1.5 font-mono text-xs text-gray-700 dark:text-gray-200">
            <span class="flex-1 select-all tracking-wider font-semibold truncate">{{ licenseStore.machineId || '读取中...' }}</span>
            <el-button size="small" type="primary" link icon="CopyDocument" class="!p-0" @click="copyMachineId" />
          </div>
        </div>

        <!-- 当前激活码 -->
        <div v-if="licenseStore.activeKey" class="flex flex-col gap-1 w-full">
          <span class="text-gray-500 dark:text-gray-400 font-medium text-xs">当前卡密激活码</span>
          <div class="flex items-center gap-2 bg-gray-100/70 dark:bg-slate-900/70 border border-gray-200/50 dark:border-gray-800/50 rounded-lg px-2.5 py-1.5 font-mono text-xs text-primary-600 dark:text-primary-400 font-semibold">
            <span class="flex-1 select-all tracking-wider truncate">{{ licenseStore.activeKey }}</span>
            <el-button size="small" type="primary" link icon="CopyDocument" class="!p-0" @click="copyActiveKey" />
          </div>
        </div>

        <div class="w-full mt-1 pt-1 flex gap-3 justify-center">
          <el-button type="primary" size="default" class="flex-1 !rounded-xl" @click="handleRenew">
            {{ licenseStore.activated ? '更换/续期激活码' : '输入卡密激活' }}
          </el-button>
          <el-button v-if="licenseStore.activated" type="danger" size="default" plain class="flex-1 !rounded-xl" @click="handleDeactivate">
            解除绑定
          </el-button>
        </div>
      </div>
    </div>

    <!-- Software Update Dialog -->
    <el-dialog
      v-model="updateDialogVisible"
      title="检查更新"
      width="400px"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="updateStatus !== 'downloading'"
    >
      <div class="flex flex-col items-center py-4 text-center gap-4">
        <div v-if="updateStatus === 'checking'" class="flex flex-col items-center gap-2.5 py-4">
          <i class="i-bi-arrow-repeat animate-spin text-4xl text-primary-600"></i>
          <div class="text-sm text-gray-600 dark:text-gray-300">
            正在检查最新版本...
          </div>
        </div>

        <div v-else-if="updateStatus === 'available'" class="flex flex-col items-center gap-2.5 w-full">
          <i class="i-bi-cloud-download text-4xl text-primary-600"></i>
          <div class="font-bold text-base">
            发现新版本 v{{ newVersionInfo?.version }}
          </div>
          <div class="text-xs text-gray-500 bg-gray-100/60 dark:bg-slate-900/60 p-3 rounded-lg w-full max-h-40 overflow-y-auto text-left leading-relaxed">
            <div class="font-medium mb-1">
              更新日志:
            </div>
            {{ newVersionInfo?.releaseNotes || '优化了一些已知问题，提升性能与稳定性。' }}
          </div>
          <div class="pt-4 flex gap-3 justify-center w-full">
            <el-button class="flex-1 !rounded-xl" @click="updateDialogVisible = false">
              以后再说
            </el-button>
            <el-button type="primary" class="flex-1 !rounded-xl" @click="startDownload">
              立即下载
            </el-button>
          </div>
        </div>

        <div v-else-if="updateStatus === 'downloading'" class="flex flex-col items-center gap-3 w-full px-2">
          <el-progress :percentage="downloadProgress" type="line" :stroke-width="10" striped striped-flow class="w-full" />
          <div class="text-sm text-gray-600 dark:text-gray-300">
            正在下载更新包... {{ downloadProgress }}%
          </div>
        </div>

        <div v-else-if="updateStatus === 'downloaded'" class="flex flex-col items-center gap-2.5 py-2">
          <i class="i-bi-check-circle-fill text-4xl text-success-600"></i>
          <div class="font-bold text-base">
            更新包下载完成
          </div>
          <div class="text-sm text-gray-500">
            魔屏助手已准备就绪，需要退出并安装新版本。
          </div>
          <div class="pt-4 w-full">
            <el-button type="primary" class="w-full !rounded-xl" @click="installNow">
              退出并安装
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { version } from '/package.json'
import { useLicenseStore } from '$/store/license/index.js'

const licenseStore = useLicenseStore()

// Update states
const updateDialogVisible = ref(false)
const updateStatus = ref('idle') // idle | checking | available | downloading | downloaded
const downloadProgress = ref(0)
const newVersionInfo = ref(null)

function copyMachineId() {
  navigator.clipboard.writeText(licenseStore.machineId || '')
  ElMessage.success('原生机器码已复制到剪贴板！')
}

function copyActiveKey() {
  navigator.clipboard.writeText(licenseStore.activeKey || '')
  ElMessage.success('激活码已复制到剪贴板！')
}

async function handleRenew() {
  try {
    const { value: newKey } = await ElMessageBox.prompt('请输入新的激活码进行续期或更换授权：', '更新激活码', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: 'XXXX-XXXX-XXXX-XXXX',
    })

    if (newKey && newKey.trim()) {
      const res = await licenseStore.activateKey(newKey.trim())
      if (res.success) {
        ElMessage.success('激活码更新成功！')
        await licenseStore.fetchStatus()
      }
      else {
        ElMessage.error(res.error || '激活码验证失败')
      }
    }
  }
  catch (e) {
    if (e !== 'cancel') {
      console.error(e)
    }
  }
}

async function handleDeactivate() {
  try {
    await ElMessageBox.confirm('确定要解除本机的授权绑定并恢复为免费体验版吗？', '解除绑定', {
      confirmButtonText: '确定解绑',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const res = await licenseStore.deactivateKey()
    if (res.success) {
      ElMessage.success('已解除授权，系统已恢复为免费体验版！')
      await licenseStore.fetchStatus()
    }
  }
  catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(`解绑失败: ${e.message || String(e)}`)
    }
  }
}

// Check for updates
function checkUpdate() {
  updateStatus.value = 'checking'
  updateDialogVisible.value = true
  window.$preload.ipcRenderer.send('check-for-update')
}

// Start download
function startDownload() {
  updateStatus.value = 'downloading'
  downloadProgress.value = 0
  window.$preload.ipcRenderer.send('download-update')
}

// Quit and install
function installNow() {
  window.$preload.ipcRenderer.send('quit-and-install')
}

let unbindEvents = () => {}

onMounted(() => {
  licenseStore.fetchStatus()

  const ipc = window.$preload.ipcRenderer

  const onUpdateAvailable = (event, info) => {
    newVersionInfo.value = info
    updateStatus.value = 'available'
    updateDialogVisible.value = true
  }

  const onUpdateNotAvailable = () => {
    updateStatus.value = 'idle'
    updateDialogVisible.value = false
    ElMessage.success('当前已是最新版本！')
  }

  const onDownloadProgress = (event, progressObj) => {
    downloadProgress.value = Math.round(progressObj.percent)
  }

  const onUpdateDownloaded = () => {
    updateStatus.value = 'downloaded'
  }

  const onUpdateError = (event, err) => {
    updateStatus.value = 'idle'
    updateDialogVisible.value = false
    ElMessage.error('检查更新失败，请稍后重试！')
    console.error('Update error:', err)
  }

  ipc.on('update-available', onUpdateAvailable)
  ipc.on('update-not-available', onUpdateNotAvailable)
  ipc.on('download-progress', onDownloadProgress)
  ipc.on('update-downloaded', onUpdateDownloaded)
  ipc.on('update-error', onUpdateError)

  unbindEvents = () => {
    ipc.removeListener('update-available', onUpdateAvailable)
    ipc.removeListener('update-not-available', onUpdateNotAvailable)
    ipc.removeListener('download-progress', onDownloadProgress)
    ipc.removeListener('update-downloaded', onUpdateDownloaded)
    ipc.removeListener('update-error', onUpdateError)
  }
})

onBeforeUnmount(() => {
  unbindEvents()
})
</script>

<style></style>

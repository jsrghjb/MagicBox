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
        <el-button type="primary" link class="!p-0" @click="openDownloadPage">
          下载安装包
        </el-button>
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
            魔法百宝箱已准备就绪，需要退出并安装新版本。
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

const updateDialogVisible = ref(false)
const updateStatus = ref('idle') // idle | checking | available | downloading | downloaded
const downloadProgress = ref(0)
const newVersionInfo = ref(null)

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

function openDownloadPage() {
  window.$preload.ipcRenderer.send('open-download-page')
}

let unbindEvents = () => {}

onMounted(() => {
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
    console.error('Update error:', err)
    ElMessageBox.confirm(
      '暂时无法从 GitHub Releases 检查更新。是否打开下载页手动获取安装包？',
      '检查更新失败',
      {
        confirmButtonText: '打开下载页',
        cancelButtonText: '取消',
        type: 'warning',
      },
    ).then(() => {
      openDownloadPage()
    }).catch(() => {})
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

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <!-- 顶部工具栏 -->
    <div class="flex-none flex items-center justify-between gap-3 px-2 pb-1 border-b border-gray-100 dark:border-gray-800 overflow-x-auto whitespace-nowrap">
      <div class="flex items-center gap-3 min-w-0 flex-shrink-0">
        <div class="flex items-center gap-1.5">
          <h2 class="text-lg font-bold m-0 whitespace-nowrap">
            设备 ({{ renderedCount }}/{{ devices.length }})
          </h2>
          <el-tooltip
            v-if="!masterSerial && devices.length"
            effect="light"
            :content="$t('cluster.masterHint')"
            placement="bottom-start"
          >
            <i class="i-bi-info-circle text-gray-400 hover:text-gray-600 transition-colors cursor-help text-sm"></i>
          </el-tooltip>
        </div>
        <el-tag v-if="masterSerial" type="primary" class="max-w-64 truncate" :title="getDeviceName(masterSerial)">
          {{ $t('cluster.masterDevice') }}: {{ getDeviceName(masterSerial) }}
        </el-tag>
        <el-tag v-if="usesArrangeLayout" type="info" class="whitespace-nowrap">
          {{ $t('cluster.usesArrangeLayout') }}
        </el-tag>
        <el-tag v-if="isRunningAutomation" type="warning" class="animate-pulse whitespace-nowrap">
          <i class="i-bi-play-fill mr-1"></i>
          {{ $t('automation.batch.executing') }} ({{ runResults.length }}/{{ devices.length }})
        </el-tag>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- 录制宏指令 -->
        <template v-if="isRecordingMacro">
          <el-button type="danger" class="animate-pulse" @click="stopRecording">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-white mr-1.5 animate-ping"></span>
            {{ recordedSteps.length }} 步 - 停止
          </el-button>
        </template>
        <template v-else>
          <el-tooltip v-if="masterSerial" content="录制宏指令" placement="bottom">
            <el-button
              type="warning"
              plain
              @click="startRecording"
            >
              <i class="i-bi-record-circle"></i>
            </el-button>
          </el-tooltip>
        </template>

        <el-tooltip v-if="masterSerial" :content="$t('cluster.runScript')" placement="bottom">
          <el-button
            type="primary"
            plain
            :loading="isRunningAutomation"
            @click="openScriptRunner"
          >
            <i class="i-bi-play-circle"></i>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="masterSerial" :content="isMasterMaximized ? '退出单控同步' : '单控同步'" placement="bottom">
          <el-button
            :type="isMasterMaximized ? 'success' : 'info'"
            plain
            @click="isMasterMaximized = !isMasterMaximized"
          >
            <i class="i-bi-fullscreen"></i>
          </el-button>
        </el-tooltip>

        <el-radio-group v-model="useGridMode" class="mr-2">
          <el-tooltip content="网格对齐" placement="bottom">
            <el-radio-button :value="true">
              <i class="i-bi-grid-3x3-gap mr-1"></i>网格
            </el-radio-button>
          </el-tooltip>
          <el-tooltip content="桌面对齐" placement="bottom">
            <el-radio-button :value="false">
              <i class="i-bi-window mr-1"></i>桌面
            </el-radio-button>
          </el-tooltip>
        </el-radio-group>

        <el-tooltip :content="$t('device.refresh.name')" placement="bottom">
          <el-button type="default" :loading="loading" @click="refreshDevices">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="initialized" :content="$t('cluster.stopAll')" placement="bottom">
          <el-button type="danger" @click="stopAll">
            <i class="i-bi-stop-circle"></i>
          </el-button>
        </el-tooltip>

        <el-tooltip :content="$t('cluster.clearMaster')" placement="bottom">
          <el-button type="primary" :disabled="!masterSerial" @click="clearMaster">
            <i class="i-bi-x-circle"></i>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 页内投屏：按窗口编排布局渲染 canvas，整体缩放适配视口，不出现滚动条 -->
    <div ref="layoutAreaRef" class="cluster-layout-area flex-1 min-h-0 overflow-hidden flex items-center justify-center p-2">
      <div
        class="cluster-canvas relative border border-primary-300 border-dashed rounded overflow-hidden bg-gray-50 dark:bg-gray-900"
        :style="screenContainerStyle"
      >
        <div
          v-for="item in renderedLayoutItems"
          v-show="!item.hidden"
          :key="item.serial"
          class="cluster-item absolute border rounded-lg overflow-hidden bg-black"
          :class="{ 'ring-2 ring-primary': item.serial === masterSerial }"
          :style="{
            left: `${item.x}px`,
            top: `${item.y}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
          }"
        >
          <div
            class="cluster-item-header absolute top-0 left-0 right-0 z-10 bg-black/60 text-white p-1 text-xs flex items-center justify-between cursor-pointer"
            @click.stop="setAsMaster(item.serial)"
          >
            <span class="truncate pr-2">{{ getDeviceName(item.serial) }}</span>
            <span class="flex-none">{{ getDeviceBySerial(item.serial)?.width }}×{{ getDeviceBySerial(item.serial)?.height }}</span>
          </div>

          <div class="video-container absolute inset-0 top-5 overflow-hidden">
            <canvas
              :ref="el => setCanvasRef(item.serial, el)"
              class="cluster-video-canvas w-full h-full block"
            />

            <div
              v-if="item.serial === masterSerial"
              class="absolute inset-0 border-2 border-primary pointer-events-none z-1"
            />

            <div
              v-if="!isDeviceRendered(item.serial)"
              class="absolute inset-0 z-2 flex flex-col items-center justify-center gap-2 bg-black/60 pointer-events-none"
            >
              <el-icon class="text-4xl text-white animate-spin">
                <Loading />
              </el-icon>
              <span class="text-xs text-white/80">{{ $t('common.loading') }}</span>
            </div>
          </div>
          <div
            class="cluster-touch-layer absolute inset-0 top-5 z-3 touch-none cursor-crosshair"
            @pointerdown.stop="onPointerDown($event, item.serial)"
            @wheel.prevent.stop="onWheel($event, item.serial)"
          />
        </div>
      </div>

      <div v-if="!devices.length && !loading" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AppEmpty :sub-title="$t('cluster.noDevices')"></AppEmpty>
      </div>
    </div>

    <el-dialog
      v-model="scriptRunnerVisible"
      :title="$t('cluster.runScript.title')"
      width="640px"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      @close="resetScriptRunner"
    >
      <el-form label-width="100px">
        <el-form-item :label="$t('cluster.runScript.select')">
          <el-select v-model="selectedScriptId" class="w-full" filterable>
            <el-option
              v-for="script in availableScripts"
              :key="script.id"
              :label="script.name"
              :value="script.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('cluster.runScript.variables')">
          <div class="w-full space-y-2">
            <div
              v-for="(row, index) in variableRows"
              :key="index"
              class="flex items-center gap-2"
            >
              <el-input
                v-for="varName in variableNames"
                :key="varName"
                v-model="row[varName]"
                :placeholder="varName"
                class="flex-1"
              />
              <el-button text circle icon="Delete" @click="removeVariableRow(index)" />
            </div>
            <el-button @click="addVariableRow">
              {{ $t('automation.batch.addRow') }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="$t('cluster.runScript.targets')">
          <div class="text-sm text-gray-600">
            {{ $t('cluster.runScript.targets.hint', { count: devices.length }) }}
          </div>
        </el-form-item>
      </el-form>

      <div v-if="runResults.length" class="mt-3 border-t pt-3 space-y-1 max-h-48 overflow-y-auto">
        <div
          v-for="(item, index) in runResults"
          :key="index"
          class="flex items-center gap-2 text-xs"
        >
          <el-tag :type="item.success ? 'success' : 'danger'" size="small">
            {{ item.success ? 'OK' : 'FAIL' }}
          </el-tag>
          <span class="truncate flex-1">{{ item.label }}</span>
          <span v-if="item.error" class="text-red-500 truncate">{{ item.error }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="scriptRunnerVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="isRunningAutomation"
          :disabled="!selectedScriptId || !devices.length"
          @click="handleRunScript"
        >
          {{ isRunningAutomation ? $t('automation.batch.executing') : $t('cluster.runScript.execute') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { Loading, Refresh } from '@element-plus/icons-vue'
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDeviceStore } from '$/store/device/index.js'
import AppEmpty from '$/components/app-empty/index.vue'
import { useClusterLayout } from './hooks/use-cluster-layout.js'
import { useClusterPointer } from './hooks/use-cluster-pointer.js'
import { useClusterVideo } from './hooks/use-cluster-video.js'
import { automationDataStore } from '$/database/index.js'
import { usePreferenceStore } from '$/store/preference/index.js'

const loading = ref(false)
const initialized = ref(false)
const devices = ref([])
const masterSerial = ref(null)
const deviceStore = useDeviceStore()
const preferenceStore = usePreferenceStore()
const layoutAreaRef = ref(null)
const layoutRevision = ref(0)

watch(
  () => preferenceStore.config,
  () => {
    layoutRevision.value += 1
  },
  { deep: true },
)

const {
  renderedSerials,
  setFrameSession,
  setCanvasRef,
  initDevice,
  onVideoFrame,
  destroy: destroyVideo,
  isDeviceRendered,
  getCanvas,
  getStreamSize,
} = useClusterVideo()

const {
  layoutItems,
  screenContainerStyle,
  usesArrangeLayout,
  remeasureLayout,
  containerWidth,
  containerHeight,
  useGridMode,
} = useClusterLayout(devices, layoutAreaRef, layoutRevision)

const isMasterMaximized = ref(false)
const renderedLayoutItems = computed(() => {
  if (isMasterMaximized.value && masterSerial.value) {
    const masterDevice = getDeviceBySerial(masterSerial.value)
    const devWidth = masterDevice?.width || 1080
    const devHeight = masterDevice?.height || 1920
    const deviceAspect = devWidth / devHeight

    const containerW = containerWidth.value
    const containerH = containerHeight.value

    let w = containerW
    let h = containerW / deviceAspect
    if (h > containerH) {
      h = containerH
      w = containerH * deviceAspect
    }

    const x = (containerW - w) / 2
    const y = (containerH - h) / 2

    return layoutItems.value.map((item) => {
      if (item.serial === masterSerial.value) {
        return {
          ...item,
          x,
          y,
          width: w,
          height: h,
          hidden: false,
        }
      }
      return {
        ...item,
        hidden: true,
      }
    })
  }
  return layoutItems.value.map(item => ({ ...item, hidden: false }))
})

function sendClusterTouch(payload) {
  window.$preload.ipcRenderer.send('cluster-control:touch', payload)
}

function sendClusterScroll(payload) {
  window.$preload.ipcRenderer.send('cluster-control:scroll', payload)
}

const isRecordingMacro = ref(false)
const recordedSteps = ref([])
const lastTouchTime = ref(0)
const startTouchPos = ref(null)
const startTouchTime = ref(0)
const currentDelay = ref(0)

// 滚轮滑动录制防抖状态
let scrollDebounceTimer = null
let accumulatedDeltaY = 0
let scrollPayload = null

function onTouchRecorded(payload) {
  if (isRecordingMacro.value && payload.sourceSerial === masterSerial.value) {
    if (payload.action === 'down') {
      const now = Date.now()
      currentDelay.value = lastTouchTime.value ? now - lastTouchTime.value : 0
      startTouchPos.value = { x: payload.xPercent, y: payload.yPercent }
      startTouchTime.value = now
      lastTouchTime.value = now
    }
    else if (payload.action === 'up' && startTouchPos.value) {
      const now = Date.now()
      const endX = payload.xPercent
      const endY = payload.yPercent
      const w = payload.deviceWidth || 1080
      const h = payload.deviceHeight || 1920

      const dx = (endX - startTouchPos.value.x) * w
      const dy = (endY - startTouchPos.value.y) * h
      const dist = Math.hypot(dx, dy)

      const id = Math.random().toString(36).substring(2, 9)
      if (dist < 20) {
        recordedSteps.value.push({
          id,
          type: 'tap',
          name: `点击 (${Math.round(startTouchPos.value.x * w)}, ${Math.round(startTouchPos.value.y * h)})`,
          delayBefore: currentDelay.value,
          loopCount: 1,
          randomRange: 2,
          x: Math.round(startTouchPos.value.x * w),
          y: Math.round(startTouchPos.value.y * h),
          xPercent: startTouchPos.value.x,
          yPercent: startTouchPos.value.y,
          refWidth: w,
          refHeight: h,
        })
      }
      else {
        recordedSteps.value.push({
          id,
          type: 'swipe',
          name: `滑动 (${Math.round(startTouchPos.value.x * w)}, ${Math.round(startTouchPos.value.y * h)}) -> (${Math.round(endX * w)}, ${Math.round(endY * h)})`,
          delayBefore: currentDelay.value,
          loopCount: 1,
          randomRange: 2,
          startX: Math.round(startTouchPos.value.x * w),
          startY: Math.round(startTouchPos.value.y * h),
          endX: Math.round(endX * w),
          endY: Math.round(endY * h),
          startXPercent: startTouchPos.value.x,
          startYPercent: startTouchPos.value.y,
          endXPercent: endX,
          endYPercent: endY,
          duration: Math.max(100, now - startTouchTime.value),
          refWidth: w,
          refHeight: h,
        })
      }
      lastTouchTime.value = now
    }
  }

  sendClusterTouch(payload)
}

function onScrollRecorded(payload) {
  if (isRecordingMacro.value && payload.sourceSerial === masterSerial.value) {
    accumulatedDeltaY += payload.deltaY
    scrollPayload = payload

    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer)
    }

    scrollDebounceTimer = setTimeout(() => {
      const now = Date.now()
      const delay = lastTouchTime.value ? now - lastTouchTime.value - 150 : 0

      const w = scrollPayload.videoWidth || 1080
      const h = scrollPayload.videoHeight || 1920
      const x = Math.round(scrollPayload.xPercent * w)
      const y = Math.round(scrollPayload.yPercent * h)

      const swipeDistance = Math.min(400, Math.abs(accumulatedDeltaY) * 2)
      const endY = accumulatedDeltaY > 0 ? y - swipeDistance : y + swipeDistance

      const id = Math.random().toString(36).substring(2, 9)
      const clampedEndY = Math.max(0, Math.min(h, endY))
      recordedSteps.value.push({
        id,
        type: 'swipe',
        name: `滚轮模拟滑动 (${x}, ${y}) -> (${x}, ${clampedEndY})`,
        delayBefore: Math.max(0, delay),
        loopCount: 1,
        randomRange: 2,
        startX: x,
        startY: y,
        endX: x,
        endY: clampedEndY,
        startXPercent: scrollPayload.xPercent,
        startYPercent: scrollPayload.yPercent,
        endXPercent: scrollPayload.xPercent,
        endYPercent: clampedEndY / h,
        duration: 300,
        refWidth: w,
        refHeight: h,
      })

      lastTouchTime.value = now
      accumulatedDeltaY = 0
      scrollDebounceTimer = null
    }, 150)
  }
  sendClusterScroll(payload)
}

function startRecording() {
  if (!masterSerial.value) {
    ElMessage.warning('请先设置主控设备！')
    return
  }
  isRecordingMacro.value = true
  recordedSteps.value = []
  lastTouchTime.value = Date.now()
  ElMessage.success('宏指令录制已开始，请在主控设备上操作...')
}

async function stopRecording() {
  isRecordingMacro.value = false
  if (recordedSteps.value.length === 0) {
    ElMessage.info('未录制任何操作步骤。')
    return
  }

  try {
    const { value: name } = await ElMessageBox.prompt(
      '请输入宏指令名称:',
      '保存宏指令',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: `录制宏_${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
        inputValidator: (val) => {
          if (!val?.trim())
            return '名称不能为空'
        },
      },
    )

    const device = getDeviceBySerial(masterSerial.value)

    const rawSteps = JSON.parse(JSON.stringify(recordedSteps.value))
    const result = await automationDataStore.createScript({
      deviceId: masterSerial.value,
      name: name.trim(),
      steps: rawSteps,
      vars: {},
    })

    if (!result.success) {
      throw new Error(result.error?.message || '数据库写入失败')
    }

    ElMessageBox.confirm(
      '宏指令已成功保存！是否立即打开自动化流程页面进行查看和运行？',
      '提示',
      {
        confirmButtonText: '立即打开',
        cancelButtonText: '留在本页',
        type: 'success',
      },
    ).then(() => {
      window.$preload.win.open('pages/automation', {
        title: 'automation.name',
        type: 'device',
        device: {
          id: device.id,
          name: device.name,
          model: device.model,
        },
        instanceId: device.id,
        query: {
          scriptId: result.data.id,
        },
      })
    }).catch(() => {})
  }
  catch (e) {
    if (e !== 'cancel') {
      console.error('Save macro error:', e)
      ElMessage.error(`保存失败: ${e.message || String(e)}`)
    }
  }
}

const { onPointerDown, onWheel } = useClusterPointer({
  getStreamSize,
  masterSerialRef: masterSerial,
  getDeviceBySerial,
  onTouch: onTouchRecorded,
  onScroll: onScrollRecorded,
})

const renderedCount = computed(() => renderedSerials.value.size)
const isConnected = computed(() => renderedCount.value > 0)

function getDeviceName(serial) {
  const device = deviceStore.list.find(d => d.id === serial)
  if (device) {
    return device.remark || device.name || device.model || serial
  }
  const d = devices.value.find(item => item.serial === serial)
  return d?.model || serial
}

function getDeviceBySerial(serial) {
  return devices.value.find(d => d.serial === serial)
}

function mergeClusterDevices(clusterDevices) {
  const connectedIds = new Set(clusterDevices.map(device => device.serial))
  const ordered = deviceStore.list.filter(device => connectedIds.has(device.id))

  const knownIds = new Set(ordered.map(device => device.id))
  for (const device of clusterDevices) {
    if (knownIds.has(device.serial))
      continue

    ordered.push({
      id: device.serial,
      name: device.model || device.serial,
      model: device.model,
      screenWidth: device.width,
      screenHeight: device.height,
    })
  }

  return ordered.map((device) => {
    const clusterDevice = clusterDevices.find(item => item.serial === device.id)
    const width = device.screenWidth ?? clusterDevice?.width ?? 0
    const height = device.screenHeight ?? clusterDevice?.height ?? 0

    return {
      id: device.id,
      serial: device.id,
      model: device.model || clusterDevice?.model || device.id,
      name: deviceStore.getLabel(device),
      width,
      height,
      screenWidth: width,
      screenHeight: height,
    }
  })
}

function onVideoFrameEvent(_event, payload) {
  onVideoFrame(payload)
}

async function refreshDevices() {
  loading.value = true
  layoutRevision.value += 1

  try {
    if (initialized.value)
      await stopAll(false)

    const result = await window.$preload.ipcRenderer.invoke('cluster-control:initialize')

    if (!result?.success) {
      ElMessage.error(result?.error || window.t('cluster.noDevices'))
      devices.value = []
      return
    }

    if (!result.devices?.length) {
      devices.value = []
      ElMessage.warning(window.t('cluster.noDevices'))
      return
    }

    await deviceStore.getList()
    devices.value = mergeClusterDevices(result.devices)

    if (result.session != null)
      setFrameSession(result.session)

    initialized.value = true
    await nextTick()
    await remeasureLayout()
    await nextTick()

    for (const device of devices.value)
      initDevice(device.serial)

    await nextTick()

    ElMessage.success(`${window.t('cluster.initSuccess')}: ${devices.value.length} ${window.t('cluster.devicesFound')}`)
  }
  catch (error) {
    ElMessage.error(error.message)
  }
  finally {
    loading.value = false
  }
}

async function setAsMaster(serial) {
  masterSerial.value = serial
  try {
    await window.$preload.ipcRenderer.invoke('cluster-control:setMaster', serial)
  }
  catch (error) {
    console.error('[cluster] setMaster:', error)
  }
  ElMessage.success(`${window.t('cluster.setMasterSuccess')}: ${getDeviceName(serial)}`)
}

async function clearMaster() {
  masterSerial.value = null
  try {
    await window.$preload.ipcRenderer.invoke('cluster-control:setMaster', null)
  }
  catch (error) {
    console.error('[cluster] clearMaster:', error)
  }
}

async function stopAll(showMessage = true) {
  destroyVideo()

  try {
    await window.$preload.ipcRenderer.invoke('cluster-control:stopAll')
  }
  catch (error) {
    console.error('[cluster] stopAll:', error)
  }

  devices.value = []
  masterSerial.value = null
  initialized.value = false

  if (showMessage)
    ElMessage.info(window.t('cluster.stopped'))
}

onMounted(async () => {
  window.$preload.ipcRenderer.on('cluster-control:frame', onVideoFrameEvent)
  await nextTick()
  await remeasureLayout()
})

onActivated(async () => {
  await nextTick()
  await remeasureLayout()
})

onUnmounted(() => {
  window.$preload.ipcRenderer.removeListener('cluster-control:frame', onVideoFrameEvent)
  if (initialized.value)
    stopAll(false)
})

// 群控 + 自动化：挑选脚本并跨已连接设备执行
const scriptRunnerVisible = ref(false)
const isRunningAutomation = ref(false)
const availableScripts = ref([])
const selectedScriptId = ref('')
const variableRows = ref([{}])
const runResults = ref([])

const selectedRunnerScript = computed(() => availableScripts.value.find(s => s.id === selectedScriptId.value))
const variableNames = computed(() => Object.keys(selectedRunnerScript.value?.vars || {}))

async function openScriptRunner() {
  if (!devices.value.length) {
    ElMessage.warning(window.t('cluster.noDevices'))
    return
  }
  const listResult = await automationDataStore.listByDevice(masterSerial.value || devices.value[0]?.serial)
  const scripts = listResult.data || []
  if (!scripts.length) {
    ElMessage.warning(window.t('automation.scripts.select.empty'))
    return
  }
  availableScripts.value = scripts
  selectedScriptId.value = scripts[0]?.id || ''
  variableRows.value = [JSON.parse(JSON.stringify(scripts[0]?.vars || {}))]
  scriptRunnerVisible.value = true
}

function resetScriptRunner() {
  scriptRunnerVisible.value = false
  runResults.value = []
}

function addVariableRow() {
  variableRows.value.push(Object.fromEntries(variableNames.value.map(n => [n, ''])))
}

function removeVariableRow(index) {
  variableRows.value.splice(index, 1)
  if (!variableRows.value.length) {
    variableRows.value = [{}]
  }
}

async function handleRunScript() {
  const script = selectedRunnerScript.value
  if (!script || !devices.value.length) {
    return
  }
  scriptRunnerVisible.value = false
  isRunningAutomation.value = true
  runResults.value = []
  ElMessage.info(window.t('automation.batch.executing'))
  try {
    const { runAutomationMatrix } = await import('$/utils/automation/runner.js')
    await runAutomationMatrix({
      devices: devices.value.map(d => ({ id: d.serial })),
      rows: variableRows.value,
      steps: script.steps || [],
      baseVars: script.vars || {},
      onTaskEnd: (item) => {
        runResults.value.push(item)
      },
    })
    const failed = runResults.value.filter(r => !r.success).length
    if (failed === 0) {
      ElMessage.success(window.t('cluster.runScript.done', { count: runResults.value.length }))
    }
    else if (failed === runResults.value.length) {
      ElMessage.error(window.t('cluster.runScript.allFailed', { count: failed }))
    }
    else {
      ElMessage.warning(window.t('cluster.runScript.partial', { ok: runResults.value.length - failed, fail: failed }))
    }
  }
  catch (error) {
    console.error('[cluster] runScript:', error)
    ElMessage.error(error?.message || window.t('automation.run.failed'))
  }
  finally {
    isRunningAutomation.value = false
  }
}
</script>

<style lang="postcss" scoped>
.cluster-layout-area {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cluster-canvas {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.cluster-item {
  transition: box-shadow 0.2s;
}

.cluster-video-canvas {
  background: #000;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.cluster-touch-layer {
  user-select: none;
}

.cluster-item:hover {
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

:deep(.el-empty) {
  --el-empty-image-width: 200px;
}
</style>

<template>
  <el-dialog
    :model-value="true"
    :title="$t('automation.macro.recordTitle') || '录制宏指令'"
    width="760px"
    class="el-dialog--beautify"
    append-to-body
    destroy-on-close
    @close="$emit('close')"
  >
    <div v-if="loading" class="h-64 flex items-center justify-center">
      <div class="text-center">
        <div class="i-ep-loading animate-spin size-8 mx-auto mb-2"></div>
        <div>正在启动实时投屏...</div>
      </div>
    </div>

    <div v-else class="space-y-3">
      <el-alert
        title="请在左侧实时画面上进行点击和滑动操作，操作将被记录为右侧的指令步骤。"
        type="info"
        :closable="false"
      />

      <div class="flex gap-4 items-start">
        <!-- Left column: phone stream -->
        <div class="flex-none border dark:border-gray-700 rounded overflow-hidden bg-black flex items-center justify-center" style="height: 52vh; aspect-ratio: 9 / 19.5; width: calc(52vh * 9 / 19.5);">
          <div class="relative w-full h-full">
            <canvas
              ref="canvasRef"
              style="width: 100%; height: 100%; object-fit: contain; display: block;"
            />
            <div
              class="absolute inset-0 touch-none cursor-crosshair z-10"
              @pointerdown.stop="onPointerDown($event, deviceId)"
              @wheel.prevent.stop="onWheel($event, deviceId)"
            />
          </div>
        </div>

        <!-- Right column: steps records -->
        <div class="flex-1 min-w-0 flex flex-col h-[52vh] gap-2">
          <div class="flex items-center justify-between text-sm text-gray-500 flex-none">
            <span class="font-medium">已记录步骤: <el-tag type="success" size="small">{{ recordedSteps.length }} 步</el-tag></span>
            <el-button type="danger" size="small" link :disabled="!recordedSteps.length" @click="recordedSteps = []">
              清空已录制
            </el-button>
          </div>

          <!-- Quick System Keys -->
          <div class="flex items-center gap-1.5 flex-wrap flex-none border-b dark:border-gray-800 pb-2">
            <el-button size="small" plain class="!px-2" @click="recordSystemKey(4, 'automation.keys.back')">
              {{ $t('automation.keys.back') }}
            </el-button>
            <el-button size="small" plain class="!px-2" @click="recordSystemKey(3, 'automation.keys.home')">
              {{ $t('automation.keys.home') }}
            </el-button>
            <el-button size="small" plain class="!px-2" @click="recordSystemKey(187, 'automation.keys.recentApps')">
              {{ $t('automation.keys.recentApps') }}
            </el-button>
            <el-button size="small" plain class="!px-2" @click="recordSystemKey(26, 'automation.keys.power')">
              {{ $t('automation.keys.power') }}
            </el-button>
          </div>

          <!-- Quick Text Input -->
          <div class="flex items-center gap-1.5 flex-none pb-1">
            <el-input
              v-model="inputText"
              size="small"
              placeholder="输入文本内容记录并发送..."
              clearable
              @keydown.enter.prevent="sendAndRecordText"
            />
            <el-button size="small" type="primary" :disabled="!inputText.trim()" @click="sendAndRecordText">
              发送
            </el-button>
          </div>

          <div class="flex-1 min-h-0 border dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-900 overflow-auto text-xs space-y-1">
            <div v-if="!recordedSteps.length" class="h-full flex flex-col items-center justify-center text-gray-400 py-8">
              <div class="i-ep-info-filled size-8 mb-2 opacity-50"></div>
              <div>暂无录制步骤，请在左侧画面上操作</div>
            </div>
            <template v-else>
              <div v-for="(step, index) in recordedSteps" :key="step.id" class="flex items-center justify-between py-1.5 border-b dark:border-gray-800 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-800/50 px-1 rounded transition-colors">
                <span class="text-gray-400 font-mono w-6 flex-none">#{{ index + 1 }}</span>
                <span class="font-medium mx-1 flex-1 truncate text-gray-700 dark:text-gray-300" :title="step.name">{{ step.name }}</span>
                <span class="text-gray-400 flex-none mr-2">延时: {{ (step.delayBefore / 1000).toFixed(1) }}s</span>
                <el-button type="danger" link size="small" icon="Delete" class="p-0 !min-h-0" @click="recordedSteps.splice(index, 1)" />
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('close')">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button type="primary" :disabled="!recordedSteps.length" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useClusterVideo } from '$/views/cluster/hooks/use-cluster-video.js'
import { useClusterPointer } from '$/views/cluster/hooks/use-cluster-pointer.js'

const props = defineProps({
  deviceId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])

const canvasRef = ref(null)
const loading = ref(true)
const recordedSteps = ref([])
const lastTouchTime = ref(0)
const startTouchPos = ref(null)
const startTouchTime = ref(0)
const currentDelay = ref(0)
const deviceResolution = ref({ width: 1080, height: 1920 })

const {
  setCanvasRef,
  setFrameSession,
  initDevice,
  onVideoFrame,
  destroy: destroyVideo,
  getStreamSize,
} = useClusterVideo()

watch(canvasRef, (el) => {
  if (el) {
    setCanvasRef(props.deviceId, el)
  }
})

function onVideoFrameEvent(event, frame) {
  if (loading.value) {
    loading.value = false
  }
  onVideoFrame(frame)
}

onMounted(async () => {
  window.$preload.ipcRenderer.on('cluster-control:frame', onVideoFrameEvent)

  try {
    const result = await window.$preload.ipcRenderer.invoke('cluster-control:initialize')
    if (!result?.success) {
      throw new Error(result?.error || '无法初始化投屏控制通道')
    }

    setFrameSession(result.session)
    initDevice(props.deviceId)
    lastTouchTime.value = Date.now()
  }
  catch (error) {
    console.error('Failed to init live recorder:', error)
    ElMessage.error(error.message || String(error))
    emit('close')
  }
})

const scrollSession = ref(null)

function flushScrollSession() {
  if (!scrollSession.value)
    return

  const session = scrollSession.value
  const id = Math.random().toString(36).substring(2, 9)

  recordedSteps.value.push({
    id,
    type: 'swipe',
    name: `滚轮模拟滑动 (${session.startX}, ${session.startY}) -> (${session.endX}, ${session.endY})`,
    delayBefore: session.delayBefore,
    loopCount: 1,
    randomRange: 2,
    startX: session.startX,
    startY: session.startY,
    endX: session.endX,
    endY: session.endY,
    duration: Math.max(150, Date.now() - session.startTime),
  })

  scrollSession.value = null
}

onUnmounted(() => {
  window.$preload.ipcRenderer.removeListener('cluster-control:frame', onVideoFrameEvent)
  destroyVideo()
  if (scrollSession.value) {
    clearTimeout(scrollSession.value.timeoutId)
  }
})

function onTouch(payload) {
  if (payload.deviceWidth && payload.deviceHeight) {
    deviceResolution.value = { width: payload.deviceWidth, height: payload.deviceHeight }
  }
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
        duration: Math.max(100, now - startTouchTime.value),
      })
    }
    lastTouchTime.value = now
  }

  // Forward interaction to the actual device (forcing single-device targeting, no broadcast!)
  window.$preload.ipcRenderer.send('cluster-control:touch', {
    ...payload,
    broadcast: false,
    masterSerial: null,
  })
}

function onScroll(payload) {
  // Always forward the actual scroll event to the device immediately for real-time control
  window.$preload.ipcRenderer.send('cluster-control:scroll', {
    ...payload,
    broadcast: false,
    masterSerial: null,
  })

  const now = Date.now()
  const w = payload.videoWidth || 1080
  const h = payload.videoHeight || 1920
  const x = Math.round(payload.xPercent * w)
  const y = Math.round(payload.yPercent * h)

  const dy = payload.deltaY
  const swipeDistance = Math.min(200, Math.abs(dy) * 2)
  const targetY = Math.max(0, Math.min(h, dy > 0 ? y - swipeDistance : y + swipeDistance))

  if (scrollSession.value) {
    // Cumulative scroll: clear existing timer and update target Y
    clearTimeout(scrollSession.value.timeoutId)
    scrollSession.value.endY = targetY
    scrollSession.value.timeoutId = setTimeout(flushScrollSession, 250)
  }
  else {
    // Start a new scroll session
    const delay = lastTouchTime.value ? now - lastTouchTime.value : 0
    scrollSession.value = {
      startX: x,
      startY: y,
      endX: x,
      endY: targetY,
      delayBefore: delay,
      startTime: now,
      timeoutId: setTimeout(flushScrollSession, 250),
    }
  }

  lastTouchTime.value = now
}

const { onPointerDown, onWheel } = useClusterPointer({
  getStreamSize,
  masterSerialRef: computed(() => props.deviceId),
  getDeviceBySerial: () => ({ id: props.deviceId, serial: props.deviceId }),
  onTouch,
  onScroll,
})

const inputText = ref('')

async function recordSystemKey(key, nameKey) {
  const now = Date.now()
  const delay = lastTouchTime.value ? now - lastTouchTime.value : 0
  const id = Math.random().toString(36).substring(2, 9)

  recordedSteps.value.push({
    id,
    type: 'key',
    name: `${window.t('automation.step.key')}: ${window.t(nameKey)}`,
    key,
    delayBefore: delay,
    loopCount: 1,
    randomRange: 0,
  })

  lastTouchTime.value = now

  // Forward physical key event to device in real-time
  try {
    await window.$preload.adb.deviceShell(props.deviceId, `input keyevent ${key}`)
  }
  catch (error) {
    console.error('Failed to send recorded key:', error)
  }
}

async function sendAndRecordText() {
  const text = inputText.value ? inputText.value.trim() : ''
  if (!text)
    return

  const now = Date.now()
  const delay = lastTouchTime.value ? now - lastTouchTime.value : 0
  const id = Math.random().toString(36).substring(2, 9)

  recordedSteps.value.push({
    id,
    type: 'input',
    name: `输入: "${text}"`,
    text,
    delayBefore: delay,
    loopCount: 1,
    randomRange: 0,
  })

  inputText.value = ''
  lastTouchTime.value = now

  // Forward text typing to device
  try {
    const adb = window.$preload.adb
    const installed = await adb.isInstalledAdbKeyboard?.(props.deviceId)
    if (installed) {
      await adb.deviceShell(props.deviceId, 'ime set com.android.adbkeyboard/.AdbIME').catch(() => {})
      const encoded = btoa(unescape(encodeURIComponent(text)))
      await adb.deviceShell(props.deviceId, `am broadcast -a ADB_INPUT_B64 --es msg ${encoded}`)
    }
    else {
      const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')
      await adb.deviceShell(props.deviceId, `cmd clipboard set "${escaped}"`).catch(() => {})
      await new Promise(resolve => setTimeout(resolve, 200))
      await adb.deviceShell(props.deviceId, 'input keyevent 279').catch(async () => {
        const escapedText = text.replace(/[ &|()$<>'"]/g, '\\$&')
        await adb.deviceShell(props.deviceId, `input text ${escapedText}`)
      })
    }
  }
  catch (error) {
    console.error('Failed to send text to device:', error)
  }
}

function handleConfirm() {
  if (scrollSession.value) {
    clearTimeout(scrollSession.value.timeoutId)
    flushScrollSession()
  }
  emit('confirm', recordedSteps.value, deviceResolution.value)
}
</script>

<style scoped>
</style>

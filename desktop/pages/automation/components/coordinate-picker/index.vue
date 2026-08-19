<template>
  <el-dialog
    :model-value="true"
    width="520px"
    class="el-dialog--beautify"
    append-to-body
    destroy-on-close
    @close="$emit('close')"
  >
    <template #header>
      <div class="flex items-center justify-between pr-6">
        <div class="flex items-center gap-2">
          <span class="font-medium text-base">{{ $t('automation.picker.screenshot') }}</span>
          <el-tag v-if="targetDeviceId" size="small" type="info" effect="plain" class="!text-xs">
            {{ targetDeviceName }}
          </el-tag>
        </div>
        <el-button
          v-if="!loading"
          text
          circle
          icon="Refresh"
          title="重新截取屏幕"
          @click="loadScreenshot"
        />
      </div>
    </template>

    <div v-if="loading" class="h-72 flex items-center justify-center">
      <div class="text-center space-y-2">
        <div class="i-ep-loading animate-spin size-8 mx-auto text-primary-500"></div>
        <div class="text-sm text-gray-500">
          {{ $t('automation.picker.loading') }}
        </div>
      </div>
    </div>

    <div v-else-if="error" class="py-8 flex flex-col items-center justify-center text-center space-y-3">
      <div class="i-bi-exclamation-circle text-red-500 text-3xl"></div>
      <div class="text-sm text-red-500 max-w-sm">
        {{ error }}
      </div>
      <el-button type="primary" size="small" @click="loadScreenshot">
        重新尝试
      </el-button>
    </div>

    <div v-else class="space-y-3">
      <el-alert
        :title="alertInstruction"
        type="info"
        :closable="false"
      />

      <div class="mx-auto border dark:border-gray-700 rounded-lg overflow-auto bg-gray-900/5 dark:bg-black/20" style="max-width: 100%; max-height: 55vh; width: fit-content;">
        <canvas
          ref="canvasRef"
          style="max-width: 100%; display: block;"
          class="cursor-crosshair select-none"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
        />
      </div>

      <div class="text-sm text-gray-600 dark:text-gray-300">
        <template v-if="mode === 'tap'">
          <div v-if="isZone && zoneComplete" class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
            <i class="i-bi-bounding-box"></i>
            <span>随机点击区域: {{ zoneWidth }}×{{ zoneHeight }}px · 中心点: ({{ zoneCenter.x }}, {{ zoneCenter.y }})</span>
          </div>
          <div v-else-if="selection.x != null" class="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium">
            <i class="i-bi-crosshair"></i>
            <span>精准点击坐标: X: {{ selection.x }}, Y: {{ selection.y }}</span>
          </div>
          <span v-else class="text-gray-400">点击画面拾取单点，或按住拖动框选随机区域</span>
        </template>
        <template v-else>
          <div v-if="selection.startX != null && selection.endX != null" class="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium">
            <i class="i-bi-arrow-down-right"></i>
            <span>滑动轨迹: ({{ selection.startX }}, {{ selection.startY }}) → ({{ selection.endX }}, {{ selection.endY }})</span>
          </div>
          <span v-else class="text-gray-400">在画面上按住并拖动，绘制滑动轨迹</span>
        </template>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('close')">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useDeviceStore } from '$/store/device/index.js'

const props = defineProps({
  deviceId: {
    type: String,
    default: '',
  },
  mode: {
    type: String,
    default: 'tap', // 'tap' | 'swipe'
  },
})

const emit = defineEmits(['close', 'confirm'])

const deviceStore = useDeviceStore()
const canvasRef = ref(null)
const loading = ref(true)
const error = ref('')
const image = ref(null)
const screenSize = ref(null)
const selection = ref({})
const dragging = ref(false)
const dragStartPoint = ref(null)
const isZone = ref(false)

// ── Target device resolution ────────────────────────────────────────────────
const targetDeviceId = computed(() => {
  if (props.deviceId && props.deviceId !== 'common' && props.deviceId !== 'device_exclusive') {
    return props.deviceId
  }
  const online = deviceStore.list.find(d => d.status === 'device')
  return online?.id || deviceStore.list[0]?.id || ''
})

const targetDeviceName = computed(() => {
  if (!targetDeviceId.value)
    return '未连接设备'
  return deviceStore.getLabel(targetDeviceId.value, 'name') || targetDeviceId.value
})

// ── Computed helpers ─────────────────────────────────────────────────────────

const alertInstruction = computed(() => {
  if (props.mode === 'swipe')
    return '💡 滑动拾取：按住并拖动绘制滑动起始点与终点'
  return '💡 点击拾取：单点点击拾取精准坐标；按住拖动可框选随机点击区域'
})

const zoneComplete = computed(() =>
  selection.value.startX != null && selection.value.endX != null,
)

const zoneWidth = computed(() =>
  zoneComplete.value ? Math.abs(selection.value.endX - selection.value.startX) : 0,
)

const zoneHeight = computed(() =>
  zoneComplete.value ? Math.abs(selection.value.endY - selection.value.startY) : 0,
)

const zoneCenter = computed(() => ({
  x: zoneComplete.value ? Math.round((selection.value.startX + selection.value.endX) / 2) : 0,
  y: zoneComplete.value ? Math.round((selection.value.startY + selection.value.endY) / 2) : 0,
}))

const canConfirm = computed(() => {
  if (props.mode === 'tap') {
    if (isZone.value)
      return zoneComplete.value && zoneWidth.value > 4 && zoneHeight.value > 4
    return selection.value.x != null
  }
  return selection.value.startX != null && selection.value.endX != null
})

// ── Load screenshot ──────────────────────────────────────────────────────────

async function loadScreenshot() {
  loading.value = true
  error.value = ''
  selection.value = {}
  isZone.value = false

  try {
    const devId = targetDeviceId.value
    if (!devId) {
      throw new Error('未检测到连接中的设备，请确保手机已通过 USB 或 WiFi 连接并开启 USB 调试！')
    }

    const adb = window.$preload.adb
    let base64 = null
    let size = null

    try {
      [base64, size] = await Promise.all([
        adb.screencap(devId, { returnBase64: true }),
        adb.getScreenSize(devId).catch(() => null),
      ])
    }
    catch (err) {
      console.warn('Initial screencap failed, attempting wakeup...', err)
    }

    // If screencap was empty, try waking up the screen
    if (!base64 || base64.length < 100) {
      try {
        await adb.deviceShell(devId, 'input keyevent 224')
        await new Promise(resolve => setTimeout(resolve, 500))
        base64 = await adb.screencap(devId, { returnBase64: true })
      }
      catch (e) {
        console.warn('Auto wakeup failed:', e)
      }
    }

    if (!base64 || base64.length < 100) {
      throw new Error(window.t('automation.picker.error.empty') || '未能获取到设备屏幕图像，请点亮手机屏幕后重试')
    }

    if (!size) {
      size = await adb.getScreenSize(devId).catch(() => null)
    }
    screenSize.value = size

    const cleanBase64 = String(base64).trim().replace(/\s+/g, '')
    const imgSrc = cleanBase64.startsWith('data:')
      ? cleanBase64
      : `data:image/png;base64,${cleanBase64}`

    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('屏幕画面解析失败，请重试'))
      img.src = imgSrc
    })

    image.value = img
    loading.value = false
    nextTick(() => {
      drawCanvas()
    })
  }
  catch (err) {
    error.value = err?.message || String(err)
    loading.value = false
  }
}

onMounted(() => {
  loadScreenshot()
})

// ── Canvas coordinate mapping ────────────────────────────────────────────────

function getCanvasPoint(event) {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const canvasX = (event.clientX - rect.left) * scaleX
  const canvasY = (event.clientY - rect.top) * scaleY

  let screenW = screenSize.value?.width || canvas.width
  let screenH = screenSize.value?.height || canvas.height

  const isImageLandscape = canvas.width > canvas.height
  const isScreenLandscape = screenW > screenH
  if (isImageLandscape !== isScreenLandscape) {
    const temp = screenW
    screenW = screenH
    screenH = temp
  }

  const deviceX = Math.round((canvasX / canvas.width) * screenW)
  const deviceY = Math.round((canvasY / canvas.height) * screenH)

  return { canvasX, canvasY, deviceX, deviceY }
}

// ── Draw canvas ──────────────────────────────────────────────────────────────

function drawCanvas() {
  const canvas = canvasRef.value
  const img = image.value
  if (!canvas || !img)
    return

  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  // tap mode with single point (not a zone)
  if (props.mode === 'tap' && !isZone.value && selection.value.canvasX != null) {
    const cx = selection.value.canvasX
    const cy = selection.value.canvasY

    // Target reticle
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.stroke()

    // Cross lines
    ctx.beginPath()
    ctx.moveTo(cx - 30, cy)
    ctx.lineTo(cx + 30, cy)
    ctx.moveTo(cx, cy - 30)
    ctx.lineTo(cx, cy + 30)
    ctx.stroke()

    // Solid center dot
    ctx.fillStyle = 'rgba(239, 68, 68, 0.95)'
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // tap mode with dragged zone
  if (props.mode === 'tap' && isZone.value && selection.value.startCanvasX != null) {
    const sx = selection.value.startCanvasX
    const sy = selection.value.startCanvasY
    const ex = selection.value.endCanvasX ?? sx
    const ey = selection.value.endCanvasY ?? sy
    const rx = Math.min(sx, ex)
    const ry = Math.min(sy, ey)
    const rw = Math.abs(ex - sx)
    const rh = Math.abs(ey - sy)

    // Semi-transparent blue fill
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(rx, ry, rw, rh)

    // Dashed blue border
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.95)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 4])
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.setLineDash([])

    // Corner squares
    const cs = 7
    ctx.fillStyle = 'rgba(59, 130, 246, 1)'
    ;[[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([cx, cy]) => {
      ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs)
    })

    // Center bullseye
    if (selection.value.endCanvasX != null) {
      const cx = (sx + ex) / 2
      const cy = (sy + ey) / 2
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(cx, cy, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)'
      ctx.beginPath()
      ctx.arc(cx, cy, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  // swipe mode: line with arrow
  if (props.mode === 'swipe' && selection.value.startCanvasX != null) {
    const sx = selection.value.startCanvasX
    const sy = selection.value.startCanvasY
    const ex = selection.value.endCanvasX ?? sx
    const ey = selection.value.endCanvasY ?? sy

    // Start point
    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'
    ctx.beginPath()
    ctx.arc(sx, sy, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()

    // Line
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    // End point
    if (selection.value.endCanvasX != null) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'
      ctx.beginPath()
      ctx.arc(ex, ey, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

// ── Mouse event handlers ─────────────────────────────────────────────────────

function onMouseDown(event) {
  dragging.value = true
  const point = getCanvasPoint(event)
  dragStartPoint.value = point

  if (props.mode === 'tap') {
    isZone.value = false
    selection.value = {
      x: point.deviceX,
      y: point.deviceY,
      canvasX: point.canvasX,
      canvasY: point.canvasY,
      startX: point.deviceX,
      startY: point.deviceY,
      startCanvasX: point.canvasX,
      startCanvasY: point.canvasY,
    }
  }
  else {
    selection.value = {
      startX: point.deviceX,
      startY: point.deviceY,
      startCanvasX: point.canvasX,
      startCanvasY: point.canvasY,
    }
  }
  drawCanvas()
}

function onMouseMove(event) {
  if (!dragging.value || !dragStartPoint.value)
    return
  const point = getCanvasPoint(event)
  const dist = Math.hypot(point.canvasX - dragStartPoint.value.canvasX, point.canvasY - dragStartPoint.value.canvasY)

  if (props.mode === 'tap') {
    if (dist > 8) {
      isZone.value = true
      selection.value = {
        ...selection.value,
        endX: point.deviceX,
        endY: point.deviceY,
        endCanvasX: point.canvasX,
        endCanvasY: point.canvasY,
      }
    }
  }
  else {
    selection.value = {
      ...selection.value,
      endX: point.deviceX,
      endY: point.deviceY,
      endCanvasX: point.canvasX,
      endCanvasY: point.canvasY,
    }
  }
  drawCanvas()
}

function onMouseUp(event) {
  if (!dragging.value || !dragStartPoint.value)
    return
  dragging.value = false
  const point = getCanvasPoint(event)
  const dist = Math.hypot(point.canvasX - dragStartPoint.value.canvasX, point.canvasY - dragStartPoint.value.canvasY)

  if (props.mode === 'tap') {
    if (dist <= 8) {
      isZone.value = false
      selection.value = {
        x: dragStartPoint.value.deviceX,
        y: dragStartPoint.value.deviceY,
        canvasX: dragStartPoint.value.canvasX,
        canvasY: dragStartPoint.value.canvasY,
      }
    }
    else {
      isZone.value = true
      selection.value = {
        startX: dragStartPoint.value.deviceX,
        startY: dragStartPoint.value.deviceY,
        startCanvasX: dragStartPoint.value.canvasX,
        startCanvasY: dragStartPoint.value.canvasY,
        endX: point.deviceX,
        endY: point.deviceY,
        endCanvasX: point.canvasX,
        endCanvasY: point.canvasY,
        x: Math.round((dragStartPoint.value.deviceX + point.deviceX) / 2),
        y: Math.round((dragStartPoint.value.deviceY + point.deviceY) / 2),
      }
    }
  }
  else {
    selection.value = {
      startX: dragStartPoint.value.deviceX,
      startY: dragStartPoint.value.deviceY,
      startCanvasX: dragStartPoint.value.canvasX,
      startCanvasY: dragStartPoint.value.canvasY,
      endX: point.deviceX,
      endY: point.deviceY,
      endCanvasX: point.canvasX,
      endCanvasY: point.canvasY,
    }
  }
  drawCanvas()
}

// ── Confirm ──────────────────────────────────────────────────────────────────

function handleConfirm() {
  const baseSize = {
    baseWidth: screenSize.value?.width || null,
    baseHeight: screenSize.value?.height || null,
  }

  if (props.mode === 'tap') {
    if (isZone.value && zoneWidth.value > 4 && zoneHeight.value > 4) {
      const x1 = Math.min(selection.value.startX, selection.value.endX)
      const y1 = Math.min(selection.value.startY, selection.value.endY)
      const x2 = Math.max(selection.value.startX, selection.value.endX)
      const y2 = Math.max(selection.value.startY, selection.value.endY)
      emit('confirm', {
        x: Math.round((x1 + x2) / 2),
        y: Math.round((y1 + y2) / 2),
        tapZone: { x1, y1, x2, y2 },
        ...baseSize,
      })
    }
    else {
      emit('confirm', {
        x: selection.value.x,
        y: selection.value.y,
        tapZone: null,
        ...baseSize,
      })
    }
  }
  else {
    emit('confirm', {
      startX: selection.value.startX,
      startY: selection.value.startY,
      endX: selection.value.endX,
      endY: selection.value.endY,
      ...baseSize,
    })
  }
}
</script>

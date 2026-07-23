<template>
  <el-dialog
    :model-value="true"
    :title="$t('automation.picker.screenshot')"
    width="450px"
    class="el-dialog--beautify"
    append-to-body
    destroy-on-close
    @close="$emit('close')"
  >
    <div v-if="loading" class="h-64 flex items-center justify-center">
      <div class="text-center">
        <div class="i-ep-loading animate-spin size-8 mx-auto mb-2"></div>
        <div>{{ $t('automation.picker.loading') }}</div>
      </div>
    </div>

    <div v-else-if="error" class="h-32 flex items-center justify-center text-red-500">
      {{ $t('automation.picker.error.title') }}: {{ error }}
    </div>

    <div v-else class="space-y-3">
      <el-alert
        :title="alertInstruction"
        type="info"
        :closable="false"
      />

      <div class="mx-auto border dark:border-gray-700 rounded overflow-auto" style="max-width: 100%; max-height: 55vh; width: fit-content;">
        <canvas
          ref="canvasRef"
          style="max-width: 100%; display: block;"
          class="cursor-crosshair"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @click="onClick"
        />
      </div>

      <div class="text-sm text-gray-500">
        <template v-if="mode === 'tap'">
          <span v-if="selection.x != null">{{ $t('automation.step.x') }}: {{ selection.x }}, {{ $t('automation.step.y') }}: {{ selection.y }}</span>
          <span v-else>{{ $t('automation.picker.noSelection') }}</span>
        </template>
        <template v-else-if="mode === 'tapZone'">
          <div v-if="zoneComplete" class="text-blue-600 dark:text-blue-400">
            {{ $t('automation.step.tapZone') }}: {{ zoneWidth }}×{{ zoneHeight }}px
            · {{ $t('automation.picker.center') }}: ({{ zoneCenter.x }}, {{ zoneCenter.y }})
          </div>
          <span v-else>{{ $t('automation.picker.noSelection') }}</span>
        </template>
        <template v-else>
          <div v-if="selection.startX != null">
            {{ $t('automation.picker.start') }}: ({{ selection.startX }}, {{ selection.startY }})
            → {{ $t('automation.picker.end') }}: ({{ selection.endX }}, {{ selection.endY }})
          </div>
          <span v-else>{{ $t('automation.picker.noSelection') }}</span>
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

const props = defineProps({
  deviceId: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    default: 'tap', // 'tap' | 'tapZone' | 'swipe'
  },
})

const emit = defineEmits(['close', 'confirm'])

const canvasRef = ref(null)
const loading = ref(true)
const error = ref('')
const image = ref(null)
const screenSize = ref(null)
const selection = ref({})
const dragging = ref(false)

// ── Computed helpers ─────────────────────────────────────────────────────────

const alertInstruction = computed(() => {
  if (props.mode === 'swipe')
    return window.t('automation.picker.instruction.swipe')
  if (props.mode === 'tapZone')
    return window.t('automation.picker.instruction.tapZone')
  return window.t('automation.picker.instruction.point')
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
  if (props.mode === 'tap')
    return selection.value.x != null
  if (props.mode === 'tapZone')
    return zoneComplete.value && zoneWidth.value > 4 && zoneHeight.value > 4
  return selection.value.startX != null && selection.value.endX != null
})

// ── Load screenshot ──────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const adb = window.$preload.adb
    let [base64, size] = await Promise.all([
      adb.screencap(props.deviceId, { returnBase64: true }),
      adb.getScreenSize(props.deviceId),
    ])

    if (!base64 || base64.length < 100) {
      try {
        await adb.deviceShell(props.deviceId, 'input keyevent 224')
        await new Promise(resolve => setTimeout(resolve, 500))
        base64 = await adb.screencap(props.deviceId, { returnBase64: true })
      }
      catch (e) {
        console.warn('Auto wakeup failed:', e)
      }
    }

    if (!base64 || base64.length < 100) {
      throw new Error(window.t('automation.picker.error.empty'))
    }

    screenSize.value = size
    const img = new Image()
    img.src = `data:image/png;base64,${base64}`
    await img.decode()
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

  // tap mode: bold red dot
  if (props.mode === 'tap' && selection.value.canvasX != null) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'
    ctx.beginPath()
    ctx.arc(selection.value.canvasX, selection.value.canvasY, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }

  // tapZone mode: dashed blue rectangle + bold red center dot
  if (props.mode === 'tapZone' && selection.value.startCanvasX != null) {
    const sx = selection.value.startCanvasX
    const sy = selection.value.startCanvasY
    const ex = selection.value.endCanvasX ?? sx
    const ey = selection.value.endCanvasY ?? sy
    const rx = Math.min(sx, ex)
    const ry = Math.min(sy, ey)
    const rw = Math.abs(ex - sx)
    const rh = Math.abs(ey - sy)

    // Semi-transparent blue fill
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
    ctx.fillRect(rx, ry, rw, rh)

    // Dashed blue border
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 5])
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.setLineDash([])

    // Corner squares
    const cs = 8
    ctx.fillStyle = 'rgba(59, 130, 246, 1)'
    ;[[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([cx, cy]) => {
      ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs)
    })

    // Bold red center dot (only once zone has extent)
    if (selection.value.endCanvasX != null) {
      const cx = (sx + ex) / 2
      const cy = (sy + ey) / 2
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(cx, cy, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(239, 68, 68, 0.95)'
      ctx.beginPath()
      ctx.arc(cx, cy, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx - 6, cy)
      ctx.lineTo(cx + 6, cy)
      ctx.moveTo(cx, cy - 6)
      ctx.lineTo(cx, cy + 6)
      ctx.stroke()
    }
  }

  // swipe mode: red line
  if (props.mode === 'swipe' && selection.value.startCanvasX != null) {
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(selection.value.startCanvasX, selection.value.startCanvasY)
    ctx.lineTo(
      selection.value.endCanvasX || selection.value.startCanvasX,
      selection.value.endCanvasY || selection.value.startCanvasY,
    )
    ctx.stroke()
  }
}

// ── Mouse event handlers ─────────────────────────────────────────────────────

function onClick(event) {
  if (props.mode !== 'tap')
    return
  const point = getCanvasPoint(event)
  selection.value = {
    x: point.deviceX,
    y: point.deviceY,
    canvasX: point.canvasX,
    canvasY: point.canvasY,
  }
  drawCanvas()
}

function onMouseDown(event) {
  if (props.mode !== 'swipe' && props.mode !== 'tapZone')
    return
  dragging.value = true
  const point = getCanvasPoint(event)
  selection.value = {
    startX: point.deviceX,
    startY: point.deviceY,
    startCanvasX: point.canvasX,
    startCanvasY: point.canvasY,
  }
  drawCanvas()
}

function onMouseMove(event) {
  if (!dragging.value || (props.mode !== 'swipe' && props.mode !== 'tapZone'))
    return
  const point = getCanvasPoint(event)
  selection.value = {
    ...selection.value,
    endX: point.deviceX,
    endY: point.deviceY,
    endCanvasX: point.canvasX,
    endCanvasY: point.canvasY,
  }
  drawCanvas()
}

function onMouseUp(event) {
  if (!dragging.value || (props.mode !== 'swipe' && props.mode !== 'tapZone'))
    return
  dragging.value = false
  const point = getCanvasPoint(event)
  selection.value = {
    ...selection.value,
    endX: point.deviceX,
    endY: point.deviceY,
    endCanvasX: point.canvasX,
    endCanvasY: point.canvasY,
  }
  drawCanvas()
}

// ── Confirm ──────────────────────────────────────────────────────────────────

function handleConfirm() {
  if (props.mode === 'tap') {
    emit('confirm', { x: selection.value.x, y: selection.value.y })
  }
  else if (props.mode === 'tapZone') {
    const x1 = Math.min(selection.value.startX, selection.value.endX)
    const y1 = Math.min(selection.value.startY, selection.value.endY)
    const x2 = Math.max(selection.value.startX, selection.value.endX)
    const y2 = Math.max(selection.value.startY, selection.value.endY)
    emit('confirm', {
      x: Math.round((x1 + x2) / 2),
      y: Math.round((y1 + y2) / 2),
      tapZone: { x1, y1, x2, y2 },
    })
  }
  else {
    emit('confirm', {
      startX: selection.value.startX,
      startY: selection.value.startY,
      endX: selection.value.endX,
      endY: selection.value.endY,
    })
  }
}
</script>

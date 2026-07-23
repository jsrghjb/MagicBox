import { computed, ref, watch } from 'vue'
import { useScaleScreen } from '$/hooks/useScaleScreen/index.js'
import {
  hasSavedArrangeLayout,
  loadDeviceLayoutWidgets,
} from '$/utils/arrange-layout.js'

/**
 * 集群视图布局：支持自适应网格对齐与桌面编排对齐。
 */
export function useClusterLayout(devicesRef, containerRef, layoutRevisionRef) {
  const useGridMode = ref(true)
  const aspectMode = computed(() => useGridMode.value ? 'fill' : 'height')

  const {
    scaleConverter,
    containerWidth,
    containerHeight,
    screenWidth,
    screenHeight,
    getPrimaryDisplay,
  } = useScaleScreen({ containerRef, aspectMode })

  const widgets = ref([])

  function rebuildLayout() {
    const sw = screenWidth.value
    const sh = screenHeight.value

    if (!devicesRef.value.length || !sw || !sh) {
      widgets.value = []
      return
    }

    if (useGridMode.value) {
      const N = devicesRef.value.length

      let bestCols = 1
      let bestRows = 1
      let maxScale = 0

      for (let c = 1; c <= N; c++) {
        const r = Math.ceil(N / c)
        const cellW = containerWidth.value / c
        const cellH = containerHeight.value / r

        let minScale = Infinity
        devicesRef.value.forEach((device) => {
          const devWidth = device.screenWidth || device.width || 1080
          const devHeight = device.screenHeight || device.height || 1920
          const aspect = devWidth / devHeight

          let h = cellW / aspect
          if (h > cellH) {
            h = cellH
          }
          const scale = h / devHeight
          if (scale < minScale) {
            minScale = scale
          }
        })

        if (minScale > maxScale) {
          maxScale = minScale
          bestCols = c
          bestRows = r
        }
      }

      widgets.value = devicesRef.value.map((device, index) => {
        const devWidth = device.screenWidth || device.width || 1080
        const devHeight = device.screenHeight || device.height || 1920
        const aspect = devWidth / devHeight

        const col = index % bestCols
        const row = Math.floor(index / bestCols)

        const cellW = containerWidth.value / bestCols
        const cellH = containerHeight.value / bestRows

        let itemW = cellW
        let itemH = cellW / aspect
        if (itemH > cellH) {
          itemH = cellH
          itemW = cellH * aspect
        }

        const x = col * cellW + (cellW - itemW) / 2
        const y = row * cellH + (cellH - itemH) / 2

        return {
          id: device.id || device.serial,
          deviceId: device.id || device.serial,
          serial: device.id || device.serial,
          x,
          y,
          width: itemW,
          height: itemH,
        }
      })
      return
    }

    const onlySavedLayout = false
    widgets.value = loadDeviceLayoutWidgets(devicesRef.value, {
      screenWidth: sw,
      screenHeight: sh,
      scaleConverter,
      onlySavedLayout,
    })
  }

  watch(
    () => [
      devicesRef.value,
      layoutRevisionRef?.value,
      screenWidth.value,
      screenHeight.value,
      useGridMode.value,
      containerWidth.value,
      containerHeight.value,
    ],
    rebuildLayout,
    { deep: true, flush: 'post' },
  )

  const layoutItems = computed(() => widgets.value.map(widget => ({
    serial: widget.deviceId || widget.serial || widget.id,
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
  })))

  const screenContainerStyle = computed(() => ({
    width: `${containerWidth.value}px`,
    height: `${containerHeight.value - 1}px`,
  }))

  const usesArrangeLayout = computed(() => {
    void layoutRevisionRef?.value
    return !useGridMode.value && devicesRef.value.some(device => hasSavedArrangeLayout(device))
  })

  async function remeasureLayout() {
    await getPrimaryDisplay()
    if (layoutRevisionRef)
      layoutRevisionRef.value += 1
    rebuildLayout()
  }

  return {
    layoutItems,
    screenContainerStyle,
    usesArrangeLayout,
    remeasureLayout,
    containerWidth,
    containerHeight,
    useGridMode,
  }
}

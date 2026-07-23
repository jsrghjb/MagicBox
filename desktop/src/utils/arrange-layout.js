/**
 * 窗口编排与集群视图共用的布局计算，保证坐标系与 scrcpy store 一致。
 */

export function scaleDeviceScreenSize(device, screenWidth, screenHeight) {
  const sw = screenWidth || 0
  const sh = screenHeight || 0
  const dw = device?.screenWidth ?? device?.width ?? 0
  const dh = device?.screenHeight ?? device?.height ?? 0

  if (!sw || !sh)
    return { width: dw, height: dh }

  if (!dw || !dh)
    return { width: dw, height: dh }

  const scale = Math.min(sh / 2 / dh, sw / dw, 1)

  return {
    width: Math.round(dw * scale),
    height: Math.round(dh * scale),
  }
}

export function createWidgetFromConfig(config = {}, widgetData = {}, options = {}) {
  const {
    screenWidth = 0,
    screenHeight = 0,
    scaleConverter,
    widgetCount = 0,
  } = options

  const cfgW = config['--window-width'] != null ? Number(config['--window-width']) : null
  const cfgH = config['--window-height'] != null ? Number(config['--window-height']) : null
  const cfgX = config['--window-x'] != null ? Number(config['--window-x']) : null
  const cfgY = config['--window-y'] != null ? Number(config['--window-y']) : null

  const realWidth = cfgW ?? widgetData.deviceScreenWidth ?? (screenWidth / 6)
  const realHeight = cfgH ?? widgetData.deviceScreenHeight ?? (screenHeight / 2)
  const realX = cfgX ?? (widgetCount * 50)
  const realY = cfgY ?? (widgetCount * 50)
  const lockAspectRatio = widgetData.lockAspectRatio ?? false

  const containerRect = scaleConverter({
    width: realWidth,
    height: realHeight,
    x: realX,
    y: realY,
  })

  return {
    ...widgetData,
    x: containerRect.x,
    y: containerRect.y,
    width: containerRect.width,
    height: containerRect.height,
    realX,
    realY,
    realWidth,
    realHeight,
    lockAspectRatio,
  }
}

export function updateLayoutWidgets(widgets, scaleConverter) {
  if (!widgets?.length)
    return false

  widgets.forEach((widget) => {
    const containerRect = scaleConverter({
      x: widget.realX,
      y: widget.realY,
      width: widget.realWidth,
      height: widget.realHeight,
    })

    widget.x = containerRect.x
    widget.y = containerRect.y
    widget.width = containerRect.width
    widget.height = containerRect.height
  })

  return true
}

/**
 * 从 scrcpy store 加载设备窗口布局，顺序与设备列表传入顺序一致。
 * @param {Array} devices
 * @param {{ screenWidth: number, screenHeight: number, scaleConverter: Function, onlySavedLayout?: boolean }} options
 */
export function loadDeviceLayoutWidgets(devices, options) {
  const {
    screenWidth,
    screenHeight,
    scaleConverter,
    onlySavedLayout = false,
  } = options

  const scrcpy = window.$preload.store.get('scrcpy') || {}
  const widgets = []

  devices.forEach((device) => {
    const deviceId = device.id || device.serial
    const deviceConfig = scrcpy[deviceId] || {}
    const hasSavedLayout = deviceConfig['--window-width'] != null && deviceConfig['--window-height'] != null

    if (onlySavedLayout && !hasSavedLayout)
      return

    const dw = device.screenWidth ?? device.width ?? 0
    const dh = device.screenHeight ?? device.height ?? 0
    const deviceScreen = scaleDeviceScreenSize(device, screenWidth, screenHeight)

    widgets.push(createWidgetFromConfig(
      hasSavedLayout ? deviceConfig : {},
      {
        id: deviceId,
        deviceId,
        serial: deviceId,
        type: 'device',
        name: device.name || device.model?.split?.(':')?.[1] || deviceId,
        deviceScreenWidth: deviceScreen.width ?? null,
        deviceScreenHeight: deviceScreen.height ?? null,
        lockAspectRatio: !!(dw && dh),
      },
      {
        screenWidth,
        screenHeight,
        scaleConverter,
        widgetCount: widgets.length,
      },
    ))
  })

  return widgets
}

export function getDeviceArrangeConfig(device) {
  const scrcpy = window.$preload.store.get('scrcpy') || {}
  return scrcpy[device?.id || device?.serial] || {}
}

export function hasSavedArrangeLayout(device) {
  const config = getDeviceArrangeConfig(device)
  return !!(config['--window-width'] && config['--window-height'])
}

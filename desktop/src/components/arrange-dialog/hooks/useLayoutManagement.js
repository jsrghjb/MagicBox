import {
  createWidgetFromConfig as createWidgetFromConfigBase,
  updateLayoutWidgets,
} from '$/utils/arrange-layout.js'

/**
 * Layout management composable
 * Handles loading and creating widget layouts
 */
export function useLayoutManagement(options) {
  const {
    screenWidth,
    screenHeight,
    scaleConverter,
    arrangedWidgets,
    allDevices,
  } = options

  const createWidgetFromConfig = (config = {}, widgetData = {}) => {
    return createWidgetFromConfigBase(config, widgetData, {
      screenWidth: screenWidth.value,
      screenHeight: screenHeight.value,
      scaleConverter,
      widgetCount: arrangedWidgets.value.length,
    })
  }

  function loadLayout() {
    arrangedWidgets.value = []
    const scrcpy = window.$preload.store.get('scrcpy')

    const globalConfig = scrcpy.global || {}
    if (globalConfig['--window-width'] && globalConfig['--window-height']) {
      const widget = createWidgetFromConfig(globalConfig, {
        id: 'global',
        type: 'global',
        name: 'Global',
      })
      arrangedWidgets.value.push(widget)
    }

    allDevices.value.forEach((device) => {
      const deviceConfig = scrcpy[device.id] || {}
      if (deviceConfig['--window-width'] && deviceConfig['--window-height']) {
        const widget = createWidgetFromConfig(deviceConfig, {
          id: device.id,
          type: 'device',
          deviceId: device.id,
          name: device.name || device.model?.split(':')[1] || device.id,
          lockAspectRatio: !!(device.screenWidth && device.screenHeight),
        })
        arrangedWidgets.value.push(widget)
      }
    })
  }

  function updateLayout() {
    updateLayoutWidgets(arrangedWidgets.value, scaleConverter)
  }

  return {
    createWidgetFromConfig,
    loadLayout,
    updateLayout,
  }
}

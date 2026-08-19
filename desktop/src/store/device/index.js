import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import { capitalize } from 'lodash-es'
import { name as packageName } from '$root/package.json'
import {
  getCurrentDevices,
  mergeDevices,
  saveDevicesToStore,
} from './helpers/index.js'

const $electronStore = window.$preload.store

export const useDeviceStore = defineStore('app-device', () => {
  const list = ref([])
  const config = ref({})

  function init() {
    config.value = {
      ...($electronStore.get('device') || {}),
    }
    $electronStore.set('removedDeviceIds', [])
    return config.value
  }

  function getLabel(device, params) {
    const data = device?.id
      ? device
      : list.value.find(item => item.id === device)

    if (!data) {
      return ''
    }

    const appName = capitalize(packageName)
    const deviceSerial = data.id.replaceAll(/[<>:"/\\|?*]/g, '_')
    const deviceName = `${data.remark || data.name}[${deviceSerial}]`
    const currentTime = dayjs().format('YYYYMMDDHHmmss')
    let value = `${deviceName}-${appName}`

    const createPreset = type => `${deviceName}-${capitalize(type)}-${appName}`

    const presets = {
      screenshot: `${deviceName}-Screenshot-${currentTime}`,
      name: deviceName,
    }

    if (typeof params === 'function') {
      value = params({
        data,
        appName,
        deviceName,
        currentTime,
      })
    }
    else if (params && typeof params === 'string') {
      value = presets[params] || createPreset(params)
    }

    return value
  }

  async function getList(deviceLimit) {
    const currentDevices = await getCurrentDevices()
    const mergedDevices = mergeDevices([], currentDevices)
    saveDevicesToStore(mergedDevices)

    // 许可证设备数量限制（仅当传入 deviceLimit 时生效，undefined 表示不限制）
    let limitedDevices = mergedDevices
    if (deviceLimit != null && deviceLimit > 0 && limitedDevices.length > deviceLimit) {
      console.warn(`[device-store] 设备数 ${limitedDevices.length} > 许可证限制 ${deviceLimit}，截断显示`)
      limitedDevices = limitedDevices.slice(0, deviceLimit)
    }

    list.value = limitedDevices
    return limitedDevices
  }

  function setRemark(deviceId, value, serialNo) {
    if (!deviceId) {
      return
    }
    $electronStore.set(['device', deviceId, 'remark'], value)

    const targetSerial = serialNo || list.value.find(d => d.id === deviceId)?.serialNo
    if (targetSerial && targetSerial !== deviceId) {
      $electronStore.set(['device', targetSerial, 'remark'], value)
    }

    const item = list.value.find(d => d.id === deviceId || (targetSerial && d.serialNo === targetSerial))
    if (item) {
      item.remark = value
    }

    init()
  }

  /**
   * Resolve active connection ID for a given target (serialNo, old IP, or device object).
   * Automatically handles IP changes / transport mode shifts!
   */
  function resolveActiveDevice(targetId) {
    if (!targetId) {
      return null
    }
    const target = typeof targetId === 'object' ? (targetId.serialNo || targetId.id) : targetId

    // 1. Find currently active/online device matching serialNo, id, or historyIps
    const onlineMatch = list.value.find(
      d => (d.id === target || d.serialNo === target || d.historyIps?.includes(target)) && d.status === 'device',
    )
    if (onlineMatch) {
      return onlineMatch.id
    }

    // 2. Fallback: match any device in list
    const anyMatch = list.value.find(
      d => d.id === target || d.serialNo === target || d.historyIps?.includes(target),
    )
    if (anyMatch) {
      return anyMatch.id
    }

    return target
  }

  return {
    list,
    config,
    init,
    getLabel,
    getList,
    setRemark,
    resolveActiveDevice,
  }
})

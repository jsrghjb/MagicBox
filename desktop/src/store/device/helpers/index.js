import { deviceStatus as deviceStatusDict } from '$/dicts/device/index.js'

/**
 * Retrieve device name
 */
export function getDeviceName(device) {
  return device.product ? device.product.split(':')[1] : 'Unauthorized device'
}

/**
 * Get device remark
 */
export function getRemark(deviceId, serialNo) {
  const store = window.$preload.store.get('device') || {}
  const value = store[deviceId]?.remark || (serialNo ? store[serialNo]?.remark : null)
  return value
}

/**
 * Get history devices list
 */
export function getHistoryDevices() {
  const devices = window.$preload.store.get('device') || {}

  const value = Object.values(devices).map(device => ({
    ...device,
  }))

  return value
}

/**
 * Get currently connected devices
 */
export async function getCurrentDevices() {
  const devices = (await window.$preload.adb.getDeviceList()) || []

  return devices.map((device) => {
    const remark = getRemark(device.id, device.serialNo)
    return {
      ...device,
      id: device.id,
      status: device.type,
      name: getDeviceName(device),
      wifi: ([':', '_adb-tls-connect']).some(item => device.id.includes(item)),
      remark,
    }
  })
}

export const deviceSortModel = deviceStatusDict.reduce((obj, item, index) => {
  obj[item.value] = index
  return obj
}, {})

/**
 * Merge history and current device lists by physical hardware serialNo
 * @param {Array} historyDevices - History devices list
 * @param {Array} currentDevices - Current devices list
 * @returns {Array} Merged device list
 */
export function mergeDevices(historyDevices, currentDevices) {
  const mergedMap = new Map()

  // 1. Current active devices take highest priority
  currentDevices.forEach((curr) => {
    const key = curr.serialNo || curr.id
    mergedMap.set(key, { ...curr })
  })

  // 2. Merge history records by serialNo
  historyDevices.forEach((hist) => {
    const key = hist.serialNo || hist.id
    if (mergedMap.has(key)) {
      const active = mergedMap.get(key)
      mergedMap.set(key, {
        ...hist,
        ...active,
        historyIps: [...new Set([...(hist.historyIps || []), hist.id, active.id])].filter(Boolean),
        remark: active.remark || hist.remark,
      })
    }
    else {
      mergedMap.set(key, {
        ...hist,
        status: 'offline',
        type: 'offline',
      })
    }
  })

  const mergedDeviceList = [...mergedMap.values()]

  // Sort by device status (active device first)
  const sortedDeviceList = mergedDeviceList.sort(
    (a, b) => (deviceSortModel[a.status] ?? 99) - (deviceSortModel[b.status] ?? 99),
  )

  return sortedDeviceList
}

/**
 * Save device information to store
 */
export function saveDevicesToStore(devices) {
  const removedIds = window.$preload.store.get('removedDeviceIds') || []

  const cleanedDevices = devices
    .filter(device => !['unauthorized'].includes(device.status))
    .filter((device) => {
      const key = device.id || device.serialNo
      return !removedIds.includes(key) && !removedIds.includes(device.serialNo)
    })
    .map(device => ({
      ...device,
      status: 'offline',
      type: 'offline',
    }))

  const storeMap = {}
  cleanedDevices.forEach((dev) => {
    const key = dev.id || dev.serialNo
    storeMap[key] = dev
    if (dev.serialNo && dev.serialNo !== dev.id) {
      storeMap[dev.serialNo] = dev
    }
  })

  window.$preload.store.set('device', storeMap)
}

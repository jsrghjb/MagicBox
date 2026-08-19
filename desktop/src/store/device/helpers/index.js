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

  return devices
    .filter(device => device && !['offline'].includes(device.type) && !['offline'].includes(device.status))
    .map((device) => {
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
 * Merge and deduplicate current device list by physical hardware serialNo.
 * Offline devices are strictly excluded from the list.
 *
 * @param {Array} historyDevices - History devices (unused for offline injection)
 * @param {Array} currentDevices - Current devices list
 * @returns {Array} Deduplicated active device list
 */
export function mergeDevices(historyDevices, currentDevices) {
  const activeDevices = Array.isArray(currentDevices)
    ? currentDevices
    : (Array.isArray(historyDevices) ? historyDevices : [])

  const mergedMap = new Map()

  activeDevices.forEach((curr) => {
    if (!curr || ['offline'].includes(curr.status) || ['offline'].includes(curr.type)) {
      return
    }

    // Key by physical serialNo if available and valid, otherwise fallback to id
    const serialKey = curr.serialNo && curr.serialNo !== 'unknown' ? curr.serialNo : null
    const key = serialKey || curr.id

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)
      // Prioritize USB connection over WiFi if both are connected simultaneously
      const preferCurrent = !curr.wifi && existing.wifi
      const primary = preferCurrent ? curr : existing
      const secondary = preferCurrent ? existing : curr

      const historyIps = [
        ...(primary.historyIps || []),
        ...(secondary.historyIps || []),
        primary.id,
        secondary.id,
      ].filter(id => id && (id.includes(':') || id.includes('.')))

      mergedMap.set(key, {
        ...secondary,
        ...primary,
        historyIps: [...new Set(historyIps)],
        remark: primary.remark || secondary.remark || getRemark(primary.id, primary.serialNo),
      })
    }
    else {
      mergedMap.set(key, {
        ...curr,
        historyIps: curr.wifi ? [curr.id] : (curr.historyIps || []),
        remark: curr.remark || getRemark(curr.id, curr.serialNo),
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
 * Save device metadata to store without persisting offline ghost devices
 */
export function saveDevicesToStore(devices) {
  const store = window.$preload.store.get('device') || {}
  const storeMap = { ...store }

  devices.forEach((dev) => {
    if (!dev || ['offline'].includes(dev.status)) {
      return
    }
    const key = dev.id || dev.serialNo
    if (key) {
      storeMap[key] = {
        ...(storeMap[key] || {}),
        remark: dev.remark || storeMap[key]?.remark,
        name: dev.name || storeMap[key]?.name,
        serialNo: dev.serialNo || storeMap[key]?.serialNo,
      }
    }
    if (dev.serialNo && dev.serialNo !== dev.id) {
      storeMap[dev.serialNo] = {
        ...(storeMap[dev.serialNo] || {}),
        remark: dev.remark || storeMap[dev.serialNo]?.remark,
        name: dev.name || storeMap[dev.serialNo]?.name,
      }
    }
  })

  window.$preload.store.set('device', storeMap)
}

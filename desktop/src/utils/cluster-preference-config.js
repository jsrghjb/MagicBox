import {
  buildVideoServerOptions,
  getEffectiveMaxVideoSize,
  mergeDevicePreferenceData,
} from '@escrcpy/cluster-control/preference-video-config.js'

function getScrcpyScopeData(scope = 'global') {
  const scrcpy = window.$preload.store.get('scrcpy') || {}
  return scrcpy[scope] || {}
}

export function getMergedDevicePreferenceData(serial) {
  return mergeDevicePreferenceData(getScrcpyScopeData('global'), serial ? getScrcpyScopeData(serial) : {})
}

export function getDeviceMaxVideoSize(serial) {
  const preferenceData = getMergedDevicePreferenceData(serial)
  return getEffectiveMaxVideoSize(buildVideoServerOptions(preferenceData))
}

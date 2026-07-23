import electronStore from '$electron/helpers/store/index.js'
import {
  buildVideoServerOptions,
  mergeDevicePreferenceData,
} from '@escrcpy/cluster-control/preference-video-config.js'

function getScrcpyScopeData(scope = 'global') {
  const scrcpy = electronStore.get('scrcpy') || {}
  return scrcpy[scope] || {}
}

export function getMergedDevicePreferenceData(serial) {
  const globalPrefs = getScrcpyScopeData('global')
  const devicePrefs = serial ? getScrcpyScopeData(serial) : {}
  return mergeDevicePreferenceData(globalPrefs, devicePrefs)
}

export function getDeviceVideoServerOptions(serial) {
  const preferenceData = getMergedDevicePreferenceData(serial)
  return buildVideoServerOptions(preferenceData)
}

export function assertClusterVideoEnabled(serverOptions) {
  if (serverOptions.video === false) {
    throw new Error('cluster video disabled by preference (--no-video)')
  }
}

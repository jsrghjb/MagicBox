import { app } from 'electron'
import { extraResolve } from '$electron/process/resources.js'

export function getTrayPath() {
  switch (process.platform) {
    case 'win32':
      return extraResolve('win/tray/icon.png')
    case 'darwin':
      return extraResolve('mac/tray/iconTemplate.png')
    case 'linux':
      return extraResolve('linux/tray/icon.png')
    default:
      return ''
  }
}

export const trayPath = getTrayPath()

export const gnirehtetApkPath = extraResolve('common/gnirehtet/gnirehtet.apk')

export const adbKeyboardApkPath = extraResolve('common/adb-keyboard/ADBKeyboard.apk')

export const localesDir = extraResolve('common/locales/')

/**
 * Resolves a writable temp directory for transient automation artifacts
 * (e.g. screenshots used by find-image). Falls back to the OS tmp if the
 * app instance is not ready yet.
 */
export const tempPath = (() => {
  try {
    if (app?.isReady?.()) {
      return app.getPath('temp')
    }
  }
  catch {
    // ignore
  }
  return process.env.TMPDIR || process.env.TEMP || process.env.TMP || ''
})()

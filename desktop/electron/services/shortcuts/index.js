import { app, globalShortcut } from 'electron'
import store from '../../helpers/store/index.js'

let registeredShortcuts = []

function registerAll(mainApp) {
  unregisterAll()

  const automationConfig = store.get('automation') || {}
  const enable = automationConfig.enableHotkeys ?? false
  if (!enable)
    return

  for (let i = 1; i <= 5; i++) {
    const key = `hotkey${i}`
    const shortcut = automationConfig[key] || `CmdOrCtrl+Alt+${i}`
    if (!shortcut?.trim())
      continue

    try {
      const success = globalShortcut.register(shortcut, () => {
        console.log(`[shortcuts] Global shortcut ${shortcut} pressed. Triggering macro index ${i - 1}`)
        const mainWindow = mainApp.getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('trigger-macro', i - 1)
        }
      })
      if (success) {
        registeredShortcuts.push(shortcut)
      }
      else {
        console.warn(`[shortcuts] Failed to register global shortcut ${shortcut}`)
      }
    }
    catch (error) {
      console.error(`[shortcuts] Failed to register global shortcut ${shortcut}:`, error)
    }
  }
}

function unregisterAll() {
  for (const shortcut of registeredShortcuts) {
    try {
      globalShortcut.unregister(shortcut)
    }
    catch {}
  }
  registeredShortcuts = []
}

export default {
  name: 'service:shortcuts',
  async apply(mainApp) {
    app.whenReady().then(() => {
      registerAll(mainApp)

      store.onDidChange('automation', () => {
        console.log('[shortcuts] Preferences changed, reloading hotkeys...')
        registerAll(mainApp)
      })
    })

    app.on('will-quit', () => {
      globalShortcut.unregisterAll()
    })
  },
}

import { is } from '@electron-toolkit/utils'
import { app, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { DOWNLOAD_PAGE, UPDATE_FEED, devPublishPath } from '$electron/configs/index.js'

const { autoUpdater } = electronUpdater

function isMissingRelease(error) {
  const message = error?.message || String(error || '')
  return /404|No published versions|Cannot find channel|latest.*yml/i.test(message)
}

export default {
  name: 'service:updater',
  apply(mainApp) {
    if (is.dev) {
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.updateConfigPath = devPublishPath
    }

    autoUpdater.autoDownload = false
    autoUpdater.setFeedURL(UPDATE_FEED)

    ipcMain.on('check-for-update', () => {
      autoUpdater.checkForUpdates().catch((error) => {
        const mainWindow = mainApp.getMainWindow()
        if (isMissingRelease(error)) {
          mainWindow?.webContents?.send('update-not-available')
          return
        }
        mainWindow?.webContents?.send('update-error', error)
      })
    })

    ipcMain.on('download-update', () => {
      autoUpdater.downloadUpdate()
    })

    ipcMain.on('quit-and-install', () => {
      setImmediate(() => {
        app.isQuiting = true
        autoUpdater.quitAndInstall()
      })
    })

    ipcMain.on('open-download-page', () => {
      shell.openExternal(DOWNLOAD_PAGE)
    })

    autoUpdater.on('error', (error) => {
      console.error('update-error', error)
      const mainWindow = mainApp.getMainWindow()
      if (isMissingRelease(error)) {
        mainWindow?.webContents?.send('update-not-available')
        return
      }
      mainWindow?.webContents?.send('update-error', error)
    })

    autoUpdater.on('checking-for-update', (ret) => {
      console.log('checking-for-update', ret)
    })

    autoUpdater.on('update-available', (ret) => {
      const mainWindow = mainApp.getMainWindow()
      mainWindow?.webContents?.send('update-available', ret)
    })

    autoUpdater.on('update-not-available', (ret) => {
      const mainWindow = mainApp.getMainWindow()
      mainWindow?.webContents?.send('update-not-available', ret)
    })

    autoUpdater.on('download-progress', (ret) => {
      const mainWindow = mainApp.getMainWindow()
      mainWindow?.webContents?.send('download-progress', ret)
    })

    autoUpdater.on('update-downloaded', (ret) => {
      const mainWindow = mainApp.getMainWindow()
      mainWindow?.webContents?.send('update-downloaded', ret)
    })
  },
}

import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'

export default {
  name: 'service:listeners',
  apply() {
    ipcMain.on('restart-app', (event) => {
      if (is.dev) {
        console.log('[Dev Mode] restart-app is disabled because it kills the Vite dev server.')
        if (event && event.sender) {
          event.sender.send('dev-mode-warning', '开发环境下无法重启应用，这会导致 Vite 服务断开而白屏。请在终端手动重启。')
        }
        return
      }

      app.isQuiting = true
      app.releaseSingleInstanceLock()
      app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) })
      app.exit(0)
    })

    ipcMain.on('close-active-window', (event) => {
      const win = BrowserWindow.getFocusedWindow()

      if (win) {
        win.close()
      }
    })

    ipcMain.on('hide-active-window', (event) => {
      const win = BrowserWindow.getFocusedWindow()

      if (win) {
        win.hide()
      }
    })
  },
}

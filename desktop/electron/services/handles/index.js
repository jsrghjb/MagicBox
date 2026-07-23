import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron'
import fs from 'fs-extra'
import https from 'node:https'
import http from 'node:http'
import path from 'node:path'
import { openLogPath } from '$root/electron/helpers/debugger/index.js'
import { isWindowDestroyed } from '$electron/helpers/index.js'
import { findImageOnScreen } from './image-search.js'
import {
  getSecret,
  isSecureStorageAvailable,
  listSecretKeys,
  removeSecret,
  setSecret,
} from '$electron/helpers/secure-store/index.js'

export default {
  name: 'service:handles',
  apply(mainApp) {
    ipcMain.handle(
      'show-open-dialog',
      async (_, { preset = '', ...options } = {}) => {
        const res = await dialog
          .showOpenDialog(options)
          .catch(e => console.warn(e))

        if (res.canceled) {
          throw new Error('User cancel operation')
        }

        if (!res.filePaths.length) {
          throw new Error('Get the directory or file path failure')
        }

        const filePaths = res.filePaths

        switch (preset) {
          case 'replaceFile':
            await fs.copy(filePaths[0], options.filePath, { overwrite: true })
            break
        }

        return filePaths
      },
    )

    ipcMain.handle('open-path', async (_, pathValue) => {
      return shell.openPath(pathValue)
    })

    ipcMain.handle('show-item-in-folder', async (_, filePath) => {
      return shell.showItemInFolder(filePath)
    })

    ipcMain.handle('get-primary-display', async () => {
      const primaryDisplay = screen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor || 1

      primaryDisplay.titleBarHeight = Math.round(30 * scaleFactor)

      return primaryDisplay
    })

    ipcMain.handle(
      'show-save-dialog',
      async (_, { filePath = '', ...options } = {}) => {
        const res = await dialog
          .showSaveDialog({
            ...options,
          })
          .catch(e => console.warn(e))

        if (res.canceled) {
          throw new Error('User cancel operation')
        }

        if (!res.filePath) {
          throw new Error('Failure to obtain the file path')
        }

        const destinationPath = res.filePath

        await fs.copy(filePath, destinationPath)

        return true
      },
    )

    // Show save dialog and return the selected path only (no file copy)
    ipcMain.handle(
      'show-save-dialog-path',
      async (_, options = {}) => {
        const res = await dialog
          .showSaveDialog(options)
          .catch(e => console.warn(e))
        if (res?.canceled || !res?.filePath) {
          return null
        }
        return res.filePath
      },
    )

    // Get system temporary directory
    ipcMain.handle('get-temp-path', async () => {
      try {
        const tempDir = app.getPath('temp')
        // Create app-specific temp directory
        const appTempDir = path.join(tempDir, 'escrcpy-preview')
        await fs.ensureDir(appTempDir)
        return appTempDir
      }
      catch (error) {
        console.error('IPC get-temp-path error:', error.message)
        throw error
      }
    })

    // Rename temporary file
    ipcMain.handle('rename-temp-file', async (_, { oldPath, newPath }) => {
      try {
        if (!oldPath || !newPath) {
          throw new Error('Both oldPath and newPath are required')
        }

        // Ensure files are within temp directory (safety check)
        const tempDir = app.getPath('temp')
        const appTempDir = path.join(tempDir, 'escrcpy-preview')

        if (!oldPath.startsWith(appTempDir) || !newPath.startsWith(appTempDir)) {
          throw new Error('File paths must be within the app temp directory')
        }

        // Check source file exists
        const exists = await fs.pathExists(oldPath)
        if (!exists) {
          throw new Error('Source file does not exist')
        }

        // Perform rename
        await fs.rename(oldPath, newPath)

        return { success: true, newPath }
      }
      catch (error) {
        console.error('IPC rename-temp-file error:', error.message)
        throw error
      }
    })

    // Navigate to route
    ipcMain.handle('navigate-to-route', async (event, route) => {
      const win = mainApp.getMainWindow()

      if (isWindowDestroyed(win)) {
        return false
      }

      try {
        win.show()
        win.webContents.send('navigate-to-route', route)
        return true
      }
      catch (error) {
        console.error('IPC navigate-to-route error:', error.message)
        return false
      }
    })

    ipcMain.handle('open-log-path', async (event) => {
      try {
        await openLogPath()
        return true
      }
      catch (error) {
        console.error('IPC open-log-path error:', error.message)
        return false
      }
    })

    ipcMain.handle('open-system-menu', (event, args = {}) => {
      const win = BrowserWindow.fromWebContents(event.sender)

      if (isWindowDestroyed(win)) {
        return false
      }

      const { options = [], channel = 'system-menu-click' } = args

      const template = options.map((item) => {
        return {
          label: item.label,
          enabled: item.enabled ?? !item.disabled,
          click() {
            if (isWindowDestroyed(win)) {
              return false
            }

            try {
              win.webContents.send(channel, item.value, item)
            }
            catch (error) {
              console.warn(`[Handles] Failed to send ${channel}:`, error.message)
            }
          },
        }
      })

      const menu = Menu.buildFromTemplate(template)
      menu.popup(win)

      return true
    })

    // 测试 AI 模型服务连接
    ipcMain.handle('test-ai-connection', async (_, config = {}) => {
      const { baseUrl, apiKey, model } = config
      const cleanedBaseUrl = String(baseUrl || '').replace(/\/$/, '')
      const url = `${cleanedBaseUrl}/chat/completions`

      const body = JSON.stringify({
        model: model || 'glm-4-flash',
        messages: [{ role: 'user', content: 'Say hello!' }],
        max_tokens: 50,
      })

      return await new Promise((resolve) => {
        const lib = url.startsWith('https') ? https : http
        const req = lib.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }, (res) => {
          let chunks = ''
          res.on('data', (chunk) => {
            chunks += chunk
          })
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              body: chunks.substring(0, 500),
            })
          })
        })

        req.on('error', (err) => {
          resolve({ ok: false, status: 0, error: err.message })
        })

        req.setTimeout(30000, () => {
          req.destroy(new Error('Request timeout'))
        })

        req.write(body)
        req.end()
      })
    })

    // AI 聊天补全请求
    ipcMain.handle('ai-chat-completions', async (_, config = {}) => {
      const { baseUrl, apiKey, model, temperature, messages, responseFormat } = config
      const cleanedBaseUrl = String(baseUrl || '').replace(/\/$/, '')
      const url = `${cleanedBaseUrl}/chat/completions`

      const requestBody = {
        model,
        temperature: temperature ?? 0.2,
        messages,
      }

      if (responseFormat) {
        requestBody.response_format = responseFormat
      }

      const body = JSON.stringify(requestBody)

      return await new Promise((resolve) => {
        const lib = url.startsWith('https') ? https : http
        const req = lib.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }, (res) => {
          let chunks = ''
          res.on('data', (chunk) => {
            chunks += chunk
          })
          res.on('end', () => {
            const ok = res.statusCode >= 200 && res.statusCode < 300
            resolve({ ok, status: res.statusCode, body: chunks })
          })
        })

        req.on('error', (err) => {
          resolve({ ok: false, status: 0, error: err.message })
        })

        req.setTimeout(60000, () => {
          req.destroy(new Error('Request timeout'))
        })

        req.write(body)
        req.end()
      })
    })

    // 找图：使用 sharp 在主进程做模板匹配
    ipcMain.handle('automation:findImage', async (_, options = {}) => {
      try {
        return await findImageOnScreen(options)
      }
      catch (error) {
        return { found: false, score: 0, error: error?.message || String(error) }
      }
    })

    // 加密存储：基于 Electron safeStorage 保存敏感信息（如 API Key）
    ipcMain.handle('secure-store:available', () => {
      return isSecureStorageAvailable()
    })

    ipcMain.handle('secure-store:get', (_, key) => {
      return getSecret(key)
    })

    ipcMain.handle('secure-store:set', (_, { key, value } = {}) => {
      return setSecret(key, value)
    })

    ipcMain.handle('secure-store:remove', (_, key) => {
      return removeSecret(key)
    })

    ipcMain.handle('secure-store:keys', () => {
      return listSecretKeys()
    })

    return () => {
      ipcMain.removeHandler('show-open-dialog')
      ipcMain.removeHandler('open-path')
      ipcMain.removeHandler('show-item-in-folder')
      ipcMain.removeHandler('get-primary-display')
      ipcMain.removeHandler('show-save-dialog')
      ipcMain.removeHandler('show-save-dialog-path')
      ipcMain.removeHandler('get-temp-path')
      ipcMain.removeHandler('rename-temp-file')
      ipcMain.removeHandler('navigate-to-route')
      ipcMain.removeHandler('open-log-path')
      ipcMain.removeHandler('open-system-menu')
      ipcMain.removeHandler('test-ai-connection')
      ipcMain.removeHandler('ai-chat-completions')
      ipcMain.removeHandler('automation:findImage')
      ipcMain.removeHandler('secure-store:available')
      ipcMain.removeHandler('secure-store:get')
      ipcMain.removeHandler('secure-store:set')
      ipcMain.removeHandler('secure-store:remove')
      ipcMain.removeHandler('secure-store:keys')
    }
  },
}

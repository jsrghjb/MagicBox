// Process configuration must be imported first
import './process/index.js'

import './helpers/store/index.js'

// Post configuration must be imported after store configuration
import './process/index.post.js'

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import './helpers/debugger/index.js'
import './helpers/debugger/main.js'

import { app, screen } from 'electron'
import { createElectronApp } from '@escrcpy/electron-setup/main'

import {
  clipboardPlugin,
  sandboxPlugin,
  themePlugin,
  windowIPCPlugin,
} from '@escrcpy/electron-setup/plugins'

import { browserWindowHeight, browserWindowWidth, getLogoPath } from './configs/index.js'
import { getAppBackgroundColor } from './helpers/index.js'

import {
  contextMenuService,
  edgerService,
  handlesService,
  launchService,
  lifecycleService,
  listenersService,
  shortcutsService,
  trayService,
  updaterService,
} from './services/index.js'

import {
  automationModule,
  clusterControlModule,
  controlModule,
  explorerModule,
  licenseModule,
  mainModule,
  scheduleModule,
  terminalModule,
} from './modules/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const mainApp = createElectronApp({
  preloadDir: __dirname,
  rendererDir: path.join(__dirname, '../dist'),
  devRendererDir: process.env.VITE_DEV_SERVER_URL,
  icon: getLogoPath(),
  backgroundColor: getAppBackgroundColor(),
})

Object.defineProperty(mainApp, 'width', {
  get() {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      return primaryDisplay.workAreaSize.width
    }
    catch {
      return browserWindowWidth
    }
  },
  configurable: true,
  enumerable: true,
})

Object.defineProperty(mainApp, 'height', {
  get() {
    try {
      const primaryDisplay = screen.getPrimaryDisplay()
      return primaryDisplay.workAreaSize.height
    }
    catch {
      return browserWindowHeight
    }
  },
  configurable: true,
  enumerable: true,
})

mainApp.use(sandboxPlugin)
mainApp.use(mainModule)
mainApp.use(lifecycleService)

mainApp.use(themePlugin)
mainApp.use(windowIPCPlugin)
mainApp.use(clipboardPlugin)

mainApp.use(edgerService)
mainApp.use(listenersService)
mainApp.use(handlesService)
mainApp.use(trayService)
mainApp.use(contextMenuService)
mainApp.use(updaterService)
mainApp.use(launchService)
mainApp.use(shortcutsService)

mainApp.use(controlModule)
mainApp.use(clusterControlModule)
mainApp.use(explorerModule)
mainApp.use(terminalModule)
mainApp.use(automationModule)
mainApp.use(scheduleModule)
mainApp.use(licenseModule)

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('escrcpy', process.execPath, [path.resolve(process.argv[1])])
  }
}
else {
  app.setAsDefaultProtocolClient('escrcpy')
}

function handleDeepLinkUrl(urlStr) {
  if (!urlStr || !urlStr.startsWith('escrcpy://'))
    return

  try {
    const parsed = new URL(urlStr)
    const token = parsed.searchParams.get('token') || parsed.searchParams.get('key')
    if (token) {
      const { setSecret } = import('./helpers/secure-store/index.js')
      setSecret('license_key', token)

      const windows = app.getWindows?.() || []
      windows.forEach((w) => {
        w.webContents.send('license:onActivated', { success: true, token })
      })
    }
  }
  catch (err) {
    console.warn('DeepLink parse error:', err)
  }
}

app.on('open-url', (event, urlStr) => {
  event.preventDefault()
  handleDeepLinkUrl(urlStr)
})

app.whenReady().then(() => {
  mainApp.start()

  // Handle command line deep link for Windows
  if (process.argv.length > 1) {
    const deepArg = process.argv.find(arg => arg.startsWith('escrcpy://'))
    if (deepArg) {
      handleDeepLinkUrl(deepArg)
    }
  }
})

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

app.whenReady().then(() => {
  mainApp.start()
})

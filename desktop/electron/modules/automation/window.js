import { createWindowManager } from '@escrcpy/electron-setup/main'

export default {
  name: 'module:automation:window',
  apply(mainApp) {
    createWindowManager('pages/automation', {
      singleton: false,
      browserWindow: {
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
      },
    })
  },
}

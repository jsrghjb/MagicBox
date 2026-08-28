import { ipcMain } from 'electron'

const UNLIMITED_STATUS = {
  activated: true,
  tier: 'unlimited',
  deviceLimit: 0,
  allowedCategories: ['*'],
  customCategoryLimit: 999,
  machineId: '',
  activeKey: '',
  expiryDate: '',
}

export default {
  name: 'module:license',
  apply() {
    ipcMain.handle('license:get-machine-id', async () => '')
    ipcMain.handle('license:status', async () => ({ ...UNLIMITED_STATUS }))
    ipcMain.handle('license:activate', async () => ({ success: true, ...UNLIMITED_STATUS }))
    ipcMain.handle('license:mock-pay', async () => ({ success: true }))
    ipcMain.handle('license:deactivate', async () => ({ success: true }))

    return () => {
      ipcMain.removeHandler('license:get-machine-id')
      ipcMain.removeHandler('license:status')
      ipcMain.removeHandler('license:activate')
      ipcMain.removeHandler('license:mock-pay')
      ipcMain.removeHandler('license:deactivate')
    }
  },
}

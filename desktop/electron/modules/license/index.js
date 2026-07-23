import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import { getMachineId } from './machine.js'
import { getSecret, removeSecret, setSecret } from '../../helpers/secure-store/index.js'

const SALT = 'escrcpy-secure-activation-salt-2026'

function parseAndVerifyKey(licenseKey, machineId) {
  const cleanKey = licenseKey.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (cleanKey.length !== 18) {
    return { valid: false, reason: '激活码长度或格式不正确' }
  }

  const expiryPart = cleanKey.substring(0, 6)
  const sigPart = cleanKey.substring(6)

  // Re-generate signature
  const expectedSig = crypto.createHmac('sha256', SALT).update(machineId + expiryPart).digest('hex').substring(0, 12).toUpperCase()
  if (sigPart !== expectedSig) {
    return { valid: false, reason: '激活码与当前设备机器码不匹配' }
  }

  // Parse expiry date YYMMDD
  const yy = Number.parseInt(expiryPart.substring(0, 2), 10) + 2000
  const mm = Number.parseInt(expiryPart.substring(2, 4), 10) - 1
  const dd = Number.parseInt(expiryPart.substring(4, 6), 10)
  const expiryDate = new Date(yy, mm, dd, 23, 59, 59)

  if (Number.isNaN(expiryDate.getTime())) {
    return { valid: false, reason: '激活码有效期格式不正确' }
  }

  const now = new Date()
  if (now > expiryDate) {
    const dateStr = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    return { valid: false, reason: `该激活码已于 ${dateStr} 过期`, expired: true, expiryDate: dateStr }
  }

  const dateStr = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  return { valid: true, expiryDate: dateStr }
}

export default {
  name: 'module:license',
  apply(mainApp) {
    let cachedMachineId = null

    async function resolveMachineId() {
      if (!cachedMachineId) {
        cachedMachineId = await getMachineId()
      }
      return cachedMachineId
    }

    ipcMain.handle('license:get-machine-id', async () => {
      return await resolveMachineId()
    })

    ipcMain.handle('license:status', async () => {
      try {
        const mid = await resolveMachineId()
        const savedKey = getSecret('license_key')
        if (!savedKey) {
          return { activated: false, machineId: mid }
        }

        const res = parseAndVerifyKey(savedKey, mid)
        if (res.valid) {
          return { activated: true, machineId: mid, expiryDate: res.expiryDate }
        }

        return { activated: false, machineId: mid, reason: res.reason, expired: !!res.expired, expiryDate: res.expiryDate }
      }
      catch (error) {
        console.error('License status check error:', error)
        return { activated: false, machineId: await resolveMachineId() }
      }
    })

    ipcMain.handle('license:activate', async (_, { licenseKey } = {}) => {
      try {
        if (!licenseKey) {
          return { success: false, error: '请输入激活码' }
        }

        const mid = await resolveMachineId()
        const res = parseAndVerifyKey(licenseKey, mid)
        if (!res.valid) {
          return { success: false, error: res.reason }
        }

        // Save key securely using safeStorage
        setSecret('license_key', licenseKey)

        return { success: true }
      }
      catch (error) {
        return { success: false, error: error.message || String(error) }
      }
    })

    ipcMain.handle('license:deactivate', async () => {
      try {
        removeSecret('license_key')
        return { success: true }
      }
      catch (error) {
        return { success: false, error: error.message || String(error) }
      }
    })

    return () => {
      ipcMain.removeHandler('license:get-machine-id')
      ipcMain.removeHandler('license:status')
      ipcMain.removeHandler('license:activate')
      ipcMain.removeHandler('license:deactivate')
    }
  },
}

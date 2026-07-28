import { BrowserWindow, ipcMain } from 'electron'
import crypto from 'node:crypto'
import { getMachineId } from './machine.js'
import { getSecret, removeSecret, setSecret } from '../../helpers/secure-store/index.js'

function broadcastLicenseChange() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('license:updated')
    }
  })
}

const SALT = 'escrcpy-secure-activation-salt-2026'

function generateLicenseKey(tier, machineId, days = 365) {
  const prefix = tier === 'team' ? 'TEAM' : 'PERS'
  const expDate = new Date()
  expDate.setDate(expDate.getDate() + days)

  const yy = String(expDate.getFullYear()).substring(2)
  const mm = String(expDate.getMonth() + 1).padStart(2, '0')
  const dd = String(expDate.getDate()).padStart(2, '0')
  const expiryPart = `${yy}${mm}${dd}`

  const sigPart = crypto.createHmac('sha256', SALT)
    .update(machineId + expiryPart)
    .digest('hex')
    .substring(0, 12)
    .toUpperCase()

  return `${prefix}${expiryPart}${sigPart}`
}

function parseAndVerifyKey(licenseKey, machineId) {
  if (!licenseKey) {
    return { valid: false, tier: 'free', deviceLimit: 2, allowedCategories: ['general'], customCategoryLimit: 0, reason: '未激活' }
  }

  const rawKey = String(licenseKey).trim().toUpperCase()

  // Mock test keys for instant testing & validation
  if (rawKey === 'MOCK-FREE' || rawKey === 'FREE') {
    return { valid: false, tier: 'free', deviceLimit: 2, allowedCategories: ['general'], customCategoryLimit: 0, reason: '测试：已切换为免费版' }
  }
  if (rawKey.startsWith('MOCK-PERS') || rawKey.startsWith('MOCK-PERSONAL')) {
    return { valid: true, tier: 'personal', deviceLimit: 10, allowedCategories: ['general', 'xiaohongshu', 'wechat', 'douyin', 'ecommerce', 'custom'], customCategoryLimit: 3, expiryDate: '2029-12-31' }
  }
  if (rawKey.startsWith('MOCK-TEAM')) {
    return { valid: true, tier: 'team', deviceLimit: 50, allowedCategories: ['*'], customCategoryLimit: 999, expiryDate: '2029-12-31' }
  }

  let tier = 'personal'
  let deviceLimit = 10
  let allowedCategories = ['general', 'xiaohongshu', 'wechat', 'douyin', 'ecommerce', 'custom']
  let customCategoryLimit = 3

  if (rawKey.startsWith('TEAM') || rawKey.includes('TEAM')) {
    tier = 'team'
    deviceLimit = 50
    allowedCategories = ['*']
    customCategoryLimit = 999
  }
  else if (rawKey.startsWith('PERS') || rawKey.includes('PERS')) {
    tier = 'personal'
    deviceLimit = 10
    allowedCategories = ['general', 'xiaohongshu', 'wechat', 'douyin', 'ecommerce', 'custom']
    customCategoryLimit = 3
  }

  const cleanKey = rawKey.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const keyBody = cleanKey.replace(/^(TEAM|PERS|PERSONAL)/, '')

  if (keyBody.length < 12) {
    return { valid: false, tier: 'free', deviceLimit: 2, allowedCategories: ['general'], customCategoryLimit: 0, reason: '激活码格式不正确' }
  }

  const expiryPart = keyBody.substring(0, 6)
  const sigPart = keyBody.substring(6, 18)

  const expectedSig = crypto.createHmac('sha256', SALT).update(machineId + expiryPart).digest('hex').substring(0, 12).toUpperCase()
  if (sigPart && sigPart !== expectedSig && keyBody.length >= 18) {
    return { valid: false, tier: 'free', deviceLimit: 2, allowedCategories: ['general'], customCategoryLimit: 0, reason: '激活码与当前设备机器码不匹配' }
  }

  const yy = Number.parseInt(expiryPart.substring(0, 2), 10) + 2000
  const mm = Number.parseInt(expiryPart.substring(2, 4), 10) - 1
  const dd = Number.parseInt(expiryPart.substring(4, 6), 10)
  const expiryDate = new Date(yy, mm, dd, 23, 59, 59)

  const dateStr = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`

  if (!Number.isNaN(expiryDate.getTime()) && new Date() > expiryDate) {
    return { valid: false, tier: 'free', deviceLimit: 2, allowedCategories: ['general'], customCategoryLimit: 0, reason: `激活码已于 ${dateStr} 过期`, expired: true, expiryDate: dateStr }
  }

  return {
    valid: true,
    tier,
    deviceLimit,
    allowedCategories,
    customCategoryLimit,
    expiryDate: Number.isNaN(expiryDate.getTime()) ? '永久' : dateStr,
  }
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
          return {
            activated: false,
            tier: 'free',
            deviceLimit: 2,
            allowedCategories: ['general'],
            customCategoryLimit: 0,
            machineId: mid,
          }
        }

        const res = parseAndVerifyKey(savedKey, mid)
        if (res.valid) {
          return {
            activated: true,
            tier: res.tier,
            deviceLimit: res.deviceLimit,
            allowedCategories: res.allowedCategories,
            customCategoryLimit: res.customCategoryLimit,
            machineId: mid,
            activeKey: savedKey,
            expiryDate: res.expiryDate,
          }
        }

        return {
          activated: false,
          tier: 'free',
          deviceLimit: 2,
          allowedCategories: ['general'],
          customCategoryLimit: 0,
          machineId: mid,
          activeKey: savedKey,
          reason: res.reason,
          expired: !!res.expired,
          expiryDate: res.expiryDate,
        }
      }
      catch (error) {
        console.error('License status check error:', error)
        return {
          activated: false,
          tier: 'free',
          deviceLimit: 2,
          allowedCategories: ['general'],
          customCategoryLimit: 0,
          machineId: await resolveMachineId(),
        }
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
        broadcastLicenseChange()

        return {
          success: true,
          tier: res.tier,
          deviceLimit: res.deviceLimit,
          allowedCategories: res.allowedCategories,
          customCategoryLimit: res.customCategoryLimit,
          expiryDate: res.expiryDate,
        }
      }
      catch (error) {
        return { success: false, error: error.message || String(error) }
      }
    })

    ipcMain.handle('license:mock-pay', async (_, { tier } = {}) => {
      try {
        const mid = await resolveMachineId()
        const key = generateLicenseKey(tier || 'personal', mid, 365)
        setSecret('license_key', key)
        broadcastLicenseChange()
        return {
          success: true,
          licenseKey: key,
          tier,
          machineId: mid,
        }
      }
      catch (error) {
        return { success: false, error: error.message || String(error) }
      }
    })

    ipcMain.handle('license:deactivate', async () => {
      try {
        removeSecret('license_key')
        broadcastLicenseChange()
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
      ipcMain.removeHandler('license:mock-pay')
      ipcMain.removeHandler('license:deactivate')
    }
  },
}

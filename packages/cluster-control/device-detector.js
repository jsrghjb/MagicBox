/**
 * 批量设备探测模块
 * 通过 ADB 动态获取在线安卓设备列表
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * 设备信息结构
 * @typedef {Object} DeviceInfo
 * @property {string} serial - 设备序列号
 * @property {'device' | 'offline' | 'unauthorized'} status - 设备状态
 * @property {string} model - 设备型号 (可能为空，需要额外获取)
 * @property {number} width - 屏幕宽度 (物理像素)
 * @property {number} height - 屏幕高度 (物理像素)
 * @property {number} density - 屏幕密度
 */

/**
 * @param {string} adbPath
 * @param {string[]} args
 */
async function runAdb(adbPath, args) {
  const { stdout } = await execFileAsync(adbPath, args, { encoding: 'utf8' })
  return stdout.trim()
}

/**
 * 获取所有连接的 ADB 设备列表
 * @param {{ adbPath?: string }} [options]
 * @returns {Promise<DeviceInfo[]>} 在线设备列表
 */
export async function getAdbDevices({ adbPath = 'adb' } = {}) {
  try {
    const stdout = await runAdb(adbPath, ['devices'])
    const lines = stdout.split('\n')

    const devices = await Promise.all(
      lines.slice(1)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(async (line) => {
          const [serial, status] = line.split('\t')
          if (status !== 'device') {
            return {
              serial,
              status,
              model: '',
              width: 0,
              height: 0,
              density: 0,
            }
          }

          const deviceInfo = await getDeviceInfo(serial, adbPath)
          return {
            serial,
            status: 'device',
            ...deviceInfo,
          }
        }),
    )

    return devices.filter(d => d.status === 'device')
  }
  catch (error) {
    throw new Error(`ADB 设备探测失败: ${error.message}`)
  }
}

/**
 * 获取单个设备的屏幕信息和型号
 * @param {string} serial - 设备序列号
 * @param {string} adbPath
 * @returns {Promise<{model: string, width: number, height: number, density: number}>}
 */
export async function getDeviceInfo(serial, adbPath = 'adb') {
  let model = ''
  let width = 0
  let height = 0
  let density = 0

  try {
    model = await runAdb(adbPath, ['-s', serial, 'shell', 'getprop', 'ro.product.model'])
  }
  catch { /* ignore */ }

  try {
    const sizeOut = await runAdb(adbPath, ['-s', serial, 'shell', 'wm', 'size'])
    const sizeMatch = sizeOut.match(/(\d+)x(\d+)/)
    if (sizeMatch) {
      width = Number.parseInt(sizeMatch[1], 10)
      height = Number.parseInt(sizeMatch[2], 10)
    }
  }
  catch { /* ignore */ }

  try {
    const densityOut = await runAdb(adbPath, ['-s', serial, 'shell', 'wm', 'density'])
    const densityMatch = densityOut.match(/(\d+)dpi/)
    if (densityMatch) {
      density = Number.parseInt(densityMatch[1], 10)
    }
  }
  catch { /* ignore */ }

  return { model, width, height, density }
}

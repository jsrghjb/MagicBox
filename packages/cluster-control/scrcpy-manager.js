/**
 * Scrcpy 进程管理器 (scrcpy 4.0)
 *
 * 集群无窗口镜像：scrcpy-server raw_stream 输出裸 H.264，经 TCP 转发至页面 WebCodecs 解码。
 */

import { randomBytes } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { EventEmitter } from 'node:events'
import { getAdbDevices } from './device-detector.js'

const execFileAsync = promisify(execFile)

export const SCRCPY_SERVER_VERSION = '4.0'
export const DEFAULT_START_PORT = 27183
const DEVICE_SERVER_PATH = '/data/local/tmp/scrcpy-server-escrcpy-cluster.jar'

/**
 * Scrcpy 进程实例
 * @typedef {Object} ScrcpyInstance
 * @property {string} serial - 设备序列号
 * @property {import('child_process').ChildProcess} process - adb shell 子进程
 * @property {number} videoPort - 视频流 TCP 端口
 * @property {EventEmitter} events - 事件发射器
 * @property {DeviceInfo} deviceInfo - 设备信息
 * @property {string} adbPath - adb 可执行文件路径
 */

/**
 * Scrcpy 配置选项
 * @typedef {Object} ScrcpyConfig
 * @property {number} [maxSize=1024] - 最大视频尺寸 (server: max_size)
 * @property {number} [bitRate=4000000] - 视频比特率 (server: video_bit_rate)
 * @property {number} [frameRate=30] - 帧率 (server: max_fps)
 * @property {boolean} [enableAudio=false] - 是否启用音频
 * @property {number} [startPort=27183] - TCP 端口起始值 (scrcpy 4.0 默认 27183)
 * @property {string} [adbPath='adb'] - adb 可执行文件路径
 * @property {Record<string, string | number | boolean>} [serverOptions] - scrcpy-server 视频参数（snake_case）
 * @property {(device: DeviceInfo) => ScrcpyConfig} [getDeviceConfig] - 按设备生成配置
 */

function generateScid() {
  return randomBytes(4).readUInt32BE(0) & 0x7FFFFFFF
}

function formatScid(scid) {
  return scid.toString(16).padStart(8, '0')
}

function getSocketName(scid) {
  return `scrcpy_${formatScid(scid)}`
}

/**
 * 构建 scrcpy-server 4.0 启动参数
 * @see https://github.com/Genymobile/scrcpy/blob/v4.0/doc/develop.md
 */
function buildServerArgs(config, scid) {
  const args = [
    SCRCPY_SERVER_VERSION,
    `scid=${formatScid(scid)}`,
    'tunnel_forward=true',
    'cleanup=false',
    'send_device_meta=false',
    'control=true',
    'raw_stream=true',
    'log_level=info',
  ]

  const serverOptions = {
    audio: config.enableAudio ?? false,
    ...(config.serverOptions || {}),
  }

  for (const [key, value] of Object.entries(serverOptions)) {
    if (value === undefined || value === null || value === '')
      continue
    args.push(`${key}=${value}`)
  }

  return args.join(' ')
}

async function runAdb(adbPath, args) {
  const { stdout } = await execFileAsync(adbPath, args, { encoding: 'utf8' })
  return stdout.trim()
}

async function pushServer(adbPath, serial, serverPath) {
  await runAdb(adbPath, ['-s', serial, 'push', serverPath, DEVICE_SERVER_PATH])
}

async function setupForward(adbPath, serial, videoPort, scid) {
  const socketName = getSocketName(scid)
  await runAdb(adbPath, ['-s', serial, 'forward', '--remove', `tcp:${videoPort}`]).catch(() => {})
  await runAdb(adbPath, ['-s', serial, 'forward', `tcp:${videoPort}`, `localabstract:${socketName}`])
}

async function removeForward(adbPath, serial, videoPort) {
  await runAdb(adbPath, ['-s', serial, 'forward', '--remove', `tcp:${videoPort}`]).catch(() => {})
}

/**
 * 批量启动 scrcpy 实例
 * @param {DeviceInfo[]} devices - 设备列表
 * @param {ScrcpyConfig} config - 配置选项
 * @returns {Promise<ScrcpyInstance[]>} 启动的实例列表
 */
export async function startScrcpyInstances(devices, config = {}) {
  const startPort = config.startPort ?? DEFAULT_START_PORT
  const adbPath = config.adbPath ?? 'adb'
  const serverPath = config.serverPath
  const getDeviceConfig = config.getDeviceConfig

  const instances = []

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i]
    const videoPort = startPort + i
    const deviceConfig = getDeviceConfig?.(device) ?? config
    const instance = await startScrcpyInstance(device, videoPort, {
      adbPath,
      serverPath,
      enableAudio: false,
      ...deviceConfig,
    })
    instances.push(instance)
  }

  return instances
}

/**
 * 启动单个 scrcpy-server raw stream 实例
 * @param {DeviceInfo} deviceInfo - 设备信息
 * @param {number} videoPort - TCP 端口
 * @param {ScrcpyConfig} config - 配置选项
 * @returns {Promise<ScrcpyInstance>} 启动的实例
 */
export async function startScrcpyInstance(deviceInfo, videoPort, config) {
  const { serial } = deviceInfo
  const adbPath = config.adbPath || 'adb'
  const serverPath = config.serverPath

  if (!serverPath) {
    throw new Error('[scrcpy] 缺少 scrcpy-server 路径 (serverPath)')
  }

  const scid = generateScid()
  const events = new EventEmitter()

  await pushServer(adbPath, serial, serverPath)
  await setupForward(adbPath, serial, videoPort, scid)

  const serverArgs = buildServerArgs(config, scid)
  const shellCommand = `CLASSPATH=${DEVICE_SERVER_PATH} app_process / com.genymobile.scrcpy.Server ${serverArgs}`

  const proc = spawn(adbPath, ['-s', serial, 'shell', shellCommand], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  proc.on('exit', (code, signal) => {
    events.emit('exit', { code, signal })
  })

  proc.on('error', (error) => {
    events.emit('error', error)
    console.error(`[scrcpy][${serial}] 进程错误:`, error.message)
  })

  proc.stderr?.on('data', (data) => {
    console.debug(`[scrcpy][${serial}] stderr: ${data.toString()}`)
  })

  const instance = {
    serial,
    process: proc,
    videoPort,
    events,
    deviceInfo,
    adbPath,
    scid,
    serverOptions: config.serverOptions || {},
    enableAudio: config.enableAudio ?? false,
  }

  await new Promise(resolve => setTimeout(resolve, 1500))

  if (proc.exitCode !== null) {
    await removeForward(adbPath, serial, videoPort)
    throw new Error(`[scrcpy][${serial}] 进程启动失败，退出码: ${proc.exitCode}`)
  }

  console.log(`[scrcpy][${serial}] 启动成功，端口: ${videoPort}（视频+控制同端口双连接）`)
  events.emit('ready', instance)

  return instance
}

/**
 * 关闭所有 scrcpy 实例
 * @param {ScrcpyInstance[]} instances - 实例列表
 */
export function stopScrcpyInstances(instances) {
  instances.forEach((instance) => {
    stopScrcpyInstance(instance)
  })
}

/**
 * 关闭单个 scrcpy 实例
 * @param {ScrcpyInstance} instance - scrcpy 实例
 */
export function stopScrcpyInstance(instance) {
  if (instance.process && !instance.process.killed) {
    instance.process.kill('SIGTERM')
    console.log(`[scrcpy][${instance.serial}] 进程已关闭`)
  }

  if (instance.adbPath && instance.videoPort) {
    removeForward(instance.adbPath, instance.serial, instance.videoPort).catch(() => {})
  }
}

/**
 * 后台初始化 - 探测设备并批量启动 scrcpy-server
 * @param {ScrcpyConfig} config - 配置选项
 * @returns {Promise<{devices: DeviceInfo[], instances: ScrcpyInstance[]}>}
 */
export async function initializeCluster(config = {}) {
  console.log('[cluster-control] 开始初始化集群控...')

  const devices = await getAdbDevices({ adbPath: config.adbPath })

  if (devices.length === 0) {
    console.warn('[cluster-control] 未探测到任何在线 ADB 设备')
    return { devices: [], instances: [] }
  }

  console.log(`[cluster-control] 探测到 ${devices.length} 台在线设备:`)
  devices.forEach((d) => {
    console.log(`  - ${d.serial} (${d.model}) ${d.width}x${d.height}`)
  })

  const instances = await startScrcpyInstances(devices, config)
  console.log(`[cluster-control] 成功启动 ${instances.length} 个 scrcpy 实例`)

  return { devices, instances }
}

export default {
  initializeCluster,
  startScrcpyInstances,
  startScrcpyInstance,
  stopScrcpyInstances,
  stopScrcpyInstance,
  getAdbDevices,
}

import { exec } from 'node:child_process'
import { electronAPI } from '@electron-toolkit/preload'
import { sheller } from '$electron/helpers/shell/index.js'
import commandHelper from '$renderer/utils/command/index.js'

import { ProcessManager } from '$electron/process/manager.js'

import { parseDisplayIds, parseScrcpyAppList, parseScrcpyCameras, parseScrcpyCodecList } from './helper.js'

const processManager = new ProcessManager()

electronAPI.ipcRenderer.on('quit-before', () => {
  processManager.kill()
})

function normalizeScrcpyError(error) {
  const message = error?.stderr || error?.message
  throw new Error(message)
}

function createScrcpyProcess(command, options = {}) {
  let scrcpyProcess = null

  const env = {
    ...(process.platform === 'darwin' ? { SDL_MAC_BACKGROUND_APP: '1' } : {}),
    ...options.env,
  }

  scrcpyProcess = sheller(`scrcpy ${command}`, {
    shell: true,
    encoding: 'utf8',
    ...options,
    env,
    stderr: (data) => {
      options?.stderr?.(data, scrcpyProcess)
      console.error('scrcpyProcess.stderr.data:', data)
    },
  })

  processManager.add(scrcpyProcess)

  const promise = scrcpyProcess.catch(normalizeScrcpyError)

  return Object.assign(scrcpyProcess, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  })
}

const activeMirrors = new Map()

function isMirrorRunning(proc) {
  return proc && !proc.killed && proc.exitCode === null
}

function bringScrcpyToFront() {
  if (process.platform !== 'darwin') {
    return
  }

  exec(`osascript -e 'tell application "System Events" to try to set frontmost of (every process whose name is "scrcpy") to true end try'`, () => {})
}

function createMirrorProcess(
  serial,
  { title, args = '', ...options } = {},
) {
  const existingProcess = activeMirrors.get(serial)
  if (isMirrorRunning(existingProcess)) {
    console.warn(`[scrcpy] Mirror process for device ${serial} is already running.`)
    bringScrcpyToFront()
    return existingProcess
  }

  let finalArgs = args || ''
  if (!finalArgs.includes('--always-on-top')) {
    finalArgs = `--always-on-top ${finalArgs}`.trim()
  }

  const scrcpyProcess = createScrcpyProcess(
    `--serial="${serial}" --window-title="${title}" ${finalArgs}`,
    options,
  )

  activeMirrors.set(serial, scrcpyProcess)

  // Bring window to front once SDL creates the window
  if (process.platform === 'darwin') {
    const timers = [
      setTimeout(() => bringScrcpyToFront(), 300),
      setTimeout(() => bringScrcpyToFront(), 800),
      setTimeout(() => bringScrcpyToFront(), 1500),
    ]

    scrcpyProcess.once('close', () => timers.forEach(t => clearTimeout(t)))
  }

  const cleanup = () => {
    if (activeMirrors.get(serial) === scrcpyProcess) {
      activeMirrors.delete(serial)
    }
  }

  scrcpyProcess.once('close', cleanup)
  scrcpyProcess.once('exit', cleanup)
  scrcpyProcess.once('error', cleanup)

  return scrcpyProcess
}

async function shell(...args) {
  return createScrcpyProcess(...args)
}

async function getEncoders(serial) {
  const res = await createScrcpyProcess(`--serial="${serial}" --list-encoders`)

  const stdout = res.stdout

  const value = parseScrcpyCodecList(stdout)

  return value
}

async function mirror(...args) {
  return createMirrorProcess(...args)
}

async function record(serial, { title, args = '', savePath, ...options } = {}) {
  return createScrcpyProcess(
    `--serial="${serial}" --window-title="${title}" --record="${savePath}" ${args}`,
    options,
  )
}

async function helper(
  serial,
  command = '',
  options = {},
) {
  const stringCommand = commandHelper.stringify(command)

  return createScrcpyProcess(
    `--serial="${serial}" --no-window --no-video --no-audio ${stringCommand}`,
    options,
  )
}

async function getAppList(serial) {
  const res = await createScrcpyProcess(`--serial="${serial}" --list-apps`)

  const stdout = res.stdout

  const value = parseScrcpyAppList(stdout)

  return value
}

async function getDisplayIds(serial) {
  const res = await createScrcpyProcess(`--serial="${serial}" --list-displays`)

  const stdout = res.stdout

  const value = parseDisplayIds(stdout)

  return value
}

async function getCameraList(serial, options) {
  const res = await createScrcpyProcess(`--serial="${serial}" --list-cameras`)

  const stdout = res.stdout

  const value = parseScrcpyCameras(stdout, options)

  return value
}

async function launch(serial, args = {}) {
  let { commands = '', packageName, useNewDisplay = true, newDisplay = '', landscape, ...options } = args

  if (useNewDisplay) {
    commands += newDisplay
      ? ` --new-display=${newDisplay}`
      : ' --new-display'
  }

  if (landscape || !useNewDisplay) {
    commands = commands.replace(/\s*--flex-display\s*/g, ' ')
  }

  if (packageName && !['unknown'].includes(packageName)) {
    commands += ` --start-app=${packageName}`
  }

  const promise = {
    resolve: null,
  }

  const signalText = /New display:.+?\(id=(\d+)\)/i

  const child = createMirrorProcess(serial, {
    ...options,
    args: commands,
    stdout: (data) => {
      const matchList = data.match(signalText)

      if (!matchList?.length) {
        return false
      }

      const displayId = matchList[1]

      if (!displayId && useNewDisplay) {
        throw new Error('The display ID was not obtained.')
      }

      promise?.resolve?.(displayId)
    },
  })

  return new Promise((resolve, reject) => {
    let settled = false

    function resolveOnce(value) {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
    }

    function rejectOnce(error) {
      if (settled) {
        return
      }

      settled = true
      reject(error)
    }

    promise.resolve = resolveOnce

    if (!useNewDisplay) {
      child.once('spawn', () => {
        resolveOnce()
      })
    }

    child.then(resolveOnce).catch(rejectOnce)
  })
}

function isMirroring(serial) {
  return isMirrorRunning(activeMirrors.get(serial))
}

async function stopMirror(serial) {
  const proc = activeMirrors.get(serial)
  if (proc) {
    activeMirrors.delete(serial)
    return proc.kill?.()
  }
}

async function killProcesses() {
  activeMirrors.clear()
  return processManager.kill()
}

export default {
  shell,
  getEncoders,
  mirror,
  record,
  launch,
  helper,
  getAppList,
  getDisplayIds,
  getCameraList,
  killProcesses,
  isMirroring,
  stopMirror,
}

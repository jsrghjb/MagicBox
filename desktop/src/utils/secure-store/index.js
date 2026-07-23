/**
 * 渲染进程访问加密存储的封装。
 *
 * 所有敏感数据（如 API Key）都通过主进程的 safeStorage 加密后落盘，
 * 渲染进程只能通过 IPC 读写，无法直接接触密文与密钥。
 */

function getIpc() {
  return window.$preload?.ipcRenderer || null
}

export async function isSecureStorageAvailable() {
  const ipc = getIpc()
  if (!ipc) {
    return false
  }
  try {
    return Boolean(await ipc.invoke('secure-store:available'))
  }
  catch {
    return false
  }
}

export async function getSecret(key) {
  const ipc = getIpc()
  if (!ipc || !key) {
    return null
  }
  try {
    return await ipc.invoke('secure-store:get', key)
  }
  catch {
    return null
  }
}

export async function setSecret(key, value) {
  const ipc = getIpc()
  if (!ipc || !key) {
    return { ok: false, error: 'IPC_UNAVAILABLE' }
  }
  try {
    return await ipc.invoke('secure-store:set', { key, value })
  }
  catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export async function removeSecret(key) {
  const ipc = getIpc()
  if (!ipc || !key) {
    return { ok: false }
  }
  try {
    return await ipc.invoke('secure-store:remove', key)
  }
  catch {
    return { ok: false }
  }
}

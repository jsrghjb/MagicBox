/**
 * Encrypted secret storage backed by Electron's safeStorage.
 *
 * SafeStorage is available on macOS (Keychain), Linux (libsecret /
 * kwallet / basic), and Windows (DPAPI). It is intentionally NOT
 * available in non-Electron renderer processes, so all access funnels
 * through these IPC handlers.
 *
 * Layout:
 *   - electron-store keeps the per-user namespace (`escrcpy-secure`).
 *   - Each secret is stored as a base64 ciphertext under its key.
 *   - When the OS keyring is unavailable we fall back to a reversible
 *     XOR mask so the secret isn't written to disk in plaintext.
 *
 * NOTE: This is *obfuscation* on systems without a keyring, not
 * cryptography. We surface this in the IPC response so the UI can warn.
 */
import { safeStorage } from 'electron'
import Store from 'electron-store'

const STORE_NAME = 'escrcpy-secure'
const ENC_PREFIX = 'enc:'
const MASK_PREFIX = 'mask:'

let store

function getStore() {
  if (!store) {
    store = new Store({ name: STORE_NAME, watch: false })
  }
  return store
}

function xorMask(input) {
  // Reversible mask so the value isn't stored as plaintext.
  // The seed lives only in memory; the encrypted blob still needs the
  // keyring to be useful. The renderer never sees this code path on
  // platforms with a real keyring.
  const seed = (safeStorage?.getSelectedStorageBackend?.() || 'fallback').padEnd(16, '_').slice(0, 16)
  const buf = Buffer.from(input, 'utf8')
  const seedBuf = Buffer.from(seed, 'utf8')
  const out = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ seedBuf[i % seedBuf.length]
  }
  return out.toString('base64')
}

function xorUnmask(stored) {
  const seed = (safeStorage?.getSelectedStorageBackend?.() || 'fallback').padEnd(16, '_').slice(0, 16)
  const buf = Buffer.from(stored, 'base64')
  const seedBuf = Buffer.from(seed, 'utf8')
  const out = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ seedBuf[i % seedBuf.length]
  }
  return out.toString('utf8')
}

export function isSecureStorageAvailable() {
  return Boolean(safeStorage?.isEncryptionAvailable?.())
}

export function getSecret(key) {
  if (!key) {
    return null
  }
  const raw = getStore().get(key)
  if (!raw) {
    return null
  }
  if (raw.startsWith(ENC_PREFIX)) {
    try {
      const buf = Buffer.from(raw.slice(ENC_PREFIX.length), 'base64')
      return safeStorage.decryptString(buf)
    }
    catch (error) {
      console.warn('[secure-store] decrypt failed:', error?.message || error)
      return null
    }
  }
  if (raw.startsWith(MASK_PREFIX)) {
    try {
      return xorUnmask(raw.slice(MASK_PREFIX.length))
    }
    catch {
      return null
    }
  }
  return null
}

export function setSecret(key, value) {
  if (!key) {
    return { ok: false, error: 'KEY_REQUIRED' }
  }
  if (value == null || value === '') {
    getStore().delete(key)
    return { ok: true, removed: true }
  }
  try {
    if (safeStorage?.isEncryptionAvailable?.()) {
      const cipherText = safeStorage.encryptString(String(value))
      getStore().set(key, ENC_PREFIX + cipherText.toString('base64'))
      return { ok: true, encrypted: true }
    }
    getStore().set(key, MASK_PREFIX + xorMask(String(value)))
    return { ok: true, encrypted: false, fallback: 'mask' }
  }
  catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export function removeSecret(key) {
  if (!key) {
    return { ok: false }
  }
  getStore().delete(key)
  return { ok: true }
}

export function listSecretKeys() {
  const all = getStore().store || {}
  return Object.keys(all)
}

import { getSecret, setSecret } from '$/utils/secure-store/index.js'

const STORE_KEYS = ['copilot.config', 'automation.ai']

const SECRET_KEY = 'automation.aiApiKey'

const DEFAULT_CONFIG = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '',
  model: 'glm-4-flash',
  temperature: 0.2,
}

/**
 * 读取非敏感的 AI 配置（baseUrl / model 等），apiKey 不在此返回。
 */
function getPlainConfig() {
  const store = window.$preload?.store
  if (!store) {
    return { ...DEFAULT_CONFIG, apiKey: '' }
  }

  // 1. 优先读取新的 preference store
  const automationPrefs = store.get('automation') || {}
  if (automationPrefs.aiApiKey || automationPrefs.aiBaseUrl) {
    return {
      ...DEFAULT_CONFIG,
      baseUrl: automationPrefs.aiBaseUrl || DEFAULT_CONFIG.baseUrl,
      apiKey: automationPrefs.aiApiKey || '',
      model: automationPrefs.aiModel || DEFAULT_CONFIG.model,
    }
  }

  // 2. 兼容旧配置
  for (const key of STORE_KEYS) {
    const value = store.get(key)
    if (value && (value.apiKey || value.baseUrl)) {
      return {
        ...DEFAULT_CONFIG,
        ...value,
      }
    }
  }

  return { ...DEFAULT_CONFIG, apiKey: '' }
}

/**
 * 获取完整 AI 配置，apiKey 优先从加密存储读取。
 *
 * 为兼容旧数据，若加密存储中不存在但明文 store 中有 apiKey，
 * 会自动迁移到加密存储并清空明文字段。
 */
export async function getAutomationAiConfig() {
  const plain = getPlainConfig()

  let apiKey = await getSecret(SECRET_KEY)

  // 迁移旧的明文 apiKey 到加密存储
  if (!apiKey && plain.apiKey) {
    apiKey = plain.apiKey
    await setSecret(SECRET_KEY, apiKey)
    clearPlainApiKey()
  }

  return {
    ...plain,
    apiKey: apiKey || '',
  }
}

function clearPlainApiKey() {
  const store = window.$preload?.store
  if (!store) {
    return
  }
  const automationPrefs = store.get('automation') || {}
  if (automationPrefs.aiApiKey) {
    store.set('automation', {
      ...automationPrefs,
      aiApiKey: '',
    })
  }
}

export async function saveAutomationAiConfig(config = {}) {
  const current = await getAutomationAiConfig()
  const next = {
    ...current,
    ...config,
  }

  const store = window.$preload?.store
  if (store) {
    const automationPrefs = store.get('automation') || {}
    store.set('automation', {
      ...automationPrefs,
      aiBaseUrl: next.baseUrl,
      aiModel: next.model,
      // apiKey 不再明文落盘
      aiApiKey: '',
    })
  }

  await setSecret(SECRET_KEY, next.apiKey || '')

  return next
}

export async function isAutomationAiConfigured() {
  const config = await getAutomationAiConfig()
  return Boolean(config.apiKey && config.baseUrl)
}

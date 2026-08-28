import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { get } from 'lodash-es'

const $electronStore = window.$preload?.store
const POINTER_STORAGE_KEY = 'automation_api_pointers'
const RANDOM_POOL_STORAGE_KEY = 'automation_api_random_pools'

// 内置演示物料 - 全部使用 data URI (200x200 纯色 JPEG) 保证离线/任意网络下均可工作
// ⚠️ 这些是占位图，正式使用请配置真实图文接口或替换为自有素材
const PLACEHOLDER_RED = 'data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADIAMgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAUH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AnARGoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z'
const PLACEHOLDER_GREEN = 'data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADIAMgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAUG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AogIrHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z'
const PLACEHOLDER_BLUE = 'data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCADIAMgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCYC9TQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/9k='

const DEFAULT_SOURCES = [
  {
    id: 'demo_xhs_lifestyle',
    name: '📕 小红书精选素材库 (演示与调试源)',
    url: 'https://mock.escrcpy.local/api/notes/feed',
    method: 'GET',
    headers: '',
    body: '',
    titleField: 'title',
    contentField: 'content',
    tagsField: 'tags',
    imagesField: 'images',
    mockNotes: [
      {
        title: '终于整理出来了！夏季日常显瘦穿搭精选 ✨',
        content: '今天跟姐妹们分享几套近期私藏的显瘦穿搭，面料舒适透气，细节设计很戳人！喜欢的宝子们赶紧点赞收藏起来吧～',
        tags: '#穿搭分享 #OOTD #夏日穿搭 #显瘦穿搭 #女生日常',
        images: [PLACEHOLDER_RED, PLACEHOLDER_GREEN],
      },
      {
        title: '零失败！手残党也能做的减脂高蛋白神仙早餐 🥪',
        content: '5分钟就能搞定的懒人减脂早餐！低卡饱腹感极强，减脂期的宝子们一定要试试，早晨吃得好一天元气满满！',
        tags: '#减脂餐 #健康饮食 #早餐打卡 #减脂日常 #自制美食',
        images: [PLACEHOLDER_BLUE],
      },
      {
        title: '超治愈的宝藏好物推荐！提升幸福感的小物件 🌿',
        content: '提升居家幸福感真的不需要花大钱，这几件高颜值实用好物亲测好用，摆在桌上心情都变好啦！',
        tags: '#好物推荐 #家居美学 #小众好物 #提升幸福感的好物',
        images: [PLACEHOLDER_GREEN, PLACEHOLDER_BLUE, PLACEHOLDER_RED],
      },
    ],
  },
]

export const useApiSourceStore = defineStore('app-api-source', () => {
  const sources = ref(loadSources())
  const currentPointers = ref(loadPointers())
  const randomPools = ref(loadRandomPools())
  const allocationChains = new Map()
  const itemsCache = ref({})

  function loadPointers() {
    try {
      const stored = $electronStore?.get(POINTER_STORAGE_KEY)
      return stored && typeof stored === 'object' ? stored : {}
    }
    catch {
      return {}
    }
  }

  function loadRandomPools() {
    try {
      const stored = $electronStore?.get(RANDOM_POOL_STORAGE_KEY)
      return stored && typeof stored === 'object' ? stored : {}
    }
    catch {
      return {}
    }
  }

  function persistAllocationState() {
    try {
      $electronStore?.set(POINTER_STORAGE_KEY, JSON.parse(JSON.stringify(currentPointers.value)))
      $electronStore?.set(RANDOM_POOL_STORAGE_KEY, JSON.parse(JSON.stringify(randomPools.value)))
    }
    catch (e) {
      console.warn('Failed to persist api allocation state:', e)
    }
  }

  function runWithAllocationLock(apiId, fn) {
    const previous = allocationChains.get(apiId) || Promise.resolve()
    const current = previous.then(() => fn())
    allocationChains.set(apiId, current.catch(() => {}))
    return current
  }

  function buildMaterialResult(item, index, total, sourceName) {
    return {
      item,
      index,
      itemNumber: index + 1,
      total,
      sourceName,
    }
  }

  function allocateMaterialIndices(apiId, items, count, strategy = 'sequential', options = {}) {
    const { requireUnique = false, allowPartial = false } = options
    const source = getSourceById(apiId)
    const sourceName = source?.name || apiId
    const results = []

    if (strategy === 'random') {
      let pool = randomPools.value[apiId]
      if (!Array.isArray(pool) || pool.length === 0 || pool.some(idx => idx >= items.length)) {
        pool = shuffleArray(Array.from({ length: items.length }, (_, i) => i))
      }

      for (let i = 0; i < count; i++) {
        if (!pool.length) {
          if (requireUnique && allowPartial) {
            break
          }
          if (requireUnique) {
            throw new Error(`接口 [${sourceName}] 物料不足：需要 ${count} 篇不重复文章，当前仅 ${items.length} 篇`)
          }
          pool = shuffleArray(Array.from({ length: items.length }, (_, idx) => idx))
        }
        const targetIndex = pool.pop()
        results.push(buildMaterialResult(items[targetIndex], targetIndex, items.length, sourceName))
      }

      randomPools.value[apiId] = pool
      persistAllocationState()
      return results
    }

    if (strategy === 'specific') {
      strategy = 'sequential'
    }

    const startIdx = currentPointers.value[apiId] || 0
    let actualCount = count

    if (requireUnique) {
      const remaining = Math.max(0, items.length - startIdx)
      if (allowPartial) {
        actualCount = Math.min(count, remaining)
        if (actualCount <= 0) {
          return []
        }
      }
      else if (startIdx + count > items.length) {
        throw new Error(`接口 [${sourceName}] 剩余可用物料不足：需要 ${count} 篇不重复文章，当前仅剩 ${remaining} 篇（共 ${items.length} 篇）`)
      }
    }

    for (let i = 0; i < actualCount; i++) {
      const targetIndex = requireUnique
        ? startIdx + i
        : (startIdx + i) % items.length
      results.push(buildMaterialResult(items[targetIndex], targetIndex, items.length, sourceName))
    }

    currentPointers.value[apiId] = startIdx + actualCount

    persistAllocationState()
    return results
  }

  function shuffleArray(arr) {
    const list = [...arr]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }

  function loadSources() {
    try {
      const stored = $electronStore?.get('automation_api_sources')
      if (Array.isArray(stored) && stored.length > 0) {
        return stored
      }
    }
    catch (e) {
      console.warn('Failed to load api sources from store:', e)
    }
    return DEFAULT_SOURCES
  }

  function saveSources() {
    try {
      $electronStore?.set('automation_api_sources', JSON.parse(JSON.stringify(sources.value)))
    }
    catch (e) {
      console.warn('Failed to save api sources to store:', e)
    }
  }

  function getSourceById(id) {
    return sources.value.find(s => s.id === id) || sources.value[0] || null
  }

  function addSource(source) {
    const item = {
      id: nanoid(),
      name: source.name || '新建图文接口源',
      url: source.url || '',
      method: source.method || 'GET',
      headers: source.headers || '',
      body: source.body || '',
      titleField: source.titleField || 'title',
      contentField: source.contentField || 'content',
      tagsField: source.tagsField || 'tags',
      imagesField: source.imagesField || 'images',
      mockNotes: source.mockNotes || [],
    }
    sources.value.push(item)
    saveSources()
    return item
  }

  function updateSource(id, patch) {
    const idx = sources.value.findIndex(s => s.id === id)
    if (idx >= 0) {
      sources.value[idx] = {
        ...sources.value[idx],
        ...patch,
      }
      saveSources()
    }
  }

  function removeSource(id) {
    const idx = sources.value.findIndex(s => s.id === id)
    if (idx >= 0) {
      sources.value.splice(idx, 1)
      if (sources.value.length === 0) {
        sources.value = [...DEFAULT_SOURCES]
      }
      saveSources()
    }
  }

  /**
   * Test API connectivity and parse response into normalized items.
   */
  async function testApiConnection(config) {
    if (!config?.url || config.url.includes('mock.escrcpy.local')) {
      // Mock data fallback
      const mockList = config?.mockNotes?.length ? config.mockNotes : DEFAULT_SOURCES[0].mockNotes
      return {
        success: true,
        isMock: true,
        count: mockList.length,
        items: mockList,
        message: `已成功连接并使用内置测试物料（共 ${mockList.length} 篇）`,
      }
    }

    try {
      let headersObj = {}
      if (config.headers) {
        try {
          headersObj = typeof config.headers === 'string' ? JSON.parse(config.headers) : config.headers
        }
        catch {
          console.warn('Headers JSON parse failed')
        }
      }

      const fetchOptions = {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headersObj,
        },
      }

      if (config.method === 'POST' && config.body) {
        fetchOptions.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
      }

      const res = await fetch(config.url, fetchOptions)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      const rawList = Array.isArray(json) ? json : (json.data || json.items || json.list || [json])

      const parsedItems = (Array.isArray(rawList) ? rawList : [rawList]).map((item) => {
        const title = get(item, config.titleField || 'title') || item.title || ''
        const content = get(item, config.contentField || 'content') || item.content || ''
        const tagsRaw = get(item, config.tagsField || 'tags') || item.tags || ''
        const tags = Array.isArray(tagsRaw) ? tagsRaw.join(' ') : String(tagsRaw || '')
        const imagesRaw = get(item, config.imagesField || 'images') || item.images || []
        const images = Array.isArray(imagesRaw) ? imagesRaw : (imagesRaw ? [imagesRaw] : [])

        return {
          title: String(title),
          content: String(content),
          tags: String(tags),
          images,
        }
      })

      return {
        success: true,
        isMock: false,
        count: parsedItems.length,
        items: parsedItems,
        rawJson: json,
        message: `验证成功！已成功从接口拉取并解析出 ${parsedItems.length} 篇图文笔记`,
      }
    }
    catch (err) {
      return {
        success: false,
        error: err.message || String(err),
        message: `接口请求失败: ${err.message || String(err)}`,
      }
    }
  }

  /**
   * Reserve multiple unique materials for batch/cluster execution.
   */
  async function reserveUniqueMaterials(apiId, count, strategy = 'sequential', options = {}) {
    if (!count || count <= 0) {
      return []
    }

    const source = getSourceById(apiId)
    if (!source) {
      throw new Error(`未找到 ID 为 [${apiId}] 的接口配置`)
    }

    const testRes = await testApiConnection(source)
    if (!testRes.success || !testRes.items?.length) {
      throw new Error(testRes.error || '接口未返回有效的内容物料')
    }

    itemsCache.value[apiId] = {
      items: testRes.items,
      fetchedAt: Date.now(),
      sourceName: source.name,
    }

    const items = testRes.items
    const requireUnique = options.requireUnique !== false
    const allowPartial = options.allowPartial === true

    return runWithAllocationLock(apiId, () => allocateMaterialIndices(
      apiId,
      items,
      count,
      strategy,
      { requireUnique, allowPartial },
    ))
  }

  /**
   * Fetch a single material by strategy (sequential, random, specific).
   */
  async function fetchMaterialItem(apiId, strategy = 'sequential', specificIndex = 0) {
    const source = getSourceById(apiId)
    if (!source) {
      throw new Error(`未找到 ID 为 [${apiId}] 的接口配置`)
    }

    const testRes = await testApiConnection(source)
    if (!testRes.success || !testRes.items?.length) {
      throw new Error(testRes.error || '接口未返回有效的内容物料')
    }

    const items = testRes.items

    if (strategy === 'specific') {
      const rawNum = Number(specificIndex) || 1
      const targetIndex = Math.min(Math.max(0, rawNum - 1), items.length - 1)
      return buildMaterialResult(items[targetIndex], targetIndex, items.length, source.name)
    }

    const [result] = await runWithAllocationLock(apiId, () => allocateMaterialIndices(
      apiId,
      items,
      1,
      strategy,
      { requireUnique: false },
    ))

    return result
  }

  function resetPool(apiId) {
    if (apiId) {
      delete randomPools.value[apiId]
      delete currentPointers.value[apiId]
      delete itemsCache.value[apiId]
    }
    else {
      randomPools.value = {}
      currentPointers.value = {}
      itemsCache.value = {}
    }
    persistAllocationState()
  }

  return {
    sources,
    loadSources,
    saveSources,
    getSourceById,
    addSource,
    updateSource,
    removeSource,
    testApiConnection,
    fetchMaterialItem,
    reserveUniqueMaterials,
    resetPool,
  }
})

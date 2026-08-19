import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { get } from 'lodash-es'

const $electronStore = window.$preload?.store

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
        images: [
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&q=80',
          'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1080&q=80',
        ],
      },
      {
        title: '零失败！手残党也能做的减脂高蛋白神仙早餐 🥪',
        content: '5分钟就能搞定的懒人减脂早餐！低卡饱腹感极强，减脂期的宝子们一定要试试，早晨吃得好一天元气满满！',
        tags: '#减脂餐 #健康饮食 #早餐打卡 #减脂日常 #自制美食',
        images: [
          'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1080&q=80',
        ],
      },
      {
        title: '超治愈的宝藏好物推荐！提升幸福感的小物件 🌿',
        content: '提升居家幸福感真的不需要花大钱，这几件高颜值实用好物亲测好用，摆在桌上心情都变好啦！',
        tags: '#好物推荐 #家居美学 #小众好物 #提升幸福感的好物',
        images: [
          'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1080&q=80',
        ],
      },
    ],
  },
]

export const useApiSourceStore = defineStore('app-api-source', () => {
  const sources = ref(loadSources())
  const currentPointers = ref({})

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
    let selectedItem = null
    let targetIndex = 0

    if (strategy === 'random') {
      targetIndex = Math.floor(Math.random() * items.length)
      selectedItem = items[targetIndex]
    }
    else if (strategy === 'specific') {
      targetIndex = Math.min(Math.max(0, Number(specificIndex) || 0), items.length - 1)
      selectedItem = items[targetIndex]
    }
    else {
      // sequential
      const currentIdx = currentPointers.value[apiId] || 0
      targetIndex = currentIdx % items.length
      selectedItem = items[targetIndex]
      currentPointers.value[apiId] = targetIndex + 1
    }

    return {
      item: selectedItem,
      index: targetIndex,
      total: items.length,
      sourceName: source.name,
    }
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
  }
})

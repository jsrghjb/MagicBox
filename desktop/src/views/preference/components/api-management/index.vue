<template>
  <div class="api-management min-w-0 max-w-full">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <i class="i-bi-cloud-arrow-down text-primary-500 text-lg flex-none"></i>
          <span>外部图文接口源管理</span>
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed max-w-3xl">
          可配置多个平台的图文内容 API。脚本执行时按顺序或随机策略，从对应接口源提取标题、正文、话题及图片并推送到手机相册。
        </p>
      </div>
    </div>

    <div class="api-workspace min-w-0 max-w-full">
      <div class="api-workspace__layout min-h-[28rem]">
        <!-- 左侧：接口源列表（支持多个平台扩展） -->
        <aside class="api-sidebar">
          <div class="api-sidebar__header">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">接口源列表</span>
            <el-button type="primary" size="small" link @click="handleCreateSource">
              <i class="i-bi-plus-lg mr-0.5"></i>
              新增
            </el-button>
          </div>

          <div class="api-sidebar__list">
            <button
              v-for="source in apiSourceStore.sources"
              :key="source.id"
              type="button"
              class="api-source-item"
              :class="{ 'is-active': selectedSourceId === source.id }"
              @click="selectSource(source.id)"
            >
              <div class="min-w-0 flex-1 text-left">
                <div class="truncate font-medium text-sm">
                  {{ source.name }}
                </div>
                <div class="truncate text-[11px] text-gray-400 font-mono mt-0.5">
                  {{ source.url || '未配置 URL' }}
                </div>
              </div>
              <el-button
                v-if="apiSourceStore.sources.length > 1"
                text
                circle
                size="small"
                class="!p-1 text-gray-400 hover:!text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-none"
                @click.stop="handleDeleteSource(source)"
              >
                <i class="i-bi-trash"></i>
              </el-button>
            </button>
          </div>
        </aside>

        <!-- 右侧：当前接口源配置 -->
        <main v-if="currentSource" class="api-main">
          <el-form label-position="top" class="api-form" @submit.prevent>
            <el-form-item label="接口源名称" class="api-form-item">
              <el-input v-model="currentSource.name" placeholder="例如：小红书素材库 / 抖音图文库" @change="saveCurrent" />
            </el-form-item>

            <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_140px] gap-x-4 gap-y-0">
              <el-form-item label="请求地址 (URL)" class="api-form-item">
                <el-input v-model="currentSource.url" placeholder="https://api.yourdomain.com/notes/list" @change="saveCurrent">
                  <template #prefix>
                    <i class="i-bi-link-45deg text-gray-400"></i>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="请求方法" class="api-form-item">
                <el-select v-model="currentSource.method" class="w-full" @change="saveCurrent">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                </el-select>
              </el-form-item>
            </div>

            <el-collapse class="el-collapse--beautify api-collapse">
              <el-collapse-item title="高级请求参数 (Headers & Body)">
                <div class="space-y-3 pt-1 min-w-0">
                  <div>
                    <div class="text-xs text-gray-500 mb-1">
                      请求头 Headers (JSON 格式):
                    </div>
                    <el-input
                      v-model="currentSource.headers"
                      type="textarea"
                      :rows="2"
                      placeholder="{ &quot;Authorization&quot;: &quot;Bearer your_token_here&quot; }"
                      @change="saveCurrent"
                    />
                  </div>
                  <div v-if="currentSource.method === 'POST'">
                    <div class="text-xs text-gray-500 mb-1">
                      POST 请求体 Body (JSON 格式):
                    </div>
                    <el-input
                      v-model="currentSource.body"
                      type="textarea"
                      :rows="2"
                      placeholder="{ &quot;category&quot;: &quot;lifestyle&quot; }"
                      @change="saveCurrent"
                    />
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>

            <div class="api-section">
              <div class="api-section__title">
                <i class="i-bi-diagram-3 text-primary-500 flex-none"></i>
                <span>返回数据字段映射 (JSON Path)</span>
              </div>
              <div class="api-section__body grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0">
                <el-form-item label="标题字段 (Title)" class="api-form-item">
                  <el-input v-model="currentSource.titleField" placeholder="title 或 data.title" @change="saveCurrent" />
                </el-form-item>
                <el-form-item label="正文字段 (Content)" class="api-form-item">
                  <el-input v-model="currentSource.contentField" placeholder="content 或 data.desc" @change="saveCurrent" />
                </el-form-item>
                <el-form-item label="话题字段 (Tags)" class="api-form-item">
                  <el-input v-model="currentSource.tagsField" placeholder="tags 或 data.topics" @change="saveCurrent" />
                </el-form-item>
                <el-form-item label="图片列表字段 (Images)" class="api-form-item">
                  <el-input v-model="currentSource.imagesField" placeholder="images 或 data.pics" @change="saveCurrent" />
                </el-form-item>
              </div>
            </div>

            <el-button type="success" :loading="testing" @click="handleTestConnection">
              <i class="i-bi-lightning-charge-fill mr-1"></i>
              验证接口并拉取图文预览
            </el-button>
          </el-form>

          <div v-if="testResult" class="space-y-3 pt-4 min-w-0 border-t border-gray-100 dark:border-gray-800 mt-4">
            <el-alert
              :type="testResult.success ? 'success' : 'error'"
              :title="testResult.message"
              show-icon
              :closable="false"
            />

            <div v-if="testResult.success && testResult.items?.length" class="space-y-2 min-w-0">
              <div class="text-xs font-semibold text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>共解析出 {{ testResult.items.length }} 篇待发布图文物料预览</span>
                <span class="text-[11px] text-primary-600 font-mono">相册推送支持 1~9 张多图</span>
              </div>

              <div class="grid grid-cols-1 gap-3">
                <div
                  v-for="(item, idx) in testResult.items"
                  :key="idx"
                  class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex flex-col gap-2 min-w-0"
                >
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1.5 min-w-0">
                      <span class="bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex-none">
                        #{{ idx + 1 }}
                      </span>
                      <h4 class="text-xs font-bold text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0" :title="item.title">
                        {{ item.title || '（无标题）' }}
                      </h4>
                    </div>
                    <p class="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed mb-2 break-words" :title="item.content">
                      {{ item.content || '（无正文描述）' }}
                    </p>
                    <div v-if="item.tags" class="text-[10px] text-blue-500 truncate mb-2">
                      {{ item.tags }}
                    </div>
                  </div>

                  <div v-if="item.images?.length" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-gray-100 dark:border-gray-800 min-w-0">
                    <div
                      v-for="(imgUrl, imgIdx) in item.images"
                      :key="imgIdx"
                      class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-none border border-gray-200 dark:border-gray-700 relative"
                    >
                      <img :src="imgUrl" class="w-full h-full object-cover" alt="封面" />
                      <span class="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-tl">
                        {{ imgIdx + 1 }}
                      </span>
                    </div>
                    <span class="text-[10px] text-gray-400 ml-1 whitespace-nowrap flex-none">共 {{ item.images.length }} 图</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <div v-else class="api-main api-main--empty">
          <el-empty description="暂无接口源，请先新增一个接口源" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useApiSourceStore } from '$/store/api-source/index.js'

const apiSourceStore = useApiSourceStore()

const selectedSourceId = ref(apiSourceStore.sources[0]?.id || '')

const currentSource = computed(() => {
  return apiSourceStore.sources.find(s => s.id === selectedSourceId.value) || apiSourceStore.sources[0] || null
})

const testing = ref(false)
const testResult = ref(null)

function selectSource(id) {
  selectedSourceId.value = id
  testResult.value = null
}

function saveCurrent() {
  apiSourceStore.saveSources()
}

function handleCreateSource() {
  const newSource = apiSourceStore.addSource({
    name: `新建图文接口源 ${apiSourceStore.sources.length + 1}`,
    url: '',
    method: 'GET',
  })
  selectSource(newSource.id)
  ElMessage.success('已新建图文接口源')
}

async function handleDeleteSource(source) {
  try {
    await ElMessageBox.confirm(`确定删除接口源【${source.name}】吗？`, '删除确认', { type: 'warning' })
    apiSourceStore.removeSource(source.id)
    if (selectedSourceId.value === source.id) {
      selectSource(apiSourceStore.sources[0]?.id || '')
    }
    testResult.value = null
    ElMessage.success('已删除接口源')
  }
  catch {}
}

async function handleTestConnection() {
  if (!currentSource.value) {
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const res = await apiSourceStore.testApiConnection(currentSource.value)
    testResult.value = res
    if (res.success) {
      ElMessage.success(res.message)
    }
    else {
      ElMessage.error(res.message)
    }
  }
  catch (err) {
    testResult.value = {
      success: false,
      message: err.message || String(err),
    }
  }
  finally {
    testing.value = false
  }
}
</script>

<style scoped lang="postcss">
.api-management {
  @apply box-border w-full;
}

.api-workspace {
  @apply w-full;
}

.api-workspace__layout {
  @apply flex flex-col lg:flex-row gap-0 min-w-0 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-900/40 overflow-hidden;
}

.api-sidebar {
  @apply w-full lg:w-56 xl:w-60 flex-none flex flex-col min-h-0 bg-gray-50/80 dark:bg-gray-950/30 border-b lg:border-b-0 lg:border-r border-gray-200/80 dark:border-gray-700/80;
}

.api-sidebar__header {
  @apply flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200/60 dark:border-gray-700/60;
}

.api-sidebar__list {
  @apply flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 max-h-56 lg:max-h-none;
}

.api-source-item {
  @apply group w-full flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer min-w-0;
  @apply bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 text-gray-700 dark:text-gray-300;
  @apply hover:border-gray-300 dark:hover:border-gray-700;
}

.api-source-item.is-active {
  @apply bg-primary-50 dark:bg-primary-950/40 border-primary-300 dark:border-primary-800 text-primary-700 dark:text-primary-300 shadow-sm;
}

.api-main {
  @apply flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5;
}

.api-main--empty {
  @apply flex items-center justify-center;
}

.api-form :deep(.el-form-item),
.api-form :deep(.el-form-item__content),
.api-form :deep(.el-input),
.api-form :deep(.el-select),
.api-form :deep(.el-textarea),
.api-form :deep(.el-collapse),
.api-management :deep(.el-alert) {
  @apply max-w-full box-border;
}

.api-form :deep(.el-form-item__label) {
  @apply !p-0 !mb-1 !h-auto leading-5 text-gray-600 dark:text-gray-300 font-medium;
}

.api-form-item {
  @apply mb-3 w-full;
}

.api-section {
  @apply rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-800/40 overflow-hidden mb-3;
}

.api-section__title {
  @apply px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 border-b border-gray-200/60 dark:border-gray-700/60;
}

.api-section__body {
  @apply p-4 pt-3;
}

.api-collapse :deep(.el-collapse-item__header),
.api-collapse :deep(.el-collapse-item__wrap) {
  @apply max-w-full box-border;
}
</style>

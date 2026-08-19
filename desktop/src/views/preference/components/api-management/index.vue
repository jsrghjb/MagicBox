<template>
  <div class="h-full flex flex-col gap-4">
    <div class="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <i class="i-bi-cloud-arrow-down text-primary-500 text-lg"></i>
          <span>外部图文接口源管理</span>
        </h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          配置第三方图文内容 API，脚本发帖时可按顺序或随机自动提取标题、正文、话题及高清图片推送到手机相册。
        </p>
      </div>
      <el-button type="primary" size="small" @click="handleCreateSource">
        <i class="i-bi-plus-lg mr-1"></i> 新增接口源
      </el-button>
    </div>

    <div class="flex-1 min-h-0 flex gap-4">
      <!-- 左侧接口源列表 -->
      <div class="w-60 flex-none flex flex-col gap-2 border-r border-gray-100 dark:border-gray-800 pr-3 overflow-y-auto">
        <div
          v-for="source in apiSourceStore.sources"
          :key="source.id"
          class="p-2.5 rounded-lg cursor-pointer transition-all border text-xs relative group flex items-center justify-between gap-2"
          :class="[
            selectedSourceId === source.id
              ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-300 dark:border-primary-800 text-primary-700 dark:text-primary-300 shadow-sm font-medium'
              : 'bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300',
          ]"
          @click="selectedSourceId = source.id"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-sm">
              {{ source.name }}
            </div>
            <div class="truncate text-[11px] text-gray-400 font-mono mt-0.5">
              {{ source.url || '未配置请求URL' }}
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
        </div>
      </div>

      <!-- 右侧接口配置与验证面板 -->
      <div v-if="currentSource" class="flex-1 min-w-0 overflow-y-auto pr-2 space-y-4">
        <el-form label-position="top" size="default">
          <el-row :gutter="16">
            <el-col :span="16">
              <el-form-item label="接口源名称">
                <el-input v-model="currentSource.name" placeholder="请输入接口备注名称" @change="saveCurrent" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="请求方法">
                <el-select v-model="currentSource.method" class="w-full" @change="saveCurrent">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="请求地址 (URL)">
            <el-input v-model="currentSource.url" placeholder="https://api.yourdomain.com/notes/list" @change="saveCurrent">
              <template #prefix>
                <i class="i-bi-link-45deg text-gray-400"></i>
              </template>
            </el-input>
          </el-form-item>

          <el-collapse class="el-collapse--beautify">
            <el-collapse-item title="高级请求参数 (Headers & Body)">
              <div class="space-y-3 pt-2">
                <div>
                  <div class="text-xs text-gray-500 mb-1">
                    请求头 Headers (JSON 格式，如鉴权 Token):
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

          <div class="bg-gray-50/80 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200/60 dark:border-gray-700/60 space-y-3">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <i class="i-bi-diagram-3 text-primary-500"></i>
              <span>返回数据字段映射 (JSON Path 路径)</span>
            </div>
            <el-row :gutter="12">
              <el-col :span="6">
                <el-form-item label="标题字段 (Title)" class="!mb-0">
                  <el-input v-model="currentSource.titleField" placeholder="title 或 data.title" @change="saveCurrent" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="正文字段 (Content)" class="!mb-0">
                  <el-input v-model="currentSource.contentField" placeholder="content 或 data.desc" @change="saveCurrent" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="话题字段 (Tags)" class="!mb-0">
                  <el-input v-model="currentSource.tagsField" placeholder="tags 或 data.topics" @change="saveCurrent" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="图片列表字段 (Images)" class="!mb-0">
                  <el-input v-model="currentSource.imagesField" placeholder="images 或 data.pics" @change="saveCurrent" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <el-button type="success" :loading="testing" @click="handleTestConnection">
              <i class="i-bi-lightning-charge-fill mr-1"></i>
              验证接口并拉取图文预览
            </el-button>
          </div>
        </el-form>

        <!-- 验证结果与实时物料卡片流 -->
        <div v-if="testResult" class="space-y-3 pt-2">
          <el-alert
            :type="testResult.success ? 'success' : 'error'"
            :title="testResult.message"
            show-icon
            :closable="false"
          />

          <div v-if="testResult.success && testResult.items?.length" class="space-y-2">
            <div class="text-xs font-semibold text-gray-500 flex items-center justify-between">
              <span>共解析出 {{ testResult.items.length }} 篇待发布图文物料预览：</span>
              <span class="text-[11px] text-primary-600 font-mono">相册推送支持 1~9 张多图</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="(item, idx) in testResult.items"
                :key="idx"
                class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-sm flex flex-col justify-between gap-2"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="bg-primary-100 dark:bg-primary-900/60 text-primary-700 dark:text-primary-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      #{{ idx + 1 }}
                    </span>
                    <h4 class="text-xs font-bold text-gray-800 dark:text-gray-100 truncate flex-1" :title="item.title">
                      {{ item.title || '（无标题）' }}
                    </h4>
                  </div>
                  <p class="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed mb-2" :title="item.content">
                    {{ item.content || '（无正文描述）' }}
                  </p>
                  <div v-if="item.tags" class="text-[10px] text-blue-500 truncate mb-2">
                    {{ item.tags }}
                  </div>
                </div>

                <!-- 缩略图列表 -->
                <div v-if="item.images?.length" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-gray-100 dark:border-gray-800">
                  <div
                    v-for="(imgUrl, imgIdx) in item.images"
                    :key="imgIdx"
                    class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-none border border-gray-200 dark:border-gray-700 relative group/img"
                  >
                    <img :src="imgUrl" class="w-full h-full object-cover" alt="封面" />
                    <span class="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-tl">
                      {{ imgIdx + 1 }}
                    </span>
                  </div>
                  <span class="text-[10px] text-gray-400 ml-1 whitespace-nowrap">共 {{ item.images.length }} 图</span>
                </div>
              </div>
            </div>
          </div>
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

function saveCurrent() {
  apiSourceStore.saveSources()
}

function handleCreateSource() {
  const newSource = apiSourceStore.addSource({
    name: `新建图文接口源 ${apiSourceStore.sources.length + 1}`,
    url: '',
    method: 'GET',
  })
  selectedSourceId.value = newSource.id
  testResult.value = null
  ElMessage.success('已新建图文接口源')
}

async function handleDeleteSource(source) {
  try {
    await ElMessageBox.confirm(`确定删除接口源【${source.name}】吗？`, '删除确认', { type: 'warning' })
    apiSourceStore.removeSource(source.id)
    if (selectedSourceId.value === source.id) {
      selectedSourceId.value = apiSourceStore.sources[0]?.id || ''
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

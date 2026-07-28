<template>
  <el-card shadow="never" class="el-card--beautify h-full flex flex-col !overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span>{{ $t('automation.scripts') }}</span>
        <el-dropdown trigger="click" @command="handleCommand">
          <el-button text circle icon="Plus" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="ai">
                {{ $t('automation.ai.entry') }}
              </el-dropdown-item>
              <el-dropdown-item command="record">
                录制新脚本
              </el-dropdown-item>
              <el-dropdown-item command="new">
                {{ $t('automation.script.new') }}
              </el-dropdown-item>
              <el-dropdown-item command="template">
                {{ $t('automation.template.select') }}
              </el-dropdown-item>
              <el-dropdown-item command="import">
                {{ $t('automation.script.import') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <div class="pb-2 flex-none">
      <el-button type="primary" class="w-full" @click="$emit('ai')">
        <i class="i-bi-stars mr-1"></i>
        {{ $t('automation.ai.entry') }}
      </el-button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <el-empty
        v-if="!filteredScripts.length"
        :description="$t('automation.scripts.empty')"
      />
      <div v-else class="space-y-1">
        <div
          v-for="script in filteredScripts"
          :key="script.id"
          class="px-2 py-2 rounded cursor-pointer flex items-center justify-between gap-2 transition-colors min-w-0"
          :class="[
            script.id === currentScriptId
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700',
          ]"
          @click="handleScriptSelect(script)"
        >
          <span class="truncate text-sm flex-1 min-w-0" :title="script.name">{{ script.name }}</span>
          <i
            v-if="!licenseStore.checkCategoryAccess(script.category || 'general')"
            class="i-bi-lock-fill text-amber-500 text-xs"
            title="该脚本需要升级版本解锁"
          ></i>
          <el-button
            text
            circle
            icon="Delete"
            size="small"
            @click.stop="$emit('delete', script)"
          />
        </div>
      </div>
    </div>

    <div class="pt-2 border-t dark:border-gray-700">
      <el-button class="w-full" @click="$emit('export')">
        {{ $t('automation.script.export') }}
      </el-button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFileChange"
    />

    <LicenseUpgradeModal />
  </el-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAutomationScripts } from '$/database/index.js'
import { useLicenseStore } from '$/store/license/index.js'
import LicenseUpgradeModal from '$/components/license-upgrade-modal/index.vue'

const props = defineProps({
  deviceId: {
    type: String,
    default: '',
  },
  currentScriptId: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: 'all',
  },
  isRunning: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'create', 'delete', 'import', 'export', 'template', 'ai', 'record'])

const licenseStore = useLicenseStore()
const { scripts } = useAutomationScripts(computed(() => props.deviceId))
const fileInputRef = ref(null)

const selectedCategory = ref('all')
const categories = [
  { id: 'all', label: '全部' },
  { id: 'general', label: '通用基础' },
  { id: 'xiaohongshu', label: '小红书' },
  { id: 'douyin', label: '抖音/TikTok' },
  { id: 'wechat', label: '微信/视频号' },
  { id: 'ecommerce', label: '跨境电商' },
  { id: 'custom', label: '自定义' },
]

function handleCategoryFilterClick(cat) {
  selectedCategory.value = cat.id
  if (cat.id !== 'all' && !licenseStore.checkCategoryAccess(cat.id)) {
    licenseStore.openUpgradeModal(cat.id)
  }
}

const filteredScripts = computed(() => {
  const cat = selectedCategory.value !== 'all' ? selectedCategory.value : props.category
  if (!cat || cat === 'all') {
    return scripts.value
  }
  return scripts.value.filter(s => (s.category || 'general') === cat)
})

onMounted(() => {
  licenseStore.fetchStatus()
})

function handleCategoryClick(cat) {
  selectedCategory.value = cat.id
  if (cat.id !== 'all' && !licenseStore.checkCategoryAccess(cat.id)) {
    licenseStore.openUpgradeModal(cat.id)
  }
}

function handleScriptSelect(script) {
  const cat = script.category || 'general'
  if (!licenseStore.checkCategoryAccess(cat)) {
    licenseStore.openUpgradeModal(cat)
    return
  }
  emit('select', script)
}

function handleCommand(command) {
  if (command === 'ai') {
    emit('ai')
  }
  else if (command === 'new') {
    emit('create')
  }
  else if (command === 'record') {
    emit('record')
  }
  else if (command === 'template') {
    emit('template')
  }
  else if (command === 'import') {
    fileInputRef.value?.click()
  }
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) {
    emit('import', file)
  }
  event.target.value = ''
}
</script>

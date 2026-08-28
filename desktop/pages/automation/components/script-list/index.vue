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
          class="px-2.5 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all min-w-0 group"
          :class="[
            script.id === currentScriptId
              ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-medium shadow-sm ring-1 ring-primary-200 dark:ring-primary-800/60'
              : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-200',
          ]"
          @click="handleScriptSelect(script)"
        >
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            <i class="i-bi-file-earmark-code text-gray-400 dark:text-gray-500 group-hover:text-primary-500 flex-none text-base"></i>
            <span
              class="truncate text-sm flex-1 min-w-0"
              :title="getScriptDisplayName(script)"
            >
              {{ getScriptDisplayName(script) }}
            </span>
            <span
              v-if="isPresetScript(script)"
              class="text-[10px] leading-none px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-100 dark:border-sky-900 flex-none shrink-0"
            >
              {{ presetBadgeLabel }}
            </span>
          </div>

          <el-dropdown
            v-if="!isPresetScript(script)"
            trigger="click"
            @command="(cmd) => handleItemCommand(cmd, script)"
          >
            <el-button
              text
              circle
              size="small"
              class="!p-1 text-gray-400 hover:!text-primary-500 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 rounded flex-none"
              title="操作与转移分类"
              @click.stop
            >
              <i class="i-bi-three-dots"></i>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled class="!text-xs !text-gray-400">
                  转移到分类:
                </el-dropdown-item>
                <el-dropdown-item command="move:general" :disabled="(script.category || 'general') === 'general'">
                  ⚡ 基础日常
                </el-dropdown-item>
                <el-dropdown-item command="move:social" :disabled="script.category === 'social'">
                  💬 社交通讯
                </el-dropdown-item>
                <el-dropdown-item command="move:media" :disabled="script.category === 'media'">
                  🎬 视频图文
                </el-dropdown-item>
                <el-dropdown-item command="move:ecommerce" :disabled="script.category === 'ecommerce'">
                  🛍️ 电商营销
                </el-dropdown-item>
                <el-dropdown-item command="move:game" :disabled="script.category === 'game'">
                  🎮 游戏日常
                </el-dropdown-item>
                <el-dropdown-item command="move:system" :disabled="script.category === 'system'">
                  ⚙️ 系统工具
                </el-dropdown-item>
                <el-dropdown-item command="move:custom" :disabled="script.category === 'custom'">
                  📁 自定义
                </el-dropdown-item>
                <el-dropdown-item divided command="delete" class="!text-red-500">
                  <i class="i-bi-trash mr-1"></i>
                  删除脚本
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
import { useAutomationScripts } from '$/database/index.js'
import { getPresetBadgeLabel, getScriptDisplayName, isPresetScript } from '$/utils/automation/preset-scripts.js'
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
const { scripts, updateScript } = useAutomationScripts(computed(() => props.deviceId))
const fileInputRef = ref(null)
const presetBadgeLabel = computed(() => getPresetBadgeLabel())

const categoryLabels = {
  general: '基础日常',
  social: '社交通讯',
  media: '视频图文',
  ecommerce: '电商营销',
  game: '游戏日常',
  system: '系统工具',
  custom: '自定义',
}

const filteredScripts = computed(() => {
  const cat = props.category || 'all'
  if (!cat || cat === 'all') {
    return scripts.value
  }
  return scripts.value.filter(s => (s.category || 'general') === cat)
})

onMounted(() => {
  licenseStore.fetchStatus()
})

async function handleItemCommand(cmd, script) {
  if (cmd === 'delete') {
    emit('delete', script)
  }
  else if (cmd.startsWith('move:')) {
    const targetCat = cmd.replace('move:', '')
    try {
      await updateScript(script.id, { category: targetCat })
      script.category = targetCat
      ElMessage.success(`已成功转移至 [${categoryLabels[targetCat] || targetCat}]`)
    }
    catch (err) {
      console.error('Failed to move script category:', err)
      ElMessage.error('转移分类失败')
    }
  }
}

function handleScriptSelect(script) {
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

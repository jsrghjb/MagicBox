<template>
  <el-config-provider :locale="locale" :size="size">
    <div class="flex flex-col h-screen">
      <AppHeader
        :title="pageTitle"
        :device-name="deviceName"
        class="px-2"
      >
        <template #right>
          <div class="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs *:app-region-no-drag">
            <!-- 居右展示各种平台分类 (不换行) -->
            <div class="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
              <button
                v-for="cat in categories"
                :key="cat.id"
                class="px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs"
                :class="[
                  selectedCategory === cat.id
                    ? 'bg-primary-500 text-white font-medium shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700/70',
                ]"
                @click="handleCategoryFilterClick(cat)"
              >
                <span>{{ cat.label }}</span>
              </button>
            </div>

            <el-switch v-model="isDark" class="el-switch--theme">
              <template #active-action>
                <i class="i-solar-moon-bold"></i>
              </template>
              <template #inactive-action>
                <i class="i-solar-sun-bold"></i>
              </template>
            </el-switch>
          </div>
        </template>
      </AppHeader>

      <div class="flex-1 min-h-0 flex overflow-hidden px-2 pb-2 pt-2 gap-2">
        <ScriptList
          class="w-56 flex-none"
          :device-id="deviceId"
          :category="selectedCategory"
          :current-script-id="currentScript?.id"
          :is-running="isRunning"
          @select="handleSelectScript"
          @create="handleCreateScript"
          @delete="handleDeleteScript"
          @import="handleImportScript"
          @export="handleExportScript"
          @template="handleApplyTemplate"
          @ai="handleAiGenerate"
          @record="openMacroRecorder('new')"
        />

        <div class="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          <!-- 顶部操作栏 (极简不溢出) -->
          <div class="flex items-center justify-between gap-3 flex-none bg-gray-50/70 dark:bg-gray-900/50 p-2 rounded-xl border border-gray-200/60 dark:border-gray-800/60 min-w-0">
            <template v-if="currentScript">
              <!-- 左侧: 脚本名称 -->
              <el-input
                v-model="currentScript.name"
                placeholder="请输入脚本名称"
                clearable
                style="width: 380px; min-width: 260px; max-width: 480px;"
                class="!w-96 flex-none"
              >
                <template #prefix>
                  <i class="i-bi-pencil-square text-gray-400 text-sm"></i>
                </template>
              </el-input>

              <!-- 右侧: 运行与控制工具栏 -->
              <RunToolbar
                class="flex-none"
                :status="automationStore.runningScriptId === currentScript?.id ? automationStore.runnerStatus : 'idle'"
                :has-script="Boolean(currentScript)"
                :has-steps="Boolean(currentScript?.steps?.length)"
                :has-selection="selectedStepIds.length > 0"
                :has-breakpoint="Boolean(automationStore.breakpointSnapshot && automationStore.breakpointSnapshot.scriptId === currentScript?.id)"
                :breakpoint-index="automationStore.breakpointSnapshot?.stepIndex ?? 0"
                @run-all="handleRunAll"
                @run-selected="handleRunSelected"
                @resume-breakpoint="handleResumeFromBreakpoint"
                @pause="automationStore.pauseRun"
                @resume="automationStore.resumeRun"
                @stop="automationStore.stopRun"
              />
            </template>
            <template v-else>
              <span class="text-xs text-gray-400 font-medium px-2 flex items-center gap-1">
                <i class="i-bi-info-circle text-primary-500"></i>
                请选择或新建自动化脚本
              </span>
            </template>
          </div>

          <template v-if="currentScript">
            <div class="flex-1 min-h-0 flex gap-2">
              <StepList
                class="w-72 flex-none min-h-0"
                :steps="currentScript.steps || []"
                :selected-step-id="automationStore.selectedStepId"
                :running-step-index="automationStore.runningStepIndex"
                @select="handleSelectStep"
                @add="handleAddStep"
                @remove="handleRemoveStep"
                @move-up="handleMoveStepUp"
                @move-down="handleMoveStepDown"
                @insert-before="handleInsertStepBefore"
                @insert-after="handleInsertStepAfter"
                @reorder="handleReorderSteps"
              />

              <div class="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
                <StepEditor
                  v-if="selectedStep"
                  class="flex-none"
                  :step="selectedStep"
                  :device-id="deviceId"
                  @update="handleUpdateStep"
                  @run-step="handleRunSingleStep"
                />
                <el-empty
                  v-else
                  class="flex-1"
                  :description="$t('automation.step.selectHint')"
                />

                <MagicVariables
                  class="flex-1 min-h-0"
                  :vars="currentScript.vars || {}"
                  @update="handleUpdateVars"
                />
              </div>

              <LogPanel
                class="w-64 flex-none min-h-0"
                :logs="automationStore.logs"
                @clear="automationStore.clearLogs"
              />
            </div>
          </template>

          <el-empty
            v-else
            class="flex-1"
            :description="$t('automation.empty.hint')"
          >
            <div class="flex items-center justify-center gap-2">
              <el-button type="primary" @click="handleAiGenerate">
                <i class="i-bi-stars mr-1"></i>
                {{ $t('automation.ai.entry') }}
              </el-button>
              <el-button type="warning" plain @click="openMacroRecorder('new')">
                <i class="i-bi-record-circle mr-1"></i>
                录制宏指令
              </el-button>
              <el-button @click="handleCreateScript">
                {{ $t('automation.script.new') }}
              </el-button>
            </div>
          </el-empty>
        </div>
      </div>

      <TemplateSelector
        v-if="templateDialogVisible"
        @close="templateDialogVisible = false"
        @apply="handleTemplateApply"
      />

      <BatchDialog
        v-if="batchDialogVisible"
        :device-id="deviceId"
        :scripts="scripts"
        @close="batchDialogVisible = false"
      />

      <AiGenerator
        v-if="aiDialogVisible"
        :device-id="deviceId"
        @close="aiDialogVisible = false"
        @apply="handleAiApply"
      />

      <MacroRecorder
        v-if="recorderVisible"
        :device-id="deviceId"
        @close="recorderVisible = false"
        @confirm="handleMacroRecordConfirm"
      />
    </div>
  </el-config-provider>
</template>

<script setup>
import { useAutomationEditor } from '$/composables/use-automation-editor/index.js'
import { nextTick, onMounted, watch } from 'vue'
import AppHeader from '$/components/app-header/index.vue'
import { useDeviceStore } from '$/store/device/index.js'
import { useLicenseStore } from '$/store/license/index.js'

import ScriptList from './components/script-list/index.vue'
import StepList from './components/step-list/index.vue'
import StepEditor from './components/step-editor/index.vue'
import RunToolbar from './components/run-toolbar/index.vue'
import LogPanel from './components/log-panel/index.vue'
import MagicVariables from './components/magic-variables/index.vue'
import TemplateSelector from './components/template-selector/index.vue'
import BatchDialog from './components/batch-dialog/index.vue'
import AiGenerator from './components/ai-generator/index.vue'
import MacroRecorder from './components/macro-recorder/index.vue'

const deviceStore = useDeviceStore()
const licenseStore = useLicenseStore()

const selectedCategory = ref('all')
const categories = [
  { id: 'all', label: '🌟 全部' },
  { id: 'general', label: '⚡ 基础日常' },
  { id: 'social', label: '💬 社交通讯' },
  { id: 'media', label: '🎬 视频图文' },
  { id: 'ecommerce', label: '🛍️ 电商营销' },
  { id: 'game', label: '🎮 游戏日常' },
  { id: 'system', label: '⚙️ 系统工具' },
  { id: 'custom', label: '📁 自定义' },
]

function handleCategoryFilterClick(cat) {
  selectedCategory.value = cat.id
}

const categoryLabels = {
  general: '基础日常',
  social: '社交通讯',
  media: '视频图文',
  ecommerce: '电商营销',
  game: '游戏日常',
  system: '系统工具',
  custom: '自定义',
}

const {
  currentDevice,
  locale,
  size,
  themeStore,
  queryParams,
} = useWindowStateSync({
  deviceSync: true,
  async onQueryMounted() {
    const currentDeviceId = currentDevice.value?.id
    if (currentDeviceId) {
      await deviceStore.getList()
    }
  },
  async onDeviceChange(device) {
    if (device?.id) {
      await deviceStore.getList()
    }
  },
})

const deviceId = computed(() => currentDevice.value?.id || '')
const deviceName = computed(() => deviceStore.getLabel(deviceId.value, 'name'))
const pageTitle = computed(() => window.t('automation.name'))

const editor = useAutomationEditor(deviceId)
const { state, actions, runs } = editor
const { scripts, currentScript, selectedStepIds, templateDialogVisible, batchDialogVisible, aiDialogVisible, recorderVisible, recorderMode, isRunning, selectedStep, automationStore, updateScript } = state
const { handleSelectScript, handleSelectStep, handleAddStep, handleRemoveStep, handleMoveStepUp, handleMoveStepDown, handleReorderSteps, handleInsertStepBefore, handleInsertStepAfter, handleUpdateStep, handleUpdateVars } = actions
const { handleImportScript, handleExportScript, handleApplyTemplate, handleTemplateApply, handleAiGenerate, handleAiApply, handleRunAll, handleRunSingleStep, handleRunSelected, handleResumeFromBreakpoint } = runs

async function handleCategoryChange(cat) {
  if (currentScript.value?.id) {
    currentScript.value.category = cat
    try {
      await updateScript(currentScript.value.id, { category: cat })
      ElMessage.success(`已切换分类至 [${categoryLabels[cat] || cat}]`)
    }
    catch (err) {
      console.error(err)
      ElMessage.error('切换分类失败')
    }
  }
}

const isDark = computed({
  get: () => themeStore.isDark,
  set: (value) => {
    themeStore.isDark = value
    themeStore.updateHtml(value ? 'dark' : 'light')
  },
})

watch(
  () => scripts.value,
  (list) => {
    if (list?.length > 0) {
      if (queryParams.value?.scriptId) {
        const target = list.find(s => s.id === queryParams.value.scriptId)
        if (target) {
          handleSelectScript(target)
          queryParams.value.scriptId = null
          return
        }
      }
      if (!currentScript.value || !list.some(s => s.id === currentScript.value.id)) {
        handleSelectScript(list[0])
      }
    }
  },
  { immediate: true },
)

async function handleCreateScript() {
  try {
    await actions.handleCreateScript({
      deviceId: 'common',
      category: selectedCategory.value !== 'all' ? selectedCategory.value : 'general',
    })
  }
  catch (error) {
    console.error('Failed to create script:', error)
    ElMessage.error(error.message || String(error))
  }
}

async function handleDeleteScript(script) {
  await actions.handleDeleteScript(script)
}

async function openMacroRecorder(mode) {
  if (!deviceId.value) {
    ElMessage.warning('请先连接设备！')
    return
  }
  recorderMode.value = mode
  recorderVisible.value = true
}

async function handleMacroRecordConfirm(steps) {
  await runs.handleMacroRecordConfirm(steps)
}

onMounted(async () => {
  await nextTick()
})
</script>

<style lang="postcss" scoped>
:deep(.el-card__body) {
  @apply flex-1 min-h-0 overflow-hidden flex flex-col;
}
</style>

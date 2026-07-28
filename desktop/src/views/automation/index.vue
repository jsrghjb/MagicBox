<template>
  <div class="h-full flex flex-col p-2 gap-2 bg-slate-50/50 dark:bg-gray-950/30">
    <!-- 通用入口：设备选择栏 + 平台分类 Tabs (在选择调试设备这一行的最右侧) -->
    <div class="flex-none flex items-center justify-between gap-3 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg shadow-sm min-w-0 overflow-x-auto no-scrollbar">
      <div class="flex items-center gap-3 flex-none min-w-0">
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">选择调试设备：</span>
        <div class="w-64 flex-none">
          <el-select v-model="selectedDeviceId" placeholder="请选择或切换运行脚本的设备" class="w-full" clearable>
            <el-option
              v-for="d in onlineDevices"
              :key="d.id"
              :label="getDeviceLabel(d)"
              :value="d.id"
            />
          </el-select>
        </div>
        <el-tag v-if="selectedDeviceId" type="success" class="whitespace-nowrap flex-none">
          调试中
        </el-tag>
      </div>

      <!-- 平台分类 Tabs (在选择调试设备这一行的最右侧，单行不换行) -->
      <div class="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap text-xs bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-lg border border-gray-200/50 dark:border-gray-700/50 flex-none">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer flex-none"
          :class="[
            selectedCategory === cat.id
              ? 'bg-primary-500 text-white font-medium shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-700/80',
          ]"
          @click="handleCategoryFilterClick(cat)"
        >
          <span v-if="!licenseStore.checkCategoryAccess(cat.id)" class="text-amber-500 font-bold">🔒</span>
          <span>{{ cat.label }}</span>
        </button>
      </div>
    </div>

    <!-- 核心编辑器区域 -->
    <div class="flex-1 min-h-0 flex bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-2 gap-2 shadow-sm">
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
        <template v-if="currentScript">
          <div class="flex items-center gap-3 flex-none">
            <span class="text-sm text-gray-500 flex-none whitespace-nowrap">{{ $t('automation.script.name') }}</span>
            <el-input
              v-model="currentScript.name"
              class="w-36"
            />
            <RunToolbar
              class="flex-none"
              :status="automationStore.runnerStatus"
              :has-script="true"
              :has-steps="Boolean(currentScript?.steps?.length)"
              :has-selection="selectedStepIds.length > 0"
              :has-breakpoint="Boolean(automationStore.breakpointSnapshot)"
              :breakpoint-index="automationStore.breakpointSnapshot?.stepIndex ?? 0"
              @run-all="handleRunAll"
              @run-selected="handleRunSelected"
              @resume-breakpoint="handleResumeFromBreakpoint"
              @pause="automationStore.pauseRun"
              @resume="automationStore.resumeRun"
              @stop="automationStore.stopRun"
            />
          </div>

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
            <el-button
              type="primary" @click="handleAiGenerate"
            >
              <i class="i-bi-stars mr-1"></i>
              {{ $t('automation.ai.entry') }}
            </el-button>
            <el-button type="warning" plain @click="openMacroRecorder('new')">
              <i class="i-bi-record-circle mr-1"></i>
              录制宏指令
            </el-button>
            <el-button
              @click="async () => {
                try { await handleCreateScript({ deviceId }) }
                catch (error) { console.error('Failed to create script:', error); ElMessage.error(error.message || String(error)) }
              }"
            >
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

    <LicenseUpgradeModal />
  </div>
</template>

<script setup>
import { useAutomationEditor } from '$/composables/use-automation-editor/index.js'
import { computed, onMounted, ref } from 'vue'
import { useDeviceStore } from '$/store/device/index.js'
import { useLicenseStore } from '$/store/license/index.js'
import LicenseUpgradeModal from '$/components/license-upgrade-modal/index.vue'

import ScriptList from '$automation/components/script-list/index.vue'
import StepList from '$automation/components/step-list/index.vue'
import StepEditor from '$automation/components/step-editor/index.vue'
import RunToolbar from '$automation/components/run-toolbar/index.vue'
import LogPanel from '$automation/components/log-panel/index.vue'
import MagicVariables from '$automation/components/magic-variables/index.vue'
import TemplateSelector from '$automation/components/template-selector/index.vue'
import BatchDialog from '$automation/components/batch-dialog/index.vue'
import AiGenerator from '$automation/components/ai-generator/index.vue'
import MacroRecorder from '$automation/components/macro-recorder/index.vue'

const deviceStore = useDeviceStore()
const licenseStore = useLicenseStore()

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
const selectedDeviceId = ref(null)
const onlineDevices = computed(() => deviceStore.list.filter(d => d.status === 'device'))
const deviceId = computed(() => selectedDeviceId.value || '')

const editor = useAutomationEditor(deviceId)
const { state, actions, runs } = editor
const { scripts, currentScript, selectedStepIds, templateDialogVisible, batchDialogVisible, aiDialogVisible, recorderVisible, recorderMode, isRunning, selectedStep, automationStore } = state
const { handleCreateScript, handleSelectScript, handleDeleteScript, handleSelectStep, handleAddStep, handleRemoveStep, handleMoveStepUp, handleMoveStepDown, handleReorderSteps, handleInsertStepBefore, handleInsertStepAfter, handleUpdateStep, handleUpdateVars } = actions
const { openMacroRecorder, handleMacroRecordConfirm, handleImportScript, handleExportScript, handleApplyTemplate, handleTemplateApply, handleAiGenerate, handleAiApply, handleRunAll, handleRunSingleStep, handleRunSelected, handleResumeFromBreakpoint } = runs

onMounted(async () => {
  await deviceStore.getList()
  if (onlineDevices.value.length > 0) {
    selectedDeviceId.value = onlineDevices.value[0].id
  }
  if (scripts.value?.length > 0 && !currentScript.value) {
    handleSelectScript(scripts.value[0])
  }
})

const deviceName = computed(() => deviceStore.getLabel(deviceId.value, 'name'))

function getDeviceLabel(d) {
  return deviceStore.getLabel(d.id, 'name') || d.id
}
</script>

<style lang="postcss" scoped>
:deep(.el-card__body) {
  @apply flex-1 min-h-0 overflow-hidden flex flex-col;
}
</style>

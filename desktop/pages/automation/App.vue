<template>
  <el-config-provider :locale="locale" :size="size">
    <div class="flex flex-col h-screen">
      <AppHeader
        :title="pageTitle"
        :device-name="deviceName"
        class="px-2"
      >
        <template #right>
          <div class="flex items-center gap-2 *:app-region-no-drag">
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

      <el-alert
        :title="$t('automation.tips')"
        type="info"
        show-icon
        class="mx-2 mb-2 flex-none"
        :closable="true"
      />

      <div class="flex-1 min-h-0 flex overflow-hidden px-2 pb-2 gap-2">
        <ScriptList
          class="w-56 flex-none"
          :device-id="deviceId"
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
                @run-all="handleRunAll"
                @run-selected="handleRunSelected"
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
const { scripts, currentScript, selectedStepIds, templateDialogVisible, batchDialogVisible, aiDialogVisible, recorderVisible, recorderMode, isRunning, selectedStep, automationStore } = state
const { handleSelectScript, handleSelectStep, handleAddStep, handleRemoveStep, handleMoveStepUp, handleMoveStepDown, handleReorderSteps, handleInsertStepBefore, handleInsertStepAfter, handleUpdateStep, handleUpdateVars } = actions
const { handleImportScript, handleExportScript, handleApplyTemplate, handleTemplateApply, handleAiGenerate, handleAiApply, handleRunAll, handleRunSingleStep, handleRunSelected } = runs

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
    if (queryParams.value?.scriptId && list?.length > 0) {
      const target = list.find(s => s.id === queryParams.value.scriptId)
      if (target) {
        handleSelectScript(target)
        queryParams.value.scriptId = null
      }
    }
  },
  { immediate: true },
)

async function handleCreateScript() {
  try {
    await actions.handleCreateScript({ deviceId: deviceId.value })
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

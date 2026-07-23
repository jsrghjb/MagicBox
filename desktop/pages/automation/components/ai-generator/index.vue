<template>
  <el-dialog
    :model-value="true"
    :title="$t('automation.ai.title')"
    width="760px"
    class="el-dialog--beautify ai-generator-dialog"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <i class="i-bi-stars text-primary text-xl"></i>
        <span class="font-bold text-lg">{{ $t('automation.ai.title') }}</span>
      </div>
    </template>

    <div class="space-y-5 px-1 min-h-[420px]">
      <el-alert
        :title="$t('automation.ai.tips')"
        type="info"
        show-icon
        :closable="false"
        class="!bg-blue-50 dark:!bg-blue-900/20 !text-blue-600 dark:!text-blue-400 !border !border-blue-100 dark:!border-blue-800"
      />

      <!-- 未配置时提示 -->
      <el-alert
        v-if="!isConfigured"
        :title="$t('automation.ai.config.needSetup')"
        type="warning"
        show-icon
        :closable="false"
        class="!bg-orange-50 dark:!bg-orange-900/20 !text-orange-600 dark:!text-orange-400 !border !border-orange-100 dark:!border-orange-800"
      />

      <!-- 任务输入区 -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <i class="i-bi-chat-text text-gray-500"></i>
          <span class="font-medium">{{ $t('automation.ai.task.label') }}</span>
        </div>
        <el-input
          v-model="task"
          type="textarea"
          :rows="6"
          resize="none"
          class="custom-textarea"
          :placeholder="$t('automation.ai.task.placeholder')"
          :disabled="generating"
        />

        <!-- 示例标签 -->
        <div class="flex flex-wrap gap-2 pt-1">
          <div
            v-for="example in examples"
            :key="example"
            class="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-primary-50 hover:text-primary dark:hover:bg-primary-900/30 dark:hover:text-primary-400 transition-colors border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
            @click="task = example"
          >
            {{ example }}
          </div>
        </div>
      </div>

      <!-- 生成结果预览 -->
      <el-collapse-transition>
        <div v-if="result" class="border border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-900/10 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between border-b border-green-100 dark:border-green-900/30 pb-3">
            <div class="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
              <i class="i-bi-check-circle-fill"></i>
              <span>{{ result.name }}</span>
            </div>
            <el-tag size="small" type="success" effect="light" class="!rounded-full px-3">
              {{ $t('automation.ai.result.count', { count: result.steps.length }) }}
            </el-tag>
          </div>
          <div class="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <div
              v-for="(step, index) in result.steps"
              :key="step.id"
              class="text-sm flex items-center gap-3 px-3 py-2.5 rounded-md bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <span class="text-gray-400 font-mono text-xs w-5 flex-none text-center">{{ index + 1 }}</span>
              <el-tag size="small" disable-transitions class="flex-none shadow-sm" effect="plain">
                {{ $t(`automation.step.${step.type}`) }}
              </el-tag>
              <span class="truncate text-gray-700 dark:text-gray-200" :title="step.name">{{ step.name }}</span>
            </div>
          </div>
        </div>
      </el-collapse-transition>
    </div>

    <template #footer>
      <el-button @click="$emit('close')">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button
        v-if="!result"
        type="primary"
        :loading="generating"
        :disabled="!task.trim() || !isConfigured"
        @click="handleGenerate"
      >
        {{ generating ? $t('automation.ai.generating') : $t('automation.ai.generate') }}
      </el-button>
      <template v-else>
        <el-button :loading="generating" @click="handleGenerate">
          {{ $t('automation.ai.regenerate') }}
        </el-button>
        <el-button type="primary" @click="handleApply">
          {{ $t('automation.ai.apply') }}
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { generateAutomationScript } from '$/utils/automation/ai-generator.js'
import {
  getAutomationAiConfig,
  isAutomationAiConfigured,
} from '$/utils/automation/ai-config.js'

const props = defineProps({
  deviceId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'apply'])

const task = ref('')
const generating = ref(false)
const result = ref(null)
const isConfigured = ref(false)

async function refreshConfigured() {
  isConfigured.value = await isAutomationAiConfigured()
}

refreshConfigured()

const examples = computed(() => [
  window.t('automation.ai.example.wechat'),
  window.t('automation.ai.example.screenshot'),
  window.t('automation.ai.example.settings'),
])

const errorMessages = {
  EMPTY_TASK: 'automation.ai.error.emptyTask',
  MISSING_API_KEY: 'automation.ai.error.missingApiKey',
  MISSING_BASE_URL: 'automation.ai.error.missingBaseUrl',
  EMPTY_AI_STEPS: 'automation.ai.error.emptySteps',
  INVALID_AI_RESPONSE: 'automation.ai.error.invalidResponse',
  EMPTY_AI_RESPONSE: 'automation.ai.error.invalidResponse',
}

async function resolveScreenSize() {
  if (!props.deviceId) {
    return null
  }
  try {
    return await window.$preload.adb.getScreenSize(props.deviceId)
  }
  catch {
    return null
  }
}

async function handleGenerate() {
  const taskText = task.value.trim()
  if (!taskText) {
    return
  }

  if (!isConfigured.value) {
    ElMessage.warning(window.t('automation.ai.error.missingApiKey'))
    return
  }

  generating.value = true
  result.value = null

  try {
    const currentConfig = await getAutomationAiConfig()
    const screenSize = await resolveScreenSize()

    result.value = await generateAutomationScript({
      task: taskText,
      deviceId: props.deviceId,
      screenSize,
      config: currentConfig,
    })
  }
  catch (error) {
    const key = errorMessages[error?.message]
    const message = key
      ? window.t(key)
      : `${window.t('automation.ai.error.failed')}: ${error?.message || error}`
    ElMessage.error(message)
  }
  finally {
    generating.value = false
  }
}

function handleApply() {
  if (!result.value) {
    return
  }
  emit('apply', result.value)
}
</script>

<style scoped>
:deep(.ai-generator-dialog) {
  max-width: 90vw;
}

:deep(.ai-generator-dialog .el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}

:deep(.custom-textarea .el-textarea__inner) {
  border-radius: 8px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border: 1px solid transparent;
  transition: all 0.3s;
  box-shadow: none;
}

:deep(.custom-textarea .el-textarea__inner:hover) {
  background-color: var(--el-fill-color);
}

:deep(.custom-textarea .el-textarea__inner:focus) {
  background-color: var(--el-bg-color);
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--el-border-color-darker);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
</style>

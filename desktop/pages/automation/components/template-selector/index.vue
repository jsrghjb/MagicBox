<template>
  <el-dialog
    :model-value="true"
    title="选择各平台内置预设模板脚本"
    width="560px"
    class="el-dialog--beautify"
    append-to-body
    destroy-on-close
    @close="$emit('close')"
  >
    <div class="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      <el-card
        v-for="template in templates"
        :key="template.id"
        shadow="hover"
        class="cursor-pointer el-card--beautify transition-all"
        :class="selectedId === template.id ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-900/10' : ''"
        @click="selectedId = template.id"
      >
        <div class="flex items-start gap-3">
          <el-radio :model-value="selectedId" :value="template.id" class="mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="font-bold text-gray-800 dark:text-gray-100 flex items-center justify-between gap-2">
              <span>{{ template.name }}</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              {{ template.description }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <el-button @click="$emit('close')">
          取消
        </el-button>
        <el-button type="primary" :disabled="!selectedId" @click="$emit('apply', selectedId)">
          导入并生成脚本
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { AUTOMATION_TEMPLATES } from '$/utils/automation/templates.js'

defineEmits(['close', 'apply'])

const templates = AUTOMATION_TEMPLATES
const selectedId = ref(templates[0]?.id || '')
</script>

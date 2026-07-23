<template>
  <el-dialog
    :model-value="true"
    :title="$t('automation.template.select')"
    width="520px"
    class="el-dialog--beautify"
    append-to-body
    destroy-on-close
    @close="$emit('close')"
  >
    <div class="space-y-3">
      <el-card
        v-for="template in templates"
        :key="template.id"
        shadow="hover"
        class="cursor-pointer el-card--beautify"
        @click="selectedId = template.id"
      >
        <div class="flex items-start gap-3">
          <el-radio :model-value="selectedId" :value="template.id" />
          <div>
            <div class="font-medium">
              {{ $t(template.nameKey) }}
            </div>
            <div class="text-sm text-gray-400 mt-1">
              {{ $t(template.descKey) }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <template #footer>
      <el-button @click="$emit('close')">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button type="primary" :disabled="!selectedId" @click="$emit('apply', selectedId)">
        {{ $t('automation.template.apply') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { AUTOMATION_TEMPLATES } from '$/utils/automation/templates.js'

defineEmits(['close', 'apply'])

const templates = AUTOMATION_TEMPLATES
const selectedId = ref(templates[0]?.id || '')
</script>

<template>
  <el-form-item
    :label="$t('automation.script.select')"
    prop="automationConfig"
  >
    <el-select
      :model-value="modelValue?.scriptId"
      class="w-full"
      filterable
      clearable
      :placeholder="$t('automation.script.select')"
      @update:model-value="onScriptChange"
    >
      <el-option
        v-for="script in scripts"
        :key="script.id"
        :label="script.name"
        :value="script.id"
      />
    </el-select>
    <div v-if="!scripts.length" class="text-xs text-gray-400 mt-1">
      {{ $t('automation.scripts.select.empty') }}
    </div>
  </el-form-item>
</template>

<script setup>
import { useAutomationScripts } from '$/database/index.js'

const props = defineProps({
  modelValue: {
    type: Object,
    default: null,
  },
  deviceId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const deviceIdRef = computed(() => props.deviceId)
const { scripts } = useAutomationScripts(deviceIdRef)

function onScriptChange(scriptId) {
  emit('update:modelValue', {
    scriptId,
    vars: props.modelValue?.vars || {},
  })
}
</script>

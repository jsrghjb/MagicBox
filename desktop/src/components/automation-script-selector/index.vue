<template>
  <div class="w-full space-y-3">
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
          :label="tMaybe(script.name)"
          :value="script.id"
        />
      </el-select>
      <div v-if="!scripts.length" class="text-xs text-gray-400 mt-1">
        {{ $t('automation.scripts.select.empty') }}
      </div>
    </el-form-item>

    <el-form-item
      v-if="selectedScript"
      :label="$t('automation.batch.variableTable')"
    >
      <div v-if="variableNames.length" class="w-full space-y-2">
        <div
          v-for="(row, index) in variableRows"
          :key="index"
          class="flex items-center gap-2"
        >
          <el-input
            v-for="varName in variableNames"
            :key="varName"
            v-model="row[varName]"
            :placeholder="varName"
            class="flex-1"
          />
          <el-button text circle icon="Delete" @click="removeRow(index)" />
        </div>
        <el-button @click="addRow">
          {{ $t('automation.batch.addRow') }}
        </el-button>
      </div>
      <div v-else class="text-sm text-gray-400">
        {{ $t('automation.batch.noVariables') }}
      </div>
    </el-form-item>

    <el-form-item :label="$t('automation.batch.concurrency')">
      <el-input-number
        :model-value="concurrency"
        :min="1"
        :max="32"
        class="w-32"
        @update:model-value="onConcurrencyChange"
      />
      <span class="text-xs text-gray-400 ml-2">{{ $t('automation.batch.concurrency.hint') }}</span>
    </el-form-item>
  </div>
</template>

<script setup>
import { useAutomationScripts } from '$/database/index.js'
import { tMaybe } from '$/utils/automation/step-types.js'

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

const selectedScript = computed(() => scripts.value.find(item => item.id === props.modelValue?.scriptId))
const variableNames = computed(() => Object.keys(selectedScript.value?.vars || {}))
const variableRows = ref([{}])
const concurrency = ref(20)

watch(selectedScript, (script) => {
  if (!script) {
    return
  }
  const existingRows = props.modelValue?.rows
  if (Array.isArray(existingRows) && existingRows.length) {
    variableRows.value = JSON.parse(JSON.stringify(existingRows))
  }
  else if (script.vars) {
    variableRows.value = [JSON.parse(JSON.stringify(script.vars))]
  }
  else {
    variableRows.value = [{}]
  }
  concurrency.value = Number(props.modelValue?.concurrency || 20)
}, { immediate: true })

watch([variableRows, concurrency], () => {
  emitConfig()
}, { deep: true })

function emitConfig() {
  if (!props.modelValue?.scriptId) {
    return
  }
  emit('update:modelValue', {
    scriptId: props.modelValue.scriptId,
    rows: variableRows.value,
    vars: variableRows.value[0] || {},
    concurrency: concurrency.value,
  })
}

function onScriptChange(scriptId) {
  const script = scripts.value.find(item => item.id === scriptId)
  variableRows.value = script?.vars
    ? [JSON.parse(JSON.stringify(script.vars))]
    : [{}]
  concurrency.value = 20
  emit('update:modelValue', {
    scriptId,
    rows: variableRows.value,
    vars: variableRows.value[0] || {},
    concurrency: concurrency.value,
  })
}

function onConcurrencyChange(value) {
  concurrency.value = Number(value || 20)
  emitConfig()
}

function addRow() {
  variableRows.value.push(Object.fromEntries(variableNames.value.map(name => [name, ''])))
}

function removeRow(index) {
  variableRows.value.splice(index, 1)
  if (!variableRows.value.length) {
    variableRows.value = [{}]
  }
}
</script>

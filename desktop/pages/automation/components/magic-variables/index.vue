<template>
  <el-card shadow="never" class="el-card--beautify h-full flex flex-col !overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span>{{ $t('automation.magic.title') }}</span>
        <el-button text circle icon="Plus" @click="handleAddVar" />
      </div>
    </template>

    <div class="flex-1 min-h-0 overflow-auto pr-2">
      <div class="text-xs text-gray-400 mb-3">
        {{ $t('automation.magic.usageHint') }}
      </div>

      <div class="mb-3">
        <div class="text-sm font-medium mb-2">
          {{ $t('automation.magic.system') }}
        </div>
        <div class="flex flex-wrap gap-1">
          <el-tag
            v-for="item in systemVars"
            :key="item.name"
            size="small"
            type="info"
          >
            {{ formatVarTag(item.name) }}
          </el-tag>
        </div>
      </div>

      <div>
        <div class="text-sm font-medium mb-2">
          {{ $t('automation.magic.custom') }}
        </div>
        <el-empty v-if="!customEntries.length" :image-size="40" :description="$t('automation.magic.empty')" class="!py-2" />
        <div v-else class="space-y-2">
          <div
            v-for="[name, value] in customEntries"
            :key="name"
            class="flex items-center gap-2"
          >
            <el-input
              :model-value="name"
              class="!w-28"
              disabled
            />
            <el-input
              :model-value="value"
              class="flex-1"
              :placeholder="$t('automation.magic.valuePlaceholder')"
              @update:model-value="updateVar(name, $event)"
            />
            <el-button text circle icon="Delete" @click="removeVar(name)" />
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { isValidVarName } from '$/utils/automation/variables.js'

const props = defineProps({
  vars: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update'])

const systemVars = [
  { name: 'deviceId', label: 'automation.magic.system.deviceId' },
  { name: 'timestamp', label: 'automation.magic.system.timestamp' },
  { name: 'date', label: 'automation.magic.system.date' },
  { name: 'stepIndex', label: 'automation.magic.system.stepIndex' },
]

const customEntries = computed(() => Object.entries(props.vars || {}))

function formatVarTag(name) {
  return `{${name}}`
}

function updateVars(next) {
  emit('update', next)
}

function updateVar(name, value) {
  updateVars({
    ...props.vars,
    [name]: value,
  })
}

function removeVar(name) {
  const next = { ...props.vars }
  delete next[name]
  updateVars(next)
}

async function handleAddVar() {
  try {
    const { value } = await ElMessageBox.prompt(
      window.t('automation.magic.namePlaceholder'),
      window.t('automation.magic.addVar'),
    )

    if (!value) {
      ElMessage.warning(window.t('automation.magic.nameRequired'))
      return
    }

    if (!isValidVarName(value)) {
      ElMessage.warning(window.t('automation.magic.nameInvalid'))
      return
    }

    if (props.vars?.[value]) {
      ElMessage.warning(window.t('automation.magic.nameDuplicate'))
      return
    }

    updateVars({
      ...props.vars,
      [value]: '',
    })
  }
  catch {
    // cancelled
  }
}
</script>

<style scoped>
:deep(.el-card__body) {
  padding-top: 0 !important;
}
</style>

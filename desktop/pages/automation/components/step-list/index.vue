<template>
  <el-card shadow="never" class="el-card--beautify h-full flex flex-col !overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span>{{ $t('automation.steps') }}</span>
        <el-dropdown trigger="click" @command="handleAdd">
          <el-button text circle icon="Plus" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in stepOptions"
                :key="item.value"
                :command="item.value"
              >
                {{ getStepTypeLabel(item.label) }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <div class="flex-1 min-h-0 overflow-auto space-y-1">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        :draggable="step.type !== 'end'"
        class="relative px-2 py-2 rounded cursor-grab active:cursor-grabbing flex items-center gap-2 transition-colors select-none"
        :class="[
          step.id === selectedStepId
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700',
          runningStepIndex === index ? 'ring-1 ring-primary-400' : '',
        ]"
        :style="{ paddingLeft: `${(stepDepths[index] * 16) + 8}px` }"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent
        @drop="onDrop($event, index)"
        @click="$emit('select', step)"
      >
        <!-- Nesting guidelines -->
        <div
          v-for="d in stepDepths[index]"
          :key="d"
          class="absolute top-0 bottom-0 border-l border-gray-200 dark:border-gray-700"
          :style="{ left: `${(d - 1) * 16 + 12}px` }"
        />

        <span class="text-xs text-gray-400 w-5 z-1">{{ index + 1 }}</span>
        <div class="flex-1 min-w-0 z-1">
          <div class="text-sm truncate">
            {{ step.name || getStepTypeLabel(stepTypeLabel(step.type)) }}
          </div>
          <div class="text-xs text-gray-400">
            {{ getStepTypeLabel(stepTypeLabel(step.type)) }}
          </div>
        </div>
        <el-dropdown trigger="click" @command="command => handleStepCommand(command, step)">
          <el-button text circle icon="MoreFilled" size="small" @click.stop />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="insertBefore">
                {{ $t('automation.step.insertBefore') }}
              </el-dropdown-item>
              <el-dropdown-item command="insertAfter">
                {{ $t('automation.step.insertAfter') }}
              </el-dropdown-item>
              <el-dropdown-item command="moveUp" :disabled="index === 0">
                {{ $t('common.moveUp') || 'Up' }}
              </el-dropdown-item>
              <el-dropdown-item command="moveDown" :disabled="index === steps.length - 1">
                {{ $t('common.moveDown') || 'Down' }}
              </el-dropdown-item>
              <el-dropdown-item command="remove" divided>
                {{ $t('common.delete') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { getStepTypeLabel, STEP_TYPE_OPTIONS } from '$/utils/automation/step-types.js'

const props = defineProps({
  steps: {
    type: Array,
    default: () => [],
  },
  selectedStepId: {
    type: String,
    default: '',
  },
  runningStepIndex: {
    type: Number,
    default: -1,
  },
})

const emit = defineEmits([
  'select',
  'add',
  'remove',
  'move-up',
  'move-down',
  'insert-before',
  'insert-after',
  'reorder',
])

const stepDepths = computed(() => {
  const depths = []
  let currentDepth = 0
  for (let i = 0; i < props.steps.length; i++) {
    const step = props.steps[i]
    if (step.type === 'end') {
      currentDepth = Math.max(0, currentDepth - 1)
      depths.push(currentDepth)
    }
    else if (step.type === 'if' || step.type === 'loop') {
      depths.push(currentDepth)
      currentDepth++
    }
    else {
      depths.push(currentDepth)
    }
  }
  return depths
})

const stepOptions = STEP_TYPE_OPTIONS

function stepTypeLabel(type) {
  return STEP_TYPE_OPTIONS.find(item => item.value === type)?.label || type
}

function handleAdd(type) {
  emit('add', type)
}

function handleStepCommand(command, step) {
  if (command === 'remove') {
    emit('remove', step.id)
  }
  else if (command === 'moveUp') {
    emit('move-up', step.id)
  }
  else if (command === 'moveDown') {
    emit('move-down', step.id)
  }
  else if (command === 'insertBefore') {
    emit('insert-before', step.id)
  }
  else if (command === 'insertAfter') {
    emit('insert-after', step.id)
  }
}

let dragSrcIndex = null

function onDragStart(event, index) {
  dragSrcIndex = index
  event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event, index) {
  if (dragSrcIndex === null || dragSrcIndex === index)
    return
  emit('reorder', { from: dragSrcIndex, to: index })
  dragSrcIndex = null
}
</script>

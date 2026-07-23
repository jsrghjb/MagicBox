<template>
  <el-card shadow="never" class="el-card--beautify h-full flex flex-col !overflow-hidden">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span>{{ $t('automation.log.title') }}</span>
        <el-button text size="small" @click="$emit('clear')">
          {{ $t('automation.log.clear') }}
        </el-button>
      </div>
    </template>

    <div class="flex-1 min-h-0 overflow-auto text-xs space-y-2">
      <el-empty v-if="!logs.length" :description="$t('automation.log.empty')" />
      <div
        v-for="log in logs"
        :key="log.id"
        class="px-2 py-1 rounded"
        :class="logClass(log.level)"
      >
        <div class="text-gray-400">
          {{ formatTime(log.time) }}
        </div>
        <div>{{ log.message }}</div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import dayjs from 'dayjs'

defineProps({
  logs: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['clear'])

function formatTime(time) {
  return dayjs(time).format('HH:mm:ss')
}

function logClass(level) {
  if (level === 'error') {
    return 'bg-red-50 text-red-600 dark:bg-red-900/20'
  }
  if (level === 'success') {
    return 'bg-green-50 text-green-600 dark:bg-green-900/20'
  }
  if (level === 'warning') {
    return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20'
  }
  return 'bg-gray-50 dark:bg-gray-800'
}
</script>

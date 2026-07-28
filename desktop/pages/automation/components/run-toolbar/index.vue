<template>
  <div class="flex items-center gap-2">
    <el-button
      v-if="hasBreakpoint && !['running'].includes(status)"
      type="warning"
      @click="$emit('resume-breakpoint')"
    >
      <i class="i-bi-play-circle-fill mr-1"></i>
      从断点恢复 (第{{ (breakpointIndex ?? 0) + 1 }}步)
    </el-button>

    <el-button type="primary" :disabled="!hasScript || !hasSteps" @click="$emit('run-all')">
      {{ $t('automation.run.all') }}
    </el-button>
    <el-button :disabled="!hasSelection" @click="$emit('run-selected')">
      {{ $t('automation.run.selected') }}
    </el-button>

    <el-button v-if="status === 'running'" @click="$emit('pause')">
      {{ $t('automation.run.pause') }}
    </el-button>
    <el-button v-if="status === 'paused'" type="primary" @click="$emit('resume')">
      {{ $t('automation.run.resume') }}
    </el-button>
    <el-button v-if="['running', 'paused'].includes(status)" type="danger" @click="$emit('stop')">
      {{ $t('automation.run.stop') }}
    </el-button>

    <el-tag>
      {{ statusLabel }}
    </el-tag>
  </div>
</template>

<script setup>
const props = defineProps({
  status: {
    type: String,
    default: 'idle',
  },
  hasScript: Boolean,
  hasSteps: Boolean,
  hasSelection: Boolean,
  hasBreakpoint: Boolean,
  breakpointIndex: {
    type: Number,
    default: 0,
  },
})

defineEmits(['run-all', 'run-step', 'run-selected', 'pause', 'resume', 'stop', 'resume-breakpoint'])

const statusLabel = computed(() => {
  const map = {
    idle: 'automation.state.idle',
    running: 'automation.state.running',
    paused: 'automation.state.paused',
    stopped: 'automation.state.stopped',
    interrupted: '中断异常',
  }
  const key = map[props.status] || map.idle
  return key.startsWith('automation.') ? window.t(key) : key
})
</script>

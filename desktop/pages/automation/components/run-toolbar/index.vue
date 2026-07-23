<template>
  <div class="flex items-center gap-2">
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
})

defineEmits(['run-all', 'run-step', 'run-selected', 'pause', 'resume', 'stop'])

const statusLabel = computed(() => {
  const map = {
    idle: 'automation.state.idle',
    running: 'automation.state.running',
    paused: 'automation.state.paused',
    stopped: 'automation.state.stopped',
  }
  return window.t(map[props.status] || map.idle)
})
</script>

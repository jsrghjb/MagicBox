<template>
  <Scrollable>
    <el-button-group class="flex items-center">
      <component
        :is="item.component"
        v-for="(item, index) in actionModel"
        :key="index"
        class="flex-none"
        v-bind="{
          devices,
          ...(item.command
            ? {
              onClick: () => handleShell(item),
            }
            : {}),
        }"
      >
        <template #default="{ loading = false, trigger }">
          <el-tooltip
            :content="getActionLabel(item)"
            placement="top"
            :show-after="100"
          >
            <el-button
              plain
              :loading="loading"
              v-bind="{
                ...(trigger ? {
                  onClick: () => trigger(devices),
                } : {}),
              }"
            >
              <template #icon>
                <el-icon v-if="item.elIcon" :class="item.iconClass">
                  <component :is="item.elIcon" />
                </el-icon>
                <i v-else-if="item.fontIcon" :class="item.fontIcon"></i>
              </template>
            </el-button>
          </el-tooltip>
        </template>
      </component>
    </el-button-group>
  </Scrollable>
</template>

<script setup>
import { Delete as DeleteIcon, Monitor } from '@element-plus/icons-vue'
import Mirror from './mirror/index.vue'
import Rename from './rename/index.vue'
import Application from './application/index.vue'
import FilePush from './file-push/index.vue'
import Screenshot from './screenshot/index.vue'
import Schedule from './schedule/index.vue'
import Delete from './delete/index.vue'

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
})

const actionModel = [
  {
    label: 'device.mirror.start',
    elIcon: Monitor,
    component: Mirror,
  },
  {
    label: 'device.batch.rename',
    tips: 'device.batch.rename',
    fontIcon: 'i-bi-sort-numeric-down',
    component: Rename,
  },
  {
    label: 'device.remove',
    elIcon: DeleteIcon,
    component: Delete,
  },
  {
    label: 'device.control.capture',
    fontIcon: 'i-bi-camera',
    component: Screenshot,
  },
  {
    label: 'device.control.install',
    fontIcon: 'i-bi-file-arrow-up',
    component: Application,
  },
  {
    label: 'device.control.file.push',
    fontIcon: 'i-bi-folder',
    component: FilePush,
  },
  {
    label: 'device.schedule.name',
    fontIcon: 'i-bi-clock',
    component: Schedule,
  },
]

const fallbackLabels = {
  'device.batch.rename': '批量编号',
  'device.batch.rename.title': '批量设备顺序编号',
}

function getActionLabel(item) {
  const key = item.tips || item.label
  if (!key) {
    return ''
  }
  const val = window.t(key)
  if (val === key && fallbackLabels[key]) {
    return fallbackLabels[key]
  }
  return val || fallbackLabels[key] || key
}
</script>

<style></style>

<template>
  <div class="h-full overflow-y-auto p-4" @click.self="$emit('select', null)">
    <div
      v-if="devices.length"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 pb-12"
      @click.self="$emit('select', null)"
    >
      <div
        v-for="item of devices"
        :key="item.id"
        class="device-card group relative bg-white dark:bg-gray-850 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between"
        :class="[
          activeDevice?.id === item.id
            ? 'border-primary-500 ring-2 ring-primary-500/30 shadow-xl bg-primary-50/10 dark:bg-primary-950/10'
            : 'border-gray-200/80 dark:border-gray-700/60 hover:border-primary-400/70 dark:hover:border-primary-500/70 hover:shadow-xl hover:-translate-y-0.5',
        ]"
        @click="handleCardClick(item, $event)"
      >
        <!-- Card Header -->
        <div class="p-3 px-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/70 bg-gray-50/60 dark:bg-gray-800/40">
          <div class="flex items-center space-x-2 min-w-0" @click.stop>
            <el-checkbox
              :model-value="isRowSelected(item)"
              @change="(val) => onCheckboxChange(item, val)"
            />
            <DevicePopover :key="item.status" :device="item" />
            <span v-if="item.wifi" class="text-primary-500 dark:text-primary-400 text-xs flex-none" title="WiFi">
              <i class="i-bi-wifi"></i>
            </span>
          </div>

          <div class="flex items-center space-x-1.5" @click.stop>
            <span
              class="px-2 py-0.5 text-[11px] font-medium rounded-full flex items-center space-x-1"
              :class="[
                item.status === 'device'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50'
                  : item.status === 'unauthorized'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50',
              ]"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="[
                  item.status === 'device' ? 'bg-emerald-500 animate-pulse' : item.status === 'unauthorized' ? 'bg-amber-500' : 'bg-rose-500',
                ]"
              ></span>
              <span>{{ $t(getDictLabel('deviceStatus', item.status)) }}</span>
            </span>

            <!-- Refresh Snapshot Button -->
            <el-tooltip
              v-if="item.status === 'device'"
              :content="$t('common.refresh') === 'common.refresh' ? ($t('device.refresh.name') || '刷新') : $t('common.refresh')"
              placement="top"
              :show-after="100"
            >
              <button
                class="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
                :disabled="loadingThumbnails[item.id]"
                @click="loadThumbnail(item.id, true)"
              >
                <i
                  class="i-iconoir-refresh text-xs"
                  :class="{ 'animate-spin': loadingThumbnails[item.id] }"
                ></i>
              </button>
            </el-tooltip>
          </div>
        </div>

        <!-- Card Body: Realistic Phone Frame + Screen Snapshot -->
        <div class="p-4 flex flex-col items-center justify-center space-y-3">
          <!-- Sleek Smartphone Bezel Frame -->
          <div
            class="phone-frame relative w-36 h-60 rounded-[22px] p-[4px] bg-gradient-to-b from-gray-700 via-gray-800 to-gray-900 shadow-xl ring-1 ring-black/20 dark:ring-white/10 transition-transform duration-300 group-hover:scale-[1.02]"
          >
            <!-- Inner Screen Canvas -->
            <div class="w-full h-full rounded-[18px] bg-black overflow-hidden flex items-center justify-center relative shadow-inner">
              <!-- 1. Real Thumbnail Image -->
              <img
                v-if="thumbnails[item.id]"
                :src="thumbnails[item.id]"
                class="w-full h-full object-cover select-none"
                alt="Screen Thumbnail"
                loading="lazy"
              />

              <!-- 2. Loading State -->
              <div
                v-else-if="loadingThumbnails[item.id]"
                class="flex flex-col items-center justify-center space-y-2 text-gray-400 text-xs"
              >
                <i class="i-iconoir-refresh animate-spin text-xl text-primary-400"></i>
                <span class="text-[10px] text-gray-400">加载画面...</span>
              </div>

              <!-- 3. Offline / Placeholder State -->
              <div
                v-else
                class="flex flex-col items-center justify-center p-3 text-center space-y-1.5"
              >
                <i
                  class="text-3xl"
                  :class="[
                    item.status === 'device'
                      ? 'i-bi-phone text-primary-400'
                      : item.status === 'unauthorized'
                        ? 'i-bi-shield-exclamation text-amber-400'
                        : 'i-bi-phone text-gray-600',
                  ]"
                ></i>
                <span class="text-[11px] font-mono text-gray-400 truncate max-w-[100px]">
                  {{ item.model || 'Android' }}
                </span>
              </div>

              <!-- Hover Action Overlay (Start Mirror) -->
              <div
                v-if="item.status === 'device'"
                class="absolute inset-0 bg-black/45 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-250 flex flex-col items-center justify-center space-y-2 z-10"
                @click.stop="triggerMirror(item)"
              >
                <div class="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-xl shadow-primary-500/50 hover:scale-110 active:scale-95 transition-all">
                  <i class="i-bi-play-fill text-2xl ml-0.5"></i>
                </div>
                <span class="text-xs text-white font-medium drop-shadow-md tracking-wide">{{ $t('device.mirror.start') }}</span>
              </div>
            </div>
          </div>

          <!-- Device Model & Serial Info -->
          <div class="w-full text-center min-w-0 px-2 flex flex-col items-center" @click.stop>
            <div class="inline-flex items-center max-w-full">
              <Remark :device="item" class="w-full justify-center" />
            </div>
            <div class="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5 tracking-tight" :title="item.id">
              {{ item.id }}
            </div>
          </div>
        </div>

        <!-- Card Footer: Quick Action Icons -->
        <div
          class="p-2.5 px-4 bg-gray-50/70 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800/70 flex items-center justify-around"
          @click.stop
        >
          <ConnectAction
            v-if="['offline'].includes(item.status) && item.wifi"
            v-bind="{ device: item, handleConnect }"
          />

          <MirrorAction
            v-if="['device', 'unauthorized'].includes(item.status)"
            v-bind="{ row: item }"
          />

          <MoreDropdown
            v-if="['device'].includes(item.status)"
            v-bind="{ row: item }"
          />

          <WirelessAction
            v-if="['device', 'unauthorized'].includes(item.status)"
            v-bind="{ row: item, handleConnect, handleRefresh }"
          />

          <RemoveAction
            v-if="['offline'].includes(item.status)"
            v-bind="{ device: item, handleRefresh }"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <AppEmpty v-else :sub-title="$t('device.list.empty')" />
  </div>
</template>

<script setup>
import pLimit from 'p-limit'
import AppEmpty from '$/components/app-empty/index.vue'
import DevicePopover from '../device-popover/index.vue'
import Remark from '../remark/index.vue'
import MirrorAction from '../mirror-action/index.vue'
import MoreDropdown from '../more-dropdown/index.vue'
import WirelessAction from '../wireless-action/index.vue'
import ConnectAction from '../connect-action/index.vue'
import RemoveAction from '../remove-action/index.vue'
import { getDictLabel } from '$/dicts/helper'
import { openFloatControl } from '$/utils/device/index.js'
import { sleep } from '$/utils/index.js'

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
  selectionRows: {
    type: Array,
    default: () => [],
  },
  activeDevice: {
    type: Object,
    default: null,
  },
  handleConnect: {
    type: Function,
    default: () => {},
  },
  handleRefresh: {
    type: Function,
    default: () => {},
  },
})

const emit = defineEmits(['select', 'selection-change'])

const preferenceStore = usePreferenceStore()
const deviceStore = useDeviceStore()

const thumbnails = ref({})
const loadingThumbnails = ref({})
const snapLimit = pLimit(3)

function isRowSelected(item) {
  return props.selectionRows.some(row => row.id === item.id)
}

function onCheckboxChange(item, checked) {
  let nextSelection = [...props.selectionRows]
  if (checked) {
    if (!nextSelection.some(row => row.id === item.id)) {
      nextSelection.push(item)
    }
  }
  else {
    nextSelection = nextSelection.filter(row => row.id !== item.id)
  }
  emit('selection-change', nextSelection)
}

function handleCardClick(item, event) {
  if (event.target.closest('.el-checkbox') || event.target.closest('.el-button') || event.target.closest('.el-dropdown') || event.target.closest('.remark-input')) {
    return
  }

  if (props.activeDevice?.id === item.id) {
    emit('select', null)
  }
  else {
    emit('select', item)
  }
}

async function loadThumbnail(deviceId, force = false) {
  if (!deviceId || (!force && thumbnails.value[deviceId])) {
    return
  }

  loadingThumbnails.value[deviceId] = true
  try {
    const base64 = await snapLimit(() =>
      window.$preload.adb.screencap(deviceId, { returnBase64: true }),
    )
    if (base64) {
      thumbnails.value[deviceId] = `data:image/png;base64,${base64}`
    }
  }
  catch (error) {
    console.debug(`Failed to load thumbnail for ${deviceId}:`, error?.message)
  }
  finally {
    loadingThumbnails.value[deviceId] = false
  }
}

function loadAllThumbnails() {
  props.devices.forEach((item) => {
    if (item.status === 'device') {
      loadThumbnail(item.id)
    }
  })
}

async function triggerMirror(item) {
  const args = preferenceStore.scrcpyParameter(item.id)
  try {
    const mirroring = window.$preload.scrcpy.mirror(item.id, {
      title: deviceStore.getLabel(item, 'mirror'),
      args,
    })
    await sleep(500)
    openFloatControl(toRaw(item))
    await mirroring
  }
  catch (error) {
    console.error('triggerMirror error:', error)
    if (error.message) {
      ElMessage.warning(error.message)
    }
  }
}

watch(
  () => props.devices,
  () => {
    loadAllThumbnails()
  },
  { immediate: true, deep: true },
)

onMounted(() => {
  loadAllThumbnails()
})
</script>

<style scoped>
.device-card {
  box-shadow:
    0 4px 16px -2px rgba(0, 0, 0, 0.05),
    0 2px 6px -1px rgba(0, 0, 0, 0.03);
}
</style>

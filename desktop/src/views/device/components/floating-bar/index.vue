<template>
  <Transition name="slide-fade">
    <div
      v-if="device && device.id"
      class="floating-bar h-full max-h-[96%] w-14 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-700/80 flex flex-col items-center py-2.5 px-1.5 overflow-y-auto no-scrollbar text-gray-800 dark:text-gray-100 select-none space-y-1.5"
    >
      <!-- Close Button -->
      <el-tooltip :content="$t('common.close') === 'common.close' ? $t('keyboard.mapping.close') : $t('common.close')" placement="left" :show-after="100">
        <button
          class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-none"
          @click="handleClose"
        >
          <el-icon :size="16">
            <Close />
          </el-icon>
        </button>
      </el-tooltip>

      <!-- Device Status Dot -->
      <el-tooltip :content="deviceDisplayName" placement="left" :show-after="100">
        <div class="py-0.5 flex items-center justify-center flex-none">
          <span
            class="w-2.5 h-2.5 rounded-full animate-pulse ring-2 ring-white dark:ring-gray-900"
            :class="statusDotClass"
          ></span>
        </div>
      </el-tooltip>

      <div class="w-7 h-[1px] bg-gray-200 dark:bg-gray-800 my-0.5 flex-none"></div>

      <!-- Start Mirror Primary Button -->
      <template v-if="['device', 'unauthorized'].includes(device.status)">
        <el-tooltip :content="mirrorLoading ? $t('common.starting') : $t('device.mirror.start')" placement="left" :show-after="100">
          <button
            class="w-10 h-10 rounded-xl bg-primary-500 hover:bg-primary-600 active:scale-95 text-white shadow-md shadow-primary-500/30 flex items-center justify-center transition-all disabled:opacity-50 flex-none"
            :disabled="['unauthorized', 'offline'].includes(device.status) || mirrorLoading"
            @click="handleStartMirror"
          >
            <el-icon v-if="!mirrorLoading" :size="18">
              <Monitor />
            </el-icon>
            <el-icon v-else class="is-loading" :size="18">
              <Loading />
            </el-icon>
          </button>
        </el-tooltip>
      </template>

      <template v-else-if="['offline'].includes(device.status) && device.wifi">
        <el-tooltip :content="$t('device.wireless.connect.name')" placement="left" :show-after="100">
          <button
            class="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-md shadow-emerald-500/30 flex items-center justify-center transition-all flex-none"
            @click="$emit('connect', device)"
          >
            <el-icon :size="18">
              <Link />
            </el-icon>
          </button>
        </el-tooltip>
      </template>

      <!-- Full Control Items List (Matches ControlBar Model) -->
      <template v-if="isDeviceOnline">
        <div class="w-7 h-[1px] bg-gray-200 dark:bg-gray-800 my-0.5 flex-none"></div>

        <div
          v-for="item of controlModelList"
          :key="item.id"
          class="flex-none"
        >
          <component
            :is="item.component || 'div'"
            v-bind="{
              device,
              floating: false,
            }"
          >
            <template #default="{ loading = false, trigger } = {}">
              <button
                class="tool-btn"
                :class="[
                  item.id === 'power' ? 'text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40' : '',
                ]"
                :title="$t(item.tips || item.label)"
                :disabled="loading"
                @click="handleClick(item, trigger || item.trigger)"
              >
                <el-icon v-if="loading" class="is-loading" :size="16">
                  <Loading />
                </el-icon>
                <i v-else-if="item.fontIcon" :class="item.fontIcon" class="text-base"></i>
              </button>
            </template>
          </component>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup>
import { Close, Link, Loading, Monitor } from '@element-plus/icons-vue'
import { sleep } from '$/utils/index.js'
import { openFloatControl } from '$/utils/device/index.js'

import Install from '$/components/control-bar/install/index.vue'
import Launch from '$/components/control-bar/launch/index.vue'
import Explorer from '$/components/control-bar/explorer/index.vue'
import Gnirehtet from '$/components/control-bar/gnirehtet/index.vue'
import Rotation from '$/components/control-bar/rotation/index.vue'
import Screenshot from '$/components/control-bar/screenshot/index.vue'
import Terminal from '$/components/control-bar/terminal/index.vue'
import Schedule from '$/components/control-bar/schedule/index.vue'
import Volume from '$/components/control-bar/volume/index.vue'

const props = defineProps({
  device: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'connect', 'refresh'])

const preferenceStore = usePreferenceStore()
const deviceStore = useDeviceStore()
const controlStore = useControlStore()

const mirrorLoading = ref(false)

const isDeviceOnline = computed(() => props.device && props.device.status === 'device')

const deviceDisplayName = computed(() => {
  if (!props.device) {
    return ''
  }
  return props.device.remark || props.device.name || props.device.id
})

const statusDotClass = computed(() => {
  if (!props.device) {
    return 'bg-gray-400'
  }
  switch (props.device.status) {
    case 'device':
      return 'bg-emerald-500'
    case 'unauthorized':
      return 'bg-amber-500'
    case 'offline':
    default:
      return 'bg-rose-500'
  }
})

const controlModelList = computed(() => {
  const valueMap = {
    back: {
      id: 'back',
      label: 'device.control.return',
      fontIcon: 'i-cil-caret-left',
      command: 'input keyevent 4',
    },
    home: {
      id: 'home',
      label: 'device.control.home',
      fontIcon: 'i-bi-app',
      command: 'input keyevent 3',
    },
    switch: {
      id: 'switch',
      label: 'device.control.switch',
      fontIcon: 'i-proicons-menu',
      command: 'input keyevent 187',
    },
    power: {
      id: 'power',
      label: 'device.control.power',
      fontIcon: 'i-uiw-poweroff',
      command: 'input keyevent 26',
      tips: 'device.control.power.tips',
    },
    screenshot: {
      id: 'screenshot',
      label: 'device.control.capture',
      fontIcon: 'i-simple-line-icons-camera',
      component: Screenshot,
    },
    volume: {
      id: 'volume',
      label: 'device.control.volume.name',
      fontIcon: 'i-simple-line-icons-volume-2',
      component: Volume,
    },
    rotation: {
      id: 'rotation',
      label: 'device.control.rotation.name',
      fontIcon: 'i-solar-smartphone-rotate-2-outline',
      component: Rotation,
    },
    turnScreenOff: {
      id: 'turnScreenOff',
      label: 'device.control.turnScreenOff',
      fontIcon: 'i-bi-file-break',
      tips: 'device.control.turnScreenOff.tips',
      trigger: () => {
        if (!props.device?.id) {
          return
        }
        window.$preload.scrcpy.helper(props.device.id, '--turn-screen-off')
      },
    },
    notification: {
      id: 'notification',
      label: 'device.control.notification',
      fontIcon: 'i-bi-bell',
      command: 'cmd statusbar expand-notifications',
      tips: 'device.control.notification.tips',
    },
    launch: {
      id: 'launch',
      label: 'device.control.launch',
      fontIcon: 'i-famicons-rocket-outline',
      component: Launch,
    },
    install: {
      id: 'install',
      label: 'device.control.install',
      fontIcon: 'i-bi-file-arrow-up',
      component: Install,
    },
    explorer: {
      id: 'explorer',
      label: 'device.control.file.name',
      fontIcon: 'i-bi-folder',
      component: Explorer,
    },
    terminal: {
      id: 'terminal',
      label: 'device.terminal.name',
      fontIcon: 'i-bi-terminal',
      component: Terminal,
    },
    schedule: {
      id: 'schedule',
      label: 'device.schedule.name',
      fontIcon: 'i-bi-clock',
      component: Schedule,
    },
    gnirehtet: {
      id: 'gnirehtet',
      label: 'device.control.gnirehtet',
      fontIcon: 'i-bi-hdd-network',
      component: Gnirehtet,
      tips: 'device.control.gnirehtet.tips',
    },
    reboot: {
      id: 'reboot',
      label: 'device.control.reboot',
      fontIcon: 'i-iconoir-refresh',
      command: 'reboot',
    },
  }

  const customLayout = controlStore.barLayout || []
  const orderKeys = [...new Set([...customLayout, ...Object.keys(valueMap)])]

  return orderKeys
    .map(key => valueMap[key])
    .filter(Boolean)
})

function handleClose() {
  emit('close')
}

function handleClick(item, trigger) {
  if (trigger) {
    trigger(props.device)
    return
  }

  if (!item.command || !props.device?.id) {
    return
  }

  window.$preload.adb.deviceShell(props.device.id, item.command).catch((error) => {
    ElMessage.warning(error?.message || String(error))
  })
}

async function handleStartMirror() {
  if (!props.device?.id) {
    return
  }
  mirrorLoading.value = true

  const args = preferenceStore.scrcpyParameter(props.device.id)

  try {
    const mirroring = window.$preload.scrcpy.mirror(props.device.id, {
      title: deviceStore.getLabel(props.device, 'mirror'),
      args,
    })

    await sleep(500)
    mirrorLoading.value = false

    openFloatControl(toRaw(props.device))

    await mirroring
  }
  catch (error) {
    console.error('handleStartMirror error:', error)
    if (error.message) {
      ElMessage.warning(error.message)
    }
  }
  finally {
    mirrorLoading.value = false
  }
}
</script>

<style scoped>
.tool-btn {
  @apply w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-950/50 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 transition-all cursor-pointer;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(120%);
  opacity: 0;
}
</style>

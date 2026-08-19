<template>
  <div class="h-full flex flex-col relative overflow-hidden">
    <div
      class="overflow-hidden transition-all duration-200"
      :class="isMultipleRow ? 'max-h-12 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0 pointer-events-none'"
    >
      <div class="flex items-center justify-between p-1 bg-gray-50/90 dark:bg-gray-800/60 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary-500 text-white shadow-sm flex items-center space-x-1">
            <i class="i-bi-check2-square"></i>
            <span>已选 {{ selectionRows.length }} 台</span>
          </span>
          <BatchActions :devices="selectionRows" />
        </div>

        <div class="flex items-center space-x-1 pr-1">
          <el-button
            v-if="selectionRows.length < deviceList.length"
            size="small"
            link
            type="primary"
            class="!text-xs"
            @click="toggleSelectAll(true)"
          >
            全选所有 ({{ deviceList.length }})
          </el-button>
          <el-button
            size="small"
            link
            class="!text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            @click="clearSelection"
          >
            取消选择
          </el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex overflow-hidden">
      <!-- Main Content Area with smooth push transition -->
      <div class="flex-1 min-w-0 h-full overflow-hidden transition-all duration-300 ease-out">
        <!-- Grid View -->
        <DeviceGrid
          v-if="viewMode === 'grid'"
          v-loading="loading && !deviceList.length"
          :element-loading-text="$t('common.loading')"
          :devices="deviceList"
          :selection-rows="selectionRows"
          :active-device="activeDevice"
          :handle-connect="handleConnect"
          :handle-refresh="handleRefresh"
          @select="onSelectDevice"
          @selection-change="onSelectionChange"
        />

        <!-- Table View -->
        <el-table
          v-else
          ref="tableRef"
          v-loading="loading && !deviceList.length"
          :element-loading-text="$t('common.loading')"
          :data="deviceList"
          style="width: 100%"
          height="100%"
          row-key="id"
          class="el-table--beautify"
          :row-class-name="tableRowClassName"
          @selection-change="onSelectionChange"
          @row-click="handleRowClick"
        >
          <template #empty>
            <AppEmpty v-show="!loading" :sub-title="$t('device.list.empty')">
            </AppEmpty>
          </template>

          <el-table-column type="selection" width="30"></el-table-column>

          <el-table-column
            :label="$t('device.serial')"
            sortable
            show-overflow-tooltip
            align="left"
            min-width="200"
          >
            <template #default="{ row }">
              <div class="flex items-center space-x-2 relative">
                <DevicePopover :key="row.status" :device="row" class="" />

                <div class="flex-none max-w-[75%] truncate">
                  {{ row.id }}
                </div>

                <el-link type="primary" underline="never" title="WIFI" class="flex-none">
                  <i v-if="row.wifi" class="i-bi-wifi"></i>
                </el-link>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            :label="$t('device.name')"
            prop="remark"
            sortable
            show-overflow-tooltip
            align="left"
            min-width="150"
            :filters="remarkFilters"
            :filter-method="remarkFilterMethod"
          >
            <template #default="{ row }">
              <Remark :device="row" class="" />
            </template>
          </el-table-column>

          <el-table-column
            v-slot="{ row }"
            :label="$t('device.status')"
            prop="status"
            align="left"
            sortable
            show-overflow-tooltip
            min-width="150"
            :filters="statusFilters"
            :filter-method="filterMethod"
          >
            <el-tag :type="getDictLabel('deviceStatus', row.status, { labelKey: 'tagType' })">
              <div class="flex items-center">
                <el-tooltip
                  v-if="['unauthorized'].includes(row.status)"
                  :content="$t('device.permission.error')"
                  placement="top"
                >
                  <el-link type="danger" underline="never" icon="WarningFilled" class="mr-1 flex-none"></el-link>
                </el-tooltip>

                <span class="flex-none">{{ $t(getDictLabel('deviceStatus', row.status)) || '-' }}</span>
              </div>
            </el-tag>
          </el-table-column>

          <el-table-column
            v-slot="{ row }"
            :label="$t('common.actions')"
            align="left"
            min-width="150"
          >
            <div class="flex items-center !space-x-0">
              <ConnectAction
                v-if="['offline'].includes(row.status) && row.wifi"
                v-bind="{
                  device: row,
                  handleConnect,
                }"
              />

              <MirrorAction
                v-if="['device', 'unauthorized'].includes(row.status)"
                :ref="getMirrorActionRefs"
                v-bind="{ row, toggleRowExpansion }"
              />

              <MoreDropdown v-if="['device'].includes(row.status)" v-bind="{ row, toggleRowExpansion }" />

              <WirelessAction v-if="['device', 'unauthorized'].includes(row.status)" v-bind="{ row, handleConnect, handleRefresh }" />

              <RemoveAction
                v-if="['offline'].includes(row.status)"
                v-bind="{
                  device: row,
                  handleRefresh,
                }"
              />
            </div>
          </el-table-column>
          <el-table-column type="expand">
            <template #header>
              <el-icon class="" :title="$t('device.control.more')">
                <Operation class="" />
              </el-icon>
            </template>

            <template #default="{ row }">
              <ControlBar :device="row" :swapy-enabled="true" button-class="!min-w-10 !w-4vw !max-w-12" />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Right Push Sidebar (Smooth flex width transition, 0 occlusion) -->
      <div
        class="flex-none h-full transition-all duration-300 ease-out overflow-hidden flex items-center"
        :class="viewMode === 'grid' && activeDevice ? 'w-16 pl-1 pr-2 opacity-100' : 'w-0 pl-0 pr-0 opacity-0 pointer-events-none'"
      >
        <FloatingBar
          v-if="viewMode === 'grid'"
          :device="activeDevice"
          @close="activeDevice = null"
          @connect="handleConnect"
          @refresh="handleRefresh"
        />
      </div>
    </div>

    <!-- Bottom Status Bar with Device Count & Switcher -->
    <div class="flex-none flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800/80 px-1">
      <div class="flex items-center space-x-3">
        <WirelessGroup ref="wirelessGroupRef" v-bind="{ handleRefresh }" @auto-connected="onAutoConnected" />

        <!-- Device Statistics Counter Badge -->
        <div class="flex items-center space-x-2 text-xs">
          <div class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gray-100/90 dark:bg-gray-800/90 border border-gray-200/70 dark:border-gray-700/70 text-gray-700 dark:text-gray-300 font-medium select-none">
            <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>共 <strong class="text-gray-900 dark:text-white font-semibold">{{ deviceList.length }}</strong> 台设备</span>
            <span v-if="deviceList.length > 0" class="text-gray-400 dark:text-gray-500 font-normal">
              ({{ onlineCount }} 在线<template v-if="offlineCount > 0"> / {{ offlineCount }} 离线</template>)
            </span>
          </div>

          <!-- Quick Select All Toggle Button -->
          <el-button
            v-if="deviceList.length > 0"
            size="small"
            plain
            class="!text-xs !h-6 !px-2.5 !rounded-full text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
            @click="toggleSelectAll()"
          >
            <i :class="isAllSelected ? 'i-bi-check-all text-primary-500' : 'i-bi-square'" class="mr-1"></i>
            {{ isAllSelected ? '取消全选' : '全选所有' }}
          </el-button>
        </div>
      </div>

      <div class="flex-1 w-0 space-x-2 flex items-center justify-end">
        <!-- View Mode Switcher: Grid vs Table -->
        <el-radio-group v-model="viewMode" size="small" class="!mr-1">
          <el-radio-button value="grid">
            <el-icon><Grid /></el-icon>
          </el-radio-button>
          <el-radio-button value="table">
            <el-icon><Menu /></el-icon>
          </el-radio-button>
        </el-radio-group>

        <el-tooltip :content="$t('device.refresh.name') || '刷新设备'" placement="top" :show-after="100">
          <el-button
            type="default"
            :icon="loading ? '' : 'Refresh'"
            :loading="loading"
            circle
            @click="handleRefresh"
          >
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Grid, Menu, Operation } from '@element-plus/icons-vue'
import pLimit from 'p-limit'
import { sleep } from '$/utils/index.js'
import { uniqBy } from 'lodash-es'

import AppEmpty from '$/components/app-empty/index.vue'
import BatchActions from './components/batch-actions/index.vue'
import ControlBar from '$/components/control-bar/index.vue'
import MirrorAction from './components/mirror-action/index.vue'
import MoreDropdown from './components/more-dropdown/index.vue'
import Remark from './components/remark/index.vue'
import WirelessAction from './components/wireless-action/index.vue'
import ConnectAction from './components/connect-action/index.vue'
import RemoveAction from './components/remove-action/index.vue'
import WirelessGroup from './components/wireless-group/index.vue'
import DevicePopover from './components/device-popover/index.vue'
import DeviceGrid from './components/device-grid/index.vue'
import FloatingBar from './components/floating-bar/index.vue'

import { getDictLabel } from '$/dicts/helper'
import { deviceStatus } from '$/dicts/index.js'
import { useLicenseStore } from '$/store/license/index.js'

const MIRROR_START_INTERVAL = 1000

const deviceStore = useDeviceStore()
const preferenceStore = usePreferenceStore()
const licenseStore = useLicenseStore()

const loading = ref(false)
const viewMode = ref(window.localStorage.getItem('escrcpy:device_view_mode') || 'grid')
const activeDevice = ref(null)

watch(viewMode, (val) => {
  window.localStorage.setItem('escrcpy:device_view_mode', val)
  activeDevice.value = null
})

const autoMirrorConcurrencyLimit = Number(window.$preload.store.get('common.concurrencyLimit') ?? 5)
const autoMirrorLimit = pLimit(autoMirrorConcurrencyLimit)

const mirrorActionRefs = ref([])
const selectionRows = ref([])

const tableRef = ref(null)
const wirelessGroupRef = ref(null)

function onSelectDevice(device) {
  activeDevice.value = device
}

function tableRowClassName({ row }) {
  if (activeDevice.value?.id === row.id) {
    return '!bg-primary-50/30 dark:!bg-primary-950/20'
  }
  return ''
}

const deviceList = computed({
  get: () => deviceStore.list,
  set: (val) => {
    deviceStore.list = val
  },
})

watch(
  deviceList,
  (list) => {
    if (activeDevice.value) {
      const found = list.find(
        item => item.id === activeDevice.value.id || (activeDevice.value.serialNo && item.serialNo === activeDevice.value.serialNo),
      )
      if (found) {
        activeDevice.value = found
      }
      else {
        activeDevice.value = null
      }
    }
    if (selectionRows.value.length > 0) {
      const currentIds = new Set(list.map(item => item.id))
      selectionRows.value = selectionRows.value.filter(item => currentIds.has(item.id))
    }
  },
  { deep: true },
)

const isMultipleRow = computed(() => selectionRows.value.length > 0)

const onlineCount = computed(() => {
  return deviceList.value.filter(item => item.status === 'device').length
})

const offlineCount = computed(() => {
  return deviceList.value.filter(item => item.status === 'offline').length
})

const isAllSelected = computed(() => {
  return deviceList.value.length > 0 && selectionRows.value.length === deviceList.value.length
})

function clearSelection() {
  selectionRows.value = []
  if (tableRef.value) {
    tableRef.value.clearSelection()
  }
}

function toggleSelectAll(forceSelect = false) {
  if (isAllSelected.value && !forceSelect) {
    clearSelection()
  }
  else {
    selectionRows.value = [...deviceList.value]
    if (tableRef.value) {
      tableRef.value.clearSelection()
      deviceList.value.forEach((row) => {
        tableRef.value.toggleRowSelection(row, true)
      })
    }
  }
}

const statusFilters = computed(() => {
  return deviceStatus
    .map(item => ({
      text: window.t(item.label),
      value: item.value,
    }))
    .filter(item => !['emulator'].includes(item.value))
})

const remarkFilters = computed(() => {
  const value = deviceList.value
    .map(item => ({
      text: item.remark ?? item.name,
      value: item.remark ?? item.name,
    }))
  return uniqBy(value, 'value')
})

function remarkFilterMethod(value, row, column) {
  const target = row.remark || row.name
  return target === value
}

async function getDeviceData(options = {}) {
  const { unloading = false } = options

  if (!unloading) {
    loading.value = true
  }

  try {
    // 确保许可证状态已同步
    await licenseStore.fetchStatus()
    await deviceStore.getList(licenseStore.deviceLimit)
  }
  catch (error) {
    const message = error?.message || error?.cause?.message || ''
    console.warn('Device list fetch error:', message)

    if (message.includes('failed to start daemon')) {
      await getDeviceData()
      return false
    }

    if (message) {
      ElMessage.warning(message)
    }

    deviceList.value = []
  }

  loading.value = false
}

function filterMethod(value, row, column) {
  const property = column.property
  return row[property] === value
}

function onSelectionChange(rows) {
  selectionRows.value = rows
}

async function onAdbWatch(type, ret) {
  if (ret && ret.id) {
    await sleep(200)
    await getDeviceData()
    setTimeout(() => {
      getDeviceData()
    }, 1000)
  }

  if (type === 'remove') {
    mirrorActionRefs.value = mirrorActionRefs.value.filter(
      item => item.row.id !== ret.id && (!ret.serialNo || item.row.serialNo !== ret.serialNo),
    )
  }
}

async function getMirrorActionRefs(ref) {
  await nextTick()

  if (!ref?.row?.id) {
    return false
  }

  if (['unauthorized', 'offline'].includes(ref.row.status)) {
    return false
  }

  const exists = mirrorActionRefs.value.some(item => item.row.id === ref.row.id)
  if (exists) {
    return false
  }

  mirrorActionRefs.value.push(ref)

  const autoMirror = preferenceStore.data.autoMirror
  if (autoMirror) {
    await autoMirrorLimit(async () => {
      ref.handleClick(ref.row)
      await sleep(MIRROR_START_INTERVAL)
    })
  }
}

function handleRowClick(row, column, event) {
  if (event.target.closest('.el-button') || event.target.closest('.el-dropdown') || event.target.closest('.el-link') || event.target.closest('.remark-input') || event.target.closest('.el-table__expand-icon')) {
    return
  }
  tableRef.value.toggleRowExpansion(row)
}

function toggleRowExpansion(...args) {
  tableRef.value.toggleRowExpansion(...args)
}

function handleConnect(...args) {
  wirelessGroupRef.value.connect(...args)
}

async function handleRefresh() {
  loading.value = true
  await sleep(300)
  await getDeviceData({ resetResolve: true, unloading: true })
  setTimeout(() => {
    getDeviceData({ resetResolve: true, unloading: true })
  }, 1200)
}

function onAutoConnected() {}

let unAdbWatch = null

onMounted(async () => {
  await getDeviceData()
  unAdbWatch = await window.$preload.adb.watch(onAdbWatch)
})

onBeforeUnmount(() => {
  unAdbWatch?.()
})

onActivated(() => {
  getDeviceData()
})
</script>

<style lang="postcss" scoped>
:deep() {
  .el-table {
    --el-empty-image-width: 24vh;
    .el-table__row .cell {
      @apply !py-1;
    }

    .el-table__expanded-cell {
      @apply !py-0;
    }
  }
}
</style>

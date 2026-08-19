<template>
  <slot v-bind="{ loading, trigger: openDialog }">
    <el-button
      plain
      :title="$t('device.batch.rename') || '批量编号'"
      @click="openDialog(devices)"
    >
      <template #icon>
        <i class="i-bi-sort-numeric-down"></i>
      </template>
    </el-button>
  </slot>

  <el-dialog
    v-model="visible"
    :title="$t('device.batch.rename.title') || '批量设备编号与重命名'"
    width="560px"
    destroy-on-close
    append-to-body
    class="batch-rename-dialog"
  >
    <div class="space-y-4 text-sm">
      <div class="p-3 bg-primary-50/60 dark:bg-primary-950/40 rounded-xl border border-primary-100 dark:border-primary-900/50 flex items-center justify-between">
        <div class="flex items-center space-x-2 text-primary-800 dark:text-primary-200">
          <i class="i-bi-info-circle text-base"></i>
          <span>已选中 <strong>{{ targetDevices.length }}</strong> 台设备进行顺序编号 (1 到 N)</span>
        </div>
        <el-button
          v-if="deviceStore.list.length > targetDevices.length"
          type="primary"
          link
          size="small"
          @click="selectAllDevices"
        >
          全选全部 ({{ deviceStore.list.length }} 台)
        </el-button>
      </div>

      <el-form label-position="top" size="default" class="space-y-2">
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="名称前缀 (可自定义或清空)">
            <el-input
              v-model="form.prefix"
              placeholder="如 RVL-AL09 或 设备"
              clearable
            />
          </el-form-item>

          <el-form-item label="连接符号">
            <el-select v-model="form.separator" class="w-full">
              <el-option label="横杠 (-)" value="-" />
              <el-option label="下划线 (_)" value="_" />
              <el-option label="井号 (#)" value="#" />
              <el-option label="空格 ( )" value=" " />
              <el-option label="无连接符" value="" />
            </el-select>
          </el-form-item>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="起始序号">
            <el-input-number
              v-model="form.startIndex"
              :min="0"
              :max="9999"
              class="!w-full"
            />
          </el-form-item>

          <el-form-item label="编号位数格式">
            <el-select v-model="form.digits" class="w-full">
              <el-option label="自适应 (1, 2, 3...)" :value="1" />
              <el-option label="2 位补零 (01, 02, 03...)" :value="2" />
              <el-option label="3 位补零 (001, 002, 003...)" :value="3" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="名称后缀 (可选)">
          <el-input
            v-model="form.suffix"
            placeholder="如 -在线 (选填)"
            clearable
          />
        </el-form-item>
      </el-form>

      <!-- Live Preview -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
          <span>重命名效果预览 (共 {{ previewList.length }} 项)：</span>
          <span>示例：<code class="text-primary-600 dark:text-primary-400 font-mono">{{ previewList[0]?.newName || '' }}</code></span>
        </div>

        <div class="max-h-44 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-2 divide-y divide-gray-100 dark:divide-gray-800 space-y-1">
          <div
            v-for="(item, idx) in previewList"
            :key="item.id"
            class="flex items-center justify-between py-1.5 px-2 text-xs hover:bg-white/70 dark:hover:bg-gray-800/70 rounded-lg transition-colors"
          >
            <div class="flex items-center space-x-2 min-w-0 text-gray-500 dark:text-gray-400 truncate">
              <span class="w-5 text-gray-400 font-mono flex-none">{{ idx + 1 }}.</span>
              <span class="font-medium text-gray-700 dark:text-gray-300 truncate" :title="item.rawName">{{ item.rawName }}</span>
              <span class="text-[11px] font-mono text-gray-400 truncate">({{ item.id }})</span>
            </div>

            <div class="flex items-center space-x-1.5 flex-none font-mono font-medium text-primary-600 dark:text-primary-400 pl-2">
              <span>➔</span>
              <span class="bg-primary-50 dark:bg-primary-950/60 px-2 py-0.5 rounded border border-primary-200/50 dark:border-primary-800/50">
                {{ item.newName }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end space-x-2">
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!targetDevices.length"
          @click="handleApply"
        >
          确认编号并应用 ({{ targetDevices.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['completed'])

const deviceStore = useDeviceStore()

const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const targetDevices = ref([])

const form = reactive({
  prefix: '',
  startIndex: 1,
  digits: 2,
  separator: '-',
  suffix: '',
})

function formatNumber(num, digits) {
  return String(num).padStart(digits, '0')
}

function openDialog(devices = props.devices) {
  targetDevices.value = [...devices]
  if (!targetDevices.value.length && deviceStore.list.length) {
    targetDevices.value = [...deviceStore.list]
  }

  // Auto detect common prefix from devices
  const firstDev = targetDevices.value[0]
  if (firstDev) {
    // If device model exists or remark exists
    const candidate = firstDev.name && firstDev.name !== 'Unauthorized device'
      ? firstDev.name
      : (firstDev.remark ? firstDev.remark.replace(/[-_#\s]?\d+$/, '') : '设备')
    form.prefix = candidate || '设备'
  }
  else {
    form.prefix = '设备'
  }

  form.startIndex = 1
  form.digits = targetDevices.value.length > 9 ? 2 : 1
  form.separator = '-'
  form.suffix = ''

  visible.value = true
}

function selectAllDevices() {
  targetDevices.value = [...deviceStore.list]
}

const previewList = computed(() => {
  return targetDevices.value.map((device, index) => {
    const num = form.startIndex + index
    const numStr = formatNumber(num, form.digits)
    const rawName = device.remark || device.name || device.id

    let newName = ''
    if (form.prefix) {
      newName = `${form.prefix}${form.separator}${numStr}`
    }
    else {
      newName = numStr
    }

    if (form.suffix) {
      newName += form.suffix
    }

    return {
      id: device.id,
      rawName,
      newName,
      device,
    }
  })
})

async function handleApply() {
  if (!previewList.value.length) {
    return
  }

  submitting.value = true
  try {
    for (const item of previewList.value) {
      // 1. Update in-memory reactive device object
      item.device.remark = item.newName

      // 2. Persist to Electron Store
      deviceStore.setRemark(item.id, item.newName)

      // Also persist with serialNo if present
      if (item.device.serialNo && item.device.serialNo !== item.id) {
        deviceStore.setRemark(item.device.serialNo, item.newName)
      }
    }

    ElMessage.success(`成功为 ${previewList.value.length} 台设备完成顺序编号！`)
    visible.value = false
    emit('completed')
  }
  catch (error) {
    console.error('Batch rename failed:', error)
    ElMessage.error(error?.message || '批量编号失败')
  }
  finally {
    submitting.value = false
  }
}
</script>

<style scoped>
:deep(.el-dialog__body) {
  padding-top: 10px;
}
</style>

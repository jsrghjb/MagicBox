<template>
  <slot v-bind="{ loading, trigger: onTrigger }" />

  <el-dialog
    v-if="pickerVisible"
    v-model="pickerVisible"
    :title="$t('automation.batch.title')"
    width="720px"
    append-to-body
    destroy-on-close
    @close="pickerVisible = false"
  >
    <el-form label-width="100px">
      <el-form-item :label="$t('automation.script.select')">
        <el-select v-model="selectedId" class="w-full" filterable>
          <el-option
            v-for="script in availableScripts"
            :key="script.id"
            :label="script.name"
            :value="script.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('automation.batch.variableTable')">
        <div v-if="variableNames.length" class="w-full space-y-2">
          <div
            v-for="(row, index) in variableRows"
            :key="index"
            class="flex items-center gap-2"
          >
            <el-input
              v-for="varName in variableNames"
              :key="varName"
              v-model="row[varName]"
              :placeholder="varName"
              class="flex-1"
            />
            <el-button text circle icon="Delete" @click="removeRow(index)" />
          </div>
          <div class="flex items-center gap-2">
            <el-button @click="addRow">
              {{ $t('automation.batch.addRow') }}
            </el-button>
            <el-button @click="exportCsv">
              {{ $t('automation.batch.exportCsv') }}
            </el-button>
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept=".csv"
              :on-change="handleCsvImport"
            >
              <el-button>{{ $t('automation.batch.importCsv') }}</el-button>
            </el-upload>
          </div>
        </div>
        <div v-else class="text-sm text-gray-400">
          {{ $t('automation.batch.noVariables') }}
        </div>
      </el-form-item>

      <el-form-item :label="$t('automation.batch.concurrency')">
        <el-input-number v-model="concurrency" :min="1" :max="32" class="w-32" />
      </el-form-item>

      <el-form-item :label="$t('automation.batch.devices')">
        <div class="text-sm text-gray-500">
          {{ pendingDevices.length }} {{ $t('automation.batch.devices.hint') }}
        </div>
      </el-form-item>
    </el-form>

    <div v-if="results.length" class="mt-3 border-t pt-3 space-y-1 max-h-40 overflow-y-auto">
      <div
        v-for="(item, index) in results"
        :key="index"
        class="flex items-center gap-2 text-xs"
      >
        <el-tag :type="item.success ? 'success' : 'danger'" size="small">
          {{ item.success ? 'OK' : 'FAIL' }}
        </el-tag>
        <span class="truncate flex-1">{{ item.label }}</span>
        <span v-if="item.error" class="text-red-500 truncate">{{ item.error }}</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="pickerVisible = false">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button
        type="primary"
        :loading="loading"
        :disabled="!selectedId"
        @click="handleScriptPicked"
      >
        {{ $t('automation.batch.execute') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { deviceSelectionHelper } from '$/utils/device/selection/index.js'
import { runAutomationMatrix } from '$/utils/automation/runner.js'
import { automationDataStore } from '$/database/index.js'
import { useScheduleStore } from '$/store/schedule/index.js'
import { parseCsv, stringifyCsv } from '$/utils/csv/index.js'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  devices: {
    type: Array,
    default: () => [],
  },
})

const loading = ref(false)
const pickerVisible = ref(false)
const availableScripts = ref([])
const pendingDevices = ref([])
const selectedId = ref('')
const variableRows = ref([{}])
const concurrency = ref(3)
const results = ref([])

const selectedScript = computed(() => availableScripts.value.find(item => item.id === selectedId.value))
const variableNames = computed(() => Object.keys(selectedScript.value?.vars || {}))

watch(selectedScript, (script) => {
  if (script?.vars) {
    variableRows.value = [JSON.parse(JSON.stringify(script.vars))]
  }
  else {
    variableRows.value = [{}]
  }
})

const scheduleStore = useScheduleStore()

scheduleStore.registerScheduleType({
  label: 'automation.name.execute',
  value: 'automation',
})

scheduleStore.on('automation', (schedule) => {
  scheduleStore.start({
    schedule,
    handler: handleAutomationSchedule,
  })
})

async function handleAutomationSchedule(devices, context) {
  let config = context.payload?.automationConfig || null

  if (!config && context.extra) {
    try {
      config = JSON.parse(context.extra)
    }
    catch {
      config = null
    }
  }

  if (!config?.scriptId) {
    throw new Error('Missing automation script')
  }

  const result = await automationDataStore.getById(config.scriptId)
  if (!result.success) {
    throw new Error('Script not found')
  }

  const script = result.data
  loading.value = true

  try {
    await runAutomationMatrix({
      devices,
      rows: config.rows || [config.vars || {}],
      steps: script.steps || [],
      baseVars: script.vars || {},
      concurrencyLimit: config.concurrency,
    })
  }
  finally {
    loading.value = false
  }
}

async function onTrigger(devices) {
  const selectedDevices = deviceSelectionHelper.filter(devices, 'onlineAndUnique')
  if (!selectedDevices.length) {
    return
  }
  const deviceId = selectedDevices[0]?.id
  const listResult = await automationDataStore.listByDevice(deviceId)
  const scripts = listResult.data || []
  if (!scripts.length) {
    ElMessage.warning(window.t('automation.scripts.select.empty'))
    return
  }
  pendingDevices.value = selectedDevices
  availableScripts.value = scripts
  selectedId.value = scripts[0]?.id || ''
  variableRows.value = [JSON.parse(JSON.stringify(scripts[0]?.vars || {}))]
  pickerVisible.value = true
}

function addRow() {
  variableRows.value.push(Object.fromEntries(variableNames.value.map(name => [name, ''])))
}

function removeRow(index) {
  variableRows.value.splice(index, 1)
  if (!variableRows.value.length) {
    variableRows.value = [{}]
  }
}

function exportCsv() {
  if (!variableRows.value.length || !variableNames.value.length) {
    return
  }
  const csv = stringifyCsv([
    variableNames.value,
    ...variableRows.value.map(r => variableNames.value.map(n => r[n] ?? '')),
  ])
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `automation-vars-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleCsvImport(file) {
  try {
    const text = await file.raw.text()
    const rows = parseCsv(text)
    if (!rows.length) {
      ElMessage.warning(window.t('automation.batch.csvEmpty'))
      return
    }
    const headers = rows[0]
    const dataRows = rows.slice(1).map((cells) => {
      const row = {}
      headers.forEach((name, i) => {
        row[name] = cells[i] ?? ''
      })
      return row
    })
    variableRows.value = dataRows.length ? dataRows : [{}]
  }
  catch (e) {
    ElMessage.error(e.message || String(e))
  }
}

async function handleScriptPicked() {
  const script = availableScripts.value.find(item => item.id === selectedId.value)
  if (!script) {
    return
  }
  pickerVisible.value = false
  loading.value = true
  results.value = []
  try {
    await runAutomationMatrix({
      devices: pendingDevices.value,
      rows: variableRows.value,
      steps: script.steps || [],
      baseVars: script.vars || {},
      concurrencyLimit: concurrency.value,
      onTaskEnd: (item) => {
        results.value.push(item)
      },
    })
    const failed = results.value.filter(r => !r.success).length
    if (failed === 0) {
      ElMessage.success(window.t('automation.batch.done', { count: results.value.length }))
    }
    else if (failed === results.value.length) {
      ElMessage.error(window.t('automation.batch.allFailed', { count: failed }))
    }
    else {
      ElMessage.warning(window.t('automation.batch.partialDone', { ok: results.value.length - failed, fail: failed }))
    }
  }
  catch (error) {
    ElMessage.error(error?.message || window.t('automation.run.failed'))
  }
  finally {
    loading.value = false
  }
}
</script>

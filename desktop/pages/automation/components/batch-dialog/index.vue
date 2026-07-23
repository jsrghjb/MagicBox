<template>
  <el-dialog
    :model-value="true"
    :title="$t('automation.batch.title')"
    width="760px"
    class="el-dialog--beautify"
    append-to-body
    destroy-on-close
    @close="$emit('close')"
  >
    <el-form label-width="120px">
      <el-form-item :label="$t('automation.script.select')">
        <el-select v-model="selectedScriptId" class="w-full" filterable>
          <el-option
            v-for="script in scripts"
            :key="script.id"
            :label="script.name"
            :value="script.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="$t('automation.batch.devices')">
        <el-select
          v-model="deviceSelection"
          multiple
          collapse-tags
          collapse-tags-tooltip
          class="w-full"
          :placeholder="$t('automation.batch.devices.placeholder')"
        >
          <el-option
            v-for="d in onlineDevices"
            :key="d.id"
            :label="getDeviceLabel(d)"
            :value="d.id"
          />
        </el-select>
        <div class="text-xs text-gray-400 mt-1">
          {{ $t('automation.batch.devices.hint') }}
        </div>
      </el-form-item>

      <el-form-item :label="$t('automation.batch.concurrency')">
        <el-input-number
          v-model="concurrency"
          :min="1"
          :max="32"
          class="w-32"
        />
        <span class="text-xs text-gray-400 ml-2">{{ $t('automation.batch.concurrency.hint') }}</span>
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
              <el-button>
                {{ $t('automation.batch.importCsv') }}
              </el-button>
            </el-upload>
            <el-button v-if="variableRows.length > 1" text @click="resetToDefault">
              {{ $t('automation.batch.reset') }}
            </el-button>
          </div>
        </div>
        <div v-else class="text-sm text-gray-400">
          {{ $t('automation.batch.noVariables') }}
        </div>
      </el-form-item>
    </el-form>

    <div v-if="results.length" class="mt-3 border-t pt-3 space-y-1 max-h-48 overflow-y-auto">
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
      <el-button @click="$emit('close')">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button
        type="primary"
        :loading="executing"
        :disabled="!selectedScriptId || !deviceSelection.length"
        @click="handleExecute"
      >
        {{ executing ? $t('automation.batch.executing') : $t('automation.batch.execute') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { runAutomationMatrix } from '$/utils/automation/runner.js'
import { automationDataStore } from '$/database/index.js'
import { useDeviceStore } from '$/store/device/index.js'
import { parseCsv, stringifyCsv } from '$/utils/csv/index.js'

const props = defineProps({
  deviceId: {
    type: String,
    default: '',
  },
  scripts: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close'])

const deviceStore = useDeviceStore()
const onlineDevices = computed(() => deviceStore.list.filter(d => d.status === 'device'))

const selectedScriptId = ref('')
const variableRows = ref([{}])
const executing = ref(false)
const concurrency = ref(3)
const results = ref([])

const deviceSelection = ref(props.deviceId ? [props.deviceId] : [])

const selectedScript = computed(() => props.scripts.find(item => item.id === selectedScriptId.value))
const variableNames = computed(() => Object.keys(selectedScript.value?.vars || {}))

watch(selectedScript, (script) => {
  if (script?.vars) {
    variableRows.value = [JSON.parse(JSON.stringify(script.vars))]
  }
  else {
    variableRows.value = [{}]
  }
})

function getDeviceLabel(d) {
  return deviceStore.getLabel(d.id, 'name') || d.id
}

function addRow() {
  const base = Object.fromEntries(variableNames.value.map(name => [name, '']))
  variableRows.value.push(base)
}

function removeRow(index) {
  variableRows.value.splice(index, 1)
  if (!variableRows.value.length) {
    variableRows.value = [{}]
  }
}

function resetToDefault() {
  if (selectedScript.value?.vars) {
    variableRows.value = [JSON.parse(JSON.stringify(selectedScript.value.vars))]
  }
  else {
    variableRows.value = [{}]
  }
}

function exportCsv() {
  if (!variableRows.value.length || !variableNames.value.length) {
    return
  }
  const csv = stringifyCsv(
    [variableNames.value, ...variableRows.value.map(r => variableNames.value.map(n => r[n] ?? ''))],
  )
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
    if (!dataRows.length) {
      ElMessage.warning(window.t('automation.batch.csvEmpty'))
      return
    }
    variableRows.value = dataRows
    ElMessage.success(window.t('automation.batch.csvImported', { count: dataRows.length }))
  }
  catch (e) {
    console.error(e)
    ElMessage.error(e.message || String(e))
  }
}

async function handleExecute() {
  if (!selectedScriptId.value || !deviceSelection.value.length) {
    return
  }
  executing.value = true
  results.value = []

  try {
    const result = await automationDataStore.getById(selectedScriptId.value)
    if (!result.success) {
      throw new Error('Script not found')
    }
    const script = result.data
    const devices = deviceSelection.value.map(id => ({ id }))

    await runAutomationMatrix({
      devices,
      rows: variableRows.value,
      steps: script.steps || [],
      baseVars: script.vars || {},
      concurrencyLimit: concurrency.value,
      onDeviceLog: () => {},
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
    executing.value = false
  }
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
    <div class="flex-none rounded-2xl border border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/50 px-4 py-3">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-bold text-gray-800 dark:text-gray-100">
            {{ $t('toolbox.target') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {{ $t('toolbox.hint') }}
          </div>
        </div>
        <div class="flex items-center gap-2 flex-none flex-wrap justify-end">
          <el-input
            v-model="keyword"
            clearable
            size="small"
            class="!w-40"
            :placeholder="$t('toolbox.search')"
          >
            <template #prefix>
              <i class="i-solar-magnifer-bold-duotone text-gray-400"></i>
            </template>
          </el-input>
          <label class="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ $t('toolbox.parallel') }}</span>
            <el-switch
              :model-value="toolboxStore.parallel"
              @change="toolboxStore.setParallel"
            />
          </label>
          <el-button size="small" @click="selectAllOnline">
            {{ $t('toolbox.target.all') }} ({{ onlineDevices.length }})
          </el-button>
          <el-button size="small" text @click="toolboxStore.setSelectedIds([])">
            {{ $t('toolbox.target.clear') }}
          </el-button>
        </div>
      </div>

      <div v-if="onlineDevices.length" class="flex flex-wrap gap-2 mt-3">
        <button
          v-for="device in onlineDevices"
          :key="device.id"
          class="target-chip"
          :class="{ 'is-active': toolboxStore.selectedIds.includes(device.id) }"
          @click="toolboxStore.toggleSelected(device.id)"
        >
          <span
            class="w-1.5 h-1.5 rounded-full flex-none"
            :class="toolboxStore.watchingSet.has(device.id) ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'"
          ></span>
          <span class="truncate max-w-40">{{ device.remark || device.name || device.id }}</span>
        </button>
      </div>
      <div v-else class="text-xs text-amber-600 dark:text-amber-400 mt-3">
        {{ $t('toolbox.target.empty') }}
      </div>
    </div>

    <div class="flex-1 min-h-0 flex gap-4">
      <div class="flex-1 min-w-0 overflow-auto pr-1 space-y-6">
        <section v-if="showFeatured">
          <div class="flex items-center gap-2 mb-3 px-0.5">
            <i class="i-solar-widget-4-bold-duotone text-base text-primary-500"></i>
            <h2 class="text-sm font-bold text-gray-700 dark:text-gray-200">
              {{ $t('toolbox.group.health') }}
            </h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="tool in FEATURE_TILES"
              :key="tool.id"
              class="tool-tile is-clickable"
              :class="{
                'is-running': toolboxStore.runningId === tool.id,
                'is-busy': Boolean(toolboxStore.runningId) && toolboxStore.runningId !== tool.id,
              }"
              :title="$t(tool.description)"
              @click="handleTileClick(tool)"
            >
              <div class="tool-tile__icon" :class="tool.tone">
                <i v-if="toolboxStore.runningId === tool.id" class="i-iconoir-refresh text-xl animate-spin"></i>
                <i v-else :class="tool.icon" class="text-xl"></i>
              </div>
              <div class="min-w-0 flex-1 text-left">
                <div class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                  {{ $t(tool.label) }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ $t(tool.description) }}
                </div>
                <div v-if="tool.buttons?.length" class="flex items-center gap-1.5 mt-2">
                  <el-button
                    v-for="button in tool.buttons"
                    :key="button.mode"
                    size="small"
                    :type="button.mode === 'pause' ? 'default' : 'primary'"
                    :disabled="isRunButtonDisabled(tool, button)"
                    @click.stop="handleTool(tool, button.mode)"
                  >
                    {{ $t(button.label) }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-for="group in visibleGroups" :key="group.id">
          <div class="flex items-center gap-2 mb-3 px-0.5">
            <i :class="group.icon" class="text-base text-primary-500"></i>
            <h2 class="text-sm font-bold text-gray-700 dark:text-gray-200">
              {{ $t(group.label) }}
            </h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div
              v-for="tool in group.tools"
              :key="tool.id"
              class="tool-tile"
              :class="{
                'is-running': toolboxStore.runningId === tool.id,
                'is-live': tool.id === 'watch' && isWatchingSelected,
                'is-clickable': ['action', 'toggle', 'buttons'].includes(tool.kind),
                'is-busy': Boolean(toolboxStore.runningId) && toolboxStore.runningId !== tool.id && tool.kind !== 'toggle',
              }"
              :title="$t(tool.description)"
              @click="handleTileClick(tool)"
            >
              <div class="tool-tile__icon" :class="tool.tone">
                <i v-if="toolboxStore.runningId === tool.id" class="i-iconoir-refresh text-xl animate-spin"></i>
                <i v-else :class="tool.icon" class="text-xl"></i>
              </div>
              <div class="min-w-0 flex-1 text-left">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                    {{ $t(tool.label) }}
                  </span>
                  <span
                    v-if="tool.id === 'watch' && isWatchingSelected"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium"
                  >
                    {{ $t('toolbox.watch.running') }}
                  </span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ $t(tool.description) }}
                </div>
                <div v-if="tool.buttons?.length || tool.kind === 'switch'" class="flex items-center gap-1 mt-2 flex-nowrap">
                  <template v-if="tool.buttons?.length">
                    <el-button
                      v-for="button in tool.buttons"
                      :key="button.mode"
                      size="small"
                      class="!px-2.5 shrink-0"
                      :disabled="Boolean(toolboxStore.runningId)"
                      @click.stop="handleTool(tool, button.mode)"
                    >
                      {{ $t(button.label) }}
                    </el-button>
                  </template>
                  <template v-else>
                    <el-button
                      size="small"
                      class="!px-2.5 shrink-0"
                      :disabled="Boolean(toolboxStore.runningId)"
                      @click.stop="handleTool(tool, 'on')"
                    >
                      {{ $t(tool.onLabel || 'toolbox.switch.on') }}
                    </el-button>
                    <el-button
                      v-if="tool.kind === 'switch' || tool.offLabel"
                      size="small"
                      class="!px-2.5 shrink-0"
                      :disabled="Boolean(toolboxStore.runningId)"
                      @click.stop="handleTool(tool, 'off')"
                    >
                      {{ $t(tool.offLabel || 'toolbox.switch.off') }}
                    </el-button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div class="flex items-center gap-2 mb-3 px-0.5">
            <i class="i-solar-code-square-bold-duotone text-base text-primary-500"></i>
            <h2 class="text-sm font-bold text-gray-700 dark:text-gray-200">
              {{ $t('toolbox.group.custom') }}
            </h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div
              v-for="tool in customTools"
              :key="tool.id"
              class="tool-tile is-clickable"
              :class="{
                'is-running': toolboxStore.runningId === tool.id,
                'is-busy': Boolean(toolboxStore.runningId) && toolboxStore.runningId !== tool.id,
              }"
              :title="tool.description"
              @click="handleTileClick(tool)"
            >
              <div class="tool-tile__icon tone-slate">
                <i v-if="toolboxStore.runningId === tool.id" class="i-iconoir-refresh text-xl animate-spin"></i>
                <i v-else class="i-solar-code-square-bold-duotone text-xl"></i>
              </div>
              <div class="min-w-0 flex-1 text-left">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                    {{ tool.label }}
                  </span>
                  <button
                    class="ml-auto text-gray-400 hover:text-rose-500 p-1 rounded-md"
                    :title="$t('toolbox.custom.delete')"
                    @click.stop="removeCustom(tool.id)"
                  >
                    <i class="i-solar-trash-bin-minimalistic-bold text-sm"></i>
                  </button>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono">
                  {{ tool.description }}
                </div>
              </div>
            </div>

            <button class="tool-tile tool-tile--dashed" @click="openCustomDialog">
              <div class="tool-tile__icon tone-slate">
                <i class="i-solar-add-circle-bold-duotone text-xl"></i>
              </div>
              <div class="min-w-0 flex-1 text-left">
                <div class="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {{ $t('toolbox.custom.add') }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ $t('toolbox.custom.add.desc') }}
                </div>
              </div>
            </button>
          </div>
        </section>
      </div>

      <aside class="w-96 flex-none min-h-0">
        <section class="h-full min-h-0 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-900/50 overflow-hidden flex flex-col">
          <div class="flex-none px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <div class="flex items-center gap-2">
              <div class="side-tabs">
                <button
                  class="side-tabs__item"
                  :class="{ 'is-active': sideTab === 'result' }"
                  @click="sideTab = 'result'"
                >
                  {{ $t('toolbox.result.title') }}
                </button>
                <button
                  class="side-tabs__item"
                  :class="{ 'is-active': sideTab === 'log' }"
                  @click="sideTab = 'log'"
                >
                  {{ $t('toolbox.log.title') }}
                </button>
              </div>
              <el-button size="small" text class="!ml-auto" @click="clearSidePanel">
                {{ $t('toolbox.log.clear') }}
              </el-button>
            </div>
            <div v-if="sideTab === 'result' && resultStats.total" class="mt-2">
              <div class="result-meter">
                <span v-if="resultStats.success" class="bg-emerald-500" :style="{ flexGrow: resultStats.success }"></span>
                <span v-if="resultStats.error" class="bg-rose-500" :style="{ flexGrow: resultStats.error }"></span>
                <span v-if="resultStats.running" class="bg-amber-400" :style="{ flexGrow: resultStats.running }"></span>
                <span v-if="resultStats.paused" class="bg-orange-400" :style="{ flexGrow: resultStats.paused }"></span>
                <span v-if="resultStats.pending" class="bg-gray-200 dark:bg-gray-700" :style="{ flexGrow: resultStats.pending }"></span>
              </div>
              <div class="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <span v-if="toolboxStore.lastRun.title" class="font-medium text-gray-700 dark:text-gray-200 truncate max-w-full">{{ toolboxStore.lastRun.title }}</span>
                <span v-if="resultStats.success">{{ resultStats.success }} 成功</span>
                <span v-if="resultStats.error">{{ resultStats.error }} 失败</span>
                <span v-if="resultStats.running">{{ resultStats.running }} 进行中</span>
                <span v-if="resultStats.paused">{{ resultStats.paused }} 暂停</span>
                <span v-if="resultStats.pending">{{ resultStats.pending }} 等待</span>
              </div>
            </div>
          </div>

          <div v-show="sideTab === 'result'" class="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-2">
            <div v-if="!toolboxStore.lastRun.items.length" class="text-xs text-gray-400 py-8 text-center">
              {{ $t('toolbox.result.empty') }}
            </div>
            <article
              v-for="item in toolboxStore.lastRun.items"
              :key="item.id"
              class="result-card"
              :class="`is-${item.status}`"
            >
              <div class="flex items-start gap-2">
                <span class="result-status" :class="`is-${item.status}`">
                  <i v-if="item.status === 'running'" class="i-iconoir-refresh animate-spin"></i>
                  <i v-else-if="item.status === 'success'" class="i-solar-check-circle-bold"></i>
                  <i v-else-if="item.status === 'error'" class="i-solar-close-circle-bold"></i>
                  <i v-else-if="item.status === 'paused'" class="i-solar-pause-circle-bold"></i>
                  <i v-else class="i-solar-clock-circle-bold"></i>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <div class="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {{ item.label }}
                    </div>
                    <span class="result-pill" :class="`is-${item.status}`">
                      {{ $t(`toolbox.result.status.${item.status}`) }}
                    </span>
                  </div>
                  <div v-if="resultView(item).summary" class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-5">
                    {{ resultView(item).summary }}
                  </div>
                </div>
              </div>

              <div v-if="resultView(item).checks.length" class="mt-2 space-y-1">
                <div
                  v-for="(check, index) in resultView(item).checks"
                  :key="`${item.id}-${index}`"
                  class="check-row"
                  :class="`is-${check.tone}`"
                >
                  <span class="check-row__mark">{{ check.mark }}</span>
                  <span>{{ check.text }}</span>
                </div>
              </div>
              <div v-else-if="resultView(item).body" class="mt-2 text-[11px] text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words leading-5">
                {{ resultView(item).body }}
              </div>
              <div v-else-if="item.status === 'running' && resultView(item).live" class="mt-2 text-[11px] text-amber-600 dark:text-amber-400 truncate">
                {{ resultView(item).live }}
              </div>
              <div v-if="resultView(item).hint" class="mt-2 text-[11px] text-primary-600 dark:text-primary-400 leading-5">
                {{ resultView(item).hint }}
              </div>
            </article>
          </div>

          <div
            v-show="sideTab === 'log'"
            ref="logPaneRef"
            class="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-3"
          >
            <div v-if="!logSessions.length" class="text-xs text-gray-400 py-8 text-center">
              {{ $t('toolbox.log.empty') }}
            </div>
            <section v-for="session in logSessions" :key="session.id" class="log-session">
              <div v-if="session.title" class="log-session__head">
                <span class="truncate">{{ session.title }}</span>
                <span class="flex-none text-gray-400">{{ session.time }}</span>
              </div>
              <div v-for="block in session.devices" :key="block.key" class="log-device">
                <div v-if="block.label" class="log-device__head">
                  {{ block.label }}
                </div>
                <div class="log-device__list">
                  <div
                    v-for="entry in block.items"
                    :key="entry.id"
                    class="log-line"
                    :class="`is-${entry.tone}`"
                  >
                    <span v-if="entry.tag" class="log-tag" :class="`is-${entry.tone}`">{{ entry.tag }}</span>
                    <span class="min-w-0 flex-1 break-words">{{ entry.text }}</span>
                    <span class="log-line__time">{{ entry.time }}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog
      v-model="customVisible"
      :title="$t('toolbox.custom.add')"
      width="420px"
      append-to-body
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item :label="$t('toolbox.form.name')">
          <el-input v-model="customModel.name" :placeholder="$t('toolbox.form.name.placeholder')" />
        </el-form-item>
        <el-form-item :label="$t('toolbox.form.command')">
          <el-input
            v-model="customModel.command"
            type="textarea"
            :rows="3"
            placeholder="settings get global http_proxy"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customVisible = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="submitCustom">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { useToolboxStore } from '$/store/toolbox/index.js'
import {
  createCustomTool,
  FEATURE_TILES,
  TOOL_GROUPS,
} from '$/utils/toolbox/catalog.js'

const deviceStore = useDeviceStore()
const toolboxStore = useToolboxStore()

const keyword = ref('')
const sideTab = ref('result')
const logPaneRef = ref(null)
const customVisible = ref(false)
const customModel = ref({
  name: '',
  command: '',
})

const onlineDevices = computed(() => {
  return (deviceStore.list || []).filter(device => device.status === 'device')
})

const selectedDevices = computed(() => {
  const selected = new Set(toolboxStore.selectedIds)
  return onlineDevices.value.filter(device => selected.has(device.id))
})

const isWatchingSelected = computed(() => {
  return selectedDevices.value.length > 0
    && selectedDevices.value.every(device => toolboxStore.watchingSet.has(device.id))
})

const resultStats = computed(() => {
  const items = toolboxStore.lastRun.items || []
  const count = status => items.filter(item => item.status === status).length
  return {
    total: items.length,
    success: count('success'),
    error: count('error'),
    running: count('running'),
    pending: count('pending'),
    paused: count('paused'),
  }
})

const LOG_TAGS = {
  通过: 'ok',
  待处理: 'fail',
  注意: 'warn',
  跳过: 'skip',
  结论: 'accent',
  识别: 'info',
  概况: 'info',
  完成: 'ok',
  失败: 'fail',
}

function splitTaggedMessage(message) {
  const match = String(message || '').match(/^(通过|待处理|注意|跳过|结论|识别|概况)\s+(.*)$/)
  if (match) {
    return { tag: match[1], tone: LOG_TAGS[match[1]], text: match[2] }
  }
  return { tag: '', tone: '', text: String(message || '') }
}

function resultView(item) {
  const message = String(item.message || '')
  const lines = message.split('\n').map(line => line.trim()).filter(Boolean)
  const checks = []
  const header = []
  let hint = ''

  for (const line of lines) {
    if (line.startsWith('✗')) {
      checks.push({ tone: 'fail', mark: '✗', text: line.slice(1).trim() })
    }
    else if (line.startsWith('!')) {
      checks.push({ tone: 'warn', mark: '!', text: line.slice(1).trim() })
    }
    else if (line.startsWith('—') || line.startsWith('- ')) {
      checks.push({ tone: 'skip', mark: '—', text: line.replace(/^[—-]\s*/, '') })
    }
    else if (line.includes('一键初始化')) {
      hint = line
    }
    else {
      header.push(line)
    }
  }

  if (checks.length) {
    return {
      summary: header.filter(line => line !== item.label).slice(-2).join(' · '),
      checks,
      hint,
      body: '',
      live: '',
    }
  }

  return {
    summary: '',
    checks: [],
    hint: '',
    body: item.status === 'running' ? '' : message,
    live: item.status === 'running' ? ((item.steps || []).slice(-1)[0] || message) : '',
  }
}

function decorateLog(item) {
  const tagged = splitTaggedMessage(item.message)
  let tone = tagged.tone || item.level || 'info'
  if (item.kind === 'success' || item.level === 'success') {
    tone = 'ok'
  }
  if (item.kind === 'error' || item.level === 'error') {
    tone = 'fail'
  }
  if (item.kind === 'pause') {
    tone = 'warn'
  }
  return {
    ...item,
    tag: tagged.tag || (item.kind === 'success' ? '完成' : item.kind === 'error' ? '失败' : ''),
    text: tagged.tag ? tagged.text : item.message,
    tone,
  }
}

const logSessions = computed(() => {
  const sessions = []
  let session = null
  let block = null

  function ensureSession() {
    if (!session) {
      session = { id: `loose-${sessions.length}`, title: '', time: '', devices: [] }
      sessions.push(session)
      block = null
    }
    return session
  }

  for (const raw of toolboxStore.logs) {
    if (raw.kind === 'run') {
      session = { id: raw.id, title: raw.message, time: raw.time, devices: [] }
      sessions.push(session)
      block = null
      continue
    }

    ensureSession()
    const deviceId = raw.deviceId || raw.deviceLabel || ''
    if (!block || block.deviceId !== deviceId) {
      block = {
        key: `${session.id}-${deviceId || block?.key || raw.id}`,
        deviceId,
        label: raw.deviceLabel || '',
        items: [],
      }
      session.devices.push(block)
      if (raw.kind === 'device' && !raw.message) {
        continue
      }
    }
    else if (!block.label && raw.deviceLabel) {
      block.label = raw.deviceLabel
    }

    if (raw.kind === 'device' && (raw.message === '开始处理' || raw.message === '已开启弹窗消杀')) {
      continue
    }

    block.items.push(decorateLog(raw))
  }

  return sessions.filter(item => item.title || item.devices.some(device => device.items.length))
})

watch([() => toolboxStore.logs.length, sideTab], async () => {
  if (sideTab.value !== 'log') {
    return
  }
  await nextTick()
  const pane = logPaneRef.value
  if (pane) {
    pane.scrollTop = pane.scrollHeight
  }
})

const customTools = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return toolboxStore.customCommands
    .map(createCustomTool)
    .filter((tool) => {
      if (!text) {
        return true
      }
      return tool.label.toLowerCase().includes(text)
        || tool.description.toLowerCase().includes(text)
    })
})

const showFeatured = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) {
    return true
  }
  return FEATURE_TILES.some((tool) => {
    return window.t(tool.label).toLowerCase().includes(text)
      || window.t(tool.description).toLowerCase().includes(text)
  })
})

const visibleGroups = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return TOOL_GROUPS
    .map(group => ({
      ...group,
      tools: group.tools.filter((tool) => {
        if (!text) {
          return true
        }
        return window.t(tool.label).toLowerCase().includes(text)
          || window.t(tool.description).toLowerCase().includes(text)
      }),
    }))
    .filter(group => group.tools.length)
})

function selectAllOnline() {
  toolboxStore.setSelectedIds(onlineDevices.value.map(device => device.id))
}

function ensureDevices() {
  if (!selectedDevices.value.length) {
    ElMessage.warning(window.t('toolbox.target.empty'))
    return false
  }
  return true
}

async function confirmTool(tool, mode) {
  const key = mode === 'off'
    ? (tool.confirmOff || '')
    : (tool.confirmOn || tool.confirm || '')

  if (!key) {
    return true
  }

  try {
    await ElMessageBox.confirm(
      window.t(key, { count: selectedDevices.value.length }),
      tool.kind === 'custom' ? tool.label : window.t(tool.label),
      {
        type: 'warning',
        confirmButtonText: window.t('common.confirm'),
        cancelButtonText: window.t('common.cancel'),
      },
    )
    return true
  }
  catch {
    return false
  }
}

function isRunButtonDisabled(tool, button) {
  if (button.mode === 'pause') {
    return toolboxStore.runningId !== tool.id
  }
  return Boolean(toolboxStore.runningId)
}

async function handleTool(tool, mode = 'on') {
  if (mode === 'pause') {
    toolboxStore.requestPause()
    return
  }

  if (!ensureDevices()) {
    return
  }

  if (tool.kind === 'toggle') {
    toolboxStore.toggleWatch(selectedDevices.value)
    return
  }

  if (!(await confirmTool(tool, mode))) {
    return
  }

  if (tool.kind === 'custom') {
    await toolboxStore.runAction(tool.id, selectedDevices.value, {
      mode: 'on',
      params: { command: tool.command, name: tool.label },
    })
    return
  }

  await toolboxStore.runAction(tool.id, selectedDevices.value, { mode })
}

function handleTileClick(tool) {
  if (toolboxStore.runningId === tool.id) {
    toolboxStore.requestPause()
    return
  }
  if (toolboxStore.runningId && tool.kind !== 'toggle') {
    return
  }
  if (tool.kind === 'switch') {
    return
  }
  if (tool.kind === 'buttons') {
    const start = tool.buttons?.find(item => item.mode !== 'pause')
    handleTool(tool, start?.mode || 'on')
    return
  }
  handleTool(tool, 'on')
}

function openCustomDialog() {
  customModel.value = { name: '', command: '' }
  customVisible.value = true
}

function submitCustom() {
  try {
    toolboxStore.addCustomCommand(customModel.value)
    customVisible.value = false
    ElMessage.success(window.t('toolbox.custom.added'))
  }
  catch (error) {
    ElMessage.warning(error?.message || window.t('toolbox.form.custom.invalid'))
  }
}

function removeCustom(id) {
  toolboxStore.removeCustomCommand(id)
}

function clearSidePanel() {
  if (sideTab.value === 'log') {
    toolboxStore.clearLogs()
    return
  }
  toolboxStore.clearResults()
}

onMounted(async () => {
  toolboxStore.recoverIfStale()
  await deviceStore.getList()
  if (!toolboxStore.selectedIds.length) {
    selectAllOnline()
  }
})

onActivated(() => {
  toolboxStore.recoverIfStale()
})

watch(onlineDevices, () => {
  const onlineIds = new Set(onlineDevices.value.map(device => device.id))
  toolboxStore.setSelectedIds(toolboxStore.selectedIds.filter(id => onlineIds.has(id)))
})
</script>

<style lang="postcss" scoped>
.target-chip {
  @apply inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full text-xs border transition-all;
  @apply bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-400;
  @apply dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700;
}

.target-chip.is-active {
  @apply bg-primary-50 text-primary-700 border-primary-300;
  @apply dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-700;
}

.side-tabs {
  @apply inline-flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800;
}

.side-tabs__item {
  @apply px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 transition-all;
}

.side-tabs__item.is-active {
  @apply bg-white text-gray-800 shadow-sm;
  @apply dark:bg-gray-700 dark:text-gray-100;
}

.result-meter {
  @apply h-1.5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800;
}

.result-meter > span {
  min-width: 4px;
}

.result-card {
  @apply rounded-xl border px-2.5 py-2;
  @apply bg-white/70 border-gray-100;
  @apply dark:bg-gray-900/40 dark:border-gray-800;
}

.result-card.is-success {
  @apply border-emerald-200/80 dark:border-emerald-900/50;
}
.result-card.is-error {
  @apply border-rose-200/80 dark:border-rose-900/50;
}
.result-card.is-running {
  @apply border-amber-200/90 dark:border-amber-900/50;
}
.result-card.is-paused {
  @apply border-orange-200/80 dark:border-orange-900/50;
}

.result-status {
  @apply w-5 h-5 rounded-full flex items-center justify-center flex-none text-sm mt-0.5;
}
.result-status.is-success {
  @apply text-emerald-500;
}
.result-status.is-error {
  @apply text-rose-500;
}
.result-status.is-running {
  @apply text-amber-500;
}
.result-status.is-paused {
  @apply text-orange-500;
}
.result-status.is-pending {
  @apply text-gray-400;
}

.result-pill {
  @apply ml-auto text-[10px] px-1.5 py-0.5 rounded-full flex-none font-medium;
}
.result-pill.is-success {
  @apply bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400;
}
.result-pill.is-error {
  @apply bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400;
}
.result-pill.is-running {
  @apply bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400;
}
.result-pill.is-paused {
  @apply bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400;
}
.result-pill.is-pending {
  @apply bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400;
}

.check-row {
  @apply flex items-start gap-1.5 text-[11px] leading-5 rounded-lg px-2 py-1;
}
.check-row.is-fail {
  @apply bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300;
}
.check-row.is-warn {
  @apply bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300;
}
.check-row.is-skip {
  @apply bg-gray-50 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400;
}
.check-row.is-ok {
  @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300;
}
.check-row__mark {
  @apply w-3 flex-none font-semibold;
}

.log-session__head {
  @apply flex items-center gap-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200 pb-1;
}

.log-device {
  @apply rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 overflow-hidden;
}

.log-device__head {
  @apply px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800;
}

.log-device__list {
  @apply px-2 py-1.5 space-y-1;
}

.log-line {
  @apply flex items-start gap-1.5 text-[11px] leading-5 text-gray-600 dark:text-gray-300;
}
.log-line.is-ok {
  @apply text-emerald-700 dark:text-emerald-300;
}
.log-line.is-fail {
  @apply text-rose-700 dark:text-rose-300;
}
.log-line.is-warn {
  @apply text-amber-700 dark:text-amber-300;
}
.log-line.is-accent {
  @apply text-primary-700 dark:text-primary-300;
}

.log-tag {
  @apply flex-none min-w-10 text-center text-[10px] px-1 py-0.5 rounded font-medium;
}
.log-tag.is-ok {
  @apply bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300;
}
.log-tag.is-fail {
  @apply bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300;
}
.log-tag.is-warn {
  @apply bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300;
}
.log-tag.is-skip {
  @apply bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400;
}
.log-tag.is-accent {
  @apply bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300;
}
.log-tag.is-info {
  @apply bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300;
}

.log-line__time {
  @apply flex-none text-[10px] text-gray-400 tabular-nums;
}

.tool-tile {
  @apply flex items-start gap-3 p-3 rounded-2xl border text-left;
  @apply bg-white border-gray-200/80 shadow-sm;
  @apply dark:bg-gray-900/60 dark:border-gray-800;
  @apply transition-all duration-200;
}

.tool-tile.is-clickable {
  @apply cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-primary-300;
}

.tool-tile--dashed {
  @apply border-dashed bg-transparent shadow-none hover:border-primary-400 hover:bg-primary-50/40;
  @apply dark:hover:bg-primary-950/20;
}

.tool-tile.is-running,
.tool-tile.is-live {
  @apply border-primary-400 ring-2 ring-primary-500/15;
}

.tool-tile.is-busy {
  @apply opacity-60;
}

.tool-tile__icon {
  @apply w-11 h-11 rounded-2xl flex items-center justify-center flex-none;
}

.tone-primary {
  @apply bg-primary-500/12 text-primary-600 dark:text-primary-400;
}
.tone-sky {
  @apply bg-sky-500/12 text-sky-600 dark:text-sky-400;
}
.tone-violet {
  @apply bg-violet-500/12 text-violet-600 dark:text-violet-400;
}
.tone-teal {
  @apply bg-teal-500/12 text-teal-600 dark:text-teal-400;
}
.tone-amber {
  @apply bg-amber-500/12 text-amber-600 dark:text-amber-400;
}
.tone-orange {
  @apply bg-orange-500/12 text-orange-600 dark:text-orange-400;
}
.tone-rose {
  @apply bg-rose-500/12 text-rose-600 dark:text-rose-400;
}
.tone-slate {
  @apply bg-slate-500/12 text-slate-600 dark:text-slate-300;
}
</style>

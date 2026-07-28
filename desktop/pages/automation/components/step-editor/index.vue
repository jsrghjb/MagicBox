<template>
  <el-card
    shadow="never"
    class="el-card--beautify"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span>{{ $t('automation.step.type') }}</span>
        <el-button size="small" @click="$emit('run-step')">
          {{ $t('automation.step.run') }}
        </el-button>
      </div>
    </template>

    <div class="pr-2">
      <el-form label-width="110px" size="small" class="pr-2">
        <el-form-item :label="$t('automation.step.name')">
          <el-input :model-value="step.name" @update:model-value="update('name', $event)" />
        </el-form-item>

        <el-form-item :label="$t('automation.step.type')">
          <el-select
            :model-value="step.type"
            class="w-full"
            @update:model-value="onTypeChange"
          >
            <el-option-group
              v-for="group in stepGroups"
              :key="group.label"
              :label="$t(group.label)"
            >
              <el-option
                v-for="item in group.options"
                :key="item.value"
                :label="$t(item.label)"
                :value="item.value"
              />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item v-if="step.type !== 'end'" :label="$t('automation.step.delayBefore')">
          <div class="flex items-center gap-2 w-full">
            <el-input-number
              :model-value="step.delayBefore || 0"
              :min="0"
              :step="100"
              class="w-full"
              @update:model-value="update('delayBefore', $event)"
            />
            <el-tooltip
              raw-content
              :content="$t('automation.step.delayBefore.tip')"
              placement="top"
            >
              <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </el-form-item>

        <el-form-item v-if="!isControlStep" :label="$t('automation.step.loopCount')">
          <div class="flex items-center gap-2 w-full">
            <el-input-number
              :model-value="step.loopCount || 1"
              :min="1"
              class="w-full"
              @update:model-value="update('loopCount', $event)"
            />
            <el-tooltip
              raw-content
              :content="$t('automation.step.loopCount.tip')"
              placement="top"
            >
              <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </el-form-item>

        <el-form-item v-if="isRandomizableStep" :label="$t('automation.step.randomRange')">
          <div class="flex items-center gap-2">
            <el-input-number
              :model-value="step.randomRange || 0"
              :min="0"
              class="w-full"
              @update:model-value="update('randomRange', $event)"
            />
            <el-tooltip
              raw-content
              :content="$t('automation.step.randomRange.tip')"
              placement="top"
            >
              <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                <QuestionFilled />
              </el-icon>
            </el-tooltip>
          </div>
        </el-form-item>

        <el-form-item v-if="!isControlStep" label="容错与自愈">
          <div class="flex flex-col gap-1.5 w-full">
            <el-checkbox
              :model-value="Boolean(step.continueOnError)"
              @update:model-value="update('continueOnError', $event)"
            >
              忽略错误继续 (continueOnError)
            </el-checkbox>
            <el-checkbox
              :model-value="Boolean(step.resetHomeBefore)"
              @update:model-value="update('resetHomeBefore', $event)"
            >
              前置返回桌面 (resetHomeBefore)
            </el-checkbox>
          </div>
        </el-form-item>

        <el-form-item v-if="step.type !== 'end'" label="预期界面 Activity">
          <el-input
            :model-value="step.expectedActivity || ''"
            placeholder="可选: 校验包/Activity名 (如 .MainActivity)"
            @update:model-value="update('expectedActivity', $event)"
          />
        </el-form-item>

        <template v-if="step.type === 'tap'">
          <el-form-item :label="$t('automation.step.coordinates')">
            <div class="flex items-center gap-2 w-full">
              <el-input-number
                :model-value="step.x"
                class="flex-1 min-w-0"
                :controls="false"
                placeholder="X"
                @update:model-value="update('x', $event)"
              />
              <span class="text-gray-400 font-bold">,</span>
              <el-input-number
                :model-value="step.y"
                class="flex-1 min-w-0"
                :controls="false"
                placeholder="Y"
                @update:model-value="update('y', $event)"
              />
              <el-button type="primary" plain size="small" class="flex-none" @click="openPicker('tap')">
                {{ $t('automation.picker.screenshot') }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item :label="$t('automation.step.tapZone')">
            <div class="flex items-center gap-2 w-full">
              <div
                v-if="step.tapZone"
                class="flex-1 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900 rounded px-2 py-1 leading-relaxed"
              >
                {{ Math.abs(step.tapZone.x2 - step.tapZone.x1) }}×{{ Math.abs(step.tapZone.y2 - step.tapZone.y1) }}px
                &nbsp;·&nbsp;
                {{ $t('automation.picker.center') }} ({{ Math.round((step.tapZone.x1 + step.tapZone.x2) / 2) }}, {{ Math.round((step.tapZone.y1 + step.tapZone.y2) / 2) }})
              </div>
              <span v-else class="flex-1 text-xs text-gray-400">{{ $t('automation.step.tapZone.hint') }}</span>
              <el-button type="success" plain size="small" class="flex-none" @click="openPicker('tapZone')">
                {{ $t('automation.step.tapZone.draw') }}
              </el-button>
              <el-button v-if="step.tapZone" type="danger" plain size="small" class="flex-none" @click="update('tapZone', null)">
                {{ $t('automation.step.tapZone.clear') }}
              </el-button>
            </div>
          </el-form-item>
        </template>

        <template v-if="step.type === 'swipe'">
          <el-form-item :label="$t('automation.step.swipeStart')">
            <div class="flex items-center gap-2 w-full">
              <el-input-number
                :model-value="step.startX"
                class="flex-1 min-w-0"
                :controls="false"
                placeholder="X"
                @update:model-value="update('startX', $event)"
              />
              <span class="text-gray-400 font-bold">,</span>
              <el-input-number
                :model-value="step.startY"
                class="flex-1 min-w-0"
                :controls="false"
                placeholder="Y"
                @update:model-value="update('startY', $event)"
              />
              <el-button type="primary" plain size="small" class="flex-none" @click="openPicker('swipe')">
                {{ $t('automation.picker.screenshot') }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item :label="$t('automation.step.swipeEnd')">
            <div class="flex items-center gap-2 w-full">
              <el-input-number
                :model-value="step.endX"
                class="flex-1 min-w-0"
                :controls="false"
                placeholder="X"
                @update:model-value="update('endX', $event)"
              />
              <span class="text-gray-400 font-bold">,</span>
              <el-input-number
                :model-value="step.endY"
                class="flex-1 min-w-0"
                :controls="false"
                placeholder="Y"
                @update:model-value="update('endY', $event)"
              />
            </div>
          </el-form-item>
          <el-form-item :label="$t('automation.step.duration')">
            <div class="flex items-center gap-2 w-full">
              <el-input-number :model-value="step.duration" class="w-full" @update:model-value="update('duration', $event)" />
              <el-tooltip
                raw-content
                :content="$t('automation.step.duration.tip')"
                placement="top"
              >
                <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </div>
          </el-form-item>
        </template>

        <template v-if="step.type === 'input'">
          <el-form-item :label="$t('automation.step.text')">
            <el-input
              :model-value="step.text"
              type="textarea"
              :placeholder="$t('automation.step.input.placeholder')"
              @update:model-value="update('text', $event)"
            />
          </el-form-item>
        </template>

        <template v-if="step.type === 'wait'">
          <el-form-item :label="$t('automation.step.duration')">
            <div class="flex items-center gap-2 w-full">
              <el-input-number :model-value="step.duration" :min="0" :step="100" class="w-full" @update:model-value="update('duration', $event)" />
              <el-tooltip
                raw-content
                :content="$t('automation.step.duration.tip')"
                placement="top"
              >
                <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </div>
          </el-form-item>
        </template>

        <template v-if="step.type === 'key'">
          <el-form-item :label="$t('automation.step.key')">
            <el-select :model-value="step.key" class="w-full" filterable allow-create @update:model-value="update('key', $event)">
              <el-option v-for="item in keyOptions" :key="item.value" :label="$t(item.label)" :value="item.value" />
            </el-select>
          </el-form-item>
        </template>

        <template v-if="step.type === 'launch'">
          <el-form-item :label="$t('automation.step.launch.package')">
            <div class="flex gap-2 w-full">
              <el-input :model-value="step.package" class="flex-1" @update:model-value="update('package', $event)" />
              <AppSelector :device-id="deviceId" trigger="click" @change="(_, item) => update('package', item.packageName)">
                <template #default="{ loading }">
                  <el-button :loading="loading">
                    {{ $t('automation.step.launch.select') }}
                  </el-button>
                </template>
              </AppSelector>
            </div>
          </el-form-item>
          <el-form-item :label="$t('automation.step.launch.forceStop')">
            <el-switch :model-value="step.forceStop" @update:model-value="update('forceStop', $event)" />
          </el-form-item>
        </template>

        <template v-if="step.type === 'command'">
          <el-form-item :label="$t('automation.step.command')">
            <el-input
              :model-value="step.command"
              type="textarea"
              :placeholder="$t('automation.step.command.placeholder')"
              @update:model-value="update('command', $event)"
            />
            <div class="text-xs text-gray-400 mt-1">
              {{ $t('automation.step.command.hint') }}
            </div>
          </el-form-item>
        </template>

        <template v-if="step.type === 'install'">
          <el-form-item :label="$t('automation.step.install.apkPath')">
            <InputPath
              :model-value="step.apkPath"
              :placeholder="$t('automation.step.install.apkPath.placeholder')"
              :data="{
                properties: ['openFile'],
                filters: [{ name: 'APK', extensions: ['apk'] }],
              }"
              @update:model-value="update('apkPath', $event)"
            />
          </el-form-item>
          <el-form-item :label="$t('automation.step.launch.package')">
            <el-input :model-value="step.package" @update:model-value="update('package', $event)" />
          </el-form-item>
          <el-form-item :label="$t('automation.step.install.uninstallBefore')">
            <el-switch :model-value="step.uninstallBefore" @update:model-value="update('uninstallBefore', $event)" />
          </el-form-item>
        </template>

        <template v-if="step.type === 'screenshot'">
          <el-form-item :label="$t('automation.step.savePath')">
            <div class="flex items-center gap-2 w-full">
              <InputPath
                :model-value="step.savePath"
                :data="{ properties: ['openDirectory'] }"
                class="flex-1"
                @update:model-value="update('savePath', $event)"
              />
              <el-tooltip
                raw-content
                :content="$t('automation.step.savePath.tip')"
                placement="top"
              >
                <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </div>
          </el-form-item>
          <el-form-item :label="$t('automation.step.screenshot.auto')">
            <el-switch :model-value="step.auto" @update:model-value="update('auto', $event)" />
          </el-form-item>
        </template>

        <template v-if="step.type === 'record'">
          <el-form-item :label="$t('automation.step.record.duration')">
            <el-input-number :model-value="step.duration" :min="1" class="w-full" @update:model-value="update('duration', $event)" />
          </el-form-item>
          <el-form-item :label="$t('automation.step.savePath')">
            <div class="flex items-center gap-2 w-full">
              <InputPath
                :model-value="step.savePath"
                :data="{ properties: ['openDirectory'] }"
                class="flex-1"
                @update:model-value="update('savePath', $event)"
              />
              <el-tooltip
                raw-content
                :content="$t('automation.step.savePath.tip')"
                placement="top"
              >
                <el-icon class="text-gray-400 cursor-help text-lg flex-none">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </div>
          </el-form-item>
        </template>

        <template v-if="step.type === 'if'">
          <el-form-item :label="$t('automation.step.if.condition')">
            <el-select :model-value="step.condition" class="w-full" @update:model-value="update('condition', $event)">
              <el-option v-for="opt in ifConditionOptions" :key="opt.value" :label="$t(opt.label)" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="step.condition === 'imageFound'" :label="$t('automation.step.if.image')">
            <div class="flex items-center gap-2 w-full">
              <InputPath
                :model-value="step.imagePath"
                :data="{ properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }] }"
                class="flex-1"
                @update:model-value="update('imagePath', $event)"
              />
              <el-input-number
                :model-value="step.threshold ?? 0.85"
                :min="0.5"
                :max="1"
                :step="0.01"
                :precision="2"
                class="w-28"
                @update:model-value="update('threshold', $event)"
              />
            </div>
          </el-form-item>
          <el-form-item :label="$t('automation.step.if.negate')">
            <el-switch :model-value="step.negate" @update:model-value="update('negate', $event)" />
          </el-form-item>
        </template>

        <template v-if="step.type === 'loop'">
          <el-form-item :label="$t('automation.step.loop.iterations')">
            <el-input-number
              :model-value="step.iterations ?? 1"
              :min="1"
              class="w-full"
              @update:model-value="update('iterations', $event)"
            />
          </el-form-item>
          <el-form-item :label="$t('automation.step.loop.breakOnFail')">
            <el-switch :model-value="step.breakOnFail" @update:model-value="update('breakOnFail', $event)" />
          </el-form-item>
        </template>

        <template v-if="step.type === 'end'">
          <el-alert :title="$t('automation.step.end.hint')" type="info" :closable="false" />
        </template>

        <template v-if="step.type === 'findImage' || step.type === 'waitFor'">
          <el-form-item :label="$t('automation.step.if.image')">
            <div class="flex items-center gap-2 w-full">
              <InputPath
                :model-value="step.imagePath"
                :data="{ properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }] }"
                class="flex-1"
                @update:model-value="update('imagePath', $event)"
              />
              <el-input-number
                :model-value="step.threshold ?? 0.85"
                :min="0.5"
                :max="1"
                :step="0.01"
                :precision="2"
                class="w-28"
                @update:model-value="update('threshold', $event)"
              />
            </div>
          </el-form-item>
          <el-form-item v-if="step.type === 'waitFor'" :label="$t('automation.step.waitFor.timeout')">
            <el-input-number
              :model-value="step.timeout ?? 10000"
              :min="1000"
              :step="500"
              class="w-full"
              @update:model-value="update('timeout', $event)"
            />
          </el-form-item>
          <el-form-item v-if="step.type === 'waitFor'" :label="$t('automation.step.waitFor.pollInterval')">
            <el-input-number
              :model-value="step.pollInterval ?? 500"
              :min="100"
              :step="100"
              class="w-full"
              @update:model-value="update('pollInterval', $event)"
            />
          </el-form-item>
          <el-form-item v-if="step.type === 'waitFor'" :label="$t('automation.step.waitFor.notFound')">
            <el-select :model-value="step.notFound ?? 'fail'" class="w-full" @update:model-value="update('notFound', $event)">
              <el-option value="fail" :label="$t('automation.step.waitFor.notFound.fail')" />
              <el-option value="skip" :label="$t('automation.step.waitFor.notFound.skip')" />
            </el-select>
          </el-form-item>
        </template>
      </el-form>

      <CoordinatePicker
        v-if="pickerVisible"
        :device-id="deviceId"
        :mode="pickerMode"
        @close="pickerVisible = false"
        @confirm="handlePickerConfirm"
      />
    </div>
  </el-card>
</template>

<script setup>
import InputPath from '$/components/preference-form/components/input-path/index.vue'
import AppSelector from '$/components/app-selector/index.vue'
import { createDefaultStep, IF_CONDITION_OPTIONS, KEY_OPTIONS, STEP_GROUPS, STEP_TYPE_OPTIONS } from '$/utils/automation/step-types.js'
import CoordinatePicker from '../coordinate-picker/index.vue'

const props = defineProps({
  step: {
    type: Object,
    required: true,
  },
  deviceId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update', 'run-step'])

const pickerVisible = ref(false)
const pickerMode = ref('tap')
const keyOptions = KEY_OPTIONS
const ifConditionOptions = IF_CONDITION_OPTIONS
const isControlStep = computed(() => ['if', 'loop', 'end'].includes(props.step?.type))
const isRandomizableStep = computed(() => ['tap', 'swipe', 'wait'].includes(props.step?.type))

const stepGroups = computed(() => [
  {
    label: 'automation.step.group.basic',
    options: STEP_TYPE_OPTIONS.filter(item => STEP_GROUPS.basic.includes(item.value)),
  },
  {
    label: 'automation.step.group.extended',
    options: STEP_TYPE_OPTIONS.filter(item => STEP_GROUPS.extended.includes(item.value)),
  },
  {
    label: 'automation.step.group.control',
    options: STEP_TYPE_OPTIONS.filter(item => (STEP_GROUPS.control || []).includes(item.value)),
  },
  {
    label: 'automation.step.group.vision',
    options: STEP_TYPE_OPTIONS.filter(item => (STEP_GROUPS.vision || []).includes(item.value)),
  },
])

function update(key, value) {
  emit('update', { [key]: value })
}

function onTypeChange(type) {
  const defaults = createDefaultStep(type)
  emit('update', { ...defaults, id: props.step.id, name: props.step.name })
}

function openPicker(mode) {
  if (!props.deviceId) {
    ElMessage.warning(window.t('automation.run.noDevice'))
    return
  }
  pickerMode.value = mode
  pickerVisible.value = true
}

function handlePickerConfirm(result) {
  if (pickerMode.value === 'tap') {
    emit('update', { x: result.x, y: result.y })
  }
  else if (pickerMode.value === 'tapZone') {
    emit('update', { x: result.x, y: result.y, tapZone: result.tapZone })
  }
  else if (pickerMode.value === 'swipe') {
    emit('update', {
      startX: result.startX,
      startY: result.startY,
      endX: result.endX,
      endY: result.endY,
    })
  }
  pickerVisible.value = false
}
</script>

<style scoped>
:deep(.el-form-item) {
  margin-bottom: 8px !important;
}
</style>

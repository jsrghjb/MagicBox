<template>
  <div class="flex h-full gap-6">
    <!-- Left Sidebar: Settings Navigation Menu -->
    <div class="w-44 flex-none flex flex-col gap-1 pr-4 border-r border-gray-200/50 dark:border-gray-800/50 pt-2 select-none overflow-y-auto">
      <button
        v-for="item of tabsModel"
        :key="item.value"
        class="settings-sidebar-btn"
        :class="{ 'is-active': activeTab === item.value }"
        @click="onTabChange(item.value)"
      >
        <span class="truncate flex-1 text-sm font-medium">{{ $t(item.label) }}</span>
      </button>
    </div>

    <!-- Right Side: Scrollable Settings Forms -->
    <div class="flex-1 min-w-0 overflow-auto pr-2 relative">
      <el-form ref="elForm" :model="preferenceData" :label-width="$grid.lg ? '240px' : '140px'" class="">
        <el-collapse
          v-model="collapseValue"
          v-bind="{
            accordion: false,
            ...collapseProps,
          }"
          class="space-y-4 el-collapse--beautify"
        >
          <el-collapse-item
            v-for="(item, name) of preferenceModel"
            :key="name"
            :name="name"
            class="overflow-hidden min-w-0"
          >
            <template #title>
              <div
                :id="`preference-${name}`"
                v-intersection-observer="[onIntersectionObserver, { rootMargin: '0px 0px 0px 0px', threshold: 1 }]"
                class="flex items-center w-full text-left -mr-10 overflow-hidden"
              >
                <div class="flex-1 w-0 truncate pl-4 text-base">
                  {{ $t(item.label) }}
                </div>
                <div class="flex-none pl-4" @click.stop>
                  <el-button type="primary" text @click="handleReset(name)">
                    {{ $t('preferences.reset') }}
                  </el-button>
                </div>
              </div>
            </template>
            <div
              class="pt-4 min-w-0 max-w-full overflow-hidden box-border pr-4 md:pr-8"
              :class="{ 'pl-4': name === 'api' }"
            >
              <ApiManagement v-if="name === 'api'" />
              <el-row v-else :gutter="20">
                <el-col
                  v-for="(item_1, name_1) of subModel(item)"
                  :key="name_1"
                  :span="item_1.span || 12"
                  :lg="item_1.span || 12"
                  :offset="item_1.offset || 0"
                >
                  <el-form-item :label="$t(item_1.label)" :prop="item_1.field">
                    <template #label>
                      <div class="flex items-center">
                        <el-tooltip
                          v-if="item_1.tips"
                          popper-class="max-w-96"
                          effect="light"
                          :content="$t(item_1.tips)"
                          placement="bottom"
                        >
                          <el-link
                            class="mr-1 !text-base"
                            icon="InfoFilled"
                            type="warning"
                            underline="never"
                          >
                          </el-link>
                        </el-tooltip>
                        <div class="truncate max-w-[120px] lg:max-w-[220px]" :title="$t(item_1.label)">
                          {{ $t(item_1.label) }}
                        </div>
                      </div>
                    </template>

                    <component
                      :is="inputModel[item_1.type]"
                      v-model="preferenceData[item_1.field]"
                      v-bind="{
                        preferenceData,
                        deviceScope,
                        title: getTitle(item_1),
                        placeholder: $t(item_1.placeholder),
                        data: item_1,
                      }"
                    ></component>
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { vIntersectionObserver } from '@vueuse/components'

import { omit } from 'lodash-es'

import { inputModel } from './components/index.js'
import ApiManagement from '$/views/preference/components/api-management/index.vue'

import { sleep } from '$/utils/index.js'

const props = defineProps({
  deviceScope: {
    type: String,
    default: '',
  },
  collapseProps: {
    type: Object,
    default: () => ({}),
  },
  excludes: {
    type: Array,
    default: () => [],
  },
  reverse: {
    type: Boolean,
    default: false,
  },
})

const preferenceData = defineModel('modelValue', {
  type: Object,
  default: () => ({}),
})

const preferenceStore = usePreferenceStore()

const activeTab = ref('common')
const observerLock = ref(false)

const tabsModel = computed(() => {
  const value = Object.entries(preferenceStore.model).reduce((arr, [key, item]) => {
    if (!props.excludes.includes(key)) {
      arr.push({
        label: item.label,
        value: key,
      })
    }

    return arr
  }, [])

  return value
})

const collapseValue = ref([])

const preferenceModel = computed(() =>
  omit(preferenceStore.model, props.excludes),
)

const preferenceModelKeys = Object.keys(preferenceModel.value ?? {})

if (preferenceModelKeys.length) {
  collapseValue.value = preferenceModelKeys
}

function getTitle(item) {
  if (item.options?.length) {
    const currentOption = item.options.find(option => option.value === preferenceData.value[item.field])

    if (currentOption) {
      return window.t(currentOption.placeholder || currentOption.label)
    }
  }

  return window.t(item.placeholder || item.label)
}

async function onTabChange(val) {
  observerLock.value = true

  activeTab.value = val

  document.querySelector(`#preference-${val}`).scrollIntoView({
    block: 'start',
  })

  await sleep(500)

  observerLock.value = false
}

function subModel(item) {
  const children = item?.children || {}

  const value = {}

  Object.entries(children).forEach(([key, data]) => {
    const { hidden } = data

    let isVisible = !hidden

    if (Array.isArray(hidden) || typeof hidden === 'string') {
      isVisible = !hidden.includes(props.deviceScope)
    }

    if (isVisible) {
      value[key] = data
    }
  })

  return value
}

function handleReset(type) {
  preferenceData.value = {
    ...preferenceData.value,
    ...preferenceStore.getDefaultData(type),
  }
}

async function generateCommand() {
  const value = await preferenceStore.scrcpyParameter(preferenceData.value, {
    useRecord: true,
    useCamera: true,
    useOtg: true,
  })

  return value
}

function onIntersectionObserver([entry]) {
  if (observerLock.value) {
    return false
  }

  if (!entry.isIntersecting) {
    return false
  }

  const currentId = entry.target.id.replace('preference-', '')

  activeTab.value = currentId
}

defineExpose({
  generateCommand,
})
</script>

<style scoped lang="postcss">
:deep(.el-collapse-item__header) {
  @apply h-10 leading-10 md:h-12 md:leading-12;
}

:deep(.el-collapse-item__arrow) {
  @apply w-2em;
}
</style>

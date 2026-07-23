<template>
  <div class="absolute inset-0 h-full flex overflow-hidden">
    <!-- Left Sidebar Navigation Panel -->
    <div
      class="sidebar-panel relative flex-none flex flex-col bg-white/40 dark:bg-gray-900/40 border-r border-gray-200/50 dark:border-gray-800/50 backdrop-blur-xl select-none justify-between transition-all duration-250 ease-in-out overflow-visible"
      :class="[
        collapsed
          ? ($platform.is('macos') ? 'w-20 px-3 pb-2' : 'w-14 px-2 pb-2')
          : 'w-52 px-4 pb-4',
        $platform.is('macos') ? 'pt-14' : collapsed ? 'pt-2' : 'pt-4',
      ]"
    >
      <!-- Inner clip wrapper (clips content but not the toggle button) -->
      <div class="flex flex-col gap-4 overflow-hidden">
        <!-- Logo (expanded only) -->
        <div v-if="!collapsed" class="flex items-center gap-2.5 px-1 py-1">
          <img src="$electron/resources/build/logo.png" class="w-8 h-8 rounded-lg object-contain shadow-sm flex-none" alt="logo" />
          <span class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap flex-1">
            魔屏助手
          </span>
        </div>

        <!-- Vertical Menu Navigation -->
        <nav class="flex flex-col gap-1">
          <el-tooltip
            v-for="item of tabsModel"
            :key="item.value"
            :content="$t(item.label)"
            :disabled="!collapsed"
            placement="right"
            :show-arrow="false"
          >
            <button
              class="sidebar-nav-btn"
              :class="[
                { 'is-active': activeTab === item.value },
                { 'is-collapsed': collapsed },
              ]"
              @click="activeTab = item.value"
            >
              <i v-if="item.value === '/device'" class="i-solar-smartphone-line-duotone text-lg flex-none"></i>
              <i v-else-if="item.value === '/cluster'" class="i-solar-box-minimalistic-bold-duotone text-lg flex-none"></i>
              <i v-else-if="item.value === '/automation'" class="i-solar-code-circle-bold-duotone text-lg flex-none"></i>
              <i v-else-if="item.value === '/preference'" class="i-solar-settings-bold-duotone text-lg flex-none"></i>
              <i v-else-if="item.value === '/about'" class="i-solar-info-circle-bold-duotone text-lg flex-none"></i>
              <span
                class="truncate transition-all duration-250"
                :class="collapsed ? 'opacity-0 w-0 overflow-hidden' : 'flex-1'"
              >{{ $t(item.label) }}</span>
            </button>
          </el-tooltip>
        </nav>
      </div>

      <!-- Bottom: version (expanded only) -->
      <div v-if="!collapsed" class="text-center text-xs text-gray-400 py-2 overflow-hidden">
        v{{ version }}
      </div>

      <!-- Floating toggle button at sidebar right edge -->
      <button
        class="sidebar-toggle-btn app-region-no-drag"
        :title="collapsed ? '展开菜单' : '收起菜单'"
        @click.stop="toggleCollapse"
      >
        <i
          class="text-xs transition-transform duration-250"
          :class="collapsed ? 'i-solar-alt-arrow-right-bold' : 'i-solar-alt-arrow-left-bold'"
        ></i>
      </button>
    </div>

    <!-- Right Content Area -->
    <div class="flex-1 min-w-0 flex flex-col h-full bg-slate-50/50 dark:bg-gray-950/30">
      <AppHeader class="flex-none !pl-6 !pr-4 pt-3 pb-2 gap-4">
        <template #default>
          <div class="text-base font-bold text-gray-800 dark:text-gray-200 select-none">
            {{ $t(getPageTitleKey(activeTab)) }}
          </div>
        </template>
        <template #right>
          <QuickBar />
        </template>
      </AppHeader>

      <!-- Main Viewport -->
      <div class="flex-1 min-h-0 p-4 overflow-auto">
        <RouterView v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </RouterView>
      </div>
    </div>
  </div>
</template>

<script setup>
import { version } from '/package.json'
import AppHeader from '$/components/app-header/index.vue'
import QuickBar from '$/components/quick-bar/index.vue'

const router = useRouter()
const route = useRoute()

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true')

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}

const tabsModel = [
  { label: 'device.list', value: '/device' },
  { label: 'cluster.gridView', value: '/cluster' },
  { label: 'automation.menu', value: '/automation' },
  { label: 'preferences.name', value: '/preference' },
  { label: 'about.name', value: '/about' },
]

function getPageTitleKey(path) {
  const tab = tabsModel.find(item => item.value === path)
  return tab ? tab.label : ''
}

function normalizeTabPath(path) {
  if (!path || path === '/')
    return path
  return path.replace(/\/+$/, '')
}

const activeTab = computed({
  get() { return normalizeTabPath(route.path) },
  set(value) { router.push(value) },
})

provide('activeTab', activeTab)
</script>

<style lang="postcss" scoped>
/* Floating toggle button — sits exactly on the right border of the sidebar */
.sidebar-toggle-btn {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 50;

  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;

  opacity: 0;
  transition:
    opacity 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.sidebar-panel:hover .sidebar-toggle-btn {
  opacity: 1;
}

.sidebar-toggle-btn:hover {
  color: #4f46e5;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
}

html.dark .sidebar-toggle-btn {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

html.dark .sidebar-toggle-btn:hover {
  color: #818cf8;
  box-shadow: 0 2px 8px rgba(129, 140, 248, 0.25);
}
</style>

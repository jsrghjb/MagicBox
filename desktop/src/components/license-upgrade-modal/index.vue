<template>
  <el-dialog
    v-model="visible"
    title="🚀 升级解封专业自动化特权"
    width="680px"
    append-to-body
    destroy-on-close
    class="license-upgrade-modal"
    @close="handleClose"
  >
    <div class="space-y-4">
      <!-- 提示语钩子 -->
      <div v-if="licenseStore.upgradeTargetCategory" class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-lg p-3 flex items-center gap-3">
        <i class="i-bi-lock-fill text-xl text-amber-500 flex-none"></i>
        <div class="text-sm text-amber-800 dark:text-amber-200 flex-1">
          当前专区 <b>【{{ getCategoryName(licenseStore.upgradeTargetCategory) }}】</b> 为专业版本特权，激活即可解锁全量自动化脚本与矩阵配额。
        </div>
      </div>

      <!-- 机器码展示与复制 -->
      <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg text-xs">
        <span class="text-gray-500">当前设备机器码 (Machine ID): <code class="font-mono text-gray-800 dark:text-gray-200">{{ licenseStore.machineId || '读取中...' }}</code></span>
        <el-button size="small" text type="primary" class="!p-0" @click="copyMachineId">
          <i class="i-bi-clipboard mr-1"></i>复制机器码
        </el-button>
      </div>

      <!-- 周期切换器 (放在版本卡片上方) -->
      <div class="flex justify-center py-1">
        <el-radio-group v-model="selectedPeriod" size="default">
          <el-radio-button value="monthly">月付</el-radio-button>
          <el-radio-button value="quarterly">季付 (省15%)</el-radio-button>
          <el-radio-button value="yearly">年付 (省35%最划算)</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 套餐卡片选择 (3 级对比) -->
      <div class="grid grid-cols-3 gap-3 pt-1">
        <!-- 免费版 -->
        <div
          class="border rounded-xl p-3.5 flex flex-col justify-between transition-all relative"
          :class="licenseStore.isFree ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-900/10 ring-2 ring-emerald-500/20' : 'border-gray-200 dark:border-gray-700 opacity-75'"
        >
          <div v-if="licenseStore.isFree" class="absolute -top-2.5 right-3 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ✓ 当前使用中
          </div>
          <div>
            <div class="text-xs text-gray-500 font-bold mb-1">🆓 免费体验版</div>
            <div class="text-2xl font-extrabold text-gray-800 dark:text-gray-100">￥0</div>
            <div class="text-[11px] text-gray-400 mt-2 space-y-1.5">
              <div>✓ 连控 <b>2 台</b> 设备</div>
              <div>✓ 仅限通用基础脚本</div>
              <div>✕ 无社交专区解封</div>
            </div>
          </div>
          <el-button v-if="licenseStore.isFree" disabled size="small" class="w-full mt-3 font-bold !bg-emerald-500/10 !text-emerald-600 !border-emerald-200">
            当前版本
          </el-button>
          <el-button v-else size="small" type="info" plain class="w-full mt-3" @click.stop="handleDeactivate">
            解绑恢复免费版
          </el-button>
        </div>

        <!-- 个人版 -->
        <div
          class="border rounded-xl p-3.5 flex flex-col justify-between transition-all cursor-pointer relative shadow-sm"
          :class="licenseStore.isPersonal ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-900/10 ring-2 ring-primary-500/20' : selectedTier === 'personal' ? 'border-primary-500/60 ring-1 ring-primary-500/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'"
          @click="selectedTier = 'personal'"
        >
          <div v-if="licenseStore.isPersonal" class="absolute -top-2.5 right-3 bg-primary-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ✓ 当前版本 (已激活)
          </div>
          <div>
            <div class="text-xs text-primary-600 font-bold mb-1">👤 个人专业版</div>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-extrabold text-primary-600">￥{{ selectedPeriod === 'monthly' ? '49' : selectedPeriod === 'quarterly' ? '129' : '399' }}</span>
              <span class="text-[10px] text-gray-400">/{{ selectedPeriod === 'monthly' ? '月' : selectedPeriod === 'quarterly' ? '季' : '年' }}</span>
            </div>
            <div class="text-[11px] text-gray-600 dark:text-gray-300 mt-2 space-y-1.5">
              <div>✓ 支持 <b>10 台</b> 设备连控</div>
              <div>✓ 支持 <b>2 个</b> 社交专区</div>
              <div>✓ 最多 3 个自定义分类</div>
            </div>
          </div>
          <el-button v-if="licenseStore.isPersonal" disabled size="small" type="primary" class="w-full mt-3 font-bold">
            ✓ 当前激活中
          </el-button>
          <el-button v-else-if="licenseStore.isTeam" disabled size="small" class="w-full mt-3">
            已包含在团队版中
          </el-button>
          <el-button v-else type="primary" plain size="small" class="w-full mt-3" @click.stop="handleSelectBuy('personal')">
            选择购买 / 升级
          </el-button>
        </div>

        <!-- 团队版 (推荐) -->
        <div
          class="border rounded-xl p-3.5 flex flex-col justify-between transition-all cursor-pointer relative bg-gradient-to-b from-amber-500/10 to-transparent shadow-sm"
          :class="licenseStore.isTeam ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-900/10 ring-2 ring-amber-500/20' : selectedTier === 'team' ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-amber-200 dark:border-amber-800/50 hover:border-amber-400'"
          @click="selectedTier = 'team'"
        >
          <div v-if="licenseStore.isTeam" class="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ✓ 当前版本 (最高特权)
          </div>
          <div v-else class="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            🔥 强烈推荐
          </div>
          <div>
            <div class="text-xs text-amber-600 font-bold mb-1">👥 团队旗舰版</div>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-extrabold text-amber-600">￥{{ selectedPeriod === 'monthly' ? '149' : selectedPeriod === 'quarterly' ? '399' : '1199' }}</span>
              <span class="text-[10px] text-gray-400">/{{ selectedPeriod === 'monthly' ? '月' : selectedPeriod === 'quarterly' ? '季' : '年' }}</span>
            </div>
            <div class="text-[11px] text-gray-600 dark:text-gray-300 mt-2 space-y-1.5">
              <div>✓ 支持 <b>50 台</b> 无限群控</div>
              <div>✓ <b>全平台专区</b> 无限解锁</div>
              <div>✓ 无限自定义分类</div>
            </div>
          </div>
          <el-button v-if="licenseStore.isTeam" disabled type="warning" size="small" class="w-full mt-3 font-bold">
            ✓ 当前激活中 (全功能)
          </el-button>
          <el-button v-else type="warning" size="small" class="w-full mt-3" @click.stop="handleSelectBuy('team')">
            立即升级
          </el-button>
        </div>
      </div>

      <!-- 扫码无缝激活 / 手动输入激活码面板 -->
      <div class="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700/50 space-y-3">
        <div class="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between">
          <span>扫码订购或输入激活码</span>
          <span class="text-[10px] text-gray-400 font-normal">支持微信/支付宝扫码，支付成功即刻自动激活</span>
        </div>

        <div class="flex gap-2 items-center">
          <el-input
            v-model="inputKey"
            placeholder="粘贴卡密激活码 (如: TEAM261231XXXXXX)"
            clearable
            class="flex-1"
            size="default"
            @keyup.enter="handleActivate"
          />
          <el-button
            type="primary"
            size="default"
            :loading="activating"
            @click="handleActivate"
          >
            一键激活
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLicenseStore } from '$/store/license/index.js'

const licenseStore = useLicenseStore()

const selectedTier = ref('team')
const selectedPeriod = ref('yearly')
const inputKey = ref('')
const activating = ref(false)

const visible = computed({
  get: () => licenseStore.upgradeModalVisible,
  set: (val) => {
    if (!val) {
      licenseStore.closeUpgradeModal()
    }
  },
})

const categoryNames = {
  xiaohongshu: '小红书专区',
  douyin: '抖音 / TikTok 专区',
  wechat: '微信 / 视频号专区',
  ecommerce: '跨境电商专区',
  custom: '自定义分类',
}

function getCategoryName(cat) {
  return categoryNames[cat] || cat || '专业特权'
}

function copyMachineId() {
  if (licenseStore.machineId) {
    navigator.clipboard.writeText(licenseStore.machineId)
    ElMessage.success('机器码已成功复制到剪贴板')
  }
}

async function handleDeactivate() {
  const res = await licenseStore.deactivateKey()
  if (res?.success) {
    ElMessage.success('已解绑现有卡密，成功恢复为免费体验版！')
  }
}

function handleSelectBuy(tier) {
  selectedTier.value = tier
  const planName = tier === 'team' ? '团队旗舰版' : '个人专业版'

  ElMessageBox.confirm(
    `已为您调起 ${planName} 扫码支付交互。是否直接模拟完成支付，自动生成专属卡密激活码并激活服务？`,
    '扫码支付确认',
    {
      confirmButtonText: '模拟支付成功',
      cancelButtonText: '打开独立收银台',
      distinguishCancelAndClose: true,
      type: 'info',
    },
  ).then(async () => {
    activating.value = true
    try {
      const res = await window.$preload.ipcRenderer.invoke('license:mock-pay', { tier })
      if (res?.success) {
        ElMessage.success(`🎉 支付成功！已自动生成专属卡密并激活【${planName}】！\n生成的激活码为：${res.licenseKey}`)
        await licenseStore.fetchStatus()
        licenseStore.closeUpgradeModal()
      }
      else {
        ElMessage.error(res?.error || '支付模拟失败')
      }
    }
    catch (e) {
      ElMessage.error(`支付模拟失败：${e.message || String(e)}`)
    }
    finally {
      activating.value = false
    }
  }).catch((action) => {
    if (action === 'cancel') {
      const mid = encodeURIComponent(licenseStore.machineId || '')
      const url = `https://checkout.escrcpy.com/pay?tier=${tier}&period=${selectedPeriod.value}&mid=${mid}`
      window.open(url, '_blank')
    }
  })
}

async function handleActivate() {
  if (!inputKey.value.trim()) {
    ElMessage.warning('请输入激活码')
    return
  }

  activating.value = true
  try {
    const res = await licenseStore.activateKey(inputKey.value.trim())
    if (res?.success) {
      ElMessage.success('🎉 激活成功！已解锁专业自动化特权')
      inputKey.value = ''
      licenseStore.closeUpgradeModal()
    }
    else {
      ElMessage.error(res?.error || '激活失败，请检查激活码与机器码')
    }
  }
  catch (err) {
    ElMessage.error(err?.message || '激活过程发生错误')
  }
  finally {
    activating.value = false
  }
}

async function handleMockActivate(key) {
  inputKey.value = key
  await handleActivate()
}

onMounted(() => {
  licenseStore.fetchStatus()

  // Deep Link auto-activation listener
  if (window.$preload?.ipcRenderer) {
    window.$preload.ipcRenderer.on('license:onActivated', (event, data) => {
      if (data?.token) {
        inputKey.value = data.token
        handleActivate()
      }
    })
  }
})

function handleClose() {
  licenseStore.closeUpgradeModal()
}
</script>

<style scoped>
.license-upgrade-modal :deep(.el-dialog__body) {
  padding-top: 10px;
}
</style>

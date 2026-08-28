import { createDefaultStep } from './step-types.js'

function step(type, overrides = {}) {
  return {
    ...createDefaultStep(type),
    ...overrides,
  }
}

// 模板的可翻译字段统一使用 i18n key：
//   automation.template.<template_id>.name
//   automation.template.<template_id>.description
//   automation.template.<template_id>.step.<step_key>
// 渲染层（step-list / template-selector）通过 tMaybe() 辅助函数：
//   - 若以 'automation.' 开头则视为 i18n key 走 $t()
//   - 否则按普通字符串直接展示，兼容老脚本

export const AUTOMATION_TEMPLATES = [
  {
    id: 'xiaohongshu_browse',
    name: 'automation.template.xhs_browse.name',
    category: 'general',
    description: 'automation.template.xhs_browse.description',
    buildSteps() {
      return [
        step('launch', { name: 'automation.template.xhs_browse.step.launch', package: 'com.xingin.xhs' }),
        step('wait', { name: 'automation.template.xhs_browse.step.wait_load', duration: 3000 }),
        step('ui_tap', {
          name: 'automation.template.xhs_browse.step.skip_dialog',
          matchType: 'textContains',
          matchValue: '我知道了',
          optional: true,
          timeout: 2000,
        }),

        // 🔁 循环浏览：3 次拟人化上滑 + 随机停留阅读
        // randomRange 保证每次滑动轨迹不同，run 间的微小差异足以让风控检测通过
        // 需要调整次数时直接编辑 loop 步骤的 iterations 字段
        step('loop', {
          name: 'automation.template.xhs_browse.step.loop_browse',
          iterations: 3,
          breakOnFail: false,
        }),
        step('swipe', {
          name: 'automation.template.xhs_browse.step.swipe_1',
          startXPercent: 0.52,
          startYPercent: 0.78,
          endXPercent: 0.48,
          endYPercent: 0.22,
          duration: 500,
          randomRange: 3,
        }),
        step('wait', { name: 'automation.template.xhs_browse.step.read', duration: 3000, randomRange: 2 }),
        step('end', { name: 'automation.template.xhs_browse.step.end_loop' }),
      ]
    },
  },
  {
    id: 'xiaohongshu_publish_api',
    name: 'automation.template.xhs_publish_api.name',
    category: 'general',
    description: 'automation.template.xhs_publish_api.description',
    vars: {
      'api.title': '终于整理出来了！夏季日常显瘦穿搭精选 ✨',
      'api.content': '今天跟姐妹们分享几套近期私藏的显瘦穿搭，面料舒适透气，细节设计很戳人！喜欢的宝子们赶紧点赞收藏起来吧～',
      'api.tags': '#穿搭分享 #OOTD #夏日穿搭 #显瘦穿搭 #女生日常',
      'api.imageCount': '2',
    },

    buildSteps() {
      return [
        step('launch', { name: 'automation.template.xhs_publish_api.step.launch', package: 'com.xingin.xhs' }),
        step('wait', { name: 'automation.template.xhs_publish_api.step.wait_load', duration: 2500 }),

        // 🛡️ 智能弹窗自愈过滤器
        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.skip_dialog',
          matchType: 'textContains',
          matchValue: '我知道了',
          optional: true,
          timeout: 2000,
        }),
        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.skip_permission',
          matchType: 'textContains',
          matchValue: '暂不',
          optional: true,
          timeout: 2000,
        }),

        // 🌿 拟人化浏览预热（防封控与行为轨迹自然化）
        step('swipe', {
          name: 'automation.template.xhs_publish_api.step.swipe_warmup',
          startXPercent: 0.52,
          startYPercent: 0.76,
          endXPercent: 0.48,
          endYPercent: 0.26,
          duration: 480,
          randomRange: 3,
        }),
        step('wait', { name: 'automation.template.xhs_publish_api.step.read_warmup', duration: 2500, randomRange: 2 }),

        // 📦 准备物料：提取接口图文并注入相册
        step('fetch_material', {
          name: 'automation.template.xhs_publish_api.step.fetch_material',
          apiId: 'demo_xhs_lifestyle',
          strategy: 'sequential',
          autoPushMedia: true,
          cleanPushedMediaAfter: true,
          targetVarPrefix: 'api',
        }),
        step('wait', { name: 'automation.template.xhs_publish_api.step.wait_media_refresh', duration: 3500 }),

        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.tap_publish',
          matchType: 'descContains',
          matchValue: '发布',
          timeout: 15000,
        }),

        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.tap_album_picker',
          matchType: 'textContains',
          matchValue: '从相册选择',
          optional: true,
          timeout: 5000,
        }),
        step('ui_select_media', {
          name: 'automation.template.xhs_publish_api.step.select_media',
          maxCount: '{{api.imageCount}}',
          multiSelectToggleText: '多选',
          timeout: 15000,
        }),

        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.tap_next',
          matchType: 'text',
          matchValue: '下一步',
          timeout: 15000,
        }),
        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.tap_next_filter',
          matchType: 'text',
          matchValue: '下一步',
          optional: true,
          timeout: 5000,
        }),
        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.input_title',
          matchType: 'textContains',
          matchValue: '标题',
          action: 'input',
          textToInput: '{{api.title}}',
          timeout: 15000,
        }),
        step('wait', { name: 'automation.template.xhs_publish_api.step.pause_after_title', duration: 800 }),
        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.input_content',
          matchType: 'textContains',
          matchValue: '正文',
          action: 'input',
          textToInput: '{{api.content}} {{api.tags}}',
          timeout: 15000,
        }),

        step('wait', { name: 'automation.template.xhs_publish_api.step.confirm_input', duration: 1200 }),
        step('ui_tap', {
          name: 'automation.template.xhs_publish_api.step.submit',
          matchType: 'textContains',
          matchValue: '发笔记',
          timeout: 15000,
        }),

        step('wait', { name: 'automation.template.xhs_publish_api.step.wait_upload', duration: 5000 }),
      ]
    },
  },
  {
    id: 'xiaohongshu_like',
    name: 'automation.template.xhs_like.name',
    category: 'general',
    description: 'automation.template.xhs_like.description',
    vars: {
      searchKeyword: '数码好物推荐',
    },
    buildSteps() {
      return [
        step('launch', { name: 'automation.template.xhs_like.step.launch', package: 'com.xingin.xhs' }),
        step('wait', { name: 'automation.template.xhs_like.step.wait_load', duration: 3500 }),
        step('ui_tap', {
          name: 'automation.template.xhs_like.step.skip_dialog',
          matchType: 'textContains',
          matchValue: '我知道了',
          optional: true,
          timeout: 2000,
        }),

        // 🔁 循环 3 次：上滑 → 阅读 → 双击点赞 → 冷却
        // 需要调整次数时直接编辑 loop 步骤的 iterations 字段
        step('loop', {
          name: 'automation.template.xhs_like.step.loop_browse',
          iterations: 3,
          breakOnFail: false,
        }),
        step('swipe', {
          name: 'automation.template.xhs_like.step.swipe_1',
          startXPercent: 0.5,
          startYPercent: 0.8,
          endXPercent: 0.5,
          endYPercent: 0.2,
          duration: 400,
          randomRange: 3,
        }),
        step('wait', { name: 'automation.template.xhs_like.step.read', duration: 2500, randomRange: 2 }),
        step('tap', {
          name: 'automation.template.xhs_like.step.double_tap_like',
          x: 540,
          y: 1000,
          randomRange: 4,
        }),
        step('wait', { name: 'automation.template.xhs_like.step.cool_down', duration: 1500 }),
        step('end', { name: 'automation.template.xhs_like.step.end_loop' }),

        step('screenshot', { name: 'automation.template.xhs_like.step.screenshot', auto: true }),
      ]
    },
  },
]

export const TEMPLATE_REFERENCE_WIDTH = 1080
export const TEMPLATE_REFERENCE_HEIGHT = 1920

export function buildTemplateSteps(templateId) {
  const template = AUTOMATION_TEMPLATES.find(item => item.id === templateId)
  if (!template) {
    return { steps: [], vars: {}, referenceScreenWidth: TEMPLATE_REFERENCE_WIDTH, referenceScreenHeight: TEMPLATE_REFERENCE_HEIGHT }
  }

  return {
    steps: template.buildSteps(),
    vars: { ...template.vars },
    category: template.category || 'general',
    referenceScreenWidth: TEMPLATE_REFERENCE_WIDTH,
    referenceScreenHeight: TEMPLATE_REFERENCE_HEIGHT,
  }
}

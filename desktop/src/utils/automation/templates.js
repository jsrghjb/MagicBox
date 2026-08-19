import { createDefaultStep } from './step-types.js'

function step(type, overrides = {}) {
  return {
    ...createDefaultStep(type),
    ...overrides,
  }
}

export const AUTOMATION_TEMPLATES = [
  {
    id: 'general_basic',
    name: '通用基础 - 应用启动与截图',
    category: 'general',
    description: '适用于通用安卓应用的模拟启动、等待与截图留存。',
    vars: {},
    buildSteps() {
      return [
        step('key', { name: '返回桌面 Home', key: '3' }),
        step('wait', { name: '等待应用准备', duration: 1500 }),
        step('screenshot', { name: '截屏留存记录', auto: true }),
      ]
    },
  },
  {
    id: 'xiaohongshu_publish_api',
    name: '📕 小红书 - 接口物料全自动发布图文笔记',
    category: 'general',
    description: '通过配置的外部接口自动获取图文，下载图片并注入相册，自动打开小红书选图并填入标题正文完成发布。',
    vars: {},
    buildSteps() {
      return [
        step('fetch_material', {
          name: '📦 提取接口图文并注入相册',
          apiId: 'demo_xhs_lifestyle',
          strategy: 'sequential',
          autoPushMedia: true,
          targetVarPrefix: 'api',
        }),
        step('wait', { name: '等待相册媒体库刷新', duration: 1500 }),
        step('launch', { name: '🚀 启动小红书 App', package: 'com.xingin.xhs' }),
        step('wait', { name: '等待小红书首页加载', duration: 3500 }),
        step('tap', { name: '👆 点击底部「➕」发布按钮', x: 540, y: 1850 }),
        step('wait', { name: '等待相册选择器打开', duration: 2000 }),
        step('tap', { name: '👆 选中相册第 1 张刚注入的图片', x: 320, y: 480 }),
        step('wait', { name: '等待选中生效', duration: 1000 }),
        step('tap', { name: '👆 点击右下角「下一步」', x: 920, y: 1820 }),
        step('wait', { name: '等待进入图片滤镜编辑页', duration: 2000 }),
        step('tap', { name: '👆 点击右上角「下一步」', x: 960, y: 120 }),
        step('wait', { name: '等待进入文案填写发布页', duration: 2000 }),
        step('tap', { name: '👆 点击「填写标题」输入框', x: 300, y: 420 }),
        step('wait', { name: '等待光标聚焦', duration: 800 }),
        step('input', { name: '✍️ 输入接口提取的标题', text: '{{api.title}}' }),
        step('wait', { name: '标题输入完成等待', duration: 1000 }),
        step('tap', { name: '👆 点击「添加正文描述」区域', x: 300, y: 600 }),
        step('wait', { name: '等待正文光标聚焦', duration: 800 }),
        step('input', { name: '✍️ 输入接口提取的正文与话题', text: '{{api.content}} {{api.tags}}' }),
        step('wait', { name: '等待文案输入完成', duration: 1500 }),
        step('tap', { name: '🚀 点击底部「发布笔记」大红按钮', x: 540, y: 1820 }),
        step('wait', { name: '等待笔记上传发布完毕', duration: 5000 }),
      ]
    },
  },
  {
    id: 'xiaohongshu_like',
    name: '📕 小红书 - 自动刷笔记与点赞',
    category: 'general',
    description: '自动启动小红书 App，浏览推荐页笔记并双击点赞互动。',
    vars: {
      searchKeyword: '数码好物推荐',
    },
    buildSteps() {
      return [
        step('launch', { name: '启动小红书 App', package: 'com.xingin.xhs' }),
        step('wait', { name: '等待小红书加载', duration: 3500 }),
        step('swipe', { name: '向上滑动浏览笔记', startX: 500, startY: 1600, endX: 500, endY: 400, duration: 300 }),
        step('wait', { name: '停留阅读内容', duration: 2500 }),
        step('tap', { name: '双击笔记点赞 (爱心)', x: 500, y: 1000 }),
        step('wait', { name: '点赞冷却等待', duration: 1500 }),
        step('swipe', { name: '继续滑动下条笔记', startX: 500, startY: 1600, endX: 500, endY: 400, duration: 300 }),
        step('screenshot', { name: '交互完成截图', auto: true }),
      ]
    },
  },
  {
    id: 'douyin_interact',
    name: '🎵 抖音/TikTok - 短视频自动浏览与双击',
    category: 'general',
    description: '自动启动抖音 App，循环刷推荐视频并双击点赞加关注。',
    vars: {
      watchDuration: '3000',
    },
    buildSteps() {
      return [
        step('launch', { name: '启动抖音 App', package: 'com.ss.android.ugc.aweme' }),
        step('wait', { name: '等待视频播放', duration: 3500 }),
        step('tap', { name: '屏幕中央双击点赞', x: 500, y: 1000 }),
        step('wait', { name: '观看视频 3 秒', duration: 3000 }),
        step('swipe', { name: '向上上滑切换下一条视频', startX: 500, startY: 1500, endX: 500, endY: 300, duration: 250 }),
        step('wait', { name: '观看下条视频', duration: 3000 }),
        step('screenshot', { name: '自动保存截图', auto: true }),
      ]
    },
  },
  {
    id: 'wechat_channels',
    name: '💬 微信/视频号 - 视频号养号与搜索',
    category: 'general',
    description: '自动调起微信客户端，搜索助手或浏览视频号专区。',
    vars: {
      searchText: '文件传输助手',
      message: 'Escrcpy 自动自动化测试消息',
    },
    buildSteps() {
      return [
        step('launch', { name: '启动微信 App', package: 'com.tencent.mm' }),
        step('wait', { name: '等待微信主界面', duration: 3000 }),
        step('tap', { name: '点击顶部搜索图标', x: 900, y: 120 }),
        step('input', { name: '输入目标内容', text: '{searchText}' }),
        step('wait', { name: '等待搜索结果', duration: 1500 }),
        step('tap', { name: '点击第一项结果', x: 500, y: 280 }),
        step('tap', { name: '点击消息输入框', x: 500, y: 2100 }),
        step('input', { name: '输入测试消息', text: '{message}' }),
        step('tap', { name: '点击发送按钮', x: 980, y: 2100 }),
        step('screenshot', { name: '发送完成保存截图', auto: true }),
      ]
    },
  },
  {
    id: 'ecommerce_shop',
    name: '🛒 跨境电商 - 自动搜索与商品浏览',
    category: 'general',
    description: '自动在跨境电商客户端中搜索热门商品并模拟加购。',
    vars: {
      keyword: 'Wireless Earbuds',
    },
    buildSteps() {
      return [
        step('launch', { name: '启动跨境购物 App', package: 'com.amazon.mShop.android.shopping' }),
        step('wait', { name: '等待商城首页加载', duration: 4000 }),
        step('tap', { name: '点击搜索栏', x: 500, y: 150 }),
        step('input', { name: '输入商品关键字', text: '{keyword}' }),
        step('wait', { name: '等待商品列表展示', duration: 2000 }),
        step('swipe', { name: '下滑浏览热门商品', startX: 500, startY: 1500, endX: 500, endY: 500, duration: 400 }),
        step('screenshot', { name: '商品展示截图记录', auto: true }),
      ]
    },
  },
  {
    id: 'custom_matrix',
    name: '⚙️ 自定义 - 矩阵群控通用作业模板',
    category: 'general',
    description: '适用于多机矩阵自动化作业的灵活自定义流程。',
    vars: {},
    buildSteps() {
      return [
        step('key', { name: 'Home 键', key: '3' }),
        step('wait', { name: '等待 1 秒', duration: 1000 }),
        step('swipe', { name: '翻页滑动', startX: 800, startY: 1000, endX: 200, endY: 1000, duration: 300 }),
        step('screenshot', { name: '执行记录', auto: true }),
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

import { nanoid } from 'nanoid'

export const STEP_GROUPS = {
  basic: ['tap', 'swipe', 'input', 'wait', 'key'],
  data: ['fetch_material'],
  extended: ['launch', 'command', 'install', 'screenshot', 'record'],
  control: ['if', 'loop', 'end'],
  vision: ['findImage', 'waitFor'],
}

export const STEP_TYPE_OPTIONS = [
  { value: 'tap', label: 'automation.step.tap', group: 'basic' },
  { value: 'swipe', label: 'automation.step.swipe', group: 'basic' },
  { value: 'input', label: 'automation.step.input', group: 'basic' },
  { value: 'wait', label: 'automation.step.wait', group: 'basic' },
  { value: 'key', label: 'automation.step.key', group: 'basic' },
  { value: 'fetch_material', label: 'automation.step.fetch_material', group: 'data' },
  { value: 'launch', label: 'automation.step.launch', group: 'extended' },
  { value: 'command', label: 'automation.step.command', group: 'extended' },
  { value: 'install', label: 'automation.step.install', group: 'extended' },
  { value: 'screenshot', label: 'automation.step.screenshot', group: 'extended' },
  { value: 'record', label: 'automation.step.record', group: 'extended' },
  { value: 'if', label: 'automation.step.if', group: 'control' },
  { value: 'loop', label: 'automation.step.loop', group: 'control' },
  { value: 'end', label: 'automation.step.end', group: 'control' },
  { value: 'findImage', label: 'automation.step.findImage', group: 'vision' },
  { value: 'waitFor', label: 'automation.step.waitFor', group: 'vision' },
]

export const STEP_TYPE_FALLBACKS = {
  'automation.step.tap': '点击',
  'automation.step.swipe': '滑动',
  'automation.step.input': '输入',
  'automation.step.wait': '等待',
  'automation.step.key': '按键',
  'automation.step.fetch_material': '获取接口图文',
  'automation.step.launch': '启动应用',
  'automation.step.command': '执行命令',
  'automation.step.install': '安装应用',
  'automation.step.screenshot': '屏幕截图',
  'automation.step.record': '录制屏幕',
  'automation.step.if': '条件判断 (If)',
  'automation.step.loop': '循环执行 (Loop)',
  'automation.step.end': '结束 (End)',
  'automation.step.findImage': '找图点击',
  'automation.step.waitFor': '等待画面',
  'automation.step.group.basic': '基础操作',
  'automation.step.group.data': '数据与物料',
  'automation.step.group.extended': '扩展操作',
  'automation.step.group.control': '控制流',
  'automation.step.group.vision': '图像识别',
}

export function getStepTypeLabel(key) {
  if (!key) {
    return ''
  }
  const val = window.t ? window.t(key) : key
  if (val && val !== key) {
    return val
  }
  return STEP_TYPE_FALLBACKS[key] || key
}

export const KEY_OPTIONS = [
  { value: '3', label: 'automation.keys.home' },
  { value: '4', label: 'automation.keys.back' },
  { value: '187', label: 'automation.keys.menu' },
  { value: '26', label: 'automation.keys.power' },
  { value: '24', label: 'automation.keys.volumeUp' },
  { value: '25', label: 'automation.keys.volumeDown' },
  { value: '66', label: 'automation.keys.enter' },
  { value: '67', label: 'automation.keys.delete' },
  { value: '187', label: 'automation.keys.recentApps' },
]

export const IF_CONDITION_OPTIONS = [
  { value: 'imageFound', label: 'automation.step.if.imageFound' },
  { value: 'always', label: 'automation.step.if.always' },
  { value: 'never', label: 'automation.step.if.never' },
]

export function createDefaultStep(type = 'tap') {
  const isRandomizable = type === 'tap' || type === 'swipe'
  const base = {
    id: nanoid(),
    type,
    name: '',
    delayBefore: 0,
    loopCount: 1,
    randomRange: isRandomizable ? 2 : 0,
  }

  switch (type) {
    case 'tap':
      return { ...base, x: 0, y: 0 }
    case 'swipe':
      return { ...base, startX: 0, startY: 0, endX: 0, endY: 0, duration: 300 }
    case 'input':
      return { ...base, text: '' }
    case 'wait':
      return { ...base, duration: 1000 }
    case 'key':
      return { ...base, key: '4' }
    case 'launch':
      return { ...base, package: '', forceStop: false }
    case 'command':
      return { ...base, command: '' }
    case 'install':
      return { ...base, apkPath: '', package: '', uninstallBefore: false }
    case 'screenshot':
      return { ...base, savePath: '', auto: true }
    case 'record':
      return { ...base, duration: 10, savePath: '', source: 'screen' }
    case 'if':
      return { ...base, condition: 'always', imagePath: '', threshold: 0.85, matchRegion: null, negate: false }
    case 'loop':
      return { ...base, iterations: 1, breakOnFail: false }
    case 'end':
      return { ...base }
    case 'fetch_material':
      return {
        ...base,
        apiId: 'demo_xhs_lifestyle',
        strategy: 'sequential',
        specificIndex: 0,
        autoPushMedia: true,
        targetVarPrefix: 'api',
      }
    case 'findImage':
      return { ...base, imagePath: '', threshold: 0.85, matchRegion: null, saveAs: 'x,y' }
    case 'waitFor':
      return { ...base, imagePath: '', threshold: 0.85, matchRegion: null, timeout: 10000, pollInterval: 500, notFound: 'fail' }
    default:
      return base
  }
}

/**
 * Validate that a control-flow script is well-formed:
 * - every `if` or `loop` must have a matching `end`
 * - `end` is only valid as a closer
 * Returns { ok, error?, orphanIndexes? }
 */
export function validateControlFlow(steps = []) {
  const stack = []
  const orphanIndexes = []
  steps.forEach((step, i) => {
    if (step?.type === 'if' || step?.type === 'loop') {
      stack.push({ type: step.type, index: i })
    }
    else if (step?.type === 'end') {
      if (!stack.length) {
        orphanIndexes.push(i)
      }
      else {
        stack.pop()
      }
    }
  })
  stack.forEach(item => orphanIndexes.push(item.index))
  if (orphanIndexes.length) {
    return { ok: false, error: 'CONTROL_FLOW_UNBALANCED', orphanIndexes }
  }
  return { ok: true }
}

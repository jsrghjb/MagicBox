import { createDefaultStep } from './step-types.js'

function step(type, overrides = {}) {
  return {
    ...createDefaultStep(type),
    ...overrides,
  }
}

export const AUTOMATION_TEMPLATES = [
  {
    id: 'launch',
    nameKey: 'automation.template.launch.name',
    descKey: 'automation.template.launch.desc',
    vars: {},
    buildSteps() {
      return [
        step('key', { name: 'Home', key: '3' }),
        step('wait', { name: 'Wait', duration: 1000 }),
      ]
    },
  },
  {
    id: 'login',
    nameKey: 'automation.template.login.name',
    descKey: 'automation.template.login.desc',
    vars: {
      username: 'user@example.com',
      password: 'password',
    },
    buildSteps() {
      return [
        step('tap', { name: 'Account', x: 200, y: 400 }),
        step('input', { name: 'Username', text: '{username}' }),
        step('tap', { name: 'Password', x: 200, y: 500 }),
        step('input', { name: 'Password Input', text: '{password}' }),
        step('tap', { name: 'Login', x: 200, y: 600 }),
      ]
    },
  },
  {
    id: 'screenshot',
    nameKey: 'automation.template.screenshot.name',
    descKey: 'automation.template.screenshot.desc',
    vars: {},
    buildSteps() {
      return [
        step('screenshot', { name: 'Screenshot', auto: true }),
        step('wait', { name: 'Wait', duration: 1000 }),
      ]
    },
  },
  {
    id: 'wechat',
    nameKey: 'automation.template.wechat.name',
    descKey: 'automation.template.wechat.description',
    vars: {
      searchText: '文件传输助手',
      message: 'Hello from Escrcpy',
    },
    buildSteps() {
      return [
        step('launch', { name: 'automation.template.wechat.launch', package: 'com.tencent.mm' }),
        step('wait', { name: 'Wait Launch', duration: 3000 }),
        step('tap', { name: 'automation.template.wechat.tap.search', x: 900, y: 120 }),
        step('input', { name: 'automation.template.wechat.input.search', text: '{searchText}' }),
        step('wait', { name: 'Wait Search', duration: 1500 }),
        step('tap', { name: 'automation.template.wechat.tap.search.result', x: 500, y: 280 }),
        step('tap', { name: 'automation.template.wechat.tap.message.input', x: 500, y: 2100 }),
        step('input', { name: 'automation.template.wechat.input.message', text: '{message}' }),
        step('tap', { name: 'automation.template.wechat.tap.send', x: 980, y: 2100 }),
        step('wait', { name: 'Wait Send', duration: 1000 }),
        step('screenshot', { name: 'automation.template.wechat.screenshot', auto: true }),
      ]
    },
  },
]

export function buildTemplateSteps(templateId) {
  const template = AUTOMATION_TEMPLATES.find(item => item.id === templateId)
  if (!template) {
    return { steps: [], vars: {} }
  }

  return {
    steps: template.buildSteps(),
    vars: { ...template.vars },
  }
}

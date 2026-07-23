import { nanoid } from 'nanoid'
import { createDefaultStep, STEP_TYPE_OPTIONS } from './step-types.js'
import { getAutomationAiConfig } from './ai-config.js'
import { AUTOMATION_AI_SYSTEM_PROMPT, buildAutomationUserPrompt } from './ai-prompt.js'

const ALLOWED_TYPES = new Set(STEP_TYPE_OPTIONS.map(item => item.value))

function extractJsonContent(text = '') {
  const trimmed = String(text).trim()

  if (trimmed.startsWith('{')) {
    return trimmed
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

export function normalizeGeneratedScript(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('INVALID_AI_RESPONSE')
  }

  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    throw new Error('EMPTY_AI_STEPS')
  }

  const steps = data.steps.map((step) => {
    const type = ALLOWED_TYPES.has(step?.type) ? step.type : 'wait'
    const defaults = createDefaultStep(type)

    return {
      ...defaults,
      ...step,
      type,
      id: nanoid(),
      name: step?.name || type,
      delayBefore: Number(step?.delayBefore ?? defaults.delayBefore ?? 0),
      loopCount: Math.max(1, Number(step?.loopCount ?? 1)),
      randomRange: Number(step?.randomRange ?? 0),
    }
  })

  return {
    name: data.name || 'AI Script',
    vars: data.vars && typeof data.vars === 'object' ? data.vars : {},
    steps,
  }
}

async function callChatCompletions({ config, messages }) {
  const result = await window.$preload.ipcRenderer.invoke('ai-chat-completions', {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    temperature: config.temperature,
    messages,
    responseFormat: { type: 'json_object' },
  })

  if (!result.ok) {
    let detail = result.error || result.body || `API_ERROR_${result.status}`
    try {
      const errorJson = JSON.parse(result.body)
      detail = errorJson?.error?.message || errorJson?.message || detail
    }
    catch {
      // 非 JSON 响应
    }
    throw new Error(detail)
  }

  const payload = JSON.parse(result.body)
  const content = payload?.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('EMPTY_AI_RESPONSE')
  }

  return content
}

export async function generateAutomationScript({
  task,
  deviceId,
  screenSize,
  config: overrideConfig,
} = {}) {
  const taskText = String(task || '').trim()
  if (!taskText) {
    throw new Error('EMPTY_TASK')
  }

  const config = {
    ...(await getAutomationAiConfig()),
    ...overrideConfig,
  }

  if (!config.apiKey) {
    throw new Error('MISSING_API_KEY')
  }

  if (!config.baseUrl) {
    throw new Error('MISSING_BASE_URL')
  }

  const content = await callChatCompletions({
    config,
    messages: [
      { role: 'system', content: AUTOMATION_AI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildAutomationUserPrompt({ task: taskText, deviceId, screenSize }),
      },
    ],
  })

  const jsonText = extractJsonContent(content)
  const parsed = JSON.parse(jsonText)

  return normalizeGeneratedScript(parsed)
}

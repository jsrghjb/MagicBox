import dayjs from 'dayjs'

const VAR_PATTERN = /\{\{?\s*([a-z_][\w.]*)\s*\}?\}/gi

export function getSystemVariables(context = {}) {
  const now = Date.now()
  return {
    deviceId: context.deviceId || '',
    timestamp: String(now),
    date: dayjs(now).format('YYYY-MM-DD'),
    stepIndex: String(context.stepIndex ?? 0),
  }
}

export function buildVariableMap(customVars = {}, context = {}) {
  return {
    ...getSystemVariables(context),
    ...customVars,
  }
}

export function interpolateValue(value, vars = {}) {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'string') {
    return value
  }

  return value.replace(VAR_PATTERN, (match, name) => {
    const trimmed = name.trim()
    if (Object.prototype.hasOwnProperty.call(vars, trimmed)) {
      return String(vars[trimmed])
    }
    return match
  })
}

export function interpolateStep(step, vars = {}) {
  const result = { ...step }

  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      result[key] = interpolateValue(result[key], vars)
    }
  }

  return result
}

export function isValidVarName(name = '') {
  return /^[a-z_][\w.]*$/i.test(name)
}

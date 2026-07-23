import dayjs from 'dayjs'

const VAR_PATTERN = /\{([a-z_]\w*)\}/gi

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
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name])
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
  return /^[a-z_]\w*$/i.test(name)
}

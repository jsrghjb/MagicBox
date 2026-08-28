import { automationDataStore } from '$/database/index.js'
import { runAutomationMatrix } from '$/utils/automation/runner.js'
import { deviceSelectionHelper } from '$/utils/device/selection/index.js'

export async function handleAutomationSchedule(devices, context) {
  let config = context.payload?.automationConfig || null

  if (!config && context.extra) {
    try {
      config = JSON.parse(context.extra)
    }
    catch {
      config = null
    }
  }

  if (!config?.scriptId) {
    throw new Error('Missing automation script')
  }

  const result = await automationDataStore.getById(config.scriptId)
  if (!result.success) {
    throw new Error('Script not found')
  }

  const script = result.data
  const onlineDevices = deviceSelectionHelper.filter(devices || [], 'onlineAndUnique')

  if (!onlineDevices.length) {
    throw new Error(window.t('device.schedule.noDeviceSelected'))
  }

  const { results } = await runAutomationMatrix({
    devices: onlineDevices,
    rows: config.rows || [config.vars || {}],
    steps: script.steps || [],
    script,
    baseVars: script.vars || {},
    concurrencyLimit: config.concurrency,
    referenceScreenWidth: script.referenceScreenWidth || 1080,
    referenceScreenHeight: script.referenceScreenHeight || 1920,
  })

  const failures = (results || []).filter(item => !item?.success && !item?.skipped)
  if (failures.length) {
    const message = failures.map(item => item.error).filter(Boolean).join('; ')
    throw new Error(message || window.t('automation.run.failed'))
  }
}

export function registerAutomationScheduleHandler(scheduleStore) {
  scheduleStore.registerScheduleType({
    label: 'automation.name.execute',
    value: 'automation',
  })

  scheduleStore.on('automation', (schedule) => {
    scheduleStore.start({
      schedule,
      handler: handleAutomationSchedule,
    })
  })
}

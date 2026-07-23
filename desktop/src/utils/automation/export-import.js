import { nanoid } from 'nanoid'

export const AUTOMATION_SCHEMA_VERSION = 1

export function exportScript(script) {
  return {
    schemaVersion: AUTOMATION_SCHEMA_VERSION,
    name: script.name,
    steps: script.steps || [],
    vars: script.vars || {},
    exportedAt: Date.now(),
  }
}

export function parseImportedScript(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid import data')
  }

  if (!Array.isArray(data.steps)) {
    throw new TypeError('Invalid steps')
  }

  return {
    name: data.name || 'Imported Script',
    steps: data.steps.map(step => ({
      ...step,
      id: step.id || nanoid(),
    })),
    vars: data.vars || {},
    schemaVersion: data.schemaVersion || AUTOMATION_SCHEMA_VERSION,
  }
}

export async function downloadScriptJson(script) {
  const payload = exportScript(script)
  const content = JSON.stringify(payload, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${script.name || 'automation-script'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function readScriptJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        resolve(parseImportedScript(data))
      }
      catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

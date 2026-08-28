/**
 * Automation script store - persisted script records per device.
 */

import { BaseStore } from '$/database/core/BaseStore.js'
import { FieldTypes } from '$/database/utils/validation.js'
import { nanoid } from 'nanoid'
import { isPresetScript, SCRIPT_SOURCE } from '$/utils/automation/preset-scripts.js'

const automationSchema = {
  id: {
    type: FieldTypes.STRING,
    required: true,
  },
  deviceId: {
    type: FieldTypes.STRING,
    required: true,
  },
  name: {
    type: FieldTypes.STRING,
    required: true,
  },
  source: {
    type: FieldTypes.STRING,
  },
  steps: {
    type: FieldTypes.ARRAY,
  },
  vars: {
    type: FieldTypes.OBJECT,
  },
  referenceScreenWidth: {
    type: FieldTypes.NUMBER,
  },
  referenceScreenHeight: {
    type: FieldTypes.NUMBER,
  },
}

class AutomationStore extends BaseStore {
  constructor() {
    super({
      tableName: 'automation_scripts',
      schema: automationSchema,
      primaryKey: 'id',
      requiredFields: ['id', 'deviceId', 'name'],
    })
  }

  async createScript(data) {
    const now = Date.now()
    const record = {
      id: data.id || nanoid(),
      source: data.source || SCRIPT_SOURCE.CUSTOM,
      steps: [],
      vars: {},
      schemaVersion: 2,
      referenceScreenWidth: data.referenceScreenWidth || 1080,
      referenceScreenHeight: data.referenceScreenHeight || 1920,
      createdAt: now,
      updatedAt: now,
      ...data,
    }

    return this.add(record)
  }

  async listByDevice(deviceId) {
    try {
      const records = await this.table
        .where('deviceId')
        .equals(deviceId)
        .toArray()

      records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      return { success: true, data: records }
    }
    catch (error) {
      console.error('[automation_scripts] listByDevice error:', error)
      return { success: false, error }
    }
  }

  async updateScript(id, patch) {
    return this.update(id, patch)
  }

  async deleteById(id) {
    const existing = await this.table.get(id)
    if (isPresetScript(existing)) {
      return {
        success: false,
        error: { message: 'Official preset scripts cannot be deleted' },
      }
    }
    return super.deleteById(id)
  }
}

export const automationDataStore = new AutomationStore()

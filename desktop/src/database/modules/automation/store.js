/**
 * Automation script store - persisted script records per device.
 */

import { BaseStore } from '$/database/core/BaseStore.js'
import { FieldTypes } from '$/database/utils/validation.js'
import { nanoid } from 'nanoid'

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
}

export const automationDataStore = new AutomationStore()

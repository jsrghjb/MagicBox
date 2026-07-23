<template>
  <el-button
    v-if="!row.wifi"
    type="primary"
    text
    :disabled="['unauthorized', 'offline'].includes(row.status)"
    :title="$t('device.wireless.mode')"
    @click="handleWifi(row)"
  >
    <template #icon>
      <i class="i-bi-wifi"></i>
    </template>
  </el-button>

  <el-button
    v-if="row.wifi"
    type="danger"
    text
    :loading="stopLoading"
    :disabled="['unauthorized', 'offline'].includes(row.status)"
    :icon="stopLoading ? '' : 'Close'"
    :title="stopLoading
      ? $t('device.wireless.disconnect.progress')
      : $t('device.wireless.disconnect.start')"
    @click="handleStop(row)"
  >
  </el-button>
</template>

<script>
import { sleep } from '$/utils'
import { parseDeviceId } from '$/utils/device'

export default {
  inheritAttrs: false,
  props: {
    row: {
      type: Object,
      default: () => ({}),
    },
    handleConnect: {
      type: Function,
      default: () => () => false,
    },
    handleRefresh: {
      type: Function,
      default: () => () => false,
    },
  },
  data() {
    return {
      stopLoading: false,
    }
  },
  methods: {
    async handleWifi(row) {
      try {
        const host = await this.$adb.getDeviceIP(row.id)

        if (!host) {
          throw new Error(this.$t('device.wireless.mode.error'))
        }

        const port = await this.$adb.tcpip(row.id, 5555)

        await sleep()

        this.handleConnect(`${host}:${port}`)
      }
      catch (error) {
        console.warn(error.message)
        if (error?.message || error?.cause?.message) {
          this.$message.warning(error?.message || error?.cause?.message)
        }
      }
    },

    async handleStop(row) {
      this.stopLoading = true

      try {
        await this.$adb.disconnect(row.id)

        // Cleanup local store persistence for this wireless device
        try {
          const storeDevices = window.$preload?.store?.get('device') || {}
          const { host, port } = parseDeviceId(row.id || '')
          const keys = [row.id, `${host}:${port}`, host].filter(Boolean)
          let storeUpdated = false
          for (const k of keys) {
            if (storeDevices[k]) {
              delete storeDevices[k]
              storeUpdated = true
            }
          }
          if (storeUpdated) {
            window.$preload?.store?.set('device', storeDevices)
          }
        }
        catch (e) {
          console.warn('handleStop store cleanup warning:', e)
        }

        await sleep(300)
        this.$message.success(this.$t('device.wireless.disconnect.success'))
      }
      catch (error) {
        console.warn('disconnect error:', error)
        if (error?.message || typeof error === 'string')
          this.$message.warning(error?.message || String(error))
      }

      this.handleRefresh()

      this.stopLoading = false
    },
  },
}
</script>

<style></style>

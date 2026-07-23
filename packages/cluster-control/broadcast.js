/**
 * 群控同步广播模块
 * 将主控机操作转换为百分比坐标，并广播给所有被控机
 */

class SimpleEmitter {
  constructor() {
    this._listeners = new Map()
  }

  on(event, listener) {
    const list = this._listeners.get(event) || []
    list.push(listener)
    this._listeners.set(event, list)
    return this
  }

  emit(event, ...args) {
    for (const listener of this._listeners.get(event) || []) {
      listener(...args)
    }
  }
}

/**
 * 输入事件类型
 * @typedef {'mousedown' | 'mousemove' | 'mouseup' | 'click' | 'swipe' | 'keydown'} InputEventType
 */

/**
 * 标准化输入事件
 * @typedef {Object} InputEvent
 * @property {InputEventType} type - 事件类型
 * @property {number} xPercent - X 坐标百分比 (0 ~ 1)
 * @property {number} yPercent - Y 坐标百分比 (0 ~ 1)
 * @property {number} [button] - 鼠标按键
 * @property {string} [key] - 按键名称
 * @property {Point[]} [trajectory] - 滑动轨迹 (百分比坐标)
 */

/**
 * 群控广播总线
 * @emits InputEvent - 当有新输入事件广播时触发
 */
export class BroadcastBus extends SimpleEmitter {
  constructor() {
    super()
    this.masterSerial = null
    this.devices = new Map()
  }

  /**
   * 设置主控设备
   * @param {string} serial - 主控设备序列号
   */
  setMaster(serial) {
    this.masterSerial = serial
    console.log(`[broadcast] 已设置主控设备: ${serial}`)
  }

  /**
   * 注册被控设备
   * @param {string} serial - 设备序列号
   * @param {number} width - 设备物理宽度
   * @param {number} height - 设备物理高度
   */
  registerDevice(serial, width, height) {
    this.devices.set(serial, { width, height })
  }

  /**
   * 注销被控设备
   * @param {string} serial - 设备序列号
   */
  unregisterDevice(serial) {
    this.devices.delete(serial)
  }

  /**
   * 将主控上的像素坐标转换为百分比坐标并广播
   * @param {InputEvent} event - 前端捕获的原始输入事件 (像素坐标)
   * @param {number} masterDisplayWidth - 主控在前端网格中的显示宽度
   * @param {number} masterDisplayHeight - 主控在前端网格中的显示高度
   */
  broadcastInput(event, masterDisplayWidth, masterDisplayHeight) {
    // 转换为百分比坐标
    const percentEvent = { ...event }

    if (typeof event.x === 'number' && typeof event.y === 'number') {
      percentEvent.xPercent = event.x / masterDisplayWidth
      percentEvent.yPercent = event.y / masterDisplayHeight
    }

    // 如果有轨迹点，全部转换为百分比
    if (event.trajectory) {
      percentEvent.trajectory = event.trajectory.map(p => ({
        xPercent: p.x / masterDisplayWidth,
        yPercent: p.y / masterDisplayHeight,
      }))
    }

    // 广播给所有监听者
    this.emit('input', percentEvent)

    // 同时给每个设备分发，将百分比转为对应设备的实际像素
    for (const [serial, device] of this.devices.entries()) {
      const deviceEvent = this.convertToDeviceCoordinates(percentEvent, device.width, device.height)
      this.emit(`input:${serial}`, deviceEvent)
    }
  }

  /**
   * 将百分比坐标转换为特定设备的实际像素坐标
   * @param {InputEvent} percentEvent - 百分比坐标事件
   * @param {number} deviceWidth - 设备实际宽度
   * @param {number} deviceHeight - 设备实际高度
   * @returns {InputEvent} 转换后的事件
   */
  convertToDeviceCoordinates(percentEvent, deviceWidth, deviceHeight) {
    const deviceEvent = { ...percentEvent }

    if (typeof percentEvent.xPercent === 'number' && typeof percentEvent.yPercent === 'number') {
      deviceEvent.x = Math.round(percentEvent.xPercent * deviceWidth)
      deviceEvent.y = Math.round(percentEvent.yPercent * deviceHeight)
    }

    if (percentEvent.trajectory) {
      deviceEvent.trajectory = percentEvent.trajectory.map(p => ({
        x: Math.round(p.xPercent * deviceWidth),
        y: Math.round(p.yPercent * deviceHeight),
      }))
    }

    return deviceEvent
  }

  /**
   * 获取当前注册设备数量
   * @returns {number}
   */
  get deviceCount() {
    return this.devices.size
  }
}

export default BroadcastBus

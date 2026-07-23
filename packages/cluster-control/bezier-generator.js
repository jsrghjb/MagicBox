/**
 * 贝塞尔曲线滑动轨迹生成器
 * 用于生成带有随机扰动的人类模拟滑动轨迹，实现反风控检测
 */

/**
 * 二维点坐标
 * @typedef {Object} Point
 * @property {number} x - X 坐标 (百分比或像素值)
 * @property {number} y - Y 坐标 (百分比或像素值)
 */

/**
 * 生成带有随机扰动的贝塞尔曲线滑动轨迹
 * @param {Point} start - 起点坐标
 * @param {Point} end - 终点坐标
 * @param {number} [steps] - 生成的轨迹点数量，越多越平滑
 * @param {number} [noise] - 随机扰动强度 (0 ~ 0.1，相对于起点终点距离)
 * @returns {Point[]} 完整滑动轨迹点列表
 */
export function generateBezierCurve(start, end, steps = 50, noise = 0.02) {
  // 计算起点终点之间的距离
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // 根据距离计算随机扰动的最大偏移量
  const maxOffset = distance * noise

  // 生成两个随机控制点，形成三次贝塞尔曲线
  const controlPoint1 = {
    x: start.x + dx / 3 + randomRange(-maxOffset, maxOffset),
    y: start.y + dy / 3 + randomRange(-maxOffset, maxOffset),
  }

  const controlPoint2 = {
    x: start.x + (dx * 2) / 3 + randomRange(-maxOffset, maxOffset),
    y: start.y + (dy * 2) / 3 + randomRange(-maxOffset, maxOffset),
  }

  // 生成轨迹点
  const trajectory = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const point = calculateBezierPoint(
      t,
      start,
      controlPoint1,
      controlPoint2,
      end,
    )

    // 在每个点上额外增加微小随机扰动，模拟人手自然颤抖
    if (i > 0 && i < steps) {
      point.x += randomRange(-maxOffset / 4, maxOffset / 4)
      point.y += randomRange(-maxOffset / 4, maxOffset / 4)
    }

    trajectory.push(point)
  }

  return trajectory
}

/**
 * 计算三次贝塞尔曲线上的一点
 * @param {number} t - 插值参数 (0 ~ 1)
 * @param {Point} p0 - 起点
 * @param {Point} p1 - 控制点1
 * @param {Point} p2 - 控制点2
 * @param {Point} p3 - 终点
 * @returns {Point}
 */
function calculateBezierPoint(t, p0, p1, p2, p3) {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt

  const x = mt3 * p0.x
    + 3 * mt2 * t * p1.x
    + 3 * mt * t2 * p2.x
    + t3 * p3.x

  const y = mt3 * p0.y
    + 3 * mt2 * t * p1.y
    + 3 * mt * t2 * p2.y
    + t3 * p3.y

  return { x, y }
}

/**
 * 在指定范围内生成随机浮点数
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number}
 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

/**
 * 生成随机时间间隔，模拟人类操作之间的等待时间
 * @param {number} minSeconds - 最小等待秒数
 * @param {number} maxSeconds - 最大等待秒数
 * @returns {number} 随机毫秒数
 */
export function randomDelay(minSeconds, maxSeconds) {
  const seconds = randomRange(minSeconds, maxSeconds)
  return Math.floor(seconds * 1000)
}

/**
 * 根据权重随机选择动作，实现概率随机化行为
 * @param {Array<{action: any, weight: number}>} actions - 动作列表，每个动作有权重
 * @returns {any} 选中的动作
 */
export function randomByWeight(actions) {
  const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0)
  let random = Math.random() * totalWeight

  for (const action of actions) {
    random -= action.weight
    if (random <= 0) {
      return action.action
    }
  }

  // 兜底，返回最后一个
  return actions[actions.length - 1].action
}

export default {
  generateBezierCurve,
  randomRange,
  randomDelay,
  randomByWeight,
}

/**
 * Bionic Bézier Curve and Physical Force Trajectory Generator
 * Generates human-like non-linear touch curves with ease-in-out speed profiles,
 * dynamic pressure curves, and micro-jitter for maximum anti-risk protection.
 */

function randomGaussian() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/**
 * Standard cubic easing (ease-in-out) for human physical force simulation
 */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}

/**
 * Calculate point on a Cubic Bézier curve
 */
function calculateBezierPoint(t, p0, p1, p2, p3) {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt

  const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
  const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

  return { x, y }
}

/**
 * Generate human-like bionic swipe trajectory with natural curvature and speed variation
 * @param {{ x: number, y: number }} start - Starting coordinate
 * @param {{ x: number, y: number }} end - Ending coordinate
 * @param {object} [options]
 * @param {number} [options.duration] - Swipe duration in ms
 * @param {number} [options.randomRange] - Jitter and deviation factor
 * @param {{ width: number, height: number }} [options.screenSize] - Device screen dimensions
 * @returns {Array<{ x: number, y: number, timeOffset: number, pressure: number }>}
 */
export function generateBionicSwipeTrajectory(start, end, options = {}) {
  const {
    duration = 350,
    randomRange: rawRandomRange = 2,
    screenSize = null,
  } = options

  const randomRangeFactor = Math.max(0.5, Number(rawRandomRange || 2))
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)

  if (distance < 5) {
    return [
      { x: Math.round(start.x), y: Math.round(start.y), timeOffset: 0, pressure: 0.8 },
      { x: Math.round(end.x), y: Math.round(end.y), timeOffset: duration, pressure: 0.1 },
    ]
  }

  // Calculate perpendicular vector for natural arc bowing
  const perpX = -dy / distance
  const perpY = dx / distance

  // Maximum arc deviation (randomized left or right arc bowing)
  const arcMagnitude = Math.min(distance * 0.18, 40) * (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.8)
  const noiseScale = Math.min(distance * 0.04, 12) * randomRangeFactor

  // Control points for cubic bezier
  const cp1 = {
    x: start.x + dx * 0.28 + perpX * arcMagnitude + randomGaussian() * noiseScale * 0.5,
    y: start.y + dy * 0.28 + perpY * arcMagnitude + randomGaussian() * noiseScale * 0.5,
  }

  const cp2 = {
    x: start.x + dx * 0.72 + perpX * (arcMagnitude * 0.7) + randomGaussian() * noiseScale * 0.5,
    y: start.y + dy * 0.72 + perpY * (arcMagnitude * 0.7) + randomGaussian() * noiseScale * 0.5,
  }

  // Frame count based on 60fps~100fps target interval (every 10~16ms)
  const stepCount = Math.max(12, Math.min(60, Math.round(duration / 12)))
  const trajectory = []

  for (let i = 0; i <= stepCount; i++) {
    const linearProgress = i / stepCount
    // Apply physical力学 Ease-in-out speed mapping
    const easedProgress = easeInOutCubic(linearProgress)

    const pt = calculateBezierPoint(easedProgress, start, cp1, cp2, end)

    // Add tiny human micro-jitter to interior points
    if (i > 0 && i < stepCount) {
      const jitter = (randomGaussian() * 0.6 * randomRangeFactor)
      pt.x += jitter
      pt.y += jitter
    }

    // Clamp coordinates within screen if provided
    let finalX = Math.round(pt.x)
    let finalY = Math.round(pt.y)
    if (screenSize?.width) {
      finalX = Math.max(5, Math.min(screenSize.width - 5, finalX))
    }
    if (screenSize?.height) {
      finalY = Math.max(5, Math.min(screenSize.height - 5, finalY))
    }

    // Dynamic pressure simulation: starts light (~0.3), peaks in middle (~0.9), fades on release (~0.15)
    const pressureCurve = Math.sin(linearProgress * Math.PI)
    const pressure = Math.max(0.1, Math.min(1.0, 0.25 + pressureCurve * 0.65 + randomGaussian() * 0.05))

    trajectory.push({
      x: finalX,
      y: finalY,
      timeOffset: Math.round(linearProgress * duration),
      pressure: Number(pressure.toFixed(2)),
    })
  }

  return trajectory
}

/**
 * Generate human-like micro-motion for tap/press
 */
export function generateBionicTapPoints(point, options = {}) {
  const {
    duration = 80,
    randomRange = 2,
    screenSize = null,
  } = options

  const driftX = (randomGaussian() * 0.8 * randomRange)
  const driftY = (randomGaussian() * 0.8 * randomRange)

  let x1 = Math.round(point.x)
  let y1 = Math.round(point.y)
  let x2 = Math.round(point.x + driftX)
  let y2 = Math.round(point.y + driftY)

  if (screenSize?.width) {
    x1 = Math.max(5, Math.min(screenSize.width - 5, x1))
    x2 = Math.max(5, Math.min(screenSize.width - 5, x2))
  }
  if (screenSize?.height) {
    y1 = Math.max(5, Math.min(screenSize.height - 5, y1))
    y2 = Math.max(5, Math.min(screenSize.height - 5, y2))
  }

  return {
    start: { x: x1, y: y1, pressure: 0.75 },
    end: { x: x2, y: y2, pressure: 0.3 },
    duration: Math.max(30, Math.round(duration)),
  }
}

export default {
  generateBionicSwipeTrajectory,
  generateBionicTapPoints,
}

/**
 * Image template matcher.
 *
 * Uses `sharp` (already a workspace dep) to read both images,
 * crop the haystack to the optional region, and slide the needle
 * over it computing a normalized correlation score. Returns the
 * best match + score so callers can decide whether the threshold
 * was met.
 *
 * This runs in the Electron main process so the renderer can
 * keep doing its work in parallel.
 */
import sharp from 'sharp'

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function emptyMatch(reason) {
  return { found: false, score: 0, x: 0, y: 0, width: 0, height: 0, reason }
}

function cropBox(region, haystackW, haystackH) {
  if (!region || typeof region !== 'object') {
    return { left: 0, top: 0, width: haystackW, height: haystackH }
  }
  const x1 = clampInt(Number(region.x1 ?? 0), 0, haystackW - 1)
  const y1 = clampInt(Number(region.y1 ?? 0), 0, haystackH - 1)
  const x2 = clampInt(Number(region.x2 ?? haystackW), x1 + 1, haystackW)
  const y2 = clampInt(Number(region.y2 ?? haystackH), y1 + 1, haystackH)
  return { left: x1, top: y1, width: x2 - x1, height: y2 - y1 }
}

function computeNcc(needlePixels, hayPixels, needleW, needleH, x, y, fullW) {
  // Sum of pixel intensities + cross-correlation
  let sumN = 0
  let sumH = 0
  let sumNN = 0
  let sumHH = 0
  let sumNH = 0
  let count = 0

  for (let j = 0; j < needleH; j++) {
    const rowOffset = (y + j) * fullW + x
    for (let i = 0; i < needleW; i++) {
      const n = needlePixels[j * needleW + i]
      const h = hayPixels[rowOffset + i]
      sumN += n
      sumH += h
      sumNN += n * n
      sumHH += h * h
      sumNH += n * h
      count++
    }
  }

  const meanN = sumN / count
  const meanH = sumH / count
  let num = 0
  let denN = 0
  let denH = 0
  for (let j = 0; j < needleH; j++) {
    const rowOffset = (y + j) * fullW + x
    for (let i = 0; i < needleW; i++) {
      const n = needlePixels[j * needleW + i] - meanN
      const h = hayPixels[rowOffset + i] - meanH
      num += n * h
      denN += n * n
      denH += h * h
    }
  }
  const denom = Math.sqrt(denN * denH)
  if (!denom) {
    return 0
  }
  // Map NCC [-1, 1] into [0, 1] so callers can use a friendly threshold.
  return Math.max(0, Math.min(1, (num / denom + 1) / 2))
}

async function toGrayRaw(filePath) {
  const meta = await sharp(filePath).metadata()
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels, meta }
}

export async function findImageOnScreen({ screenPath, needlePath, threshold = 0.85, region = null }) {
  if (!screenPath || !needlePath) {
    return emptyMatch('MISSING_PATHS')
  }
  let screen, needle
  try {
    screen = await toGrayRaw(screenPath)
  }
  catch (e) {
    return emptyMatch(`SCREEN_READ_FAIL: ${e.message || e}`)
  }
  try {
    needle = await toGrayRaw(needlePath)
  }
  catch (e) {
    return emptyMatch(`NEEDLE_READ_FAIL: ${e.message || e}`)
  }

  if (needle.width > screen.width || needle.height > screen.height) {
    return emptyMatch('NEEDLE_TOO_LARGE')
  }

  const box = cropBox(region, screen.width, screen.height)
  if (box.width < needle.width || box.height < needle.height) {
    return emptyMatch('REGION_TOO_SMALL')
  }

  // Crop the haystack region to reduce work
  let hayPixels = screen.data
  let hayBaseX = 0
  let hayBaseY = 0
  if (box.left || box.top || box.width !== screen.width || box.height !== screen.height) {
    const cropped = await sharp(screenPath)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    hayPixels = cropped.data
    hayBaseX = box.left
    hayBaseY = box.top
  }
  const hayW = box.width
  const hayH = box.height

  let bestScore = -1
  let bestX = 0
  let bestY = 0
  // Coarse stride = max(1, needle / 6) for speed, then refine around best.
  const coarseStride = Math.max(1, Math.round(Math.min(needle.width, needle.height) / 6))
  for (let y = 0; y <= hayH - needle.height; y += coarseStride) {
    for (let x = 0; x <= hayW - needle.width; x += coarseStride) {
      const s = computeNcc(needle.data, hayPixels, needle.width, needle.height, x, y, hayW)
      if (s > bestScore) {
        bestScore = s
        bestX = x
        bestY = y
      }
    }
  }

  // Refine in a 3x3 window with stride 1
  for (let dy = -coarseStride; dy <= coarseStride; dy += 1) {
    for (let dx = -coarseStride; dx <= coarseStride; dx += 1) {
      const y = bestY + dy
      const x = bestX + dx
      if (y < 0 || x < 0 || y > hayH - needle.height || x > hayW - needle.width) {
        continue
      }
      const s = computeNcc(needle.data, hayPixels, needle.width, needle.height, x, y, hayW)
      if (s > bestScore) {
        bestScore = s
        bestX = x
        bestY = y
      }
    }
  }

  const absX = bestX + hayBaseX + Math.floor(needle.width / 2)
  const absY = bestY + hayBaseY + Math.floor(needle.height / 2)
  return {
    found: bestScore >= threshold,
    score: Number(bestScore.toFixed(4)),
    x: absX,
    y: absY,
    width: needle.width,
    height: needle.height,
  }
}

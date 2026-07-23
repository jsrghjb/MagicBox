/**
 * pointer-map 单元测试
 * 运行: node packages/cluster-control/test-pointer-map.mjs
 */
import { classifyGesture, mapPointerToPercent } from './pointer-map.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  }
  else {
    console.log('OK:', msg)
  }
}

const rect = { left: 100, top: 50, width: 400, height: 300 }

// 16:9 视频在 4:3 容器内，上下黑边
{
  const center = mapPointerToPercent(300, 200, rect, 1920, 1080)
  assert(Math.abs(center.xPercent - 0.5) < 0.01, 'horizontal center ~50%')
  assert(Math.abs(center.yPercent - 0.5) < 0.01, 'vertical center ~50% in content area')

  const topLetterbox = mapPointerToPercent(300, 60, rect, 1920, 1080)
  assert(topLetterbox.yPercent === 0, 'top letterbox clamps to 0')
}

// 点击 vs 滑动
assert(classifyGesture(5).action === 'tap', 'short move is tap')
assert(classifyGesture(40).action === 'swipe', 'long move is swipe')

console.log(failed ? `\n${failed} test(s) failed` : '\nAll pointer-map tests passed')
process.exit(failed ? 1 : 0)

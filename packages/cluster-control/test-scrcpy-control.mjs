/**
 * scrcpy 控制消息序列化自检
 * 运行: node packages/cluster-control/test-scrcpy-control.mjs
 */
import {
  MOTION_EVENT_ACTION_DOWN,
  serializeInjectTouchEvent,
} from './scrcpy-control.js'

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

const touch = serializeInjectTouchEvent({
  action: MOTION_EVENT_ACTION_DOWN,
  x: 100,
  y: 200,
  screenWidth: 1080,
  screenHeight: 1920,
})

assert(touch.length === 32, 'touch message 32 bytes')
assert(touch[0] === 2, 'touch type')
assert(touch[1] === 0, 'touch down action')
assert(touch.readUInt32BE(10) === 100, 'touch x')
assert(touch.readUInt32BE(14) === 200, 'touch y')
assert(touch.readUInt16BE(18) === 1080, 'screen width')
assert(touch.readUInt16BE(20) === 1920, 'screen height')

console.log(failed ? `\n${failed} test(s) failed` : '\nAll scrcpy-control tests passed')
process.exit(failed ? 1 : 0)

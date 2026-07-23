import assert from 'node:assert/strict'
import {
  buildVideoServerOptions,
  getEffectiveMaxVideoSize,
  mergeDevicePreferenceData,
} from './preference-video-config.js'

const globalPrefs = {
  '--max-size': 1280,
  '--max-fps': 60,
  '--video-bit-rate': '8000000',
}

const devicePrefs = {
  '--max-fps': 45,
  '--display-id': 0,
}

const merged = mergeDevicePreferenceData(globalPrefs, devicePrefs)
assert.equal(merged['--max-size'], 1280)
assert.equal(merged['--max-fps'], 45)

const options = buildVideoServerOptions({
  ...merged,
  '--video-code': 'h264 & c2.android.avc.encoder',
  '--display-orientation': '90',
  '--crop': '1080:1920:0:0',
})

assert.equal(options.max_size, 1280)
assert.equal(options.max_fps, 45)
assert.equal(options.video_bit_rate, 8000000)
assert.equal(options.video_codec, 'h264')
assert.equal(options.video_encoder, 'c2.android.avc.encoder')
assert.equal(options.capture_orientation, '90')
assert.equal(options.crop, '1080:1920:0:0')
assert.equal(options.display_id, 0)
assert.equal(getEffectiveMaxVideoSize(options), 1280)

const disabled = buildVideoServerOptions({ '--no-video': true })
assert.equal(disabled.video, false)

console.log('preference-video-config tests passed')

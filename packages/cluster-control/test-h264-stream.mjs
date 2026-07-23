/**
 * 自检：Annex B 解析 + AVCC 输出 + 格式锁定 + 多设备模拟。
 * 运行: node packages/cluster-control/test-h264-stream.mjs
 */
import { isAvccAccessUnit } from '../../desktop/src/views/cluster/utils/h264.js'
import { H264StreamParser } from './h264-stream.js'

function buildAnnexB(nals) {
  return Buffer.concat(nals.map(nal => Buffer.concat([Buffer.from([0, 0, 0, 1]), nal])))
}

function buildAvcc(nals) {
  return Buffer.concat(nals.map((nal) => {
    const out = Buffer.alloc(4 + nal.length)
    out.writeUInt32BE(nal.length, 0)
    nal.copy(out, 4)
    return out
  }))
}

const sps = Buffer.from('6742c020da8200204807840215', 'hex')
const pps = Buffer.from('68ce3c80', 'hex')
const idr = Buffer.from('6588880123456789abcdef', 'hex')
const pframe = Buffer.from('6199990123456789abcdef', 'hex')

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

// Annex B 分片 + 合并
{
  const parser = new H264StreamParser()
  const part1 = parser.push(buildAnnexB([sps, pps, idr]))
  const part2 = parser.push(Buffer.concat([buildAnnexB([pframe]), buildAnnexB([idr])]))
  const frames = [...part1, ...part2]

  assert(parser.format === 'annex-b', 'locks annex-b format')
  assert(frames.some(f => f.config), 'annex-b emits config')
  assert(frames.some(f => f.keyframe), 'annex-b emits keyframe')
  assert(frames.some(f => !f.keyframe && !f.config), 'annex-b emits delta')
  assert(frames.every(f => f.config || f.data.length >= 8), 'annex-b no tiny bogus frames')

  for (const frame of frames.filter(f => !f.config))
    assert(isAvccAccessUnit(new Uint8Array(frame.data)), `annex-b frame avcc len=${frame.data.length}`)
}

// SPS/PPS 单包立即消费
{
  const parser = new H264StreamParser()
  const onlySps = parser.push(buildAnnexB([sps]))
  assert(!onlySps.some(f => f.config), 'single sps no config yet')
  assert(parser.buffer.length === 0, 'single sps consumed')

  const withPps = parser.push(buildAnnexB([pps]))
  assert(withPps.some(f => f.config), 'sps+pps emits config')
}

// AVCC 路径不被 buffer 内伪 start code 干扰
{
  const parser = new H264StreamParser()
  const avccChunk = buildAvcc([sps, pps, idr, pframe])
  const frames = parser.push(avccChunk)
  assert(parser.format === 'avcc', 'locks avcc format')
  assert(frames.some(f => f.config), 'avcc emits config')
  assert(frames.some(f => f.keyframe), 'avcc emits keyframe')
}

// 模拟两台设备独立 parser
{
  const parsers = [new H264StreamParser(), new H264StreamParser()]
  const streams = [
    buildAnnexB([sps, pps, idr, pframe]),
    buildAnnexB([Buffer.from('6742c020da87808165e6', 'hex'), Buffer.from('68ce3880', 'hex'), idr, pframe]),
  ]

  for (let i = 0; i < parsers.length; i++) {
    const frames = parsers[i].push(streams[i])
    assert(frames.some(f => f.config), `device ${i} config`)
    assert(frames.some(f => f.keyframe), `device ${i} keyframe`)
  }
}

// SPS/PPS 变更时重新下发 config
{
  const parser = new H264StreamParser()
  const sps2 = Buffer.from('6742c020da87808165e6', 'hex')
  const pps2 = Buffer.from('68ce3880', 'hex')
  const frames1 = parser.push(buildAnnexB([sps, pps, idr]))
  const frames2 = parser.push(buildAnnexB([sps2, pps2, idr]))
  assert(frames1.some(f => f.config), 'initial config')
  assert(frames2.some(f => f.config), 'reconfig on sps change')
}

console.log(failed ? `\n${failed} test(s) failed` : '\nAll self-tests passed')
process.exit(failed ? 1 : 0)

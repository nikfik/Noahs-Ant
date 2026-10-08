import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { jest } from '@jest/globals'
import ffmpegPath from 'ffmpeg-static'
import {
  buildFfmpegArgs,
  createVideoConverter,
  parseProbeOutput,
  parseProgress,
  planConversion
} from '../public/scripts/main/video-converter.js'

// The report ffmpeg prints for a camcorder file: interlaced H.264 with AC-3 sound in an MPEG transport stream.
const MTS_REPORT = `
Input #0, mpegts, from 'C:/Videos/00027.MTS':
  Duration: 00:01:48.06, start: 1.040000, bitrate: 16563 kb/s
  Program 1
  Stream #0:0[0x1011]: Video: h264 (High) (HDMV / 0x564D4448), yuv420p(top first), 1920x1080 [SAR 1:1 DAR 16:9], 25 fps, 50 tbr, 90k tbn
  Stream #0:1[0x1100]: Audio: ac3 (AC-3 / 0x332D4341), 48000 Hz, 5.1(side), fltp, 448 kb/s
  Stream #0:2[0x1200]: Subtitle: hdmv_pgs_subtitle ([144][0][0][0] / 0x0090), 1920x1080
At least one output file must be specified`

const MP4_REPORT = `
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'cat.mp4':
  Duration: 00:00:10.50, start: 0.000000, bitrate: 1700 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1280x720 [SAR 1:1 DAR 16:9], 1500 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 128 kb/s (default)`

const probeOf = (report) => parseProbeOutput(report)

describe('Reading the ffmpeg report', () => {
  test('finds the codecs, size, frame rate, length and interlacing of a camcorder file', () => {
    const probe = probeOf(MTS_REPORT)
    expect(probe.duration).toBeCloseTo(108.06)
    expect(probe.video).toEqual({ codec: 'h264', width: 1920, height: 1080, fps: 25, interlaced: true })
    expect(probe.audio).toEqual({ codec: 'ac3' })
  })

  test('recognizes a progressive file, also when colour details are listed before the flag', () => {
    const probe = probeOf(MP4_REPORT)
    expect(probe.video).toEqual({ codec: 'h264', width: 1280, height: 720, fps: 30, interlaced: false })
    expect(probe.audio).toEqual({ codec: 'aac' })
    expect(probe.duration).toBeCloseTo(10.5)
  })

  test('handles a silent video, a variable frame rate and a file without video', () => {
    const silent = probeOf('Duration: 00:00:05.00, start: 0\n  Stream #0:0: Video: vp9 (Profile 0), yuv420p(tv, progressive), 640x360, 24 tbr, 1k tbn')
    expect(silent.audio).toBeNull()
    expect(silent.video).toMatchObject({ codec: 'vp9', fps: 24, interlaced: false })

    expect(probeOf('Duration: 00:00:05.00\n  Stream #0:0: Audio: mp3, 44100 Hz, stereo')).toBeNull()
    expect(probeOf('No such file or directory')).toBeNull()
  })
})

describe('Deciding what a file needs', () => {
  const plan = (report, extension) => planConversion(probeOf(report), extension)

  test('leaves a playable file alone', () => {
    expect(plan(MP4_REPORT, '.mp4')).toMatchObject({ action: 'none', reasons: [], frameRate: 30 })
  })

  test('de-interlaces camcorder footage and doubles the picture rate', () => {
    const result = plan(MTS_REPORT, '.MTS')
    expect(result.action).toBe('transcode')
    expect(result.frameRate).toBe(50)
    expect(result.reasons).toEqual(expect.arrayContaining(['przeplot (interlace)', 'kontener .mts', 'dźwięk ac3']))
  })

  test('only repackages when the video is fine but the container or the sound is not', () => {
    expect(plan(MP4_REPORT, '.avi')).toMatchObject({ action: 'remux', reasons: ['kontener .avi'], frameRate: 30 })
    expect(plan(MP4_REPORT.replace('aac (LC)', 'ac3'), '.mkv')).toMatchObject({ action: 'remux', reasons: ['dźwięk ac3'] })
  })

  test('re-encodes a video codec the player cannot open', () => {
    expect(plan(MP4_REPORT.replace('h264 (High)', 'mpeg4 (Simple Profile)'), '.avi').action).toBe('transcode')
    expect(plan(MP4_REPORT.replace('progressive', 'top first'), '.mp4')).toMatchObject({ action: 'transcode', frameRate: 60 })
  })
})

describe('ffmpeg command line', () => {
  const args = (report, extension) => {
    const probe = probeOf(report)
    return buildFfmpegArgs({ inputPath: 'in.MTS', outputPath: 'out.mp4', plan: planConversion(probe, extension), probe })
  }

  test('de-interlaces and re-encodes camcorder footage, with the sound converted to stereo AAC', () => {
    const list = args(MTS_REPORT, '.mts')
    expect(list).toEqual(expect.arrayContaining(['-vf', 'yadif=mode=1', '-c:v', 'libx264', '-c:a', 'aac', '-ac', '2']))
    expect(list.at(-1)).toBe('out.mp4')
    expect(list.slice(list.indexOf('-i'), list.indexOf('-i') + 2)).toEqual(['-i', 'in.MTS'])
    expect(list).toEqual(expect.arrayContaining(['-map', '0:v:0', '-map', '0:a:0?', '-movflags', '+faststart', '-progress', 'pipe:1']))
  })

  test('copies the video (and AAC sound) when only the container is a problem', () => {
    const list = args(MP4_REPORT, '.avi')
    expect(list).toEqual(expect.arrayContaining(['-c:v', 'copy', '-c:a', 'copy']))
    expect(list).not.toContain('libx264')
    expect(list).not.toContain('yadif=mode=1')
  })

  test('converts sound that an MP4 file cannot hold as it is', () => {
    expect(args(MP4_REPORT.replace('aac (LC)', 'ac3'), '.mkv')).toEqual(expect.arrayContaining(['-c:v', 'copy', '-c:a', 'aac']))
  })
})

describe('Progress', () => {
  test('reads how far ffmpeg has got, using the latest line', () => {
    expect(parseProgress('frame=10\nout_time_us=1500000\nprogress=continue\n')).toBe(1.5)
    expect(parseProgress('out_time_us=1000000\nprogress=continue\nout_time_us=2500000\n')).toBe(2.5)
    expect(parseProgress('out_time_ms=3000000\n')).toBe(3)
    expect(parseProgress('progress=continue')).toBeNull()
  })
})

describe('Video converter with a fake ffmpeg', () => {
  let directory
  let inputPath
  let outputDir

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-video-'))
    inputPath = path.join(directory, '00027.MTS')
    outputDir = path.join(directory, 'videos')
    fs.writeFileSync(inputPath, 'source video')
  })

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }))

  // A fake process: the probe call (no "-y") prints the report; the conversion writes the output file and reports progress.
  function fakeSpawn({ report = MTS_REPORT, onConvert } = {}) {
    return jest.fn((_command, args) => {
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.kill = jest.fn(() => setImmediate(() => child.emit('close', null)))
      setImmediate(() => {
        if (!args.includes('-y')) {
          child.stderr.emit('data', Buffer.from(report))
          child.emit('close', 1)
        } else if (onConvert) {
          onConvert(child, args)
        } else {
          fs.writeFileSync(args.at(-1), 'converted video')
          child.stdout.emit('data', Buffer.from('out_time_us=54030000\nprogress=continue\n'))
          child.stdout.emit('data', Buffer.from('out_time_us=108060000\nprogress=end\n'))
          child.emit('close', 0)
        }
      })
      return child
    })
  }
  const converter = (spawn) => createVideoConverter({ ffmpegPath: 'ffmpeg', spawn })

  test('converts into the project folder, reports progress, and remembers where the file came from', async () => {
    const spawn = fakeSpawn()
    const progress = jest.fn()
    const result = await converter(spawn).prepare({ inputPath, outputDir, onProgress: progress })

    expect(result).toMatchObject({
      status: 'converted', videoPath: path.join(outputDir, '00027.mp4'), sourcePath: inputPath, mode: 'transcode', frameRate: 50, converted: true
    })
    expect(fs.readFileSync(result.videoPath, 'utf8')).toBe('converted video')
    expect(fs.existsSync(`${result.videoPath}.part.mp4`)).toBe(false)
    expect(progress.mock.calls.map(([value]) => Math.round(value))).toEqual([50, 100, 100])
    expect(JSON.parse(fs.readFileSync(`${result.videoPath}.json`, 'utf8'))).toMatchObject({ sourcePath: inputPath, mode: 'transcode' })
  })

  test('reuses a conversion of the same file instead of doing it again, and picks a new name for a different file', async () => {
    const first = await converter(fakeSpawn()).prepare({ inputPath, outputDir })
    const spawn = fakeSpawn()
    const again = await converter(spawn).prepare({ inputPath, outputDir })

    expect(again).toMatchObject({ videoPath: first.videoPath, reused: true })
    expect(spawn.mock.calls.every(([, args]) => !args.includes('-y'))).toBe(true)

    fs.writeFileSync(inputPath, 'the file was changed and is now longer')
    const changed = await converter(fakeSpawn()).prepare({ inputPath, outputDir })
    expect(changed.videoPath).toBe(path.join(outputDir, '00027-2.mp4'))
    expect(fs.existsSync(first.videoPath)).toBe(true)
  })

  test('does not touch a file the player can already open', async () => {
    const spawn = fakeSpawn({ report: MP4_REPORT })
    const result = await converter(spawn).prepare({ inputPath: path.join(directory, 'cat.mp4'), outputDir })
    expect(result).toMatchObject({ status: 'ready', videoPath: path.join(directory, 'cat.mp4'), converted: false, frameRate: 30 })
    expect(fs.existsSync(outputDir)).toBe(false)
  })

  test('stops and cleans up when cancelled', async () => {
    const controller = new AbortController()
    const spawn = fakeSpawn({
      onConvert: (child, args) => {
        fs.writeFileSync(args.at(-1), 'half of the video')
        controller.abort()
      }
    })
    const result = await converter(spawn).prepare({ inputPath, outputDir, signal: controller.signal })

    expect(result).toEqual({ status: 'cancelled' })
    expect(fs.readdirSync(outputDir)).toEqual([])
  })

  test('reports a failed conversion with the end of ffmpeg\'s message and leaves nothing behind', async () => {
    const spawn = fakeSpawn({
      onConvert: (child, args) => {
        fs.writeFileSync(args.at(-1), 'broken')
        child.stderr.emit('data', Buffer.from('line one\nError while decoding stream\nConversion failed!\n'))
        child.emit('close', 1)
      }
    })

    await expect(converter(spawn).prepare({ inputPath, outputDir })).rejects.toThrow(/Konwersja nie powiodła się: .*Conversion failed!/)
    expect(fs.readdirSync(outputDir)).toEqual([])
  })

  test('explains when ffmpeg is missing or the file is not a video', async () => {
    await expect(createVideoConverter({}).prepare({ inputPath, outputDir })).rejects.toThrow('ffmpeg-missing')
    await expect(converter(fakeSpawn({ report: 'No such file or directory' })).probe(inputPath)).rejects.toThrow('Nie rozpoznano wideo')
  })

  test('probe gives the frame rate and the length', async () => {
    const info = await converter(fakeSpawn()).probe(inputPath)
    expect(info.video.fps).toBe(25)
    expect(info.duration).toBeCloseTo(108.06)
  })
})

describe('Video converter with the real ffmpeg', () => {
  let directory

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-real-'))
  })

  afterAll(() => fs.rmSync(directory, { recursive: true, force: true }))

  test('turns an interlaced MTS with AC-3 sound into a progressive MP4 with AAC sound', async () => {
    const source = path.join(directory, 'camera.MTS')
    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x180:rate=25',
      '-f', 'lavfi', '-i', 'sine=duration=2:frequency=440',
      '-vf', 'interlace=scan=tff', '-c:v', 'libx264', '-flags', '+ilme+ildct', '-x264opts', 'tff=1', '-pix_fmt', 'yuv420p',
      '-c:a', 'ac3', '-ac', '2', '-shortest', '-f', 'mpegts', source
    ])

    const real = createVideoConverter({ ffmpegPath })
    const before = await real.probe(source)
    expect(before.video.interlaced).toBe(true)
    expect(before.audio.codec).toBe('ac3')

    const progress = jest.fn()
    const result = await real.prepare({ inputPath: source, outputDir: path.join(directory, 'videos'), onProgress: progress })
    expect(result).toMatchObject({ status: 'converted', mode: 'transcode', sourcePath: source })
    expect(result.frameRate).toBeGreaterThan(0)
    expect(progress).toHaveBeenLastCalledWith(100)

    const after = await real.probe(result.videoPath)
    expect(after.video).toMatchObject({ codec: 'h264', interlaced: false })
    expect(after.audio.codec).toBe('aac')
    expect(after.duration).toBeCloseTo(before.duration, 0)
    expect(planConversion(after, '.mp4').action).toBe('none')
  }, 60000)

  test('says clearly when the file is not a video', async () => {
    const junk = path.join(directory, 'notes.mts')
    fs.writeFileSync(junk, 'this is not a video')
    await expect(createVideoConverter({ ffmpegPath }).prepare({ inputPath: junk, outputDir: path.join(directory, 'videos') }))
      .rejects.toThrow('Nie rozpoznano wideo')
  }, 30000)
})

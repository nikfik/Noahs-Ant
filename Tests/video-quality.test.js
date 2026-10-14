import {
  estimateOutput,
  matchPreset,
  normalizeQualitySettings,
  planConversion,
  presetSettings,
  qualitySuffix,
  resolveTarget
} from '../public/scripts/shared/video-quality.js'

const camera = { duration: 100, video: { codec: 'h264', width: 1920, height: 1080, fps: 25, interlaced: true }, audio: { codec: 'ac3' } }
const phone = { duration: 60, video: { codec: 'h264', width: 1920, height: 1080, fps: 60, interlaced: false }, audio: { codec: 'aac' } }

describe('video quality settings', () => {
  test('presets round-trip and unknown values fall back to the original quality', () => {
    expect(matchPreset(presetSettings('light'))).toBe('light')
    expect(normalizeQualitySettings(null)).toEqual({ preset: 'original', maxHeight: null, maxFrameRate: null, quality: 'original' })
    expect(normalizeQualitySettings({ maxHeight: 700, maxFrameRate: 'x', quality: 'ultra' })).toEqual({ preset: 'custom', maxHeight: 700, maxFrameRate: null, quality: 'original' })
  })

  test('original settings keep the old behaviour: only incompatible files are converted', () => {
    const plan = planConversion(camera, '.MTS')
    expect(plan).toMatchObject({ action: 'transcode', frameRate: 50 })
    expect(plan.target).toMatchObject({ deinterlaceMode: 1, height: null, limitFrameRate: false, crf: 20 })
    expect(qualitySuffix(plan)).toBe('')
    expect(planConversion(phone, '.mp4').action).toBe('none')
  })

  test('a lighter preset turns a playable file into a conversion', () => {
    const plan = planConversion(phone, '.mp4', presetSettings('light'))
    expect(plan.action).toBe('transcode')
    expect(plan.target).toMatchObject({ height: 720, width: 1280, frameRate: 25, limitFrameRate: true, crf: 23 })
    expect(qualitySuffix(plan)).toBe('-720p-25fps-crf23')
  })

  test('caps never enlarge the picture or raise the frame rate', () => {
    const small = { ...phone, video: { ...phone.video, width: 640, height: 360, fps: 15 } }
    const target = resolveTarget(small.video, { maxHeight: 1080, maxFrameRate: 30, quality: 'original' })
    expect(target).toMatchObject({ height: null, frameRate: 15, limitFrameRate: false })
  })

  test('interlaced video below the field rate is de-interlaced to one picture per frame, or to field pictures first when the cap is higher', () => {
    const target = resolveTarget(camera.video, { maxHeight: null, maxFrameRate: 25, quality: 'medium' })
    expect(target).toMatchObject({ deinterlaceMode: 0, frameRate: 25, limitFrameRate: false })
    const capped = resolveTarget(camera.video, { maxHeight: null, maxFrameRate: 30, quality: 'medium' })
    expect(capped).toMatchObject({ deinterlaceMode: 1, frameRate: 30, limitFrameRate: true })
  })

  test('smaller settings give a smaller estimate', () => {
    const size = (id) => estimateOutput(phone, planConversion(phone, '.mp4', presetSettings(id)), 500e6).sizeBytes
    expect(size('very-light')).toBeLessThan(size('light'))
    expect(size('light')).toBeLessThan(size('balanced'))
    expect(estimateOutput(phone, planConversion(phone, '.mp4'), 500e6)).toEqual({ sizeBytes: 500e6, seconds: 0 })
  })
})

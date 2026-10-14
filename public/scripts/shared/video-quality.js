// How a picked video is prepared for the player. Shared by the converter (main process) and the quality dialog
// (workspace), so the estimate shown to the user and the conversion that follows are decided by the same rules.

// What the player (Chromium inside Electron) can open directly.
const NATIVE_CONTAINERS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv'])
const NATIVE_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1'])
const NATIVE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le'])
// Audio that can be copied into an MP4 file as it is; everything else is converted to AAC.
export const MP4_COPYABLE_AUDIO = new Set(['aac', 'mp3'])

// x264 "constant rate factor": lower means a bigger file with a better picture.
export const QUALITY_LEVELS = [
  { id: 'original', label: 'Jak w oryginale', crf: 20 },
  { id: 'high', label: 'Wysoka', crf: 20 },
  { id: 'medium', label: 'Średnia', crf: 23 },
  { id: 'low', label: 'Niska (mały plik)', crf: 28 }
]

export const RESOLUTION_CHOICES = [
  { value: null, label: 'Oryginalna' },
  { value: 1080, label: '1080p' },
  { value: 720, label: '720p' },
  { value: 480, label: '480p' },
  { value: 360, label: '360p' }
]

export const FRAME_RATE_CHOICES = [
  { value: null, label: 'Oryginalna' },
  ...[60, 50, 30, 25, 24, 15, 10].map((value) => ({ value, label: `${value} klatek/s` }))
]

export const QUALITY_PRESETS = [
  { id: 'original', label: 'Oryginalna jakość', description: 'Bez zmniejszania. Plik jest konwertowany tylko wtedy, gdy odtwarzacz inaczej go nie otworzy.', maxHeight: null, maxFrameRate: null, quality: 'original' },
  { id: 'balanced', label: 'Zrównoważona', description: 'Do 1080p i 30 klatek/s. Dobra na większości komputerów.', maxHeight: 1080, maxFrameRate: 30, quality: 'medium' },
  { id: 'light', label: 'Lekka', description: 'Do 720p i 25 klatek/s. Płynnie działa także na słabszych komputerach.', maxHeight: 720, maxFrameRate: 25, quality: 'medium' },
  { id: 'very-light', label: 'Bardzo lekka', description: 'Do 480p i 25 klatek/s. Najmniejszy plik, ale mało szczegółów.', maxHeight: 480, maxFrameRate: 25, quality: 'low' }
]

const qualityIds = new Set(QUALITY_LEVELS.map((level) => level.id))
const positiveOrNull = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null

export function presetSettings(presetId) {
  const preset = QUALITY_PRESETS.find((item) => item.id === presetId) || QUALITY_PRESETS[0]
  return { preset: preset.id, maxHeight: preset.maxHeight, maxFrameRate: preset.maxFrameRate, quality: preset.quality }
}

// The preset that these exact values match, or "custom".
export function matchPreset(settings) {
  return QUALITY_PRESETS.find((preset) =>
    preset.maxHeight === settings.maxHeight && preset.maxFrameRate === settings.maxFrameRate && preset.quality === settings.quality
  )?.id ?? 'custom'
}

export function normalizeQualitySettings(value) {
  const source = value && typeof value === 'object' ? value : {}
  const settings = {
    maxHeight: positiveOrNull(source.maxHeight),
    maxFrameRate: positiveOrNull(source.maxFrameRate),
    quality: qualityIds.has(source.quality) ? source.quality : 'original'
  }
  return { preset: matchPreset(settings), ...settings }
}

const toSeconds = (value) => Math.round(value * 10) / 10

// What the converted video would look like: size, picture rate and how interlacing is handled.
// A de-interlaced video can keep both fields of every frame (25i -> 50 pictures per second) or just one (25).
export function resolveTarget(video, settings) {
  const nativeRate = video.fps ? (video.interlaced ? video.fps * 2 : video.fps) : null
  const cap = settings.maxFrameRate
  const frameRate = nativeRate && cap && cap < nativeRate ? cap : nativeRate
  const deinterlaceMode = !video.interlaced ? null : (frameRate && frameRate <= video.fps ? 0 : 1)
  const height = settings.maxHeight && video.height && settings.maxHeight < video.height ? settings.maxHeight : null
  const lowersFrameRate = Boolean(frameRate && video.fps && frameRate < video.fps)

  return {
    height,
    width: height && video.width && video.height ? Math.round(video.width * height / video.height / 2) * 2 : null,
    frameRate,
    deinterlaceMode,
    // The "fps" filter is needed only when the rate has to go below what de-interlacing (or the source) already gives.
    limitFrameRate: Boolean(frameRate && nativeRate && frameRate < (deinterlaceMode === 0 ? video.fps : nativeRate)),
    lowersResolution: height !== null,
    lowersFrameRate,
    // Below the rate a plain conversion would give (for interlaced video that is the doubled field rate).
    belowNativeRate: Boolean(frameRate && nativeRate && frameRate < nativeRate),
    crf: (QUALITY_LEVELS.find((level) => level.id === settings.quality) ?? QUALITY_LEVELS[0]).crf
  }
}

// Decides what a file needs: nothing, a quick repackaging (container or audio only), or a full re-encode.
export function planConversion(probe, extension, settings = presetSettings('original')) {
  const reasons = []
  const videoPlays = NATIVE_VIDEO_CODECS.has(probe.video.codec)
  const audioPlays = !probe.audio || NATIVE_AUDIO_CODECS.has(probe.audio.codec)
  const target = resolveTarget(probe.video, settings)
  if (!videoPlays) reasons.push(`kodek wideo ${probe.video.codec}`)
  if (probe.video.interlaced) reasons.push('przeplot (interlace)')
  if (!NATIVE_CONTAINERS.has(extension.toLowerCase())) reasons.push(`kontener ${extension.toLowerCase() || 'nieznany'}`)
  if (!audioPlays) reasons.push(`dźwięk ${probe.audio.codec}`)
  if (target.lowersResolution) reasons.push(`rozdzielczość ${target.height}p`)
  if (target.lowersFrameRate) reasons.push(`${toSeconds(target.frameRate)} klatek/s`)
  if (settings.quality !== 'original') reasons.push(`jakość: ${QUALITY_LEVELS.find((level) => level.id === settings.quality).label.toLowerCase()}`)

  const reencode = !videoPlays || probe.video.interlaced || target.lowersResolution || target.lowersFrameRate || settings.quality !== 'original'
  const action = reencode ? 'transcode' : reasons.length ? 'remux' : 'none'
  return {
    action,
    reasons,
    interlaced: probe.video.interlaced,
    quality: settings.quality,
    target,
    frameRate: action === 'transcode' ? target.frameRate : probe.video.fps
  }
}

// Rough numbers measured on a real 1080i camera file; the real result depends on the picture and on the computer.
const BITS_PER_PIXEL = { 20: 0.06, 23: 0.05, 28: 0.022 }
const AUDIO_BYTES_PER_SECOND = 16000

export function estimateOutput(probe, plan, originalSize) {
  const duration = probe.duration || 0
  if (plan.action === 'none') return { sizeBytes: originalSize, seconds: 0 }
  if (plan.action === 'remux') return { sizeBytes: originalSize, seconds: duration * 0.07 }

  const { target } = plan
  const width = target.width ?? probe.video.width ?? 0
  const height = target.height ?? probe.video.height ?? 0
  const pixelsPerSecond = width * height * (target.frameRate || probe.video.fps || 25)
  const sizeBytes = (pixelsPerSecond * (BITS_PER_PIXEL[target.crf] ?? 0.05) / 8 + AUDIO_BYTES_PER_SECOND) * duration
  // Decoding the source is the floor (about a fifth of the video's length); a larger output picture adds encoding time.
  const seconds = duration * Math.max(0.18, 0.004 * pixelsPerSecond / 1e6)
  return { sizeBytes, seconds }
}

// A short, readable name for the output file, so different qualities of one video do not overwrite each other.
export function qualitySuffix(plan) {
  if (plan.action !== 'transcode') return ''
  const { target } = plan
  const parts = []
  if (target.height) parts.push(`${target.height}p`)
  if (target.belowNativeRate) parts.push(`${Math.round(target.frameRate)}fps`)
  if (plan.quality !== 'original') parts.push(`crf${target.crf}`)
  return parts.length ? `-${parts.join('-')}` : ''
}

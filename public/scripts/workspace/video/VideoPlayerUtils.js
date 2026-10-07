const DEFAULT_FRAME_STEP = 1 / 30
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

function toFileUrl(videoPath) {
  const cleanedPath = String(videoPath || '').trim().replace(/\\/g, '/')

  if (!cleanedPath) {
    return ''
  }

  if (cleanedPath.startsWith('file://')) {
    return cleanedPath
  }

  if (/^[a-zA-Z]:\//.test(cleanedPath)) {
    return `file:///${cleanedPath}`
  }

  return `file://${cleanedPath.startsWith('/') ? cleanedPath : `/${cleanedPath}`}`
}

function formatTime(value) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const minutes = Math.floor(safeValue / 60)
  const seconds = Math.floor(safeValue % 60)

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const VideoPlayerUtils = {
  DEFAULT_FRAME_STEP,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  toFileUrl,
  formatTime
}

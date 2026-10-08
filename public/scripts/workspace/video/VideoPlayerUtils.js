const DEFAULT_FRAME_STEP = 1 / 30
// 1 = the picture fits the window; zooming out further would only shrink it into black.
const ZOOM_MIN = 1
const ZOOM_MAX = 8
const ZOOM_BUTTON_FACTOR = 1.25
const ZOOM_WHEEL_FACTOR = 1.15

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

export const VideoPlayerUtils = {
  DEFAULT_FRAME_STEP,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_BUTTON_FACTOR,
  ZOOM_WHEEL_FACTOR,
  toFileUrl
}

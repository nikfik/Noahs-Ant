(function () {
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

  const normalizeShortcutValue = (value) => {
    if (!value) return ''
    const text = String(value).trim()
    if (!text) return ''
    return text.length === 1 ? text.toUpperCase() : text
  }

  const normalizeShortcutEntry = (value) => {
    if (typeof value === 'string') {
      return { primary: normalizeShortcutValue(value), secondary: '', operator: '/' }
    }

    if (value && typeof value === 'object') {
      return {
        primary: normalizeShortcutValue(value.primary),
        secondary: normalizeShortcutValue(value.secondary),
        operator: value.operator === '+' ? '+' : '/'
      }
    }

    return { primary: '', secondary: '', operator: '/' }
  }

  function matchesShortcut(shortcut, event) {
    if (!shortcut) return false

    const primary = normalizeShortcutValue(shortcut.primary)
    const secondary = normalizeShortcutValue(shortcut.secondary)
    const key = normalizeShortcutValue(event.key || event.code)
    const pressed = key || normalizeShortcutValue(event.code)

    if (!primary && !secondary) return false

    const primaryMatches = primary && (
      pressed === primary ||
      pressed === `Key${primary}` ||
      pressed === `Digit${primary}`
    )

    const secondaryMatches = secondary && (
      (pressed === secondary) ||
      (secondary.toLowerCase() === 'shift' && event.shiftKey) ||
      (secondary.toLowerCase() === 'alt' && event.altKey) ||
      (secondary.toLowerCase() === 'ctrl' && event.ctrlKey) ||
      (secondary.toLowerCase() === 'control' && event.ctrlKey) ||
      (secondary.toLowerCase() === 'meta' && event.metaKey) ||
      (secondary.toLowerCase() === 'cmd' && event.metaKey)
    )

    if (!secondary) return primaryMatches

    if (shortcut.operator === '+') {
      return primaryMatches && secondaryMatches
    }

    return primaryMatches || secondaryMatches
  }

  window.VideoPlayerUtils = {
    DEFAULT_FRAME_STEP,
    ZOOM_MIN,
    ZOOM_MAX,
    ZOOM_STEP,
    toFileUrl,
    formatTime,
    normalizeShortcutValue,
    normalizeShortcutEntry,
    matchesShortcut
  }
})()

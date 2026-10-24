// Moves the video panel into a window of its own (e.g. on a second screen) and back.
// Only the page elements move: every script keeps running in the main window, so the timeline, the shortcuts and the
// metrics keep working exactly as before. The new window just shows the panel and hands the keys back.
const WINDOW_NAME = 'noahs-ant-video'
const BOUNDS_KEY = 'noahs-ant.video-window'
const CLOSED_CHECK_MS = 500
const DEFAULT_BOUNDS = { width: 960, height: 620 }

function loadBounds() {
  try {
    const bounds = JSON.parse(localStorage.getItem(BOUNDS_KEY) || 'null')
    return bounds && [bounds.width, bounds.height].every((value) => Number.isFinite(value) && value >= 300) ? bounds : DEFAULT_BOUNDS
  } catch (_error) {
    return DEFAULT_BOUNDS
  }
}

function saveBounds(child) {
  try {
    const bounds = { width: child.outerWidth, height: child.outerHeight, left: child.screenX, top: child.screenY }
    if ([bounds.width, bounds.height].every((value) => Number.isFinite(value) && value >= 300)) {
      localStorage.setItem(BOUNDS_KEY, JSON.stringify(bounds))
    }
  } catch (_error) {
    // The window then opens at its default size next time.
  }
}

const featuresFor = (bounds) => ['width', 'height', 'left', 'top']
  .filter((name) => Number.isFinite(bounds[name]))
  .map((name) => `${name}=${Math.round(bounds[name])}`)
  .join(',')

// Putting a video element into another document reloads it: the position, the speed, the volume and the playing state
// are lost, so they are taken before the move and put back after it.
function snapshot(video) {
  return {
    time: video.currentTime || 0,
    playing: !video.paused && !video.ended,
    rate: video.playbackRate,
    volume: video.volume,
    muted: video.muted
  }
}

// Call before the move: resolves once the video has reloaded in its new place (or after `timeoutMs` when it does not).
function armReload(video, timeoutMs) {
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer)
      video.removeEventListener('emptied', onEmptied)
      video.removeEventListener('loadeddata', finish)
      resolve()
    }
    const onEmptied = () => video.addEventListener('loadeddata', finish, { once: true })
    const timer = window.setTimeout(finish, timeoutMs)
    video.addEventListener('emptied', onEmptied, { once: true })
  })
}

async function applyState(video, saved) {
  video.playbackRate = saved.rate
  video.volume = saved.volume
  video.muted = saved.muted
  if (saved.time > 0) video.currentTime = saved.time
  if (saved.playing) {
    try {
      await video.play()
    } catch (error) {
      console.warn('Could not resume the video after moving it:', error)
    }
  }
}

export function createVideoPopout({
  panel,
  host,
  notice,
  video,
  url,
  open = (address, name, features) => window.open(address, name, features),
  onLayout = () => {},
  onToggle = () => {},
  timeoutMs = 1500,
  mainDocument = document,
  mainWindow = window
}) {
  let child = null
  let watcher = 0
  let themeObserver = null
  let moving = false

  const isOpen = () => Boolean(child) && !child.closed

  // The pop-out window does not receive the keys of the main window, so the keys pressed in it are passed on.
  function forwardKey(event) {
    if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    const copy = new mainWindow.KeyboardEvent(event.type, {
      key: event.key,
      code: event.code,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      repeat: event.repeat,
      bubbles: true,
      cancelable: true
    })
    mainDocument.body.dispatchEvent(copy)
    if (copy.defaultPrevented) event.preventDefault()
  }

  const copyTheme = () => {
    if (child?.document) child.document.documentElement.style.cssText = mainDocument.documentElement.style.cssText
  }

  async function moveTo(parent, saved) {
    const reloaded = armReload(video, timeoutMs)
    moving = true
    parent.appendChild(panel)
    await reloaded
    await applyState(video, saved)
    moving = false
    onLayout()
  }

  async function giveBack() {
    const closing = child
    if (!closing) return
    child = null
    window.clearInterval(watcher)
    themeObserver?.disconnect()
    themeObserver = null
    mainWindow.removeEventListener('pagehide', closeChild)
    saveBounds(closing)
    host.insertBefore(panel, notice)
    notice.hidden = true
    onToggle(false)
    // The element is already in the main window again; the video only needs its position back.
    onLayout()
    try {
      if (!closing.closed) closing.close()
    } catch (_error) {
      // The window is already gone.
    }
  }

  async function closeChild() {
    if (!child) return
    const saved = snapshot(video)
    const reloaded = armReload(video, timeoutMs)
    await giveBack()
    await reloaded
    await applyState(video, saved)
    onLayout()
  }

  async function openWindow() {
    if (isOpen()) {
      child.focus?.()
      return true
    }

    // Opening a window pauses the video, so its state is taken first.
    const saved = snapshot(video)
    const bounds = loadBounds()
    const opened = open(url, WINDOW_NAME, featuresFor(bounds))
    if (!opened) return false
    child = opened

    // The new window loads on its own; its page is ready once the host element exists.
    const target = await new Promise((resolve) => {
      const started = Date.now()
      const check = window.setInterval(() => {
        const slot = child?.document?.getElementById?.('video-popout-host')
        if (slot || Date.now() - started > 4000) {
          window.clearInterval(check)
          resolve(slot || null)
        }
      }, 30)
    })
    if (!target || !child) {
      await giveBack()
      return false
    }

    copyTheme()
    themeObserver = new mainWindow.MutationObserver(copyTheme)
    themeObserver.observe(mainDocument.documentElement, { attributes: true, attributeFilter: ['style'] })
    child.addEventListener('keydown', forwardKey, true)
    child.addEventListener('keyup', forwardKey, true)
    child.addEventListener('resize', () => onLayout())
    child.addEventListener('pagehide', () => { if (!moving) closeChild() })
    mainWindow.addEventListener('pagehide', closeChild)
    watcher = window.setInterval(() => { if (child?.closed) closeChild() }, CLOSED_CHECK_MS)

    notice.hidden = false
    await moveTo(target, saved)
    onToggle(true)
    return true
  }

  return {
    isOpen,
    open: openWindow,
    close: closeChild,
    toggle: () => (isOpen() ? closeChild() : openWindow())
  }
}

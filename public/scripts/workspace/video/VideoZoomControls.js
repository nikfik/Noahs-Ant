import { VideoPlayerUtils } from './VideoPlayerUtils.js'

// "+ 0" turns a negative zero into a plain 0, so a centred picture is never reported as translate(-0px).
const clamp = (value, min, max) => Math.min(max, Math.max(min, value)) + 0

// The size of the picture itself inside the player box (the box is letterboxed around it).
export function pictureSize(box, video) {
  const width = video?.videoWidth
  const height = video?.videoHeight
  if (!width || !height) return { width: box.width, height: box.height }

  const scale = Math.min(box.width / width, box.height / height)
  return { width: width * scale, height: height * scale }
}

// The picture may be moved only while it is bigger than the window, and never so far that an edge shows a gap.
export function clampPan(pan, zoom, box, picture) {
  const limitX = Math.max(0, (picture.width * zoom - box.width) / 2)
  const limitY = Math.max(0, (picture.height * zoom - box.height) / 2)
  return { x: clamp(pan.x, -limitX, limitX), y: clamp(pan.y, -limitY, limitY) }
}

// Zooms so that the point under the cursor stays where it is. `cursor` is measured from the centre of the window.
export function zoomAround(state, nextZoom, cursor) {
  const ratio = nextZoom / state.zoom
  return {
    zoom: nextZoom,
    pan: { x: cursor.x - (cursor.x - state.pan.x) * ratio, y: cursor.y - (cursor.y - state.pan.y) * ratio }
  }
}

export class VideoZoomControls {
  constructor(host, video) {
    this.video = video
    this.stage = host?.querySelector('.video-stage') || null
    this.stageInner = host?.querySelector('.video-stage-inner') || null
    this.zoomInput = null
    this.zoom = 1
    this.pan = { x: 0, y: 0 }
    this.panning = null
  }

  getBox() {
    const rect = this.stage?.getBoundingClientRect()
    return { width: rect?.width || 0, height: rect?.height || 0, left: rect?.left || 0, top: rect?.top || 0 }
  }

  apply() {
    if (!this.stageInner) return

    const box = this.getBox()
    this.pan = clampPan(this.pan, this.zoom, box, pictureSize(box, this.video))
    this.stageInner.style.transform = this.zoom === 1 ? '' : `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`
    this.stage?.classList.toggle('is-zoomed', this.zoom > 1)
    this.setZoomDisplay()
  }

  setZoomDisplay() {
    if (this.zoomInput) this.zoomInput.value = `${Math.round(this.zoom * 100)}%`
  }

  parseZoomInput(value) {
    const number = Number(String(value ?? '').trim().replace('%', '').replace(',', '.'))
    return Number.isFinite(number) && number > 0 ? number / 100 : null
  }

  setZoomAt(value, clientX, clientY) {
    const nextZoom = clamp(Number(value) || 1, VideoPlayerUtils.ZOOM_MIN, VideoPlayerUtils.ZOOM_MAX)
    const box = this.getBox()
    const cursor = typeof clientX === 'number' && typeof clientY === 'number'
      ? { x: clientX - (box.left + box.width / 2), y: clientY - (box.top + box.height / 2) }
      : { x: 0, y: 0 }

    const next = zoomAround({ zoom: this.zoom, pan: this.pan }, nextZoom, cursor)
    this.zoom = next.zoom
    this.pan = next.pan
    this.apply()
  }

  setZoom(value) {
    this.setZoomAt(value)
  }

  zoomBy(factor, clientX, clientY) {
    this.setZoomAt(this.zoom * factor, clientX, clientY)
  }

  // Double click: zoom in at the cursor, or back to fit when already zoomed.
  toggleZoom(clientX, clientY) {
    if (this.zoom > 1) this.fitToContainer()
    else this.setZoomAt(2, clientX, clientY)
  }

  fitToContainer() {
    this.zoom = 1
    this.pan = { x: 0, y: 0 }
    this.apply()
  }

  commitZoomInput() {
    const parsed = this.parseZoomInput(this.zoomInput?.value)
    if (parsed === null) this.setZoomDisplay()
    else this.setZoomAt(parsed)
  }

  attachInteractions({ zoomInput, zoomOutBtn, zoomInBtn, zoomFitBtn }) {
    this.zoomInput = zoomInput || null

    zoomInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      this.commitZoomInput()
      zoomInput.blur()
    })
    zoomInput?.addEventListener('blur', () => this.commitZoomInput())

    zoomInBtn?.addEventListener('click', () => this.zoomBy(VideoPlayerUtils.ZOOM_BUTTON_FACTOR))
    zoomOutBtn?.addEventListener('click', () => this.zoomBy(1 / VideoPlayerUtils.ZOOM_BUTTON_FACTOR))
    zoomFitBtn?.addEventListener('click', () => this.fitToContainer())

    this.stageInner?.addEventListener('pointerdown', (event) => {
      if (this.zoom <= 1 || event.button !== 0) return

      event.preventDefault()
      this.panning = { x: event.clientX, y: event.clientY, startPan: { ...this.pan } }
      this.stage?.classList.add('is-panning')
      this.stageInner.setPointerCapture?.(event.pointerId)
    })

    this.stageInner?.addEventListener('pointermove', (event) => {
      if (!this.panning) return

      this.pan = {
        x: this.panning.startPan.x + event.clientX - this.panning.x,
        y: this.panning.startPan.y + event.clientY - this.panning.y
      }
      this.apply()
    })

    const stopPanning = (event) => {
      this.panning = null
      this.stage?.classList.remove('is-panning')
      try { this.stageInner.releasePointerCapture?.(event.pointerId) } catch (_error) { /* nothing was captured */ }
    }
    this.stageInner?.addEventListener('pointerup', stopPanning)
    this.stageInner?.addEventListener('pointercancel', stopPanning)

    this.stage?.addEventListener('wheel', (event) => {
      event.preventDefault()
      const factor = event.deltaY > 0 ? 1 / VideoPlayerUtils.ZOOM_WHEEL_FACTOR : VideoPlayerUtils.ZOOM_WHEEL_FACTOR
      this.zoomBy(factor, event.clientX, event.clientY)
    }, { passive: false })

    window.addEventListener('resize', () => this.apply())
  }
}

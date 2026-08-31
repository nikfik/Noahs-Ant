(function () {
  class VideoZoomControls {
    constructor(host, video) {
      this.host = host
      this.video = video
      this.stageInner = this.host?.querySelector('.video-stage-inner') || null
      this.stage = this.host?.querySelector('.video-stage') || null
      this.zoom = 1
      this.panX = 0
      this.panY = 0
      this.isPanning = false
      this.startX = 0
      this.startY = 0
      this.startPanX = 0
      this.startPanY = 0
    }

    applyTransform() {
      if (!this.stageInner) return
      this.stageInner.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`
    }

    clampPan() {
      if (!this.video || !this.stageInner || !this.stage) return

      const viewport = this.stage
      const vw = viewport.clientWidth
      const vh = viewport.clientHeight
      const baseW = (this.video.clientWidth || this.video.videoWidth || vw)
      const baseH = (this.video.clientHeight || this.video.videoHeight || vh)
      const scaledW = baseW * this.zoom
      const scaledH = baseH * this.zoom

      if (scaledW <= vw) {
        this.panX = (vw - scaledW) / 2
      } else {
        const minX = vw - scaledW
        const maxX = 0
        this.panX = Math.min(maxX, Math.max(minX, this.panX))
      }

      if (scaledH <= vh) {
        this.panY = (vh - scaledH) / 2
      } else {
        const minY = vh - scaledH
        const maxY = 0
        this.panY = Math.min(maxY, Math.max(minY, this.panY))
      }
    }

    setZoomDisplay() {
      const node = this.host?.querySelector('#zoom-level-input')
      if (!node) return
      node.value = `${Math.round(this.zoom * 100)}%`
    }

    parseZoomInput(val) {
      if (val == null) return null
      const raw = String(val).trim().replace('%', '')
      const num = Number(raw)
      if (!Number.isFinite(num)) return null
      return Math.max(window.VideoPlayerUtils.ZOOM_MIN, Math.min(window.VideoPlayerUtils.ZOOM_MAX, num / 100))
    }

    setZoomAt(value, clientX, clientY) {
      const newZoom = Math.max(window.VideoPlayerUtils.ZOOM_MIN, Math.min(window.VideoPlayerUtils.ZOOM_MAX, Number(value) || 1))
      if (!this.stageInner) {
        this.zoom = newZoom
        return
      }

      const rect = this.stageInner.getBoundingClientRect()
      const vpX = (typeof clientX === 'number') ? (clientX - rect.left) : (rect.width / 2)
      const vpY = (typeof clientY === 'number') ? (clientY - rect.top) : (rect.height / 2)

      const newPanX = (((vpX + this.panX) * this.zoom) / newZoom) - vpX
      const newPanY = (((vpY + this.panY) * this.zoom) / newZoom) - vpY

      this.zoom = newZoom
      this.panX = newPanX
      this.panY = newPanY

      this.clampPan()
      this.applyTransform()
      this.setZoomDisplay()
    }

    setZoom(value) {
      this.setZoomAt(value)
    }

    fitToContainer() {
      this.zoom = 1
      this.panX = 0
      this.panY = 0
      if (this.video && this.stageInner) {
        this.video.style.maxWidth = '100%'
      }
      this.applyTransform()
      this.setZoomDisplay()
    }

    attachInteractions({ zoomInput, zoomOutBtn, zoomInBtn, zoomFitBtn }) {
      zoomInput?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          const parsed = this.parseZoomInput(zoomInput.value)
          if (parsed != null) this.setZoomAt(parsed)
          else this.setZoomDisplay()
          zoomInput.blur()
        }
      })

      zoomInput?.addEventListener('blur', () => {
        const parsed = this.parseZoomInput(zoomInput.value)
        if (parsed != null) this.setZoomAt(parsed)
        else this.setZoomDisplay()
      })

      zoomInBtn?.addEventListener('click', () => this.setZoom(this.zoom + window.VideoPlayerUtils.ZOOM_STEP))
      zoomOutBtn?.addEventListener('click', () => this.setZoom(this.zoom - window.VideoPlayerUtils.ZOOM_STEP))
      zoomFitBtn?.addEventListener('click', () => this.fitToContainer())

      this.stageInner?.addEventListener('pointerdown', (ev) => {
        ev.preventDefault()
        this.isPanning = true
        this.startX = ev.clientX
        this.startY = ev.clientY
        this.startPanX = this.panX
        this.startPanY = this.panY
        this.stageInner.setPointerCapture(ev.pointerId)
      })

      this.stageInner?.addEventListener('pointermove', (ev) => {
        if (!this.isPanning) return
        const dx = ev.clientX - this.startX
        const dy = ev.clientY - this.startY
        this.panX = this.startPanX + dx
        this.panY = this.startPanY + dy
        this.clampPan()
        this.applyTransform()
      })

      this.stageInner?.addEventListener('pointerup', (ev) => {
        this.isPanning = false
        try { this.stageInner.releasePointerCapture(ev.pointerId) } catch (_error) {}
      })
      this.stageInner?.addEventListener('pointercancel', () => { this.isPanning = false })

      this.stage?.addEventListener('wheel', (ev) => {
        if (!this.stageInner || !this.video) return
        ev.preventDefault()
        const delta = ev.deltaY
        const direction = delta > 0 ? -1 : 1
        const next = this.zoom + direction * window.VideoPlayerUtils.ZOOM_STEP
        this.setZoomAt(next, ev.clientX, ev.clientY)
      }, { passive: false })
    }
  }

  window.VideoZoomControls = VideoZoomControls
})()

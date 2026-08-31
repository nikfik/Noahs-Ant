// Updated workspace video module with fit-to-container and zoom controls
(function () {
  const DEFAULT_FRAME_STEP = 1 / 30

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

  async function loadProjectVideo(projectFile) {
    if (!projectFile || !window.electronAPI?.openProject) {
      return ''
    }

    try {
      const project = await window.electronAPI.openProject(projectFile)
      return typeof project?.videoPath === 'string' ? project.videoPath : ''
    } catch (_error) {
      return ''
    }
  }

  function renderVideoMarkup(videoPath) {
    const src = toFileUrl(videoPath)

    return `
      <div class="module-card video-card">
        <div class="video-player-shell">
          <div class="video-stage">
            <div class="video-stage-inner">
              <video id="video-player" class="video-player" playsinline preload="metadata" ${src ? `src="${src}"` : ''}></video>
            </div>
            <div class="video-state">${videoPath ? `Wybrane video: ${videoPath}` : 'Aktualnie żadne video nie jest załadowane.'}</div>
            <div class="video-zoom-controls">
              <button id="zoom-out-btn" class="module-action" type="button">−</button>
              <button id="zoom-fit-btn" class="module-action" type="button">Dopasuj</button>
              <button id="zoom-in-btn" class="module-action" type="button">+</button>
              <input id="zoom-level-input" class="video-zoom-input" value="100%" aria-label="Zoom percentage" />
            </div>
          </div>

          <div class="video-controls">
            <div class="video-control-row">
              <button id="skip-back-video-btn" class="module-action" type="button">⏪ 5s</button>
              <button id="step-back-video-btn" class="module-action" type="button">◀ 1k</button>
              <button id="play-pause-video-btn" class="module-action" type="button">▶ Odtwórz</button>
              <button id="step-forward-video-btn" class="module-action" type="button">1k ▶</button>
              <button id="skip-forward-video-btn" class="module-action" type="button">5s ⏩</button>
            </div>

            <div class="video-control-row">
              <label class="video-inline-field">
                <span>Prędkość</span>
                <select id="video-speed" class="video-select">
                  <option value="0.5">0.5x</option>
                  <option value="1" selected>1x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </label>

              <button id="mute-video-btn" class="module-action" type="button">🔊</button>
              <label class="video-inline-field video-volume-field">
                <span>Głośność</span>
                <input id="video-volume" type="range" min="0" max="1" step="0.05" value="1" />
              </label>
              <span id="video-time" class="video-time">00:00 / 00:00</span>
            </div>

            <div class="video-control-row seek-row">
              <label class="video-inline-field seek-field" for="video-seek">
                <span>Przewijanie</span>
                <input id="video-seek" type="range" min="0" max="100" step="0.1" value="0" />
              </label>
            </div>
          </div>

          <div class="video-actions">
            <button id="pick-video-btn" class="module-action" type="button">Wybierz plik wideo</button>
            <button id="open-video-placeholder" class="module-action ${videoPath ? '' : 'disabled'}" type="button" ${videoPath ? '' : 'disabled'}>Otwórz</button>
          </div>
        </div>
      </div>
    `
  }

  async function init(containerId = 'video-module', options = {}) {
    const host = document.getElementById(containerId)
    if (!host) return

    const projectFile = options.projectFile || ''
    const existingVideoPath = await loadProjectVideo(projectFile)

    host.innerHTML = renderVideoMarkup(existingVideoPath)

    const stateNode = host.querySelector('.video-state')
    const pickBtn = host.querySelector('#pick-video-btn')
    const openBtn = host.querySelector('#open-video-placeholder')
    const video = host.querySelector('#video-player')
    const playPauseBtn = host.querySelector('#play-pause-video-btn')
    const muteBtn = host.querySelector('#mute-video-btn')
    const seekInput = host.querySelector('#video-seek')
    const volumeInput = host.querySelector('#video-volume')
    const speedSelect = host.querySelector('#video-speed')
    const timeNode = host.querySelector('#video-time')
    const stepBackBtn = host.querySelector('#step-back-video-btn')
    const stepForwardBtn = host.querySelector('#step-forward-video-btn')
    const skipBackBtn = host.querySelector('#skip-back-video-btn')
    const skipForwardBtn = host.querySelector('#skip-forward-video-btn')
    const zoomOutBtn = host.querySelector('#zoom-out-btn')
    const zoomInBtn = host.querySelector('#zoom-in-btn')
    const zoomFitBtn = host.querySelector('#zoom-fit-btn')
    const zoomInput = host.querySelector('#zoom-level-input')

    function syncPlaybackButton() {
      if (!playPauseBtn) return
      playPauseBtn.textContent = video?.paused ? '▶ Odtwórz' : '❚❚ Zatrzymaj'
    }

    function syncMuteButton() {
      if (!muteBtn) return
      muteBtn.textContent = video?.muted ? '🔈' : '🔊'
    }

    function syncTimeLabel() {
      if (!timeNode || !video) return
      const current = Number(video.currentTime || 0)
      const duration = Number(video.duration || 0)
      timeNode.textContent = `${formatTime(current)} / ${formatTime(duration)}`

      if (Number.isFinite(duration) && duration > 0) {
        seekInput.value = Math.min(100, (current / duration) * 100)
      }
    }

    // Zoom and pan helpers (transform applied to stageInner)
    const stageInner = host.querySelector('.video-stage-inner')
    let zoom = 1
    let panX = 0
    let panY = 0
    const ZOOM_MIN = 0.25
    const ZOOM_MAX = 3
    const ZOOM_STEP = 0.1

    function applyTransform() {
      if (!stageInner) return
      stageInner.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`
    }

    function clampPan() {
      if (!video || !stageInner) return
      const viewport = host.querySelector('.video-stage')
      if (!viewport) return

      const vw = viewport.clientWidth
      const vh = viewport.clientHeight

      // video.clientWidth/clientHeight reflect layout size; fallback to intrinsic size
      const baseW = (video.clientWidth || video.videoWidth || vw)
      const baseH = (video.clientHeight || video.videoHeight || vh)
      const scaledW = baseW * zoom
      const scaledH = baseH * zoom

      // If content smaller than viewport, center it and lock pan on that axis
      if (scaledW <= vw) {
        panX = (vw - scaledW) / 2
      } else {
        const minX = vw - scaledW
        const maxX = 0
        panX = Math.min(maxX, Math.max(minX, panX))
      }

      if (scaledH <= vh) {
        panY = (vh - scaledH) / 2
      } else {
        const minY = vh - scaledH
        const maxY = 0
        panY = Math.min(maxY, Math.max(minY, panY))
      }
    }

    function setZoomAt(value, clientX, clientY) {
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(value) || 1))
      if (!stageInner) { zoom = newZoom; return }

      // clientX/Y are viewport coords; compute X_vp relative to stageInner
      const rect = stageInner.getBoundingClientRect()
      const vpX = (typeof clientX === 'number') ? (clientX - rect.left) : (rect.width / 2)
      const vpY = (typeof clientY === 'number') ? (clientY - rect.top) : (rect.height / 2)

      // Compute new pan so the point under cursor stays stationary.
      // Old screen position: (p + pan) * zoom
      // New pan must satisfy: (p + newPan) * newZoom = (p + pan) * zoom
      // => newPan = ( (p + pan) * zoom / newZoom ) - p
      const newPanX = ((vpX + panX) * zoom / newZoom) - vpX
      const newPanY = ((vpY + panY) * zoom / newZoom) - vpY

      zoom = newZoom
      panX = newPanX
      panY = newPanY

      clampPan()
      applyTransform()

      setZoomDisplay()
    }

    function setZoom(value) {
      setZoomAt(value)
    }

    function fitToContainer() {
      zoom = 1
      panX = 0
      panY = 0
      if (video && stageInner) {
        video.style.maxWidth = '100%'
      }
      applyTransform()
      setZoomDisplay()
    }

    function setZoomDisplay() {
      const node = host.querySelector('#zoom-level-input')
      if (!node) return
      node.value = `${Math.round(zoom * 100)}%`
    }

    function parseZoomInput(val) {
      if (val == null) return null
      const raw = String(val).trim().replace('%', '')
      const num = Number(raw)
      if (!Number.isFinite(num)) return null
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, num / 100))
    }

    function setVideoSource(videoPath) {
      if (!video) return

      const src = toFileUrl(videoPath)
      if (!src) {
        stateNode.textContent = 'Aktualnie żadne video nie jest załadowane.'
        return
      }

      video.src = src
      video.load()
      stateNode.textContent = `Wybrane video: ${videoPath}`
      openBtn?.removeAttribute('disabled')
      openBtn?.classList.remove('disabled')
      autoplayGuard = false
      // reset zoom when source changes
      fitToContainer()
    }

    let autoplayGuard = false

    if (video && existingVideoPath) {
      setVideoSource(existingVideoPath)
    }

    // Pointer-based panning
    let isPanning = false
    let startX = 0
    let startY = 0
    let startPanX = 0
    let startPanY = 0

    const stageInnerEl = host.querySelector('.video-stage-inner')
    stageInnerEl?.addEventListener('pointerdown', (ev) => {
      ev.preventDefault()
      isPanning = true
      startX = ev.clientX
      startY = ev.clientY
      startPanX = panX
      startPanY = panY
      stageInnerEl.setPointerCapture(ev.pointerId)
    })

    stageInnerEl?.addEventListener('pointermove', (ev) => {
      if (!isPanning) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      panX = startPanX + dx
      panY = startPanY + dy
      clampPan()
      applyTransform()
    })

    stageInnerEl?.addEventListener('pointerup', (ev) => {
      isPanning = false
      try { stageInnerEl.releasePointerCapture(ev.pointerId) } catch (_) {}
    })
    stageInnerEl?.addEventListener('pointercancel', () => { isPanning = false })

    // Wheel zoom centered on cursor
    const stageEl = host.querySelector('.video-stage')
    stageEl?.addEventListener('wheel', (ev) => {
      if (!stageInnerEl || !video) return
      ev.preventDefault()
      const delta = ev.deltaY
      const direction = delta > 0 ? -1 : 1
      const next = zoom + direction * ZOOM_STEP
      setZoomAt(next, ev.clientX, ev.clientY)
    }, { passive: false })

    // zoom input interactions
    zoomInput?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        const parsed = parseZoomInput(zoomInput.value)
        if (parsed != null) setZoomAt(parsed)
        else setZoomDisplay()
        zoomInput.blur()
      }
    })

    zoomInput?.addEventListener('blur', () => {
      const parsed = parseZoomInput(zoomInput.value)
      if (parsed != null) setZoomAt(parsed)
      else setZoomDisplay()
    })

    pickBtn?.addEventListener('click', async () => {
      if (!window.electronAPI?.selectVideoFile || !window.electronAPI?.saveProjectVideoPath) {
        stateNode.textContent = 'API do wyboru pliku video nie jest jeszcze dostępne.'
        return
      }

      const selected = await window.electronAPI.selectVideoFile()
      if (!selected) {
        stateNode.textContent = 'Anulowano wybór pliku wideo.'
        return
      }

      await window.electronAPI.saveProjectVideoPath(projectFile, selected)
      setVideoSource(selected)
    })

    openBtn?.addEventListener('click', () => {
      if (!video?.src) {
        stateNode.textContent = 'Najpierw wybierz plik wideo.'
        return
      }

      video.currentTime = 0
      stateNode.textContent = `Wybrane video: ${video.src}`
    })

    playPauseBtn?.addEventListener('click', async () => {
      if (!video) return

      try {
        if (video.paused) {
          await video.play()
        } else {
          video.pause()
        }
      } catch (_error) {
        stateNode.textContent = 'Nie udało się uruchomić odtwarzania wideo.'
      }

      syncPlaybackButton()
    })

    muteBtn?.addEventListener('click', () => {
      if (!video) return
      video.muted = !video.muted
      syncMuteButton()
    })

    volumeInput?.addEventListener('input', () => {
      if (!video) return
      const nextVolume = Number(volumeInput.value || 0)
      video.volume = Math.min(1, Math.max(0, nextVolume))
      video.muted = nextVolume === 0
      syncMuteButton()
    })

    speedSelect?.addEventListener('change', () => {
      if (!video) return
      video.playbackRate = Number(speedSelect.value || 1)
    })

    seekInput?.addEventListener('input', () => {
      if (!video || !Number.isFinite(video.duration)) return
      const nextSeek = Number(seekInput.value || 0)
      video.currentTime = (nextSeek / 100) * video.duration
      syncTimeLabel()
    })

    stepBackBtn?.addEventListener('click', () => {
      if (!video) return
      video.currentTime = Math.max(0, video.currentTime - DEFAULT_FRAME_STEP)
      syncTimeLabel()
    })

    stepForwardBtn?.addEventListener('click', () => {
      if (!video) return
      video.currentTime = Math.min(video.duration || 0, video.currentTime + DEFAULT_FRAME_STEP)
      syncTimeLabel()
    })

    skipBackBtn?.addEventListener('click', () => {
      if (!video) return
      video.currentTime = Math.max(0, video.currentTime - 5)
      syncTimeLabel()
    })

    skipForwardBtn?.addEventListener('click', () => {
      if (!video) return
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 5)
      syncTimeLabel()
    })

    // Zoom controls
    zoomInBtn?.addEventListener('click', () => setZoom(zoom + ZOOM_STEP))
    zoomOutBtn?.addEventListener('click', () => setZoom(zoom - ZOOM_STEP))
    zoomFitBtn?.addEventListener('click', () => fitToContainer())

    // double-click toggles zoom fit / 1.5x
    video?.addEventListener('dblclick', () => {
      if (!video) return
      if (video.style.transform) {
        fitToContainer()
      } else {
        setZoom(1.5)
      }
    })

    video?.addEventListener('play', () => {
      syncPlaybackButton()
    })

    video?.addEventListener('pause', () => {
      syncPlaybackButton()
    })

    video?.addEventListener('loadedmetadata', () => {
      seekInput.max = String(Math.max(100, video.duration || 0))
      syncTimeLabel()
    })

    video?.addEventListener('timeupdate', () => {
      syncTimeLabel()
    })

    syncPlaybackButton()
    syncMuteButton()
    syncTimeLabel()
  }

  window.WorkspaceVideoModule = {
    init,
  }
})()

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
              <span id="zoom-level" class="video-zoom-level">100%</span>
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

    // Zoom and fit helpers
    let zoom = 1
    const ZOOM_MIN = 0.25
    const ZOOM_MAX = 3
    const ZOOM_STEP = 0.1

    function setZoom(value) {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(value) || 1))
      if (video) {
        video.style.transform = `scale(${zoom})`
        video.style.maxWidth = 'none'
      }
      const zoomLevelNode = host.querySelector('#zoom-level')
      if (zoomLevelNode) zoomLevelNode.textContent = `${Math.round(zoom * 100)}%`
    }

    function fitToContainer() {
      zoom = 1
      if (video) {
        video.style.transform = ''
        video.style.maxWidth = '100%'
      }
      const zoomLevelNode = host.querySelector('#zoom-level')
      if (zoomLevelNode) zoomLevelNode.textContent = `100%`
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

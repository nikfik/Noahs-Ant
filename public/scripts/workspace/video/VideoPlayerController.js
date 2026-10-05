(function () {
  class VideoPlayerController {
    constructor(containerId = 'video-module', options = {}) {
      this.containerId = containerId
      this.projectFile = options.projectFile || ''
      this.host = null
      this.video = null
      this.stateNode = null
      this.openBtn = null
      this.playPauseBtn = null
      this.muteBtn = null
      this.seekInput = null
      this.volumeInput = null
      this.speedSelect = null
      this.timeNode = null
      this.stepBackBtn = null
      this.stepForwardBtn = null
      this.skipBackBtn = null
      this.skipForwardBtn = null
      this.zoomControls = null
      this.playbackControls = null
      this.shortcutState = {}
      this.autoplayGuard = false
      this.publishTimelineState = () => {
        if (!this.video) return
        const state = {
          currentTime: Number(this.video.currentTime) || 0,
          duration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
          paused: this.video.paused
        }
        window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: state }))
        return state
      }
    }

    async loadProgramShortcuts() {
      const defaultProgramShortcuts = {
        'move-forward': { primary: 'W', secondary: '', operator: '/' },
        'move-left': { primary: 'A', secondary: '', operator: '/' },
        'move-right': { primary: 'D', secondary: '', operator: '/' },
        sprint: { primary: 'Shift', secondary: '', operator: '/' },
        interact: { primary: 'E', secondary: '', operator: '/' },
        menu: { primary: 'Escape', secondary: '', operator: '/' }
      }

      try {
        const settings = await window.electronAPI?.getAppSettings?.()
        const savedRecords = Array.isArray(settings?.programShortcuts) ? settings.programShortcuts : []
        const merged = { ...defaultProgramShortcuts }

        savedRecords.forEach((entry) => {
          if (!entry || !entry.id) return
          merged[entry.id] = window.VideoPlayerUtils.normalizeShortcutEntry(entry.value)
        })

        return merged
      } catch (_error) {
        return { ...defaultProgramShortcuts }
      }
    }

    setVideoSource(videoPath) {
      if (!this.video) return

      const src = window.VideoPlayerUtils.toFileUrl(videoPath)
      if (!src) {
        this.stateNode.textContent = 'Aktualnie żadne video nie jest załadowane.'
        return
      }

      this.video.src = src
      this.video.load()
      this.stateNode.textContent = `Wybrane video: ${videoPath}`
      this.openBtn?.removeAttribute('disabled')
      this.openBtn?.classList.remove('disabled')
      this.autoplayGuard = false
      this.zoomControls?.fitToContainer()
    }

    buildShortcutActions() {
      return {
        'move-forward': () => this.stepForwardBtn?.click(),
        'move-left': () => this.stepBackBtn?.click(),
        'move-right': () => this.skipForwardBtn?.click(),
        sprint: () => {
          if (!this.video) return
          this.video.playbackRate = this.video.playbackRate === 1 ? 1.5 : 1
        },
        interact: () => this.playPauseBtn?.click(),
        menu: () => {
          if (!this.video) return
          this.video.pause()
          this.video.currentTime = 0
        }
      }
    }

    bindKeyboardShortcuts() {
      document.addEventListener('keydown', (event) => {
        const isTypingTarget = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
        if (isTypingTarget) return

        const activeShortcut = Object.entries(this.shortcutState).find(([, shortcut]) => window.VideoPlayerUtils.matchesShortcut(shortcut, event))
        if (!activeShortcut) return

        const [shortcutId, shortcut] = activeShortcut
        const action = this.buildShortcutActions()[shortcutId]
        if (!action) return

        event.preventDefault()
        action()
      })
    }

    bindEvents() {
      this.playPauseBtn?.addEventListener('click', () => {
        this.playbackControls.playPause(this.playPauseBtn)
      })

      this.muteBtn?.addEventListener('click', () => {
        this.playbackControls.toggleMute(this.muteBtn)
      })

      this.volumeInput?.addEventListener('input', () => {
        this.playbackControls.setVolume(this.volumeInput)
      })

      this.speedSelect?.addEventListener('change', () => {
        this.playbackControls.setPlaybackRate(this.speedSelect)
      })

      this.seekInput?.addEventListener('input', () => {
        this.playbackControls.seekTo(this.seekInput)
      })

      this.stepBackBtn?.addEventListener('click', () => {
        this.playbackControls.stepBackward()
      })

      this.stepForwardBtn?.addEventListener('click', () => {
        this.playbackControls.stepForward()
      })

      this.skipBackBtn?.addEventListener('click', () => {
        this.playbackControls.skipBackward()
      })

      this.skipForwardBtn?.addEventListener('click', () => {
        this.playbackControls.skipForward()
      })

      this.video?.addEventListener('dblclick', () => {
        if (this.video.style.transform) {
          this.zoomControls.fitToContainer()
        } else {
          this.zoomControls.setZoom(1.5)
        }
      })

      this.video?.addEventListener('play', () => {
        this.playbackControls.syncPlaybackButton(this.playPauseBtn)
      })

      this.video?.addEventListener('pause', () => {
        this.playbackControls.syncPlaybackButton(this.playPauseBtn)
      })

      this.video?.addEventListener('loadedmetadata', () => {
        if (this.seekInput) {
          this.seekInput.max = String(Math.max(100, this.video.duration || 0))
        }
        this.playbackControls.syncTimeLabel()
        this.publishTimelineState()
      })

      this.video?.addEventListener('timeupdate', () => {
        this.playbackControls.syncTimeLabel()
        this.publishTimelineState()
      })

      this.video?.addEventListener('seeked', this.publishTimelineState)
      this.video?.addEventListener('durationchange', this.publishTimelineState)
      this.video?.addEventListener('play', this.publishTimelineState)
      this.video?.addEventListener('pause', this.publishTimelineState)
      this.video?.addEventListener('ended', this.publishTimelineState)

      window.addEventListener('video-seek-request', (event) => {
        const time = Number(event.detail?.time)
        if (!this.video || !Number.isFinite(time) || !Number.isFinite(this.video.duration)) return
        this.video.currentTime = Math.max(0, Math.min(time, this.video.duration))
      })
      window.addEventListener('video-timeline-state-request', (event) => {
        event.detail?.respond?.(this.publishTimelineState())
      })

      this.pickBtn?.addEventListener('click', async () => {
        const selected = await VideoIOService.selectAndSaveProjectVideo(this.projectFile, this.stateNode)
        if (selected) {
          this.setVideoSource(selected)
        }
      })

      this.openBtn?.addEventListener('click', () => {
        if (!this.video?.src) {
          this.stateNode.textContent = 'Najpierw wybierz plik wideo.'
          return
        }

        this.video.currentTime = 0
        this.stateNode.textContent = `Wybrane video: ${this.video.src}`
      })
    }

    async init() {
      this.host = document.getElementById(this.containerId)
      if (!this.host) return

      const existingVideoPath = await VideoIOService.loadProjectVideo(this.projectFile)
      const ui = new window.VideoPlayerUI(this.host, existingVideoPath)
      const elements = ui.render()
      this.stateNode = elements.stateNode
      this.pickBtn = elements.pickBtn
      this.openBtn = elements.openBtn
      this.video = elements.video
      this.playPauseBtn = elements.playPauseBtn
      this.muteBtn = elements.muteBtn
      this.seekInput = elements.seekInput
      this.volumeInput = elements.volumeInput
      this.speedSelect = elements.speedSelect
      this.timeNode = elements.timeNode
      this.stepBackBtn = elements.stepBackBtn
      this.stepForwardBtn = elements.stepForwardBtn
      this.skipBackBtn = elements.skipBackBtn
      this.skipForwardBtn = elements.skipForwardBtn

      this.playbackControls = new window.VideoPlaybackControls(this.video, {
        timeNode: this.timeNode,
        seekInput: this.seekInput,
        stateNode: this.stateNode,
        onSyncState: () => {
          this.playbackControls.syncPlaybackButton(this.playPauseBtn)
          this.playbackControls.syncMuteButton(this.muteBtn)
        }
      })

      this.zoomControls = new window.VideoZoomControls(this.host, this.video)
      this.zoomControls.attachInteractions({
        zoomInput: elements.zoomInput,
        zoomOutBtn: elements.zoomOutBtn,
        zoomInBtn: elements.zoomInBtn,
        zoomFitBtn: elements.zoomFitBtn
      })

      this.shortcutState = await this.loadProgramShortcuts()
      this.bindKeyboardShortcuts()
      this.bindEvents()

      if (this.video && existingVideoPath) {
        this.setVideoSource(existingVideoPath)
      }

      this.playbackControls.syncPlaybackButton(this.playPauseBtn)
      this.playbackControls.syncMuteButton(this.muteBtn)
      this.playbackControls.syncTimeLabel()
      this.zoomControls.setZoomDisplay()
      this.publishTimelineState()
    }
  }

  window.VideoPlayerController = VideoPlayerController
})()

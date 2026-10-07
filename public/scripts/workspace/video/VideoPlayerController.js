import { VideoPlayerUtils } from './VideoPlayerUtils.js'
import { VideoIOService } from './VideoIOService.js'
import { VideoPlayerUI } from './VideoPlayerUI.js'
import { VideoPlaybackControls } from './VideoPlaybackControls.js'
import { VideoZoomControls } from './VideoZoomControls.js'

export class VideoPlayerController {
  constructor(containerId = 'video-module', options = {}) {
    this.containerId = containerId
    this.projectFile = options.projectFile || ''
    this.host = null
    this.video = null
    this.videoPath = ''
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
    this.autoplayGuard = false
    this.publishTimelineState = () => {
      if (!this.video) return
      const state = {
        currentTime: Number(this.video.currentTime) || 0,
        duration: Number.isFinite(this.video.duration) ? this.video.duration : 0,
        paused: this.video.paused,
        videoPath: this.videoPath
      }
      window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: state }))
      return state
    }
  }

  setVideoSource(videoPath) {
    if (!this.video) return

    const src = VideoPlayerUtils.toFileUrl(videoPath)
    if (!src) return

    this.videoPath = videoPath
    this.video.src = src
    this.video.load()
    this.openBtn?.removeAttribute('disabled')
    this.openBtn?.classList.remove('disabled')
    this.autoplayGuard = false
    this.zoomControls?.fitToContainer()
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
      const selected = await VideoIOService.selectAndSaveProjectVideo(this.projectFile)
      if (selected) {
        this.setVideoSource(selected)
      }
    })

    this.openBtn?.addEventListener('click', () => {
      if (!this.video?.src) return
      this.video.currentTime = 0
    })
  }

  async init() {
    this.host = document.getElementById(this.containerId)
    if (!this.host) return

    const existingVideoPath = await VideoIOService.loadProjectVideo(this.projectFile)
    const ui = new VideoPlayerUI(this.host, existingVideoPath)
    const elements = ui.render()
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

    this.playbackControls = new VideoPlaybackControls(this.video, {
      timeNode: this.timeNode,
      seekInput: this.seekInput,
      onSyncState: () => {
        this.playbackControls.syncPlaybackButton(this.playPauseBtn)
        this.playbackControls.syncMuteButton(this.muteBtn)
      }
    })

    this.zoomControls = new VideoZoomControls(this.host, this.video)
    this.zoomControls.attachInteractions({
      zoomInput: elements.zoomInput,
      zoomOutBtn: elements.zoomOutBtn,
      zoomInBtn: elements.zoomInBtn,
      zoomFitBtn: elements.zoomFitBtn
    })

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

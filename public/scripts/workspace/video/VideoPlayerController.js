import { VIDEO_VIEW } from '../../shared/workspace-view.js'
import { VideoPlayerUtils } from './VideoPlayerUtils.js'
import { VideoIOService } from './VideoIOService.js'
import { VideoPlayerUI } from './VideoPlayerUI.js'
import { VideoPlaybackControls } from './VideoPlaybackControls.js'
import { VideoZoomControls } from './VideoZoomControls.js'

export class VideoPlayerController {
  constructor(containerId = 'video-module', options = {}) {
    this.containerId = containerId
    this.trialCatalog = options.trialCatalog || null
    this.trialId = null
    this.host = null
    this.video = null
    this.videoPath = ''
    this.pickButtons = []
    this.emptyState = null
    this.playPauseBtn = null
    this.muteBtn = null
    this.volumeInput = null
    this.speedSelect = null
    this.stepBackBtn = null
    this.stepForwardBtn = null
    this.skipBackBtn = null
    this.skipForwardBtn = null
    this.zoomControls = null
    this.playbackControls = null
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
    if (this.emptyState) this.emptyState.hidden = true
    this.zoomControls?.fitToContainer()
  }

  clearVideo() {
    if (!this.video) return

    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
    this.videoPath = ''
    if (this.emptyState) this.emptyState.hidden = false
    this.zoomControls?.fitToContainer()
    this.playbackControls?.syncPlaybackButton(this.playPauseBtn)
    this.publishTimelineState()
  }

  // Each trial remembers its video length so the metrics can be calculated without opening the video.
  reportDuration() {
    const duration = this.video?.duration
    if (!this.trialCatalog || !this.trialId || !Number.isFinite(duration) || duration <= 0) return

    const trial = this.trialCatalog.getData().trials.find((item) => item.id === this.trialId)
    if (trial && Math.abs((trial.duration ?? 0) - duration) > 0.001) {
      this.trialCatalog.updateTrial(this.trialId, { duration }).catch((error) => console.error('Could not save video duration:', error))
    }
  }

  showTrial(trial) {
    if (!trial || (trial.id === this.trialId && trial.videoPath === this.videoPath)) return

    this.trialId = trial.id
    if (trial.videoPath) {
      this.setVideoSource(trial.videoPath)
    } else {
      this.clearVideo()
    }
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

    this.video?.addEventListener('dblclick', (event) => {
      this.zoomControls.toggleZoom(event.clientX, event.clientY)
    })

    this.video?.addEventListener('play', () => {
      this.playbackControls.syncPlaybackButton(this.playPauseBtn)
    })

    this.video?.addEventListener('pause', () => {
      this.playbackControls.syncPlaybackButton(this.playPauseBtn)
    })

    this.video?.addEventListener('loadedmetadata', () => {
      this.publishTimelineState()
      this.reportDuration()
      this.zoomControls?.apply()
    })

    this.video?.addEventListener('timeupdate', this.publishTimelineState)

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

    window.addEventListener('active-trial-changed', (event) => this.showTrial(event.detail?.trial))
    window.addEventListener('workspace-view-changed', (event) => {
      if (event.detail?.view !== VIDEO_VIEW) this.video?.pause()
    })

    this.pickButtons.forEach((button) => button.addEventListener('click', async () => {
      const selected = await VideoIOService.selectVideoFile()
      if (!selected) return

      this.setVideoSource(selected)
      await this.trialCatalog?.setVideoPath(this.trialId, selected)
    }))
  }

  async init() {
    this.host = document.getElementById(this.containerId)
    if (!this.host) return

    const activeTrial = this.trialCatalog?.getActiveTrial() || null
    this.trialId = activeTrial?.id ?? null
    const existingVideoPath = activeTrial?.videoPath || ''
    const ui = new VideoPlayerUI(this.host, existingVideoPath)
    const elements = ui.render()
    this.pickButtons = elements.pickButtons
    this.emptyState = elements.emptyState
    this.video = elements.video
    this.playPauseBtn = elements.playPauseBtn
    this.muteBtn = elements.muteBtn
    this.volumeInput = elements.volumeInput
    this.speedSelect = elements.speedSelect
    this.stepBackBtn = elements.stepBackBtn
    this.stepForwardBtn = elements.stepForwardBtn
    this.skipBackBtn = elements.skipBackBtn
    this.skipForwardBtn = elements.skipForwardBtn

    this.playbackControls = new VideoPlaybackControls(this.video, {
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
    this.zoomControls.setZoomDisplay()
    this.publishTimelineState()
  }
}

import { VIDEO_VIEW } from '../../shared/workspace-view.js'
import { VideoPlayerUtils } from './VideoPlayerUtils.js'
import { VideoIOService } from './VideoIOService.js'
import { VideoPlayerUI } from './VideoPlayerUI.js'
import { VideoPlaybackControls } from './VideoPlaybackControls.js'
import { VideoZoomControls } from './VideoZoomControls.js'
import { askVideoQuality } from './video-quality-dialog.js'
import { normalizeQualitySettings } from '../../shared/video-quality.js'
import { skipAt } from '../trials/skip-model.js'
import { icon } from './video-icons.js'
import { isSkipping } from '../trials/skip-playback.js'

const DEFAULT_SKIP_SECONDS = 5
const formatSkip = (seconds) => String(seconds).replace('.', ',')

// Buttons whose tooltip shows the keyboard shortcut: [element property, shortcut action, tooltip without the keys].
const SHORTCUT_BUTTONS = [
  ['skipBackBtn', 'skip-back', (skip) => `Cofnij o ${skip} s`],
  ['stepBackBtn', 'frame-back', () => 'Cofnij o 1 klatkę'],
  ['stepForwardBtn', 'frame-forward', () => 'Do przodu o 1 klatkę'],
  ['skipForwardBtn', 'skip-forward', (skip) => `Do przodu o ${skip} s`]
]

export class VideoPlayerController {
  constructor(containerId = 'video-module', options = {}) {
    this.containerId = containerId
    this.shortcutManager = options.shortcutManager || null
    this.projectId = options.projectFile || ''
    this.busy = null
    this.trialCatalog = options.trialCatalog || null
    this.trialId = null
    this.host = null
    this.video = null
    this.videoPath = ''
    this.pickButtons = []
    this.qualityBtn = null
    this.skipSeconds = DEFAULT_SKIP_SECONDS
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
    if (this.qualityBtn) this.qualityBtn.disabled = false
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
    if (this.qualityBtn) this.qualityBtn.disabled = true
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

  currentTrial() {
    return this.trialCatalog?.getData?.().trials.find((item) => item.id === this.trialId) || null
  }

  // While playing, a time skip of the trial is jumped over (unless playing skips was switched on in the timeline).
  jumpOverSkip() {
    if (!this.video || this.video.paused || this.video.seeking || !isSkipping()) return
    // A seek lands on a picture, which can lie a frame before the requested time; that must not count as still being
    // inside the skip, or the player would keep jumping and never move on.
    const skip = skipAt(this.currentTrial()?.skips, this.video.currentTime + this.frameStep())
    if (skip && this.video.currentTime >= skip.start) this.video.currentTime = skip.end
  }

  watchSkips() {
    const step = () => {
      this.skipFrame = 0
      if (!this.video || this.video.paused) return
      this.jumpOverSkip()
      this.skipFrame = requestAnimationFrame(step)
    }
    if (!this.skipFrame) this.skipFrame = requestAnimationFrame(step)
  }

  // One step is one real picture of the video (1/25 s, 1/50 s, ...); 1/30 s only when the frame rate is not known.
  frameStep() {
    return 1 / (this.currentTrial()?.frameRate || VideoPlayerUtils.DEFAULT_FRAME_RATE)
  }

  // Older trials do not know their frame rate yet; ask once and remember it.
  async ensureFrameRate() {
    const trial = this.currentTrial()
    if (!trial || trial.frameRate || !this.videoPath) return

    const info = await VideoIOService.probeVideo(this.videoPath)
    if (info?.frameRate) await this.trialCatalog.updateTrial(trial.id, { frameRate: info.frameRate })
  }

  showBusy(text, percent = null, { error = false } = {}) {
    const busy = this.busy
    if (!busy?.root) return

    busy.root.hidden = false
    busy.root.classList.toggle('is-error', error)
    busy.text.textContent = text
    busy.progress.hidden = error || percent === null
    if (percent !== null) busy.progress.value = percent
    busy.cancel.hidden = error
    busy.close.hidden = !error
  }

  hideBusy() {
    if (this.busy?.root) this.busy.root.hidden = true
  }

  async readVideoPreferences() {
    const saved = await window.electronAPI?.getAppSettings?.()
    return { saved: saved || {}, askQuality: saved?.video?.askQuality ?? true, quality: normalizeQualitySettings(saved?.video?.quality) }
  }

  // Remembers the last chosen quality, and stops asking when the user ticked "remember my choice".
  async saveVideoPreferences(preferences, quality, remember) {
    if (!window.electronAPI?.saveAppSettings) return
    await window.electronAPI.saveAppSettings({
      ...preferences.saved,
      video: { ...preferences.saved.video, askQuality: remember ? false : preferences.askQuality, quality }
    })
  }

  async chooseVideo() {
    const selected = await VideoIOService.selectVideoFile()
    if (selected) await this.importVideo(selected)
  }

  // Converts the original file of this trial's video again, e.g. in a lighter quality.
  async changeQuality() {
    const trial = this.currentTrial()
    const original = trial?.sourcePath || trial?.videoPath || this.videoPath
    if (original) await this.importVideo(original, { forceAsk: true })
  }

  async importVideo(filePath, { forceAsk = false } = {}) {
    const trialId = this.trialId
    this.showBusy('Sprawdzanie filmu…')
    try {
      const preferences = await this.readVideoPreferences()
      let quality = preferences.quality
      const info = await VideoIOService.inspectVideo(filePath)
      if (info && (forceAsk || preferences.askQuality)) {
        this.hideBusy()
        const answer = await askVideoQuality(info, quality)
        if (!answer) return
        quality = answer.settings
        this.showBusy('Sprawdzanie filmu…')
        await this.saveVideoPreferences(preferences, quality, answer.remember)
      }

      const result = await VideoIOService.prepareVideo(this.projectId, filePath, quality, (percent) => {
        this.showBusy(`Konwertowanie filmu… ${Math.round(percent)}%`, percent)
      })
      this.hideBusy()
      if (result.status === 'cancelled') return

      if (this.trialId === trialId) this.setVideoSource(result.videoPath)
      await this.trialCatalog?.updateTrial(trialId, {
        videoPath: result.videoPath,
        sourcePath: result.sourcePath || '',
        frameRate: result.frameRate ?? null
      })
    } catch (error) {
      console.error('Could not prepare the video:', error)
      this.showBusy(VideoIOService.friendlyError(error), null, { error: true })
    }
  }

  shortcutHint(actionId) {
    const keys = this.shortcutManager?.describe(actionId)
    return keys ? ` (${keys})` : ''
  }

  refreshShortcutHints() {
    const skip = formatSkip(this.skipSeconds)
    SHORTCUT_BUTTONS.forEach(([property, actionId, makeTitle]) => {
      if (this[property]) this[property].title = `${makeTitle(skip)}${this.shortcutHint(actionId)}`
    })
    if (this.skipBackBtn) {
      this.skipBackBtn.innerHTML = icon('skipBack', 20, { label: skip })
      this.skipBackBtn.setAttribute('aria-label', `Cofnij o ${skip} s`)
    }
    if (this.skipForwardBtn) {
      this.skipForwardBtn.innerHTML = icon('skipForward', 20, { label: skip })
      this.skipForwardBtn.setAttribute('aria-label', `Do przodu o ${skip} s`)
    }
    this.playbackControls?.syncPlaybackButton(this.playPauseBtn)
    this.playbackControls?.syncMuteButton(this.muteBtn)
  }

  // How far the jump buttons and shortcuts go is a setting; it is read once and kept up to date when it changes.
  setSkipSeconds(value) {
    const seconds = Number(value)
    this.skipSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_SKIP_SECONDS
    this.refreshShortcutHints()
  }

  watchSkipSeconds() {
    const api = window.electronAPI
    api?.getAppSettings?.()
      ?.then((settings) => this.setSkipSeconds(settings?.video?.skipSeconds))
      .catch((error) => console.error('Could not read the jump length:', error))
    api?.onSettingsChange?.((settings) => this.setSkipSeconds(settings?.video?.skipSeconds))
  }

  registerShortcuts() {
    const manager = this.shortcutManager
    if (!manager) return

    manager.register('play-pause', () => this.playbackControls.playPause(this.playPauseBtn))
    manager.register('skip-forward', () => this.playbackControls.skipForward(), { allowRepeat: true })
    manager.register('skip-back', () => this.playbackControls.skipBackward(), { allowRepeat: true })
    manager.register('frame-forward', () => this.playbackControls.stepForward(), { allowRepeat: true })
    manager.register('frame-back', () => this.playbackControls.stepBackward(), { allowRepeat: true })
    manager.register('toggle-mute', () => this.playbackControls.toggleMute(this.muteBtn))
    manager.subscribe(() => this.refreshShortcutHints())
  }

  showTrial(trial) {
    if (!trial || (trial.id === this.trialId && trial.videoPath === this.videoPath)) return

    this.trialId = trial.id
    if (trial.videoPath) {
      this.setVideoSource(trial.videoPath)
      this.ensureFrameRate().catch((error) => console.error('Could not read the frame rate:', error))
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
      this.jumpOverSkip()
      this.watchSkips()
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
    this.video?.addEventListener('timeupdate', () => this.jumpOverSkip())

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

    this.pickButtons.forEach((button) => button.addEventListener('click', () => this.chooseVideo()))
    this.qualityBtn?.addEventListener('click', () => this.changeQuality())
    this.busy?.cancel?.addEventListener('click', () => VideoIOService.cancelConversion())
    this.busy?.close?.addEventListener('click', () => this.hideBusy())
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
    this.qualityBtn = elements.qualityBtn
    this.emptyState = elements.emptyState
    this.busy = elements.busy
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
      getHint: (actionId) => this.shortcutHint(actionId),
      getFrameStep: () => this.frameStep(),
      getSkipSeconds: () => this.skipSeconds,
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
    this.registerShortcuts()
    this.refreshShortcutHints()
    this.watchSkipSeconds()

    if (this.video && existingVideoPath) {
      this.setVideoSource(existingVideoPath)
      this.ensureFrameRate().catch((error) => console.error('Could not read the frame rate:', error))
    }

    this.playbackControls.syncPlaybackButton(this.playPauseBtn)
    this.playbackControls.syncMuteButton(this.muteBtn)
    this.zoomControls.setZoomDisplay()
    this.publishTimelineState()
  }
}

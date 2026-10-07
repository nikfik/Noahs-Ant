import { VideoPlayerUtils } from './VideoPlayerUtils.js'

export class VideoPlaybackControls {
  constructor(video, { timeNode, onSyncState } = {}) {
    this.video = video
    this.timeNode = timeNode
    this.onSyncState = onSyncState || (() => {})
  }

  syncPlaybackButton(playPauseBtn) {
    if (!playPauseBtn || !this.video) return
    playPauseBtn.textContent = this.video.paused ? '▶ Odtwórz' : '❚❚ Zatrzymaj'
  }

  syncMuteButton(muteBtn) {
    if (!muteBtn || !this.video) return
    muteBtn.textContent = this.video.muted ? '🔈' : '🔊'
  }

  syncTimeLabel() {
    if (!this.timeNode || !this.video) return
    const current = Number(this.video.currentTime || 0)
    const duration = Number(this.video.duration || 0)
    this.timeNode.textContent = `${VideoPlayerUtils.formatTime(current)} / ${VideoPlayerUtils.formatTime(duration)}`
  }

  async playPause(playPauseBtn) {
    if (!this.video) return

    try {
      if (this.video.paused) {
        await this.video.play()
      } else {
        this.video.pause()
      }
    } catch (error) {
      console.warn('Nie udało się uruchomić odtwarzania wideo:', error)
    }

    this.syncPlaybackButton(playPauseBtn)
    this.onSyncState()
  }

  toggleMute(muteBtn) {
    if (!this.video) return
    this.video.muted = !this.video.muted
    this.syncMuteButton(muteBtn)
    this.onSyncState()
  }

  setVolume(volumeInput) {
    if (!this.video || !volumeInput) return
    const nextVolume = Number(volumeInput.value || 0)
    this.video.volume = Math.min(1, Math.max(0, nextVolume))
    this.video.muted = nextVolume === 0
    this.syncMuteButton(volumeInput.closest('.video-controls')?.querySelector('#mute-video-btn'))
    this.onSyncState()
  }

  setPlaybackRate(speedSelect) {
    if (!this.video || !speedSelect) return
    this.video.playbackRate = Number(speedSelect.value || 1)
  }

  stepBackward() {
    if (!this.video) return
    this.video.currentTime = Math.max(0, this.video.currentTime - VideoPlayerUtils.DEFAULT_FRAME_STEP)
    this.syncTimeLabel()
  }

  stepForward() {
    if (!this.video) return
    this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + VideoPlayerUtils.DEFAULT_FRAME_STEP)
    this.syncTimeLabel()
  }

  skipBackward() {
    if (!this.video) return
    this.video.currentTime = Math.max(0, this.video.currentTime - 5)
    this.syncTimeLabel()
  }

  skipForward() {
    if (!this.video) return
    this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5)
    this.syncTimeLabel()
  }
}

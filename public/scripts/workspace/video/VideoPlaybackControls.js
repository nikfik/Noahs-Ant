import { VideoPlayerUtils } from './VideoPlayerUtils.js'
import { icon } from './video-icons.js'

export class VideoPlaybackControls {
  constructor(video, { onSyncState, getHint, getFrameStep } = {}) {
    this.video = video
    this.getFrameStep = getFrameStep || (() => VideoPlayerUtils.DEFAULT_FRAME_STEP)
    this.onSyncState = onSyncState || (() => {})
    this.getHint = getHint || (() => '')
  }

  syncPlaybackButton(playPauseBtn) {
    if (!playPauseBtn || !this.video) return

    const playing = !this.video.paused
    playPauseBtn.innerHTML = icon(playing ? 'pause' : 'play', 20)
    const name = playing ? 'Zatrzymaj' : 'Odtwórz'
    playPauseBtn.title = `${name}${this.getHint('play-pause')}`
    playPauseBtn.setAttribute('aria-label', name)
  }

  syncMuteButton(muteBtn) {
    if (!muteBtn || !this.video) return

    const muted = this.video.muted
    muteBtn.innerHTML = icon(muted ? 'muted' : 'volume')
    const name = muted ? 'Włącz dźwięk' : 'Wycisz'
    muteBtn.title = `${name}${this.getHint('toggle-mute')}`
    muteBtn.setAttribute('aria-label', name)
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
    this.onSyncState()
  }

  setPlaybackRate(speedSelect) {
    if (!this.video || !speedSelect) return
    this.video.playbackRate = Number(speedSelect.value || 1)
  }

  stepBackward() {
    if (!this.video) return
    this.video.currentTime = Math.max(0, this.video.currentTime - this.getFrameStep())
  }

  stepForward() {
    if (!this.video) return
    this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + this.getFrameStep())
  }

  skipBackward() {
    if (!this.video) return
    this.video.currentTime = Math.max(0, this.video.currentTime - 5)
  }

  skipForward() {
    if (!this.video) return
    this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 5)
  }
}

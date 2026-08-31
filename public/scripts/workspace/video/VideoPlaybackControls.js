(function () {
  class VideoPlaybackControls {
    constructor(video, { timeNode, seekInput, stateNode, onSyncState } = {}) {
      this.video = video
      this.timeNode = timeNode
      this.seekInput = seekInput
      this.stateNode = stateNode
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
      this.timeNode.textContent = `${window.VideoPlayerUtils.formatTime(current)} / ${window.VideoPlayerUtils.formatTime(duration)}`

      if (this.seekInput && Number.isFinite(duration) && duration > 0) {
        this.seekInput.value = String(Math.min(100, (current / duration) * 100))
      }
    }

    async playPause(playPauseBtn) {
      if (!this.video) return

      try {
        if (this.video.paused) {
          await this.video.play()
        } else {
          this.video.pause()
        }
      } catch (_error) {
        if (this.stateNode) {
          this.stateNode.textContent = 'Nie udało się uruchomić odtwarzania wideo.'
        }
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

    seekTo(seekInput) {
      if (!this.video || !seekInput || !Number.isFinite(this.video.duration)) return
      const nextSeek = Number(seekInput.value || 0)
      this.video.currentTime = (nextSeek / 100) * this.video.duration
      this.syncTimeLabel()
    }

    stepBackward() {
      if (!this.video) return
      this.video.currentTime = Math.max(0, this.video.currentTime - window.VideoPlayerUtils.DEFAULT_FRAME_STEP)
      this.syncTimeLabel()
    }

    stepForward() {
      if (!this.video) return
      this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + window.VideoPlayerUtils.DEFAULT_FRAME_STEP)
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

  window.VideoPlaybackControls = VideoPlaybackControls
})()

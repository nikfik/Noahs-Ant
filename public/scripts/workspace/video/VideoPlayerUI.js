(function () {
  class VideoPlayerUI {
    static renderVideoMarkup(videoPath) {
      const src = window.VideoPlayerUtils.toFileUrl(videoPath)

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

    constructor(host, videoPath = '') {
      this.host = host
      this.videoPath = videoPath
    }

    render() {
      if (!this.host) return null

      this.host.innerHTML = VideoPlayerUI.renderVideoMarkup(this.videoPath)
      return this.getElements()
    }

    getElements() {
      if (!this.host) return {}

      return {
        stateNode: this.host.querySelector('.video-state'),
        pickBtn: this.host.querySelector('#pick-video-btn'),
        openBtn: this.host.querySelector('#open-video-placeholder'),
        video: this.host.querySelector('#video-player'),
        playPauseBtn: this.host.querySelector('#play-pause-video-btn'),
        muteBtn: this.host.querySelector('#mute-video-btn'),
        seekInput: this.host.querySelector('#video-seek'),
        volumeInput: this.host.querySelector('#video-volume'),
        speedSelect: this.host.querySelector('#video-speed'),
        timeNode: this.host.querySelector('#video-time'),
        stepBackBtn: this.host.querySelector('#step-back-video-btn'),
        stepForwardBtn: this.host.querySelector('#step-forward-video-btn'),
        skipBackBtn: this.host.querySelector('#skip-back-video-btn'),
        skipForwardBtn: this.host.querySelector('#skip-forward-video-btn'),
        zoomOutBtn: this.host.querySelector('#zoom-out-btn'),
        zoomInBtn: this.host.querySelector('#zoom-in-btn'),
        zoomFitBtn: this.host.querySelector('#zoom-fit-btn'),
        zoomInput: this.host.querySelector('#zoom-level-input')
      }
    }
  }

  window.VideoPlayerUI = VideoPlayerUI
})()

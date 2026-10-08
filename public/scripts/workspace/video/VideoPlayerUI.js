import { VideoPlayerUtils } from './VideoPlayerUtils.js'
import { icon } from './video-icons.js'

export class VideoPlayerUI {
  static renderVideoMarkup(videoPath) {
    const src = VideoPlayerUtils.toFileUrl(videoPath)

    return `
      <div class="module-card video-card">
        <div class="video-player-shell">
          <div class="video-stage">
            <div class="video-stage-inner">
              <video id="video-player" class="video-player" playsinline preload="metadata" ${src ? `src="${src}"` : ''}></video>
            </div>
            <div class="video-empty" ${videoPath ? 'hidden' : ''}>
              <p>Ta próba nie ma jeszcze filmu</p>
              <button id="pick-video-empty-btn" class="video-pick-cta" type="button">${icon('folder', 20)}Wybierz plik wideo</button>
            </div>
            <div class="video-busy" hidden role="status">
              <p class="video-busy-text"></p>
              <progress class="video-busy-progress" max="100" value="0"></progress>
              <button id="video-cancel-conversion-btn" class="video-pick-cta" type="button">Anuluj</button>
              <button id="video-close-notice-btn" class="video-pick-cta" type="button" hidden>Zamknij</button>
            </div>
            <div class="video-zoom-controls" role="group" aria-label="Powiększenie obrazu">
              <button id="zoom-out-btn" class="vp-btn vp-btn-bare" type="button" title="Pomniejsz (kółko myszy)" aria-label="Pomniejsz">${icon('minus', 16)}</button>
              <input id="zoom-level-input" class="video-zoom-input" value="100%" aria-label="Powiększenie w procentach" title="Powiększenie – wpisz wartość i naciśnij Enter" />
              <button id="zoom-in-btn" class="vp-btn vp-btn-bare" type="button" title="Powiększ (kółko myszy)" aria-label="Powiększ">${icon('plus', 16)}</button>
              <span class="video-zoom-separator" aria-hidden="true"></span>
              <button id="zoom-fit-btn" class="vp-btn vp-btn-bare" type="button" title="Dopasuj do okna (dwuklik na obrazie)" aria-label="Dopasuj do okna">${icon('fit', 16)}</button>
            </div>
          </div>

          <div class="video-controls">
            <button id="skip-back-video-btn" class="vp-btn" type="button" title="Cofnij o 5 s" aria-label="Cofnij o 5 sekund">${icon('skipBack', 20)}</button>
            <button id="step-back-video-btn" class="vp-btn" type="button" title="Cofnij o 1 klatkę" aria-label="Cofnij o jedną klatkę">${icon('stepBack')}</button>
            <button id="play-pause-video-btn" class="vp-btn vp-btn-primary" type="button" title="Odtwórz" aria-label="Odtwórz">${icon('play', 20)}</button>
            <button id="step-forward-video-btn" class="vp-btn" type="button" title="Do przodu o 1 klatkę" aria-label="Do przodu o jedną klatkę">${icon('stepForward')}</button>
            <button id="skip-forward-video-btn" class="vp-btn" type="button" title="Do przodu o 5 s" aria-label="Do przodu o 5 sekund">${icon('skipForward', 20)}</button>

            <span class="video-controls-separator" aria-hidden="true"></span>

            <select id="video-speed" class="video-select" title="Prędkość odtwarzania" aria-label="Prędkość odtwarzania">
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1" selected>1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>

            <button id="mute-video-btn" class="vp-btn vp-btn-bare" type="button" title="Wycisz" aria-label="Wycisz">${icon('volume')}</button>
            <input id="video-volume" class="video-volume" type="range" min="0" max="1" step="0.05" value="1" title="Głośność" aria-label="Głośność" />

            <span class="video-controls-spacer"></span>

            <button id="pick-video-btn" class="vp-btn vp-btn-labeled" type="button" title="Wybierz inny plik wideo dla tej próby">${icon('folder')}<span>Zmień film</span></button>
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
      pickButtons: Array.from(this.host.querySelectorAll('#pick-video-btn, #pick-video-empty-btn')),
      emptyState: this.host.querySelector('.video-empty'),
      busy: {
        root: this.host.querySelector('.video-busy'),
        text: this.host.querySelector('.video-busy-text'),
        progress: this.host.querySelector('.video-busy-progress'),
        cancel: this.host.querySelector('#video-cancel-conversion-btn'),
        close: this.host.querySelector('#video-close-notice-btn')
      },
      video: this.host.querySelector('#video-player'),
      playPauseBtn: this.host.querySelector('#play-pause-video-btn'),
      muteBtn: this.host.querySelector('#mute-video-btn'),
      volumeInput: this.host.querySelector('#video-volume'),
      speedSelect: this.host.querySelector('#video-speed'),
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

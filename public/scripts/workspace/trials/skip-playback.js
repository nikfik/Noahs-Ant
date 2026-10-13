// Whether the player jumps over time skips (the default) or plays them like the rest of the video.
// Shared by the timeline (the switch) and the player (the jumping); applies to counted and uncounted skips alike.
const STORAGE_KEY = 'noahs-ant.skip-playback'
export const SKIP_PLAYBACK_EVENT = 'skip-playback-changed'

export function isSkipping() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'play'
  } catch (_error) {
    return true
  }
}

export function setSkipping(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'skip' : 'play')
  } catch (_error) {
    // The choice then lasts only until the next change event.
  }
  window.dispatchEvent(new CustomEvent(SKIP_PLAYBACK_EVENT, { detail: { skipping: enabled } }))
}

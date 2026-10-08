// One consistent set of line icons for the player (emoji look different on every system).
const ICONS = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  stepBack: '<rect x="5.5" y="5" width="2.2" height="14" rx="1" fill="currentColor" stroke="none"/><path d="M19.5 5v14L9 12z" fill="currentColor" stroke="none"/>',
  stepForward: '<rect x="16.3" y="5" width="2.2" height="14" rx="1" fill="currentColor" stroke="none"/><path d="M4.5 5v14L15 12z" fill="currentColor" stroke="none"/>',
  skipBack: '<path d="M5 12a7 7 0 1 0 2.2-5.1"/><path d="M4.5 3.8v4.4h4.4"/><text x="12" y="15.4" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">5</text>',
  skipForward: '<path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.5 3.8v4.4h-4.4"/><text x="12" y="15.4" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">5</text>',
  volume: '<path d="M4 10v4h3.5l5 4V6l-5 4z" fill="currentColor"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.8 6.6a8 8 0 0 1 0 10.8"/>',
  muted: '<path d="M4 10v4h3.5l5 4V6l-5 4z" fill="currentColor"/><path d="M16.5 9.5l4.5 5M21 9.5l-4.5 5"/>',
  folder: '<path d="M4 19V6.5A1.5 1.5 0 0 1 5.5 5H9l2 2.5h6.5A1.5 1.5 0 0 1 19 9v1.5"/><path d="M4 19l2.3-7.6a1.5 1.5 0 0 1 1.4-1h12.6a1 1 0 0 1 1 1.3L19 19z"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
}

export function icon(name, size = 18) {
  return `<svg class="vp-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`
}

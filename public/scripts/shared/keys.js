export const MODIFIER_KEYS = ['Shift', 'Alt', 'Control', 'Meta']

const NAMED_KEYS = new Map([
  ['shift', 'Shift'], ['alt', 'Alt'], ['control', 'Control'], ['ctrl', 'Control'], ['meta', 'Meta'], ['cmd', 'Meta'],
  ['space', 'Space'], ['spacebar', 'Space'], ['esc', 'Escape'], ['escape', 'Escape'], ['enter', 'Enter'], ['return', 'Enter'],
  ['tab', 'Tab'], ['backspace', 'Backspace'], ['delete', 'Delete'], ['insert', 'Insert'],
  ['arrowleft', 'ArrowLeft'], ['arrowright', 'ArrowRight'], ['arrowup', 'ArrowUp'], ['arrowdown', 'ArrowDown'],
  ['home', 'Home'], ['end', 'End'], ['pageup', 'PageUp'], ['pagedown', 'PageDown']
])

const LABELS = {
  Space: 'Spacja', Escape: 'Esc', Control: 'Ctrl', Meta: 'Win',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓'
}

export const isModifierKey = (key) => MODIFIER_KEYS.includes(key)

// One name for every key, whether it comes from a keyboard event ("m", " ") or from older saved settings ("Esc").
export function normalizeKey(value) {
  if (value === ' ') return 'Space'
  const text = String(value ?? '').trim()
  if (!text || text === 'Dead' || text === 'Unidentified') return ''

  const named = NAMED_KEYS.get(text.toLowerCase())
  if (named) return named
  if (/^f\d{1,2}$/i.test(text)) return text.toUpperCase()
  return text.length === 1 ? text.toUpperCase() : text
}

export const keyLabel = (key) => LABELS[key] ?? key

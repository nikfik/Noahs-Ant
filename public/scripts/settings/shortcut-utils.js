import { keyLabel, normalizeKey } from '../shared/keys.js'

export const normalizeKeyValue = normalizeKey

export function normalizeShortcutEntry(value) {
  if (typeof value === 'string') {
    return { primary: normalizeKey(value), secondary: '', operator: '/' }
  }

  if (value && typeof value === 'object') {
    return {
      primary: normalizeKey(value.primary),
      secondary: normalizeKey(value.secondary),
      operator: value.operator === '+' ? '+' : '/'
    }
  }

  return { primary: '', secondary: '', operator: '/' }
}

export function getShortcutSignature(shortcut = {}) {
  const primary = normalizeKey(shortcut.primary)
  const secondary = normalizeKey(shortcut.secondary)

  if (!primary && !secondary) {
    return ''
  }

  return secondary ? `${primary}${shortcut.operator === '+' ? '+' : '/'}${secondary}` : primary
}

// The key combinations that trigger a shortcut: "A / B" is two separate combinations, "A + B" is one combination of two keys.
export function shortcutCombos(shortcut) {
  const { primary, secondary, operator } = normalizeShortcutEntry(shortcut)
  if (!primary && !secondary) return []
  if (!primary || !secondary) return [[primary || secondary]]
  return operator === '+' ? [[primary, secondary]] : [[primary], [secondary]]
}

const comboSignature = (combo) => [...new Set(combo)].sort().join('+')

export function shortcutsOverlap(first, second) {
  const taken = new Set(shortcutCombos(first).map(comboSignature))
  return shortcutCombos(second).some((combo) => taken.has(comboSignature(combo)))
}

export function getShortcutConflictMessage(optionId, shortcut, shortcuts = []) {
  const conflicts = shortcuts.filter((entry) => entry.id !== optionId && shortcutsOverlap(shortcut, entry.value))

  return conflicts.length > 0
    ? `Powielony skrót: ${conflicts.map((entry) => entry.label).join(', ')}`
    : ''
}

// How a shortcut reads on screen: "Spacja / Enter", "Shift + M".
export function describeShortcut(shortcut) {
  const { primary, secondary, operator } = normalizeShortcutEntry(shortcut)
  const keys = [primary, secondary].filter(Boolean).map(keyLabel)
  return keys.join(keys.length === 2 ? ` ${operator} ` : '')
}

// The "+ / off" button: "+" (both keys together) becomes "/" (either key), which becomes a single key again.
export function cycleOperator(shortcut) {
  const entry = normalizeShortcutEntry(shortcut)
  if (!entry.secondary) return entry
  return entry.operator === '+'
    ? { ...entry, operator: '/' }
    : { primary: entry.primary, secondary: '', operator: '/' }
}

// A freshly added second key starts as a "+" combination; the operator button then steps through the other options.
export function setShortcutKey(shortcut, field, key) {
  const entry = normalizeShortcutEntry(shortcut)
  const value = normalizeKey(key)
  if (field === 'secondary') return { ...entry, secondary: value, operator: entry.secondary ? entry.operator : '+' }
  return { ...entry, primary: value }
}

export function clearShortcutKey(shortcut, field) {
  const entry = normalizeShortcutEntry(shortcut)
  if (field === 'secondary') return { ...entry, secondary: '', operator: '/' }
  return { primary: entry.secondary, secondary: '', operator: '/' }
}

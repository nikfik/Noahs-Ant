import { MODIFIER_KEYS, isModifierKey, normalizeKey } from '../../shared/keys.js'
import { shortcutCombos } from '../../settings/shortcut-utils.js'

const MODIFIER_FLAGS = { Shift: 'shiftKey', Alt: 'altKey', Control: 'ctrlKey', Meta: 'metaKey' }

export const eventKey = (event) => normalizeKey(event.key)

export const heldModifiers = (event) => new Set(MODIFIER_KEYS.filter((modifier) => event[MODIFIER_FLAGS[modifier]]))

// A shortcut matches when the pressed key belongs to one of its combinations, the other keys of that combination are held,
// and the modifiers held are exactly the ones the combination asks for. The last rule keeps "→" (5 s forward) from also
// firing when "Alt + →" (next animal) is pressed.
export function matchesShortcut(shortcut, event, pressedKeys = new Set()) {
  const key = eventKey(event)
  if (!key) return false

  const modifiers = heldModifiers(event)
  return shortcutCombos(shortcut).some((combo) => {
    if (!combo.includes(key)) return false

    const comboModifiers = combo.filter(isModifierKey)
    if (comboModifiers.length !== modifiers.size || !comboModifiers.every((modifier) => modifiers.has(modifier))) return false
    return combo.filter((item) => !isModifierKey(item)).every((item) => item === key || pressedKeys.has(item))
  })
}

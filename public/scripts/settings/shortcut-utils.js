export function normalizeKeyValue(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }

  const trimmed = value.trim()
  return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed
}

export function normalizeShortcutEntry(value) {
  if (typeof value === 'string') {
    return { primary: normalizeKeyValue(value), secondary: '', operator: '/' }
  }

  if (value && typeof value === 'object') {
    return {
      primary: normalizeKeyValue(value.primary),
      secondary: normalizeKeyValue(value.secondary),
      operator: value.operator === '+' ? '+' : '/'
    }
  }

  return { primary: '', secondary: '', operator: '/' }
}

export function getShortcutSignature(shortcut = {}) {
  const primary = normalizeKeyValue(shortcut.primary)
  const secondary = normalizeKeyValue(shortcut.secondary)

  if (!primary && !secondary) {
    return ''
  }

  return secondary ? `${primary}${shortcut.operator === '+' ? '+' : '/'}${secondary}` : primary
}

export function getShortcutConflictMessage(optionId, shortcut, shortcuts = []) {
  const signature = getShortcutSignature(shortcut)
  if (!signature) {
    return ''
  }

  const conflicts = shortcuts.filter((entry) => {
    return entry.id !== optionId && getShortcutSignature(entry.value) === signature
  })

  return conflicts.length > 0
    ? `Powielony skrót: ${conflicts.map((entry) => entry.label).join(', ')}`
    : ''
}

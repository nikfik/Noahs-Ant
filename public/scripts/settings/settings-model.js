import { createDefaultAppSettings, defaultTheme, settingsCatalog } from './settings-config.js'
import { normalizeShortcutEntry } from './shortcut-utils.js'

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function normalizeAppSettings(saved = {}) {
  const defaults = createDefaultAppSettings()
  const source = saved && typeof saved === 'object' ? saved : {}
  const themeSource = source.theme && typeof source.theme === 'object' ? source.theme : {}
  const graphicsSource = source.graphics && typeof source.graphics === 'object' ? source.graphics : {}
  const savedShortcuts = Array.isArray(source.programShortcuts) ? source.programShortcuts : []
  const savedShortcutById = new Map(savedShortcuts.map((entry) => [entry?.id, entry]))

  const theme = Object.fromEntries(Object.keys(defaultTheme).map((key) => [
    key,
    typeof themeSource[key] === 'string' && COLOR_PATTERN.test(themeSource[key])
      ? themeSource[key]
      : defaults.theme[key]
  ]))

  const graphics = Object.fromEntries(settingsCatalog.graphics.options.map((option) => {
    const value = graphicsSource[option.id]
    const isValid = option.type === 'toggle'
      ? typeof value === 'boolean'
      : option.values.includes(value)
    return [option.id, isValid ? value : option.defaultValue]
  }))

  const programShortcuts = defaults.programShortcuts.map((defaultEntry) => {
    const savedEntry = savedShortcutById.get(defaultEntry.id)
    return {
      ...defaultEntry,
      ...(savedEntry && typeof savedEntry.label === 'string' ? { label: savedEntry.label } : {}),
      value: normalizeShortcutEntry(savedEntry?.value ?? defaultEntry.value)
    }
  })

  return {
    theme,
    graphics,
    programShortcuts,
    projectShortcuts: Array.isArray(source.projectShortcuts) ? source.projectShortcuts : []
  }
}

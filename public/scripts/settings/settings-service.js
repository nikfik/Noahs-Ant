import { normalizeAppSettings } from './settings-model.js'

export { normalizeAppSettings } from './settings-model.js'

export async function loadSettings(electronAPI) {
  const saved = await electronAPI.getAppSettings()
  return normalizeAppSettings(saved)
}

export async function saveSettings(electronAPI, settings) {
  const normalized = normalizeAppSettings(settings)
  await electronAPI.saveAppSettings(normalized)
  await electronAPI.setTheme(normalized.theme)
  return normalized
}

import fs from 'node:fs'

const emptySettings = { programShortcuts: [], projectShortcuts: [] }

export function createSettingsStore(settingsPath) {
  function readAppSettings() {
    try {
      if (!fs.existsSync(settingsPath)) {
        return { ...emptySettings }
      }

      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      return {
        programShortcuts: Array.isArray(parsed.programShortcuts) ? parsed.programShortcuts : [],
        projectShortcuts: Array.isArray(parsed.projectShortcuts) ? parsed.projectShortcuts : []
      }
    } catch (_error) {
      return { ...emptySettings }
    }
  }

  function writeAppSettings(settings) {
    const payload = {
      programShortcuts: Array.isArray(settings?.programShortcuts) ? settings.programShortcuts : [],
      projectShortcuts: Array.isArray(settings?.projectShortcuts) ? settings.projectShortcuts : []
    }

    fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8')
    return payload
  }

  return { readAppSettings, writeAppSettings }
}
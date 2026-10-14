import fs from 'node:fs'
import path from 'node:path'
import { normalizeAppSettings } from '../settings/settings-model.js'

export function createSettingsStore(settingsPath) {
  function readAppSettings() {
    try {
      if (!fs.existsSync(settingsPath)) {
        return normalizeAppSettings()
      }

      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      return normalizeAppSettings(parsed)
    } catch (_error) {
      return normalizeAppSettings()
    }
  }

  function writeAppSettings(settings) {
    const payload = normalizeAppSettings(settings)

    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8')
    return payload
  }

  return { readAppSettings, writeAppSettings }
}
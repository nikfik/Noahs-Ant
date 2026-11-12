import { normalizeQualitySettings } from '../shared/video-quality.js'
import { createDefaultAppSettings, defaultTheme } from './settings-config.js'
import { FONT_CHOICES, SCALE_CHOICES, matchThemePreset } from '../shared/appearance.js'
import { isLanguage } from '../shared/i18n.js'
import { normalizeShortcutEntry } from './shortcut-utils.js'

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function normalizeAppSettings(saved = {}) {
  const defaults = createDefaultAppSettings()
  const source = saved && typeof saved === 'object' ? saved : {}
  const themeSource = source.theme && typeof source.theme === 'object' ? source.theme : {}
  const graphicsSource = source.graphics && typeof source.graphics === 'object' ? source.graphics : {}
  const timelineSource = source.timeline && typeof source.timeline === 'object' ? source.timeline : {}
  const videoSource = source.video && typeof source.video === 'object' ? source.video : {}
  const backupSource = source.backup && typeof source.backup === 'object' ? source.backup : {}
  const savedShortcuts = Array.isArray(source.programShortcuts) ? source.programShortcuts : []
  const savedShortcutById = new Map(savedShortcuts.map((entry) => [entry?.id, entry]))

  const colors = Object.fromEntries(['bgColor', 'textColor', 'primaryColor'].map((key) => [
    key,
    typeof themeSource[key] === 'string' && COLOR_PATTERN.test(themeSource[key])
      ? themeSource[key]
      : defaults.theme[key]
  ]))
  const customSource = themeSource.custom && typeof themeSource.custom === 'object' ? themeSource.custom : {}
  const custom = Object.fromEntries(['bgColor', 'textColor', 'primaryColor'].map((key) => [
    key,
    typeof customSource[key] === 'string' && COLOR_PATTERN.test(customSource[key]) ? customSource[key] : defaults.theme.custom[key]
  ]))
  const theme = {
    ...colors,
    custom,
    font: FONT_CHOICES.some((font) => font.value === themeSource.font) ? themeSource.font : defaultTheme.font,
    preset: matchThemePreset(colors)
  }

  const graphics = {
    scale: SCALE_CHOICES.some((choice) => choice.value === graphicsSource.scale) ? graphicsSource.scale : defaults.graphics.scale
  }
  const timeline = {
    snapEnabled: typeof timelineSource.snapEnabled === 'boolean' ? timelineSource.snapEnabled : defaults.timeline.snapEnabled,
    snapThresholdPx: [5, 9, 14, 20].includes(Number(timelineSource.snapThresholdPx))
      ? Number(timelineSource.snapThresholdPx)
      : defaults.timeline.snapThresholdPx
  }

  const video = {
    askQuality: typeof videoSource.askQuality === 'boolean' ? videoSource.askQuality : defaults.video.askQuality,
    quality: normalizeQualitySettings(videoSource.quality),
    skipSeconds: Number.isFinite(videoSource.skipSeconds) && videoSource.skipSeconds >= 0.5 && videoSource.skipSeconds <= 600
      ? videoSource.skipSeconds
      : defaults.video.skipSeconds
  }

  const wholeNumber = (value, min, max, fallback) => Number.isInteger(value) && value >= min && value <= max ? value : fallback
  const backup = {
    enabled: typeof backupSource.enabled === 'boolean' ? backupSource.enabled : defaults.backup.enabled,
    intervalMinutes: wholeNumber(backupSource.intervalMinutes, 1, 1440, defaults.backup.intervalMinutes),
    maxBackups: wholeNumber(backupSource.maxBackups, 1, 200, defaults.backup.maxBackups)
  }

  const programShortcuts = defaults.programShortcuts.map((defaultEntry) => {
    const savedEntry = savedShortcutById.get(defaultEntry.id)
    return {
      ...defaultEntry,
      ...(savedEntry && typeof savedEntry.label === 'string' ? { label: savedEntry.label } : {}),
      value: normalizeShortcutEntry(savedEntry?.value ?? defaultEntry.value)
    }
  })

  return {
    language: isLanguage(source.language) ? source.language : defaults.language,
    theme,
    graphics,
    timeline,
    video,
    backup,
    programShortcuts,
    projectShortcuts: Array.isArray(source.projectShortcuts) ? source.projectShortcuts : []
  }
}

import { presetSettings } from '../shared/video-quality.js'
import { FONT_CHOICES, SCALE_CHOICES, THEME_PRESETS } from '../shared/appearance.js'
import { DEFAULT_LANGUAGE, LANGUAGES } from '../shared/i18n.js'

export const defaultTheme = {
  bgColor: THEME_PRESETS.dark.bgColor,
  textColor: THEME_PRESETS.dark.textColor,
  primaryColor: THEME_PRESETS.dark.primaryColor,
  font: 'system',
  // The colors the user mixed themselves, kept so "Własny" can bring them back after a ready scheme was tried.
  custom: {
    bgColor: THEME_PRESETS.dark.bgColor,
    textColor: THEME_PRESETS.dark.textColor,
    primaryColor: THEME_PRESETS.dark.primaryColor
  }
}

const single = (primary) => ({ primary, secondary: '', operator: '/' })

// Keyboard shortcuts of the program itself (the shortcuts of behaviors live in each project's etogram).
export const shortcutActions = [
  { id: 'play-pause', label: 'Odtwórz / zatrzymaj', group: 'Wideo', defaultValue: { primary: 'Space', secondary: 'Enter', operator: '/' } },
  { id: 'skip-forward', label: 'Skok do przodu', group: 'Wideo', defaultValue: single('ArrowRight') },
  { id: 'skip-back', label: 'Skok do tyłu', group: 'Wideo', defaultValue: single('ArrowLeft') },
  { id: 'frame-forward', label: 'Jedna klatka do przodu', group: 'Wideo', defaultValue: single('.') },
  { id: 'frame-back', label: 'Jedna klatka do tyłu', group: 'Wideo', defaultValue: single(',') },
  { id: 'toggle-mute', label: 'Wycisz / włącz dźwięk', group: 'Wideo', defaultValue: { primary: 'Shift', secondary: 'M', operator: '+' } },
  { id: 'next-animal', label: 'Następne zwierzę', group: 'Zwierzęta', defaultValue: { primary: 'Alt', secondary: 'ArrowRight', operator: '+' } },
  { id: 'previous-animal', label: 'Poprzednie zwierzę', group: 'Zwierzęta', defaultValue: { primary: 'Alt', secondary: 'ArrowLeft', operator: '+' } }
]

export const defaultShortcuts = Object.fromEntries(shortcutActions.map(({ id, defaultValue }) => [id, defaultValue]))

export const settingsCatalog = {
  general: {
    title: 'Ogólne',
    options: [
      { id: 'language', label: 'Język', type: 'select', defaultValue: DEFAULT_LANGUAGE, values: LANGUAGES.map(({ value, label }) => ({ value, label })), storage: 'app', key: 'language', native: true }
    ]
  },
  graphics: {
    title: 'Graficzne',
    options: [
      { id: 'theme-preset', label: 'Schemat kolorów', type: 'themePresets' },
      { id: 'bg-color', label: 'Kolor tła', type: 'color', key: 'bgColor' },
      { id: 'text-color', label: 'Kolor tekstu', type: 'color', key: 'textColor' },
      { id: 'accent-color', label: 'Kolor akcentu', type: 'color', key: 'primaryColor' },
      { id: 'font', label: 'Czcionka', type: 'select', defaultValue: 'system', values: FONT_CHOICES, storage: 'theme', key: 'font' },
      { id: 'scale', label: 'Rozmiar interfejsu', type: 'select', defaultValue: '100', values: SCALE_CHOICES, storage: 'graphics', key: 'scale' }
    ]
  },
  shortcuts: {
    title: 'Skróty klawiszowe',
    options: shortcutActions.map(({ id, label, group }) => ({ id, label, group, type: 'keybind' }))
  },
  timeline: {
    title: 'Oś czasu',
    options: [
      { id: 'snap-enabled', label: 'Przyciąganie do zdarzeń i klatek', type: 'toggle', defaultValue: true, storage: 'timeline', key: 'snapEnabled' },
      { id: 'snap-threshold-px', label: 'Czułość przyciągania', type: 'select', defaultValue: '9', values: ['5', '9', '14', '20'], storage: 'timeline', key: 'snapThresholdPx' }
    ]
  },
  backup: {
    title: 'Kopie zapasowe',
    options: [
      { id: 'backup-enabled', label: 'Automatyczne kopie zapasowe', type: 'toggle', defaultValue: true, storage: 'backup', key: 'enabled' },
      { id: 'backup-interval', label: 'Ilość minut między kopiami', type: 'number', defaultValue: 30, min: 1, max: 1440, step: 1, storage: 'backup', key: 'intervalMinutes' },
      { id: 'backup-max', label: 'Ogranicz ilość automatycznych kopii do', type: 'number', defaultValue: 10, min: 1, max: 200, step: 1, storage: 'backup', key: 'maxBackups' }
    ]
  },
  video: {
    title: 'Wideo',
    options: [
      { id: 'ask-quality', label: 'Pytaj o jakość przy wyborze filmu', type: 'toggle', defaultValue: true, storage: 'video', key: 'askQuality' },
      { id: 'skip-seconds', label: 'Długość skoku (przyciski i skróty), w sekundach', type: 'number', defaultValue: 5, min: 0.5, max: 600, step: 0.5, storage: 'video', key: 'skipSeconds' }
    ]
  }
}

export function createDefaultAppSettings() {
  const programShortcuts = settingsCatalog.shortcuts.options.map(({ id, label }) => ({
    id,
    label,
    value: { ...(defaultShortcuts[id] ?? single('')) }
  }))
  const graphics = { scale: '100' }
  const timeline = {
    snapEnabled: true,
    snapThresholdPx: 9
  }

  return {
    language: DEFAULT_LANGUAGE,
    theme: { ...defaultTheme, custom: { ...defaultTheme.custom }, preset: 'dark' },
    graphics,
    timeline,
    video: { askQuality: true, quality: presetSettings('original'), skipSeconds: 5 },
    backup: { enabled: true, intervalMinutes: 30, maxBackups: 10 },
    programShortcuts,
    projectShortcuts: []
  }
}

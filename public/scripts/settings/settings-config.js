export const defaultTheme = {
  bgColor: '#1a1a1a',
  textColor: '#e0e0e0',
  primaryColor: '#ff4f1a'
}

const single = (primary) => ({ primary, secondary: '', operator: '/' })

// Keyboard shortcuts of the program itself (the shortcuts of behaviors live in each project's etogram).
export const shortcutActions = [
  { id: 'play-pause', label: 'Odtwórz / zatrzymaj', group: 'Wideo', defaultValue: { primary: 'Space', secondary: 'Enter', operator: '/' } },
  { id: 'skip-forward', label: 'Do przodu o 5 s', group: 'Wideo', defaultValue: single('ArrowRight') },
  { id: 'skip-back', label: 'Cofnij o 5 s', group: 'Wideo', defaultValue: single('ArrowLeft') },
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
      { id: 'bg-color', label: 'Kolor tła', type: 'color', key: 'bgColor' },
      { id: 'text-color', label: 'Kolor tekstu', type: 'color', key: 'textColor' },
      { id: 'accent-color', label: 'Kolor akcentu', type: 'color', key: 'primaryColor' }
    ]
  },
  graphics: {
    title: 'Graficzne',
    options: [

    ]
  },
  shortcuts: {
    title: 'Skróty klawiszowe',
    options: shortcutActions.map(({ id, label, group }) => ({ id, label, group, type: 'keybind' }))
  },
  timeline: {
    title: 'Oś czasu',
    options: [
      { id: 'snap-enabled', label: 'Przyciąganie do zdarzeń i klatek', type: 'toggle', defaultValue: true, storage: 'timeline' },
      { id: 'snap-threshold-px', label: 'Czułość przyciągania', type: 'select', defaultValue: '9', values: ['5', '9', '14', '20'], storage: 'timeline' }
    ]
  }
}

export function createDefaultAppSettings() {
  const programShortcuts = settingsCatalog.shortcuts.options.map(({ id, label }) => ({
    id,
    label,
    value: { ...(defaultShortcuts[id] ?? single('')) }
  }))
  const graphics = Object.fromEntries(settingsCatalog.graphics.options.map((option) => [option.id, option.defaultValue]))
  const timeline = {
    snapEnabled: true,
    snapThresholdPx: 9
  }

  return {
    theme: { ...defaultTheme },
    graphics,
    timeline,
    programShortcuts,
    projectShortcuts: []
  }
}

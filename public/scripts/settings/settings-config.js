export const defaultTheme = {
  bgColor: '#1a1a1a',
  textColor: '#e0e0e0',
  primaryColor: '#ff4f1a'
}

export const defaultShortcuts = {}

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
    options: [
      { id: 'temp1', label: 'Temp1', type: 'keybind' },
      { id: 'temp2', label: 'Temp2', type: 'keybind' },
    ]
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
    value: { ...(defaultShortcuts[id] ?? { primary: '', secondary: '', operator: '/' }) }
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

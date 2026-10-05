export const defaultTheme = {
  bgColor: '#1a1a1a',
  textColor: '#e0e0e0',
  primaryColor: '#ff4f1a'
}

export const defaultShortcuts = {
  'move-forward': { primary: 'W', secondary: '', operator: '/' },
  'move-left': { primary: 'A', secondary: '', operator: '/' },
  'move-right': { primary: 'D', secondary: '', operator: '/' },
  sprint: { primary: 'Shift', secondary: '', operator: '/' },
  interact: { primary: 'E', secondary: '', operator: '/' },
  menu: { primary: 'Esc', secondary: '', operator: '/' }
}

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
      { id: 'frame-rate', label: 'Frame Rate', type: 'select', defaultValue: '60fps', values: ['30fps', '60fps', '120fps'] },
      { id: 'shadow-quality', label: 'Shadow Quality', type: 'select', defaultValue: 'Ultra High', values: ['Low', 'Medium', 'High', 'Ultra High'] },
      { id: 'effects-quality', label: 'Special Effects Quality', type: 'select', defaultValue: 'High', values: ['Low', 'Medium', 'High', 'Ultra High'] },
      { id: 'lod-bias', label: 'LOD Bias', type: 'select', defaultValue: 'High', values: ['Low', 'Medium', 'High'] },
      { id: 'capsule-ao', label: 'Capsule AO', type: 'toggle', defaultValue: true },
      { id: 'volumetric-fog', label: 'Volumetric Fog', type: 'toggle', defaultValue: true },
      { id: 'volumetric-lighting', label: 'Volumetric Lighting', type: 'toggle', defaultValue: true },
      { id: 'motion-blur', label: 'Motion Blur', type: 'toggle', defaultValue: true }
    ]
  },
  shortcuts: {
    title: 'Skróty klawiszowe',
    options: [
      { id: 'move-forward', label: 'Ruch do przodu', type: 'keybind' },
      { id: 'move-left', label: 'Ruch w lewo', type: 'keybind' },
      { id: 'move-right', label: 'Ruch w prawo', type: 'keybind' },
      { id: 'sprint', label: 'Sprint', type: 'keybind' },
      { id: 'interact', label: 'Interakcja', type: 'keybind' },
      { id: 'menu', label: 'Menu', type: 'keybind' }
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
    value: { ...defaultShortcuts[id] }
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

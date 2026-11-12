// What the user can choose about the look of the program: ready color schemes, fonts and the size of the interface.
// Shared by the settings window, every page (to apply it) and the main process (to remember it).

export const THEME_PRESETS = {
  dark: { label: 'Ciemny', bgColor: '#1a1a1a', textColor: '#e0e0e0', primaryColor: '#ff4f1a' },
  light: { label: 'Jasny', bgColor: '#f4f4f1', textColor: '#1d1d1f', primaryColor: '#e0480f' }
}

// Only fonts that come with the system, so nothing has to be downloaded; every stack ends in a generic family.
export const FONT_CHOICES = [
  { value: 'system', label: 'Systemowa (Segoe UI)', stack: '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif' },
  { value: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { value: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { value: 'tahoma', label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { value: 'calibri', label: 'Calibri', stack: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  { value: 'georgia', label: 'Georgia (z szeryfami)', stack: 'Georgia, "Times New Roman", serif' },
  { value: 'consolas', label: 'Consolas (stała szerokość)', stack: 'Consolas, "Courier New", monospace' }
]

// The whole interface is scaled (text and controls together).
export const SCALE_CHOICES = [
  { value: '90', label: 'Mały (90%)' },
  { value: '100', label: 'Normalny (100%)' },
  { value: '115', label: 'Duży (115%)' },
  { value: '130', label: 'Bardzo duży (130%)' }
]

export const fontStack = (id) => (FONT_CHOICES.find((font) => font.value === id) || FONT_CHOICES[0]).stack

const sameColor = (left, right) => String(left).toLowerCase() === String(right).toLowerCase()

// The ready scheme these exact colors belong to, or "custom".
export function matchThemePreset(theme) {
  return Object.entries(THEME_PRESETS).find(([, preset]) =>
    sameColor(preset.bgColor, theme.bgColor) && sameColor(preset.textColor, theme.textColor) && sameColor(preset.primaryColor, theme.primaryColor)
  )?.[0] ?? 'custom'
}

// 0 (black) to 1 (white), as the eye sees it; decides whether the scheme is a dark or a light one.
export function luminance(hex) {
  const channels = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex))
  if (!channels) return 0
  const [red, green, blue] = channels.slice(1).map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export const isLightTheme = (theme) => luminance(theme.bgColor) > 0.4

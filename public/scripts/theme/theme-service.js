import { THEME_PRESETS, fontStack, isLightTheme } from '../shared/appearance.js'

const FALLBACK = THEME_PRESETS.dark

// Sets the three colors the user chose; every other shade (surfaces, borders, muted text) is worked out from them in
// MainColors.css. The "sunken" shade (headers, side columns) goes darker on a dark scheme and only a little on a light one.
export function applyTheme(theme, root = document.documentElement) {
  if (!theme) return

  const colors = {
    bgColor: theme.bgColor || FALLBACK.bgColor,
    textColor: theme.textColor || FALLBACK.textColor,
    primaryColor: theme.primaryColor || FALLBACK.primaryColor
  }
  root.style.setProperty('--bg-color', colors.bgColor)
  root.style.setProperty('--text-color', colors.textColor)
  root.style.setProperty('--primary-color', colors.primaryColor)
  root.style.setProperty('--sunken-amount', isLightTheme(colors) ? '6%' : '35%')
  root.style.setProperty('--app-font', fontStack(theme.font))
  root.style.colorScheme = isLightTheme(colors) ? 'light' : 'dark'
}

// Applies the saved look to a page and keeps it up to date when the settings change.
export async function initTheme(api = globalThis.window?.electronAPI) {
  try {
    const settings = await api?.getAppSettings?.()
    if (settings?.theme) applyTheme(settings.theme)
  } catch (error) {
    console.error('Could not read the theme:', error)
  }
  api?.onThemeChange?.((theme) => applyTheme(theme))
}

export const ThemeService = {
  applyTheme,
  initTheme,
}

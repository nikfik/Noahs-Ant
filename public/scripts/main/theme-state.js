import { defaultTheme } from '../settings/settings-config.js'

export { defaultTheme }

export function createThemeState(initialTheme = {}) {
  let currentTheme = { ...defaultTheme, ...initialTheme }

  return {
    get() {
      return currentTheme
    },
    set(theme) {
      currentTheme = { ...currentTheme, ...theme }
      return currentTheme
    }
  }
}

export function applyThemeToWindow(win, theme) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('theme-changed', theme)
  }
}
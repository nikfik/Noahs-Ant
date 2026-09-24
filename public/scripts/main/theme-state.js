export const defaultTheme = {
  bgColor: '#1a1a1a',
  textColor: '#e0e0e0',
  primaryColor: '#ff4f1a'
}

export function createThemeState() {
  let currentTheme = { ...defaultTheme }

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
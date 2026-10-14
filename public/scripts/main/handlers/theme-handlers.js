import { applyThemeToWindow } from '../theme-state.js'

export function registerThemeHandlers({ ipcMain, BrowserWindow, themeState }) {
  ipcMain.handle('get-theme', () => themeState.get())
  ipcMain.handle('set-theme', (_event, theme) => {
    const nextTheme = themeState.set(theme)
    BrowserWindow.getAllWindows().forEach((win) => applyThemeToWindow(win, nextTheme))
    return nextTheme
  })
}
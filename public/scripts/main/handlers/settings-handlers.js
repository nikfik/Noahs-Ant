export function registerSettingsHandlers({ ipcMain, BrowserWindow, settingsStore, openSettingsWindow }) {
  ipcMain.handle('get-app-settings', () => settingsStore.readAppSettings())
  ipcMain.handle('save-app-settings', (_event, settings) => {
    const saved = settingsStore.writeAppSettings(settings)
    // Other windows (the workspace) pick up changes such as new keyboard shortcuts without a restart.
    BrowserWindow?.getAllWindows().forEach((win) => win.webContents.send('app-settings-changed', saved))
    return saved
  })
  ipcMain.handle('open-settings-window', () => {
    openSettingsWindow()
    return true
  })
}
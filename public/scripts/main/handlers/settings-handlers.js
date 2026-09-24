export function registerSettingsHandlers({ ipcMain, settingsStore, openSettingsWindow }) {
  ipcMain.handle('get-app-settings', () => settingsStore.readAppSettings())
  ipcMain.handle('save-app-settings', (_event, settings) => settingsStore.writeAppSettings(settings))
  ipcMain.handle('open-settings-window', () => {
    openSettingsWindow()
    return true
  })
}
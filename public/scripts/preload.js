const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  createProject: (projectName) => ipcRenderer.invoke('create-project', projectName),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  openProject: (fileName) => ipcRenderer.invoke('open-project', fileName),
  onThemeChange: (callback) => {
    const subscription = (_event, theme) => callback(theme)
    ipcRenderer.on('theme-changed', subscription)
    return () => ipcRenderer.removeListener('theme-changed', subscription)
  }
})

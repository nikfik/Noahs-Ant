const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  createProject: (projectName) => ipcRenderer.invoke('create-project', projectName),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  openProject: (fileName) => ipcRenderer.invoke('open-project', fileName),
  saveProjectEtogram: (fileName, etogramRows) => ipcRenderer.invoke('save-project-etogram', fileName, etogramRows),
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  saveProjectVideoPath: (fileName, videoPath) => ipcRenderer.invoke('save-project-video', fileName, videoPath),
  onThemeChange: (callback) => {
    const subscription = (_event, theme) => callback(theme)
    ipcRenderer.on('theme-changed', subscription)
    return () => ipcRenderer.removeListener('theme-changed', subscription)
  }
})
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
  getProjectAnimals: (projectId) => ipcRenderer.invoke('get-project-animals', projectId),
  saveProjectAnimals: (projectId, data) => ipcRenderer.invoke('save-project-animals', projectId, data),
  getProjectEtograms: (projectId) => ipcRenderer.invoke('get-project-etograms', projectId),
  saveProjectEtograms: (projectId, presets) => ipcRenderer.invoke('save-project-etograms', projectId, presets),
  getProjectObservations: (projectId) => ipcRenderer.invoke('get-project-observations', projectId),
  saveProjectObservations: (projectId, data) => ipcRenderer.invoke('save-project-observations', projectId, data),
  getProjectTrials: (projectId) => ipcRenderer.invoke('get-project-trials', projectId),
  saveProjectTrials: (projectId, data) => ipcRenderer.invoke('save-project-trials', projectId, data),
  saveProjectEtogram: (fileName, etogramRows) => ipcRenderer.invoke('save-project-etogram', fileName, etogramRows),
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  exportWorkbook: (request) => ipcRenderer.invoke('export-workbook', request),
  prepareVideo: (request) => ipcRenderer.invoke('prepare-video', request),
  cancelVideoConversion: () => ipcRenderer.invoke('cancel-video-conversion'),
  probeVideo: (filePath) => ipcRenderer.invoke('probe-video', filePath),
  onVideoConvertProgress: (callback) => {
    const subscription = (_event, progress) => callback(progress)
    ipcRenderer.on('video-convert-progress', subscription)
    return () => ipcRenderer.removeListener('video-convert-progress', subscription)
  },
  onSettingsChange: (callback) => {
    const subscription = (_event, settings) => callback(settings)
    ipcRenderer.on('app-settings-changed', subscription)
    return () => ipcRenderer.removeListener('app-settings-changed', subscription)
  },
  onThemeChange: (callback) => {
    const subscription = (_event, theme) => callback(theme)
    ipcRenderer.on('theme-changed', subscription)
    return () => ipcRenderer.removeListener('theme-changed', subscription)
  }
})
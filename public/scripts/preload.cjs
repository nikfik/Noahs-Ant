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
  inspectVideo: (filePath) => ipcRenderer.invoke('inspect-video', filePath),
  onVideoConvertProgress: (callback) => {
    const subscription = (_event, progress) => callback(progress)
    ipcRenderer.on('video-convert-progress', subscription)
    return () => ipcRenderer.removeListener('video-convert-progress', subscription)
  },
  getProjectInfo: (projectId) => ipcRenderer.invoke('get-project-info', projectId),
  getProjectThumbnail: (projectId) => ipcRenderer.invoke('get-project-thumbnail', projectId),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  pathsExist: (paths) => ipcRenderer.invoke('paths-exist', paths),
  findFilesInFolder: (request) => ipcRenderer.invoke('find-files-in-folder', request),
  startBackupSession: (projectId) => ipcRenderer.invoke('backup-session-start', projectId),
  stopBackupSession: () => ipcRenderer.send('backup-session-stop'),
  listBackups: (projectId) => ipcRenderer.invoke('list-backups', projectId),
  createBackup: (request) => ipcRenderer.invoke('create-backup', request),
  deleteBackup: (request) => ipcRenderer.invoke('delete-backup', request),
  restoreBackup: (request) => ipcRenderer.invoke('restore-backup', request),
  estimateProjectExport: (projectId) => ipcRenderer.invoke('estimate-project-export', projectId),
  exportProject: (request) => ipcRenderer.invoke('export-project', request),
  importProject: () => ipcRenderer.invoke('import-project'),
  onSettingsChange: (callback) => {
    const subscription = (_event, settings) => callback(settings)
    ipcRenderer.on('app-settings-changed', subscription)
    return () => ipcRenderer.removeListener('app-settings-changed', subscription)
  },
  onSettingsCloseRequest: (callback) => {
    const subscription = () => callback()
    ipcRenderer.on('settings-close-request', subscription)
    return () => ipcRenderer.removeListener('settings-close-request', subscription)
  },
  confirmSettingsClose: () => ipcRenderer.send('settings-close-confirmed'),
  onThemeChange: (callback) => {
    const subscription = (_event, theme) => callback(theme)
    ipcRenderer.on('theme-changed', subscription)
    return () => ipcRenderer.removeListener('theme-changed', subscription)
  }
})
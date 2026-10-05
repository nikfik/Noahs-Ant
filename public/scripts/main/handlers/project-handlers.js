export function registerProjectHandlers({ ipcMain, projectStore, animalsStore }) {
  console.log('[main] project IPC handlers registered')
  ipcMain.handle('save-project-video', (_event, fileName, videoPath) => projectStore.saveProjectVideo(fileName, videoPath))
  ipcMain.handle('save-project-etogram', (_event, fileName, etogramRows) => projectStore.saveProjectEtogram(fileName, etogramRows))
  ipcMain.handle('create-project', (_event, projectName) => projectStore.createProject(projectName))
  ipcMain.handle('list-projects', () => {
    console.log('[main] list-projects IPC called')
    return projectStore.listProjects()
  })
  ipcMain.handle('open-project', (_event, fileName) => projectStore.openProject(fileName))
  ipcMain.handle('get-project-animals', (_event, projectId) => animalsStore.readProjectAnimals(projectId))
  ipcMain.handle('save-project-animals', (_event, projectId, animals) => animalsStore.writeProjectAnimals(projectId, animals))
  ipcMain.handle('get-project-etograms', (_event, projectId) => animalsStore.readProjectEtograms(projectId))
  ipcMain.handle('save-project-etograms', (_event, projectId, presets) => animalsStore.writeProjectEtograms(projectId, presets))
}
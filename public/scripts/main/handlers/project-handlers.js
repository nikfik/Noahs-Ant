export function registerProjectHandlers({ ipcMain, projectStore }) {
  console.log('[main] project IPC handlers registered')
  ipcMain.handle('save-project-video', (_event, fileName, videoPath) => projectStore.saveProjectVideo(fileName, videoPath))
  ipcMain.handle('save-project-etogram', (_event, fileName, etogramRows) => projectStore.saveProjectEtogram(fileName, etogramRows))
  ipcMain.handle('create-project', (_event, projectName) => projectStore.createProject(projectName))
  ipcMain.handle('list-projects', () => {
    console.log('[main] list-projects IPC called')
    return projectStore.listProjects()
  })
  ipcMain.handle('open-project', (_event, fileName) => projectStore.openProject(fileName))
}
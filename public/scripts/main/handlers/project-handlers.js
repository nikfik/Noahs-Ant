export function registerProjectHandlers({ ipcMain, projectStore }) {
  ipcMain.handle('save-project-video', (_event, fileName, videoPath) => projectStore.saveProjectVideo(fileName, videoPath))
  ipcMain.handle('save-project-etogram', (_event, fileName, etogramRows) => projectStore.saveProjectEtogram(fileName, etogramRows))
  ipcMain.handle('create-project', (_event, projectName) => projectStore.createProject(projectName))
  ipcMain.handle('list-projects', () => projectStore.listProjects())
  ipcMain.handle('open-project', (_event, fileName) => projectStore.openProject(fileName))
}
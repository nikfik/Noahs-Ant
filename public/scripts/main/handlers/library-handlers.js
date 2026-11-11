export function registerLibraryHandlers({ ipcMain, library, thumbnails, trashItem }) {
  ipcMain.handle('get-project-info', (_event, projectId) => library.getProjectInfo(projectId))
  ipcMain.handle('get-project-thumbnail', (_event, projectId) => thumbnails.get(projectId))
  ipcMain.handle('delete-project', (_event, projectId) => library.deleteProject(projectId, trashItem))
  ipcMain.handle('paths-exist', (_event, paths) => library.pathsExist(paths))
  ipcMain.handle('find-files-in-folder', (_event, request) => library.findFilesInFolder(request?.folder, request?.names))
}

export function registerFileHandlers({ ipcMain, dialog }) {
  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
    })

    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })
}
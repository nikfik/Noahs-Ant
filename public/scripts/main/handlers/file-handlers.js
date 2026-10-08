import path from 'node:path'
import { normalizeSheets, sanitizeFileName } from '../workbook-export.js'

export function registerFileHandlers({ ipcMain, dialog, writeWorkbook, getDefaultDirectory = () => '' }) {
  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
    })

    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('export-workbook', async (_event, request) => {
    const sheets = normalizeSheets(request?.sheets)
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(getDefaultDirectory(), sanitizeFileName(request?.suggestedName)),
      filters: [{ name: 'Excel (.xlsx)', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return { saved: false }

    const filePath = /\.xlsx$/i.test(result.filePath) ? result.filePath : `${result.filePath}.xlsx`
    writeWorkbook(filePath, sheets)
    return { saved: true, filePath }
  })
}

import path from 'node:path'
import { normalizeSheets, sanitizeFileName } from '../workbook-export.js'

// Camera and editing formats as well; the ones the player cannot open are converted after they are picked.
const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'mts', 'm2ts', 'ts', 'mpg', 'mpeg', 'wmv', 'flv', '3gp', 'mxf']

export function registerFileHandlers({ ipcMain, dialog, writeWorkbook, getDefaultDirectory = () => '' }) {
  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Pliki wideo', extensions: VIDEO_EXTENSIONS },
        { name: 'Wszystkie pliki', extensions: ['*'] }
      ]
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

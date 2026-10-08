import path from 'node:path'
import { jest } from '@jest/globals'
import { registerFileHandlers } from '../public/scripts/main/handlers/file-handlers.js'

function setup(saveResult) {
  const handlers = {}
  const ipcMain = { handle: (name, handler) => { handlers[name] = handler } }
  const dialog = {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn().mockResolvedValue(saveResult)
  }
  const writeWorkbook = jest.fn()
  registerFileHandlers({ ipcMain, dialog, writeWorkbook, getDefaultDirectory: () => path.join('C:', 'Documents') })
  return { handlers, dialog, writeWorkbook }
}

const request = { suggestedName: 'Study: 1_metryki.xlsx', sheets: [{ name: 'Metryki', headers: ['a'], rows: [[1]] }] }

describe('Export workbook IPC handler', () => {
  test('asks where to save, adds the extension, writes the file and reports the path', async () => {
    const { handlers, dialog, writeWorkbook } = setup({ canceled: false, filePath: path.join('C:', 'out', 'wyniki') })

    const result = await handlers['export-workbook']({}, request)

    expect(dialog.showSaveDialog.mock.calls[0][0].defaultPath).toBe(path.join('C:', 'Documents', 'Study_ 1_metryki.xlsx'))
    expect(dialog.showSaveDialog.mock.calls[0][0].filters[0].extensions).toEqual(['xlsx'])
    expect(writeWorkbook).toHaveBeenCalledWith(path.join('C:', 'out', 'wyniki.xlsx'), expect.any(Array))
    expect(result).toEqual({ saved: true, filePath: path.join('C:', 'out', 'wyniki.xlsx') })
  })

  test('writes nothing when the dialog is cancelled', async () => {
    const { handlers, writeWorkbook } = setup({ canceled: true })
    expect(await handlers['export-workbook']({}, request)).toEqual({ saved: false })
    expect(writeWorkbook).not.toHaveBeenCalled()
  })

  test('refuses malformed requests before showing any dialog', async () => {
    const { handlers, dialog, writeWorkbook } = setup({ canceled: false, filePath: 'x.xlsx' })
    await expect(handlers['export-workbook']({}, { sheets: 'nope' })).rejects.toThrow('Nieprawidłowe dane do eksportu')
    await expect(handlers['export-workbook']({}, undefined)).rejects.toThrow()
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
    expect(writeWorkbook).not.toHaveBeenCalled()
  })

  test('still offers the video file picker', async () => {
    const { handlers, dialog } = setup({ canceled: true })
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/video.mp4'] })
    expect(await handlers['select-video-file']()).toBe('C:/video.mp4')
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await handlers['select-video-file']()).toBeNull()
  })
})

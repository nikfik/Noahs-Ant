import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { jest } from '@jest/globals'
import { isTextExport, sheetsToText, writeTextFiles, writeWorkbook } from '../public/scripts/main/workbook-export.js'
import { registerFileHandlers } from '../public/scripts/main/handlers/file-handlers.js'
import { normalizeAppSettings } from '../public/scripts/settings/settings-model.js'

const sheets = [
  { name: 'Metryki', headers: ['Próba', 'Czas (s)', 'Uwagi'], rows: [['A, "x"', 1.23456, null], ['B', 2, 'ok']], formats: { 1: '0.000' } },
  { name: 'Zdarzenia', headers: ['a'], rows: [[1]] }
]

describe('text export', () => {
  test('quotes fields, keeps the precision of the number format and leaves empty cells empty', () => {
    const [first] = sheetsToText(sheets, ',')
    expect(first.text).toBe('Próba,Czas (s),Uwagi\r\n"A, ""x""",1.235,\r\nB,2.000,ok\r\n')
    expect(sheetsToText(sheets, '\t')[0].text.split('\r\n')[1]).toBe('"A, ""x"""\t1.235\t')
  })

  test('writes one file per sheet next to the chosen name, csv with a byte order mark', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-csv-'))
    try {
      const files = writeTextFiles(path.join(directory, 'wyniki.csv'), sheets)
      expect(files.map((file) => path.basename(file))).toEqual(['wyniki - Metryki.csv', 'wyniki - Zdarzenia.csv'])
      expect(fs.readFileSync(files[0], 'utf8').startsWith('﻿Próba,')).toBe(true)
      const [txt] = writeTextFiles(path.join(directory, 'wyniki.txt'), sheets)
      expect(fs.readFileSync(txt, 'utf8').startsWith('Próba\tCzas')).toBe(true)
      expect(isTextExport('x.CSV')).toBe(true)
      expect(isTextExport('x.xlsx')).toBe(false)
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })

  test('the save handler offers all three types and writes text files for .csv and .txt', async () => {
    const registered = {}
    const dialog = { showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: path.join('C:', 'out', 'wyniki.csv') }) }
    const writeText = jest.fn(() => ['a', 'b'])
    const writeBook = jest.fn()
    registerFileHandlers({ ipcMain: { handle: (name, handler) => { registered[name] = handler } }, dialog, writeWorkbook: writeBook, writeTextFiles: writeText })

    const result = await registered['export-workbook']({}, { suggestedName: 'x.xlsx', sheets })

    expect(dialog.showSaveDialog.mock.calls[0][0].filters.flatMap((filter) => filter.extensions)).toEqual(['xlsx', 'csv', 'txt'])
    expect(writeText).toHaveBeenCalledWith(path.join('C:', 'out', 'wyniki.csv'), expect.any(Array))
    expect(writeBook).not.toHaveBeenCalled()
    expect(result).toEqual({ saved: true, filePath: 'a', files: ['a', 'b'] })
    expect(typeof writeWorkbook).toBe('function')
  })
})

describe('jump length setting', () => {
  test('accepts a sensible value and falls back to 5 seconds otherwise', () => {
    expect(normalizeAppSettings({ video: { skipSeconds: 2.5 } }).video.skipSeconds).toBe(2.5)
    expect(normalizeAppSettings({ video: { skipSeconds: 0 } }).video.skipSeconds).toBe(5)
    expect(normalizeAppSettings({ video: { skipSeconds: 9999 } }).video.skipSeconds).toBe(5)
    expect(normalizeAppSettings({ video: { skipSeconds: '10' } }).video.skipSeconds).toBe(5)
  })
})

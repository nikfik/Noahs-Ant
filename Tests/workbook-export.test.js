import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import XLSX from 'xlsx'
import {
  buildWorkbook,
  normalizeSheets,
  sanitizeFileName,
  sanitizeSheetName,
  writeWorkbook
} from '../public/scripts/main/workbook-export.js'

describe('Workbook export', () => {
  test('writes a real .xlsx file with values, number formats, column widths and a filter', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-xlsx-'))
    const filePath = path.join(directory, 'metryki.xlsx')

    writeWorkbook(filePath, [{
      name: 'Metryki',
      headers: ['Próba', 'Latencja (s)', 'Liczba'],
      rows: [['A2M1 / Head / 1', 1.23456, 3], ['A2M1 / Head / 2', null, 0]],
      formats: { 1: '0.000', 2: '0' }
    }])

    const workbook = XLSX.readFile(filePath, { cellNF: true })
    const sheet = workbook.Sheets.Metryki
    expect(workbook.SheetNames).toEqual(['Metryki'])
    expect([sheet.A1.v, sheet.B1.v, sheet.C1.v]).toEqual(['Próba', 'Latencja (s)', 'Liczba'])
    expect([sheet.A2.v, sheet.A3.v]).toEqual(['A2M1 / Head / 1', 'A2M1 / Head / 2'])
    expect(sheet.B2.v).toBe(1.23456)
    expect(sheet.C3.v).toBe(0)
    expect(sheet.B2.z).toBe('0.000')
    expect(sheet.C2.z).toBe('0')
    expect(sheet.B3).toBeUndefined()
    expect(sheet['!autofilter'].ref).toBe('A1:C3')

    fs.rmSync(directory, { recursive: true, force: true })
  })

  test('sizes columns to their content, within limits', () => {
    const sheet = buildWorkbook([{
      name: 'Szerokość',
      headers: ['Próba', 'k', 'Bardzo długi nagłówek który nie powinien rozciągać kolumny w nieskończoność'],
      rows: [['A2M1 / Head / 1', 1, 'x']]
    }]).Sheets['Szerokość']

    expect(sheet['!cols'][0].wch).toBe(17)
    expect(sheet['!cols'][1].wch).toBe(10)
    expect(sheet['!cols'][2].wch).toBe(48)
  })

  test('gives sheets valid, unique names', () => {
    const used = new Set()
    expect(sanitizeSheetName('Metryki: [wide]/1?', used)).toBe('Metryki wide 1')
    expect(sanitizeSheetName('Metryki wide 1', used)).toBe('Metryki wide 1 (2)')
    expect(sanitizeSheetName('x'.repeat(40), new Set())).toHaveLength(31)
    expect(sanitizeSheetName('', new Set())).toBe('Arkusz')

    const workbook = buildWorkbook([{ name: 'Dane', headers: ['a'], rows: [[1]] }, { name: 'dane', headers: ['a'], rows: [[2]] }])
    expect(workbook.SheetNames).toEqual(['Dane', 'dane (2)'])
  })

  test('makes safe file names that end in .xlsx', () => {
    expect(sanitizeFileName('Study: 1/2?.xlsx')).toBe('Study_ 1_2_.xlsx')
    expect(sanitizeFileName('')).toBe('eksport.xlsx')
    expect(sanitizeFileName('metryki')).toBe('metryki.xlsx')
    expect(sanitizeFileName(undefined)).toBe('eksport.xlsx')
  })

  test('accepts only plain values and rejects malformed or oversized requests', () => {
    const [sheet] = normalizeSheets([{
      name: 'S',
      headers: ['a', 5, null],
      rows: [[1, 'x', true, NaN, Infinity, undefined, { nested: 1 }], 'not-a-row'],
      formats: { 0: '0.0', '-1': '0', x: '0', 2: 7 }
    }])

    expect(sheet.headers).toEqual(['a', '5', ''])
    expect(sheet.rows).toEqual([[1, 'x', true, null, null, null, '[object Object]'], []])
    expect(sheet.formats).toEqual({ 0: '0.0' })

    expect(() => normalizeSheets(undefined)).toThrow('Nieprawidłowe dane do eksportu')
    expect(() => normalizeSheets([])).toThrow('Nieprawidłowe dane do eksportu')
    expect(() => normalizeSheets(Array.from({ length: 13 }, () => ({ name: 'x' })))).toThrow('Nieprawidłowe dane do eksportu')
    expect(() => normalizeSheets([{ name: 'big', headers: ['a'], rows: new Array(100001).fill([1]) }])).toThrow('Za dużo wierszy')
  })
})

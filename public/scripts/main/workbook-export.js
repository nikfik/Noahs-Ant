import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const MAX_SHEETS = 12
const MAX_ROWS = 100000
const MAX_COLUMNS = 2000
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g
const INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g

export function sanitizeSheetName(name, usedNames = new Set()) {
  const base = String(name || 'Arkusz').replace(INVALID_SHEET_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Arkusz'
  let candidate = base
  let counter = 2
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    counter += 1
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

export function sanitizeFileName(name) {
  const cleaned = String(name || '').replace(INVALID_FILE_CHARS, '_').trim().replace(/\.+$/, '')
  const withExtension = /\.(xlsx|csv|txt)$/i.test(cleaned) ? cleaned : `${cleaned || 'eksport'}.xlsx`
  return withExtension.slice(-120)
}

const toCell = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  return value === null || value === undefined ? null : String(value)
}

// The request comes from the page, so it is checked and trimmed to plain values before anything is written.
export function normalizeSheets(sheets) {
  if (!Array.isArray(sheets) || !sheets.length || sheets.length > MAX_SHEETS) {
    throw new Error('Nieprawidłowe dane do eksportu.')
  }

  return sheets.map((sheet) => {
    const headers = Array.isArray(sheet?.headers) ? sheet.headers.slice(0, MAX_COLUMNS).map((header) => String(header ?? '')) : []
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
    if (rows.length > MAX_ROWS) throw new Error('Za dużo wierszy do wyeksportowania.')

    const formats = {}
    Object.entries(sheet?.formats && typeof sheet.formats === 'object' ? sheet.formats : {}).forEach(([column, format]) => {
      if (Number.isInteger(Number(column)) && Number(column) >= 0 && typeof format === 'string' && format.length <= 30) {
        formats[Number(column)] = format
      }
    })

    return {
      name: String(sheet?.name || ''),
      headers,
      rows: rows.map((row) => (Array.isArray(row) ? row.slice(0, MAX_COLUMNS).map(toCell) : [])),
      formats
    }
  })
}

export function buildWorkbook(sheets) {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set()

  normalizeSheets(sheets).forEach(({ name, headers, rows, formats }) => {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

    Object.entries(formats).forEach(([column, format]) => {
      for (let row = 1; row <= rows.length; row += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: Number(column) })]
        if (cell && cell.t === 'n') cell.z = format
      }
    })

    worksheet['!cols'] = headers.map((header, column) => ({
      wch: Math.min(48, Math.max(8, header.length, ...rows.slice(0, 200).map((row) => String(row[column] ?? '').length)) + 2)
    }))
    if (headers.length && rows.length) {
      worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(name, usedNames))
  })

  return workbook
}

const TEXT_FORMATS = {
  '.csv': { delimiter: ',', bom: true },
  '.txt': { delimiter: '\t', bom: false }
}

export const isTextExport = (filePath) => Object.hasOwn(TEXT_FORMATS, path.extname(filePath).toLowerCase())

// A number keeps the precision its Excel format would show (0.000 -> three decimals).
const formatNumber = (value, format) => {
  const decimals = /\.(0+)$/.exec(format || '')?.[1].length
  return decimals === undefined ? String(value) : value.toFixed(decimals)
}

function textField(value, delimiter) {
  const text = String(value)
  return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// One text per sheet: the header row, then the data rows. Empty cells stay empty.
export function sheetsToText(sheets, delimiter) {
  return normalizeSheets(sheets).map(({ name, headers, rows, formats }) => ({
    name,
    text: [headers, ...rows.map((row) => row.map((value, column) => typeof value === 'number' ? formatNumber(value, formats[column]) : value))]
      .map((row) => row.map((value) => value === null || value === undefined ? '' : textField(value, delimiter)).join(delimiter))
      .join('\r\n') + '\r\n'
  }))
}

// Text files hold one table each, so a workbook becomes several files: "<name> - <sheet>.csv".
export function writeTextFiles(filePath, sheets) {
  const extension = path.extname(filePath).toLowerCase()
  const { delimiter, bom } = TEXT_FORMATS[extension]
  const stem = filePath.slice(0, -extension.length)
  const used = new Set()

  return sheetsToText(sheets, delimiter).map(({ name, text }) => {
    const sheetName = sanitizeSheetName(name, used).replace(INVALID_FILE_CHARS, '_')
    const target = `${stem} - ${sheetName}${extension}`
    fs.writeFileSync(target, `${bom ? '\ufeff' : ''}${text}`, 'utf8')
    return target
  })
}

export function writeWorkbook(filePath, sheets) {
  XLSX.writeFile(buildWorkbook(sheets), filePath)
  return filePath
}

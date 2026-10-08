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
  const withExtension = /\.xlsx$/i.test(cleaned) ? cleaned : `${cleaned || 'eksport'}.xlsx`
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

export function writeWorkbook(filePath, sheets) {
  XLSX.writeFile(buildWorkbook(sheets), filePath)
  return filePath
}

/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { applyRounding, buildExportSheets, formatCell, roundValue } from '../public/scripts/workspace/data/export-model.js'
import { openExportPreview } from '../public/scripts/workspace/data/export-preview.js'
import { DataMetricsModule } from '../public/scripts/workspace/data/data-metrics-module.js'

describe('rounding rules', () => {
  test('rounds, truncates or rounds up to the chosen places', () => {
    expect(roundValue(1.2345, 2, 'round')).toBe(1.23)
    expect(roundValue(1.2355, 3, 'round')).toBe(1.236)
    expect(roundValue(1.239, 2, 'trunc')).toBe(1.23)
    expect(roundValue(1.231, 2, 'ceil')).toBe(1.24)
    expect(roundValue(2.6, 0, 'trunc')).toBe(2)
    expect(roundValue(-1.239, 2, 'trunc')).toBe(-1.23)
    expect(roundValue(0.1 + 0.2, 1, 'trunc')).toBe(0.3)
    expect(Object.is(roundValue(-0.0001, 2, 'round'), 0)).toBe(true)
  })

  test('only fractional columns change, and their number format follows', () => {
    const sheets = [{ name: 'S', headers: ['a', 'b', 'c'], rows: [[12.3456, 7, 'x'], [null, 3, 'y']], formats: { 0: '0.000', 1: '0' } }]
    const [rounded] = applyRounding(sheets, { decimals: 1, rule: 'trunc' })
    expect(rounded.rows).toEqual([[12.3, 7, 'x'], [null, 3, 'y']])
    expect(rounded.formats).toEqual({ 0: '0.0', 1: '0' })
    expect(applyRounding(sheets, { decimals: 0, rule: 'round' })[0].formats[0]).toBe('0')
    expect(applyRounding(sheets, null)).toBe(sheets)
    expect(sheets[0].rows[0][0]).toBe(12.3456)
  })

  test('formats cells like the exported file shows them', () => {
    expect(formatCell(1.5, '0.000')).toBe('1.500')
    expect(formatCell(3, '0')).toBe('3')
    expect(formatCell(null, '0.0')).toBe('')
    expect(formatCell('abc')).toBe('abc')
  })

  test('the whole export can be rounded, and says so in the information sheet', () => {
    const trials = [{ id: 't1', name: 'T', duration: 100 / 3, skips: [] }]
    const sheets = buildExportSheets({ trials, rounding: { decimals: 1, rule: 'round' }, exportedAt: new Date(0) })
    const windows = sheets.find((sheet) => sheet.name === 'Okna prób')
    expect(windows.rows[0][1]).toBe(33.3)
    expect(windows.formats[1]).toBe('0.0')
    expect(sheets.find((sheet) => sheet.name === 'Informacje').rows.some((row) => row[0] === 'Zaokrąglanie')).toBe(true)
    expect(buildExportSheets({ trials }).find((sheet) => sheet.name === 'Okna prób').rows[0][1]).toBeCloseTo(33.333333, 5)
  })
})

describe('export preview', () => {
  const build = (rounding) => applyRounding([
    { name: 'Pierwszy', headers: ['x', 'n'], rows: [[1.23456, 5]], formats: { 0: '0.000' } },
    { name: 'Drugi', headers: ['y'], rows: [] }
  ], rounding)

  afterEach(() => { document.body.innerHTML = '' })

  test('shows the sheets, applies the chosen decimals at once and reports the choice', () => {
    const onChange = jest.fn()
    openExportPreview({ getSheets: build, rounding: null, onChange })
    const modal = document.querySelector('.export-preview-modal')
    expect(modal.classList.contains('modal')).toBe(true)
    expect([...modal.querySelectorAll('[data-sheet]')].map((tab) => tab.textContent)).toEqual(['Pierwszy', 'Drugi'])
    expect(modal.querySelector('tbody td').textContent).toBe('1.235')
    expect(modal.querySelector('[data-rule]').disabled).toBe(true)

    const decimals = modal.querySelector('[data-decimals]')
    decimals.value = '1'
    decimals.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('tbody td').textContent).toBe('1.2')
    expect(onChange).toHaveBeenLastCalledWith({ decimals: 1, rule: 'round' })

    const rule = document.querySelector('[data-rule]')
    rule.value = 'ceil'
    rule.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('tbody td').textContent).toBe('1.3')

    document.querySelector('[data-sheet="1"]').click()
    expect(document.querySelector('.export-preview-table').textContent).toContain('pusty')
  })

  test('closes with Escape and the close button, and exports from the dialog', () => {
    const onExport = jest.fn()
    openExportPreview({ getSheets: build, rounding: { decimals: 2, rule: 'trunc' }, onExport })
    expect(document.querySelector('[data-decimals]').value).toBe('2')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.export-preview-modal')).toBeNull()

    openExportPreview({ getSheets: build, rounding: null, onExport })
    document.querySelector('[data-export]').click()
    expect(onExport).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.export-preview-modal')).toBeNull()
  })
})

describe('metrics screen: preview and rounding', () => {
  test('the export button opens the preview first, the choice is remembered and used by the export', async () => {
    localStorage.clear()
    document.body.innerHTML = '<div id="data-metrics-module"></div>'
    window.electronAPI = { exportWorkbook: jest.fn().mockResolvedValue({ saved: true, filePath: 'x.xlsx' }) }
    const trials = [{ id: 't1', name: 'T', duration: 100 / 3, skips: [] }]
    DataMetricsModule.init('data-metrics-module', {
      observationStore: { getAll: () => [], subscribe: jest.fn() },
      animalCatalog: { getData: () => ({ animals: [] }), getPresets: () => [] },
      trialCatalog: { getData: () => ({ trials }) },
      projectName: 'Study'
    })

    expect(document.querySelectorAll('.data-export')).toHaveLength(1)
    document.querySelector('[data-action="export-xlsx"]').click()
    expect(window.electronAPI.exportWorkbook).not.toHaveBeenCalled()
    const decimals = document.querySelector('[data-decimals]')
    decimals.value = '1'
    decimals.dispatchEvent(new Event('change', { bubbles: true }))
    document.querySelector('[data-export]').click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const request = window.electronAPI.exportWorkbook.mock.calls[0][0]
    expect(request.sheets.find((sheet) => sheet.name === 'Okna prób').rows[0][1]).toBe(33.3)
    expect(JSON.parse(localStorage.getItem('noahs-ant.metrics')).decimals).toBe(1)
  })
})

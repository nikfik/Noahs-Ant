/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { setLanguage } from '../public/scripts/shared/i18n.js'
import { buildExportSheets, suggestExportName } from '../public/scripts/workspace/data/export-model.js'
import { applyEventEdit } from '../public/scripts/workspace/data/event-table-model.js'
import { buildChartData, yAxisLabel } from '../public/scripts/workspace/charts/chart-model.js'
import { createChartsModule } from '../public/scripts/workspace/charts/charts-module.js'
import { createTransitionsModule } from '../public/scripts/workspace/transitions/transitions-module.js'
import { createBackupsModule } from '../public/scripts/workspace/backups/backups-module.js'
import { DataMetricsModule } from '../public/scripts/workspace/data/data-metrics-module.js'
import { openExportPreview } from '../public/scripts/workspace/data/export-preview.js'
import { readBundle, BundleError } from '../public/scripts/main/project-bundle.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const animals = [{ id: 'a', groupId: 'g', name: 'Ant', etogramPresetId: 'p' }]
const groups = [{ id: 'g', name: 'Species' }]
const trials = [{ id: 't1', name: 'Test 1', duration: 100, skips: [] }]
const presets = [{ id: 'p', activities: [{ id: 'run', name: 'Run', continuous: true, category: '' }] }]
const observations = [{ id: 'o', animalId: 'a', trialId: 't1', activityId: 'run', activityName: 'Run', activityColor: '#fff', kind: 'interval', start: 1, end: 5, lane: null }]

beforeEach(() => {
  setLanguage('en')
  localStorage.clear()
})
afterEach(() => {
  setLanguage('pl')
  document.body.innerHTML = ''
})

describe('exports in English', () => {
  test('sheets, headers and the information sheet follow the language', () => {
    const sheets = buildExportSheets({ observations, trials, animals, presets, exportedAt: new Date(0) })
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Metrics', 'Metrics (long format)', 'Events', 'Trial windows', 'Skips', 'Information'])
    expect(sheets[0].headers.slice(0, 3)).toEqual(['Trial', 'Window from (s)', 'Window to (s)'])
    expect(sheets[0].headers[3]).toBe('Ant – Run: occurred (1/0)')
    expect(sheets[1].headers.slice(0, 4)).toEqual(['Trial', 'Animal', 'Behavior', 'Level'])
    expect(sheets[1].headers[4]).toBe('Occurred (1/0)')
    expect(sheets[2].rows[0][3]).toBe('continuous')
    expect(sheets[5].headers).toEqual(['Parameter', 'Description'])
    expect(sheets[5].rows[1][0]).toBe('Category totals (Σ)')
    expect(sheets[5].rows[1][1]).toBe('no')
    expect(suggestExportName('Study', new Date(2026, 0, 5))).toBe('Study_metrics_2026-01-05.xlsx')
    expect(buildExportSheets({ observations, trials, animals, presets, rounding: { decimals: 1, rule: 'trunc' } })[5].rows.some((row) => row[0] === 'Rounding' && row[1].includes('truncation'))).toBe(true)
  })

  test('the preview and the messages of the event table', () => {
    openExportPreview({ getSheets: () => buildExportSheets({ observations, trials, animals, presets }), rounding: null })
    const modal = document.querySelector('.export-preview-modal')
    expect(modal.textContent).toContain('Export preview')
    expect(modal.textContent).toContain('Decimal places')
    expect([...modal.querySelectorAll('[data-rule] option')].map((option) => option.textContent)).toEqual(['Mathematical (from 5 up)', 'Truncation', 'Always round up'])
    expect(applyEventEdit(observations, 'o', 'start', 'x').error).toBe('Enter a valid start time, e.g. 12.5 or 1:02.5.')
    expect(applyEventEdit(observations, 'missing', 'start', '1').error).toBe('Event not found.')
  })
})

describe('the Data, Charts and Transitions screens in English', () => {
  const store = { getAll: () => observations, subscribe: jest.fn() }
  const animalCatalog = { getData: () => ({ animals, groups }), getPresets: () => presets }
  const trialCatalog = { getData: () => ({ trials }) }

  test('the metrics screen', () => {
    document.body.innerHTML = '<div id="data-metrics-module"></div>'
    window.electronAPI = { exportWorkbook: jest.fn() }
    DataMetricsModule.init('data-metrics-module', { observationStore: store, animalCatalog, trialCatalog, projectName: 'Study' })
    const headers = [...document.querySelectorAll('.metrics-table thead th')].map((th) => th.textContent.trim().replace(/\s+/g, ' '))
    expect(headers.slice(0, 3)).toEqual(['Trial', 'Animal', 'Behavior'])
    expect(headers).toContain('Latency (s)')
    expect(document.querySelector('[data-action="export-xlsx"]').textContent).toBe('Export data')
    expect(document.querySelector('.data-window summary').textContent).toBe('Analysis window of the trials')
    expect(document.querySelector('[data-action="export-xlsx"]').title).toContain('Shows a preview')
  })

  test('the charts screen and its numbers', () => {
    document.body.innerHTML = '<div id="charts-module"></div>'
    createChartsModule().init('charts-module', { observationStore: store, animalCatalog, trialCatalog, projectName: 'Study' })
    expect(document.querySelector('.charts-sidebar h3').textContent).toBe('Blocks')
    expect(document.querySelector('.charts-canvas.empty').textContent).toContain('Drag a behavior')
    expect([...document.querySelectorAll('.chart-chip-grouping')].map((chip) => chip.textContent)).toEqual(['Animal group', 'Animal', 'Trial'])
    expect(document.querySelector('[data-kind="box"]').textContent).toBe('Box')
    expect(yAxisLabel(buildChartData({ observations, trials, animals, groups, presets }, { valueIds: ['value|duration|Run'], grouping: 'group', aggregate: 'mean', kind: 'bar' }), 'bar')).toBe('mean total time [s]')
    expect(buildChartData({ observations, trials, animals, groups, presets }, { valueIds: ['value|duration|Run'], grouping: null, kind: 'bar' }).categories).toEqual(['Everything'])
  })

  test('the transitions screen', () => {
    document.body.innerHTML = '<div id="transitions-module"></div>'
    createTransitionsModule().init('transitions-module', { observationStore: store, animalCatalog, trialCatalog, projectName: 'Study' })
    expect(document.querySelector('.charts-sidebar h3').textContent).toBe('Transitions between behaviors')
    expect(document.querySelector('[data-mode] option').textContent).toBe('Order of events')
    expect(document.querySelector('.charts-canvas.empty').textContent).toContain('No transitions')
    expect(document.querySelector('.charts-options span').textContent).toBe('1 animal in a trial · 0 transitions')
  })

  test('the backups dialog counts in English', async () => {
    document.body.innerHTML = '<button id="backups-btn"></button>'
    const api = {
      startBackupSession: jest.fn().mockResolvedValue(true),
      stopBackupSession: jest.fn(),
      getAppSettings: jest.fn().mockResolvedValue({ backup: { enabled: false } }),
      listBackups: jest.fn().mockResolvedValue([{ name: 'safety-1.nsant', kind: 'safety', label: 'Przed przywróceniem kopii', createdAt: '2026-11-11T12:00:00.000Z', counts: { trials: 1, animals: 3, events: 1 }, size: 2048 }])
    }
    createBackupsModule().init({ projectId: 'Study', api })
    document.getElementById('backups-btn').click()
    await flush()
    const modal = document.querySelector('.backups-modal')
    expect(modal.textContent).toContain('1 trial, 3 animals, 1 event')
    expect(modal.textContent).toContain('Before a restore')
    expect(modal.textContent).toContain('Before restoring a backup')
    expect(modal.textContent).toContain('Automatic backups are switched off.')
    modal.remove()
  })
})

describe('messages of the main process in English', () => {
  test('an unreadable project file is explained in English', async () => {
    await expect(readBundle('C:/definitely/not/there.nsant')).rejects.toThrow('This is not a valid project file.')
    await expect(readBundle('C:/definitely/not/there.nsant')).rejects.toBeInstanceOf(BundleError)
  })
})

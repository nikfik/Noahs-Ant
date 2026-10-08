/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { createDataMetricsModule } from '../public/scripts/workspace/data/data-metrics-module.js'
import { initDataTabs } from '../public/scripts/workspace/data/data-tabs.js'
import { createObservationStore } from '../public/scripts/workspace/observations/observation-store.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const change = (node, value) => {
  node.value = value
  node.dispatchEvent(new Event('change', { bubbles: true }))
}
const interval = (id, start, end, extra = {}) => ({
  id, animalId: 'rescuer', activityId: 'dig', activityName: 'Kopanie', activityColor: '#42a56b',
  kind: 'interval', start, end, lane: null, trialId: 't1', ...extra
})

const animals = [{ id: 'rescuer', name: 'Ratownik', etogramPresetId: 'preset' }]
const presets = [{ id: 'preset', activities: [
  { id: 'contact', name: 'Kontakt', continuous: true, category: 'Bez kategorii' },
  { id: 'dig', name: 'Kopanie', continuous: true, category: 'Ratowanie' },
  { id: 'pull', name: 'Ciągnięcie', continuous: true, category: 'Ratowanie' }
] }]

describe('Data metrics module', () => {
  let trialData
  let trialCatalog

  async function setup(projectName = '') {
    localStorage.clear()
    document.body.innerHTML = '<div id="view-data"><div id="data-metrics-module"></div></div>'
    trialData = { trials: [
      { id: 't1', name: 'Próba 1', duration: 300, windowStart: null, windowEnd: null },
      { id: 't2', name: 'Próba 2', duration: null, windowStart: null, windowEnd: null }
    ] }
    trialCatalog = {
      getData: () => trialData,
      updateTrial: jest.fn(async (id, changes) => {
        trialData = { trials: trialData.trials.map((trial) => trial.id === id ? { ...trial, ...changes } : trial) }
        window.dispatchEvent(new CustomEvent('active-trial-changed'))
      })
    }
    const store = createObservationStore({ projectId: 'Study', api: {
      getProjectObservations: jest.fn().mockResolvedValue({ observations: [
        interval('d1', 10, 20),
        interval('p1', 30, 40, { activityId: 'pull', activityName: 'Ciągnięcie' })
      ] }),
      saveProjectObservations: jest.fn(async (_id, data) => data)
    } })
    await store.load()
    createDataMetricsModule().init('data-metrics-module', {
      observationStore: store,
      animalCatalog: { getData: () => ({ animals }), getPresets: () => presets },
      trialCatalog,
      projectName
    })
    return store
  }

  const metricRow = (trialName, name) => Array.from(document.querySelectorAll('.metrics-table tbody tr'))
    .map((row) => Array.from(row.children).map((cell) => cell.textContent.trim()))
    .find((cells) => cells[0] === trialName && cells[2] === name)

  test('shows presence, latency, count, duration and both percentages, with category totals', async () => {
    await setup()

    expect(metricRow('Próba 1', 'Kopanie')).toEqual(['Próba 1', 'Ratownik', 'Kopanie', 'tak', '10.000', '1', '10.000', '3.3', '3.4'])
    expect(metricRow('Próba 1', 'Σ Ratowanie')).toEqual(['Próba 1', 'Ratownik', 'Σ Ratowanie', 'tak', '10.000', '2', '20.000', '6.7', '6.9'])
    expect(metricRow('Próba 1', 'Kontakt')).toEqual(['Próba 1', 'Ratownik', 'Kontakt', 'nie', '—', '0', '0.000', '0.0', '—'])
    expect(document.querySelector('.metric-category')).not.toBeNull()
  })

  test('filters by trial and hides category totals on request', async () => {
    await setup()

    change(document.querySelector('[data-filter="trialId"]'), 't2')
    expect(Array.from(document.querySelectorAll('.metrics-table tbody tr')).every((row) => row.children[0].textContent === 'Próba 2')).toBe(true)

    const toggle = document.querySelector('[data-toggle="categories"]')
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('.metric-category')).toBeNull()
  })

  test('updates after events change and warns when a trial has no video length', async () => {
    const store = await setup()
    expect(document.querySelector('[data-trial-id="t2"] .data-window-note').textContent).toMatch(/brak długości wideo/)
    expect(document.querySelector('[data-trial-id="t1"] .data-window-note').textContent).toBe('')

    await store.commit([...store.getAll(), interval('d2', 100, 110)])
    expect(metricRow('Próba 1', 'Kopanie').slice(5, 7)).toEqual(['2', '20.000'])
  })

  test('explains columns and options in tooltips instead of a text block', async () => {
    await setup()

    const headers = Array.from(document.querySelectorAll('.metrics-table th'))
    expect(headers).toHaveLength(9)
    expect(headers.every((header) => header.title.length > 10)).toBe(true)
    expect(headers[8].title).toMatch(/okna − latencja/)
    expect(document.querySelector('[data-toggle="merge"]').closest('label').title).toMatch(/nakładające/)
    expect(document.querySelector('[data-toggle="categories"]').closest('label').title).toMatch(/kategorie/)
    expect(document.querySelector('.data-window summary').title).toMatch(/5 minut/)
    expect(document.querySelector('.data-status').textContent).not.toMatch(/% okna =/)
  })

  test('colors the yes/no cells and remembers when they are turned off', async () => {
    await setup()
    expect(document.querySelectorAll('.metric-flag.metric-yes').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.metric-flag.metric-no').length).toBeGreaterThan(0)

    const toggle = document.querySelector('[data-toggle="colors"]')
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('.metric-yes, .metric-no')).toBeNull()
    expect(JSON.parse(localStorage.getItem('noahs-ant.metrics')).colorize).toBe(false)
  })

  test('sorts by a clicked column and returns to the natural order on the third click', async () => {
    await setup()
    const counts = () => Array.from(document.querySelectorAll('.metrics-table tbody tr')).map((row) => row.children[5].textContent)
    const naturalFirst = document.querySelector('.metrics-table tbody tr').children[2].textContent
    const header = () => document.querySelector('[data-sort="count"]')

    header().click()
    expect(counts()[0]).toBe('0')
    expect(counts().at(-1)).toBe('2')
    expect(header().closest('th').getAttribute('aria-sort')).toBe('ascending')
    expect(header().querySelector('.sort-mark').textContent).toBe('▲')

    header().click()
    expect(counts()[0]).toBe('2')
    expect(header().closest('th').getAttribute('aria-sort')).toBe('descending')

    header().click()
    expect(document.querySelector('.metrics-table tbody tr').children[2].textContent).toBe(naturalFirst)
    expect(header().closest('th').getAttribute('aria-sort')).toBe('none')
  })

  test('merged time counts overlapping behaviors of a category once and needs category sums', async () => {
    const store = await setup()
    await store.commit([...store.getAll(), interval('d2', 15, 35)])
    const totalRow = () => metricRow('Próba 1', 'Σ Ratowanie')

    expect(totalRow().slice(5, 7)).toEqual(['3', '40.000'])
    const merge = document.querySelector('[data-toggle="merge"]')
    expect(merge.disabled).toBe(false)
    merge.checked = true
    merge.dispatchEvent(new Event('change', { bubbles: true }))
    expect(totalRow().slice(5, 7)).toEqual(['1', '30.000'])

    const categories = document.querySelector('[data-toggle="categories"]')
    categories.checked = false
    categories.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('[data-toggle="merge"]').disabled).toBe(true)
  })

  test('disables the category options when no animal has a category with two behaviors', async () => {
    await setup()
    presets[0].activities.forEach((activity) => { activity.category = 'Bez kategorii' })
    window.dispatchEvent(new CustomEvent('active-trial-changed'))
    expect(document.querySelector('[data-toggle="categories"]').disabled).toBe(true)
    expect(document.querySelector('[data-toggle="categories"]').closest('label').title).toMatch(/Teraz żadne zwierzę/)
    expect(document.querySelector('[data-toggle="merge"]').disabled).toBe(true)
    presets[0].activities.filter((activity) => activity.id !== 'contact').forEach((activity) => { activity.category = 'Ratowanie' })
  })

  test('shows which window is used and how many events it keeps', async () => {
    await setup()
    const windowCells = (trialId) => Array.from(document.querySelectorAll(`[data-trial-id="${trialId}"] td`)).map((cell) => cell.textContent.trim())
    expect(windowCells('t1').slice(4, 6)).toEqual(['0.000 – 300.000', '2 / 2'])

    change(document.querySelector('[data-trial-id="t1"] [data-window="windowEnd"]'), '25')
    await flush()
    expect(windowCells('t1').slice(4, 6)).toEqual(['0.000 – 25.000', '1 / 2'])
    expect(document.querySelector('[data-trial-id="t1"] .data-window-trimmed')).not.toBeNull()
    expect(metricRow('Próba 1', 'Ciągnięcie').slice(3, 6)).toEqual(['nie', '—', '0'])
    expect(metricRow('Próba 1', 'Kopanie')[7]).toBe('40.0')
  })

  test('exports the workbook through the main process and reports the result', async () => {
    window.electronAPI = { exportWorkbook: jest.fn().mockResolvedValue({ saved: true, filePath: 'C:/out/Study_metryki.xlsx' }) }
    await setup('Study')
    const button = document.querySelector('[data-action="export-xlsx"]')
    expect(button.disabled).toBe(false)
    expect(button.title).toMatch(/niezależnie od filtrów/)

    change(document.querySelector('[data-filter="trialId"]'), 't2')
    document.querySelector('[data-action="export-xlsx"]').click()
    await flush()

    const request = window.electronAPI.exportWorkbook.mock.calls[0][0]
    expect(request.suggestedName).toMatch(/^Study_metryki_\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(request.sheets.map((sheet) => sheet.name)).toEqual(['Metryki', 'Metryki (długi format)', 'Zdarzenia', 'Okna prób', 'Informacje'])
    expect(request.sheets[0].rows).toHaveLength(2)
    expect(document.querySelector('[data-data-message]').textContent).toBe('Zapisano: C:/out/Study_metryki.xlsx')

    window.electronAPI.exportWorkbook.mockResolvedValue({ saved: false })
    document.querySelector('[data-action="export-xlsx"]').click()
    await flush()
    expect(document.querySelector('[data-data-message]').textContent).toBe('Eksport anulowany.')

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    window.electronAPI.exportWorkbook.mockRejectedValue(new Error('disk full'))
    document.querySelector('[data-action="export-xlsx"]').click()
    await flush()
    expect(document.querySelector('[data-data-message]').textContent).toMatch(/Nie udało się zapisać/)
    errors.mockRestore()
  })

  test('disables the export button when the app cannot save files', async () => {
    delete window.electronAPI
    await setup()
    expect(document.querySelector('[data-action="export-xlsx"]').disabled).toBe(true)
  })

  test('saves an analysis window and rejects impossible ones', async () => {
    await setup()
    const windowInput = (trialId, field) => document.querySelector(`[data-trial-id="${trialId}"] [data-window="${field}"]`)

    change(windowInput('t1', 'windowEnd'), '1:00')
    await flush()
    expect(trialCatalog.updateTrial).toHaveBeenCalledWith('t1', { windowStart: null, windowEnd: 60 })
    expect(windowInput('t1', 'windowEnd').value).toBe('60.000')
    expect(metricRow('Próba 1', 'Kopanie')[7]).toBe('16.7')

    change(windowInput('t1', 'windowStart'), '70')
    await flush()
    expect(document.querySelector('[data-data-message]').textContent).toMatch(/późniejszy/)
    expect(trialCatalog.updateTrial).toHaveBeenCalledTimes(1)

    change(windowInput('t1', 'windowStart'), 'abc')
    await flush()
    expect(document.querySelector('[data-data-message]').textContent).toMatch(/poprawny/)

    change(windowInput('t1', 'windowEnd'), '')
    await flush()
    expect(trialCatalog.updateTrial).toHaveBeenLastCalledWith('t1', { windowStart: null, windowEnd: null })
  })
})

describe('Data tabs', () => {
  test('shows one panel at a time and announces the change', () => {
    document.body.innerHTML = `
      <nav><button data-data-tab="events" class="active"></button><button data-data-tab="metrics"></button></nav>
      <div data-data-panel="events"></div><div data-data-panel="metrics" hidden></div>
    `
    const changed = jest.fn()
    window.addEventListener('data-tab-changed', changed)
    initDataTabs()

    document.querySelector('[data-data-tab="metrics"]').click()
    expect(document.querySelector('[data-data-panel="events"]').hidden).toBe(true)
    expect(document.querySelector('[data-data-panel="metrics"]').hidden).toBe(false)
    expect(document.querySelector('[data-data-tab="metrics"]').classList.contains('active')).toBe(true)
    expect(document.querySelector('[data-data-tab="events"]').classList.contains('active')).toBe(false)
    expect(changed.mock.calls.at(-1)[0].detail.tab).toBe('metrics')
    window.removeEventListener('data-tab-changed', changed)
  })
})

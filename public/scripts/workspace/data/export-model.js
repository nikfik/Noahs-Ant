import { buildEventRows } from './event-table-model.js'
import { buildMetricRows, hasCategoryGroups, summarizeTrialWindow } from './metrics-model.js'

const METRICS = [
  { label: 'wystąpiła (1/0)', format: '0', get: (row) => row.present ? 1 : 0 },
  { label: 'latencja (s)', format: '0.000', get: (row) => row.latency },
  { label: 'liczba', format: '0', get: (row) => row.count },
  { label: 'czas łączny (s)', format: '0.000', get: (row) => row.continuous ? row.duration : null },
  { label: '% okna', format: '0.0', get: (row) => row.continuous ? row.percentOfWindow : null },
  { label: '% po latencji', format: '0.0', get: (row) => row.continuous ? row.percentAfterLatency : null }
]

const columnKey = (row) => `${row.animalId}|${row.kind}|${row.activityId ?? row.category}`

// One row per trial, like the spreadsheet the lab used: every behavior of every animal gets its own group of columns.
function buildWideSheet(metricRows, trials) {
  const columns = []
  const seen = new Set()
  metricRows.forEach((row) => {
    const key = columnKey(row)
    if (!seen.has(key)) {
      seen.add(key)
      columns.push({ key, animalName: row.animalName, name: row.name })
    }
  })

  const byTrial = new Map()
  metricRows.forEach((row) => {
    if (!byTrial.has(row.trialId)) byTrial.set(row.trialId, new Map())
    byTrial.get(row.trialId).set(columnKey(row), row)
  })

  const headers = ['Próba', 'Okno od (s)', 'Okno do (s)']
  const formats = { 1: '0.000', 2: '0.000' }
  columns.forEach((column, columnIndex) => {
    METRICS.forEach((metric, metricIndex) => {
      const index = 3 + columnIndex * METRICS.length + metricIndex
      headers.push(`${column.animalName} – ${column.name}: ${metric.label}`)
      formats[index] = metric.format
    })
  })

  const rows = trials.map((trial) => {
    const trialRows = byTrial.get(trial.id) || new Map()
    const window = [...trialRows.values()][0]?.window
    return [
      trial.name,
      window?.start ?? null,
      window?.end ?? null,
      ...columns.flatMap((column) => {
        const row = trialRows.get(column.key)
        return METRICS.map((metric) => row ? metric.get(row) : null)
      })
    ]
  })

  return { name: 'Metryki', headers, rows, formats }
}

function buildLongSheet(metricRows) {
  return {
    name: 'Metryki (długi format)',
    headers: ['Próba', 'Zwierzę', 'Czynność', 'Poziom', ...METRICS.map((metric) => metric.label[0].toUpperCase() + metric.label.slice(1)), 'Okno od (s)', 'Okno do (s)'],
    rows: metricRows.map((row) => [
      row.trialName,
      row.animalName,
      row.name,
      row.kind === 'category' ? 'suma kategorii' : 'czynność',
      ...METRICS.map((metric) => metric.get(row)),
      row.window.start,
      row.window.end
    ]),
    formats: { 4: '0', 5: '0.000', 6: '0', 7: '0.000', 8: '0.0', 9: '0.0', 10: '0.000', 11: '0.000' }
  }
}

function buildEventsSheet(observations, trials, animals) {
  return {
    name: 'Zdarzenia',
    headers: ['Próba', 'Zwierzę', 'Czynność', 'Typ', 'Start (s)', 'Koniec (s)', 'Czas (s)'],
    rows: buildEventRows(observations, { trials, animals }).map((row) => [
      row.trialName,
      row.animalName,
      row.activityName,
      row.kind === 'interval' ? 'ciągła' : 'punktowa',
      row.start,
      row.kind === 'interval' ? row.end : null,
      row.duration
    ]),
    formats: { 4: '0.000', 5: '0.000', 6: '0.000' }
  }
}

function buildWindowsSheet(observations, trials) {
  return {
    name: 'Okna prób',
    headers: ['Próba', 'Długość wideo (s)', 'Okno od – ustawione (s)', 'Okno do – ustawione (s)', 'Użyte okno od (s)', 'Użyte okno do (s)', 'Zdarzenia w oknie', 'Zdarzenia razem'],
    rows: trials.map((trial) => {
      const { window, total, inside } = summarizeTrialWindow(observations, trial)
      return [trial.name, trial.duration, trial.windowStart, trial.windowEnd, window.start, window.end, inside, total]
    }),
    formats: { 1: '0.000', 2: '0.000', 3: '0.000', 4: '0.000', 5: '0.000' }
  }
}

function buildInfoSheet({ includeCategories, mergeCategories, hasCategories, exportedAt }) {
  const categoriesOn = includeCategories && hasCategories
  return {
    name: 'Informacje',
    headers: ['Parametr', 'Opis'],
    rows: [
      ['Wyeksportowano', exportedAt.toLocaleString('pl-PL')],
      ['Sumy kategorii (Σ)', categoriesOn ? 'tak – wiersze „Σ” sumują czynności z jednej kategorii' : 'nie'],
      ['Czas scalony', categoriesOn && mergeCategories ? 'tak – nakładające się czynności w sumie kategorii liczone raz (czas = suma scalonych odcinków, liczba = liczba epizodów)' : 'nie – zwykła suma, nakładający się czas liczony podwójnie'],
      ['Okno analizy', 'Fragment nagrania, dla którego liczone są metryki (domyślnie całe wideo). Zdarzenia poza oknem są pomijane, a te na jego granicy – przycinane. Trwające zdarzenie kończy się wraz z oknem.'],
      ['Wystąpiła (1/0)', '1, jeśli czynność wystąpiła choć raz w oknie analizy'],
      ['Latencja (s)', 'Czas od początku okna do pierwszego wystąpienia czynności; puste, gdy czynność nie wystąpiła'],
      ['Liczba', 'Ile razy czynność wystąpiła w oknie analizy'],
      ['Czas łączny (s)', 'Łączny czas trwania czynności w oknie; zdarzenia punktowe nie mają czasu (puste pole)'],
      ['% okna', 'Czas łączny / długość okna × 100'],
      ['% po latencji', 'Czas łączny / (długość okna − latencja) × 100'],
      ['Puste pola', 'Wartość nie istnieje (np. latencja czynności, która nie wystąpiła) albo nie dotyczy (czas zdarzenia punktowego)']
    ]
  }
}

export function buildExportSheets({ observations = [], trials = [], animals = [], presets = [], includeCategories = true, mergeCategories = false, exportedAt = new Date() } = {}) {
  const metricRows = buildMetricRows(observations, { trials, animals, presets, includeCategories, mergeCategories })

  return [
    buildWideSheet(metricRows, trials),
    buildLongSheet(metricRows),
    buildEventsSheet(observations, trials, animals),
    buildWindowsSheet(observations, trials),
    buildInfoSheet({ includeCategories, mergeCategories, hasCategories: hasCategoryGroups(animals, presets), exportedAt })
  ]
}

export function suggestExportName(projectName, date = new Date()) {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  return `${projectName || 'projekt'}_metryki_${day}.xlsx`
}

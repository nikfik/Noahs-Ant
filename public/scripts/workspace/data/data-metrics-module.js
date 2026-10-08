import { escapeHtml } from '../../shared/escape-html.js'
import { formatSeconds, parseTimeInput } from './event-table-model.js'
import { buildMetricRows, hasCategoryGroups, summarizeTrialWindow } from './metrics-model.js'
import { ariaSort, nextSort, sortMark, sortRows } from './sort-utils.js'
import { buildExportSheets, suggestExportName } from './export-model.js'

const PREFERENCES_KEY = 'noahs-ant.metrics'
const SECONDS = (value) => value === null ? '—' : formatSeconds(value)
const PERCENT = (value) => value === null ? '—' : value.toFixed(1)

const COLUMNS = [
  { key: 'trial', label: 'Próba', tip: 'Próba (nagranie), do której należy wiersz.', get: (row) => row.trialName },
  { key: 'animal', label: 'Zwierzę', tip: 'Zwierzę, któremu przypisano czynność.', get: (row) => row.animalName },
  { key: 'behavior', label: 'Czynność', tip: 'Czynność z etogramu. Wiersz zaczynający się od „Σ” to suma kategorii.', get: (row) => row.name },
  { key: 'present', label: 'Wystąpiła', tip: 'Czy czynność wystąpiła choć raz w oknie analizy.', get: (row) => row.present ? 1 : 0 },
  { key: 'latency', label: 'Latencja (s)', tip: 'Czas od początku okna analizy do pierwszego wystąpienia czynności. Puste, gdy czynność nie wystąpiła.', get: (row) => row.latency },
  { key: 'count', label: 'Liczba', tip: 'Ile razy czynność wystąpiła w oknie analizy. W sumie kategorii przy włączonym „Czasie scalonym” liczone są oddzielne epizody.', get: (row) => row.count },
  { key: 'duration', label: 'Czas łączny (s)', tip: 'Łączny czas trwania czynności w oknie analizy. Zdarzenia punktowe nie mają czasu.', get: (row) => row.continuous ? row.duration : null },
  { key: 'percentOfWindow', label: '% okna', tip: 'Czas łączny podzielony przez długość okna analizy, razy 100.', get: (row) => row.continuous ? row.percentOfWindow : null },
  { key: 'percentAfterLatency', label: '% po latencji', tip: 'Czas łączny podzielony przez (długość okna − latencja), razy 100 — wzór z arkusza.', get: (row) => row.continuous ? row.percentAfterLatency : null }
]
const SORT_GETTERS = Object.fromEntries(COLUMNS.map((column) => [column.key, column.get]))

const TIPS = {
  categories: 'Dodaje wiersze „Σ” sumujące czynności z tej samej kategorii (kategorie ustawia się w edytorze etogramu; potrzebne co najmniej dwie czynności zwierzęcia w jednej kategorii).',
  merge: 'Dotyczy wierszy „Σ”. Włączone: czynności nakładające się na siebie liczą się raz — czas to suma scalonych odcinków, a liczba to liczba oddzielnych epizodów. Wyłączone: zwykła suma wszystkich czynności, nakładający się czas liczy się podwójnie (jak w arkuszu).',
  colors: 'Koloruje komórki „tak” i „nie” w kolumnie „Wystąpiła”.',
  export: 'Zapisuje plik Excela (.xlsx) z metrykami wszystkich prób i zwierząt (niezależnie od filtrów), z bieżącymi ustawieniami sum kategorii i czasu scalonego. Arkusze: Metryki (jeden wiersz na próbę), Metryki w długim formacie, Zdarzenia, Okna prób i Informacje.',
  window: 'Wybierz fragment nagrania, dla którego liczone są metryki, np. tylko pierwsze 5 minut godzinnego filmu. Zdarzenia poza oknem są pomijane, a procenty liczone względem długości okna. Puste pole = początek / koniec wideo.',
  windowStart: 'Początek analizowanego fragmentu w sekundach (lub m:ss). Puste = początek wideo.',
  windowEnd: 'Koniec analizowanego fragmentu w sekundach (lub m:ss). Puste = koniec wideo.',
  duration: 'Długość wideo tej próby. Zapisuje się automatycznie po otwarciu filmu w widoku Wideo.',
  used: 'Fragment, dla którego faktycznie liczone są metryki tej próby.',
  inside: 'Ile zdarzeń tej próby mieści się (choćby częściowo) w oknie analizy. Pozostałe są pomijane.'
}

function loadPreferences() {
  try {
    return { includeCategories: true, mergeCategories: false, colorize: true, ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}') }
  } catch (_error) {
    return { includeCategories: true, mergeCategories: false, colorize: true }
  }
}

function savePreferences(preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch (_error) {
    // Preferences are a convenience; the screen works without them.
  }
}

export function createDataMetricsModule() {
  let host = null
  let store = null
  let animalCatalog = null
  let trialCatalog = null
  let filters = { trialId: 'all', animalId: 'all' }
  let preferences = loadPreferences()
  let sort = null
  let message = ''
  let projectName = ''

  const trials = () => trialCatalog?.getData?.().trials || []
  const animals = () => animalCatalog?.getData?.().animals || []
  const presets = () => animalCatalog?.getPresets?.() || []

  const isVisible = () => Boolean(host) && !host.closest('[hidden]')

  function options(items, selectedId) {
    return items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')
  }

  const headerCell = ({ key, label, tip }) => `
    <th aria-sort="${ariaSort(sort, key)}" title="${escapeHtml(tip)}">
      <button type="button" class="data-sort" data-sort="${key}">${escapeHtml(label)} <span class="sort-mark">${sortMark(sort, key)}</span></button>
    </th>`

  function renderMetricRow(row) {
    const flagClass = preferences.colorize ? (row.present ? ' metric-yes' : ' metric-no') : ''
    return `
      <tr class="${row.kind === 'category' ? 'metric-category' : ''}">
        <td>${escapeHtml(row.trialName)}</td>
        <td>${escapeHtml(row.animalName)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td class="metric-flag${flagClass}">${row.present ? 'tak' : 'nie'}</td>
        <td class="num">${SECONDS(row.latency)}</td>
        <td class="num">${row.count}</td>
        <td class="num">${row.continuous ? SECONDS(row.duration) : '—'}</td>
        <td class="num">${row.continuous ? PERCENT(row.percentOfWindow) : '—'}</td>
        <td class="num">${row.continuous ? PERCENT(row.percentAfterLatency) : '—'}</td>
      </tr>`
  }

  function renderWindowRow(trial) {
    const { window, total, inside } = summarizeTrialWindow(store.getAll(), trial)
    const fromEvents = window.source === 'events'
    return `
      <tr data-trial-id="${escapeHtml(trial.id)}">
        <td>${escapeHtml(trial.name)}</td>
        <td class="num">${trial.duration ? formatSeconds(trial.duration) : '—'}</td>
        <td><input data-window="windowStart" value="${trial.windowStart === null ? '' : formatSeconds(trial.windowStart)}" placeholder="0" inputmode="decimal" aria-label="Okno od (s)" title="${escapeHtml(TIPS.windowStart)}" /></td>
        <td><input data-window="windowEnd" value="${trial.windowEnd === null ? '' : formatSeconds(trial.windowEnd)}" placeholder="${trial.duration ? formatSeconds(trial.duration) : 'koniec wideo'}" inputmode="decimal" aria-label="Okno do (s)" title="${escapeHtml(TIPS.windowEnd)}" /></td>
        <td class="num">${formatSeconds(window.start)} – ${formatSeconds(window.end)}</td>
        <td class="num ${inside < total ? 'data-window-trimmed' : ''}">${inside} / ${total}</td>
        <td class="data-window-note">${fromEvents ? 'brak długości wideo — okno z ostatniego zdarzenia (otwórz film tej próby)' : ''}</td>
      </tr>`
  }

  function render() {
    if (!host || !store) return
    const hasCategories = hasCategoryGroups(animals(), presets())
    const categoriesOn = preferences.includeCategories && hasCategories
    const rows = sortRows(buildMetricRows(store.getAll(), {
      trials: trials(),
      animals: animals(),
      presets: presets(),
      trialFilter: filters.trialId,
      animalFilter: filters.animalId,
      includeCategories: preferences.includeCategories,
      mergeCategories: preferences.mergeCategories
    }), sort, SORT_GETTERS)

    host.innerHTML = `
      <section class="data-panel">
        <header class="data-header">
          <div class="data-title"><h2>Metryki</h2><span class="data-count">${rows.length}</span></div>
          <div class="data-controls">
            <label>Próba <select data-filter="trialId"><option value="all">Wszystkie</option>${options(trials(), filters.trialId)}</select></label>
            <label>Zwierzę <select data-filter="animalId"><option value="all">Wszystkie</option>${options(animals(), filters.animalId)}</select></label>
            <label title="${escapeHtml(hasCategories ? TIPS.categories : `${TIPS.categories} Teraz żadne zwierzę nie ma takich kategorii.`)}"><input type="checkbox" data-toggle="categories" ${preferences.includeCategories ? 'checked' : ''} ${hasCategories ? '' : 'disabled'} /> Sumy kategorii (Σ)</label>
            <label title="${escapeHtml(TIPS.merge)}"><input type="checkbox" data-toggle="merge" ${preferences.mergeCategories ? 'checked' : ''} ${categoriesOn ? '' : 'disabled'} /> Czas scalony</label>
            <label title="${escapeHtml(TIPS.colors)}"><input type="checkbox" data-toggle="colors" ${preferences.colorize ? 'checked' : ''} /> Kolory tak/nie</label>
            <button type="button" class="data-export" data-action="export-xlsx" title="${escapeHtml(TIPS.export)}" ${window.electronAPI?.exportWorkbook ? '' : 'disabled'}>Eksportuj do Excela</button>
          </div>
        </header>
        <div class="data-table-wrap">
          <table class="data-table metrics-table">
            <thead><tr>${COLUMNS.map(headerCell).join('')}</tr></thead>
            <tbody>${rows.map(renderMetricRow).join('')}</tbody>
          </table>
          ${rows.length ? '' : '<p class="data-empty">Brak danych. Dodaj zwierzęta z etogramem oraz próby, aby zobaczyć metryki.</p>'}
        </div>
        <details class="data-window" open>
          <summary title="${escapeHtml(TIPS.window)}">Okno analizy prób</summary>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Próba</th>
                <th title="${escapeHtml(TIPS.duration)}">Długość wideo (s)</th>
                <th title="${escapeHtml(TIPS.windowStart)}">Okno od (s)</th>
                <th title="${escapeHtml(TIPS.windowEnd)}">Okno do (s)</th>
                <th title="${escapeHtml(TIPS.used)}">Użyte okno (s)</th>
                <th title="${escapeHtml(TIPS.inside)}">Zdarzenia w oknie</th>
                <th></th>
              </tr></thead>
              <tbody>${trials().map(renderWindowRow).join('')}</tbody>
            </table>
          </div>
        </details>
        <footer class="data-status"><span data-data-message role="status">${escapeHtml(message)}</span></footer>
      </section>`
  }

  function refresh() {
    if (isVisible()) render()
  }

  async function handleWindowEdit(input) {
    const trialId = input.closest('[data-trial-id]')?.dataset.trialId
    const trial = trials().find((item) => item.id === trialId)
    if (!trial) return

    const parsed = parseTimeInput(input.value)
    const next = { windowStart: trial.windowStart, windowEnd: trial.windowEnd, [input.dataset.window]: parsed }
    if (Number.isNaN(parsed) || (parsed !== null && parsed < 0)) {
      message = 'Podaj poprawny czas, np. 12.5 lub 1:02.5 (puste = domyślnie).'
    } else if (next.windowEnd !== null && next.windowEnd <= (next.windowStart ?? 0)) {
      message = 'Koniec okna musi być późniejszy niż jego początek.'
    } else {
      message = ''
      await trialCatalog.updateTrial(trialId, next)
      return
    }
    render()
  }

  function showMessage(text) {
    message = text
    const node = host.querySelector('[data-data-message]')
    if (node) node.textContent = text
  }

  async function exportWorkbook() {
    showMessage('Eksportowanie…')
    try {
      const sheets = buildExportSheets({
        observations: store.getAll(),
        trials: trials(),
        animals: animals(),
        presets: presets(),
        includeCategories: preferences.includeCategories,
        mergeCategories: preferences.mergeCategories
      })
      const result = await window.electronAPI.exportWorkbook({ suggestedName: suggestExportName(projectName), sheets })
      showMessage(result?.saved ? `Zapisano: ${result.filePath}` : 'Eksport anulowany.')
    } catch (error) {
      console.error('Workbook export failed:', error)
      showMessage('Nie udało się zapisać pliku Excela.')
    }
  }

  function bindEvents() {
    host.addEventListener('change', (event) => {
      const target = event.target
      if (target.dataset.filter) {
        filters = { ...filters, [target.dataset.filter]: target.value }
        message = ''
        render()
      } else if (target.dataset.toggle) {
        const key = { categories: 'includeCategories', merge: 'mergeCategories', colors: 'colorize' }[target.dataset.toggle]
        preferences = { ...preferences, [key]: target.checked }
        savePreferences(preferences)
        render()
      } else if (target.dataset.window) {
        handleWindowEdit(target).catch((error) => console.error('Failed to update analysis window:', error))
      }
    })

    host.addEventListener('click', (event) => {
      const header = event.target.closest('[data-sort]')
      if (header) {
        sort = nextSort(sort, header.dataset.sort)
        render()
        return
      }

      const action = event.target.closest('[data-action]')
      if (action?.dataset.action === 'export-xlsx' && !action.disabled) exportWorkbook()
    })

    host.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('input[data-window]')) event.target.blur()
    })
  }

  function init(containerId = 'data-metrics-module', dependencies = {}) {
    host = document.getElementById(containerId)
    store = dependencies.observationStore || null
    animalCatalog = dependencies.animalCatalog || null
    trialCatalog = dependencies.trialCatalog || null
    projectName = dependencies.projectName || ''
    if (!host || !store) return null

    preferences = loadPreferences()
    bindEvents()
    store.subscribe(({ reason }) => {
      if (reason !== 'preview') refresh()
    })
    window.addEventListener('active-animal-changed', refresh)
    window.addEventListener('active-trial-changed', refresh)
    window.addEventListener('workspace-view-changed', refresh)
    window.addEventListener('data-tab-changed', refresh)
    render()
    return { render }
  }

  return { init }
}

export const DataMetricsModule = createDataMetricsModule()

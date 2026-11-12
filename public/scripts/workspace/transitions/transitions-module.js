// The transitions screen: how likely one behavior is to follow another, drawn as a diagram and shown as a table.
import { plural, t } from '../../shared/i18n.js'
import { escapeHtml } from '../../shared/escape-html.js'
import { exportSvg } from '../charts/export-image.js'
import { TRANSITION_MODES, buildTransitions, transitionMatrix } from './transition-model.js'
import { renderTransitionSvg } from './transition-svg.js'

const STORAGE_PREFIX = 'noahs-ant.transitions.'
const DEFAULT_CONFIG = {
  mode: 'sequence',
  animalFilter: 'all',
  excludedTrials: [],
  excludedBehaviors: [],
  includePoints: true,
  includeStart: false,
  showProbabilities: true,
  showCounts: false,
  showLatency: false,
  minProbability: 0
}

export function createTransitionsModule() {
  let host = null
  let store = null
  let animalCatalog = null
  let trialCatalog = null
  let projectName = ''
  let config = { ...DEFAULT_CONFIG }
  let lastSvg = ''

  const trials = () => trialCatalog?.getData?.().trials || []
  const animals = () => animalCatalog?.getData?.().animals || []
  const groups = () => animalCatalog?.getData?.().groups || []
  const presets = () => animalCatalog?.getPresets?.() || []
  const isVisible = () => Boolean(host) && !host.closest('[hidden]')

  function load() {
    try {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${projectName}`) || '{}') }
    } catch (_error) {
      config = { ...DEFAULT_CONFIG }
    }
  }

  function save() {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${projectName}`, JSON.stringify(config))
    } catch (_error) {
      // The settings are then simply the defaults next time.
    }
  }

  function behaviorNames() {
    const names = new Set(store.getAll().map((item) => item.activityName))
    presets().forEach((preset) => (preset.activities || []).forEach((activity) => activity.name && names.add(activity.name)))
    return [...names].sort((left, right) => left.localeCompare(right))
  }

  function compute() {
    const included = new Set(trials().filter((trial) => !config.excludedTrials.includes(trial.id)).map((trial) => trial.id))
    const behaviors = new Set(behaviorNames().filter((name) => !config.excludedBehaviors.includes(name)))
    return buildTransitions(
      { observations: store.getAll(), trials: trials(), animals: animals(), groups: groups() },
      { mode: config.mode, animalFilter: config.animalFilter, trialIds: included, behaviors, includePoints: config.includePoints, includeStart: config.includeStart }
    )
  }

  const check = (name, value, label, extra = '') => `<label class="transitions-check"><input type="checkbox" data-${name}="${escapeHtml(value)}" ${extra}> ${escapeHtml(label)}</label>`

  function matrixTable(result) {
    const matrix = transitionMatrix(result)
    if (!matrix.rows.length) return `<p class="charts-muted">${t('Brak przejść do pokazania.')}</p>`
    return `<div class="charts-table-wrap"><table class="data-table transitions-matrix">
      <thead><tr><th>${t('Z \\ do')}</th>${matrix.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>${matrix.rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th>${row.cells.map((cell) => `<td class="num">${cell ? `${cell.probability.toFixed(3)} <span class="charts-muted">(${cell.count}×)</span>` : ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`
  }

  function render() {
    if (!host || !store) return
    const result = compute()
    const hasEdges = result.edges.some((edge) => edge.probability >= config.minProbability)
    lastSvg = hasEdges ? renderTransitionSvg(result, config) : ''
    const mode = TRANSITION_MODES.find((item) => item.id === config.mode) || TRANSITION_MODES[0]

    host.innerHTML = `
      <section class="charts-screen transitions-screen">
        <aside class="charts-sidebar">
          <h3>${t('Przejścia między czynnościami')}</h3>
          <label class="transitions-field">${t('Sposób liczenia')}
            <select data-mode>${TRANSITION_MODES.map((item) => `<option value="${item.id}" ${item.id === config.mode ? 'selected' : ''}>${t(item.label)}</option>`).join('')}</select>
          </label>
          <p class="charts-muted">${escapeHtml(t(mode.hint))}</p>
          <label class="transitions-field">${t('Zwierzęta')}
            <select data-animals>
              <option value="all" ${config.animalFilter === 'all' ? 'selected' : ''}>${t('Wszystkie')}</option>
              ${groups().map((group) => `<option value="group:${escapeHtml(group.id)}" ${config.animalFilter === `group:${group.id}` ? 'selected' : ''}>Grupa: ${escapeHtml(group.name)}</option>`).join('')}
              ${animals().map((animal) => `<option value="animal:${escapeHtml(animal.id)}" ${config.animalFilter === `animal:${animal.id}` ? 'selected' : ''}>${escapeHtml(animal.name)}</option>`).join('')}
            </select>
          </label>
          <h4>${t('Próby')} <button type="button" class="transitions-link" data-all-trials>${t('wszystkie')}</button></h4>
          <div class="transitions-list">${trials().map((trial) => check('trial', trial.id, trial.name, config.excludedTrials.includes(trial.id) ? '' : 'checked')).join('')}</div>
          <h4>${t('Czynności')} <button type="button" class="transitions-link" data-all-behaviors>${t('wszystkie')}</button></h4>
          <div class="transitions-list">${behaviorNames().map((name) => check('behavior', name, name, config.excludedBehaviors.includes(name) ? '' : 'checked')).join('') || `<span class="charts-muted">${t('Brak zdarzeń.')}</span>`}</div>
          <h4>${t('Wygląd')}</h4>
          ${check('opt', 'showProbabilities', t('Prawdopodobieństwa na strzałkach'), config.showProbabilities ? 'checked' : '')}
          ${check('opt', 'showCounts', t('Liczba przejść (n×)'), config.showCounts ? 'checked' : '')}
          ${check('opt', 'includeStart', t('Węzeł START (pierwsza czynność w próbie)'), config.includeStart ? 'checked' : '')}
          ${check('opt', 'showLatency', t('Średnia latencja przy strzałkach ze START'), `${config.showLatency ? 'checked' : ''} ${config.includeStart ? '' : 'disabled'}`)}
          ${check('opt', 'includePoints', t('Zdarzenia punktowe'), `${config.includePoints ? 'checked' : ''} ${config.mode === 'parallel' ? 'disabled' : ''}`)}
          <label class="transitions-field">${t('Ukryj rzadsze niż')} <output>${config.minProbability.toFixed(2)}</output>
            <input type="range" min="0" max="0.5" step="0.01" value="${config.minProbability}" data-min />
          </label>
        </aside>
        <div class="charts-main">
          <div class="charts-options">
            <span>${result.units} ${plural(result.units, ['zwierzę w próbie', 'zwierzęta w próbach', 'zwierząt w próbach'])} · ${result.totalTransitions} ${plural(result.totalTransitions, ['przejście', 'przejścia', 'przejść'])}</span>
            <span class="charts-export">
              <button type="button" data-export="png" ${hasEdges ? '' : 'disabled'}>${t('Zapisz PNG')}</button>
              <button type="button" data-export="svg" ${hasEdges ? '' : 'disabled'}>${t('Zapisz SVG')}</button>
            </span>
          </div>
          <div class="charts-canvas ${hasEdges ? '' : 'empty'} transitions-canvas">
            ${hasEdges ? lastSvg : `<p>${t('Brak przejść. Oznacz co najmniej dwa zdarzenia tego samego zwierzęcia w jednej próbie albo zmień filtry.')}</p>`}
          </div>
          <details class="charts-preview" open>
            <summary>${t('Tabela przejść')}</summary>
            ${matrixTable(result)}
            <p class="charts-muted">${t('Prawdopodobieństwo to liczba przejść z danego stanu do kolejnego podzielona przez wszystkie przejścia wychodzące z tego stanu (wiersze sumują się do 1). Przejścia nie łączą różnych prób ani zwierząt.')}</p>
          </details>
        </div>
      </section>`
  }

  function refresh() {
    if (isVisible()) render()
  }

  function bindEvents() {
    host.addEventListener('change', (event) => {
      const target = event.target
      if (target.matches('[data-mode]')) config.mode = target.value
      else if (target.matches('[data-animals]')) config.animalFilter = target.value
      else if (target.dataset.trial !== undefined) {
        const id = target.dataset.trial
        config.excludedTrials = target.checked ? config.excludedTrials.filter((item) => item !== id) : [...new Set([...config.excludedTrials, id])]
      } else if (target.dataset.behavior !== undefined) {
        const name = target.dataset.behavior
        config.excludedBehaviors = target.checked ? config.excludedBehaviors.filter((item) => item !== name) : [...new Set([...config.excludedBehaviors, name])]
      } else if (target.dataset.opt !== undefined) config[target.dataset.opt] = target.checked
      else return
      save()
      render()
    })

    host.addEventListener('input', (event) => {
      if (!event.target.matches('[data-min]')) return
      config.minProbability = Number(event.target.value)
      save()
      render()
      host.querySelector('[data-min]')?.focus()
    })

    host.addEventListener('click', (event) => {
      const exportButton = event.target.closest('[data-export]')
      if (exportButton) {
        if (!exportButton.disabled) exportSvg(lastSvg, `${projectName || 'projekt'}_przejscia`, exportButton.dataset.export)
        return
      }
      if (event.target.closest('[data-all-trials]')) config.excludedTrials = []
      else if (event.target.closest('[data-all-behaviors]')) config.excludedBehaviors = []
      else return
      save()
      render()
    })
  }

  function init(containerId = 'transitions-module', dependencies = {}) {
    host = document.getElementById(containerId)
    store = dependencies.observationStore || null
    animalCatalog = dependencies.animalCatalog || null
    trialCatalog = dependencies.trialCatalog || null
    projectName = dependencies.projectName || ''
    if (!host || !store) return null

    load()
    bindEvents()
    store.subscribe(({ reason }) => {
      if (reason !== 'preview') refresh()
    })
    window.addEventListener('active-animal-changed', refresh)
    window.addEventListener('active-trial-changed', refresh)
    window.addEventListener('workspace-view-changed', refresh)
    render()
    return { render }
  }

  return { init }
}

export const TransitionsModule = createTransitionsModule()

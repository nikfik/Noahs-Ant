import { escapeHtml } from '../../shared/escape-html.js'
import { applyEventEdit, buildEventRows, formatSeconds, getAnimalActivities } from './event-table-model.js'
import { ariaSort, nextSort, sortMark, sortRows } from './sort-utils.js'

const EDITABLE_FIELDS = new Set(['trialId', 'animalId', 'activityId', 'start', 'end'])

const COLUMNS = [
  { key: 'trial', label: 'Próba', tip: 'Próba (nagranie), w której zapisano zdarzenie. Można przenieść zdarzenie do innej próby.', get: (row) => row.trialName },
  { key: 'animal', label: 'Zwierzę', tip: 'Zwierzę, któremu przypisano zdarzenie.', get: (row) => row.animalName },
  { key: 'activity', label: 'Czynność', tip: 'Czynność z etogramu zwierzęcia. Można zmienić tylko na czynność tego samego typu (punktowa albo ciągła).', get: (row) => row.activityName },
  { key: 'kind', label: 'Typ', tip: 'Ciągła czynność ma początek i koniec, punktowa — tylko moment.', get: (row) => row.kind },
  { key: 'start', label: 'Start (s)', tip: 'Początek zdarzenia. Wpisz sekundy (12.5) lub m:ss (1:02.5).', get: (row) => row.start },
  { key: 'end', label: 'Koniec (s)', tip: 'Koniec zdarzenia. Puste pole oznacza zdarzenie, które jeszcze trwa.', get: (row) => row.end },
  { key: 'duration', label: 'Czas (s)', tip: 'Czas trwania: koniec minus start.', get: (row) => row.duration }
]
const SORT_GETTERS = Object.fromEntries(COLUMNS.map((column) => [column.key, column.get]))

export function createDataEventsModule() {
  let host = null
  let store = null
  let animalCatalog = null
  let trialCatalog = null
  let filters = { trialId: 'all', animalId: 'all' }
  let sort = null
  let message = ''

  const trials = () => trialCatalog?.getData?.().trials || []
  const animals = () => animalCatalog?.getData?.().animals || []
  const presets = () => animalCatalog?.getPresets?.() || []

  function activitiesFor(animalId) {
    return getAnimalActivities(animals().find((animal) => animal.id === animalId), presets())
  }

  function isVisible() {
    return Boolean(host) && !host.closest('[hidden]')
  }

  function options(items, selectedId, getLabel) {
    return items.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(getLabel(item))}</option>`).join('')
  }

  const headerCell = ({ key, label, tip }) => `
    <th aria-sort="${ariaSort(sort, key)}" title="${escapeHtml(tip)}">
      <button type="button" class="data-sort" data-sort="${key}">${escapeHtml(label)} <span class="sort-mark">${sortMark(sort, key)}</span></button>
    </th>`

  function renderRow(row) {
    const isInterval = row.kind === 'interval'
    const sameType = activitiesFor(row.animalId).filter((activity) => activity.continuous === isInterval)
    const activityChoices = sameType.some((activity) => activity.id === row.activityId)
      ? sameType
      : [...sameType, { id: row.activityId, name: row.activityName }]

    return `
      <tr data-observation-id="${escapeHtml(row.id)}" style="--event-color:${escapeHtml(row.activityColor)}">
        <td><select data-field="trialId" aria-label="Próba">${options(trials(), row.trialId, (trial) => trial.name)}</select></td>
        <td><select data-field="animalId" aria-label="Zwierzę">${options(animals(), row.animalId, (animal) => animal.name)}</select></td>
        <td class="data-activity"><select data-field="activityId" aria-label="Czynność">${options(activityChoices, row.activityId, (activity) => activity.name)}</select></td>
        <td class="data-kind">${isInterval ? 'ciągła' : 'punktowa'}</td>
        <td><input data-field="start" value="${formatSeconds(row.start)}" inputmode="decimal" aria-label="Start (s)" /></td>
        <td><input data-field="end" value="${row.end === null ? '' : formatSeconds(row.end)}" placeholder="${isInterval ? 'trwa' : '—'}" inputmode="decimal" aria-label="Koniec (s)" ${isInterval ? '' : 'disabled'} /></td>
        <td class="data-duration">${row.duration === null ? '—' : formatSeconds(row.duration)}</td>
        <td><button type="button" class="data-delete" data-action="delete-event" aria-label="Usuń zdarzenie">×</button></td>
      </tr>`
  }

  function render() {
    if (!host || !store) return
    const total = store.getAll().length
    const rows = sortRows(
      buildEventRows(store.getAll(), { trials: trials(), animals: animals(), trialFilter: filters.trialId, animalFilter: filters.animalId }),
      sort,
      SORT_GETTERS
    )

    host.innerHTML = `
      <section class="data-panel">
        <header class="data-header">
          <div class="data-title"><h2>Zdarzenia</h2><span class="data-count">${rows.length === total ? `${total}` : `${rows.length} z ${total}`}</span></div>
          <div class="data-controls">
            <label>Próba <select data-filter="trialId"><option value="all">Wszystkie</option>${options(trials(), filters.trialId, (trial) => trial.name)}</select></label>
            <label>Zwierzę <select data-filter="animalId"><option value="all">Wszystkie</option>${options(animals(), filters.animalId, (animal) => animal.name)}</select></label>
            <button type="button" data-action="undo" ${store.canUndo() ? '' : 'disabled'} title="Cofnij (Ctrl+Z)" aria-label="Cofnij">↶</button>
            <button type="button" data-action="redo" ${store.canRedo() ? '' : 'disabled'} title="Ponów (Ctrl+Y)" aria-label="Ponów">↷</button>
          </div>
        </header>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr>${COLUMNS.map(headerCell).join('')}<th></th></tr></thead>
            <tbody>${rows.map(renderRow).join('')}</tbody>
          </table>
          ${rows.length ? '' : '<p class="data-empty">Brak zdarzeń do wyświetlenia. Oznacz czynności na osi czasu w widoku Wideo.</p>'}
        </div>
        <footer class="data-status"><span data-data-message role="status">${escapeHtml(message)}</span><span>Czas wpisz w sekundach (12.5) lub jako 1:02.5 · puste „Koniec” oznacza trwające zdarzenie</span></footer>
      </section>`
  }

  function refresh() {
    if (isVisible()) render()
  }

  async function handleEdit(target) {
    const rowNode = target.closest('[data-observation-id]')
    const field = target.dataset.field
    if (!rowNode || !EDITABLE_FIELDS.has(field)) return

    const result = applyEventEdit(store.getAll(), rowNode.dataset.observationId, field, target.value, {
      animals: animals(),
      trials: trials(),
      getActivities: activitiesFor
    })
    if (result.error) {
      message = result.error
      render()
      return
    }

    message = ''
    await store.commit(result.observations)
  }

  async function handleAction(action, target) {
    if (action === 'undo') await store.undo()
    else if (action === 'redo') await store.redo()
    else if (action === 'delete-event') {
      const id = target.closest('[data-observation-id]')?.dataset.observationId
      message = ''
      await store.commit(store.getAll().filter((item) => item.id !== id))
    }
  }

  function bindEvents() {
    host.addEventListener('change', (event) => {
      const target = event.target
      if (target.dataset.filter) {
        filters = { ...filters, [target.dataset.filter]: target.value }
        message = ''
        render()
      } else if (target.dataset.field) {
        handleEdit(target).catch((error) => console.error('Failed to edit event:', error))
      }
    })

    host.addEventListener('click', (event) => {
      const header = event.target.closest('[data-sort]')
      if (header) {
        sort = nextSort(sort, header.dataset.sort)
        render()
        return
      }

      const target = event.target.closest('[data-action]')
      if (target && !target.disabled) {
        handleAction(target.dataset.action, target).catch((error) => console.error('Failed to update events:', error))
      }
    })

    host.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('input')) event.target.blur()
    })
  }

  function init(containerId = 'data-module', dependencies = {}) {
    host = document.getElementById(containerId)
    store = dependencies.observationStore || null
    animalCatalog = dependencies.animalCatalog || null
    trialCatalog = dependencies.trialCatalog || null
    if (!host || !store) return null

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

export const DataEventsModule = createDataEventsModule()

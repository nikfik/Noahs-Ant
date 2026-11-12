import { escapeHtml } from '../../shared/escape-html.js'
import { formatSeconds, parseTimeInput } from '../data/event-table-model.js'
import { t } from '../../shared/i18n.js'

const PLACEHOLDER = 'np. 12.5 lub 1:02.5'

// Asks for the exact times of one event: the moment of a point event, or the start and the end of an interval
// (an empty end means the interval is still running).
// Resolves with { type: 'save', start, end }, { type: 'delete' } or null when cancelled.
export function askEventTimes({ title = '', subtitle = '', kind = 'interval', start = 0, end = null, duration = null } = {}, { doc = document } = {}) {
  return new Promise((resolve) => {
    const isPoint = kind === 'point'
    const root = doc.createElement('div')
    root.className = 'modal skip-modal event-modal'
    root.innerHTML = `
      <form class="modal-card trial-name-dialog skip-dialog" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" novalidate>
        <h3 id="event-dialog-title">${escapeHtml(title || t('Edytuj zdarzenie'))}</h3>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        <div class="${isPoint ? '' : 'skip-dialog-times'}">
          <label>${isPoint ? t('Moment (s)') : t('Początek (s)')}<input data-event="start" value="${formatSeconds(start)}" placeholder="${t(PLACEHOLDER)}" inputmode="decimal" /></label>
          ${isPoint ? '' : `<label>${t('Koniec (s)')}<input data-event="end" value="${end === null ? '' : formatSeconds(end)}" placeholder="${t('trwa')} – ${t(PLACEHOLDER)}" inputmode="decimal" /></label>`}
        </div>
        <p class="skip-dialog-error" role="alert" hidden></p>
        <div class="modal-actions skip-dialog-actions">
          <button type="button" class="module-action danger" data-event-delete>${t('Usuń')}</button>
          <span class="skip-dialog-spacer"></span>
          <button type="button" class="module-action" data-event-cancel>${t('Anuluj')}</button>
          <button type="submit" class="module-action primary">${t('Zapisz')}</button>
        </div>
      </form>`
    doc.body.appendChild(root)

    const field = (name) => root.querySelector(`[data-event="${name}"]`)
    const error = root.querySelector('.skip-dialog-error')
    const close = (result) => {
      root.remove()
      resolve(result)
    }
    const fail = (message) => {
      error.textContent = message
      error.hidden = false
    }

    root.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault()
      const from = parseTimeInput(field('start').value)
      const to = isPoint ? from : parseTimeInput(field('end').value)
      if (from === null || Number.isNaN(from)) return fail(t('Podaj poprawny czas, np. 12.5 lub 1:02.5.'))
      if (!isPoint && Number.isNaN(to)) return fail(t('Podaj poprawny czas końca albo zostaw pole puste, gdy czynność trwa.'))
      if (!isPoint && to !== null && to < from) return fail(t('Koniec nie może być wcześniejszy niż początek.'))
      if (duration && (from > duration || (to !== null && to > duration))) return fail(t('Czas jest poza długością filmu.'))
      close({ type: 'save', start: from, end: isPoint ? from : to })
    })
    root.querySelector('[data-event-cancel]').addEventListener('click', () => close(null))
    root.querySelector('[data-event-delete]').addEventListener('click', () => close({ type: 'delete' }))
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(null)
      }
    })

    field('start').focus()
    field('start').select()
  })
}

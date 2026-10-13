import { formatSeconds, parseTimeInput } from '../data/event-table-model.js'

const PLACEHOLDER = 'np. 12.5 lub 1:02.5'

// Asks for the start, the end and the "count this time" choice of a time skip.
// Resolves with { type: 'save', start, end, countTime }, { type: 'delete' } (only when editing) or null when cancelled.
export function askSkip({ start = 0, end = 0, countTime = false, editing = false, duration = null } = {}, { doc = document } = {}) {
  return new Promise((resolve) => {
    const root = doc.createElement('div')
    root.className = 'modal skip-modal'
    root.innerHTML = `
      <form class="modal-card trial-name-dialog skip-dialog" role="dialog" aria-modal="true" aria-labelledby="skip-dialog-title" novalidate>
        <h3 id="skip-dialog-title">${editing ? 'Edytuj pominięcie' : 'Dodaj pominięcie'}</h3>
        <p>Odtwarzacz przeskoczy ten fragment filmu, np. gdy zwierzę wyszło z kadru.</p>
        <div class="skip-dialog-times">
          <label>Początek (s)<input data-skip="start" value="${formatSeconds(start)}" placeholder="${PLACEHOLDER}" inputmode="decimal" /></label>
          <label>Koniec (s)<input data-skip="end" value="${formatSeconds(end)}" placeholder="${PLACEHOLDER}" inputmode="decimal" /></label>
        </div>
        <label class="skip-dialog-count"><input type="checkbox" data-skip="count" ${countTime ? 'checked' : ''}> Wlicz ten czas do analizy</label>
        <p class="skip-dialog-hint">Niewliczony czas jest odejmowany od długości analizy, od czasów trwania czynności i od latencji. Wliczony – zostaje w metrykach bez zmian.</p>
        <p class="skip-dialog-error" role="alert" hidden></p>
        <div class="modal-actions skip-dialog-actions">
          ${editing ? '<button type="button" class="module-action danger" data-skip-delete>Usuń</button>' : ''}
          <span class="skip-dialog-spacer"></span>
          <button type="button" class="module-action" data-skip-cancel>Anuluj</button>
          <button type="submit" class="module-action primary">${editing ? 'Zapisz' : 'Dodaj'}</button>
        </div>
      </form>`
    doc.body.appendChild(root)

    const field = (name) => root.querySelector(`[data-skip="${name}"]`)
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
      const to = parseTimeInput(field('end').value)
      if (from === null || to === null || Number.isNaN(from) || Number.isNaN(to)) return fail('Podaj początek i koniec, np. 12.5 lub 1:02.5.')
      if (to <= from) return fail('Koniec musi być późniejszy niż początek.')
      if (duration && from >= duration) return fail('Początek jest poza długością filmu.')
      close({ type: 'save', start: from, end: duration ? Math.min(to, duration) : to, countTime: field('count').checked })
    })
    root.querySelector('[data-skip-cancel]').addEventListener('click', () => close(null))
    root.querySelector('[data-skip-delete]')?.addEventListener('click', () => close({ type: 'delete' }))
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

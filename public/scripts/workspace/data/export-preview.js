// A look at what the export will contain, sheet by sheet, with the rounding settings next to it.
import { escapeHtml } from '../../shared/escape-html.js'
import { ROUNDING_RULES, formatCell } from './export-model.js'

const MAX_ROWS = 300
const DECIMAL_CHOICES = [0, 1, 2, 3, 4, 5, 6]

// getSheets(rounding) builds the sheets for the given rounding ({ decimals, rule } or null).
// onChange(rounding) lets the caller remember the settings; onExport() starts the real export.
export function openExportPreview({ getSheets, rounding, onChange = () => {}, onExport = () => {}, canExport = true, doc = document }) {
  let current = { decimals: Number.isInteger(rounding?.decimals) ? rounding.decimals : null, rule: rounding?.rule || 'round' }
  let activeSheet = 0

  const root = doc.createElement('div')
  root.className = 'modal export-preview-modal'
  doc.body.appendChild(root)

  const close = () => {
    root.remove()
    doc.removeEventListener('keydown', onKey, true)
  }
  function onKey(event) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close()
  }
  doc.addEventListener('keydown', onKey, true)

  function render() {
    const sheets = getSheets(current.decimals === null ? null : { decimals: current.decimals, rule: current.rule })
    activeSheet = Math.min(activeSheet, sheets.length - 1)
    const sheet = sheets[activeSheet]
    const shown = sheet.rows.slice(0, MAX_ROWS)

    root.innerHTML = `
      <section class="export-preview" role="dialog" aria-modal="true" aria-labelledby="export-preview-title">
        <header>
          <h3 id="export-preview-title">Podgląd eksportu</h3>
          <button type="button" class="modal-close" data-close aria-label="Zamknij">×</button>
        </header>
        <div class="export-preview-controls">
          <label>Miejsca po przecinku
            <select data-decimals>
              <option value="" ${current.decimals === null ? 'selected' : ''}>Domyślnie</option>
              ${DECIMAL_CHOICES.map((count) => `<option value="${count}" ${current.decimals === count ? 'selected' : ''}>${count}</option>`).join('')}
            </select>
          </label>
          <label>Zaokrąglanie
            <select data-rule ${current.decimals === null ? 'disabled' : ''}>
              ${ROUNDING_RULES.map((rule) => `<option value="${rule.id}" ${current.rule === rule.id ? 'selected' : ''}>${escapeHtml(rule.label)}</option>`).join('')}
            </select>
          </label>
          <span class="export-preview-note">Dotyczy wartości ułamkowych: czasów, latencji i procentów. Liczby całkowite zostają bez zmian.</span>
        </div>
        <nav class="export-preview-tabs" aria-label="Arkusze">
          ${sheets.map((item, index) => `<button type="button" class="${index === activeSheet ? 'active' : ''}" data-sheet="${index}">${escapeHtml(item.name)}</button>`).join('')}
        </nav>
        <div class="export-preview-table">
          <table class="data-table">
            <thead><tr>${sheet.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
            <tbody>${shown.map((row) => `<tr>${sheet.headers.map((_header, column) => {
    const value = row[column]
    return `<td class="${typeof value === 'number' ? 'num' : ''}">${escapeHtml(formatCell(value, sheet.formats?.[column]))}</td>`
  }).join('')}</tr>`).join('')}</tbody>
          </table>
          ${sheet.rows.length ? '' : '<p class="export-preview-note">Ten arkusz jest pusty.</p>'}
        </div>
        <footer>
          <span class="export-preview-note">${sheet.rows.length > MAX_ROWS ? `Pokazano pierwsze ${MAX_ROWS} z ${sheet.rows.length} wierszy – plik zawiera wszystkie.` : `${sheet.rows.length} wierszy`}</span>
          <div>
            <button type="button" class="module-action" data-close>Zamknij</button>
            <button type="button" class="module-action primary" data-export ${canExport ? '' : 'disabled'}>Eksportuj…</button>
          </div>
        </footer>
      </section>`
  }

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-decimals]')) {
      current = { ...current, decimals: event.target.value === '' ? null : Number(event.target.value) }
    } else if (event.target.matches('[data-rule]')) {
      current = { ...current, rule: event.target.value }
    } else return
    onChange(current.decimals === null ? null : { ...current })
    render()
  })

  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-sheet]')
    if (tab) {
      activeSheet = Number(tab.dataset.sheet)
      render()
    } else if (event.target.closest('[data-close]') || event.target === root) {
      close()
    } else if (event.target.closest('[data-export]')) {
      close()
      onExport()
    }
  })

  render()
  return { close }
}

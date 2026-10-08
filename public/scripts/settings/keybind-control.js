import { keyLabel, normalizeKey } from '../shared/keys.js'
import {
  clearShortcutKey,
  cycleOperator,
  getShortcutConflictMessage,
  normalizeShortcutEntry,
  setShortcutKey
} from './shortcut-utils.js'

const OPERATOR_HINT = '„+” – oba klawisze naraz, „/” – jeden z dwóch. Kolejne kliknięcie przełącza: + → / → tylko pierwszy klawisz.'

let cancelActiveCapture = null

// The editor of one program shortcut: two key slots, the "+ / off" button between them, and a warning when a key is taken.
export function createKeybindControl({ entry, getEntries, onChange }) {
  entry.value = normalizeShortcutEntry(entry.value)

  const element = document.createElement('div')
  element.className = 'keybind-control'
  element.innerHTML = `
    <div class="keybind-line">
      <button type="button" class="option-keybind" data-slot="primary"></button>
      <button type="button" class="combo-operator" title="${OPERATOR_HINT}" aria-label="Zmień sposób łączenia klawiszy"></button>
      <button type="button" class="option-keybind combo-slot" data-slot="secondary"></button>
    </div>
    <div class="keybind-warning" role="status" hidden></div>
  `
  const primaryButton = element.querySelector('[data-slot="primary"]')
  const secondaryButton = element.querySelector('[data-slot="secondary"]')
  const operatorButton = element.querySelector('.combo-operator')
  const warning = element.querySelector('.keybind-warning')

  function render() {
    const { primary, secondary, operator } = entry.value
    primaryButton.textContent = primary ? keyLabel(primary) : '—'
    primaryButton.title = 'Kliknij, a potem naciśnij klawisz. Backspace czyści, Esc anuluje.'
    primaryButton.classList.remove('capturing')

    operatorButton.hidden = !secondary
    operatorButton.textContent = operator
    operatorButton.classList.toggle('active', Boolean(secondary))

    secondaryButton.textContent = secondary ? keyLabel(secondary) : '＋ drugi klawisz'
    secondaryButton.title = secondary ? 'Kliknij, aby zmienić drugi klawisz. Backspace usuwa go.' : 'Dodaj drugi klawisz lub kombinację'
    secondaryButton.classList.toggle('active', Boolean(secondary))
    secondaryButton.classList.toggle('muted', !secondary)
    secondaryButton.classList.remove('capturing')

    const message = getShortcutConflictMessage(entry.id, entry.value, getEntries())
    warning.textContent = message
    warning.hidden = !message
  }

  function startCapture(field, button) {
    cancelActiveCapture?.()
    button.textContent = 'Naciśnij klawisz…'
    button.classList.add('capturing')
    document.body.dataset.capturingKey = 'true'

    const finish = () => {
      window.removeEventListener('keydown', onKey, true)
      delete document.body.dataset.capturingKey
      cancelActiveCapture = null
    }

    function onKey(event) {
      event.preventDefault()
      event.stopPropagation()
      if (event.repeat) return

      if (event.key === 'Escape') {
        finish()
        render()
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        entry.value = clearShortcutKey(entry.value, field)
      } else {
        const key = normalizeKey(event.key)
        if (!key) return
        entry.value = setShortcutKey(entry.value, field, key)
      }

      finish()
      onChange()
    }

    cancelActiveCapture = () => {
      finish()
      render()
    }
    window.addEventListener('keydown', onKey, true)
  }

  primaryButton.addEventListener('click', () => startCapture('primary', primaryButton))
  secondaryButton.addEventListener('click', () => startCapture('secondary', secondaryButton))
  operatorButton.addEventListener('click', () => {
    entry.value = cycleOperator(entry.value)
    onChange()
  })

  render()
  return { element, refresh: render }
}

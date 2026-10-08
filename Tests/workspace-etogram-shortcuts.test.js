/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { WorkspaceEtogramModule, findShortcutConflicts } from '../public/scripts/workspace/workspace-etogram-module.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const press = (init, target = document) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}
const row = (id, name, primary, secondary = '', operator = '/') => ({
  id, name, category: '', description: '', color: '#42a56b', continuous: false, shortcut: { primary, secondary, operator }
})

const programShortcuts = [
  { id: 'skip-forward', label: 'Do przodu o 5 s', value: { primary: 'ArrowRight', secondary: '', operator: '/' } },
  { id: 'toggle-mute', label: 'Wycisz', value: { primary: 'Shift', secondary: 'M', operator: '+' } }
]

describe('Etogram shortcut conflicts', () => {
  test('warns about keys that two behaviors share and keys that the program uses', () => {
    const conflicts = findShortcutConflicts([
      row('a', 'Bieg', 'Q'),
      row('b', 'Skok', 'Q', 'W', '/'),
      row('c', 'Marsz', 'ArrowRight'),
      row('d', 'Mute', 'M'),
      row('e', 'Bez klawisza', '')
    ], programShortcuts)

    expect(conflicts[0]).toBe('Ten skrót ma też: Skok')
    expect(conflicts[1]).toBe('Ten skrót ma też: Bieg')
    expect(conflicts[2]).toBe('Zajęty przez program: Do przodu o 5 s')
    expect(conflicts[3]).toBe('')
    expect(conflicts[4]).toBe('')
  })

  test('a chord only conflicts with the same chord, not with one of its keys', () => {
    const conflicts = findShortcutConflicts([row('a', 'Razem', 'Q', 'W', '+'), row('b', 'Q sam', 'Q')])
    expect(conflicts).toEqual(['', ''])
  })

  test('shows the warning in the editor and a marker in the compact list', () => {
    document.body.innerHTML = `<div id="host-1"></div>`
    const rows = [row('a', 'Marsz', 'ArrowRight'), row('b', 'Bieg', 'Q')]
    const compact = WorkspaceEtogramModule.renderCompactTable(rows, findShortcutConflicts(rows, programShortcuts))
    const editor = WorkspaceEtogramModule.renderEditorTable(rows, findShortcutConflicts(rows, programShortcuts))

    document.getElementById('host-1').innerHTML = `<table><tbody>${compact}</tbody></table><table><tbody>${editor}</tbody></table>`
    expect(document.querySelectorAll('.etogram-conflict')).toHaveLength(1)
    expect(document.querySelector('.etogram-conflict').title).toBe('Zajęty przez program: Do przodu o 5 s')
    expect(document.querySelectorAll('.etogram-shortcut-warning')).toHaveLength(1)
    expect(document.querySelector('.etogram-shortcut-warning').textContent).toContain('Zajęty przez program')
    expect(document.querySelector('.kbd').textContent).toBe('→')
  })
})

describe('Etogram editor shortcuts', () => {
  async function setup(id, rows, shortcutManager = null) {
    document.body.innerHTML = '<div id="etogram-module"></div>'
    const data = { activeAnimalId: 'ant', animals: [{ id: 'ant', groupId: 'g', name: 'Mrówka', etogramPresetId: 'p' }] }
    const catalog = {
      getData: () => data,
      getPresets: () => [{ id: 'p', activities: rows.map((item) => ({ ...item, id: `${id}-${item.id}` })) }],
      saveData: async () => data,
      savePresets: async (presets) => presets
    }
    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study', animalCatalog: catalog, shortcutManager })
    document.getElementById('open-etogram-editor').click()
    return { modal: document.getElementById('etogram-modal'), prefix: id }
  }

  const rowOf = (modal, index) => modal.querySelectorAll('.editor-table tbody tr')[index]
  const slot = (modal, index, field) => rowOf(modal, index).querySelector(`[data-action="capture-key"][data-field="${field}"]`)
  const operatorButton = (modal, index) => rowOf(modal, index).querySelector('[data-action="toggle-operator"]')

  test('the operator button steps + to / and then back to a single key', async () => {
    const { modal } = await setup('cycle', [row('a', 'Bieg', 'Q', 'E', '+')])
    expect(operatorButton(modal, 0).textContent).toBe('+')

    operatorButton(modal, 0).click()
    expect(operatorButton(modal, 0).textContent).toBe('/')
    expect(operatorButton(modal, 0).hidden).toBe(false)

    operatorButton(modal, 0).click()
    expect(operatorButton(modal, 0).hidden).toBe(true)
    expect(slot(modal, 0, 'secondary').textContent).toBe('+')
    expect(slot(modal, 0, 'primary').textContent).toBe('Q')
  })

  test('assigns Space, clears with Backspace and cancels with Escape, without triggering program shortcuts meanwhile', async () => {
    const { modal } = await setup('capture', [row('a', 'Bieg', 'Q')])

    slot(modal, 0, 'primary').click()
    expect(document.body.dataset.capturingKey).toBe('true')
    press({ key: ' ' })
    expect(slot(modal, 0, 'primary').textContent).toBe('Spacja')
    expect(document.body.dataset.capturingKey).toBeUndefined()

    slot(modal, 0, 'secondary').click()
    press({ key: 'Escape' })
    expect(operatorButton(modal, 0).hidden).toBe(true)

    slot(modal, 0, 'secondary').click()
    press({ key: 'x' })
    expect(operatorButton(modal, 0).textContent).toBe('+')
    expect(slot(modal, 0, 'secondary').textContent).toBe('X')

    slot(modal, 0, 'primary').click()
    press({ key: 'Backspace' })
    expect(slot(modal, 0, 'primary').textContent).toBe('X')
    expect(slot(modal, 0, 'secondary').textContent).toBe('+')
  })

  test('shows live warnings while editing, using the program shortcuts of the manager', async () => {
    const manager = { getShortcuts: () => programShortcuts, subscribe: jest.fn(() => jest.fn()) }
    const { modal } = await setup('warn', [row('a', 'Bieg', 'Q'), row('b', 'Skok', 'W')], manager)
    expect(modal.querySelector('.etogram-shortcut-warning')).toBeNull()

    slot(modal, 1, 'primary').click()
    press({ key: 'ArrowRight' })
    expect(rowOf(modal, 1).querySelector('.etogram-shortcut-warning').textContent).toBe('Zajęty przez program: Do przodu o 5 s')

    slot(modal, 1, 'primary').click()
    press({ key: 'q' })
    expect(rowOf(modal, 0).querySelector('.etogram-shortcut-warning').textContent).toBe('Ten skrót ma też: Skok')
    expect(rowOf(modal, 1).querySelector('.etogram-shortcut-warning').textContent).toBe('Ten skrót ma też: Bieg')

    slot(modal, 1, 'primary').click()
    press({ key: 'z' })
    expect(modal.querySelector('.etogram-shortcut-warning')).toBeNull()
    expect(manager.subscribe).toHaveBeenCalled()
  })

  test('Space and named keys trigger behaviors, while a key the program already handled does not', async () => {
    await setup('run', [row('space', 'Spacja', 'Space'), row('arrow', 'Strzałka', 'ArrowLeft'), row('plain', 'Zwykły', 'J')])
    document.getElementById('close-etogram-modal').click()
    const requested = jest.fn()
    window.addEventListener('etogram-activity-request', requested)
    const ids = () => requested.mock.calls.map(([event]) => event.detail.activityId).filter((activityId) => activityId.startsWith('run-'))

    press({ key: ' ' })
    press({ key: 'ArrowLeft' })
    expect(ids()).toEqual(['run-space', 'run-arrow'])

    const program = (event) => event.preventDefault()
    document.addEventListener('keydown', program, true)
    press({ key: 'j' })
    document.removeEventListener('keydown', program, true)
    expect(ids()).toEqual(['run-space', 'run-arrow'])

    press({ key: 'j' })
    expect(ids()).toEqual(['run-space', 'run-arrow', 'run-plain'])

    press({ key: 'j', altKey: true })
    press({ key: 'j', shiftKey: true })
    expect(ids()).toHaveLength(3)
    window.removeEventListener('etogram-activity-request', requested)
  })

  test('refreshes the warnings when the program shortcuts change', async () => {
    let current = []
    let notify = () => {}
    const manager = { getShortcuts: () => current, subscribe: (callback) => { notify = callback; return () => {} } }
    const { modal } = await setup('refresh', [row('a', 'Bieg', 'ArrowRight')], manager)
    expect(document.querySelector('.etogram-conflict')).toBeNull()

    current = programShortcuts
    notify(current)
    await flush()
    expect(document.querySelector('.etogram-conflict')).not.toBeNull()
    expect(modal.querySelector('.etogram-shortcut-warning').textContent).toContain('Zajęty przez program')
  })
})

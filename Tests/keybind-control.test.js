/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { createKeybindControl } from '../public/scripts/settings/keybind-control.js'

const press = (init) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))

describe('Keybind control in the settings', () => {
  let entries
  let controls
  let onChange

  function build(values) {
    entries = values.map(([id, label, value]) => ({ id, label, value }))
    onChange = jest.fn(() => controls.forEach((control) => control.refresh()))
    controls = entries.map((entry) => createKeybindControl({ entry, getEntries: () => entries, onChange }))
    document.body.innerHTML = ''
    controls.forEach((control) => document.body.appendChild(control.element))
  }

  const slot = (index, name) => controls[index].element.querySelector(`[data-slot="${name}"]`)
  const operator = (index) => controls[index].element.querySelector('.combo-operator')
  const warning = (index) => controls[index].element.querySelector('.keybind-warning')

  beforeEach(() => {
    document.body.removeAttribute('data-capturing-key')
  })

  test('shows the keys in a friendly way, with the operator only when there are two keys', () => {
    build([
      ['play', 'Odtwórz', { primary: 'Space', secondary: 'Enter', operator: '/' }],
      ['skip', 'Do przodu', { primary: 'ArrowRight', secondary: '', operator: '/' }]
    ])

    expect([slot(0, 'primary').textContent, operator(0).textContent, slot(0, 'secondary').textContent]).toEqual(['Spacja', '/', 'Enter'])
    expect(operator(0).hidden).toBe(false)

    expect(slot(1, 'primary').textContent).toBe('→')
    expect(operator(1).hidden).toBe(true)
    expect(slot(1, 'secondary').textContent).toBe('＋ drugi klawisz')
  })

  test('the operator button steps + to / and then removes the second key', () => {
    build([['mute', 'Wycisz', { primary: 'Shift', secondary: 'M', operator: '+' }]])

    operator(0).click()
    expect(entries[0].value).toEqual({ primary: 'Shift', secondary: 'M', operator: '/' })
    expect(operator(0).textContent).toBe('/')

    operator(0).click()
    expect(entries[0].value).toEqual({ primary: 'Shift', secondary: '', operator: '/' })
    expect(operator(0).hidden).toBe(true)
    expect(slot(0, 'secondary').textContent).toBe('＋ drugi klawisz')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  test('adds a second key by pressing it, and starts it as a combination', () => {
    build([['skip', 'Do przodu', { primary: 'Alt', secondary: '', operator: '/' }]])

    slot(0, 'secondary').click()
    expect(document.body.dataset.capturingKey).toBe('true')
    expect(slot(0, 'secondary').classList.contains('capturing')).toBe(true)

    press({ key: 'ArrowRight' })
    expect(entries[0].value).toEqual({ primary: 'Alt', secondary: 'ArrowRight', operator: '+' })
    expect(slot(0, 'secondary').textContent).toBe('→')
    expect(document.body.dataset.capturingKey).toBeUndefined()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('assigns Space and modifier keys, and Escape cancels without a change', () => {
    build([['play', 'Odtwórz', { primary: 'A', secondary: '', operator: '/' }]])

    slot(0, 'primary').click()
    press({ key: ' ' })
    expect(entries[0].value.primary).toBe('Space')
    expect(slot(0, 'primary').textContent).toBe('Spacja')

    slot(0, 'primary').click()
    press({ key: 'Shift' })
    expect(entries[0].value.primary).toBe('Shift')

    slot(0, 'primary').click()
    press({ key: 'Escape' })
    expect(entries[0].value.primary).toBe('Shift')
    expect(slot(0, 'primary').classList.contains('capturing')).toBe(false)
    expect(document.body.dataset.capturingKey).toBeUndefined()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  test('Backspace clears the key, and clearing the first one promotes the second', () => {
    build([['play', 'Odtwórz', { primary: 'Space', secondary: 'Enter', operator: '/' }]])

    slot(0, 'primary').click()
    press({ key: 'Backspace' })
    expect(entries[0].value).toEqual({ primary: 'Enter', secondary: '', operator: '/' })

    slot(0, 'primary').click()
    press({ key: 'Delete' })
    expect(entries[0].value.primary).toBe('')
    expect(slot(0, 'primary').textContent).toBe('—')
  })

  test('warns on both shortcuts when a key is used twice, and the warning goes away when it is fixed', () => {
    build([
      ['play', 'Odtwórz', { primary: 'Space', secondary: 'Enter', operator: '/' }],
      ['mute', 'Wycisz', { primary: 'Shift', secondary: 'M', operator: '+' }]
    ])
    expect(warning(0).hidden).toBe(true)
    expect(warning(1).hidden).toBe(true)

    slot(1, 'primary').click()
    press({ key: 'Enter' })
    slot(1, 'secondary').click()
    press({ key: 'Backspace' })

    expect(warning(0).hidden).toBe(false)
    expect(warning(0).textContent).toBe('Powielony skrót: Wycisz')
    expect(warning(1).textContent).toBe('Powielony skrót: Odtwórz')

    slot(1, 'primary').click()
    press({ key: 'k' })
    expect(warning(0).hidden).toBe(true)
    expect(warning(1).hidden).toBe(true)
  })

  test('starting to assign another key cancels the first one', () => {
    build([
      ['a', 'A', { primary: 'A', secondary: '', operator: '/' }],
      ['b', 'B', { primary: 'B', secondary: '', operator: '/' }]
    ])

    slot(0, 'primary').click()
    slot(1, 'primary').click()
    expect(slot(0, 'primary').classList.contains('capturing')).toBe(false)
    expect(slot(0, 'primary').textContent).toBe('A')

    press({ key: 'x' })
    expect(entries[0].value.primary).toBe('A')
    expect(entries[1].value.primary).toBe('X')
  })
})

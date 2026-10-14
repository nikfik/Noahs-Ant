/**
 * @jest-environment jsdom
 */

import { matchesShortcut } from '../public/scripts/workspace/shortcuts/shortcut-matching.js'

const press = (init) => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
const shortcut = (primary, secondary = '', operator = '/') => ({ primary, secondary, operator })

describe('Matching keyboard events to shortcuts', () => {
  test('a single key matches only with no modifiers held', () => {
    expect(matchesShortcut(shortcut('ArrowRight'), press({ key: 'ArrowRight' }))).toBe(true)
    expect(matchesShortcut(shortcut('ArrowRight'), press({ key: 'ArrowRight', altKey: true }))).toBe(false)
    expect(matchesShortcut(shortcut('ArrowRight'), press({ key: 'ArrowRight', shiftKey: true }))).toBe(false)
    expect(matchesShortcut(shortcut('ArrowRight'), press({ key: 'ArrowLeft' }))).toBe(false)
    expect(matchesShortcut(shortcut('.'), press({ key: '.' }))).toBe(true)
    expect(matchesShortcut(shortcut(','), press({ key: ',' }))).toBe(true)
  })

  test('a modifier combination needs exactly those modifiers, so Alt + → never also fires →', () => {
    const nextAnimal = shortcut('Alt', 'ArrowRight', '+')
    expect(matchesShortcut(nextAnimal, press({ key: 'ArrowRight', altKey: true }))).toBe(true)
    expect(matchesShortcut(nextAnimal, press({ key: 'ArrowRight' }))).toBe(false)
    expect(matchesShortcut(nextAnimal, press({ key: 'ArrowRight', altKey: true, shiftKey: true }))).toBe(false)
    expect(matchesShortcut(nextAnimal, press({ key: 'ArrowRight', ctrlKey: true }))).toBe(false)

    const mute = shortcut('Shift', 'M', '+')
    expect(matchesShortcut(mute, press({ key: 'M', shiftKey: true }))).toBe(true)
    expect(matchesShortcut(mute, press({ key: 'm' }))).toBe(false)
    expect(matchesShortcut(shortcut('M'), press({ key: 'M', shiftKey: true }))).toBe(false)
  })

  test('two alternatives match either key, and Space is written as a space', () => {
    const play = shortcut('Space', 'Enter', '/')
    expect(matchesShortcut(play, press({ key: ' ' }))).toBe(true)
    expect(matchesShortcut(play, press({ key: 'Enter' }))).toBe(true)
    expect(matchesShortcut(play, press({ key: 'a' }))).toBe(false)
    expect(matchesShortcut(play, press({ key: 'Enter', altKey: true }))).toBe(false)
  })

  test('a chord of two plain keys needs the other key to be held', () => {
    const chord = shortcut('A', 'S', '+')
    expect(matchesShortcut(chord, press({ key: 's' }), new Set(['A']))).toBe(true)
    expect(matchesShortcut(chord, press({ key: 'a' }), new Set(['S']))).toBe(true)
    expect(matchesShortcut(chord, press({ key: 's' }), new Set())).toBe(false)
    expect(matchesShortcut(chord, press({ key: 'd' }), new Set(['A', 'S']))).toBe(false)
  })

  test('a shortcut made only of a modifier matches that modifier alone', () => {
    expect(matchesShortcut(shortcut('Shift'), press({ key: 'Shift', shiftKey: true }))).toBe(true)
    expect(matchesShortcut(shortcut('Shift'), press({ key: 'Shift', shiftKey: true, altKey: true }))).toBe(false)
  })

  test('empty shortcuts and unknown keys never match', () => {
    expect(matchesShortcut(shortcut(''), press({ key: 'a' }))).toBe(false)
    expect(matchesShortcut(undefined, press({ key: 'a' }))).toBe(false)
    expect(matchesShortcut(shortcut('A'), press({ key: 'Dead' }))).toBe(false)
    expect(matchesShortcut(shortcut('A'), press({ key: 'Unidentified' }))).toBe(false)
  })
})

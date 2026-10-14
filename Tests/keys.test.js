import { isModifierKey, keyLabel, normalizeKey } from '../public/scripts/shared/keys.js'

describe('Key names', () => {
  test('gives every key one name, from keyboard events and from older saved settings', () => {
    expect(normalizeKey(' ')).toBe('Space')
    expect(normalizeKey('space')).toBe('Space')
    expect(normalizeKey('m')).toBe('M')
    expect(normalizeKey(' q ')).toBe('Q')
    expect(normalizeKey('.')).toBe('.')
    expect(normalizeKey(',')).toBe(',')
    expect(normalizeKey('Esc')).toBe('Escape')
    expect(normalizeKey('ctrl')).toBe('Control')
    expect(normalizeKey('shift')).toBe('Shift')
    expect(normalizeKey('arrowleft')).toBe('ArrowLeft')
    expect(normalizeKey('ArrowRight')).toBe('ArrowRight')
    expect(normalizeKey('f5')).toBe('F5')
    expect(normalizeKey('Enter')).toBe('Enter')
  })

  test('ignores keys that are not real keys', () => {
    expect(normalizeKey('')).toBe('')
    expect(normalizeKey('   ')).toBe('')
    expect(normalizeKey(null)).toBe('')
    expect(normalizeKey(undefined)).toBe('')
    expect(normalizeKey('Dead')).toBe('')
    expect(normalizeKey('Unidentified')).toBe('')
  })

  test('shows keys in a friendly way and knows the modifiers', () => {
    expect(keyLabel('Space')).toBe('Spacja')
    expect(keyLabel('ArrowLeft')).toBe('←')
    expect(keyLabel('ArrowRight')).toBe('→')
    expect(keyLabel('Escape')).toBe('Esc')
    expect(keyLabel('Control')).toBe('Ctrl')
    expect(keyLabel('M')).toBe('M')

    expect(['Shift', 'Alt', 'Control', 'Meta'].every(isModifierKey)).toBe(true)
    expect(isModifierKey('M')).toBe(false)
  })
})

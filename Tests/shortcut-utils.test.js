import {
  clearShortcutKey,
  cycleOperator,
  describeShortcut,
  getShortcutConflictMessage,
  setShortcutKey,
  shortcutCombos,
  shortcutsOverlap
} from '../public/scripts/settings/shortcut-utils.js'

const shortcut = (primary, secondary = '', operator = '/') => ({ primary, secondary, operator })

describe('Shortcut combinations', () => {
  test('a slash means two separate keys, a plus means one combination of both', () => {
    expect(shortcutCombos(shortcut('A'))).toEqual([['A']])
    expect(shortcutCombos(shortcut('A', 'B', '/'))).toEqual([['A'], ['B']])
    expect(shortcutCombos(shortcut('A', 'B', '+'))).toEqual([['A', 'B']])
    expect(shortcutCombos(shortcut('', 'B', '+'))).toEqual([['B']])
    expect(shortcutCombos(shortcut(''))).toEqual([])
    expect(shortcutCombos(undefined)).toEqual([])
  })

  test('finds shortcuts that share a key combination, whatever the order', () => {
    expect(shortcutsOverlap(shortcut('Space', 'Enter', '/'), shortcut('Enter'))).toBe(true)
    expect(shortcutsOverlap(shortcut('A', 'B', '+'), shortcut('B', 'A', '+'))).toBe(true)
    expect(shortcutsOverlap(shortcut('Shift', 'M', '+'), shortcut('M'))).toBe(false)
    expect(shortcutsOverlap(shortcut('A', 'B', '+'), shortcut('A'))).toBe(false)
    expect(shortcutsOverlap(shortcut(''), shortcut(''))).toBe(false)
  })

  test('names the other shortcuts that use a key, including through a second key', () => {
    const entries = [
      { id: 'play', label: 'Odtwórz / zatrzymaj', value: shortcut('Space', 'Enter', '/') },
      { id: 'mute', label: 'Wycisz', value: shortcut('Shift', 'M', '+') },
      { id: 'other', label: 'Inne', value: shortcut('Enter') }
    ]

    expect(getShortcutConflictMessage('other', entries[2].value, entries)).toBe('Powielony skrót: Odtwórz / zatrzymaj')
    expect(getShortcutConflictMessage('play', entries[0].value, entries)).toBe('Powielony skrót: Inne')
    expect(getShortcutConflictMessage('mute', entries[1].value, entries)).toBe('')
  })

  test('describes a shortcut the way it is shown on screen', () => {
    expect(describeShortcut(shortcut('Space', 'Enter', '/'))).toBe('Spacja / Enter')
    expect(describeShortcut(shortcut('Shift', 'M', '+'))).toBe('Shift + M')
    expect(describeShortcut(shortcut('ArrowRight'))).toBe('→')
    expect(describeShortcut(shortcut(''))).toBe('')
    expect(describeShortcut(undefined)).toBe('')
  })
})

describe('Editing a shortcut', () => {
  test('the operator button steps + to / and then back to a single key', () => {
    let current = shortcut('Shift', 'M', '+')
    current = cycleOperator(current)
    expect(current).toEqual(shortcut('Shift', 'M', '/'))
    current = cycleOperator(current)
    expect(current).toEqual(shortcut('Shift', '', '/'))
    expect(cycleOperator(current)).toEqual(shortcut('Shift', '', '/'))
  })

  test('a new second key starts as a "+" combination and an existing one keeps its operator', () => {
    const added = setShortcutKey(shortcut('Alt'), 'secondary', 'arrowright')
    expect(added).toEqual(shortcut('Alt', 'ArrowRight', '+'))

    const slash = setShortcutKey(shortcut('Space', 'Enter', '/'), 'secondary', 'k')
    expect(slash).toEqual(shortcut('Space', 'K', '/'))
    expect(setShortcutKey(slash, 'primary', ' ')).toEqual(shortcut('Space', 'K', '/'))
    expect(setShortcutKey(shortcut('A'), 'primary', 'b')).toEqual(shortcut('B'))
  })

  test('clearing the first key promotes the second, clearing the second leaves a single key', () => {
    expect(clearShortcutKey(shortcut('Space', 'Enter', '/'), 'primary')).toEqual(shortcut('Enter'))
    expect(clearShortcutKey(shortcut('Space', 'Enter', '/'), 'secondary')).toEqual(shortcut('Space'))
    expect(clearShortcutKey(shortcut('A'), 'primary')).toEqual(shortcut(''))
  })
})

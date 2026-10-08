import { jest } from '@jest/globals'
import { normalizeAppSettings } from '../public/scripts/settings/settings-model.js'
import { loadSettings, saveSettings } from '../public/scripts/settings/settings-service.js'
import {
  getShortcutConflictMessage,
  getShortcutSignature,
  normalizeKeyValue,
  normalizeShortcutEntry
} from '../public/scripts/settings/shortcut-utils.js'

describe('Settings model defaults and normalization', () => {
  test('uses defaults when no saved settings exist', () => {
    const settings = normalizeAppSettings()

    expect(settings.theme).toEqual({
      bgColor: '#1a1a1a',
      textColor: '#e0e0e0',
      primaryColor: '#ff4f1a'
    })
    expect(settings.timeline).toEqual({ snapEnabled: true, snapThresholdPx: 9 })
    expect(settings.programShortcuts.map(({ id }) => id)).toEqual([
      'play-pause', 'skip-forward', 'skip-back', 'frame-forward', 'frame-back', 'toggle-mute', 'next-animal', 'previous-animal'
    ])
    const value = (id) => settings.programShortcuts.find((entry) => entry.id === id).value
    expect(value('play-pause')).toEqual({ primary: 'Space', secondary: 'Enter', operator: '/' })
    expect(value('skip-forward')).toEqual({ primary: 'ArrowRight', secondary: '', operator: '/' })
    expect(value('toggle-mute')).toEqual({ primary: 'Shift', secondary: 'M', operator: '+' })
    expect(value('previous-animal')).toEqual({ primary: 'Alt', secondary: 'ArrowLeft', operator: '+' })
  })

  test('merges legacy shortcut settings with defaults for new fields', () => {
    const settings = normalizeAppSettings({
      programShortcuts: [{ id: 'play-pause', value: 'q' }, { id: 'temp1', value: 'x' }],
      projectShortcuts: []
    })

    expect(settings.programShortcuts.find(({ id }) => id === 'play-pause').value).toEqual({ primary: 'Q', secondary: '', operator: '/' })
    expect(settings.programShortcuts.find(({ id }) => id === 'skip-forward').value.primary).toBe('ArrowRight')
    expect(settings.programShortcuts.some(({ id }) => id === 'temp1')).toBe(false)
    expect(settings.theme.bgColor).toBe('#1a1a1a')
  })

  test('rejects invalid theme and timeline values in favor of defaults', () => {
    const settings = normalizeAppSettings({
      theme: { bgColor: 'red' },
      timeline: { snapEnabled: 'yes', snapThresholdPx: 99 }
    })

    expect(settings.theme.bgColor).toBe('#1a1a1a')
    expect(settings.timeline).toEqual({ snapEnabled: true, snapThresholdPx: 9 })
  })

  test('loads saved preferences and persists settings together with the theme', async () => {
    const electronAPI = {
      getAppSettings: async () => ({ theme: { primaryColor: '#00ff00' } }),
      saveAppSettings: jest.fn(async () => {}),
      setTheme: jest.fn(async () => {})
    }

    const settings = await loadSettings(electronAPI)
    expect(settings.theme.primaryColor).toBe('#00ff00')
    settings.timeline.snapEnabled = false

    await saveSettings(electronAPI, settings)

    expect(electronAPI.saveAppSettings).toHaveBeenCalledWith(expect.objectContaining({
      theme: expect.objectContaining({ primaryColor: '#00ff00' }),
      timeline: expect.objectContaining({ snapEnabled: false })
    }))
    expect(electronAPI.setTheme).toHaveBeenCalledWith(settings.theme)
  })
})

describe('Shortcut utilities', () => {
  test('normalizes key and combination values', () => {
    expect(normalizeKeyValue(' q ')).toBe('Q')
    expect(normalizeShortcutEntry({ primary: 'q', secondary: 'shift', operator: '+' })).toEqual({
      primary: 'Q',
      secondary: 'Shift',
      operator: '+'
    })
    expect(getShortcutSignature({ primary: 'Q', secondary: 'E', operator: '+' })).toBe('Q+E')
  })

  test('reports conflicts against a different shortcut', () => {
    const shortcuts = [
      { id: 'move-forward', label: 'Do przodu', value: { primary: 'W' } },
      { id: 'sprint', label: 'Sprint', value: { primary: 'W' } }
    ]

    expect(getShortcutConflictMessage('move-forward', shortcuts[0].value, shortcuts)).toBe('Powielony skrót: Sprint')
    expect(getShortcutConflictMessage('sprint', shortcuts[1].value, shortcuts)).toBe('Powielony skrót: Do przodu')
  })
})

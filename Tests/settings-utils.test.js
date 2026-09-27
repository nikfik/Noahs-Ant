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
    expect(settings.graphics['frame-rate']).toBe('60fps')
    expect(settings.graphics['motion-blur']).toBe(true)
    expect(settings.programShortcuts.find(({ id }) => id === 'move-forward').value.primary).toBe('W')
  })

  test('merges legacy shortcut settings with defaults for new fields', () => {
    const settings = normalizeAppSettings({
      programShortcuts: [{ id: 'move-forward', value: 'q' }],
      projectShortcuts: []
    })

    expect(settings.programShortcuts.find(({ id }) => id === 'move-forward').value.primary).toBe('Q')
    expect(settings.programShortcuts.find(({ id }) => id === 'move-left').value.primary).toBe('A')
    expect(settings.theme.bgColor).toBe('#1a1a1a')
    expect(settings.graphics['frame-rate']).toBe('60fps')
  })

  test('rejects invalid theme and graphics values in favor of defaults', () => {
    const settings = normalizeAppSettings({
      theme: { bgColor: 'red' },
      graphics: { 'frame-rate': 'unlimited', 'motion-blur': 'yes' }
    })

    expect(settings.theme.bgColor).toBe('#1a1a1a')
    expect(settings.graphics['frame-rate']).toBe('60fps')
    expect(settings.graphics['motion-blur']).toBe(true)
  })

  test('loads saved preferences and persists settings together with the theme', async () => {
    const electronAPI = {
      getAppSettings: async () => ({ theme: { primaryColor: '#00ff00' } }),
      saveAppSettings: jest.fn(async () => {}),
      setTheme: jest.fn(async () => {})
    }

    const settings = await loadSettings(electronAPI)
    expect(settings.theme.primaryColor).toBe('#00ff00')
    settings.graphics['motion-blur'] = false

    await saveSettings(electronAPI, settings)

    expect(electronAPI.saveAppSettings).toHaveBeenCalledWith(expect.objectContaining({
      theme: expect.objectContaining({ primaryColor: '#00ff00' }),
      graphics: expect.objectContaining({ 'motion-blur': false })
    }))
    expect(electronAPI.setTheme).toHaveBeenCalledWith(settings.theme)
  })
})

describe('Shortcut utilities', () => {
  test('normalizes key and combination values', () => {
    expect(normalizeKeyValue(' q ')).toBe('Q')
    expect(normalizeShortcutEntry({ primary: 'q', secondary: 'shift', operator: '+' })).toEqual({
      primary: 'Q',
      secondary: 'shift',
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

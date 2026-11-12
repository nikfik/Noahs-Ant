/**
 * @jest-environment jsdom
 */
import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'
import { FONT_CHOICES, SCALE_CHOICES, THEME_PRESETS, fontStack, isLightTheme, luminance, matchThemePreset } from '../public/scripts/shared/appearance.js'
import { applyTheme, initTheme } from '../public/scripts/theme/theme-service.js'
import { normalizeAppSettings } from '../public/scripts/settings/settings-model.js'
import { settingsCatalog } from '../public/scripts/settings/settings-config.js'
import { registerSettingsHandlers } from '../public/scripts/main/handlers/settings-handlers.js'

describe('color schemes and fonts', () => {
  test('recognizes the ready schemes, ignoring letter case, and calls everything else custom', () => {
    expect(matchThemePreset(THEME_PRESETS.dark)).toBe('dark')
    expect(matchThemePreset({ ...THEME_PRESETS.light, bgColor: THEME_PRESETS.light.bgColor.toUpperCase() })).toBe('light')
    expect(matchThemePreset({ ...THEME_PRESETS.dark, primaryColor: '#00ff00' })).toBe('custom')
  })

  test('tells dark colors from light ones', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1, 3)
    expect(luminance('nonsense')).toBe(0)
    expect(isLightTheme(THEME_PRESETS.light)).toBe(true)
    expect(isLightTheme(THEME_PRESETS.dark)).toBe(false)
    expect(isLightTheme({ bgColor: '#808080' })).toBe(false)
  })

  test('every font ends in a generic family and unknown fonts fall back to the system one', () => {
    FONT_CHOICES.forEach((font) => expect(font.stack).toMatch(/(sans-serif|serif|monospace)$/))
    expect(fontStack('georgia')).toContain('Georgia')
    expect(fontStack('nope')).toBe(FONT_CHOICES[0].stack)
    expect(SCALE_CHOICES.map((choice) => choice.value)).toEqual(['90', '100', '115', '130'])
  })
})

describe('applying a theme to a page', () => {
  test('sets the three colors, the font and the scheme, with a gentler dark shade on a light theme', () => {
    applyTheme({ ...THEME_PRESETS.light, font: 'verdana' })
    const style = document.documentElement.style
    expect(style.getPropertyValue('--bg-color')).toBe('#f4f4f1')
    expect(style.getPropertyValue('--text-color')).toBe('#1d1d1f')
    expect(style.getPropertyValue('--primary-color')).toBe('#e0480f')
    expect(style.getPropertyValue('--sunken-amount')).toBe('6%')
    expect(style.getPropertyValue('--app-font')).toContain('Verdana')
    expect(style.colorScheme).toBe('light')

    applyTheme({ ...THEME_PRESETS.dark })
    expect(style.getPropertyValue('--sunken-amount')).toBe('35%')
    expect(style.colorScheme).toBe('dark')
    expect(style.getPropertyValue('--app-font')).toContain('Segoe UI')
  })

  test('a page reads the saved theme and follows later changes', async () => {
    let listener
    const api = {
      getAppSettings: jest.fn().mockResolvedValue({ theme: { ...THEME_PRESETS.light, font: 'system' } }),
      onThemeChange: jest.fn((callback) => { listener = callback })
    }
    await initTheme(api)
    expect(document.documentElement.style.getPropertyValue('--bg-color')).toBe('#f4f4f1')
    listener({ ...THEME_PRESETS.dark })
    expect(document.documentElement.style.getPropertyValue('--bg-color')).toBe('#1a1a1a')
    await expect(initTheme({ getAppSettings: jest.fn().mockRejectedValue(new Error('x')) })).resolves.toBeUndefined()
  })
})

describe('appearance settings', () => {
  test('keep the font, the scale and the scheme, and reject unknown values', () => {
    const saved = normalizeAppSettings({ theme: { ...THEME_PRESETS.light, font: 'georgia' }, graphics: { scale: '115' } })
    expect(saved.theme).toMatchObject({ preset: 'light', font: 'georgia' })
    expect(saved.graphics).toEqual({ scale: '115' })

    const custom = normalizeAppSettings({ theme: { bgColor: '#101010', textColor: 'red', font: 'comic' }, graphics: { scale: '250' } })
    expect(custom.theme).toMatchObject({ bgColor: '#101010', textColor: '#e0e0e0', font: 'system', preset: 'custom' })
    expect(custom.graphics.scale).toBe('100')
  })

  test('remember the user own colors next to the ones in use', () => {
    const settings = normalizeAppSettings({ theme: { ...THEME_PRESETS.light, custom: { bgColor: '#102030', textColor: '#ffffff', primaryColor: 'nope' } } })
    expect(settings.theme.preset).toBe('light')
    expect(settings.theme.custom).toEqual({ bgColor: '#102030', textColor: '#ffffff', primaryColor: '#ff4f1a' })
  })

  test('the colors are on the Graficzne tab, together with the font and the interface size', () => {
    expect(settingsCatalog.general).toBeUndefined()
    expect(settingsCatalog.graphics.options.map((option) => option.id)).toEqual(['theme-preset', 'bg-color', 'text-color', 'accent-color', 'font', 'scale'])
    expect(Object.keys(settingsCatalog)[0]).toBe('graphics')
  })

  test('saving settings applies the interface scale to the windows', () => {
    const handlers = {}
    const onSaved = jest.fn()
    registerSettingsHandlers({
      ipcMain: { handle: (name, handler) => { handlers[name] = handler } },
      BrowserWindow: { getAllWindows: () => [] },
      settingsStore: { readAppSettings: jest.fn(), writeAppSettings: jest.fn((settings) => settings) },
      openSettingsWindow: jest.fn(),
      onSaved
    })
    handlers['save-app-settings']({}, { graphics: { scale: '115' } })
    expect(onSaved).toHaveBeenCalledWith({ graphics: { scale: '115' } })
  })
})

describe('style sheets', () => {
  const folder = path.join(process.cwd(), 'public', 'styles')
  const read = (name) => fs.readFileSync(path.join(folder, name), 'utf8')
  const sheets = fs.readdirSync(folder).filter((name) => name.endsWith('.css') && name !== 'MainColors.css')

  test('every shade a page uses is defined from the chosen colors', () => {
    const colors = read('MainColors.css')
    const used = new Set(sheets.flatMap((name) => [...read(name).matchAll(/var\(--(tint-\d+|surface-[a-z0-9]+|sunken)\b/g)].map((match) => match[1])))
    expect(used.size).toBeGreaterThan(10)
    used.forEach((token) => expect(colors).toContain(`--${token}:`))
  })

  test('no page still draws on a fixed white overlay, except over the black video picture', () => {
    sheets.forEach((name) => {
      read(name).replace(/\r/g, '').split('}').forEach((rule) => {
        if (/rgba\(\s*255\s*,\s*255\s*,\s*255/.test(rule)) expect(rule).toMatch(/\.video-(zoom|busy|stage|empty)/)
      })
    })
  })

  test('the font comes from the setting on every page', () => {
    ;['Workspace.css', 'E_ProjectLists.css', 'Settings.css'].forEach((name) => expect(read(name)).toMatch(/font-family: var\(--app-font/))
  })
})

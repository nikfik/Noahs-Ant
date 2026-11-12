/**
 * @jest-environment jsdom
 */
import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'
import en from '../public/scripts/shared/languages/en.js'
import { LANGUAGES, getLanguage, initLanguage, isLanguage, locale, plural, setLanguage, t, translatePage } from '../public/scripts/shared/i18n.js'
import { normalizeAppSettings } from '../public/scripts/settings/settings-model.js'
import { settingsCatalog } from '../public/scripts/settings/settings-config.js'

afterEach(() => setLanguage('pl'))

describe('translating texts', () => {
  test('Polish is the default and returns the text as it is', () => {
    expect(getLanguage()).toBe('pl')
    expect(t('Zapisz')).toBe('Zapisz')
    expect(t('Zapisano: {path}', { path: 'C:/a' })).toBe('Zapisano: C:/a')
    expect(locale()).toBe('pl-PL')
  })

  test('English looks the text up, fills in the values and leaves unknown texts alone', () => {
    setLanguage('en')
    expect(getLanguage()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(t('Zapisz')).toBe('Save')
    expect(t('Zapisano: {path}', { path: 'C:/a' })).toBe('Saved: C:/a')
    expect(t('Tekst bez tłumaczenia')).toBe('Tekst bez tłumaczenia')
    expect(t('Projekt {name}', {})).toBe('Project {name}')
    expect(locale()).toBe('en-GB')
    expect(setLanguage('xx')).toBe('pl')
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('de')).toBe(false)
  })

  test('counted words take the right form: three in Polish, two in English', () => {
    const forms = ['probka', 'probki', 'probek']
    expect([1, 2, 4, 5, 12, 14, 22, 25, 112].map((count) => plural(count, forms))).toEqual(['probka', 'probki', 'probki', 'probek', 'probek', 'probek', 'probki', 'probek', 'probek'])
    en.probka = ['sample', 'samples']
    setLanguage('en')
    expect([1, 2, 0].map((count) => plural(count, forms))).toEqual(['sample', 'samples', 'samples'])
    delete en.probka
  })

  test('a page marked for translation is translated, including attributes', () => {
    document.body.innerHTML = '<button data-i18n>Zapisz</button><input data-i18n-placeholder="Szukaj projektu…" placeholder="Szukaj projektu…"><span data-i18n-title="Opcje projektu" title="Opcje projektu"></span>'
    setLanguage('en')
    translatePage()
    expect(document.querySelector('button').textContent).toBe('Save')
    expect(document.querySelector('input').placeholder).toBe('Search projects…')
    expect(document.querySelector('span').title).toBe('Project options')
    translatePage()
    expect(document.querySelector('button').textContent).toBe('Save')
  })

  test('a page reads the saved language and reloads when it is changed in the settings', async () => {
    let listener
    const reload = jest.fn()
    await initLanguage({ getAppSettings: async () => ({ language: 'en' }), onSettingsChange: (callback) => { listener = callback } }, reload)
    expect(getLanguage()).toBe('en')
    listener({ language: 'en' })
    expect(reload).not.toHaveBeenCalled()
    listener({ language: 'pl' })
    expect(reload).toHaveBeenCalledTimes(1)
    await expect(initLanguage({ getAppSettings: async () => { throw new Error('x') } })).resolves.toBeUndefined()
  })
})

describe('language setting', () => {
  test('is Polish unless a known language was saved, and has a place in the settings', () => {
    expect(normalizeAppSettings().language).toBe('pl')
    expect(normalizeAppSettings({ language: 'en' }).language).toBe('en')
    expect(normalizeAppSettings({ language: 'klingon' }).language).toBe('pl')
    expect(settingsCatalog.general.options[0]).toMatchObject({ id: 'language', storage: 'app', key: 'language' })
    expect(settingsCatalog.general.options[0].values.map((option) => option.value)).toEqual(LANGUAGES.map((language) => language.value))
  })
})

// Every text that is marked for translation must have an English version, so no screen is left half translated.
describe('dictionary', () => {
  const root = path.join(process.cwd(), 'public')
  const walk = (folder) => fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
  const unescape = (text) => text.replace(/\\(['"`\\])/g, '$1')
  // Texts that read the same in English need no entry.
  const UNCHANGED = new Set(['Import', 'Moment (s)', 'Zoom', 'Start (s)', 'Excel (.xlsx)'])

  test('has an English text for every static t(...) call in the code', () => {
    const missing = []
    walk(path.join(root, 'scripts')).filter((file) => file.endsWith('.js') && !file.includes(`${path.sep}languages${path.sep}`)).forEach((file) => {
      const code = fs.readFileSync(file, 'utf8')
      ;[...code.matchAll(/(?<![\w.])(?:t|plural)\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].forEach((match) => {
        if (match[1] === '`' && match[2].includes('${')) return
        const key = unescape(match[2])
        if (!(key in en) && !UNCHANGED.has(key)) missing.push(`${path.relative(root, file)}: ${key}`)
      })
    })
    expect(missing).toEqual([])
  })

  test('has an English text for the texts that reach t(...) through a variable', async () => {
    const { QUALITY_LEVELS, QUALITY_PRESETS } = await import('../public/scripts/shared/video-quality.js')
    const texts = [
      ...QUALITY_PRESETS.flatMap((preset) => [preset.label, preset.description]),
      ...QUALITY_LEVELS.map((level) => level.label),
      'Ta próba nie ma jeszcze filmu', 'się zaczyna', 'się kończy', 'rozpocznij', 'zakończ'
    ]
    expect([...new Set(texts)].filter((text) => !(text in en))).toEqual([])
  })

  test('has an English text for the tables of labels and tips of the data, chart and transition screens', async () => {
    const { EVENT_COLUMNS } = await import('../public/scripts/workspace/data/data-events-module.js')
    const { METRIC_COLUMNS, TIPS } = await import('../public/scripts/workspace/data/data-metrics-module.js')
    const { METRICS, GROUPINGS, AGGREGATES, CHART_KINDS } = await import('../public/scripts/workspace/charts/chart-model.js')
    const { TRANSITION_MODES } = await import('../public/scripts/workspace/transitions/transition-model.js')
    const { EXPORT_METRICS, ROUNDING_RULES } = await import('../public/scripts/workspace/data/export-model.js')
    const { BACKUP_KINDS } = await import('../public/scripts/workspace/backups/backups-module.js')
    const texts = [
      ...EVENT_COLUMNS.flatMap((column) => [column.label, column.tip]),
      ...METRIC_COLUMNS.flatMap((column) => [column.label, column.tip]),
      ...Object.values(TIPS),
      ...METRICS.map((metric) => metric.label),
      ...GROUPINGS.flatMap((item) => [item.label, item.hint]),
      ...AGGREGATES.map((item) => item.label),
      ...CHART_KINDS.map((item) => item.label),
      ...TRANSITION_MODES.flatMap((mode) => [mode.label, mode.hint]),
      ...EXPORT_METRICS.map((metric) => metric.label),
      ...ROUNDING_RULES.map((rule) => rule.label),
      ...Object.values(BACKUP_KINDS)
    ]
    expect([...new Set(texts)].filter((text) => !(text in en) && !UNCHANGED.has(text))).toEqual([])
    ;[['próba', 2], ['zwierzę', 2], ['zdarzenie', 2], ['zwierzę w próbie', 2], ['przejście', 2]].forEach(([form, size]) => expect(en[form]).toHaveLength(size))
  })

  test('has an English text for every marked text of the pages', () => {
    const missing = []
    fs.readdirSync(path.join(root, 'views')).filter((file) => file.endsWith('.html')).forEach((file) => {
      const html = fs.readFileSync(path.join(root, 'views', file), 'utf8')
      ;[...html.matchAll(/<[^>]*\sdata-i18n(?=[\s>])[^>]*>([^<]*)</g)].forEach((match) => {
        const key = match[1].trim()
        if (key && !(key in en) && !UNCHANGED.has(key)) missing.push(`${file}: ${key}`)
      })
      ;[...html.matchAll(/data-i18n-(?:title|placeholder|aria-label)="([^"]*)"/g)].forEach((match) => {
        if (!(match[1] in en)) missing.push(`${file}: ${match[1]}`)
      })
    })
    expect(missing).toEqual([])
  })

  test('has an English text for every label of the settings window', () => {
    const labels = Object.values(settingsCatalog).flatMap((section) => [section.title, ...section.options.flatMap((option) => [option.label, option.group, ...(option.values || []).map((value) => value.label)])])
    const missing = [...new Set(labels.filter(Boolean))].filter((label) => !(label in en) && !LANGUAGES.some((language) => language.label === label) && !['Arial', 'Verdana', 'Tahoma', 'Calibri'].includes(label) && !/^\d+$/.test(label))
    expect(missing).toEqual([])
  })

  test('has no entry that is the same as its key (a text that needs no translation is simply left out)', () => {
    expect(Object.entries(en).filter(([key, value]) => key === value).map(([key]) => key)).toEqual([])
  })
})

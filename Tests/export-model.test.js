import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import XLSX from 'xlsx'
import { writeWorkbook } from '../public/scripts/main/workbook-export.js'
import { buildExportSheets, suggestExportName } from '../public/scripts/workspace/data/export-model.js'

const interval = (id, start, end, extra = {}) => ({
  id, animalId: 'rescuer', activityId: 'dig', activityName: 'Kopanie', activityColor: '#42a56b',
  kind: 'interval', start, end, lane: null, trialId: 't1', ...extra
})

const trials = [
  { id: 't1', name: 'A2M1 / Head / 1', duration: 300, windowStart: null, windowEnd: null },
  { id: 't2', name: 'A2M1 / Head / 2', duration: null, windowStart: null, windowEnd: null }
]
const animals = [
  { id: 'rescuer', name: 'Ratownik', etogramPresetId: 'p-rescuer' },
  { id: 'victim', name: 'Ofiara', etogramPresetId: 'p-victim' }
]
const presets = [
  { id: 'p-rescuer', activities: [
    { id: 'dig', name: 'Kopanie', continuous: true, category: 'Ratowanie' },
    { id: 'pull', name: 'Ciągnięcie', continuous: true, category: 'Ratowanie' }
  ] },
  { id: 'p-victim', activities: [{ id: 'kick', name: 'Kopnięcie', continuous: false, category: 'Aktywność' }] }
]
const observations = [
  interval('d1', 10, 20),
  interval('p1', 30, 40, { activityId: 'pull', activityName: 'Ciągnięcie' }),
  interval('open', 290, null, { activityId: 'pull', activityName: 'Ciągnięcie' }),
  interval('k1', 7, 7, { kind: 'point', animalId: 'victim', activityId: 'kick', activityName: 'Kopnięcie' }),
  interval('d2', 5, 9, { trialId: 't2' })
]
const exportedAt = new Date(2026, 9, 8, 12, 30)
const sheets = (options = {}) => Object.fromEntries(
  buildExportSheets({ observations, trials, animals, presets, exportedAt, ...options }).map((sheet) => [sheet.name, sheet])
)

describe('Workbook contents', () => {
  test('produces the five sheets in a useful order', () => {
    expect(buildExportSheets({ observations, trials, animals, presets, exportedAt }).map((sheet) => sheet.name))
      .toEqual(['Metryki', 'Metryki (długi format)', 'Zdarzenia', 'Okna prób', 'Informacje'])
  })

  test('wide sheet has one row per trial with a group of columns for every behavior of every animal', () => {
    const { Metryki: wide } = sheets()

    expect(wide.headers.slice(0, 3)).toEqual(['Próba', 'Okno od (s)', 'Okno do (s)'])
    expect(wide.headers.slice(3, 9)).toEqual([
      'Ratownik – Kopanie: wystąpiła (1/0)', 'Ratownik – Kopanie: latencja (s)', 'Ratownik – Kopanie: liczba',
      'Ratownik – Kopanie: czas łączny (s)', 'Ratownik – Kopanie: % okna', 'Ratownik – Kopanie: % po latencji'
    ])
    expect(wide.headers).toContain('Ratownik – Σ Ratowanie: czas łączny (s)')
    expect(wide.headers).toContain('Ofiara – Kopnięcie: liczba')
    expect(wide.headers).toHaveLength(3 + 6 * 4)
    expect(wide.rows.map((row) => row[0])).toEqual(['A2M1 / Head / 1', 'A2M1 / Head / 2'])

    const first = wide.rows[0]
    const at = (header) => first[wide.headers.indexOf(header)]
    expect(first.slice(1, 3)).toEqual([0, 300])
    expect(at('Ratownik – Kopanie: wystąpiła (1/0)')).toBe(1)
    expect(at('Ratownik – Kopanie: latencja (s)')).toBe(10)
    expect(at('Ratownik – Kopanie: czas łączny (s)')).toBe(10)
    expect(at('Ratownik – Kopanie: % okna')).toBeCloseTo(10 / 300 * 100)
    // dig 10 s + pull 10 s + the open pull event lasting until the window ends (10 s)
    expect(at('Ratownik – Ciągnięcie: czas łączny (s)')).toBe(20)
    expect(at('Ratownik – Σ Ratowanie: czas łączny (s)')).toBe(30)
    expect(at('Ofiara – Kopnięcie: liczba')).toBe(1)
    expect(at('Ofiara – Kopnięcie: czas łączny (s)')).toBeNull()
  })

  test('wide sheet marks the number formats and leaves impossible values empty', () => {
    const { Metryki: wide } = sheets()
    const format = (header) => wide.formats[wide.headers.indexOf(header)]
    expect(format('Ratownik – Kopanie: latencja (s)')).toBe('0.000')
    expect(format('Ratownik – Kopanie: liczba')).toBe('0')
    expect(format('Ratownik – Kopanie: % okna')).toBe('0.0')

    const second = wide.rows[1]
    expect(second[wide.headers.indexOf('Ratownik – Kopanie: wystąpiła (1/0)')]).toBe(1)
    expect(second[wide.headers.indexOf('Ratownik – Ciągnięcie: wystąpiła (1/0)')]).toBe(0)
    expect(second[wide.headers.indexOf('Ratownik – Ciągnięcie: latencja (s)')]).toBeNull()
  })

  test('long sheet lists every trial x animal x behavior and marks category totals', () => {
    const { 'Metryki (długi format)': long } = sheets()
    expect(long.headers).toEqual([
      'Próba', 'Zwierzę', 'Czynność', 'Poziom', 'Wystąpiła (1/0)', 'Latencja (s)', 'Liczba', 'Czas łączny (s)', '% okna', '% po latencji', 'Okno od (s)', 'Okno do (s)'
    ])
    expect(long.rows).toHaveLength(2 * (2 + 1 + 1))
    expect(long.rows[0].slice(0, 4)).toEqual(['A2M1 / Head / 1', 'Ratownik', 'Kopanie', 'czynność'])
    expect(long.rows.filter((row) => row[3] === 'suma kategorii').map((row) => row[2])).toEqual(['Σ Ratowanie', 'Σ Ratowanie'])
    expect(long.formats[5]).toBe('0.000')
  })

  test('respects the category settings of the screen, including merged time', () => {
    const overlapping = [...observations, interval('d3', 15, 35)]
    const total = (options) => {
      const { Metryki: wide } = sheets({ observations: overlapping, ...options })
      return wide.rows[0][wide.headers.indexOf('Ratownik – Σ Ratowanie: czas łączny (s)')]
    }

    // sum: dig 10 + 20, pull 10 + 10   |   merged: 10–40 is one stretch (30 s) plus 290–300 (10 s)
    expect(total({ includeCategories: true, mergeCategories: false })).toBe(50)
    expect(total({ includeCategories: true, mergeCategories: true })).toBe(40)
    expect(sheets({ includeCategories: false }).Metryki.headers.some((header) => header.includes('Σ'))).toBe(false)
  })

  test('events sheet lists raw events with times, leaving ends blank for points and open events', () => {
    const { Zdarzenia: events } = sheets()
    expect(events.headers).toEqual(['Próba', 'Zwierzę', 'Czynność', 'Typ', 'Start (s)', 'Koniec (s)', 'Czas (s)'])
    expect(events.rows).toHaveLength(5)
    expect(events.rows[0]).toEqual(['A2M1 / Head / 1', 'Ofiara', 'Kopnięcie', 'punktowa', 7, null, null])
    expect(events.rows.find((row) => row[4] === 10)).toEqual(['A2M1 / Head / 1', 'Ratownik', 'Kopanie', 'ciągła', 10, 20, 10])
    expect(events.rows.find((row) => row[4] === 290)).toEqual(['A2M1 / Head / 1', 'Ratownik', 'Ciągnięcie', 'ciągła', 290, null, null])
  })

  test('windows sheet shows the set and the used window and how many events it keeps', () => {
    const custom = [{ ...trials[0], windowStart: 5, windowEnd: 25 }, trials[1]]
    const { 'Okna prób': windows } = sheets({ trials: custom })

    expect(windows.rows[0]).toEqual(['A2M1 / Head / 1', 300, 5, 25, 5, 25, 2, 4])
    expect(windows.rows[1]).toEqual(['A2M1 / Head / 2', null, null, null, 0, 9, 1, 1])
  })

  test('info sheet records the settings and the formulas', () => {
    const { Informacje: info } = sheets({ includeCategories: true, mergeCategories: true })
    const text = (parameter) => info.rows.find((row) => row[0] === parameter)?.[1]

    expect(text('Wyeksportowano')).toEqual(expect.any(String))
    expect(text('Sumy kategorii (Σ)')).toMatch(/^tak/)
    expect(text('Czas scalony')).toMatch(/^tak/)
    expect(text('% po latencji')).toMatch(/długość okna − latencja/)
    expect(sheets({ includeCategories: false }).Informacje.rows.find((row) => row[0] === 'Czas scalony')[1]).toMatch(/^nie/)
  })

  test('handles a project without trials or animals', () => {
    const empty = buildExportSheets({ exportedAt })
    expect(empty).toHaveLength(5)
    expect(empty[0].rows).toEqual([])
    expect(empty[2].rows).toEqual([])
  })

  test('survives a full round trip to a real .xlsx file', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-roundtrip-'))
    const filePath = path.join(directory, 'metryki.xlsx')
    writeWorkbook(filePath, buildExportSheets({ observations, trials, animals, presets, exportedAt }))

    const workbook = XLSX.readFile(filePath, { cellNF: true })
    expect(workbook.SheetNames).toEqual(['Metryki', 'Metryki (długi format)', 'Zdarzenia', 'Okna prób', 'Informacje'])

    const wide = XLSX.utils.sheet_to_json(workbook.Sheets.Metryki)
    expect(wide).toHaveLength(2)
    expect(wide[0]['Próba']).toBe('A2M1 / Head / 1')
    expect(wide[0]['Ratownik – Kopanie: latencja (s)']).toBe(10)
    expect(wide[0]['Ratownik – Kopanie: % okna']).toBeCloseTo(10 / 300 * 100)
    expect(wide[1]['Ratownik – Ciągnięcie: latencja (s)']).toBeUndefined()
    const latencyColumn = XLSX.utils.encode_col(Object.keys(wide[0]).indexOf('Ratownik – Kopanie: latencja (s)'))
    expect(workbook.Sheets.Metryki[`${latencyColumn}2`].z).toBe('0.000')
    fs.rmSync(directory, { recursive: true, force: true })
  })

  test('suggests a dated file name', () => {
    expect(suggestExportName('Mrowki-2026', new Date(2026, 9, 8))).toBe('Mrowki-2026_metryki_2026-10-08.xlsx')
    expect(suggestExportName('', new Date(2026, 0, 3))).toBe('projekt_metryki_2026-01-03.xlsx')
  })
})

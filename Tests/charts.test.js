/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { blockRows, boxStats, buildBlocks, buildChartData, parseValueBlock, previewRows, summarize, yAxisLabel } from '../public/scripts/workspace/charts/chart-model.js'
import { niceScale, renderChartSvg } from '../public/scripts/workspace/charts/chart-svg.js'
import { createChartsModule } from '../public/scripts/workspace/charts/charts-module.js'

const groups = [{ id: 'g1', name: 'Aphaenogaster' }, { id: 'g2', name: 'Messor' }]
const animals = [
  { id: 'a1', groupId: 'g1', name: 'A1', etogramPresetId: 'p' },
  { id: 'a2', groupId: 'g1', name: 'A2', etogramPresetId: 'p' },
  { id: 'm1', groupId: 'g2', name: 'M1', etogramPresetId: 'p' }
]
const trials = [{ id: 't1', name: 'Test 1', duration: 100, skips: [] }, { id: 't2', name: 'Test 2', duration: 100, skips: [] }, { id: 't3', name: 'Test 3', duration: 100, skips: [] }]
const presets = [{ id: 'p', activities: [{ id: 'contact', name: 'Kontakt', continuous: true, category: '' }, { id: 'rescue', name: 'Ratunek', continuous: true, category: '' }, { id: 'poke', name: 'Dotyk', continuous: false, category: '' }] }]
const ev = (id, animalId, trialId, activityId, name, start, end) => ({
  id, animalId, trialId, activityId, activityName: name, activityColor: '#fff', kind: end === undefined ? 'point' : 'interval', start, end: end ?? start, lane: null
})
const observations = [
  ev('1', 'a1', 't1', 'contact', 'Kontakt', 0, 10),
  ev('2', 'a2', 't1', 'contact', 'Kontakt', 20, 25),
  ev('3', 'a1', 't2', 'contact', 'Kontakt', 0, 20),
  ev('4', 'm1', 't1', 'contact', 'Kontakt', 0, 4),
  ev('5', 'm1', 't2', 'poke', 'Dotyk', 5),
  ev('6', 'a1', 't2', 'rescue', 'Ratunek', 30, 40)
]
const source = { observations, trials, animals, groups, presets }
const kontakt = (metric) => `value|${metric}|Kontakt`

describe('chart numbers', () => {
  test('offers behaviors x measures, and no time measures for point behaviors', () => {
    const { values, groupings } = buildBlocks(source)
    expect(values.some((block) => block.id === kontakt('duration'))).toBe(true)
    expect(values.filter((block) => block.behavior === 'Dotyk').map((block) => block.metric.id)).toEqual(['count', 'latency', 'present'])
    expect(groupings.map((item) => item.id)).toEqual(['group', 'animal', 'trial'])
    expect(parseValueBlock('value|count|Ratunek')).toMatchObject({ behavior: 'Ratunek', metric: { id: 'count' } })
    expect(parseValueBlock('nonsense')).toBeNull()
  })

  test('one value per trial and group: the animals of a group are combined, only observed pairs count', () => {
    const data = buildChartData(source, { valueIds: [kontakt('duration')], grouping: 'group', aggregate: 'mean', kind: 'bar' })
    expect(data.categories).toEqual(['Aphaenogaster', 'Messor'])
    const [aphaenogaster, messor] = data.series[0].points
    // trial 1: 10 + 5 = 15 (two animals), trial 2: 20 -> mean 17.5 (trial 3 was not observed)
    expect(aphaenogaster).toMatchObject({ n: 2, value: 17.5 })
    expect(aphaenogaster.se).toBeCloseTo(Math.sqrt(((15 - 17.5) ** 2 + (20 - 17.5) ** 2) / 1 / 2))
    expect(messor).toMatchObject({ n: 2, value: 2, se: expect.any(Number) })
  })

  test('percent of trials with the behavior, per animal and without grouping', () => {
    const percent = buildChartData(source, { valueIds: [kontakt('present')], grouping: 'group', aggregate: 'percent', kind: 'bar' })
    expect(percent.series[0].points.map((point) => point.value)).toEqual([100, 50])

    const all = buildChartData(source, { valueIds: ['value|count|Ratunek'], grouping: null, aggregate: 'sum', kind: 'bar' })
    expect(all.categories).toEqual(['Wszystko'])
    expect(all.series[0].points[0].value).toBe(1)

    const perAnimal = buildChartData(source, { valueIds: [kontakt('duration')], grouping: 'animal', aggregate: 'mean', kind: 'bar' })
    expect(perAnimal.categories).toEqual(['A1', 'A2', 'M1'])
  })

  test('summaries: mean with SE, median, sum, quartiles', () => {
    expect(summarize([2, 4, 6], 'mean')).toMatchObject({ value: 4, se: expect.closeTo(1.1547, 3) })
    expect(summarize([5], 'mean').se).toBeNull()
    expect(summarize([1, 9, 2], 'median').value).toBe(2)
    expect(summarize([1, 2, 3], 'sum').value).toBe(6)
    expect(summarize([], 'mean').value).toBeNull()
    expect(boxStats([1, 2, 3, 4, 5, 6, 7, 100])).toMatchObject({ median: 4.5, q1: 2.5, q3: 6.5, max: 7, outliers: [100] })
    expect(previewRows(buildChartData(source, { valueIds: [kontakt('duration')], grouping: 'group', kind: 'box' }), 'box')[0]).toHaveLength(8)
  })

  test('latency only counts trials where the behavior happened, and a block can be previewed', () => {
    const data = buildChartData(source, { valueIds: [kontakt('latency')], grouping: 'group', aggregate: 'mean', kind: 'bar' })
    expect(data.series[0].points[0].n).toBe(2)
    expect(blockRows(source, kontakt('duration'))).toContainEqual(['Test 1', 'A1', 10])
    expect(yAxisLabel(buildChartData(source, { valueIds: [kontakt('duration')], grouping: 'group', aggregate: 'mean', kind: 'bar' }), 'bar')).toBe('średni czas łączny [s]')
  })
})

describe('chart drawing', () => {
  test('nice axis steps', () => {
    expect(niceScale(148)).toEqual({ max: 150, step: 50 })
    expect(niceScale(0)).toEqual({ max: 1, step: 0.2 })
  })

  test('draws bars, error bars, labels and a reference line as SVG', () => {
    const data = buildChartData(source, { valueIds: [kontakt('duration')], grouping: 'group', aggregate: 'mean', kind: 'bar' })
    const svg = renderChartSvg(data, { kind: 'bar', title: 'Kontakt (±SE)', yLabel: 'czas [s]', referenceLine: 10 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Kontakt (±SE)')
    expect(svg).toContain('Aphaenogaster')
    expect(svg).toContain('stroke-dasharray')
    expect((svg.match(/<rect /g) || []).length).toBeGreaterThanOrEqual(3)

    const percent = renderChartSvg(buildChartData(source, { valueIds: [kontakt('present')], grouping: 'group', aggregate: 'percent', kind: 'bar' }), { kind: 'bar' })
    expect(percent).toContain('100%')
    const box = renderChartSvg(buildChartData(source, { valueIds: [kontakt('duration')], grouping: 'group', kind: 'box' }), { kind: 'box' })
    expect(box).toContain('stroke-width="2.5"')
  })
})

describe('charts screen', () => {
  let store
  const trialCatalog = { getData: () => ({ trials }) }
  const animalCatalog = { getData: () => ({ animals, groups }), getPresets: () => presets }

  beforeEach(() => {
    document.body.innerHTML = '<div id="charts-module"></div>'
    localStorage.clear()
    store = { getAll: () => observations, subscribe: jest.fn() }
  })

  const open = () => {
    const module = createChartsModule()
    module.init('charts-module', { observationStore: store, animalCatalog, trialCatalog, projectName: 'Study' })
    return module
  }
  const drop = (zone, id) => {
    const event = new Event('drop', { bubbles: true, cancelable: true })
    event.dataTransfer = { getData: () => id }
    document.querySelector(`[data-zone="${zone}"]`).dispatchEvent(event)
  }

  test('starts empty, shows the blocks and filters them with the search box', () => {
    open()
    expect(document.querySelector('.charts-canvas.empty').textContent).toContain('Przeciągnij czynność')
    expect(document.querySelectorAll('.chart-behavior')).toHaveLength(3)

    const search = document.querySelector('[data-search]')
    search.value = 'ratun'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    expect([...document.querySelectorAll('.chart-behavior summary')].map((node) => node.textContent)).toEqual(['Ratunek'])
  })

  test('dropping a behavior and a grouping draws the chart, and the choice is remembered', () => {
    open()
    drop('values', kontakt('duration'))
    expect(document.querySelector('.charts-canvas svg')).not.toBeNull()
    expect(document.querySelector('.charts-canvas svg').textContent).toContain('Wszystko')

    drop('grouping', 'grouping|group')
    expect(document.querySelector('.charts-canvas svg').textContent).toContain('Aphaenogaster')
    expect(document.querySelector('.charts-canvas svg').textContent).toContain('Kontakt (±SE)')
    expect(document.querySelectorAll('.charts-preview tbody tr')).toHaveLength(2)

    drop('values', 'grouping|group')
    expect(document.querySelectorAll('.charts-zone[data-zone="values"] .chart-chip.placed')).toHaveLength(1)

    document.body.innerHTML = '<div id="charts-module"></div>'
    open()
    expect(document.querySelector('.charts-canvas svg').textContent).toContain('Aphaenogaster')
  })

  test('clicking a block adds it, the type buttons switch to a box plot, and blocks can be removed', () => {
    open()
    document.querySelector(`[data-block-id="${kontakt('duration')}"]`).click()
    document.querySelector('[data-block-id="grouping|group"]').click()
    document.querySelector('[data-kind="box"]').click()
    expect(document.querySelector('.charts-canvas svg').innerHTML).toContain('stroke-width="2.5"')
    expect(document.querySelector('[data-aggregate]').closest('label').hidden).toBe(true)

    document.querySelector('[data-remove]').click()
    expect(document.querySelector('.charts-canvas.empty')).not.toBeNull()
  })

  test('the eye button shows the raw numbers of a block', () => {
    open()
    document.querySelector(`[data-peek="${kontakt('duration')}"]`).click()
    expect(document.querySelector('.charts-preview').textContent).toContain('Test 1')
    document.querySelector('[data-close-peek]').click()
    expect(document.querySelector('.charts-preview').textContent).not.toContain('Dane bloku')
  })
})

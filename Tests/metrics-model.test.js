import {
  aggregateMetrics,
  buildMetricRows,
  computeBehaviorMetrics,
  computeMergedMetrics,
  hasCategoryGroups,
  resolveWindow,
  summarizeTrialWindow
} from '../public/scripts/workspace/data/metrics-model.js'

const interval = (id, start, end, extra = {}) => ({
  id, animalId: 'rescuer', activityId: 'dig', activityName: 'Kopanie', activityColor: '#42a56b',
  kind: 'interval', start, end, lane: null, trialId: 't1', ...extra
})
const point = (id, start, extra = {}) => interval(id, start, start, { kind: 'point', ...extra })
const window300 = { start: 0, end: 300, length: 300, source: 'video' }

describe('Analysis window', () => {
  test('prefers a custom window, then the video length, then the latest event', () => {
    expect(resolveWindow({ duration: 300, windowStart: 10, windowEnd: 100 })).toEqual({ start: 10, end: 100, length: 90, source: 'custom' })
    expect(resolveWindow({ duration: 300 })).toEqual({ start: 0, end: 300, length: 300, source: 'video' })
    expect(resolveWindow({ duration: 300, windowStart: 60 })).toMatchObject({ start: 60, end: 300, length: 240 })
    expect(resolveWindow({}, [interval('a', 5, 40), point('b', 50), interval('c', 70, null)])).toEqual({ start: 0, end: 70, length: 70, source: 'events' })
    expect(resolveWindow({}, [])).toMatchObject({ length: 0 })
  })
})

describe('Behavior metrics', () => {
  test('counts occurrences, adds up durations and measures latency and both percentages', () => {
    const metrics = computeBehaviorMetrics([interval('a', 10, 20), interval('b', 50, 65)], window300)
    expect(metrics).toMatchObject({ present: true, count: 2, duration: 25, latency: 10 })
    expect(metrics.percentOfWindow).toBeCloseTo(25 / 300 * 100)
    // the spreadsheet formula: duration / (300 - first) * 100
    expect(metrics.percentAfterLatency).toBeCloseTo(25 / (300 - 10) * 100)
  })

  test('reports an absent behavior as not present with no latency', () => {
    expect(computeBehaviorMetrics([], window300)).toMatchObject({
      present: false, count: 0, duration: 0, latency: null, percentOfWindow: 0, percentAfterLatency: null
    })
  })

  test('closes open intervals at the window end and treats point events as count-only', () => {
    const metrics = computeBehaviorMetrics([interval('open', 280, null), point('p', 100)], window300)
    expect(metrics).toMatchObject({ count: 2, duration: 20, latency: 100 })
  })

  test('clips events to the window and ignores the ones outside it', () => {
    const custom = { start: 100, end: 200, length: 100, source: 'custom' }
    const metrics = computeBehaviorMetrics([
      interval('before', 10, 50),
      interval('crossing-start', 90, 120),
      interval('inside', 130, 140),
      interval('crossing-end', 190, 250),
      interval('after', 260, 280),
      point('point-before', 99),
      point('point-inside', 150)
    ], custom)

    expect(metrics).toMatchObject({ count: 4, duration: 20 + 10 + 10, latency: 0 })
    expect(computeBehaviorMetrics([interval('x', 10, 50)], custom).present).toBe(false)
  })

  test('does not divide by zero when the first occurrence is at the very end', () => {
    const metrics = computeBehaviorMetrics([interval('late', 300, 300)], window300)
    expect(metrics.latency).toBe(300)
    expect(metrics.percentAfterLatency).toBeNull()
    expect(computeBehaviorMetrics([point('p', 5)], { start: 0, end: 0, length: 0, source: 'events' }).percentOfWindow).toBeNull()
  })
})

describe('Category totals', () => {
  test('sums counts and durations, keeps the earliest latency and any presence', () => {
    const dig = computeBehaviorMetrics([interval('a', 20, 30), interval('b', 40, 45)], window300)
    const pull = computeBehaviorMetrics([interval('c', 10, 16)], window300)
    const bite = computeBehaviorMetrics([], window300)

    const total = aggregateMetrics([dig, pull, bite], window300)
    expect(total).toMatchObject({ present: true, count: 3, duration: 21, latency: 10 })
    expect(total.percentAfterLatency).toBeCloseTo(21 / 290 * 100)
    expect(aggregateMetrics([bite], window300)).toMatchObject({ present: false, count: 0, latency: null })
  })
})

describe('Merged time', () => {
  test('counts overlapping and touching intervals once, as separate episodes', () => {
    const events = [
      interval('a', 10, 20),
      interval('b', 15, 25),
      interval('c', 25, 30),
      interval('d', 50, 60),
      interval('e', 52, 54)
    ]
    const merged = computeMergedMetrics(events, window300)
    expect(merged).toMatchObject({ count: 2, duration: 30, latency: 10 })
    // the plain sum counts the overlaps twice
    const summed = aggregateMetrics(events.map((item) => computeBehaviorMetrics([item], window300)), window300)
    expect(summed).toMatchObject({ count: 5, duration: 10 + 10 + 5 + 10 + 2 })
  })

  test('adds point events to the episodes, clips to the window, and handles an empty list', () => {
    const custom = { start: 100, end: 200, length: 100, source: 'custom' }
    const merged = computeMergedMetrics([
      interval('crossing', 90, 120),
      interval('overlap', 110, 130),
      point('p', 150),
      interval('outside', 10, 20)
    ], custom)
    expect(merged).toMatchObject({ count: 2, duration: 30, latency: 0 })
    expect(computeMergedMetrics([], window300)).toMatchObject({ present: false, count: 0, duration: 0, latency: null })
  })
})

describe('Category helpers', () => {
  test('detects whether any animal has two behaviors in one real category', () => {
    const animals = [{ id: 'a', etogramPresetId: 'p1' }, { id: 'b', etogramPresetId: 'p2' }]
    const withGroup = [{ id: 'p1', activities: [{ id: '1', category: 'Ratowanie' }, { id: '2', category: 'Ratowanie' }] }]
    const single = [{ id: 'p1', activities: [{ id: '1', category: 'Ratowanie' }, { id: '2', category: 'Inne' }, { id: '3', category: '' }] }]
    const uncategorized = [{ id: 'p1', activities: [{ id: '1', category: 'Bez kategorii' }, { id: '2', category: 'Bez kategorii' }] }]

    expect(hasCategoryGroups(animals, withGroup)).toBe(true)
    expect(hasCategoryGroups(animals, single)).toBe(false)
    expect(hasCategoryGroups(animals, uncategorized)).toBe(false)
    expect(hasCategoryGroups([], [])).toBe(false)
  })

  test('summarizes how many events a trial window keeps', () => {
    const observations = [interval('a', 10, 20), interval('b', 100, 120), interval('c', 250, 260), interval('x', 1, 2, { trialId: 'other' })]
    expect(summarizeTrialWindow(observations, { id: 't1', duration: 300 })).toMatchObject({ total: 3, inside: 3 })
    expect(summarizeTrialWindow(observations, { id: 't1', duration: 300, windowStart: 90, windowEnd: 130 })).toMatchObject({
      total: 3,
      inside: 1,
      window: { start: 90, end: 130, length: 40 }
    })
  })
})

describe('Metric rows', () => {
  const trials = [{ id: 't1', name: 'Próba 1', duration: 300 }, { id: 't2', name: 'Próba 2' }]
  const animals = [{ id: 'rescuer', name: 'Ratownik', etogramPresetId: 'p-rescuer' }, { id: 'victim', name: 'Ofiara', etogramPresetId: 'p-victim' }]
  const presets = [
    { id: 'p-rescuer', activities: [
      { id: 'contact', name: 'Kontakt', continuous: true, category: 'Bez kategorii' },
      { id: 'dig', name: 'Kopanie', continuous: true, category: 'Ratowanie' },
      { id: 'pull', name: 'Ciągnięcie', continuous: true, category: 'Ratowanie' }
    ] },
    { id: 'p-victim', activities: [{ id: 'kick', name: 'Kopnięcie', continuous: false, category: 'Aktywność' }] }
  ]
  const observations = [
    interval('d1', 10, 20),
    interval('p1', 30, 40, { activityId: 'pull', activityName: 'Ciągnięcie' }),
    interval('c2', 5, 9, { trialId: 't2' }),
    point('k1', 7, { animalId: 'victim', activityId: 'kick', activityName: 'Kopnięcie' }),
    interval('ghost', 1, 2, { activityId: 'removed', activityName: 'Usunięta czynność' })
  ]

  test('builds every trial x animal x behavior, adds category totals, and includes behaviors removed from the etogram', () => {
    const rows = buildMetricRows(observations, { trials, animals, presets })

    const firstTrial = rows.filter((row) => row.trialId === 't1')
    expect(firstTrial.map((row) => `${row.animalName}:${row.name}`)).toEqual([
      'Ratownik:Kontakt', 'Ratownik:Kopanie', 'Ratownik:Ciągnięcie', 'Ratownik:Usunięta czynność', 'Ratownik:Σ Ratowanie',
      'Ofiara:Kopnięcie'
    ])
    expect(firstTrial.find((row) => row.name === 'Σ Ratowanie')).toMatchObject({ kind: 'category', count: 2, duration: 20, latency: 10, members: 2 })
    expect(firstTrial.find((row) => row.name === 'Kontakt').present).toBe(false)
    expect(firstTrial.find((row) => row.name === 'Kopnięcie')).toMatchObject({ count: 1, duration: 0, latency: 7 })

    const secondTrial = rows.filter((row) => row.trialId === 't2')
    expect(secondTrial.find((row) => row.name === 'Kontakt').count).toBe(0)
    expect(secondTrial.find((row) => row.name === 'Kopanie')).toMatchObject({ count: 1, duration: 4, latency: 5 })
    expect(secondTrial[0].window.source).toBe('events')
  })

  test('counts overlapping behaviors of a category once when merged time is requested', () => {
    const overlapping = [
      interval('d1', 10, 30),
      interval('p1', 20, 40, { activityId: 'pull', activityName: 'Ciągnięcie' })
    ]
    const total = (options) => buildMetricRows(overlapping, { trials, animals, presets, trialFilter: 't1', ...options })
      .find((row) => row.name === 'Σ Ratowanie')

    expect(total({})).toMatchObject({ count: 2, duration: 40 })
    expect(total({ mergeCategories: true })).toMatchObject({ count: 1, duration: 30, latency: 10 })
  })

  test('filters by trial and animal and can leave out category totals', () => {
    expect(new Set(buildMetricRows(observations, { trials, animals, presets, trialFilter: 't2' }).map((row) => row.trialId))).toEqual(new Set(['t2']))
    expect(new Set(buildMetricRows(observations, { trials, animals, presets, animalFilter: 'victim' }).map((row) => row.animalId))).toEqual(new Set(['victim']))
    expect(buildMetricRows(observations, { trials, animals, presets, includeCategories: false }).some((row) => row.kind === 'category')).toBe(false)
  })
})

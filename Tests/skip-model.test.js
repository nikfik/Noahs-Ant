import { excludedRanges, mergeRanges, normalizeSkips, overlapWith, skipAt } from '../public/scripts/workspace/trials/skip-model.js'
import { normalizeTrialData } from '../public/scripts/workspace/trials/trial-model.js'

describe('skip model', () => {
  test('keeps valid skips in time order and defaults to not counting the time', () => {
    const skips = normalizeSkips([
      { id: 'b', start: 50, end: 60 },
      { id: 'a', start: 10, end: 20, countTime: true },
      { id: 'bad', start: 5, end: 5 },
      { id: 'neg', start: -1, end: 4 },
      { id: 'a', start: 70, end: 80 },
      null
    ])
    expect(skips).toEqual([
      { id: 'a', start: 10, end: 20, countTime: true },
      { id: 'b', start: 50, end: 60, countTime: false }
    ])
    expect(normalizeSkips('nope')).toEqual([])
  })

  test('trials carry their skips', () => {
    const data = normalizeTrialData({ trials: [{ id: 't', skips: [{ id: 's', start: 1, end: 2 }] }] })
    expect(data.trials[0].skips).toHaveLength(1)
    expect(normalizeTrialData({ trials: [{ id: 't' }] }).trials[0].skips).toEqual([])
  })

  test('finds the skip at a time (end excluded)', () => {
    const skips = [{ start: 10, end: 20 }]
    expect(skipAt(skips, 10)).toBe(skips[0])
    expect(skipAt(skips, 20)).toBeNull()
  })

  test('range helpers merge overlaps and measure overlap', () => {
    expect(mergeRanges([[5, 8], [1, 3], [2, 4]])).toEqual([[1, 4], [5, 8]])
    expect(excludedRanges([{ start: 0, end: 10, countTime: false }, { start: 20, end: 30, countTime: true }], 5, 50)).toEqual([[5, 10]])
    expect(overlapWith([[1, 4], [5, 8]], 3, 6)).toBe(2)
  })
})

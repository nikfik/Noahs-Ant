import {
  createTrial,
  ensureDefaultTrial,
  getActiveTrial,
  nextTrialName,
  normalizeTrialData,
  removeTrial,
  setActiveTrial,
  updateTrial
} from '../public/scripts/workspace/trials/trial-model.js'

describe('Trial model', () => {
  test('normalizes invalid input, duplicate ids and a missing active trial', () => {
    expect(normalizeTrialData(null)).toEqual({ version: 1, activeTrialId: null, trials: [] })

    const data = normalizeTrialData({
      activeTrialId: 'missing',
      trials: [{ id: 'a', name: '  ', videoPath: 5 }, { id: 'a', name: 'duplicate' }, 'junk', { id: 'b', name: 'B', videoPath: 'b.mp4' }]
    })

    expect(data.trials).toEqual([
      { id: 'a', name: 'Bez nazwy', videoPath: '', duration: null, windowStart: null, windowEnd: null },
      { id: 'b', name: 'B', videoPath: 'b.mp4', duration: null, windowStart: null, windowEnd: null }
    ])
    expect(data.activeTrialId).toBe('a')
  })

  test('keeps a valid analysis window and video duration, and drops invalid ones', () => {
    const [valid, inverted, junk] = normalizeTrialData({
      trials: [
        { id: 'v', duration: 300.5, windowStart: 10, windowEnd: 120 },
        { id: 'i', duration: 100, windowStart: 50, windowEnd: 40 },
        { id: 'j', duration: -3, windowStart: -1, windowEnd: 'x' }
      ]
    }).trials

    expect(valid).toMatchObject({ duration: 300.5, windowStart: 10, windowEnd: 120 })
    expect(inverted).toMatchObject({ duration: 100, windowStart: 50, windowEnd: null })
    expect(junk).toMatchObject({ duration: null, windowStart: null, windowEnd: null })
    expect(updateTrial({ trials: [valid] }, 'v', { windowEnd: 5 }).trials[0].windowEnd).toBeNull()
  })

  test('creates a first trial carrying the legacy video path and does not duplicate it', () => {
    const data = ensureDefaultTrial({}, 'C:/videos/legacy.mp4')
    expect(data.trials).toHaveLength(1)
    expect(data.trials[0]).toMatchObject({ name: 'Próba 1', videoPath: 'C:/videos/legacy.mp4' })
    expect(getActiveTrial(data)).toEqual(data.trials[0])
    expect(ensureDefaultTrial(data, 'other.mp4')).toEqual(data)
  })

  test('adds a trial and makes it active, with a unique default name', () => {
    let data = ensureDefaultTrial({})
    data = createTrial(data, '')
    expect(data.trials.map((trial) => trial.name)).toEqual(['Próba 1', 'Próba 2'])
    expect(getActiveTrial(data).name).toBe('Próba 2')
    expect(nextTrialName({ trials: [{ name: 'Próba 2' }, { name: 'x' }] })).toBe('Próba 3')
  })

  test('renames, sets a video, switches and removes trials but keeps at least one', () => {
    let data = createTrial(ensureDefaultTrial({}), 'Druga')
    const [first, second] = data.trials

    data = updateTrial(data, first.id, { name: 'Pierwsza', videoPath: 'one.mp4' })
    expect(data.trials[0]).toMatchObject({ name: 'Pierwsza', videoPath: 'one.mp4' })

    data = setActiveTrial(data, first.id)
    expect(data.activeTrialId).toBe(first.id)
    expect(setActiveTrial(data, 'unknown').activeTrialId).toBe(first.id)

    data = removeTrial(data, first.id)
    expect(data.trials.map((trial) => trial.id)).toEqual([second.id])
    expect(data.activeTrialId).toBe(second.id)
    expect(removeTrial(data, second.id).trials).toHaveLength(1)
  })
})

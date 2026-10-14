import {
  applyEventEdit,
  buildEventRows,
  formatSeconds,
  getAnimalActivities,
  parseTimeInput
} from '../public/scripts/workspace/data/event-table-model.js'

const interval = (id, start, end, extra = {}) => ({
  id, animalId: 'ant-1', activityId: 'run', activityName: 'Bieg', activityColor: '#42a56b',
  kind: 'interval', start, end, lane: 2, trialId: 'trial-1', ...extra
})
const point = (id, start, extra = {}) => interval(id, start, start, { kind: 'point', activityId: 'tap', activityName: 'Dotyk', ...extra })

const presets = [
  { id: 'p-ants', activities: [
    { id: 'run', name: 'Bieg', color: '#42a56b', continuous: true },
    { id: 'tap', name: 'Dotyk', color: '#448aff', continuous: false },
    { id: 'rest', name: 'Odpoczynek', color: '#ffb300', continuous: true }
  ] },
  { id: 'p-victim', activities: [{ id: 'v-run', name: 'Bieg', color: '#ef5350', continuous: true }] },
  { id: 'p-other', activities: [{ id: 'sleep', name: 'Sen', color: '#ab47bc', continuous: true }] }
]
const animals = [
  { id: 'ant-1', name: 'Mrówka 1', etogramPresetId: 'p-ants' },
  { id: 'ant-2', name: 'Ofiara', etogramPresetId: 'p-victim' },
  { id: 'ant-3', name: 'Inna', etogramPresetId: 'p-other' }
]
const trials = [{ id: 'trial-1', name: 'Próba 1' }, { id: 'trial-2', name: 'Próba 2' }]
const context = {
  animals,
  trials,
  getActivities: (animalId) => getAnimalActivities(animals.find((animal) => animal.id === animalId), presets)
}

describe('Time input helpers', () => {
  test('parses seconds, comma decimals and m:ss.f, and rejects invalid text', () => {
    expect(parseTimeInput('12.5')).toBe(12.5)
    expect(parseTimeInput(' 12,5 ')).toBe(12.5)
    expect(parseTimeInput('1:02.5')).toBeCloseTo(62.5)
    expect(parseTimeInput('75:10')).toBe(4510)
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput('abc')).toBeNaN()
    expect(parseTimeInput('-3')).toBeNaN()
    expect(formatSeconds(1.23456)).toBe('1.235')
    expect(formatSeconds(null)).toBe('')
  })
})

describe('Event rows', () => {
  test('filters by trial and animal, sorts by trial then start, and computes durations', () => {
    const observations = [
      interval('c', 5, 9, { trialId: 'trial-2' }),
      interval('b', 4, null),
      point('a', 1),
      interval('d', 2, 3, { animalId: 'ant-2', activityId: 'v-run' })
    ]
    const all = buildEventRows(observations, { trials, animals })
    expect(all.map((row) => row.id)).toEqual(['a', 'd', 'b', 'c'])
    expect(all.find((row) => row.id === 'c')).toMatchObject({ trialName: 'Próba 2', animalName: 'Mrówka 1', duration: 4 })
    expect(all.find((row) => row.id === 'b').duration).toBeNull()
    expect(all.find((row) => row.id === 'a').duration).toBeNull()

    expect(buildEventRows(observations, { trials, animals, trialFilter: 'trial-2' }).map((row) => row.id)).toEqual(['c'])
    expect(buildEventRows(observations, { trials, animals, animalFilter: 'ant-2' }).map((row) => row.id)).toEqual(['d'])
  })
})

describe('Editing events', () => {
  test('changes times, keeps points consistent, and never mutates the original data', () => {
    const observations = [interval('a', 2, 90), point('p', 3)]
    const frozen = JSON.stringify(observations)

    expect(applyEventEdit(observations, 'a', 'start', '1:00', context).observations[0]).toMatchObject({ start: 60, end: 90, lane: null })
    expect(applyEventEdit(observations, 'a', 'start', '4', context).observations[0]).toMatchObject({ start: 4, end: 90 })
    expect(applyEventEdit(observations, 'p', 'start', '7.5', context).observations[1]).toMatchObject({ start: 7.5, end: 7.5 })
    expect(applyEventEdit(observations, 'a', 'end', '95', context).observations[0].end).toBe(95)
    expect(applyEventEdit(observations, 'a', 'end', '', context).observations[0].end).toBeNull()
    expect(JSON.stringify(observations)).toBe(frozen)
  })

  test('rejects impossible times with a message', () => {
    const observations = [interval('a', 2, 5), point('p', 3)]
    expect(applyEventEdit(observations, 'a', 'start', '6', context).error).toMatch(/późniejszy/)
    expect(applyEventEdit(observations, 'a', 'end', '1', context).error).toMatch(/wcześniejszy/)
    expect(applyEventEdit(observations, 'a', 'start', 'abc', context).error).toMatch(/poprawny/)
    expect(applyEventEdit(observations, 'a', 'start', '', context).error).toMatch(/poprawny/)
    expect(applyEventEdit(observations, 'p', 'end', '4', context).error).toMatch(/punktowe/)
    expect(applyEventEdit(observations, 'missing', 'start', '1', context).error).toMatch(/Nie znaleziono/)
    expect(applyEventEdit(observations, 'a', 'color', 'red', context).error).toMatch(/nie można/)
  })

  test('changes the behavior only to one of the same type from the animal etogram', () => {
    const observations = [interval('a', 2, 5), point('p', 3)]
    const changed = applyEventEdit(observations, 'a', 'activityId', 'rest', context)
    expect(changed.observations[0]).toMatchObject({ activityId: 'rest', activityName: 'Odpoczynek', activityColor: '#ffb300', lane: 2 })
    expect(applyEventEdit(observations, 'a', 'activityId', 'tap', context).error).toMatch(/tego samego typu/)
    expect(applyEventEdit(observations, 'a', 'activityId', 'nope', context).error).toMatch(/nie ma takiej/)
  })

  test('moves an event to another animal by id or by matching behavior name, and refuses when none fits', () => {
    const observations = [interval('a', 2, 5)]
    const toVictim = applyEventEdit(observations, 'a', 'animalId', 'ant-2', context)
    expect(toVictim.observations[0]).toMatchObject({ animalId: 'ant-2', activityId: 'v-run', activityName: 'Bieg', activityColor: '#ef5350' })
    expect(applyEventEdit(observations, 'a', 'animalId', 'ant-3', context).error).toMatch(/Inna nie ma czynności „Bieg”/)
    expect(applyEventEdit(observations, 'a', 'animalId', 'ghost', context).error).toMatch(/zwierzęcia/)
  })

  test('moves an event to another existing trial only', () => {
    const observations = [interval('a', 2, 5)]
    expect(applyEventEdit(observations, 'a', 'trialId', 'trial-2', context).observations[0].trialId).toBe('trial-2')
    expect(applyEventEdit(observations, 'a', 'trialId', 'trial-9', context).error).toMatch(/próby/)
  })
})

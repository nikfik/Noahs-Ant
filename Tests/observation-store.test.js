import { jest } from '@jest/globals'
import { createObservationStore } from '../public/scripts/workspace/observations/observation-store.js'

const event = (id, start, end, trialId = 'trial-1') => ({
  id, animalId: 'ant-1', activityId: 'run', activityName: 'Bieg', activityColor: '#42a56b',
  kind: 'interval', start, end, lane: null, trialId
})

function createApi(stored = []) {
  return {
    getProjectObservations: jest.fn().mockResolvedValue({ observations: stored }),
    saveProjectObservations: jest.fn(async (_projectId, data) => data)
  }
}

describe('Observation store', () => {
  test('loads normalized observations and filters them per trial', async () => {
    const api = createApi([event('a', 1, 2), event('b', 3, 4, 'trial-2'), { id: 'bad', start: 5, end: 1 }])
    const store = createObservationStore({ projectId: 'Study', api })
    const listener = jest.fn()
    store.subscribe(listener)

    await store.load()
    expect(store.getAll().map((item) => item.id)).toEqual(['a', 'b'])
    expect(store.getForTrial('trial-2').map((item) => item.id)).toEqual(['b'])
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ reason: 'load' }))
    expect(store.canUndo()).toBe(false)
  })

  test('survives a failing load and an unsubscribed listener stays silent', async () => {
    const api = createApi()
    api.getProjectObservations.mockRejectedValue(new Error('disk'))
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const store = createObservationStore({ projectId: 'Study', api })
    const listener = jest.fn()
    store.subscribe(listener)()

    await store.load()
    expect(store.getAll()).toEqual([])
    expect(listener).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  test('commits with history and saves every change in order, then undoes and redoes', async () => {
    const api = createApi()
    const store = createObservationStore({ projectId: 'Study', api })
    await store.load()

    await store.commit([event('a', 1, 2)])
    await store.commit([event('a', 1, 2), event('b', 3, 4)])
    expect(api.saveProjectObservations).toHaveBeenCalledTimes(2)
    expect(api.saveProjectObservations.mock.calls[1][1].observations).toHaveLength(2)
    expect(store.canUndo()).toBe(true)

    await store.undo()
    expect(store.getAll().map((item) => item.id)).toEqual(['a'])
    expect(store.canRedo()).toBe(true)
    expect(api.saveProjectObservations.mock.calls[2][1].observations).toHaveLength(1)

    await store.redo()
    expect(store.getAll()).toHaveLength(2)

    await store.undo()
    await store.commit([])
    expect(store.canRedo()).toBe(false)
  })

  test('previews a drag without saving and records one history step when it finishes', async () => {
    const api = createApi([event('a', 1, 2)])
    const store = createObservationStore({ projectId: 'Study', api })
    const listener = jest.fn()
    await store.load()
    store.subscribe(listener)

    const before = store.snapshot()
    store.preview([{ ...event('a', 2, 3) }])
    store.preview([{ ...event('a', 3, 4) }])
    expect(api.saveProjectObservations).not.toHaveBeenCalled()
    expect(listener.mock.calls.map(([change]) => change.reason)).toEqual(['preview', 'preview'])

    await store.finishPreview(before)
    expect(api.saveProjectObservations).toHaveBeenCalledTimes(1)
    expect(store.getAll()[0].start).toBe(3)

    await store.undo()
    expect(store.getAll()[0].start).toBe(1)
  })

  test('drops the events of a removed trial and clears undo history', async () => {
    const api = createApi([event('a', 1, 2), event('b', 3, 4, 'trial-2')])
    const store = createObservationStore({ projectId: 'Study', api })
    await store.load()
    await store.commit([...store.getAll(), event('c', 5, 6)])

    await store.removeTrialEvents('trial-2')
    expect(store.getAll().map((item) => item.id)).toEqual(['a', 'c'])
    expect(store.canUndo()).toBe(false)
    expect(api.saveProjectObservations).toHaveBeenLastCalledWith('Study', expect.objectContaining({
      observations: [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'c' })]
    }))
  })

  test('works without a project or API (nothing is saved)', async () => {
    const store = createObservationStore()
    await store.load()
    await store.commit([event('a', 1, 2)])
    expect(store.getAll()).toHaveLength(1)
  })
})

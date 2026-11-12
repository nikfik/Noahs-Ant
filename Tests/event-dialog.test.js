/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { askEventTimes } from '../public/scripts/workspace/observations/event-dialog.js'
import { createTimelineModule } from '../public/scripts/workspace/workspace-timeline-module.js'
import { createObservationStore } from '../public/scripts/workspace/observations/observation-store.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const dialog = () => document.querySelector('.event-modal')
const field = (name) => dialog().querySelector(`[data-event="${name}"]`)

describe('event times dialog', () => {
  afterEach(() => { document.body.innerHTML = '' })

  test('an interval asks for the start and the end, and an empty end means it is still running', async () => {
    const answer = askEventTimes({ title: 'Bieg', subtitle: 'Mrówka', start: 12.48, end: 20, duration: 100 })
    expect(dialog().classList.contains('modal')).toBe(true)
    expect(dialog().textContent).toContain('Bieg')
    expect(dialog().textContent).toContain('Mrówka')
    expect(field('start').value).toBe('12.480')

    field('start').value = '0:15'
    field('end').value = ''
    dialog().querySelector('form').requestSubmit()
    await expect(answer).resolves.toEqual({ type: 'save', start: 15, end: null })
    expect(dialog()).toBeNull()
  })

  test('a point event asks for one moment only', async () => {
    const answer = askEventTimes({ title: 'Kropa', kind: 'point', start: 5, end: 5 })
    expect(field('end')).toBeNull()
    expect(dialog().textContent).toContain('Moment (s)')
    field('start').value = '7,5'
    dialog().querySelector('form').requestSubmit()
    await expect(answer).resolves.toEqual({ type: 'save', start: 7.5, end: 7.5 })
  })

  test('wrong values are explained and nothing is saved', async () => {
    const answer = askEventTimes({ title: 'Bieg', start: 10, end: 20, duration: 60 })
    const submit = () => dialog().querySelector('form').requestSubmit()
    const message = () => dialog().querySelector('.skip-dialog-error')

    field('start').value = 'abc'
    submit()
    expect(message().hidden).toBe(false)
    expect(message().textContent).toContain('poprawny czas')

    field('start').value = '30'
    field('end').value = '20'
    submit()
    expect(message().textContent).toContain('nie może być wcześniejszy')

    field('end').value = '90'
    submit()
    expect(message().textContent).toContain('poza długością filmu')

    field('end').value = 'x'
    submit()
    expect(message().textContent).toContain('końca')

    field('end').value = '40'
    submit()
    await expect(answer).resolves.toEqual({ type: 'save', start: 30, end: 40 })
  })

  test('can delete, cancel and close with Escape', async () => {
    const deleted = askEventTimes({ title: 'Bieg' })
    dialog().querySelector('[data-event-delete]').click()
    await expect(deleted).resolves.toEqual({ type: 'delete' })

    const cancelled = askEventTimes({ title: 'Bieg' })
    dialog().querySelector('[data-event-cancel]').click()
    await expect(cancelled).resolves.toBeNull()

    const escaped = askEventTimes({ title: 'Bieg' })
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(escaped).resolves.toBeNull()
  })
})

describe('pressing an event twice on the timeline', () => {
  let store

  async function open(observations) {
    document.body.innerHTML = '<div id="events-module"></div>'
    window.electronAPI = {
      getProjectObservations: jest.fn().mockResolvedValue({ version: 1, observations }),
      saveProjectObservations: jest.fn(async (_id, data) => data),
      getAppSettings: jest.fn().mockResolvedValue({})
    }
    store = createObservationStore({ projectId: 'Study', api: window.electronAPI })
    await store.load()
    const animal = { id: 'a1', name: 'Mrówka', color: '#42a56b' }
    await createTimelineModule().init('events-module', {
      animalCatalog: { getData: () => ({ animals: [animal], activeAnimalId: animal.id }) },
      trialCatalog: { getActiveTrial: () => ({ id: 't1' }) },
      observationStore: store
    })
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 0, duration: 100, paused: true } }))
  }

  const base = { animalId: 'a1', trialId: 't1', activityId: 'run', activityName: 'Bieg', activityColor: '#42a56b', lane: null }
  const press = async () => {
    document.querySelector('.timeline-event').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    window.dispatchEvent(new MouseEvent('pointerup'))
    await flush()
  }

  test('opens the times of the event, and saving changes them', async () => {
    await open([{ ...base, id: 'e1', kind: 'interval', start: 10, end: 20 }])
    await press()
    expect(dialog()).toBeNull()
    await press()
    expect(dialog()).not.toBeNull()
    expect(dialog().textContent).toContain('Bieg')
    expect(dialog().textContent).toContain('Mrówka')

    field('start').value = '12.5'
    field('end').value = '30'
    dialog().querySelector('form').requestSubmit()
    await flush()
    expect(store.getAll()[0]).toMatchObject({ id: 'e1', start: 12.5, end: 30 })
    expect(window.electronAPI.saveProjectObservations).toHaveBeenCalled()
  })

  test('a point event keeps its end equal to its moment, and an event can be deleted from the dialog', async () => {
    await open([{ ...base, id: 'p1', kind: 'point', start: 5, end: 5 }])
    await press()
    await press()
    field('start').value = '8'
    dialog().querySelector('form').requestSubmit()
    await flush()
    expect(store.getAll()[0]).toMatchObject({ start: 8, end: 8 })

    await press()
    await press()
    dialog().querySelector('[data-event-delete]').click()
    await flush()
    expect(store.getAll()).toHaveLength(0)
  })

  test('a single press, or a press that moves the event, does not open the dialog', async () => {
    await open([{ ...base, id: 'e1', kind: 'interval', start: 10, end: 20 }])
    await press()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await press()
    expect(dialog()).toBeNull()
  })
})

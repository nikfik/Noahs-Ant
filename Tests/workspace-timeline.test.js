/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { createTimelineModule, allocateAnimalLanes, toggleObservation } from '../public/scripts/workspace/workspace-timeline-module.js'
import { getObservationDisplayEnd, normalizeObservationData } from '../public/scripts/workspace/observations/observation-model.js'
import { createObservationStore } from '../public/scripts/workspace/observations/observation-store.js'

const request = { activityId: 'run', activityName: 'Bieg', activityColor: '#42a56b', continuous: true }

function interval(id, start, end, lane = null) {
  return { id, animalId: 'animal-1', activityId: id, activityName: id, activityColor: '#42a56b', kind: 'interval', start, end, lane }
}

describe('Observation timeline model', () => {
  test('keeps an open interval unclosed and applies the agreed display endpoint rule', () => {
    const observation = interval('open', 5, null)
    expect(getObservationDisplayEnd(observation, 8, 12)).toBe(8)
    expect(getObservationDisplayEnd(observation, 2, 12)).toBe(12)
    observation.end = 9
    expect(getObservationDisplayEnd(observation, 2, 12)).toBe(9)
    expect(normalizeObservationData({ observations: [interval('bad', 5, 4)] }).observations).toEqual([])
  })

  test('starts, closes, and adjusts continuous events without creating orphan endpoints', () => {
    let observations = toggleObservation([], request, { animalId: 'animal-1', currentTime: 2, duration: 10 })
    expect(observations[0]).toMatchObject({ kind: 'interval', start: 2, end: null })

    observations = toggleObservation(observations, request, { animalId: 'animal-1', currentTime: 6, duration: 10 })
    expect(observations[0].end).toBe(6)

    observations = toggleObservation(observations, request, { animalId: 'animal-1', currentTime: 4, duration: 10 })
    expect(observations).toHaveLength(1)
    expect(observations[0].end).toBe(4)

    const beforeExistingStart = toggleObservation(observations, request, { animalId: 'animal-1', currentTime: 1, duration: 10 })
    expect(beforeExistingStart).toHaveLength(2)
    expect(beforeExistingStart[1]).toMatchObject({ start: 1, end: null })
  })

  test('creates point events and ignores keyboard repeat', () => {
    const point = { ...request, continuous: false }
    const result = toggleObservation([], point, { animalId: 'animal-1', currentTime: 1.25, duration: 10 })
    expect(result[0]).toMatchObject({ kind: 'point', start: 1.25, end: 1.25 })
    expect(toggleObservation([], point, { animalId: 'animal-1', currentTime: 1.25, duration: 10, repeat: true })).toEqual([])
  })

  test('allocates separate lanes only for overlapping events of an animal', () => {
    const animals = [{ id: 'animal-1' }, { id: 'animal-2' }]
    const observations = [
      interval('a', 0, 5),
      interval('b', 2, 4),
      interval('c', 5, 8),
      { ...interval('d', 3, 3), animalId: 'animal-2', kind: 'point', end: 3 }
    ]
    const { placements, laneCounts } = allocateAnimalLanes(observations, animals, 4, 10)
    expect(placements.get('a').lane).not.toBe(placements.get('b').lane)
    expect(placements.get('c').lane).toBe(placements.get('a').lane)
    expect(laneCounts.get('animal-1')).toBe(2)
    expect(laneCounts.get('animal-2')).toBe(1)
  })
})

describe('Workspace timeline UI integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="events-module"></div>'
    window.electronAPI = {
      getProjectObservations: jest.fn().mockResolvedValue({ version: 1, observations: [] }),
      saveProjectObservations: jest.fn(async (_projectId, data) => data),
      getAppSettings: jest.fn().mockResolvedValue({ timeline: { snapEnabled: false, snapThresholdPx: 14 } }),
      saveAppSettings: jest.fn(async (data) => data)
    }
  })

  test('loads animal lanes, records point and continuous actions, seeks, and undoes changes', async () => {
    const animal = { id: 'animal-1', name: 'Mrówka 1', color: '#42a56b' }
    const animalCatalog = { getData: () => ({ animals: [animal], activeAnimalId: animal.id }) }
    const timeline = createTimelineModule()
    await timeline.init('events-module', { projectId: 'Study', animalCatalog })

    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 1.5, duration: 10, paused: true } }))
    expect(document.querySelector('.timeline-ruler-track')).not.toBeNull()
    expect(document.querySelector('.timeline-animal-label').textContent).toContain('Mrówka 1')

    window.dispatchEvent(new CustomEvent('etogram-activity-request', { detail: { ...request, animalId: animal.id } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('.timeline-event.open')).not.toBeNull()
    expect(window.electronAPI.saveProjectObservations).toHaveBeenCalled()

    document.querySelector('[data-timeline-action="undo"]').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('.timeline-event')).toBeNull()

    const ruler = document.querySelector('.timeline-ruler-track')
    ruler.getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 42, width: 1000, height: 42 })
    const scroller = document.querySelector('.timeline-scroller')
    scroller.getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 300, width: 1000, height: 300 })
    scroller.scrollLeft = 0
    const seekListener = jest.fn()
    window.addEventListener('video-seek-request', seekListener)
    ruler.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 250 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400 }))
    expect(parseFloat(document.querySelector('.timeline-playhead-ruler').style.left)).toBeCloseTo(400 - 158)
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 0.2, duration: 10, paused: true } }))
    expect(parseFloat(document.querySelector('.timeline-playhead-ruler').style.left)).toBeCloseTo(400 - 158)
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 400 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 600 }))
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 0.2, duration: 10, paused: true } }))
    expect(parseFloat(document.querySelector('.timeline-playhead-ruler').style.left)).toBeCloseTo(0.2 * 84.2)
    const seekTimes = seekListener.mock.calls.map(([seekEvent]) => seekEvent.detail.time)
    expect(seekTimes).toHaveLength(2)
    // time 0 starts 158 px from the left edge (label column + gap); 10 s fill the 842 px that are left of a 1000 px view
    expect(seekTimes[0]).toBeCloseTo((250 - 158) / 84.2)
    expect(seekTimes[1]).toBeCloseTo((400 - 158) / 84.2)
    window.removeEventListener('video-seek-request', seekListener)
  })

  test('shows, records and removes events per trial', async () => {
    window.electronAPI.getProjectObservations.mockResolvedValue({
      observations: [
        { ...interval('first', 1, 3), trialId: 'trial-1' },
        { ...interval('second', 2, 4), trialId: 'trial-2' }
      ]
    })
    let activeTrial = { id: 'trial-1' }
    const trialCatalog = { getActiveTrial: () => activeTrial }
    const animal = { id: 'animal-1', name: 'Mrówka', color: '#42a56b' }
    const animalCatalog = { getData: () => ({ animals: [animal], activeAnimalId: animal.id }) }
    const observationStore = createObservationStore({ projectId: 'Study', api: window.electronAPI })
    await observationStore.load()
    const timeline = createTimelineModule()
    const instance = await timeline.init('events-module', { animalCatalog, trialCatalog, observationStore })
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 1, duration: 10, paused: true } }))

    const visibleIds = () => Array.from(document.querySelectorAll('.timeline-event')).map((node) => node.dataset.observationId)
    expect(visibleIds()).toEqual(['first'])

    activeTrial = { id: 'trial-2' }
    window.dispatchEvent(new CustomEvent('active-trial-changed', { detail: { trial: activeTrial } }))
    expect(visibleIds()).toEqual(['second'])

    window.dispatchEvent(new CustomEvent('etogram-activity-request', { detail: { ...request, activityId: 'run', animalId: animal.id } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const recorded = instance.getObservations().filter((item) => item.end === null)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].trialId).toBe('trial-2')
    expect(instance.getObservations()).toHaveLength(3)

    await observationStore.removeTrialEvents('trial-2')
    expect(visibleIds()).toEqual([])
    expect(instance.getObservations().map((item) => item.id)).toEqual(['first'])
    expect(window.electronAPI.saveProjectObservations).toHaveBeenLastCalledWith('Study', expect.objectContaining({
      observations: [expect.objectContaining({ id: 'first', trialId: 'trial-1' })]
    }))
  })

  test('snaps a dragged event to the playhead and to other events, unless Alt is held', async () => {
    window.electronAPI.getAppSettings.mockResolvedValue({ timeline: { snapEnabled: true, snapThresholdPx: 14 } })
    window.electronAPI.getProjectObservations.mockResolvedValue({
      observations: [interval('moving', 2, 5), { ...interval('other', 12, 15), activityId: 'other' }]
    })
    const animalCatalog = { getData: () => ({ animals: [{ id: 'animal-1', name: 'Mrówka', color: '#42a56b' }] }) }
    const instance = await createTimelineModule().init('events-module', { projectId: 'Study', animalCatalog })
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 7.04, duration: 20, paused: true } }))
    document.querySelector('.timeline-scroller').getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 300, width: 1000, height: 300 })

    const dragMovingEvent = async (altKey) => {
      document.querySelector('[data-observation-id="moving"]')
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 320, clientY: 20 }))
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 320 + 5.02 * 42.1, clientY: 20, altKey }))
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 320 + 5.02 * 42.1, clientY: 20 }))
      await new Promise((resolve) => setTimeout(resolve, 0))
      return instance.getObservations().find((item) => item.id === 'moving').start
    }

    expect(await dragMovingEvent(false)).toBeCloseTo(7.04)

    document.querySelector('[data-timeline-action="undo"]').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(instance.getObservations().find((item) => item.id === 'moving').start).toBe(2)

    expect(await dragMovingEvent(true)).toBeCloseTo(7.02)
  })

  describe('zoom and layout', () => {
    async function setupTimeline(duration) {
      window.electronAPI.getProjectObservations.mockResolvedValue({ observations: [] })
      const animalCatalog = { getData: () => ({ animals: [{ id: 'animal-1', name: 'Mrówka', color: '#42a56b' }] }) }
      await createTimelineModule().init('events-module', { projectId: 'Study', animalCatalog })
      window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 0, duration, paused: true } }))
    }
    const trackWidth = () => parseFloat(document.querySelector('.timeline-ruler-track').style.width)
    const setSlider = (value) => {
      const slider = document.querySelector('[data-timeline-zoom]')
      slider.value = String(value)
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    }

    test('starts with the whole video in view and zooms in logarithmically up to a hard limit', async () => {
      await setupTimeline(600)
      expect(trackWidth()).toBe(842)
      expect(document.querySelector('[data-timeline-zoom-value]').textContent).toBe('1.0×')

      setSlider(50)
      const half = trackWidth()
      expect(half).toBeGreaterThan(842 * 5)
      expect(half).toBeLessThan(60000)

      setSlider(100)
      expect(trackWidth()).toBe(60000)
      expect(document.querySelector('[data-timeline-zoom-value]').textContent).toBe('71×')
    })

    test('never stretches a long video: 50 minutes still fit the view and cap at the width limit', async () => {
      await setupTimeline(50 * 60)
      expect(trackWidth()).toBe(842)

      setSlider(100)
      expect(trackWidth()).toBe(60000)
      const ticks = document.querySelectorAll('.timeline-tick').length
      expect(ticks).toBeGreaterThan(5)
      expect(ticks).toBeLessThan(1000)
    })

    test('disables the slider when a video is too short to zoom into', async () => {
      await setupTimeline(2)
      expect(document.querySelector('[data-timeline-zoom]').disabled).toBe(true)

      await setupTimeline(10)
      expect(document.querySelector('[data-timeline-zoom]').disabled).toBe(false)
    })

    test('shows no permanent status text, only short announcements', async () => {
      await setupTimeline(10)
      const footer = document.querySelector('.timeline-status')
      expect(footer.hidden).toBe(true)
      expect(document.body.textContent).not.toMatch(/Wstrzymano|Odtwarzanie|Delete usuwa zaznaczone zdarzenie ·/)

      window.dispatchEvent(new CustomEvent('etogram-activity-request', { detail: { activityId: 'run', continuous: true } }))
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(footer.hidden).toBe(false)
      expect(footer.textContent).toMatch(/Wybierz aktywne zwierzę/)
    })
  })

  test('moves and resizes a saved interval, then deletes the selected event', async () => {
    window.electronAPI.getProjectObservations.mockResolvedValue({
      observations: [{ ...interval('saved', 2, 5), animalId: 'animal-1', activityId: 'run', activityName: 'Bieg' }]
    })
    const animalCatalog = { getData: () => ({ animals: [{ id: 'animal-1', name: 'Mrówka', color: '#42a56b' }] }) }
    const timeline = createTimelineModule()
    const instance = await timeline.init('events-module', { projectId: 'Study', animalCatalog })
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 3, duration: 10, paused: true } }))

    const scroller = document.querySelector('.timeline-scroller')
    scroller.getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 300, width: 1000, height: 300 })
    const intervalNode = document.querySelector('.timeline-event.interval')
    intervalNode.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 320, clientY: 20 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 404.2, clientY: 20 }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 404.2, clientY: 20 }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(instance.getObservations()[0].start).toBeCloseTo(3)
    expect(instance.getObservations()[0].end).toBeCloseTo(6)

    const endHandle = document.querySelector('.timeline-resize-handle.end')
    endHandle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 404.2, clientY: 20 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 488.4, clientY: 20 }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 488.4, clientY: 20 }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(instance.getObservations()[0].end).toBeCloseTo(7)

    document.querySelector('.timeline-event.interval').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 490, clientY: 20 }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(instance.getObservations()).toEqual([])
  })
})

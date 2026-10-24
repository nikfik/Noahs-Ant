/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { WorkspaceEtogramModule } from '../public/scripts/workspace/workspace-etogram-module.js'
import { createTimelineModule } from '../public/scripts/workspace/workspace-timeline-module.js'
import { createObservationStore } from '../public/scripts/workspace/observations/observation-store.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const key = (value) => document.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
const release = (value) => document.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true, cancelable: true }))

describe('related actions from key press to timeline', () => {
  test('ending one action starts the related one, using the rules saved in the etogram', async () => {
    document.body.innerHTML = '<div id="etogram-module"></div><div id="events-module"></div>'
    window.electronAPI = {
      getProjectObservations: jest.fn().mockResolvedValue({ version: 1, observations: [] }),
      saveProjectObservations: jest.fn(async (_id, data) => data),
      getAppSettings: jest.fn().mockResolvedValue({})
    }
    const activities = [
      { id: 'sleep', name: 'Sen', category: '', description: '', color: '#111111', continuous: true, shortcut: { primary: 'S', secondary: '', operator: '/' }, relations: [{ when: 'end', do: 'start', targetId: 'awake' }] },
      { id: 'awake', name: 'Czuwanie', category: '', description: '', color: '#222222', continuous: true, shortcut: { primary: 'W', secondary: '', operator: '/' }, relations: [{ when: 'start', do: 'end', targetId: 'sleep' }] }
    ]
    const data = { activeAnimalId: 'ant', animals: [{ id: 'ant', groupId: 'g', name: 'Mrówka', color: '#42a56b', etogramPresetId: 'p' }] }
    const animalCatalog = { getData: () => data, getPresets: () => [{ id: 'p', activities }], saveData: async () => data, savePresets: async () => {} }
    const trialCatalog = { getActiveTrial: () => ({ id: 't1', skips: [] }) }
    const store = createObservationStore({ projectId: 'Study', api: window.electronAPI })
    await store.load()

    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study', animalCatalog })
    await createTimelineModule().init('events-module', { animalCatalog, trialCatalog, observationStore: store })
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 1, duration: 100, paused: true } }))

    key('s')
    release('s')
    await flush()
    window.dispatchEvent(new CustomEvent('video-timeline-state', { detail: { currentTime: 5, duration: 100, paused: true } }))
    key('s')
    release('s')
    await flush()

    const list = store.getAll().map((item) => `${item.activityId}:${item.start}-${item.end}`)
    expect(list).toEqual(['sleep:1-5', 'awake:5-null'])
  })
})

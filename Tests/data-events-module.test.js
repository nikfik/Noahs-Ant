/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { createDataEventsModule } from '../public/scripts/workspace/data/data-events-module.js'
import { createObservationStore } from '../public/scripts/workspace/observations/observation-store.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const change = (node, value) => {
  node.value = value
  node.dispatchEvent(new Event('change', { bubbles: true }))
}

const event = (id, start, end, extra = {}) => ({
  id, animalId: 'ant-1', activityId: 'run', activityName: 'Bieg', activityColor: '#42a56b',
  kind: end === start ? 'point' : 'interval', start, end, lane: null, trialId: 'trial-1', ...extra
})

const trials = [{ id: 'trial-1', name: 'Próba 1' }, { id: 'trial-2', name: 'Próba 2' }]
const animals = [{ id: 'ant-1', name: 'Mrówka 1', etogramPresetId: 'preset' }]
const presets = [{ id: 'preset', activities: [
  { id: 'run', name: 'Bieg', color: '#42a56b', continuous: true },
  { id: 'rest', name: 'Odpoczynek', color: '#ffb300', continuous: true }
] }]

describe('Data events module', () => {
  let store
  let api

  async function setup(stored) {
    document.body.innerHTML = '<div id="view-data"><div id="data-module"></div></div>'
    api = {
      getProjectObservations: jest.fn().mockResolvedValue({ observations: stored }),
      saveProjectObservations: jest.fn(async (_projectId, data) => data)
    }
    store = createObservationStore({ projectId: 'Study', api })
    await store.load()
    createDataEventsModule().init('data-module', {
      observationStore: store,
      animalCatalog: { getData: () => ({ animals }), getPresets: () => presets },
      trialCatalog: { getData: () => ({ trials }) }
    })
  }

  const rowIds = () => Array.from(document.querySelectorAll('.data-table tbody tr')).map((row) => row.dataset.observationId)

  test('lists events sorted by trial and start, with times and durations', async () => {
    await setup([event('late', 8, 12), event('early', 1, 3), event('other', 2, 5, { trialId: 'trial-2' })])

    expect(rowIds()).toEqual(['early', 'late', 'other'])
    const first = document.querySelector('[data-observation-id="early"]')
    expect(first.querySelector('[data-field="start"]').value).toBe('1.000')
    expect(first.querySelector('[data-field="end"]').value).toBe('3.000')
    expect(first.querySelector('.data-duration').textContent).toBe('2.000')
    expect(first.querySelector('[data-field="trialId"]').selectedOptions[0].textContent).toBe('Próba 1')
    expect(document.querySelector('.data-count').textContent).toBe('3')
  })

  test('edits a time and saves it, and reverts an invalid edit with a message', async () => {
    await setup([event('a', 2, 5)])
    change(document.querySelector('[data-field="start"]'), '1:00')
    await flush()
    expect(document.querySelector('[data-data-message]').textContent).toMatch(/późniejszy/)
    expect(document.querySelector('[data-field="start"]').value).toBe('2.000')
    expect(api.saveProjectObservations).not.toHaveBeenCalled()

    change(document.querySelector('[data-field="start"]'), '3,5')
    await flush()
    expect(store.getAll()[0].start).toBe(3.5)
    expect(api.saveProjectObservations).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-field="start"]').value).toBe('3.500')
    expect(document.querySelector('[data-data-message]').textContent).toBe('')

    change(document.querySelector('[data-field="activityId"]'), 'rest')
    await flush()
    expect(store.getAll()[0]).toMatchObject({ activityId: 'rest', activityName: 'Odpoczynek' })
  })

  test('filters by trial, deletes an event and undoes the deletion', async () => {
    await setup([event('a', 1, 2), event('b', 3, 4, { trialId: 'trial-2' })])

    change(document.querySelector('[data-filter="trialId"]'), 'trial-2')
    expect(rowIds()).toEqual(['b'])
    expect(document.querySelector('.data-count').textContent).toBe('1 z 2')

    document.querySelector('[data-action="delete-event"]').click()
    await flush()
    expect(store.getAll().map((item) => item.id)).toEqual(['a'])
    expect(document.querySelector('.data-empty')).not.toBeNull()

    document.querySelector('[data-action="undo"]').click()
    await flush()
    expect(rowIds()).toEqual(['b'])
  })

  test('sorts by a clicked column header and explains the columns in tooltips', async () => {
    await setup([event('late', 8, 12), event('early', 1, 3), event('other', 2, 5, { trialId: 'trial-2' })])
    const header = () => document.querySelector('[data-sort="start"]')

    expect(Array.from(document.querySelectorAll('.data-table th[title]')).length).toBeGreaterThanOrEqual(7)
    header().click()
    expect(rowIds()).toEqual(['early', 'other', 'late'])
    expect(header().closest('th').getAttribute('aria-sort')).toBe('ascending')

    header().click()
    expect(rowIds()).toEqual(['late', 'other', 'early'])

    header().click()
    expect(rowIds()).toEqual(['early', 'late', 'other'])

    document.querySelector('[data-sort="end"]').click()
    expect(rowIds()).toEqual(['early', 'other', 'late'])
  })

  test('does not redraw while its view is hidden and catches up when shown', async () => {
    await setup([event('a', 1, 2)])
    const view = document.getElementById('view-data')
    view.hidden = true

    await store.commit([event('a', 1, 2), event('b', 3, 4)])
    expect(rowIds()).toEqual(['a'])

    view.hidden = false
    window.dispatchEvent(new CustomEvent('workspace-view-changed', { detail: { view: 'view-data' } }))
    expect(rowIds()).toEqual(['a', 'b'])
  })
})

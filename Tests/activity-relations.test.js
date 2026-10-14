/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { applyRelations, normalizeRelations, pruneRelations } from '../public/scripts/workspace/observations/activity-relations.js'
import { toggleObservation } from '../public/scripts/workspace/workspace-timeline-module.js'
import { WorkspaceEtogramModule } from '../public/scripts/workspace/workspace-etogram-module.js'

const activities = {
  sleep: { id: 'sleep', name: 'Sen', color: '#111111', continuous: true, relations: [{ when: 'end', do: 'start', targetId: 'awake' }, { when: 'start', do: 'end', targetId: 'awake' }] },
  awake: { id: 'awake', name: 'Czuwanie', color: '#222222', continuous: true, relations: [{ when: 'start', do: 'end', targetId: 'sleep' }] },
  kick: { id: 'kick', name: 'Kopnięcie', color: '#333333', continuous: false, relations: [{ when: 'start', do: 'end', targetId: 'sleep' }] }
}
const request = (id) => ({ activityId: id, activityName: activities[id].name, activityColor: activities[id].color, continuous: activities[id].continuous })
const press = (current, id, time) => {
  const toggled = toggleObservation(current, request(id), { animalId: 'ant', currentTime: time, duration: 100, trialId: 't1' })
  return applyRelations(current, toggled, { animalId: 'ant', trialId: 't1', time, activities })
}
const summary = (list) => list.map((item) => `${item.activityId}:${item.start}-${item.end}`)

describe('related actions', () => {
  test('ending an action starts another one at the same moment, and starting it ends a running one', () => {
    let list = press([], 'awake', 1)
    expect(summary(list)).toEqual(['awake:1-null'])

    list = press(list, 'sleep', 10)
    expect(summary(list)).toEqual(['awake:1-10', 'sleep:10-null'])

    list = press(list, 'sleep', 20)
    expect(summary(list)).toEqual(['awake:1-10', 'sleep:10-20', 'awake:20-null'])
  })

  test('a point action can end a running action (which then sets off its own rules); rules that find nothing to do change nothing', () => {
    const slept = press([], 'sleep', 5)
    expect(summary(press(slept, 'kick', 8))).toEqual(['sleep:5-8', 'kick:8-8', 'awake:8-null'])
    expect(summary(press([], 'kick', 8))).toEqual(['kick:8-8'])
  })

  test('only the same animal and trial are touched, and a rule never ends something before it started', () => {
    const other = { id: 'x', animalId: 'bee', activityId: 'awake', kind: 'interval', start: 1, end: null, trialId: 't1' }
    expect(applyRelations([other], [other, { id: 'n', animalId: 'ant', activityId: 'sleep', kind: 'interval', start: 4, end: null, trialId: 't1' }], { animalId: 'ant', trialId: 't1', time: 4, activities })).toHaveLength(2)

    const late = { id: 'y', animalId: 'ant', activityId: 'awake', kind: 'interval', start: 30, end: null, trialId: 't1' }
    const result = press([late], 'sleep', 10)
    expect(result.find((item) => item.id === 'y').end).toBeNull()
  })

  test('rules are cleaned: only continuous targets other than the action itself survive saving', () => {
    expect(normalizeRelations([{ when: 'start', do: 'end', targetId: 'a' }, { when: 'start', do: 'end', targetId: 'a' }, { when: 'x', do: 'end' }, null])).toHaveLength(1)
    const rows = [
      { id: 'a', continuous: true, relations: [{ when: 'end', do: 'start', targetId: 'b' }, { when: 'start', do: 'end', targetId: 'a' }, { when: 'start', do: 'end', targetId: 'p' }, { when: 'start', do: 'end', targetId: '' }] },
      { id: 'b', continuous: true, relations: [] },
      { id: 'p', continuous: false, relations: [{ when: 'end', do: 'start', targetId: 'a' }, { when: 'start', do: 'start', targetId: 'a' }] }
    ]
    const pruned = pruneRelations(rows)
    expect(pruned[0].relations).toEqual([{ when: 'end', do: 'start', targetId: 'b' }])
    expect(pruned[2].relations).toEqual([{ when: 'start', do: 'start', targetId: 'a' }])
  })
})

describe('etogram editor: colors and advanced options', () => {
  const makeRow = (id, name, continuous = true) => ({ id, name, category: '', description: '', color: '#42a56b', continuous, shortcut: { primary: '', secondary: '', operator: '/' } })
  let saved

  async function open(rows) {
    document.body.innerHTML = '<div id="etogram-module"></div>'
    const data = { activeAnimalId: 'ant', animals: [{ id: 'ant', groupId: 'g', name: 'Mrówka', etogramPresetId: 'p' }] }
    const presets = [{ id: 'p', activities: rows }]
    saved = null
    const catalog = { getData: () => data, getPresets: () => presets, saveData: async () => data, savePresets: jest.fn(async (list) => { saved = list }) }
    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study', animalCatalog: catalog })
    document.getElementById('open-etogram-editor').click()
    return document.getElementById('etogram-modal')
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  test('a new action gets a random color and the dice rolls another one', async () => {
    const modal = await open([makeRow('a', 'Sen')])
    modal.querySelector('#add-etogram-row').click()
    const colors = () => [...modal.querySelectorAll('[data-field="color"]')].map((input) => input.value)
    expect(colors()[1]).not.toBe('#ff4f1a')
    expect(colors()[1]).not.toBe(colors()[0])

    const before = colors()[1]
    modal.querySelectorAll('[data-action="reroll-color"]')[1].click()
    expect(colors()[1]).not.toBe(before)
    expect(colors()).toHaveLength(2)
  })

  test('the "..." button opens the related actions of a row; rules are saved and invalid ones dropped', async () => {
    const modal = await open([makeRow('a', 'Sen'), makeRow('b', 'Czuwanie'), makeRow('c', 'Skok', false)])
    expect(modal.querySelector('.etogram-relations-row')).toBeNull()

    modal.querySelector('[data-action="toggle-relations"][data-index="0"]').click()
    modal.querySelector('[data-action="add-relation"]').click()
    modal.querySelector('[data-rel="when"]').value = 'end'
    modal.querySelector('[data-rel="do"]').value = 'start'
    const target = modal.querySelector('[data-rel="targetId"]')
    expect([...target.options].map((option) => option.textContent)).toEqual(['— wybierz czynność —', 'Czuwanie'])
    target.value = 'b'
    modal.querySelector('[data-action="add-relation"]').click()
    expect(modal.querySelectorAll('.etogram-relation')).toHaveLength(2)
    expect(modal.querySelector('.etogram-more-count').textContent).toBe('2')
    expect(modal.querySelectorAll('.editor-table tbody tr[data-index]')).toHaveLength(3)

    modal.querySelector('#save-etogram').click()
    await flush()
    expect(saved[0].activities[0].relations).toEqual([{ when: 'end', do: 'start', targetId: 'b' }])
    expect(saved[0].activities[1].relations).toEqual([])
  })
})

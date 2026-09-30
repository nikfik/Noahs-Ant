/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { WorkspaceEtogramModule, loadRows, persistRows } from '../public/scripts/workspace/workspace-etogram-module.js'

describe('Group etogram presets', () => {
  test('loads activities from the active group preset', async () => {
    const animalData = {
      activeGroupId: 'group-cats',
      groups: [{ id: 'group-cats', etogramPresetId: 'preset-cats' }],
      etogramPresets: [{
        id: 'preset-cats',
        name: 'Koty',
        activities: [{ id: 'eat', name: 'Jedzenie', shortcut: 'J', color: '#123456' }]
      }]
    }

    const rows = await loadRows('Study', animalData)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Jedzenie')
    expect(rows[0].color).toBe('#123456')
  })

  test('persists changes to the selected group preset', async () => {
    const data = {
      activeGroupId: 'group-cats',
      groups: [{ id: 'group-cats', name: 'Koty', etogramPresetId: 'preset-cats' }],
      etogramPresets: [{ id: 'preset-cats', name: 'Koty', activities: [] }]
    }
    const saved = jest.fn(async (next) => Object.assign(data, next))
    const catalog = { getData: () => data, saveData: saved }
    const rows = [{ id: 'eat', name: 'Jedzenie', shortcut: { primary: 'J' }, color: '#123456' }]

    await persistRows('Study', rows, catalog, 'group-cats')

    expect(saved).toHaveBeenCalledTimes(1)
    expect(data.etogramPresets[0].activities).toEqual(rows)
  })

  test('switches the displayed activities with the active animal group and attributes key events', async () => {
    document.body.innerHTML = '<div id="etogram-module"></div>'
    const data = {
      activeGroupId: 'ants',
      activeAnimalId: 'ant-1',
      groups: [
        { id: 'ants', name: 'Mrówki', etogramPresetId: 'ant-preset' },
        { id: 'cats', name: 'Koty', etogramPresetId: 'cat-preset' }
      ],
      animals: [
        { id: 'ant-1', groupId: 'ants', name: 'Mrówka 1', color: '#42a56b' },
        { id: 'cat-1', groupId: 'cats', name: 'Kot 1', color: '#448aff' }
      ],
      etogramPresets: [
        { id: 'ant-preset', name: 'Etogram mrówek', activities: [{ id: 'carry', name: 'Transport', shortcut: 'T' }] },
        { id: 'cat-preset', name: 'Etogram kotów', activities: [{ id: 'sleep', name: 'Sen', shortcut: 'S' }] }
      ]
    }
    const catalog = {
      getData: () => data,
      saveData: async (next) => Object.assign(data, next)
    }
    const recorded = jest.fn()
    window.addEventListener('etogram-activity', recorded)

    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study', animalCatalog: catalog })
    expect(document.querySelector('.compact-table tbody').textContent).toContain('Transport')

    window.dispatchEvent(new CustomEvent('active-animal-changed', {
      detail: { data, activeGroup: data.groups[1], activeAnimal: data.animals[1] }
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('.compact-table tbody').textContent).toContain('Sen')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }))
    expect(recorded).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({ animalId: 'cat-1', groupId: 'cats', activityId: 'sleep' })
    }))
    window.removeEventListener('etogram-activity', recorded)
  })
})

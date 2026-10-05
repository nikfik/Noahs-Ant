/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { AnimalCatalogModule } from '../public/scripts/workspace/animals/animal-catalog-module.js'
import { chooseAnimalColor, createAnimal, createEmptyAnimalData, createGroup, normalizeAnimalData } from '../public/scripts/workspace/animals/animal-model.js'

describe('Animal catalog model', () => {
  test('creates groups without owning etogram presets', () => {
    const data = createGroup(createEmptyAnimalData(), 'Mrówki')
    expect(data.groups[0].name).toBe('Mrówki')
    expect(data.groups[0].etogramPresetId).toBeUndefined()
    expect(data.etogramPresets).toBeUndefined()
  })

  test('creates animals with unique group colors and valid active selection', () => {
    const grouped = createGroup(createEmptyAnimalData(), 'Mrówki')
    const first = createAnimal(grouped, grouped.groups[0].id, 'Mrówka 1', () => 0)
    const second = createAnimal(first, grouped.groups[0].id, 'Mrówka 2', () => 0)

    expect(second.animals[0].color).not.toBe(second.animals[1].color)
    expect(second.activeAnimalId).toBe(second.animals[1].id)
    expect(second.animals[1].etogramPresetId).toBe(second.animals[0].etogramPresetId)
    expect(normalizeAnimalData({ ...second, activeAnimalId: 'missing' }).activeAnimalId).toBeNull()
    expect(chooseAnimalColor(second.animals.filter((animal) => animal.groupId === grouped.groups[0].id), () => 0)).not.toBe(second.animals[0].color)
  })

  test('migrates a legacy group preset assignment to each animal', () => {
    const normalized = normalizeAnimalData({
      groups: [{ id: 'group-a', name: 'Mrówki', etogramPresetId: 'preset-a' }],
      animals: [
        { id: 'ant-a', groupId: 'group-a', name: 'Mrówka A' },
        { id: 'ant-b', groupId: 'group-a', name: 'Mrówka B' }
      ]
    })

    expect(normalized.groups[0].etogramPresetId).toBeUndefined()
    expect(normalized.animals.map((animal) => animal.etogramPresetId)).toEqual(['preset-a', 'preset-a'])
  })
})

describe('Animal catalog UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="animal-panel"></div>'
    window.electronAPI = {
      getProjectAnimals: jest.fn().mockResolvedValue(createEmptyAnimalData()),
      saveProjectAnimals: jest.fn(async (_projectId, data) => data),
      getProjectEtograms: jest.fn().mockResolvedValue([]),
      saveProjectEtograms: jest.fn(async (_projectId, presets) => presets)
    }
  })

  test('adds a group and animal, selects the animal, and persists changes', async () => {
    const selectionListener = jest.fn()
    window.addEventListener('active-animal-changed', selectionListener)
    await AnimalCatalogModule.init('animal-panel', { projectId: 'Study' })

    document.querySelector('[data-action="add-group"]').click()
    const dialog = document.querySelector('.animal-name-dialog')
    document.getElementById('animal-name-input').value = 'Mrówki'
    dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('.animal-group-name').textContent).toBe('Mrówki')
    document.querySelector('[data-action="add-animal"]').click()
    document.getElementById('animal-name-input').value = 'Mrówka 1'
    dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('.animal-entry-name').textContent).toBe('Mrówka 1')
    expect(document.querySelector('.animal-entry.active')).not.toBeNull()
    const oldColor = document.querySelector('.animal-color-dot').style.getPropertyValue('--animal-color')
    document.querySelector('[data-action="reroll-color"]').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const newColor = document.querySelector('.animal-color-dot').style.getPropertyValue('--animal-color')
    expect(newColor).not.toBe(oldColor)
    expect(window.electronAPI.saveProjectAnimals).toHaveBeenCalledTimes(3)
    expect(selectionListener).toHaveBeenCalled()
    expect(window.electronAPI.saveProjectEtograms).toHaveBeenCalledTimes(1)
    window.removeEventListener('active-animal-changed', selectionListener)
  })
})

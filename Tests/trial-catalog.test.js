/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { TrialCatalogModule } from '../public/scripts/workspace/trials/trial-catalog-module.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const submitNameDialog = (name) => {
  if (name !== undefined) document.getElementById('trial-name-input').value = name
  document.querySelector('.trial-name-dialog').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('Trial catalog module', () => {
  let changed
  let removed

  beforeEach(() => {
    document.body.innerHTML = '<div id="trial-panel"></div>'
    window.electronAPI = {
      getProjectTrials: jest.fn().mockResolvedValue({
        version: 1,
        activeTrialId: 'trial-1',
        trials: [{ id: 'trial-1', name: 'Próba 1', videoPath: 'one.mp4' }]
      }),
      saveProjectTrials: jest.fn(async (_projectId, data) => data)
    }
    changed = jest.fn()
    removed = jest.fn()
    window.addEventListener('active-trial-changed', changed)
    window.addEventListener('trial-removed', removed)
  })

  afterEach(() => {
    window.removeEventListener('active-trial-changed', changed)
    window.removeEventListener('trial-removed', removed)
  })

  test('announces the active trial, adds, renames, switches and removes trials', async () => {
    const catalog = await TrialCatalogModule.init('trial-panel', { projectId: 'Study' })
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed.mock.calls[0][0].detail.trial.id).toBe('trial-1')
    expect(document.querySelector('[data-action="remove-trial"]').disabled).toBe(true)

    document.querySelector('[data-action="add-trial"]').click()
    submitNameDialog('A2M1 Head')
    await flush()
    expect(catalog.getData().trials.map((trial) => trial.name)).toEqual(['Próba 1', 'A2M1 Head'])
    expect(catalog.getActiveTrial().name).toBe('A2M1 Head')
    expect(window.electronAPI.saveProjectTrials).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.trial-select').selectedOptions[0].textContent.trim()).toBe('A2M1 Head')

    document.querySelector('[data-action="rename-trial"]').click()
    submitNameDialog('Zmieniona')
    await flush()
    expect(catalog.getActiveTrial().name).toBe('Zmieniona')

    const select = document.querySelector('.trial-select')
    select.value = 'trial-1'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
    expect(catalog.getActiveTrial().id).toBe('trial-1')

    const secondId = catalog.getData().trials[1].id
    select.value = secondId
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
    document.querySelector('[data-action="remove-trial"]').click()
    expect(document.querySelector('.trial-confirm-modal').classList.contains('hidden')).toBe(false)
    document.querySelector('[data-action="confirm-trial-remove"]').click()
    await flush()
    expect(document.querySelector('.trial-confirm-modal').classList.contains('hidden')).toBe(true)
    expect(removed.mock.calls[0][0].detail.trialId).toBe(secondId)
    expect(catalog.getData().trials.map((trial) => trial.id)).toEqual(['trial-1'])
  })

  test('keeps the trial when removal is not confirmed and stores a picked video path', async () => {
    const catalog = await TrialCatalogModule.init('trial-panel', { projectId: 'Study' })
    document.querySelector('[data-action="add-trial"]').click()
    submitNameDialog()
    await flush()
    expect(catalog.getData().trials).toHaveLength(2)

    document.querySelector('[data-action="remove-trial"]').click()
    document.querySelector('[data-action="cancel-trial-remove"]').click()
    await flush()
    expect(catalog.getData().trials).toHaveLength(2)
    expect(removed).not.toHaveBeenCalled()

    await catalog.setVideoPath(catalog.getActiveTrial().id, 'C:/new.mp4')
    expect(catalog.getActiveTrial().videoPath).toBe('C:/new.mp4')
  })
})

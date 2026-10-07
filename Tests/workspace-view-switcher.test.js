/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { initViewSwitcher } from '../public/scripts/workspace/workspace-view-switcher.js'
import { WorkspaceEtogramModule } from '../public/scripts/workspace/workspace-etogram-module.js'

describe('Workspace view switcher', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-view')
    document.body.innerHTML = `
      <div id="view-video"></div><div id="view-data" hidden></div><div id="view-analysis" hidden></div>
      <div id="etogram-module"></div>
    `
  })

  test('shows one view at a time, announces the change, and ignores unknown views', () => {
    const changed = jest.fn()
    window.addEventListener('workspace-view-changed', changed)
    const switcher = initViewSwitcher(['view-video', 'view-data', 'view-analysis'])
    expect(document.getElementById('view-video').hidden).toBe(false)
    expect(document.body.dataset.view).toBe('view-video')

    window.dispatchEvent(new CustomEvent('workspace-view-change', { detail: { view: 'view-data' } }))
    expect(document.getElementById('view-video').hidden).toBe(true)
    expect(document.getElementById('view-data').hidden).toBe(false)
    expect(switcher.getCurrent()).toBe('view-data')
    expect(changed.mock.calls.at(-1)[0].detail.view).toBe('view-data')

    window.dispatchEvent(new CustomEvent('workspace-view-change', { detail: { view: 'view-missing' } }))
    expect(switcher.getCurrent()).toBe('view-data')
    window.removeEventListener('workspace-view-changed', changed)
  })

  test('etogram shortcuts record events only while the video view is active', async () => {
    const data = { activeAnimalId: 'ant-1', animals: [{ id: 'ant-1', groupId: 'g', name: 'Mrówka', etogramPresetId: 'p' }] }
    const catalog = {
      getData: () => data,
      getPresets: () => [{ id: 'p', activities: [{ id: 'run', name: 'Bieg', shortcut: 'R', color: '#42a56b', continuous: false }] }],
      saveData: async () => data,
      savePresets: async (presets) => presets
    }
    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study', animalCatalog: catalog })
    const requested = jest.fn()
    window.addEventListener('etogram-activity-request', requested)

    document.body.dataset.view = 'view-data'
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true }))
    expect(requested).not.toHaveBeenCalled()

    document.body.dataset.view = 'view-video'
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true, cancelable: true }))
    expect(requested).toHaveBeenCalledTimes(1)
    window.removeEventListener('etogram-activity-request', requested)
  })
})

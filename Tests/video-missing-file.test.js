/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { WorkspaceVideoModule } from '../public/scripts/workspace/workspace-video-module.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('video file that is gone', () => {
  let trials
  let trialCatalog
  let existing

  beforeEach(() => {
    document.body.innerHTML = '<div id="video-module"></div>'
    window.HTMLMediaElement.prototype.load = jest.fn()
    window.HTMLMediaElement.prototype.pause = jest.fn()
    existing = new Set(['C:/Filmy/dobry.mp4'])
    trials = [
      { id: 't1', name: 'Test 1', videoPath: 'C:/Filmy/dobry.mp4' },
      { id: 't2', name: 'Test 2', videoPath: 'D:/Stary dysk/zginal.MTS' },
      { id: 't3', name: 'Test 3', videoPath: 'D:/Stary dysk/drugi.MTS' }
    ]
    trialCatalog = {
      getActiveTrial: () => trials[0],
      getData: () => ({ trials }),
      updateTrial: jest.fn(async (id, changes) => { trials = trials.map((trial) => trial.id === id ? { ...trial, ...changes } : trial) })
    }
    window.electronAPI = {
      pathsExist: jest.fn(async (paths) => paths.map((file) => existing.has(file))),
      findFilesInFolder: jest.fn(async () => ({})),
      selectVideoFile: jest.fn(),
      prepareVideo: jest.fn(),
      inspectVideo: jest.fn().mockResolvedValue(null),
      onVideoConvertProgress: jest.fn(() => jest.fn())
    }
  })

  const empty = () => document.querySelector('.video-empty')
  const switchTo = async (id) => {
    window.dispatchEvent(new CustomEvent('active-trial-changed', { detail: { trial: trials.find((trial) => trial.id === id) } }))
    await flush()
  }

  test('a film that exists is shown as usual', async () => {
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
    await flush()
    expect(window.electronAPI.pathsExist).toHaveBeenCalledWith(['C:/Filmy/dobry.mp4'])
    expect(empty().hidden).toBe(true)
    expect(document.getElementById('video-player').getAttribute('src')).toBe('file:///C:/Filmy/dobry.mp4')
  })

  test('a missing film is explained, with a button to point at the file again', async () => {
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
    await flush()
    await switchTo('t2')

    expect(empty().hidden).toBe(false)
    expect(empty().querySelector('p').textContent).toBe('Nie znaleziono pliku wideo „zginal.MTS”')
    expect(empty().querySelector('button').textContent).toBe('Wskaż plik wideo')
    expect(document.getElementById('video-player').hasAttribute('src')).toBe(false)

    await switchTo('t1')
    expect(empty().hidden).toBe(true)
    expect(empty().querySelector('p').textContent).toBe('Ta próba nie ma jeszcze filmu')
    expect(empty().querySelector('button').textContent).toBe('Wybierz plik wideo')
  })

  test('pointing at the moved film also finds the other missing films in the same folder', async () => {
    trialCatalog.getActiveTrial = () => trials[1]
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
    await flush()
    window.electronAPI.selectVideoFile.mockResolvedValue('E:/Nowy dysk/zginal.MTS')
    window.electronAPI.prepareVideo.mockResolvedValue({ status: 'ready', videoPath: 'E:/Nowy dysk/zginal.MTS', sourcePath: '', frameRate: 25 })
    window.electronAPI.findFilesInFolder.mockResolvedValue({ 'drugi.MTS': 'E:/Nowy dysk/drugi.MTS' })

    document.getElementById('pick-video-empty-btn').click()
    await flush()
    await flush()

    expect(window.electronAPI.findFilesInFolder).toHaveBeenCalledWith({ folder: 'E:/Nowy dysk', names: ['drugi.MTS'] })
    expect(trials.find((trial) => trial.id === 't3').videoPath).toBe('E:/Nowy dysk/drugi.MTS')
    expect(trials.find((trial) => trial.id === 't2').videoPath).toBe('E:/Nowy dysk/zginal.MTS')
    expect(document.querySelector('.video-busy-text').textContent).toBe('Odnaleziono też filmy innych prób: 1.')
    expect(document.querySelector('.video-busy').classList.contains('is-error')).toBe(false)
    expect(document.getElementById('video-close-notice-btn').hidden).toBe(false)
  })
})

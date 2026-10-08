/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { WorkspaceVideoModule } from '../public/scripts/workspace/workspace-video-module.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('WorkspaceVideoModule', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="video-module"></div>'
    window.electronAPI = {
      selectVideoFile: jest.fn()
    }
    window.HTMLMediaElement.prototype.load = jest.fn()
    window.HTMLMediaElement.prototype.pause = jest.fn()
  })

  test('renderuje pełne kontrolki odtwarzania dla video', async () => {
    await WorkspaceVideoModule.init('video-module', { projectFile: 'demo.json' })

    const host = document.getElementById('video-module')
    const markup = host.innerHTML

    expect(markup).toContain('video-player')
    expect(markup).toContain('play-pause-video-btn')
    expect(markup).toContain('skip-back-video-btn')
    expect(markup).toContain('step-back-video-btn')
    expect(markup).toContain('step-forward-video-btn')
    expect(markup).toContain('skip-forward-video-btn')
    expect(markup).not.toContain('video-seek')
    expect(markup).toContain('video-speed')
    expect(markup).toContain('video-volume')
  })

  test('has one slim control bar, without the Open button and without a second timer', async () => {
    await WorkspaceVideoModule.init('video-module', { projectFile: 'demo.json' })
    const markup = document.getElementById('video-module').innerHTML

    expect(markup).not.toContain('open-video-placeholder')
    expect(markup).not.toContain('video-time')
    expect(markup).not.toContain('Odtwórz</button>')
    expect(document.querySelectorAll('.video-controls button')).toHaveLength(7)
    expect(document.querySelectorAll('.video-controls svg').length).toBeGreaterThanOrEqual(7)

    const zoomControls = document.querySelector('.video-zoom-controls')
    expect(zoomControls.parentElement.classList.contains('video-stage')).toBe(true)
    expect(document.querySelector('.video-stage-inner').contains(zoomControls)).toBe(false)
  })

  test('registers the video shortcuts, runs them, and shows the current keys in the tooltips', async () => {
    const registered = {}
    let keys = { 'play-pause': 'Spacja / Enter', 'toggle-mute': 'Shift + M', 'skip-forward': '→', 'skip-back': '←', 'frame-forward': '.', 'frame-back': ',' }
    let onKeysChanged = () => {}
    const shortcutManager = {
      register: jest.fn((id, handler, options) => { registered[id] = { handler, options } }),
      subscribe: jest.fn((callback) => { onKeysChanged = callback }),
      describe: (id) => keys[id] || ''
    }
    await WorkspaceVideoModule.init('video-module', { projectFile: 'demo.json', shortcutManager })

    expect(Object.keys(registered).sort()).toEqual(['frame-back', 'frame-forward', 'play-pause', 'skip-back', 'skip-forward', 'toggle-mute'])
    expect(registered['skip-forward'].options).toEqual({ allowRepeat: true })
    expect(registered['play-pause'].options).toBeUndefined()

    expect(document.getElementById('play-pause-video-btn').title).toBe('Odtwórz (Spacja / Enter)')
    expect(document.getElementById('skip-forward-video-btn').title).toBe('Do przodu o 5 s (→)')
    expect(document.getElementById('step-back-video-btn').title).toBe('Cofnij o 1 klatkę (,)')
    expect(document.getElementById('mute-video-btn').title).toBe('Wycisz (Shift + M)')

    const video = document.getElementById('video-player')
    Object.defineProperty(video, 'duration', { value: 100, configurable: true })
    Object.defineProperty(video, 'currentTime', { value: 10, writable: true, configurable: true })
    registered['skip-forward'].handler()
    expect(video.currentTime).toBe(15)
    registered['skip-back'].handler()
    expect(video.currentTime).toBe(10)
    registered['frame-forward'].handler()
    expect(video.currentTime).toBeCloseTo(10 + 1 / 30)
    registered['toggle-mute'].handler()
    expect(video.muted).toBe(true)

    keys = { ...keys, 'skip-forward': 'L', 'toggle-mute': '' }
    onKeysChanged()
    expect(document.getElementById('skip-forward-video-btn').title).toBe('Do przodu o 5 s (L)')
    expect(document.getElementById('mute-video-btn').title).toBe('Włącz dźwięk')
  })

  test('swaps the play and mute icons with the state of the video', async () => {
    await WorkspaceVideoModule.init('video-module', { projectFile: 'demo.json' })
    const video = document.getElementById('video-player')
    const play = document.getElementById('play-pause-video-btn')
    const mute = document.getElementById('mute-video-btn')
    expect(play.title).toBe('Odtwórz')

    Object.defineProperty(video, 'paused', { value: false, configurable: true })
    video.dispatchEvent(new Event('play'))
    expect(play.title).toBe('Zatrzymaj')

    mute.click()
    expect(video.muted).toBe(true)
    expect(mute.title).toBe('Włącz dźwięk')
  })

  test('shows a large file button while the trial has no video, and both file buttons pick a video', async () => {
    const trialCatalog = {
      getActiveTrial: () => ({ id: 'trial-1', videoPath: '' }),
      updateTrial: jest.fn(async () => {})
    }
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
    const empty = document.querySelector('.video-empty')
    expect(empty.hidden).toBe(false)

    window.electronAPI.selectVideoFile.mockResolvedValue('C:/videos/one.mp4')
    document.getElementById('pick-video-empty-btn').click()
    await flush()
    expect(empty.hidden).toBe(true)
    expect(trialCatalog.updateTrial).toHaveBeenCalledWith('trial-1', { videoPath: 'C:/videos/one.mp4', sourcePath: '', frameRate: null })

    window.dispatchEvent(new CustomEvent('active-trial-changed', { detail: { trial: { id: 'trial-2', videoPath: '' } } }))
    expect(empty.hidden).toBe(false)

    window.electronAPI.selectVideoFile.mockResolvedValue('C:/videos/two.mp4')
    document.getElementById('pick-video-btn').click()
    await flush()
    expect(document.getElementById('video-player').getAttribute('src')).toBe('file:///C:/videos/two.mp4')
    expect(empty.hidden).toBe(true)
  })

  describe('picking a video that may need conversion', () => {
    let progressListener
    let finish
    let fail
    let trialCatalog

    beforeEach(() => {
      progressListener = null
      window.electronAPI = {
        selectVideoFile: jest.fn().mockResolvedValue('C:/Videos/00027.MTS'),
        onVideoConvertProgress: jest.fn((callback) => { progressListener = callback; return jest.fn() }),
        cancelVideoConversion: jest.fn(),
        prepareVideo: jest.fn(() => new Promise((resolve, reject) => { finish = resolve; fail = reject }))
      }
      trialCatalog = {
        getActiveTrial: () => ({ id: 'trial-1', videoPath: '' }),
        getData: () => ({ trials: [{ id: 'trial-1', videoPath: '', frameRate: null }] }),
        updateTrial: jest.fn(async () => {})
      }
    })

    const busy = () => document.querySelector('.video-busy')
    const text = () => document.querySelector('.video-busy-text').textContent

    test('shows the progress of a conversion, then plays the converted copy and remembers the original and the frame rate', async () => {
      await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
      expect(busy().hidden).toBe(true)

      document.getElementById('pick-video-btn').click()
      await flush()
      expect(busy().hidden).toBe(false)
      expect(text()).toBe('Sprawdzanie filmu…')
      expect(window.electronAPI.prepareVideo).toHaveBeenCalledWith({ projectId: 'Study', filePath: 'C:/Videos/00027.MTS' })

      progressListener({ percent: 41.6 })
      expect(text()).toBe('Konwertowanie filmu… 42%')
      expect(document.querySelector('.video-busy-progress').hidden).toBe(false)
      expect(document.querySelector('.video-busy-progress').value).toBe(41.6)

      finish({ status: 'converted', videoPath: 'C:/Projects/Study/videos/00027.mp4', sourcePath: 'C:/Videos/00027.MTS', frameRate: 50 })
      await flush()

      expect(busy().hidden).toBe(true)
      expect(document.getElementById('video-player').getAttribute('src')).toBe('file:///C:/Projects/Study/videos/00027.mp4')
      expect(trialCatalog.updateTrial).toHaveBeenCalledWith('trial-1', {
        videoPath: 'C:/Projects/Study/videos/00027.mp4',
        sourcePath: 'C:/Videos/00027.MTS',
        frameRate: 50
      })
    })

    test('can be cancelled without changing the video', async () => {
      await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
      document.getElementById('pick-video-btn').click()
      await flush()

      document.getElementById('video-cancel-conversion-btn').click()
      expect(window.electronAPI.cancelVideoConversion).toHaveBeenCalled()
      finish({ status: 'cancelled' })
      await flush()

      expect(busy().hidden).toBe(true)
      expect(document.getElementById('video-player').hasAttribute('src')).toBe(false)
      expect(trialCatalog.updateTrial).not.toHaveBeenCalled()
    })

    test('explains a failure in plain words and can be closed', async () => {
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
      await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
      document.getElementById('pick-video-btn').click()
      await flush()

      fail(new Error("Error invoking remote method 'prepare-video': Error: Konwersja nie powiodła się: Conversion failed!"))
      await flush()

      expect(busy().hidden).toBe(false)
      expect(busy().classList.contains('is-error')).toBe(true)
      expect(text()).toBe('Nie udało się przygotować filmu. Konwersja nie powiodła się: Conversion failed!')
      expect(document.getElementById('video-cancel-conversion-btn').hidden).toBe(true)
      expect(document.querySelector('.video-busy-progress').hidden).toBe(true)

      document.getElementById('video-close-notice-btn').click()
      expect(busy().hidden).toBe(true)
      expect(trialCatalog.updateTrial).not.toHaveBeenCalled()

      document.getElementById('pick-video-btn').click()
      await flush()
      fail(new Error('ffmpeg-missing'))
      await flush()
      expect(text()).toBe('Ten format wymaga konwersji, ale nie znaleziono programu ffmpeg.')
      errors.mockRestore()
    })

    test('does nothing when the file dialog is closed', async () => {
      window.electronAPI.selectVideoFile.mockResolvedValue('')
      await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
      document.getElementById('pick-video-btn').click()
      await flush()

      expect(window.electronAPI.prepareVideo).not.toHaveBeenCalled()
      expect(busy().hidden).toBe(true)
    })
  })

  describe('frame rate', () => {
    async function setup(trial, electronAPI = {}) {
      window.electronAPI = { selectVideoFile: jest.fn(), ...electronAPI }
      const trialCatalog = {
        getActiveTrial: () => trial,
        getData: () => ({ trials: [trial] }),
        updateTrial: jest.fn(async () => {})
      }
      await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
      const video = document.getElementById('video-player')
      Object.defineProperty(video, 'duration', { value: 100, configurable: true })
      Object.defineProperty(video, 'currentTime', { value: 10, writable: true, configurable: true })
      return { video, trialCatalog }
    }

    test('steps by one real picture of the video', async () => {
      const { video } = await setup({ id: 't', videoPath: 'C:/a.mp4', frameRate: 50 })
      document.getElementById('step-forward-video-btn').click()
      expect(video.currentTime).toBeCloseTo(10 + 1 / 50)
      document.getElementById('step-back-video-btn').click()
      document.getElementById('step-back-video-btn').click()
      expect(video.currentTime).toBeCloseTo(10 - 1 / 50)
    })

    test('uses 1/30 s while the frame rate is unknown', async () => {
      const { video } = await setup({ id: 't', videoPath: '', frameRate: null })
      document.getElementById('step-forward-video-btn').click()
      expect(video.currentTime).toBeCloseTo(10 + 1 / 30)
    })

    test('asks once for the frame rate of an older trial and remembers it', async () => {
      const probeVideo = jest.fn().mockResolvedValue({ frameRate: 25, duration: 108 })
      const { trialCatalog } = await setup({ id: 't', videoPath: 'C:/old.mp4', frameRate: null }, { probeVideo })
      await flush()

      expect(probeVideo).toHaveBeenCalledWith('C:/old.mp4')
      expect(trialCatalog.updateTrial).toHaveBeenCalledWith('t', { frameRate: 25 })
    })

    test('does not ask when the frame rate is known or cannot be read', async () => {
      const probeVideo = jest.fn().mockResolvedValue(null)
      await setup({ id: 't', videoPath: 'C:/a.mp4', frameRate: 50 }, { probeVideo })
      await flush()
      expect(probeVideo).not.toHaveBeenCalled()

      const failing = jest.fn().mockRejectedValue(new Error('no ffmpeg'))
      const { trialCatalog } = await setup({ id: 't2', videoPath: 'C:/b.mp4', frameRate: null }, { probeVideo: failing })
      await flush()
      expect(trialCatalog.updateTrial).not.toHaveBeenCalled()
    })
  })

  test('ładuje nowy moduł wideo w oddzielnych komponentach', async () => {
    await import('../public/scripts/workspace/video/VideoPlayerController.js')
    await import('../public/scripts/workspace/video/VideoPlayerUI.js')
    expect(true).toBe(true)
  })

  test('follows the active trial: loads its video, clears it when empty, and saves a picked file to the trial', async () => {
    const trialCatalog = {
      getActiveTrial: () => ({ id: 'trial-1', videoPath: 'C:/videos/one.mp4' }),
      updateTrial: jest.fn(async () => {})
    }
    const states = jest.fn()
    window.addEventListener('video-timeline-state', states)

    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
    const video = document.getElementById('video-player')
    expect(video.getAttribute('src')).toBe('file:///C:/videos/one.mp4')
    expect(states.mock.calls.at(-1)[0].detail.videoPath).toBe('C:/videos/one.mp4')

    window.dispatchEvent(new CustomEvent('active-trial-changed', {
      detail: { trial: { id: 'trial-2', videoPath: 'C:/videos/two.mp4' } }
    }))
    expect(video.getAttribute('src')).toBe('file:///C:/videos/two.mp4')

    window.dispatchEvent(new CustomEvent('active-trial-changed', {
      detail: { trial: { id: 'trial-3', videoPath: '' } }
    }))
    expect(video.hasAttribute('src')).toBe(false)
    expect(states.mock.calls.at(-1)[0].detail.videoPath).toBe('')

    window.electronAPI.selectVideoFile.mockResolvedValue('C:/videos/picked.mp4')
    document.getElementById('pick-video-btn').click()
    await flush()
    expect(video.getAttribute('src')).toBe('file:///C:/videos/picked.mp4')
    expect(trialCatalog.updateTrial).toHaveBeenCalledWith('trial-3', { videoPath: 'C:/videos/picked.mp4', sourcePath: '', frameRate: null })

    window.removeEventListener('video-timeline-state', states)
  })
})

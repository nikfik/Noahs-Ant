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
      setVideoPath: jest.fn(async () => {})
    }
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog })
    const empty = document.querySelector('.video-empty')
    expect(empty.hidden).toBe(false)

    window.electronAPI.selectVideoFile.mockResolvedValue('C:/videos/one.mp4')
    document.getElementById('pick-video-empty-btn').click()
    await flush()
    expect(empty.hidden).toBe(true)
    expect(trialCatalog.setVideoPath).toHaveBeenCalledWith('trial-1', 'C:/videos/one.mp4')

    window.dispatchEvent(new CustomEvent('active-trial-changed', { detail: { trial: { id: 'trial-2', videoPath: '' } } }))
    expect(empty.hidden).toBe(false)

    window.electronAPI.selectVideoFile.mockResolvedValue('C:/videos/two.mp4')
    document.getElementById('pick-video-btn').click()
    await flush()
    expect(document.getElementById('video-player').getAttribute('src')).toBe('file:///C:/videos/two.mp4')
    expect(empty.hidden).toBe(true)
  })

  test('ładuje nowy moduł wideo w oddzielnych komponentach', async () => {
    await import('../public/scripts/workspace/video/VideoPlayerController.js')
    await import('../public/scripts/workspace/video/VideoPlayerUI.js')
    expect(true).toBe(true)
  })

  test('follows the active trial: loads its video, clears it when empty, and saves a picked file to the trial', async () => {
    const trialCatalog = {
      getActiveTrial: () => ({ id: 'trial-1', videoPath: 'C:/videos/one.mp4' }),
      setVideoPath: jest.fn(async () => {})
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
    expect(trialCatalog.setVideoPath).toHaveBeenCalledWith('trial-3', 'C:/videos/picked.mp4')

    window.removeEventListener('video-timeline-state', states)
  })
})

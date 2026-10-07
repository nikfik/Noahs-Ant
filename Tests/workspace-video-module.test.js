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
    expect(markup).toContain('video-seek')
    expect(markup).toContain('video-speed')
    expect(markup).toContain('video-volume')
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

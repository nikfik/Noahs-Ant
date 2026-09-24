/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import '../public/scripts/workspace/workspace-video-module.js'

describe('WorkspaceVideoModule', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="video-module"></div>'
    window.electronAPI = {
      openProject: jest.fn().mockResolvedValue({ videoPath: '' }),
      selectVideoFile: jest.fn(),
      saveProjectVideoPath: jest.fn(),
    }
  })

  test('renderuje pełne kontrolki odtwarzania dla video', async () => {
    await window.WorkspaceVideoModule.init('video-module', { projectFile: 'demo.json' })

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
})

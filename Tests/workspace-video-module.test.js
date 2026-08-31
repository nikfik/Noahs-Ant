/**
 * @jest-environment jsdom
 */

const path = require('path')

describe('WorkspaceVideoModule', () => {
  beforeEach(() => {
    jest.resetModules()
    document.body.innerHTML = '<div id="video-module"></div>'
    window.electronAPI = {
      openProject: jest.fn().mockResolvedValue({ videoPath: '' }),
      selectVideoFile: jest.fn(),
      saveProjectVideoPath: jest.fn(),
    }
  })

  test('renderuje pełne kontrolki odtwarzania dla video', async () => {
    require(path.resolve(__dirname, '../public/scripts/workspace/workspace-video-module.js'))

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

  test('ładuje nowy moduł wideo w oddzielnych komponentach', () => {
    expect(() => require(path.resolve(__dirname, '../public/scripts/workspace/video/VideoPlayerController.js'))).not.toThrow()
    expect(() => require(path.resolve(__dirname, '../public/scripts/workspace/video/VideoPlayerUI.js'))).not.toThrow()
  })
})

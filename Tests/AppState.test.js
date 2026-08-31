/**
 * @jest-environment jsdom
 */

describe('AppState singleton', () => {
  beforeEach(() => {
    jest.resetModules()
    document.body.innerHTML = ''
    window.electronAPI = {
      openProject: jest.fn().mockResolvedValue({
        projectName: 'Demo',
        videoPath: 'demo.mp4',
        etogram: []
      })
    }
  })

  test('zwraca tę samą instancję singletona', () => {
    const { AppState } = require('../public/scripts/services/AppState.js')
    const state1 = AppState.getInstance()
    const state2 = AppState.getInstance()

    expect(state1).toBe(state2)
    expect(window.AppState.getInstance()).toBe(state1)
  })

  test('ładuje projekt i zapisuje stan w singletonie', async () => {
    const { AppState } = require('../public/scripts/services/AppState.js')
    const state = AppState.getInstance()

    const project = await state.loadProject('demo.json')

    expect(project.projectName).toBe('Demo')
    expect(state.getCurrentProject().projectName).toBe('Demo')
    expect(state.getTheme().bgColor).toBeDefined()
  })
})

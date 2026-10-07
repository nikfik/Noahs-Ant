/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { AppState } from '../public/scripts/services/AppState.js'

describe('AppState singleton', () => {
  beforeEach(() => {
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
    const state1 = AppState.getInstance()
    const state2 = AppState.getInstance()

    expect(state1).toBe(state2)
  })

  test('ładuje projekt i zapisuje stan w singletonie', async () => {
    const state = AppState.getInstance()

    const project = await state.loadProject('demo.json')

    expect(project.projectName).toBe('Demo')
    expect(state.getCurrentProject().projectName).toBe('Demo')
    expect(state.getTheme().bgColor).toBeDefined()
  })
})

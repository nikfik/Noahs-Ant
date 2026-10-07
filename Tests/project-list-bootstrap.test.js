/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('ProjectList bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span class="settings-tab"></span>
      <div id="project-grid"></div>
      <button id="new-project-btn"></button><button id="project-cancel-btn"></button>
      <button id="open-project-btn"></button><input id="project-name" />
      <div id="project-name-error"></div><form id="project-modal-form"></form>
      <div id="project-modal" class="hidden"></div>
    `
    window.projectUtils = { isValidProjectName: (name) => name.length >= 3 }
    window.WorkspaceRouter = { navigateToWorkspace: jest.fn() }
    window.electronAPI = {
      getTheme: jest.fn().mockResolvedValue(null),
      onThemeChange: jest.fn(),
      listProjects: jest.fn().mockResolvedValue([]),
      createProject: jest.fn().mockResolvedValue({ projectName: 'Demo', fileName: 'Demo' }),
      openSettingsWindow: jest.fn().mockResolvedValue(true)
    }
  })

  test('single bootstrap enables listing, New Project, and Settings handlers', async () => {
    await import('../public/scripts/app/project-list-init.js')
    document.dispatchEvent(new Event('DOMContentLoaded'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.electronAPI.listProjects).toHaveBeenCalled()

    document.getElementById('new-project-btn').click()
    expect(document.getElementById('project-modal').classList.contains('hidden')).toBe(false)

    document.getElementById('project-name').value = 'Demo Project'
    document.getElementById('project-modal-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(window.electronAPI.createProject).toHaveBeenCalledWith('Demo Project')

    document.querySelector('.settings-tab').click()
    expect(window.electronAPI.openSettingsWindow).toHaveBeenCalled()
  })
})

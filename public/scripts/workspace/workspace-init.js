import { AppState } from '../services/AppState.js'
import { UiToolbar } from '../ui-toolbar.js'
import { WorkspaceToolbar } from './workspace-toolbar.js'
import { WorkspaceRouter } from './workspace-router.js'
import { WorkspaceVideoModule } from './workspace-video-module.js'
import { WorkspaceEtogramModule } from './workspace-etogram-module.js'
import { WorkspaceEventsModule } from './workspace-events-module.js'

if (typeof window !== 'undefined') {
  window.AppState = AppState
  window.UiToolbar = UiToolbar
  window.WorkspaceToolbar = WorkspaceToolbar
  window.WorkspaceRouter = WorkspaceRouter
  window.WorkspaceVideoModule = WorkspaceVideoModule
  window.WorkspaceEtogramModule = WorkspaceEtogramModule
  window.WorkspaceEventsModule = WorkspaceEventsModule
}

export const initWorkspace = async () => {
  const appState = window.AppState?.getInstance?.()
  const backBtn = document.getElementById('back-to-projects')
  const optionsBtn = document.getElementById('options-btn')

  if (window.WorkspaceToolbar?.initWorkspaceToolbar) {
    window.WorkspaceToolbar.initWorkspaceToolbar()
  }

  const params = new URLSearchParams(window.location.search)
  const projectFile = params.get('project')

  // Initialize modules
  if (window.WorkspaceEtogramModule?.init) {
    try {
      await window.WorkspaceEtogramModule.init('etogram-module', { projectFile })
    } catch (error) {
      console.error('Failed to init etogram module:', error)
    }
  }

  if (window.WorkspaceEventsModule?.init) {
    try {
      window.WorkspaceEventsModule.init('events-module')
    } catch (error) {
      console.error('Failed to init events module:', error)
    }
  }

  if (projectFile && appState?.loadProject) {
    try {
      await appState.loadProject(projectFile)
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  if (window.WorkspaceVideoModule?.init) {
    try {
      await window.WorkspaceVideoModule.init('video-module', { projectFile })
    } catch (error) {
      console.error('Failed to init video module:', error)
    }
  }

  // Bind button listeners
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'ProjectList.html'
    })
  }

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      if (window.electronAPI?.openSettingsWindow) {
        window.electronAPI.openSettingsWindow()
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initWorkspace().catch((error) => console.error('Workspace init failed:', error))
})

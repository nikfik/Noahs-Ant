import { AppState } from '../services/AppState.js'
import { initWorkspaceToolbar } from './workspace-toolbar.js'
import { WorkspaceVideoModule } from './workspace-video-module.js'
import { WorkspaceEtogramModule } from './workspace-etogram-module.js'
import { AnimalCatalogModule } from './animals/animal-catalog-module.js'
import { WorkspaceTimelineModule } from './workspace-timeline-module.js'

async function initModule(name, init) {
  try {
    return await init()
  } catch (error) {
    console.error(`Failed to init ${name}:`, error)
    return null
  }
}

export const initWorkspace = async () => {
  const appState = AppState.getInstance()
  const backBtn = document.getElementById('back-to-projects')
  const optionsBtn = document.getElementById('options-btn')

  initWorkspaceToolbar()

  const params = new URLSearchParams(window.location.search)
  const projectFile = params.get('project')

  const animalCatalog = projectFile
    ? await initModule('animal catalog', () => AnimalCatalogModule.init('animal-panel', { projectId: projectFile }))
    : null

  await initModule('etogram module', () => WorkspaceEtogramModule.init('etogram-module', { projectFile, animalCatalog }))
  await initModule('timeline module', () => WorkspaceTimelineModule.init('events-module', { projectId: projectFile, animalCatalog }))

  if (projectFile) {
    await initModule('project state', () => appState.loadProject(projectFile))
  }

  await initModule('video module', () => WorkspaceVideoModule.init('video-module', { projectFile }))

  backBtn?.addEventListener('click', () => {
    window.location.href = 'ProjectList.html'
  })

  optionsBtn?.addEventListener('click', () => {
    window.electronAPI?.openSettingsWindow?.()
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initWorkspace().catch((error) => console.error('Workspace init failed:', error))
})

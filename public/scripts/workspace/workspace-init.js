import { AppState } from '../services/AppState.js'
import { initWorkspaceToolbar } from './workspace-toolbar.js'
import { WorkspaceVideoModule } from './workspace-video-module.js'
import { WorkspaceEtogramModule } from './workspace-etogram-module.js'
import { AnimalCatalogModule } from './animals/animal-catalog-module.js'
import { TrialCatalogModule } from './trials/trial-catalog-module.js'
import { WorkspaceTimelineModule } from './workspace-timeline-module.js'
import { createObservationStore } from './observations/observation-store.js'
import { DataEventsModule } from './data/data-events-module.js'
import { DataMetricsModule } from './data/data-metrics-module.js'
import { initDataTabs } from './data/data-tabs.js'
import { initViewSwitcher } from './workspace-view-switcher.js'

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
  initViewSwitcher(['view-video', 'view-data', 'view-analysis'])

  const params = new URLSearchParams(window.location.search)
  const projectFile = params.get('project')

  const animalCatalog = projectFile
    ? await initModule('animal catalog', () => AnimalCatalogModule.init('animal-panel', { projectId: projectFile }))
    : null

  const trialCatalog = projectFile
    ? await initModule('trial catalog', () => TrialCatalogModule.init('trial-panel', { projectId: projectFile }))
    : null

  const observationStore = createObservationStore({ projectId: projectFile || '', api: window.electronAPI })
  await observationStore.load()
  window.addEventListener('trial-removed', (event) => {
    observationStore.removeTrialEvents(event.detail?.trialId).catch((error) => console.error('Failed to remove trial events:', error))
  })

  await initModule('etogram module', () => WorkspaceEtogramModule.init('etogram-module', { projectFile, animalCatalog }))
  await initModule('timeline module', () => WorkspaceTimelineModule.init('events-module', { animalCatalog, trialCatalog, observationStore }))
  await initModule('data events module', () => DataEventsModule.init('data-module', { observationStore, animalCatalog, trialCatalog }))
  await initModule('data metrics module', () => DataMetricsModule.init('data-metrics-module', { observationStore, animalCatalog, trialCatalog }))
  initDataTabs()

  if (projectFile) {
    await initModule('project state', () => appState.loadProject(projectFile))
  }

  await initModule('video module', () => WorkspaceVideoModule.init('video-module', { projectFile, trialCatalog }))

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

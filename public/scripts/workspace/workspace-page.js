document.addEventListener('DOMContentLoaded', async () => {
  const backBtn = document.getElementById('back-to-projects')
  const optionsBtn = document.getElementById('options-btn')

  window.WorkspaceToolbar?.initWorkspaceToolbar?.()

  const params = new URLSearchParams(window.location.search)
  const projectFile = params.get('project')

  window.WorkspaceEtogramModule?.init?.('etogram-module', { projectFile })
  window.WorkspaceEventsModule?.init?.('events-module')

  if (projectFile) {
    try {
      await window.electronAPI.openProject(projectFile)
    } catch (error) {
      console.error('Nie udało się wczytać projektu:', error)
    }
  }

  window.WorkspaceVideoModule?.init?.('video-module', { projectFile })

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
})

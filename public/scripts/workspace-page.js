document.addEventListener('DOMContentLoaded', async () => {
  const backBtn = document.getElementById('back-to-projects')
  const titleEl = document.getElementById('workspace-project-title')
  const infoEl = document.getElementById('workspace-project-info')

  const params = new URLSearchParams(window.location.search)
  const projectFile = params.get('project')

  if (!projectFile) {
    titleEl.textContent = 'Brak projektu'
    infoEl.textContent = 'Nie podano pliku projektu. Wróć do listy projektów.'
    return
  }

  try {
    const project = await window.electronAPI.openProject(projectFile)
    titleEl.textContent = project.projectName
    infoEl.textContent = `Ostatnie otwarcie: ${new Date(project.MostRecentOpen).toLocaleString()}`
  } catch (error) {
    console.error('Nie udało się wczytać projektu:', error)
    titleEl.textContent = 'Błąd ładowania projektu'
    infoEl.textContent = 'Sprawdź, czy projekt istnieje, i wróć do listy.'
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = 'ProjectList.html'
    })
  }
})

document.addEventListener('DOMContentLoaded', async () => {
  const settingsTab = document.querySelector('.settings-tab')
  const newProjectBtn = document.getElementById('new-project-btn')
  const openProjectBtn = document.getElementById('open-project-btn')
  const projectGrid = document.getElementById('project-grid')
  const projectStatus = document.getElementById('project-status')
  const projectModal = document.getElementById('project-modal')
  const projectModalForm = document.getElementById('project-modal-form')
  const projectNameInput = document.getElementById('project-name')
  const projectCancelBtn = document.getElementById('project-cancel-btn')
  const projectNameError = document.getElementById('project-name-error')

  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      window.electronAPI.openSettingsWindow()
    })
  }

  const openProjectModal = () => {
    projectNameInput.value = ''
    projectNameError.textContent = ''
    projectNameError.classList.remove('visible')
    projectModal.classList.remove('hidden')
    projectNameInput.focus()
  }

  const closeProjectModal = () => {
    projectModal.classList.add('hidden')
  }

  const showProjectNameError = (message) => {
    projectNameError.textContent = message
    projectNameError.classList.toggle('visible', Boolean(message))
  }

  const applyTheme = (theme) => {
    if (!theme) return

    document.documentElement.style.setProperty('--bg-color', theme.bgColor || '#1a1a1a')
    document.documentElement.style.setProperty('--text-color', theme.textColor || '#e0e0e0')
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor || '#ff4f1a')
  }

  const refreshProjectList = async () => {
    const projects = await window.electronAPI.listProjects()
    const selectedFile = projectGrid.dataset.selectedFile || ''

    if (!projects.length) {
      projectGrid.innerHTML = '<div class="project-empty">Brak zapisanych projektów. Utwórz nowy projekt, aby rozpocząć.</div>'
      projectGrid.removeAttribute('data-selected-file')
      //projectStatus.textContent = 'Brak aktywnego projektu'
      return
    }

    projectGrid.innerHTML = projects
      .map((project) => `
        <div class="project-card" data-file="${project.fileName}">
          <div class="thumbnail">
            <span class="thumbnail-label">${project.projectName.charAt(0) || 'P'}</span>
          </div>
          <p class="project-name">${project.projectName}</p>
          <div class="project-meta">Utworzone: ${new Date(project.createdAt).toLocaleString()}</div>
        </div>
      `)
      .join('')

    projectGrid.querySelectorAll('.project-card').forEach((card) => {
      card.addEventListener('click', () => {
        // select the tile (do not open immediately) so user can press Open
        projectGrid.querySelectorAll('.project-card.selected').forEach((selected) => {
          selected.classList.remove('selected')
        })
        card.classList.add('selected')
        projectGrid.dataset.selectedFile = card.dataset.file
        projectStatus.textContent = `Wybrano projekt: ${card.querySelector('.project-name').textContent}`
      })
    })

    if (selectedFile) {
      const selectedCard = projectGrid.querySelector(`[data-file="${selectedFile}"]`)
      if (selectedCard) {
        selectedCard.classList.add('selected')
      }
    }
  }

  const currentTheme = await window.electronAPI.getTheme()
  applyTheme(currentTheme)
  await refreshProjectList()

  newProjectBtn.addEventListener('click', () => {
    openProjectModal()
  })

  projectCancelBtn.addEventListener('click', () => {
    closeProjectModal()
  })

  projectModal.addEventListener('click', (event) => {
    if (event.target === projectModal) {
      closeProjectModal()
    }
  })

  projectNameInput.addEventListener('input', () => {
    if (window.projectUtils?.isValidProjectName(projectNameInput.value.trim())) {
      showProjectNameError('')
    }
  })

  projectModalForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const projectName = projectNameInput.value.trim()
    if (!window.projectUtils?.isValidProjectName(projectName)) {
      showProjectNameError('Nazwa projektu musi mieć co najmniej 3 znaki i nie może zawierać <>:"/\\|?*')
      return
    }

    const project = await window.electronAPI.createProject(projectName)
    projectStatus.textContent = `Utworzono projekt: ${project.projectName}`
    closeProjectModal()
    await refreshProjectList()
    navigateToWorkspace(project)
  })

  openProjectBtn.addEventListener('click', async () => {
    const selectedCard = projectGrid.querySelector('.project-card.selected')
    if (selectedCard) {
      const fileName = selectedCard.dataset.file
      const project = await window.electronAPI.openProject(fileName)
      projectStatus.textContent = `Otwarty projekt: ${project.projectName}`
      await refreshProjectList()
      navigateToWorkspace(project)
      return
    }

    const projects = await window.electronAPI.listProjects()
    if (!projects.length) {
      alert('Brak dostępnych projektów do otwarcia.')
      return
    }

    const options = projects.map((project, index) => `${index + 1}. ${project.projectName}`).join('\n')
    const choice = window.prompt(`Wybierz numer projektu do otwarcia:\n${options}`)
    const selectedIndex = Number(choice) - 1
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= projects.length) {
      return
    }

    const project = await window.electronAPI.openProject(projects[selectedIndex].fileName)
    projectStatus.textContent = `Otwarty projekt: ${project.projectName}`
    await refreshProjectList()
    navigateToWorkspace(project)
  })

  function navigateToWorkspace(project) {
    if (!project) return
    window.location.href = `Workspace.html?project=${encodeURIComponent(project.fileName)}`
  }

  window.electronAPI.onThemeChange(applyTheme)
})

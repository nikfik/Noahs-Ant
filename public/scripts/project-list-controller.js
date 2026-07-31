(function () {
  const projectModal = document.getElementById('project-modal')
  const projectModalForm = document.getElementById('project-modal-form')
  const projectNameInput = document.getElementById('project-name')
  const projectCancelBtn = document.getElementById('project-cancel-btn')
  const projectNameError = document.getElementById('project-name-error')
  const newProjectBtn = document.getElementById('new-project-btn')
  const openProjectBtn = document.getElementById('open-project-btn')
  const projectGrid = document.getElementById('project-grid')
  const projectStatus = document.getElementById('project-status')

  function openProjectModal() {
    projectNameInput.value = ''
    projectNameError.textContent = ''
    projectNameError.classList.remove('visible')
    projectModal.classList.remove('hidden')
    projectNameInput.focus()
  }

  function closeProjectModal() {
    projectModal.classList.add('hidden')
  }

  function showProjectNameError(message) {
    projectNameError.textContent = message
    projectNameError.classList.toggle('visible', Boolean(message))
  }

  async function refreshProjectList() {
    const projects = await window.electronAPI.listProjects()
    const selectedFile = projectGrid.dataset.selectedFile || ''

    if (!projects.length) {
      projectGrid.innerHTML = '<div class="project-empty">Brak zapisanych projektów. Utwórz nowy projekt, aby rozpocząć.</div>'
      projectGrid.removeAttribute('data-selected-file')
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

  async function handleCreateProject(event) {
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
    window.WorkspaceRouter.navigateToWorkspace(project)
  }

  async function handleOpenProject() {
    const selectedCard = projectGrid.querySelector('.project-card.selected')
    if (selectedCard) {
      const fileName = selectedCard.dataset.file
      const project = await window.electronAPI.openProject(fileName)
      projectStatus.textContent = `Otwarty projekt: ${project.projectName}`
      await refreshProjectList()
      window.WorkspaceRouter.navigateToWorkspace(project)
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
    window.WorkspaceRouter.navigateToWorkspace(project)
  }

  async function initProjectList() {
    newProjectBtn.addEventListener('click', openProjectModal)
    projectCancelBtn.addEventListener('click', closeProjectModal)
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

    projectModalForm.addEventListener('submit', handleCreateProject)
    openProjectBtn.addEventListener('click', handleOpenProject)

    await refreshProjectList()
  }

  window.ProjectListController = {
    initProjectList,
    refreshProjectList,
  }
})()

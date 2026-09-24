import fs from 'node:fs'
import path from 'node:path'

export function createProjectStore(projectsDirectory) {
  function ensureProjectsDirectory() {
    if (!fs.existsSync(projectsDirectory)) {
      fs.mkdirSync(projectsDirectory, { recursive: true })
    }
  }

  function sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-').trim()
  }

  function readProjectFile(fileName) {
    const filePath = path.join(projectsDirectory, fileName)
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  }

  function writeProjectFile(fileName, project) {
    fs.writeFileSync(path.join(projectsDirectory, fileName), JSON.stringify(project, null, 2), 'utf8')
    return { fileName, ...project }
  }

  function listProjectFiles() {
    ensureProjectsDirectory()
    return fs.readdirSync(projectsDirectory).filter((name) => name.toLowerCase().endsWith('.json'))
  }

  function createProject(projectName) {
    ensureProjectsDirectory()
    const name = projectName || 'Untitled Project'
    const safeName = sanitizeFileName(name) || 'Untitled-Project'
    let fileName = `${safeName}.json`
    let counter = 1

    while (fs.existsSync(path.join(projectsDirectory, fileName))) {
      fileName = `${safeName}-${counter}.json`
      counter += 1
    }

    const now = new Date().toISOString()
    return writeProjectFile(fileName, {
      projectName: name,
      createdAt: now,
      MostRecentOpen: now,
      etogram: [],
      videoPath: ''
    })
  }

  function listProjects() {
    return listProjectFiles().map((fileName) => {
      try {
        return { fileName, ...readProjectFile(fileName) }
      } catch (_error) {
        return null
      }
    }).filter(Boolean)
  }

  function openProject(fileName) {
    ensureProjectsDirectory()
    const project = readProjectFile(fileName)
    project.etogram = Array.isArray(project.etogram) ? project.etogram : []
    project.videoPath = typeof project.videoPath === 'string' ? project.videoPath : ''
    project.MostRecentOpen = new Date().toISOString()
    return writeProjectFile(fileName, project)
  }

  function saveProjectVideo(fileName, videoPath) {
    ensureProjectsDirectory()
    const project = readProjectFile(fileName)
    project.videoPath = videoPath
    project.MostRecentOpen = new Date().toISOString()
    return writeProjectFile(fileName, project)
  }

  function saveProjectEtogram(fileName, etogramRows) {
    ensureProjectsDirectory()
    const project = readProjectFile(fileName)
    project.etogram = Array.isArray(etogramRows) ? etogramRows : []
    project.MostRecentOpen = new Date().toISOString()
    return writeProjectFile(fileName, project)
  }

  return {
    createProject,
    listProjects,
    openProject,
    saveProjectVideo,
    saveProjectEtogram
  }
}
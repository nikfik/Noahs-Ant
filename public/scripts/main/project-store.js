import fs from 'node:fs'
import path from 'node:path'

export function createProjectStore(projectsDirectory) {
  function ensureProjectsDirectory() {
    if (!fs.existsSync(projectsDirectory)) {
      fs.mkdirSync(projectsDirectory, { recursive: true })
    }

    migrateLegacyProjectFiles()
  }

  function sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-').trim()
  }

  function getProjectDirectoryPath(projectId) {
    return path.join(projectsDirectory, projectId)
  }

  function getProjectIniPath(projectId) {
    return path.join(getProjectDirectoryPath(projectId), `${projectId}_ini.json`)
  }

  function readProjectFile(projectId) {
    const filePath = getProjectIniPath(projectId)
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  }

  function writeProjectFile(projectId, project) {
    fs.mkdirSync(getProjectDirectoryPath(projectId), { recursive: true })
    fs.writeFileSync(getProjectIniPath(projectId), JSON.stringify(project, null, 2), 'utf8')
    return { fileName: projectId, projectId, ...project }
  }

  function migrateLegacyProjectFiles() {
    const legacyFiles = fs.readdirSync(projectsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))

    legacyFiles.forEach((entry) => {
      const projectId = sanitizeFileName(path.basename(entry.name, '.json'))
      if (!projectId || fs.existsSync(getProjectIniPath(projectId))) {
        return
      }

      try {
        const project = JSON.parse(fs.readFileSync(path.join(projectsDirectory, entry.name), 'utf8'))
        writeProjectFile(projectId, project)
        console.log('[main] migrated legacy project:', entry.name, '->', projectId)
      } catch (error) {
        console.error('[main] legacy project migration failed:', entry.name, error)
      }
    })
  }

  function listProjectDirectories() {
    ensureProjectsDirectory()
    return fs.readdirSync(projectsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((projectId) => fs.existsSync(getProjectIniPath(projectId)))
  }

  function createProject(projectName) {
    ensureProjectsDirectory()
    const name = projectName || 'Untitled Project'
    const safeName = sanitizeFileName(name) || 'Untitled-Project'
    let projectId = safeName
    let counter = 1

    while (fs.existsSync(getProjectDirectoryPath(projectId))) {
      projectId = `${safeName}-${counter}`
      counter += 1
    }

    const now = new Date().toISOString()
    return writeProjectFile(projectId, {
      projectName: name,
      createdAt: now,
      MostRecentOpen: now,
      etogram: [],
      videoPath: ''
    })
  }

  function listProjects() {
    console.log('[main] project-store.listProjects:', projectsDirectory)
    return listProjectDirectories().map((projectId) => {
      try {
        const project = readProjectFile(projectId)
        console.log('[main] project read:', projectId)
        return { fileName: projectId, projectId, ...project }
      } catch (error) {
        console.error('[main] project read failed:', projectId, error)
        return null
      }
    }).filter(Boolean)
  }

  function openProject(projectId) {
    ensureProjectsDirectory()
    const project = readProjectFile(projectId)
    project.etogram = Array.isArray(project.etogram) ? project.etogram : []
    project.videoPath = typeof project.videoPath === 'string' ? project.videoPath : ''
    project.MostRecentOpen = new Date().toISOString()
    return writeProjectFile(projectId, project)
  }

  function saveProjectEtogram(projectId, etogramRows) {
    ensureProjectsDirectory()
    const project = readProjectFile(projectId)
    project.etogram = Array.isArray(etogramRows) ? etogramRows : []
    project.MostRecentOpen = new Date().toISOString()
    return writeProjectFile(projectId, project)
  }

  return {
    createProject,
    listProjects,
    openProject,
    saveProjectEtogram
  }
}
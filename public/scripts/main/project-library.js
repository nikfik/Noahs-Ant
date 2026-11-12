// What the project list and the video panel need to know about projects and files on disk.
import { t } from '../shared/i18n.js'
import fs from 'node:fs'
import path from 'node:path'
import { readProjectData } from './project-bundle.js'

const MAX_PATHS = 500

export function createProjectLibrary({ projectsDirectory }) {
  const folderOf = (projectId) => {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) throw new Error(t('Nieprawidłowy projekt.'))
    return path.join(projectsDirectory, projectId)
  }

  function folderSize(folder) {
    let total = 0
    try {
      fs.readdirSync(folder, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(folder, entry.name)
        total += entry.isDirectory() ? folderSize(full) : fs.statSync(full).size
      })
    } catch (_error) {
      // A file that disappears while counting is simply not counted.
    }
    return total
  }

  function pathsExist(paths) {
    if (!Array.isArray(paths) || paths.length > MAX_PATHS) throw new Error(t('Nieprawidłowa lista plików.'))
    return paths.map((file) => typeof file === 'string' && file !== '' && fs.existsSync(file))
  }

  function getProjectInfo(projectId) {
    const folder = folderOf(projectId)
    const data = readProjectData(projectsDirectory, projectId)
    const trials = data.trials?.trials || []
    const videos = [...new Set(trials.map((trial) => trial.videoPath).filter((file) => typeof file === 'string' && file))]
    const backupsFolder = path.join(folder, 'backups')

    return {
      projectId,
      projectName: data.ini?.projectName || projectId,
      createdAt: data.ini?.createdAt || null,
      lastOpened: data.ini?.MostRecentOpen || null,
      counts: { trials: trials.length, animals: data.animals?.animals?.length || 0, events: data.observations?.observations?.length || 0 },
      sizeBytes: folderSize(folder),
      backupCount: fs.existsSync(backupsFolder) ? fs.readdirSync(backupsFolder).filter((name) => name.endsWith('.nsant')).length : 0,
      videos: { total: videos.length, missing: pathsExist(videos).filter((exists) => !exists).length }
    }
  }

  // Looks for files with the given names in one folder (not in its subfolders), e.g. after a folder was moved.
  function findFilesInFolder(folder, names) {
    if (typeof folder !== 'string' || !folder || !Array.isArray(names) || names.length > MAX_PATHS) throw new Error(t('Nieprawidłowe zapytanie.'))
    let entries = []
    try {
      entries = fs.readdirSync(folder)
    } catch (_error) {
      return {}
    }
    const byLowerName = new Map(entries.map((entry) => [entry.toLowerCase(), entry]))
    return Object.fromEntries(names
      .filter((name) => typeof name === 'string' && name && byLowerName.has(name.toLowerCase()))
      .map((name) => [name, path.join(folder, byLowerName.get(name.toLowerCase()))]))
  }

  // The folder goes to the Recycle Bin, so deleting a project by mistake can be undone.
  async function deleteProject(projectId, trashItem) {
    const folder = folderOf(projectId)
    if (!fs.existsSync(folder)) throw new Error(t('Tego projektu już nie ma.'))
    await trashItem(folder)
    return true
  }

  return { getProjectInfo, pathsExist, findFilesInFolder, deleteProject }
}

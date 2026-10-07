import fs from 'node:fs'
import path from 'node:path'
import { ensureDefaultTrial, normalizeTrialData } from '../workspace/trials/trial-model.js'

export function createTrialsStore(projectsDirectory) {
  function getProjectPaths(projectId) {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) {
      throw new Error('Invalid project identifier')
    }

    const projectDirectory = path.join(projectsDirectory, projectId)
    return {
      projectDirectory,
      filePath: path.join(projectDirectory, `${projectId}_trials.json`),
      iniPath: path.join(projectDirectory, `${projectId}_ini.json`)
    }
  }

  function readLegacyVideoPath(iniPath) {
    try {
      const project = JSON.parse(fs.readFileSync(iniPath, 'utf8'))
      return typeof project.videoPath === 'string' ? project.videoPath : ''
    } catch (_error) {
      return ''
    }
  }

  function write(projectId, value) {
    const { projectDirectory, filePath } = getProjectPaths(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    const data = normalizeTrialData(value)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    return data
  }

  function read(projectId) {
    const { projectDirectory, filePath, iniPath } = getProjectPaths(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    const stored = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {}
    const data = normalizeTrialData(stored)
    if (data.trials.length) return data

    return write(projectId, ensureDefaultTrial(data, readLegacyVideoPath(iniPath)))
  }

  return { read, write }
}

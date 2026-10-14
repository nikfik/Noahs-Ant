import fs from 'node:fs'
import path from 'node:path'
import { createEmptyObservationData, normalizeObservationData } from '../workspace/observations/observation-model.js'

export function createObservationsStore(projectsDirectory, { getDefaultTrialId = () => null } = {}) {
  function getObservationsPath(projectId) {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) {
      throw new Error('Invalid project identifier')
    }

    const projectDirectory = path.join(projectsDirectory, projectId)
    return {
      projectDirectory,
      filePath: path.join(projectDirectory, `${projectId}_observations.json`)
    }
  }

  function read(projectId) {
    const { projectDirectory, filePath } = getObservationsPath(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    if (!fs.existsSync(filePath)) {
      const empty = createEmptyObservationData()
      fs.writeFileSync(filePath, JSON.stringify(empty, null, 2), 'utf8')
      return empty
    }

    const data = normalizeObservationData(JSON.parse(fs.readFileSync(filePath, 'utf8')))
    const defaultTrialId = data.observations.some((item) => !item.trialId) ? getDefaultTrialId(projectId) : null
    if (!defaultTrialId) return data

    // Events recorded before trials existed belong to the project's first trial.
    data.observations.forEach((item) => { item.trialId = item.trialId || defaultTrialId })
    return write(projectId, data)
  }

  function write(projectId, value) {
    const { projectDirectory, filePath } = getObservationsPath(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    const data = normalizeObservationData(value)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    return data
  }

  return { read, write }
}

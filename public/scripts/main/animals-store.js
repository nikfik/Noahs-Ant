import fs from 'node:fs'
import path from 'node:path'
import { createEmptyAnimalData, createGroup, normalizeAnimalData } from '../workspace/animals/animal-model.js'

export function createAnimalsStore(projectsDirectory) {
  function getProjectPaths(projectId) {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) {
      throw new Error('Invalid project identifier')
    }

    const projectDirectory = path.join(projectsDirectory, projectId)
    return {
      projectDirectory,
      animalsPath: path.join(projectDirectory, `${projectId}_animals.json`),
      iniPath: path.join(projectDirectory, `${projectId}_ini.json`)
    }
  }

  function readProjectAnimals(projectId) {
    const { animalsPath, iniPath } = getProjectPaths(projectId)
    if (fs.existsSync(animalsPath)) {
      return normalizeAnimalData(JSON.parse(fs.readFileSync(animalsPath, 'utf8')))
    }

    const data = createEmptyAnimalData()
    if (fs.existsSync(iniPath)) {
      try {
        const project = JSON.parse(fs.readFileSync(iniPath, 'utf8'))
        if (Array.isArray(project.etogram) && project.etogram.length) {
          const migrated = createGroup(data, 'Grupa 1')
          migrated.etogramPresets[0].name = 'Etogram domyślny'
          migrated.etogramPresets[0].activities = project.etogram
          return writeProjectAnimals(projectId, migrated)
        }
      } catch (error) {
        console.error('[main] failed to migrate legacy etogram:', projectId, error)
      }
    }

    return writeProjectAnimals(projectId, data)
  }

  function writeProjectAnimals(projectId, value) {
    const { projectDirectory, animalsPath } = getProjectPaths(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    const data = normalizeAnimalData(value)
    fs.writeFileSync(animalsPath, JSON.stringify(data, null, 2), 'utf8')
    return data
  }

  return { readProjectAnimals, writeProjectAnimals }
}

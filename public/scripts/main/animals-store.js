import fs from 'node:fs'
import path from 'node:path'
import { createEmptyAnimalData, createGroup, createId, normalizeAnimalData } from '../workspace/animals/animal-model.js'

export function createAnimalsStore(projectsDirectory) {
  function getProjectPaths(projectId) {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) {
      throw new Error('Invalid project identifier')
    }

    const projectDirectory = path.join(projectsDirectory, projectId)
    return {
      projectDirectory,
      animalsPath: path.join(projectDirectory, `${projectId}_animals.json`),
      etogramsPath: path.join(projectDirectory, `${projectId}_etograms.json`),
      iniPath: path.join(projectDirectory, `${projectId}_ini.json`)
    }
  }

  function readProjectAnimals(projectId) {
    const { animalsPath, etogramsPath, iniPath, projectDirectory } = getProjectPaths(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    let storedAnimals = {}
    let migratedPresets = []
    if (fs.existsSync(animalsPath)) {
      storedAnimals = JSON.parse(fs.readFileSync(animalsPath, 'utf8'))
      migratedPresets = Array.isArray(storedAnimals.etogramPresets) ? storedAnimals.etogramPresets : []
    }

    const data = normalizeAnimalData(storedAnimals)
    if (!data.groups.length && fs.existsSync(iniPath)) {
      try {
        const project = JSON.parse(fs.readFileSync(iniPath, 'utf8'))
        if (Array.isArray(project.etogram) && project.etogram.length) {
          const migrated = createGroup(data, 'Grupa 1')
          const presetId = createId('etogram')
          migratedPresets.push({ id: presetId, name: 'Etogram domyślny', activities: project.etogram })
          Object.assign(data, migrated)
        }
      } catch (error) {
        console.error('[main] failed to migrate legacy etogram:', projectId, error)
      }
    }

    let presets = []
    if (fs.existsSync(etogramsPath)) {
      presets = normalizeEtogramPresets(JSON.parse(fs.readFileSync(etogramsPath, 'utf8')))
    } else {
      presets = normalizeEtogramPresets(migratedPresets)
      writeProjectEtograms(projectId, presets)
    }

    const presetIds = new Set(presets.map((preset) => preset.id))
    data.animals.forEach((animal) => {
      if (!presetIds.has(animal.etogramPresetId)) {
        const inheritedPresetId = data.animals.find((candidate) =>
          candidate.groupId === animal.groupId && presetIds.has(candidate.etogramPresetId)
        )?.etogramPresetId
        if (inheritedPresetId) {
          animal.etogramPresetId = inheritedPresetId
          return
        }
        const presetId = createId('etogram')
        animal.etogramPresetId = presetId
        const group = data.groups.find((item) => item.id === animal.groupId)
        presets.push({ id: presetId, name: `${group?.name || animal.name} — etogram`, activities: [] })
      }
    })
    writeProjectEtograms(projectId, presets)
    writeProjectAnimals(projectId, data)
    return { ...data, etogramPresets: presets }
  }

  function writeProjectAnimals(projectId, value) {
    const { projectDirectory, animalsPath } = getProjectPaths(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    const data = normalizeAnimalData(value)
    fs.writeFileSync(animalsPath, JSON.stringify(data, null, 2), 'utf8')
    return data
  }

  function readProjectEtograms(projectId) {
    const { etogramsPath } = getProjectPaths(projectId)
    if (!fs.existsSync(etogramsPath)) {
      readProjectAnimals(projectId)
    }
    if (!fs.existsSync(etogramsPath)) return []
    return normalizeEtogramPresets(JSON.parse(fs.readFileSync(etogramsPath, 'utf8')))
  }

  function writeProjectEtograms(projectId, value) {
    const { projectDirectory, etogramsPath } = getProjectPaths(projectId)
    fs.mkdirSync(projectDirectory, { recursive: true })
    const presets = normalizeEtogramPresets(value)
    fs.writeFileSync(etogramsPath, JSON.stringify({ version: 1, presets }, null, 2), 'utf8')
    return presets
  }

  function normalizeEtogramPresets(value) {
    const presets = Array.isArray(value) ? value : Array.isArray(value?.presets) ? value.presets : []
    return presets.map((preset) => ({
      id: String(preset.id || createId('etogram')),
      name: String(preset.name || 'Nowy etogram'),
      activities: Array.isArray(preset.activities) ? preset.activities : []
    }))
  }

  return { readProjectAnimals, writeProjectAnimals, readProjectEtograms, writeProjectEtograms }
}

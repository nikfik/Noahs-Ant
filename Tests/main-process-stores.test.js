import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProjectStore } from '../public/scripts/main/project-store.js'
import { createAnimalsStore } from '../public/scripts/main/animals-store.js'
import { createSettingsStore } from '../public/scripts/main/settings-store.js'
import { createThemeState } from '../public/scripts/main/theme-state.js'
import { createDefaultAppSettings } from '../public/scripts/settings/settings-config.js'

describe('main process stores', () => {
  test('keeps theme state in one place', () => {
    const themeState = createThemeState()

    expect(themeState.get().bgColor).toBe('#1a1a1a')
    expect(themeState.set({ primaryColor: '#00ff00' })).toEqual({
      bgColor: '#1a1a1a',
      textColor: '#e0e0e0',
      primaryColor: '#00ff00'
    })
  })

  test('reads and writes normalized settings', () => {
    const settingsPath = path.join(os.tmpdir(), `noahs-ant-settings-${Date.now()}.json`)
    const settingsStore = createSettingsStore(settingsPath)

    expect(settingsStore.readAppSettings()).toEqual(createDefaultAppSettings())
    settingsStore.writeAppSettings({
      theme: { bgColor: '#abcdef' },
      graphics: { 'motion-blur': false },
      programShortcuts: [{ id: 'move-forward', value: 'Q' }],
      projectShortcuts: ['project shortcut'],
      invalid: true
    })

    const settings = settingsStore.readAppSettings()
    expect(settings.theme.bgColor).toBe('#abcdef')
    expect(settings.graphics['motion-blur']).toBe(false)
    expect(settings.programShortcuts[0].value.primary).toBe('Q')
    expect(settings.projectShortcuts).toEqual(['project shortcut'])
    expect(settings.invalid).toBeUndefined()

    fs.rmSync(settingsPath, { force: true })
  })

  test('creates and opens a project through the project store', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-projects-'))
    const projectStore = createProjectStore(projectsDirectory)

    const created = projectStore.createProject('Demo project')
    const opened = projectStore.openProject(created.fileName)

    expect(created.fileName).toBe('Demo-project')
    expect(fs.existsSync(path.join(projectsDirectory, 'Demo-project', 'Demo-project_ini.json'))).toBe(true)
    expect(opened.projectName).toBe('Demo project')
    expect(projectStore.listProjects()).toHaveLength(1)

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })

  test('migrates legacy root project files into project directories', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-legacy-'))
    fs.writeFileSync(path.join(projectsDirectory, 'Legacy.json'), JSON.stringify({
      projectName: 'Legacy',
      createdAt: '2026-01-01T00:00:00.000Z'
    }), 'utf8')

    const projectStore = createProjectStore(projectsDirectory)
    const projects = projectStore.listProjects()

    expect(projects).toHaveLength(1)
    expect(projects[0].fileName).toBe('Legacy')
    expect(fs.existsSync(path.join(projectsDirectory, 'Legacy', 'Legacy_ini.json'))).toBe(true)
    expect(fs.existsSync(path.join(projectsDirectory, 'Legacy.json'))).toBe(true)

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })

  test('creates a per-project animals JSON file and migrates its legacy etogram', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-animals-'))
    const projectDirectory = path.join(projectsDirectory, 'Study')
    fs.mkdirSync(projectDirectory)
    fs.writeFileSync(path.join(projectDirectory, 'Study_ini.json'), JSON.stringify({
      projectName: 'Study',
      etogram: [{ id: 'act-1', name: 'Bieganie', shortcut: 'B' }]
    }), 'utf8')

    const store = createAnimalsStore(projectsDirectory)
    const animals = store.readProjectAnimals('Study')
    const animalsPath = path.join(projectDirectory, 'Study_animals.json')

    expect(fs.existsSync(animalsPath)).toBe(true)
    expect(animals.groups).toHaveLength(1)
    expect(animals.groups[0].name).toBe('Grupa 1')
    expect(animals.etogramPresets[0].activities[0].name).toBe('Bieganie')
    const animalFile = JSON.parse(fs.readFileSync(animalsPath, 'utf8'))
    const etogramsPath = path.join(projectDirectory, 'Study_etograms.json')
    const etogramsFile = JSON.parse(fs.readFileSync(etogramsPath, 'utf8'))
    expect(animalFile.etogramPresets).toBeUndefined()
    expect(etogramsFile.presets[0].activities[0].name).toBe('Bieganie')
    expect(store.readProjectAnimals('Study').groups).toHaveLength(1)

    const extraPreset = { id: 'shared-preset', name: 'Wspólny', activities: [] }
    store.writeProjectEtograms('Study', [...store.readProjectEtograms('Study'), extraPreset])
    expect(store.readProjectEtograms('Study')).toContainEqual(extraPreset)

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })

  test('migrates preset IDs from legacy groups to their animals in the saved schema', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-animal-presets-'))
    const projectDirectory = path.join(projectsDirectory, 'Study')
    fs.mkdirSync(projectDirectory)
    fs.writeFileSync(path.join(projectDirectory, 'Study_animals.json'), JSON.stringify({
      version: 1,
      groups: [{ id: 'group-a', name: 'Mrówki', etogramPresetId: 'preset-a' }],
      animals: [
        { id: 'ant-a', groupId: 'group-a', name: 'Mrówka A', color: '#42a56b' },
        { id: 'ant-b', groupId: 'group-a', name: 'Mrówka B', color: '#448aff' }
      ]
    }), 'utf8')
    fs.writeFileSync(path.join(projectDirectory, 'Study_etograms.json'), JSON.stringify({
      version: 1,
      presets: [{ id: 'preset-a', name: 'Mrówki', activities: [] }]
    }), 'utf8')

    const animals = createAnimalsStore(projectsDirectory).readProjectAnimals('Study')
    const saved = JSON.parse(fs.readFileSync(path.join(projectDirectory, 'Study_animals.json'), 'utf8'))

    expect(animals.groups[0].etogramPresetId).toBeUndefined()
    expect(animals.animals.map((animal) => animal.etogramPresetId)).toEqual(['preset-a', 'preset-a'])
    expect(saved.groups[0].etogramPresetId).toBeUndefined()
    expect(saved.animals.map((animal) => animal.etogramPresetId)).toEqual(['preset-a', 'preset-a'])

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })
})
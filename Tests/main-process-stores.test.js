import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProjectStore } from '../public/scripts/main/project-store.js'
import { createAnimalsStore } from '../public/scripts/main/animals-store.js'
import { createObservationsStore } from '../public/scripts/main/observations-store.js'
import { createSettingsStore } from '../public/scripts/main/settings-store.js'
import { createTrialsStore } from '../public/scripts/main/trials-store.js'
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
      timeline: { snapEnabled: false, snapThresholdPx: 14 },
      programShortcuts: [{ id: 'play-pause', value: 'Q' }],
      projectShortcuts: ['project shortcut'],
      invalid: true
    })

    const settings = settingsStore.readAppSettings()
    expect(settings.theme.bgColor).toBe('#abcdef')
    expect(settings.timeline).toEqual({ snapEnabled: false, snapThresholdPx: 14 })
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

  test('creates the first trial from the legacy project video and persists trial changes', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-trials-'))
    const projectDirectory = path.join(projectsDirectory, 'Study')
    fs.mkdirSync(projectDirectory)
    fs.writeFileSync(path.join(projectDirectory, 'Study_ini.json'), JSON.stringify({
      projectName: 'Study',
      videoPath: 'C:/videos/old.mp4'
    }), 'utf8')

    const store = createTrialsStore(projectsDirectory)
    const data = store.read('Study')
    expect(data.trials).toHaveLength(1)
    expect(data.trials[0]).toMatchObject({ name: 'Próba 1', videoPath: 'C:/videos/old.mp4' })
    expect(fs.existsSync(path.join(projectDirectory, 'Study_trials.json'))).toBe(true)

    const written = store.write('Study', { ...data, trials: [{ ...data.trials[0], name: 'A2M1 / Head / 1' }] })
    expect(store.read('Study').trials[0].name).toBe('A2M1 / Head / 1')
    expect(written.activeTrialId).toBe(data.trials[0].id)
    expect(() => store.read('../escape')).toThrow('Invalid project identifier')

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })

  test('assigns events recorded before trials existed to the first trial', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-legacy-events-'))
    const projectDirectory = path.join(projectsDirectory, 'Study')
    fs.mkdirSync(projectDirectory)
    const event = { id: 'e1', animalId: 'ant-1', activityId: 'run', kind: 'point', start: 1, end: 1 }
    fs.writeFileSync(path.join(projectDirectory, 'Study_observations.json'), JSON.stringify({ observations: [event] }), 'utf8')

    const trialsStore = createTrialsStore(projectsDirectory)
    const store = createObservationsStore(projectsDirectory, {
      getDefaultTrialId: (projectId) => trialsStore.read(projectId).trials[0].id
    })

    const firstTrialId = trialsStore.read('Study').trials[0].id
    expect(store.read('Study').observations[0].trialId).toBe(firstTrialId)
    const saved = JSON.parse(fs.readFileSync(path.join(projectDirectory, 'Study_observations.json'), 'utf8'))
    expect(saved.observations[0].trialId).toBe(firstTrialId)

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })

  test('persists normalized project observations separately', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-observations-'))
    const store = createObservationsStore(projectsDirectory)
    const empty = store.read('Study')
    expect(empty.observations).toEqual([])

    const saved = store.write('Study', {
      observations: [{
        id: 'run-1', animalId: 'ant-1', activityId: 'run', activityName: 'Bieg',
        activityColor: '#42a56b', kind: 'interval', start: 1.25, end: null, lane: 0
      }]
    })
    expect(saved.observations[0].end).toBeNull()
    expect(store.read('Study').observations[0].start).toBe(1.25)
    expect(fs.existsSync(path.join(projectsDirectory, 'Study', 'Study_observations.json'))).toBe(true)

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })
})
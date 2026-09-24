import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createProjectStore } from '../public/scripts/main/project-store.js'
import { createSettingsStore } from '../public/scripts/main/settings-store.js'
import { createThemeState } from '../public/scripts/main/theme-state.js'

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

    expect(settingsStore.readAppSettings()).toEqual({ programShortcuts: [], projectShortcuts: [] })
    settingsStore.writeAppSettings({ programShortcuts: ['W'], invalid: true })
    expect(settingsStore.readAppSettings()).toEqual({ programShortcuts: ['W'], projectShortcuts: [] })

    fs.rmSync(settingsPath, { force: true })
  })

  test('creates and opens a project through the project store', () => {
    const projectsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-projects-'))
    const projectStore = createProjectStore(projectsDirectory)

    const created = projectStore.createProject('Demo project')
    const opened = projectStore.openProject(created.fileName)

    expect(created.fileName).toBe('Demo-project.json')
    expect(opened.projectName).toBe('Demo project')
    expect(projectStore.listProjects()).toHaveLength(1)

    fs.rmSync(projectsDirectory, { recursive: true, force: true })
  })
})
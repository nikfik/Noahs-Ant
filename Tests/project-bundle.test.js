import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { jest } from '@jest/globals'
import yazl from 'yazl'
import { BundleError, estimateExport, hashProjectData, importProject, readBundle, readManifest, readProjectData, restoreProjectData, writeBundle } from '../public/scripts/main/project-bundle.js'
import { createBackupService } from '../public/scripts/main/backup-service.js'
import { registerBackupHandlers, registerTransferHandlers } from '../public/scripts/main/handlers/backup-handlers.js'

let root
let projects
let outside

const write = (projectId, key, value) => fs.writeFileSync(path.join(projects, projectId, `${projectId}_${key}.json`), JSON.stringify(value), 'utf8')

function makeProject(projectId = 'Badanie', { videos = true } = {}) {
  fs.mkdirSync(path.join(projects, projectId, 'videos'), { recursive: true })
  const converted = path.join(projects, projectId, 'videos', 'Jan_Kowalski.mp4')
  const external = path.join(outside, 'Anna Nowak 2024.mov')
  if (videos) {
    fs.writeFileSync(converted, 'converted video')
    fs.writeFileSync(external, 'external video!')
    fs.writeFileSync(`${converted}.json`, JSON.stringify({ sourcePath: 'C:/Users/Jan/secret.MTS' }))
  }
  write(projectId, 'ini', { projectName: 'Badanie mrówek', createdAt: '2026-01-01T00:00:00.000Z', MostRecentOpen: '2026-01-02T00:00:00.000Z', etogram: [], videoPath: 'C:/Users/Jan/old.mp4' })
  write(projectId, 'trials', { version: 1, activeTrialId: 't1', trials: [
    { id: 't1', name: 'Test 1', videoPath: videos ? converted : '', sourcePath: 'C:/Users/Jan/Videos/Jan_Kowalski.MTS', frameRate: 25, duration: 60, skips: [] },
    { id: 't2', name: 'Test 2', videoPath: videos ? external : '', sourcePath: '', frameRate: 30, duration: 30, skips: [] }
  ] })
  write(projectId, 'animals', { version: 1, groups: [{ id: 'g', name: 'Gatunek' }], animals: [{ id: 'a', groupId: 'g', name: 'M1' }] })
  write(projectId, 'etograms', { version: 1, presets: [] })
  write(projectId, 'observations', { version: 1, observations: [{ id: 'o1', animalId: 'a', trialId: 't1', activityName: 'Kontakt', kind: 'point', start: 1, end: 1 }] })
  return { converted, external }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-bundle-'))
  projects = path.join(root, 'Projects')
  outside = path.join(root, 'elsewhere')
  fs.mkdirSync(projects, { recursive: true })
  fs.mkdirSync(outside, { recursive: true })
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('exporting and importing a project', () => {
  test('an export without videos keeps the data and loses every path', async () => {
    makeProject()
    const file = path.join(root, 'out.nsant')
    const result = await writeBundle({ projectsDirectory: projects, projectId: 'Badanie', destPath: file, kind: 'export', portable: true, includeVideos: false })
    expect(result.videoCount).toBe(0)

    const { data, manifest } = await readBundle(file)
    expect(manifest).toMatchObject({ app: 'Noahs Ant', formatVersion: 1, projectName: 'Badanie mrówek', counts: { trials: 2, animals: 1, events: 1 } })
    expect(data.trials.trials.map((trial) => [trial.videoPath, trial.sourcePath, trial.duration, trial.frameRate])).toEqual([['', '', 60, 25], ['', '', 30, 30]])
    expect(data.ini.videoPath).toBe('')
    expect(JSON.stringify(data)).not.toMatch(/Jan|Kowalski|Users/)
    expect(data.observations.observations).toHaveLength(1)
  })

  test('an export with videos renames them, and the import puts them in the new project', async () => {
    makeProject()
    expect(estimateExport(projects, 'Badanie')).toEqual({ videoCount: 2, videoBytes: 'converted video'.length + 'external video!'.length })
    const file = path.join(root, 'with-videos.nsant')
    const result = await writeBundle({ projectsDirectory: projects, projectId: 'Badanie', destPath: file, kind: 'export', portable: true, includeVideos: true })
    expect(result.videoCount).toBe(2)
    const manifest = await readManifest(file)
    expect(manifest.includesVideos).toBe(true)

    const project = await importProject({ projectsDirectory: projects, filePath: file })
    expect(project).toMatchObject({ projectId: 'Badanie-mrówek', projectName: 'Badanie mrówek', videoCount: 2 })
    const trials = readProjectData(projects, 'Badanie-mrówek').trials.trials
    expect(trials.map((trial) => path.basename(trial.videoPath))).toEqual(['video-1.mp4', 'video-2.mov'])
    expect(trials.every((trial) => trial.videoPath.startsWith(path.join(projects, 'Badanie-mrówek', 'videos')) && fs.existsSync(trial.videoPath))).toBe(true)
    expect(fs.readFileSync(trials[1].videoPath, 'utf8')).toBe('external video!')
    expect(readProjectData(projects, 'Badanie-mrówek').observations.observations).toHaveLength(1)
    expect(fs.existsSync(path.join(projects, 'Badanie', 'videos', 'Jan_Kowalski.mp4'))).toBe(true)
  })

  test('importing never touches an existing project and a broken file leaves nothing behind', async () => {
    makeProject()
    const file = path.join(root, 'a.nsant')
    await writeBundle({ projectsDirectory: projects, projectId: 'Badanie', destPath: file, portable: true })
    const before = hashProjectData(readProjectData(projects, 'Badanie'))
    await importProject({ projectsDirectory: projects, filePath: file })
    await importProject({ projectsDirectory: projects, filePath: file })
    expect(fs.readdirSync(projects).sort()).toEqual(['Badanie', 'Badanie-mrówek', 'Badanie-mrówek-2'])
    expect(readProjectData(projects, 'Badanie-mrówek-2').ini.projectName).toBe('Badanie mrówek (2)')
    expect(hashProjectData(readProjectData(projects, 'Badanie'))).toBe(before)

    const junk = path.join(root, 'junk.nsant')
    fs.writeFileSync(junk, 'this is not a zip')
    await expect(importProject({ projectsDirectory: projects, filePath: junk })).rejects.toBeInstanceOf(BundleError)
    expect(fs.readdirSync(projects)).toHaveLength(3)
  })

  test('refuses files that are not ours, that are too new or that try to leave the folder', async () => {
    const make = (entries) => new Promise((resolve) => {
      const file = path.join(root, `${Math.random()}.nsant`)
      const zip = new yazl.ZipFile()
      entries.forEach(([name, content]) => zip.addBuffer(Buffer.from(content), name))
      zip.outputStream.pipe(fs.createWriteStream(file)).on('close', () => resolve(file))
      zip.end()
    })
    await expect(readBundle(await make([['manifest.json', JSON.stringify({ app: 'Other', formatVersion: 1 })]]))).rejects.toThrow('Noah')
    await expect(readBundle(await make([['manifest.json', JSON.stringify({ app: 'Noahs Ant', formatVersion: 99 })]]))).rejects.toThrow('nowszej')
    const sneaky = await make([['manifest.json', JSON.stringify({ app: 'Noahs Ant', formatVersion: 1 })], ['videos/AAAAA', 'x']])
    fs.writeFileSync(sneaky, Buffer.from(fs.readFileSync(sneaky).toString('latin1').split('videos/AAAAA').join('videos/../..'), 'latin1'))
    await expect(readBundle(sneaky)).rejects.toThrow('niebezpieczny')
    await expect(readBundle(await make([['trials.json', '{not json']]))).rejects.toThrow('uszkodzony')
    const fine = await readBundle(await make([['manifest.json', JSON.stringify({ app: 'Noahs Ant', formatVersion: 1 })], ['other.txt', 'ignored']]))
    expect(fine.data).toEqual({})
  })
})

describe('backups', () => {
  let settings
  let clock
  let service

  beforeEach(() => {
    makeProject()
    settings = { enabled: true, intervalMinutes: 30, maxBackups: 3 }
    clock = new Date(2026, 10, 11, 12, 0, 0)
    service = createBackupService({ projectsDirectory: projects, getBackupSettings: () => settings, now: () => clock })
  })
  const tick = (seconds = 60) => { clock = new Date(clock.getTime() + seconds * 1000) }
  const change = (events) => write('Badanie', 'observations', { version: 1, observations: Array.from({ length: events }, (_, index) => ({ id: `e${index}`, animalId: 'a', trialId: 't1', activityName: 'K', kind: 'point', start: index, end: index })) })

  test('automatic backups skip unchanged data, keep paths and never include videos', async () => {
    expect((await service.create('Badanie', { kind: 'auto' })).created).toBe(true)
    tick()
    expect((await service.create('Badanie', { kind: 'auto' })).created).toBe(false)
    write('Badanie', 'ini', { ...readProjectData(projects, 'Badanie').ini, MostRecentOpen: 'later' })
    tick()
    expect((await service.create('Badanie', { kind: 'auto' })).created).toBe(false)

    change(5)
    tick()
    expect((await service.create('Badanie', { kind: 'auto' })).created).toBe(true)
    const backups = await service.list('Badanie')
    expect(backups).toHaveLength(2)
    expect(backups[0]).toMatchObject({ kind: 'auto', counts: { events: 5, trials: 2 } })
    const { data } = await readBundle(path.join(projects, 'Badanie', 'backups', backups[0].name))
    expect(data.trials.trials[0].videoPath).toContain('Jan_Kowalski.mp4')
    expect(fs.readdirSync(path.join(projects, 'Badanie', 'backups')).every((name) => name.endsWith('.nsant'))).toBe(true)
  })

  test('the oldest automatic backups are replaced, manual ones are kept', async () => {
    await service.create('Badanie', { kind: 'manual', label: 'Przed zmianami' })
    for (let events = 1; events <= 5; events += 1) {
      change(events)
      tick()
      await service.create('Badanie', { kind: 'auto' })
    }
    const backups = await service.list('Badanie')
    expect(backups.filter((backup) => backup.kind === 'auto')).toHaveLength(3)
    expect(backups.filter((backup) => backup.kind === 'auto').map((backup) => backup.counts.events)).toEqual([5, 4, 3])
    expect(backups.find((backup) => backup.kind === 'manual')).toMatchObject({ label: 'Przed zmianami' })

    await service.create('Badanie', { kind: 'manual' })
    tick(0)
    expect((await service.list('Badanie')).filter((backup) => backup.kind === 'manual')).toHaveLength(2)
    const manual = (await service.list('Badanie')).find((backup) => backup.kind === 'manual')
    await service.remove('Badanie', manual.name)
    expect((await service.list('Badanie')).filter((backup) => backup.kind === 'manual')).toHaveLength(1)
    await expect(service.remove('Badanie', '../../ini.json')).rejects.toBeInstanceOf(BundleError)
  })

  test('restoring brings the data back after a safety backup of the current state', async () => {
    change(2)
    await service.create('Badanie', { kind: 'manual', label: 'dwa zdarzenia' })
    change(9)
    tick()
    const [manual] = await service.list('Badanie')
    await service.restore('Badanie', manual.name)

    expect(readProjectData(projects, 'Badanie').observations.observations).toHaveLength(2)
    const backups = await service.list('Badanie')
    const safety = backups.find((backup) => backup.kind === 'safety')
    expect(safety.counts.events).toBe(9)
    await service.restore('Badanie', safety.name)
    expect(readProjectData(projects, 'Badanie').observations.observations).toHaveLength(9)
    await expect(service.restore('Badanie', 'manual-2020-01-01_00-00-00.nsant')).rejects.toThrow('nie ma')
    await restoreProjectData({ projectsDirectory: projects, projectId: 'Badanie', backupPath: path.join(projects, 'Badanie', 'backups', manual.name) })
  })

  test('a session makes a backup at once, then on a timer that follows the settings', async () => {
    const timers = []
    const timed = createBackupService({
      projectsDirectory: projects,
      getBackupSettings: () => settings,
      now: () => clock,
      setTimer: (callback, ms) => { timers.push({ callback, ms }); return timers.length },
      clearTimer: jest.fn()
    })
    await timed.startSession('Badanie')
    expect(await timed.list('Badanie')).toHaveLength(1)
    expect(timers[0].ms).toBe(30 * 60 * 1000)

    change(3)
    settings = { ...settings, intervalMinutes: 5 }
    tick(1800)
    await timers[0].callback()
    expect(await timed.list('Badanie')).toHaveLength(2)
    expect(timers[1].ms).toBe(5 * 60 * 1000)

    settings = { ...settings, enabled: false }
    change(4)
    tick(300)
    await timers[1].callback()
    expect(await timed.list('Badanie')).toHaveLength(2)

    settings = { ...settings, enabled: true }
    await timed.stopSession()
    expect(await timed.list('Badanie')).toHaveLength(3)
  })
})

describe('IPC handlers', () => {
  test('exporting asks where to save and imports return the new project', async () => {
    makeProject()
    const handlers = {}
    const ipcMain = { handle: (name, handler) => { handlers[name] = handler }, on: (name, handler) => { handlers[name] = handler } }
    const dialog = {
      showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: path.join(root, 'moj-projekt') }),
      showOpenDialog: jest.fn()
    }
    registerTransferHandlers({ ipcMain, dialog, projectsDirectory: projects, getDefaultDirectory: () => root })
    registerBackupHandlers({ ipcMain, backupService: createBackupService({ projectsDirectory: projects, getBackupSettings: () => ({ enabled: true, intervalMinutes: 30, maxBackups: 3 }) }) })

    const exported = await handlers['export-project']({}, { projectId: 'Badanie', includeVideos: false })
    expect(exported).toMatchObject({ saved: true, filePath: path.join(root, 'moj-projekt.nsant'), videoCount: 0 })
    await expect(handlers['export-project']({}, { projectId: '../x' })).rejects.toThrow('Nieprawidłowy')

    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [exported.filePath] })
    const imported = await handlers['import-project']()
    expect(imported.imported).toBe(true)
    expect(imported.project.projectId).toBe('Badanie-mrówek')
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await handlers['import-project']()).toEqual({ imported: false })

    const created = await handlers['create-backup']({}, { projectId: 'Badanie', label: 'Ręczna' })
    expect(created.created).toBe(true)
    expect((await handlers['list-backups']({}, 'Badanie'))[0].label).toBe('Ręczna')
  })
})

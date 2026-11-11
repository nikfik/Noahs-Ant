import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { jest } from '@jest/globals'
import ffmpegPath from 'ffmpeg-static'
import { createProjectLibrary } from '../public/scripts/main/project-library.js'
import { createThumbnailService } from '../public/scripts/main/project-thumbnails.js'
import { registerLibraryHandlers } from '../public/scripts/main/handlers/library-handlers.js'

let root
let projects
const write = (projectId, key, value) => fs.writeFileSync(path.join(projects, projectId, `${projectId}_${key}.json`), JSON.stringify(value), 'utf8')

function project(projectId, videoPaths) {
  fs.mkdirSync(path.join(projects, projectId, 'backups'), { recursive: true })
  write(projectId, 'ini', { projectName: `Projekt ${projectId}`, createdAt: '2026-01-01T00:00:00.000Z', MostRecentOpen: '2026-02-01T00:00:00.000Z' })
  write(projectId, 'trials', { version: 1, trials: videoPaths.map((videoPath, index) => ({ id: `t${index}`, name: `T${index}`, videoPath })) })
  write(projectId, 'animals', { version: 1, animals: [{ id: 'a' }, { id: 'b' }] })
  write(projectId, 'observations', { version: 1, observations: [{ id: 'o1' }] })
  fs.writeFileSync(path.join(projects, projectId, 'backups', 'manual-x.nsant'), 'x')
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'noahs-ant-library-'))
  projects = path.join(root, 'Projects')
  fs.mkdirSync(projects, { recursive: true })
  execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x360:rate=25', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(root, 'Film.mp4')])
  fs.writeFileSync(path.join(root, 'broken.mp4'), 'this is not a video')
})
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('project library', () => {
  const library = () => createProjectLibrary({ projectsDirectory: projects })

  test('describes a project: dates, counts, size, backups and missing videos', () => {
    project('Badanie', [path.join(root, 'Film.mp4'), path.join(root, 'Film.mp4'), path.join(root, 'zniknal.mp4'), ''])
    const info = library().getProjectInfo('Badanie')
    expect(info).toMatchObject({
      projectName: 'Projekt Badanie',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastOpened: '2026-02-01T00:00:00.000Z',
      counts: { trials: 4, animals: 2, events: 1 },
      backupCount: 1,
      videos: { total: 2, missing: 1 }
    })
    expect(info.sizeBytes).toBeGreaterThan(100)
    expect(() => library().getProjectInfo('../x')).toThrow('Nieprawidłowy')
  })

  test('checks paths and finds moved files by name, ignoring case', () => {
    expect(library().pathsExist([path.join(root, 'Film.mp4'), path.join(root, 'nie-ma.mp4'), '', 5])).toEqual([true, false, false, false])
    expect(library().findFilesInFolder(root, ['film.MP4', 'inny.mp4'])).toEqual({ 'film.MP4': path.join(root, 'Film.mp4') })
    expect(library().findFilesInFolder(path.join(root, 'brak-folderu'), ['a'])).toEqual({})
    expect(() => library().pathsExist('x')).toThrow()
  })

  test('deleting sends the folder to the recycle bin and refuses bad names', async () => {
    project('Do-kosza', [])
    const trash = jest.fn().mockResolvedValue(undefined)
    await library().deleteProject('Do-kosza', trash)
    expect(trash).toHaveBeenCalledWith(path.join(projects, 'Do-kosza'))
    await expect(library().deleteProject('../Badanie', trash)).rejects.toThrow('Nieprawidłowy')
    await expect(library().deleteProject('Nieistnieje', trash)).rejects.toThrow('już nie ma')
  })
})

describe('project thumbnails', () => {
  test('makes a picture from the first video that exists, once, and gives up quietly on a broken one', async () => {
    project('Z-filmem', ['', path.join(root, 'zniknal.mp4'), path.join(root, 'Film.mp4')])
    const calls = []
    const service = createThumbnailService({ projectsDirectory: projects, ffmpegPath, spawn: (...args) => { calls.push(args); return spawn(...args) } })

    const first = await service.get('Z-filmem')
    expect(first.path).toBe(path.join(projects, 'Z-filmem', 'thumbnail.jpg'))
    expect(fs.statSync(first.path).size).toBeGreaterThan(500)
    expect(fs.readFileSync(first.path).subarray(0, 2).toString('hex')).toBe('ffd8')
    const made = calls.length

    expect((await service.get('Z-filmem')).path).toBe(first.path)
    expect(calls.length).toBe(made)

    project('Zepsuty', [path.join(root, 'broken.mp4')])
    expect(await service.get('Zepsuty')).toBeNull()
    const attempts = calls.length
    expect(await service.get('Zepsuty')).toBeNull()
    expect(calls.length).toBe(attempts)

    project('Bez-filmu', [''])
    expect(await service.get('Bez-filmu')).toBeNull()
    await expect(service.get('../x')).rejects.toThrow('Nieprawidłowy')
  }, 60000)
})

describe('library IPC handlers', () => {
  test('hand the requests to the services', async () => {
    const handlers = {}
    const library = { getProjectInfo: jest.fn(() => 'info'), pathsExist: jest.fn(() => [true]), findFilesInFolder: jest.fn(() => ({})), deleteProject: jest.fn(async () => true) }
    const thumbnails = { get: jest.fn(async () => ({ path: 'x' })) }
    const trashItem = jest.fn()
    registerLibraryHandlers({ ipcMain: { handle: (name, handler) => { handlers[name] = handler } }, library, thumbnails, trashItem })

    expect(handlers['get-project-info']({}, 'P')).toBe('info')
    expect(await handlers['get-project-thumbnail']({}, 'P')).toEqual({ path: 'x' })
    await handlers['delete-project']({}, 'P')
    expect(library.deleteProject).toHaveBeenCalledWith('P', trashItem)
    handlers['find-files-in-folder']({}, { folder: 'f', names: ['a'] })
    expect(library.findFilesInFolder).toHaveBeenCalledWith('f', ['a'])
    expect(handlers['paths-exist']({}, ['a'])).toEqual([true])
  })
})

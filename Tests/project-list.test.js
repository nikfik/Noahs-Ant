/**
 * @jest-environment jsdom
 */
import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'
import { fileUrl, filterProjects, sortProjects } from '../public/scripts/projects/project-list-model.js'

const navigateToWorkspace = jest.fn()
jest.unstable_mockModule('../public/scripts/workspace/workspace-router.js', () => ({ navigateToWorkspace }))
const { initProjectList } = await import('../public/scripts/projects/project-list-controller.js')

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const html = fs.readFileSync(path.join(process.cwd(), 'public', 'views', 'ProjectList.html'), 'utf8')
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '')

const projects = [
  { fileName: 'Zebra', projectName: 'Zebra', createdAt: '2026-03-01T10:00:00.000Z', MostRecentOpen: '2026-03-02T10:00:00.000Z' },
  { fileName: 'Łąka', projectName: 'Łąka mrówek', createdAt: '2026-01-01T10:00:00.000Z', MostRecentOpen: '2026-05-01T10:00:00.000Z' },
  { fileName: 'Alfa', projectName: 'Alfa <b>1</b>', createdAt: '2026-02-01T10:00:00.000Z', MostRecentOpen: '2026-01-05T10:00:00.000Z' }
]

describe('project list model', () => {
  test('filters by words, ignoring case and accents', () => {
    expect(filterProjects(projects, 'laka').map((project) => project.fileName)).toEqual(['Łąka'])
    expect(filterProjects(projects, 'ŁĄKA MRÓW').map((project) => project.fileName)).toEqual(['Łąka'])
    expect(filterProjects(projects, '   ')).toHaveLength(3)
    expect(filterProjects(projects, 'nic')).toEqual([])
  })

  test('sorts by last opened, name or creation date, without touching the original', () => {
    expect(sortProjects(projects, 'opened').map((project) => project.fileName)).toEqual(['Łąka', 'Zebra', 'Alfa'])
    expect(sortProjects(projects, 'name').map((project) => project.fileName)).toEqual(['Alfa', 'Łąka', 'Zebra'])
    expect(sortProjects(projects, 'created').map((project) => project.fileName)).toEqual(['Zebra', 'Alfa', 'Łąka'])
    expect(projects[0].fileName).toBe('Zebra')
  })

  test('builds file addresses for pictures on disk', () => {
    expect(fileUrl('C:\\Projects\\Mrówki a\\thumbnail.jpg', 1234.6)).toBe('file:///C:/Projects/Mr%C3%B3wki%20a/thumbnail.jpg?v=1235')
    expect(fileUrl('/home/user/a b.jpg')).toBe('file:///home/user/a%20b.jpg')
  })
})

describe('project list screen', () => {
  let api

  beforeEach(async () => {
    localStorage.clear()
    navigateToWorkspace.mockClear()
    document.body.innerHTML = body
    window.confirm = jest.fn()
    api = {
      listProjects: jest.fn().mockResolvedValue(projects),
      openProject: jest.fn(async (fileName) => ({ fileName, projectName: fileName })),
      createProject: jest.fn(),
      openSettingsWindow: jest.fn(),
      getProjectThumbnail: jest.fn(async (fileName) => (fileName === 'Zebra' ? { path: 'C:/Projects/Zebra/thumbnail.jpg', version: 1 } : null)),
      getProjectInfo: jest.fn(async (fileName) => ({
        projectName: fileName, createdAt: '2026-01-01T00:00:00.000Z', lastOpened: '2026-01-02T00:00:00.000Z',
        counts: { trials: 3, animals: 4, events: 55 }, sizeBytes: 5 * 1024 * 1024, backupCount: 2,
        videos: { total: 2, missing: fileName === 'Alfa' ? 1 : 0 }
      })),
      deleteProject: jest.fn().mockResolvedValue(true),
      estimateProjectExport: jest.fn().mockResolvedValue({ videoCount: 0, videoBytes: 0 }),
      exportProject: jest.fn().mockResolvedValue({ saved: true, filePath: 'x.nsant', videoCount: 0 }),
      importProject: jest.fn()
    }
    window.electronAPI = api
    await initProjectList()
    await flush()
  })

  const names = () => [...document.querySelectorAll('.project-card .project-name')].map((node) => node.textContent)
  const card = (file) => document.querySelector(`.project-card[data-file="${file}"]`)

  test('shows the cards sorted by the last opened project, with the name escaped', () => {
    expect(names()).toEqual(['Łąka mrówek', 'Zebra', 'Alfa <b>1</b>'])
    expect(document.querySelector('.project-card b')).toBeNull()
    expect(document.getElementById('open-project-btn')).toBeNull()
  })

  test('sorting and searching change what is shown, and the sorting is remembered', () => {
    const sort = document.getElementById('project-sort')
    sort.value = 'name'
    sort.dispatchEvent(new Event('change'))
    expect(names()).toEqual(['Alfa <b>1</b>', 'Łąka mrówek', 'Zebra'])
    expect(localStorage.getItem('noahs-ant.project-sort')).toBe('name')

    const search = document.getElementById('project-search')
    search.value = 'zeb'
    search.dispatchEvent(new Event('input'))
    expect(names()).toEqual(['Zebra'])
    search.value = 'xyz'
    search.dispatchEvent(new Event('input'))
    expect(document.querySelector('.project-empty').textContent).toContain('nie pasuje')
  })

  test('one click selects, a double click or Enter opens', async () => {
    card('Zebra').click()
    expect(card('Zebra').classList.contains('selected')).toBe(true)
    expect(api.openProject).not.toHaveBeenCalled()

    card('Zebra').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await flush()
    expect(api.openProject).toHaveBeenCalledWith('Zebra')
    expect(navigateToWorkspace).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'Zebra' }))

    card('Alfa').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flush()
    expect(api.openProject).toHaveBeenCalledWith('Alfa')
  })

  test('loads the picture of a project and marks projects with missing videos', () => {
    expect(card('Zebra').querySelector('img').src).toBe('file:///C:/Projects/Zebra/thumbnail.jpg?v=1')
    expect(card('Łąka').querySelector('img').getAttribute('src')).toBeNull()
    expect(card('Łąka').querySelector('.thumbnail-label').textContent).toBe('Ł')
    expect(card('Alfa').querySelector('.card-warning').hidden).toBe(false)
    expect(card('Zebra').querySelector('.card-warning').hidden).toBe(true)
  })

  test('the ... menu offers open, export, information and delete', async () => {
    card('Zebra').querySelector('[data-menu]').click()
    const menu = document.querySelector('.card-menu')
    expect([...menu.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Otwórz', 'Eksportuj…', 'Informacje', 'Usuń…'])
    expect(card('Zebra').classList.contains('selected')).toBe(true)

    menu.querySelector('[data-action="info"]').click()
    await flush()
    const info = document.getElementById('info-modal')
    expect(info.classList.contains('hidden')).toBe(false)
    expect(info.textContent).toContain('55')
    expect(info.textContent).toContain('5.0 MB')
    expect(document.querySelector('.card-menu')).toBeNull()
    document.querySelector('[data-info-close]').click()
    expect(info.classList.contains('hidden')).toBe(true)

    card('Zebra').querySelector('[data-menu]').click()
    document.querySelector('.card-menu [data-action="export"]').click()
    await flush()
    expect(document.getElementById('export-modal').classList.contains('hidden')).toBe(false)
    expect(document.querySelector('[data-export-title]').textContent).toContain('Zebra')
  })

  test('delete asks first, then moves the project to the bin and refreshes the list', async () => {
    card('Alfa').querySelector('[data-menu]').click()
    document.querySelector('.card-menu [data-action="delete"]').click()
    const modal = document.getElementById('delete-modal')
    expect(modal.classList.contains('hidden')).toBe(false)
    expect(modal.textContent).toContain('Kosza')
    expect(window.confirm).not.toHaveBeenCalled()

    api.listProjects.mockResolvedValue(projects.filter((project) => project.fileName !== 'Alfa'))
    document.querySelector('[data-delete-confirm]').click()
    await flush()
    expect(api.deleteProject).toHaveBeenCalledWith('Alfa')
    expect(names()).toEqual(['Łąka mrówek', 'Zebra'])
    expect(document.getElementById('project-message').textContent).toContain('przeniesiony do Kosza')
  })

  test('in English the cards, the menu and the dates speak English', async () => {
    const { setLanguage, translatePage } = await import('../public/scripts/shared/i18n.js')
    setLanguage('en')
    translatePage()
    await initProjectList()
    await flush()
    expect(document.querySelector('.project-meta').textContent).toMatch(/^Opened: /)
    expect(document.querySelector('h2').textContent).toBe('Projects')
    expect(document.getElementById('new-project-btn').textContent).toBe('New project')
    card('Zebra').querySelector('[data-menu]').click()
    expect([...document.querySelectorAll('.card-menu button')].map((button) => button.textContent)).toEqual(['Open', 'Export…', 'Information', 'Delete…'])
    setLanguage('pl')
  })

  test('Settings opens the settings window and the menu closes with Escape', () => {
    document.getElementById('settings-btn').click()
    expect(api.openSettingsWindow).toHaveBeenCalled()

    card('Zebra').querySelector('[data-menu]').click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.card-menu')).toBeNull()
  })
})

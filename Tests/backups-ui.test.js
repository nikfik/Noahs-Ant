/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { createBackupsModule } from '../public/scripts/workspace/backups/backups-module.js'
import { initProjectTransfer } from '../public/scripts/projects/project-transfer.js'
import { normalizeAppSettings } from '../public/scripts/settings/settings-model.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('backup settings', () => {
  test('defaults to every 30 minutes and 10 backups, and rejects silly values', () => {
    expect(normalizeAppSettings().backup).toEqual({ enabled: true, intervalMinutes: 30, maxBackups: 10 })
    expect(normalizeAppSettings({ backup: { enabled: false, intervalMinutes: 5, maxBackups: 50 } }).backup).toEqual({ enabled: false, intervalMinutes: 5, maxBackups: 50 })
    expect(normalizeAppSettings({ backup: { intervalMinutes: 0, maxBackups: 1000, enabled: 'yes' } }).backup).toEqual({ enabled: true, intervalMinutes: 30, maxBackups: 10 })
    expect(normalizeAppSettings({ backup: { intervalMinutes: 2.5 } }).backup.intervalMinutes).toBe(30)
  })
})

describe('backups dialog', () => {
  let api
  let reload
  const backup = (name, kind, label = '') => ({ name, kind, label, createdAt: '2026-11-11T12:00:00.000Z', counts: { trials: 2, animals: 3, events: 40 }, size: 2048 })

  beforeEach(() => {
    document.body.innerHTML = '<button id="backups-btn"></button>'
    reload = jest.fn()
    api = {
      startBackupSession: jest.fn().mockResolvedValue(true),
      stopBackupSession: jest.fn(),
      getAppSettings: jest.fn().mockResolvedValue({ backup: { enabled: true, intervalMinutes: 15, maxBackups: 8 } }),
      listBackups: jest.fn().mockResolvedValue([backup('manual-1.nsant', 'manual', 'Przed zmianami'), backup('auto-1.nsant', 'auto')]),
      createBackup: jest.fn().mockResolvedValue({ created: true }),
      deleteBackup: jest.fn().mockResolvedValue(true),
      restoreBackup: jest.fn().mockResolvedValue(true)
    }
    createBackupsModule().init({ projectId: 'Study', api, reload })
  })
  afterEach(() => { document.querySelector('.backups-modal')?.remove() })

  const open = async () => {
    document.getElementById('backups-btn').click()
    await flush()
  }

  test('starts the automatic backups of the project and stops them when the page closes', () => {
    expect(api.startBackupSession).toHaveBeenCalledWith('Study')
    window.dispatchEvent(new Event('pagehide'))
    expect(api.stopBackupSession).toHaveBeenCalled()
  })

  test('lists the backups with their kind and contents', async () => {
    await open()
    const modal = document.querySelector('.backups-modal')
    expect(modal.classList.contains('modal')).toBe(true)
    expect(modal.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(modal.textContent).toContain('Przed zmianami')
    expect(modal.textContent).toContain('Ręczna')
    expect(modal.textContent).toContain('2 próby, 3 zwierzęta, 40 zdarzeń')
    expect(modal.querySelector('.backups-info')).toBeNull()
  })

  test('creates a named manual backup and refreshes the list', async () => {
    await open()
    document.querySelector('[data-label]').value = '  Po pierwszej serii  '
    document.querySelector('.backups-create').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    await flush()
    expect(api.createBackup).toHaveBeenCalledWith({ projectId: 'Study', label: 'Po pierwszej serii' })
    expect(document.querySelector('.backups-message').textContent).toContain('utworzona')
    expect(api.listBackups).toHaveBeenCalledTimes(2)
  })

  test('restoring and deleting ask first; a restore reloads the project', async () => {
    await open()
    document.querySelector('[data-restore="auto-1.nsant"]').click()
    expect(document.querySelector('.backups-confirm').textContent).toContain('Przywrócić tę kopię?')
    document.querySelector('[data-cancel]').click()
    expect(document.querySelector('.backups-confirm')).toBeNull()
    expect(api.restoreBackup).not.toHaveBeenCalled()

    document.querySelector('[data-delete="manual-1.nsant"]').click()
    document.querySelector('[data-confirm]').click()
    await flush()
    expect(api.deleteBackup).toHaveBeenCalledWith({ projectId: 'Study', name: 'manual-1.nsant' })

    document.querySelector('[data-restore="auto-1.nsant"]').click()
    document.querySelector('[data-confirm]').click()
    await flush()
    expect(api.restoreBackup).toHaveBeenCalledWith({ projectId: 'Study', name: 'auto-1.nsant' })
    expect(reload).toHaveBeenCalled()
  })

  test('closes with Escape', async () => {
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.backups-modal')).toBeNull()
  })
})

describe('project export and import buttons', () => {
  let api
  let selected
  let imported

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="export-project-btn"></button><button id="import-project-btn"></button><p id="project-message"></p>
      <div id="export-modal" class="modal hidden">
        <h3 data-export-title></h3>
        <input type="checkbox" data-include-videos><p data-videos-info></p><p data-videos-warning hidden></p>
        <button data-export-cancel></button><button data-export-confirm></button>
      </div>`
    selected = { fileName: 'Study', projectName: 'Badanie' }
    imported = jest.fn()
    api = {
      estimateProjectExport: jest.fn().mockResolvedValue({ videoCount: 2, videoBytes: 3 * 1024 ** 3 }),
      exportProject: jest.fn().mockResolvedValue({ saved: true, filePath: 'C:/out/Study.nsant', videoCount: 2 }),
      importProject: jest.fn().mockResolvedValue({ imported: true, project: { projectName: 'Badanie', fileName: 'Badanie-2', videoCount: 0 } })
    }
    initProjectTransfer({ api, getSelectedProject: () => selected, onImported: imported })
  })

  const message = () => document.getElementById('project-message').textContent

  test('asks to select a project first', async () => {
    selected = null
    document.getElementById('export-project-btn').click()
    await flush()
    expect(message()).toContain('Zaznacz projekt')
    expect(document.getElementById('export-modal').classList.contains('hidden')).toBe(true)
  })

  test('shows what is exported and warns about big videos, then exports with the chosen option', async () => {
    document.getElementById('export-project-btn').click()
    await flush()
    const modal = document.getElementById('export-modal')
    expect(modal.classList.contains('hidden')).toBe(false)
    expect(modal.querySelector('[data-export-title]').textContent).toContain('Badanie')
    expect(modal.querySelector('[data-videos-info]').textContent).toContain('2')
    expect(modal.querySelector('[data-videos-info]').textContent).toContain('3.0 GB')
    expect(modal.querySelector('[data-videos-warning]').hidden).toBe(true)

    const checkbox = modal.querySelector('[data-include-videos]')
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    expect(modal.querySelector('[data-videos-warning]').hidden).toBe(false)

    modal.querySelector('[data-export-confirm]').click()
    await flush()
    expect(api.exportProject).toHaveBeenCalledWith({ projectId: 'Study', includeVideos: true })
    expect(message()).toContain('C:/out/Study.nsant')
    expect(modal.classList.contains('hidden')).toBe(true)
  })

  test('without videos the option is off and disabled', async () => {
    api.estimateProjectExport.mockResolvedValue({ videoCount: 0, videoBytes: 0 })
    document.getElementById('export-project-btn').click()
    await flush()
    expect(document.querySelector('[data-include-videos]').disabled).toBe(true)
    document.querySelector('[data-export-confirm]').click()
    await flush()
    expect(api.exportProject).toHaveBeenCalledWith({ projectId: 'Study', includeVideos: false })
  })

  test('imports a file, reports it, and shows friendly errors', async () => {
    document.getElementById('import-project-btn').click()
    await flush()
    expect(message()).toContain('Zaimportowano projekt „Badanie”')
    expect(imported).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'Badanie-2' }))

    api.importProject.mockResolvedValue({ imported: false })
    document.getElementById('import-project-btn').click()
    await flush()

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    api.importProject.mockRejectedValue(new Error("Error invoking remote method 'import-project': Error: To nie jest poprawny plik projektu."))
    document.getElementById('import-project-btn').click()
    await flush()
    expect(message()).toBe('Nie udało się zaimportować projektu. To nie jest poprawny plik projektu.')
    expect(document.getElementById('project-message').classList.contains('error')).toBe(true)
    errors.mockRestore()
  })
})

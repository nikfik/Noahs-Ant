/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { WorkspaceEtogramModule } from '../public/scripts/workspace/workspace-etogram-module.js'

describe('WorkspaceEtogramModule editor', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="etogram-module"></div>'
    window.electronAPI = {
      openProject: jest.fn().mockResolvedValue({ etogram: [] }),
      saveProjectEtogram: jest.fn().mockResolvedValue(true)
    }
  })

  test('adds, edits, removes, and persists colored rows with shortcut combinations', async () => {
    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study' })

    document.getElementById('open-etogram-editor').click()
    const modal = document.getElementById('etogram-modal')
    expect(modal.classList.contains('hidden')).toBe(false)
    expect(modal.querySelector('.etogram-dialog').getAttribute('role')).toBe('dialog')

    document.getElementById('add-etogram-row').click()
    const nameInput = modal.querySelector('[data-field="name"]')
    nameInput.value = 'Bieganie'
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    const categoryInput = modal.querySelector('[data-field="category"]')
    categoryInput.value = 'Ruch'
    categoryInput.dispatchEvent(new Event('input', { bubbles: true }))
    const colorInput = modal.querySelector('[data-field="color"]')
    colorInput.value = '#00aa88'
    colorInput.dispatchEvent(new Event('input', { bubbles: true }))

    modal.querySelector('[data-action="capture-key"][data-field="primary"]').click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true }))
    modal.querySelector('[data-action="capture-key"][data-field="secondary"]').click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }))
    // a second key starts as a "+" combination, so no toggling is needed

    document.getElementById('add-etogram-row').click()
    const rowsBeforeRemove = modal.querySelectorAll('.editor-table tbody tr')
    expect(rowsBeforeRemove).toHaveLength(2)
    rowsBeforeRemove[1].querySelector('[data-action="remove-row"]').click()
    expect(modal.querySelectorAll('.editor-table tbody tr')).toHaveLength(1)

    document.getElementById('save-etogram').click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.electronAPI.saveProjectEtogram).toHaveBeenCalledWith('Study', [expect.objectContaining({
      category: 'Ruch',
      name: 'Bieganie',
      color: '#00aa88',
      shortcut: { primary: 'Q', secondary: 'E', operator: '+' }
    })])
    const compactRow = document.querySelector('.compact-table tbody tr')
    expect(compactRow).not.toBeNull()
    expect(modal.classList.contains('hidden')).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true }))
    expect(compactRow.classList.contains('active')).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }))
    expect(compactRow.classList.contains('active')).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }))
    expect(compactRow.classList.contains('active')).toBe(false)
  })

  test('normalizes legacy single-key shortcuts and preserves per-row colors', () => {
    const [row] = WorkspaceEtogramModule.normalizeRows([{
      id: 'legacy',
      name: 'Spanie',
      shortcut: 's',
      color: '#123456'
    }])

    expect(row.shortcut).toEqual({ primary: 'S', secondary: '', operator: '/' })
    expect(row.color).toBe('#123456')
    expect(WorkspaceEtogramModule.renderEditorTable([row])).toContain('type="color"')
  })
})

describe('Etogram side panel', () => {
  test('has the same header as the other side panels, with Edit next to the title and no unused buttons', async () => {
    document.body.innerHTML = '<div id="etogram-module"></div>'
    window.electronAPI = { openProject: jest.fn().mockResolvedValue({ etogram: [] }), saveProjectEtogram: jest.fn() }
    await WorkspaceEtogramModule.init('etogram-module', { projectFile: 'Study' })

    const header = document.querySelector('.etogram-card > .side-panel-header')
    expect(header.querySelector('h3').textContent).toBe('Etogram')
    expect(header.querySelector('.side-panel-eyebrow')).not.toBeNull()
    expect(header.querySelector('#open-etogram-editor').textContent).toBe('Edytuj')
    expect(document.querySelector('.etogram-card').classList.contains('side-panel')).toBe(true)

    const labels = Array.from(document.querySelectorAll('.etogram-card button')).map((button) => button.textContent.trim())
    expect(labels).toEqual(['Edytuj'])
  })
})

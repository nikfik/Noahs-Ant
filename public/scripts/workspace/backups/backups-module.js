// The backups dialog of the workspace: make a backup now, restore one, delete one. The automatic backups themselves are
// made by the main process while a project is open.
import { escapeHtml } from '../../shared/escape-html.js'
import { formatBytes } from '../video/video-quality-dialog.js'

const KINDS = { auto: 'Automatyczna', manual: 'Ręczna', safety: 'Przed przywróceniem' }

const formatDate = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pl-PL')
}

export function createBackupsModule() {
  let projectId = ''
  let api = null
  let reload = () => window.location.reload()
  let root = null
  let message = ''
  let pendingAction = null
  let backups = []
  let settings = { enabled: true, intervalMinutes: 30, maxBackups: 10 }

  const close = () => {
    root?.remove()
    root = null
    document.removeEventListener('keydown', onKey, true)
  }
  function onKey(event) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  const confirmRow = (backup) => pendingAction?.name !== backup.name ? '' : `
    <tr class="backups-confirm"><td colspan="6">
      ${pendingAction.type === 'restore' ? 'Przywrócić tę kopię?' : 'Usunąć tę kopię?'}
      <button type="button" class="module-action ${pendingAction.type === 'delete' ? 'danger' : 'primary'}" data-confirm>${pendingAction.type === 'restore' ? 'Przywróć' : 'Usuń'}</button>
      <button type="button" class="module-action" data-cancel>Anuluj</button>
    </td></tr>`

  function render() {
    if (!root) return
    root.innerHTML = `
      <section class="backups-dialog" role="dialog" aria-modal="true" aria-labelledby="backups-title">
        <header>
          <h3 id="backups-title">Kopie zapasowe</h3>
          <button type="button" class="modal-close" data-close aria-label="Zamknij">×</button>
        </header>
        ${settings.enabled ? '' : '<p class="backups-info">Automatyczne kopie są wyłączone.</p>'}
        <form class="backups-create">
          <input data-label maxlength="80" placeholder="Nazwa kopii (opcjonalnie)" aria-label="Nazwa kopii" />
          <button type="submit" class="module-action primary">Utwórz kopię teraz</button>
        </form>
        <p class="backups-message" role="status">${escapeHtml(message)}</p>
        <div class="backups-table">
          <table class="data-table">
            <thead><tr><th>Data</th><th>Rodzaj</th><th>Nazwa</th><th>Zawartość</th><th>Rozmiar</th><th></th></tr></thead>
            <tbody>${backups.length ? backups.map((backup) => `
              <tr>
                <td>${escapeHtml(formatDate(backup.createdAt))}</td>
                <td>${escapeHtml(KINDS[backup.kind] || backup.kind)}</td>
                <td>${escapeHtml(backup.label)}</td>
                <td>${backup.counts?.trials ?? 0} prób, ${backup.counts?.animals ?? 0} zwierząt, ${backup.counts?.events ?? 0} zdarzeń</td>
                <td class="num">${escapeHtml(formatBytes(backup.size))}</td>
                <td class="backups-actions">
                  <button type="button" class="module-action" data-restore="${escapeHtml(backup.name)}">Przywróć</button>
                  <button type="button" class="module-action danger" data-delete="${escapeHtml(backup.name)}">Usuń</button>
                </td>
              </tr>${confirmRow(backup)}`).join('') : '<tr><td colspan="6" class="backups-empty">Na razie nie ma żadnych kopii.</td></tr>'}</tbody>
          </table>
        </div>
        <footer><button type="button" class="module-action" data-close>Zamknij</button></footer>
      </section>`
  }

  async function refreshList() {
    try {
      backups = await api.listBackups(projectId)
    } catch (error) {
      console.error('Could not list the backups:', error)
      backups = []
    }
    render()
  }

  async function createNow(label) {
    message = 'Tworzenie kopii…'
    render()
    try {
      const result = await api.createBackup({ projectId, label })
      message = result?.created ? 'Kopia została utworzona.' : 'Nie utworzono kopii.'
    } catch (error) {
      console.error('Could not create a backup:', error)
      message = 'Nie udało się utworzyć kopii.'
    }
    await refreshList()
  }

  async function runPending() {
    const action = pendingAction
    pendingAction = null
    if (!action) return
    try {
      if (action.type === 'delete') {
        await api.deleteBackup({ projectId, name: action.name })
        message = 'Kopia została usunięta.'
      } else {
        await api.restoreBackup({ projectId, name: action.name })
        message = 'Kopia została przywrócona. Wczytywanie projektu…'
        render()
        reload()
        return
      }
    } catch (error) {
      console.error('Backup action failed:', error)
      message = action.type === 'restore' ? 'Nie udało się przywrócić kopii.' : 'Nie udało się usunąć kopii.'
    }
    await refreshList()
  }

  async function open() {
    if (root || !api) return
    root = document.createElement('div')
    root.className = 'modal backups-modal'
    document.body.appendChild(root)
    document.addEventListener('keydown', onKey, true)
    message = ''
    pendingAction = null

    root.addEventListener('click', (event) => {
      const restore = event.target.closest('[data-restore]')
      const remove = event.target.closest('[data-delete]')
      if (restore) pendingAction = { type: 'restore', name: restore.dataset.restore }
      else if (remove) pendingAction = { type: 'delete', name: remove.dataset.delete }
      else if (event.target.closest('[data-cancel]')) pendingAction = null
      else if (event.target.closest('[data-confirm]')) { runPending(); return }
      else if (event.target.closest('[data-close]') || event.target === root) { close(); return }
      else return
      render()
    })
    root.addEventListener('submit', (event) => {
      event.preventDefault()
      const label = root.querySelector('[data-label]').value.trim()
      createNow(label)
    })

    try {
      settings = { ...settings, ...((await api.getAppSettings?.())?.backup || {}) }
    } catch (_error) {
      // The defaults are shown instead.
    }
    await refreshList()
  }

  // Starts the automatic backups of this project and, when the toolbar button is clicked, shows the dialog.
  function init(options = {}) {
    projectId = options.projectId || ''
    api = options.api || window.electronAPI
    reload = options.reload || reload
    if (!projectId || !api?.listBackups) return null

    api.startBackupSession?.(projectId)?.catch?.((error) => console.error('Could not start the automatic backups:', error))
    window.addEventListener('pagehide', () => api.stopBackupSession?.())
    document.getElementById('backups-btn')?.addEventListener('click', open)
    return { open, close }
  }

  return { init }
}

export const BackupsModule = createBackupsModule()

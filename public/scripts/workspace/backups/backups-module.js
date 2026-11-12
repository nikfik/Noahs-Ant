// The backups dialog of the workspace: make a backup now, restore one, delete one. The automatic backups themselves are
// made by the main process while a project is open.
import { locale, plural, t } from '../../shared/i18n.js'
import { escapeHtml } from '../../shared/escape-html.js'
import { formatBytes } from '../video/video-quality-dialog.js'

export const BACKUP_KINDS = { auto: 'Automatyczna', manual: 'Ręczna', safety: 'Przed przywróceniem' }

const countsText = (counts = {}) => {
  const trials = counts.trials ?? 0
  const animals = counts.animals ?? 0
  const events = counts.events ?? 0
  return `${trials} ${plural(trials, ['próba', 'próby', 'prób'])}, ${animals} ${plural(animals, ['zwierzę', 'zwierzęta', 'zwierząt'])}, ${events} ${plural(events, ['zdarzenie', 'zdarzenia', 'zdarzeń'])}`
}

const formatDate = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale())
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
      <button type="button" class="module-action" data-cancel>${t('Anuluj')}</button>
    </td></tr>`

  function render() {
    if (!root) return
    root.innerHTML = `
      <section class="backups-dialog" role="dialog" aria-modal="true" aria-labelledby="backups-title">
        <header>
          <h3 id="backups-title">${t('Kopie zapasowe')}</h3>
          <button type="button" class="modal-close" data-close aria-label="${t('Zamknij')}">×</button>
        </header>
        ${settings.enabled ? '' : `<p class="backups-info">${t('Automatyczne kopie są wyłączone.')}</p>`}
        <form class="backups-create">
          <input data-label maxlength="80" placeholder="${t('Nazwa kopii (opcjonalnie)')}" aria-label="${t('Nazwa kopii')}" />
          <button type="submit" class="module-action primary">${t('Utwórz kopię teraz')}</button>
        </form>
        <p class="backups-message" role="status">${escapeHtml(message)}</p>
        <div class="backups-table">
          <table class="data-table">
            <thead><tr><th>${t('Data')}</th><th>${t('Rodzaj')}</th><th>${t('Nazwa')}</th><th>${t('Zawartość')}</th><th>${t('Rozmiar')}</th><th></th></tr></thead>
            <tbody>${backups.length ? backups.map((backup) => `
              <tr>
                <td>${escapeHtml(formatDate(backup.createdAt))}</td>
                <td>${escapeHtml(BACKUP_KINDS[backup.kind] ? t(BACKUP_KINDS[backup.kind]) : backup.kind)}</td>
                <td>${escapeHtml(t(backup.label))}</td>
                <td>${countsText(backup.counts)}</td>
                <td class="num">${escapeHtml(formatBytes(backup.size))}</td>
                <td class="backups-actions">
                  <button type="button" class="module-action" data-restore="${escapeHtml(backup.name)}">${t('Przywróć')}</button>
                  <button type="button" class="module-action danger" data-delete="${escapeHtml(backup.name)}">${t('Usuń')}</button>
                </td>
              </tr>${confirmRow(backup)}`).join('') : `<tr><td colspan="6" class="backups-empty">${t('Na razie nie ma żadnych kopii.')}</td></tr>`}</tbody>
          </table>
        </div>
        <footer><button type="button" class="module-action" data-close>${t('Zamknij')}</button></footer>
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
    message = t('Tworzenie kopii…')
    render()
    try {
      const result = await api.createBackup({ projectId, label })
      message = result?.created ? t('Kopia została utworzona.') : t('Nie utworzono kopii.')
    } catch (error) {
      console.error('Could not create a backup:', error)
      message = t('Nie udało się utworzyć kopii.')
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
        message = t('Kopia została usunięta.')
      } else {
        await api.restoreBackup({ projectId, name: action.name })
        message = t('Kopia została przywrócona. Wczytywanie projektu…')
        render()
        reload()
        return
      }
    } catch (error) {
      console.error('Backup action failed:', error)
      message = action.type === 'restore' ? t('Nie udało się przywrócić kopii.') : t('Nie udało się usunąć kopii.')
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

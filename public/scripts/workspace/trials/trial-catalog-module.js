import { escapeHtml } from '../../shared/escape-html.js'
import {
  createTrial,
  getActiveTrial,
  nextTrialName,
  normalizeTrialData,
  removeTrial,
  setActiveTrial,
  updateTrial
} from './trial-model.js'

function renderTrialOptions(data) {
  return data.trials.map((trial) => `
    <option value="${escapeHtml(trial.id)}" ${trial.id === data.activeTrialId ? 'selected' : ''}>${escapeHtml(trial.name)}</option>
  `).join('')
}

export async function init(containerId = 'trial-panel', options = {}) {
  const host = document.getElementById(containerId)
  const projectId = options.projectId || ''
  if (!host || !projectId || !window.electronAPI?.getProjectTrials) return null

  let data = normalizeTrialData(await window.electronAPI.getProjectTrials(projectId))
  let dialogMode = null

  host.innerHTML = `
    <section class="module-card trial-card">
      <header class="module-head"><h3>Próba</h3></header>
      <div class="trial-row">
        <select class="trial-select" aria-label="Aktywna próba"></select>
        <button type="button" class="trial-icon-action" data-action="add-trial" title="Dodaj próbę" aria-label="Dodaj próbę">＋</button>
        <button type="button" class="trial-icon-action" data-action="rename-trial" title="Zmień nazwę próby" aria-label="Zmień nazwę próby">✎</button>
        <button type="button" class="trial-icon-action danger" data-action="remove-trial" title="Usuń próbę" aria-label="Usuń próbę">×</button>
      </div>
    </section>
    <div class="modal hidden trial-name-modal">
      <form class="modal-card trial-name-dialog" role="dialog" aria-modal="true" aria-labelledby="trial-name-title">
        <h3 id="trial-name-title">Dodaj próbę</h3>
        <label for="trial-name-input">Nazwa</label>
        <input id="trial-name-input" name="name" maxlength="80" required autocomplete="off" />
        <div class="module-actions">
          <button type="button" class="module-action" data-action="cancel-trial-name">Anuluj</button>
          <button type="submit" class="module-action">Zapisz</button>
        </div>
      </form>
    </div>
    <div class="modal hidden trial-confirm-modal">
      <div class="modal-card trial-name-dialog" role="alertdialog" aria-modal="true" aria-labelledby="trial-confirm-title">
        <h3 id="trial-confirm-title">Usuń próbę</h3>
        <p class="trial-confirm-text"></p>
        <div class="module-actions">
          <button type="button" class="module-action" data-action="cancel-trial-remove">Anuluj</button>
          <button type="button" class="module-action danger" data-action="confirm-trial-remove">Usuń</button>
        </div>
      </div>
    </div>
  `

  const select = host.querySelector('.trial-select')
  const removeButton = host.querySelector('[data-action="remove-trial"]')
  const dialog = host.querySelector('.trial-name-modal')
  const form = host.querySelector('.trial-name-dialog')
  const nameInput = host.querySelector('#trial-name-input')
  const confirmDialog = host.querySelector('.trial-confirm-modal')

  function renderControls() {
    select.innerHTML = renderTrialOptions(data)
    removeButton.disabled = data.trials.length <= 1
  }

  function emitActiveTrial() {
    window.dispatchEvent(new CustomEvent('active-trial-changed', {
      detail: { trial: getActiveTrial(data), data }
    }))
  }

  async function persist() {
    data = normalizeTrialData(await window.electronAPI.saveProjectTrials(projectId, data))
    renderControls()
    emitActiveTrial()
  }

  function openNameDialog(mode, title, value) {
    dialogMode = mode
    form.querySelector('h3').textContent = title
    nameInput.value = value
    dialog.classList.remove('hidden')
    nameInput.focus()
    nameInput.select()
  }

  async function handleAction(action) {
    const activeTrial = getActiveTrial(data)
    if (action === 'add-trial') {
      openNameDialog('add', 'Dodaj próbę', nextTrialName(data))
    } else if (action === 'rename-trial' && activeTrial) {
      openNameDialog('rename', 'Zmień nazwę próby', activeTrial.name)
    } else if (action === 'remove-trial' && activeTrial && data.trials.length > 1) {
      confirmDialog.querySelector('.trial-confirm-text').textContent =
        `Usunąć próbę „${activeTrial.name}” razem ze wszystkimi jej zdarzeniami? Tej operacji nie można cofnąć.`
      confirmDialog.classList.remove('hidden')
    } else if (action === 'confirm-trial-remove' && activeTrial && data.trials.length > 1) {
      confirmDialog.classList.add('hidden')
      data = removeTrial(data, activeTrial.id)
      window.dispatchEvent(new CustomEvent('trial-removed', { detail: { trialId: activeTrial.id } }))
      await persist()
    } else if (action === 'cancel-trial-remove') {
      confirmDialog.classList.add('hidden')
    } else if (action === 'cancel-trial-name') {
      dialog.classList.add('hidden')
    }
  }

  host.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]')
    if (!target) return
    handleAction(target.dataset.action).catch((error) => console.error('Failed to update trials:', error))
  })

  select.addEventListener('change', () => {
    data = setActiveTrial(data, select.value)
    persist().catch((error) => console.error('Failed to switch trial:', error))
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const name = nameInput.value.trim()
    if (!name) return

    data = dialogMode === 'rename'
      ? updateTrial(data, data.activeTrialId, { name })
      : createTrial(data, name)
    dialog.classList.add('hidden')
    await persist()
  })

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.classList.add('hidden')
  })
  confirmDialog.addEventListener('click', (event) => {
    if (event.target === confirmDialog) confirmDialog.classList.add('hidden')
  })

  renderControls()
  emitActiveTrial()

  return {
    getData: () => data,
    getActiveTrial: () => getActiveTrial(data),
    async updateTrial(trialId, changes) {
      data = updateTrial(data, trialId, changes)
      await persist()
    },
    setVideoPath(trialId, videoPath) {
      return this.updateTrial(trialId, { videoPath })
    }
  }
}

export const TrialCatalogModule = { init }

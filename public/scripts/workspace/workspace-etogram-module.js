//Single responsibility principle
const defaultEtogramRows = []

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character])

function normalizeShortcut(value) {
  if (typeof value === 'string') {
    return { primary: value.trim().toUpperCase(), secondary: '', operator: '/' }
  }
  if (value && typeof value === 'object') {
    return {
      primary: String(value.primary || '').trim().toUpperCase(),
      secondary: String(value.secondary || '').trim().toUpperCase(),
      operator: value.operator === '+' ? '+' : '/'
    }
  }
  return { primary: '', secondary: '', operator: '/' }
}

function shortcutLabel(value) {
  const shortcut = normalizeShortcut(value)
  if (!shortcut.primary) return '—'
  return shortcut.secondary ? `${shortcut.primary} ${shortcut.operator} ${shortcut.secondary}` : shortcut.primary
}

export function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    id: String(row.id || `${Date.now()}-${index}`),
    category: row.category || 'Bez kategorii',
    name: row.name || 'Bez nazwy',
    shortcut: normalizeShortcut(row.shortcut),
    description: row.description || '',
    color: /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : '#ff4f1a',
    continuous: Boolean(row.continuous),
  }))
}

export function renderCompactTable(rows) {
  return rows.map((row) => `
    <tr data-row-id="${escapeHtml(row.id)}" style="--etogram-color:${escapeHtml(row.color)}">
      <td><span class="kbd">${escapeHtml(shortcutLabel(row.shortcut))}</span></td>
      <td>${escapeHtml(row.name)}</td>
    </tr>
  `).join('')
}

export function renderEditorTable(rows) {
  return rows.map((row, index) => {
    const shortcut = normalizeShortcut(row.shortcut)
    return `
    <tr data-index="${index}">
      <td class="etogram-remove-cell"><button class="etogram-remove-row" type="button" data-action="remove-row" data-index="${index}" aria-label="Usuń czynność ${escapeHtml(row.name || index + 1)}">×</button></td>
      <td><input data-field="category" data-index="${index}" value="${escapeHtml(row.category)}" placeholder="Kategoria" /></td>
      <td><input data-field="name" data-index="${index}" value="${escapeHtml(row.name)}" placeholder="Nazwa czynności" /></td>
      <td><textarea data-field="description" data-index="${index}" rows="2" placeholder="Opis">${escapeHtml(row.description)}</textarea></td>
      <td>
        <div class="etogram-shortcut-editor">
          <button class="option-keybind etogram-keybind" type="button" data-action="capture-key" data-field="primary" data-index="${index}" aria-label="Ustaw główny skrót">${escapeHtml(shortcut.primary || '—')}</button>
          <button class="combo-operator ${shortcut.secondary ? 'active' : ''}" type="button" data-action="toggle-operator" data-index="${index}" ${shortcut.secondary ? '' : 'disabled'} aria-label="Zmień operator">${shortcut.secondary ? escapeHtml(shortcut.operator) : '+'}</button>
          <button class="option-keybind combo-slot ${shortcut.secondary ? 'active' : 'muted'}" type="button" data-action="capture-key" data-field="secondary" data-index="${index}" aria-label="Ustaw dodatkowy skrót">${escapeHtml(shortcut.secondary || '+')}</button>
        </div>
      </td>
      <td><input data-field="color" data-index="${index}" type="color" value="${escapeHtml(row.color)}" aria-label="Kolor ${escapeHtml(row.name || 'czynności')}" /></td>
      <td class="etogram-continuous-cell"><input data-field="continuous" data-index="${index}" type="checkbox" ${row.continuous ? 'checked' : ''} aria-label="Czynność ciągła" /></td>
    </tr>
  `
  }).join('')
}

export async function loadRows(projectFile, animalCatalogOrData = null, animalId = null, suppliedPresets = []) {
  if (animalCatalogOrData?.getData) {
    const data = animalCatalogOrData.getData()
    const selectedAnimalId = animalId || data.activeAnimalId
    const animal = data.animals.find((item) => item.id === selectedAnimalId)
    const preset = animalCatalogOrData.getPresets?.().find((item) => item.id === animal?.etogramPresetId)
    return normalizeRows(preset?.activities || [])
  }

  if (Array.isArray(animalCatalogOrData?.animals)) {
    const data = animalCatalogOrData
    const selectedAnimalId = animalId || data.activeAnimalId
    const animal = data.animals.find((item) => item.id === selectedAnimalId)
    const preset = suppliedPresets.find((item) => item.id === animal?.etogramPresetId)
    return normalizeRows(preset?.activities || [])
  }

  if (!projectFile) {
    return [...defaultEtogramRows]
  }

  try {
    const project = await window.electronAPI.openProject(projectFile)
    return normalizeRows(project.etogram || [])
  } catch (_error) {
    console.warn('Nie udało się odczytać etogramu z projektu, używam wartości domyślnej.')
  }

  return []
}

export async function persistRows(projectFile, rows, animalCatalog = null) {
  if (animalCatalog?.getData && animalCatalog?.saveData && animalCatalog?.getPresets && animalCatalog?.savePresets) {
    const data = animalCatalog.getData()
    const animal = data.animals.find((item) => item.id === data.activeAnimalId)
    if (!animal) throw new Error('No active animal selected')
    let presets = animalCatalog.getPresets()
    let preset = presets.find((item) => item.id === animal.etogramPresetId)
    if (!preset) {
      preset = { id: `etogram-${Date.now()}`, name: `${animal.name} — etogram`, activities: [] }
      animal.etogramPresetId = preset.id
      presets = [...presets, preset]
      await animalCatalog.saveData(data)
    }
    preset.activities = rows
    await animalCatalog.savePresets(presets)
    return
  }

  if (!projectFile || !window.electronAPI?.saveProjectEtogram) {
    return
  }

  await window.electronAPI.saveProjectEtogram(projectFile, rows)
}

async function init(containerId = 'etogram-module', options = {}) {
  const host = document.getElementById(containerId)
  if (!host) return

  const projectFile = options.projectFile || ''
  const animalCatalog = options.animalCatalog || null
  let activeAnimalId = animalCatalog?.getData?.().activeAnimalId || null
  let rows = normalizeRows(await loadRows(projectFile, animalCatalog, activeAnimalId))
  let draftRows = normalizeRows(rows)
  const pressedKeys = new Set()

  host.innerHTML = `
    <div class="module-card etogram-card">
      <div class="module-head">
        <h3>Etogram / Skróty</h3>
      </div>
      <div class="table-wrap">
        <table class="shortcut-table compact-table">
          <thead>
            <tr>
              <th>Skrót</th>
              <th>Nazwa czynności</th>
            </tr>
          </thead>
          <tbody>
            ${renderCompactTable(rows)}
          </tbody>
        </table>
      </div>
      <div class="module-actions">
        <button class="module-action disabled" type="button" disabled>Dodaj</button>
        <button class="module-action disabled" type="button" disabled>Usuń</button>
        <button id="open-etogram-editor" class="module-action" type="button">Edytuj</button>
      </div>
    </div>
    <div id="etogram-modal" class="modal hidden">
      <section class="etogram-dialog" role="dialog" aria-modal="true" aria-labelledby="etogram-title">
        <header class="etogram-dialog-header">
          <div><span class="etogram-eyebrow">Ustawienia projektu</span><h2 id="etogram-title">Edytor etogramu</h2><p>Zarządzaj czynnościami, kolorami oraz skrótami.</p></div>
          <button id="close-etogram-modal" class="modal-close" type="button" aria-label="Zamknij edytor">×</button>
        </header>
        <div class="etogram-dialog-body">
          <div class="etogram-editor-main">
            <div class="etogram-table-scroll">
              <table class="shortcut-table editor-table">
                <colgroup>
                  <col class="etogram-col-remove" />
                  <col class="etogram-col-category" />
                  <col class="etogram-col-name" />
                  <col class="etogram-col-description" />
                  <col class="etogram-col-shortcut" />
                  <col class="etogram-col-color" />
                  <col class="etogram-col-continuous" />
                </colgroup>
                <thead><tr><th></th><th>Kategoria</th><th>Czynność</th><th>Opis</th><th>Skrót</th><th>Kolor</th><th>Ciągła</th></tr></thead>
                <tbody>${renderEditorTable(rows)}</tbody>
              </table>
            </div>
          </div>
          <aside class="etogram-editor-sidebar">
            <h3>Opcje</h3>
            <p>Dodaj lub usuń czynności etogramu.</p>
            <button id="add-etogram-row" class="etogram-add-button" type="button"><span>＋</span> Dodaj czynność</button>
            <div class="etogram-sidebar-note"><span class="etogram-note-icon">i</span><span>Ustaw skrót główny i opcjonalny dodatkowy. Kombinacja może używać operatora „+” lub „/”.</span></div>
          </aside>
        </div>
        <footer class="etogram-dialog-footer">
          <span id="etogram-save-status" role="status"></span>
          <div><button id="cancel-etogram" class="etogram-cancel-button" type="button">Anuluj</button><button id="save-etogram" class="etogram-save-button" type="button">Zapisz zmiany</button></div>
        </footer>
      </section>
    </div>
  `

  const modal = host.querySelector('#etogram-modal')
  const openBtn = host.querySelector('#open-etogram-editor')
  const closeBtn = host.querySelector('#close-etogram-modal')
  const saveBtn = host.querySelector('#save-etogram')
  const compactBody = host.querySelector('.compact-table tbody')
  const editorBody = host.querySelector('.editor-table tbody')
  let pendingShortcut = null

  function renderDraft() {
    editorBody.innerHTML = renderEditorTable(draftRows)
  }

  function collectDraft() {
    draftRows = Array.from(editorBody.querySelectorAll('tr')).map((tr, index) => {
      const get = (field) => tr.querySelector(`[data-field="${field}"]`)
      const previous = draftRows[index] || {}
      return {
        id: previous.id || rows[index]?.id || `${Date.now()}-${index}`,
        category: String(get('category')?.value || '').trim(),
        name: String(get('name')?.value || '').trim(),
        description: String(get('description')?.value || '').trim(),
        shortcut: {
          primary: previous.shortcut?.primary || '',
          secondary: previous.shortcut?.secondary || '',
          operator: previous.shortcut?.operator === '+' ? '+' : '/'
        },
        color: get('color')?.value || '#ff4f1a',
        continuous: Boolean(get('continuous')?.checked)
      }
    })
    return draftRows
  }

  function highlightRow(rowId, active) {
    const rowNode = compactBody?.querySelector(`[data-row-id="${rowId}"]`)
    rowNode?.classList.toggle('active', active)
  }

  openBtn?.addEventListener('click', () => {
    draftRows = normalizeRows(rows)
    renderDraft()
    modal?.classList.remove('hidden')
  })
  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'))
  host.querySelector('#cancel-etogram')?.addEventListener('click', () => modal?.classList.add('hidden'))
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.classList.add('hidden')
    }
  })

  saveBtn?.addEventListener('click', async () => {
    const normalized = normalizeRows(collectDraft())
    rows.splice(0, rows.length, ...normalized)
    const compactMarkup = renderCompactTable(normalized)
    compactBody.innerHTML = compactMarkup
    await persistRows(projectFile, normalized, animalCatalog)
    modal?.classList.add('hidden')
  })

  host.querySelector('#add-etogram-row')?.addEventListener('click', () => {
    collectDraft()
    draftRows.push({
      id: `${Date.now()}-${Math.random()}`,
      category: '',
      name: '',
      description: '',
      shortcut: { primary: '', secondary: '', operator: '/' },
      color: '#ff4f1a',
      continuous: false
    })
    renderDraft()
    editorBody.querySelector('tr:last-child [data-field="name"]')?.focus()
  })

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return
    const rowIndex = Number(button.dataset.index)
    collectDraft()
    if (button.dataset.action === 'remove-row') {
      draftRows.splice(rowIndex, 1)
      renderDraft()
    } else if (button.dataset.action === 'toggle-operator' && draftRows[rowIndex]) {
      const shortcut = normalizeShortcut(draftRows[rowIndex].shortcut)
      shortcut.operator = shortcut.operator === '+' ? '/' : '+'
      draftRows[rowIndex].shortcut = shortcut
      renderDraft()
    } else if (button.dataset.action === 'capture-key') {
      pendingShortcut = { rowIndex, field: button.dataset.field }
      button.textContent = '…'
    }
  })

  document.addEventListener('keydown', (event) => {
    if (pendingShortcut) {
      event.preventDefault()
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return
      const { rowIndex, field } = pendingShortcut
      const shortcut = normalizeShortcut(draftRows[rowIndex]?.shortcut)
      shortcut[field] = String(event.key || '').toUpperCase()
      if (draftRows[rowIndex]) draftRows[rowIndex].shortcut = shortcut
      pendingShortcut = null
      renderDraft()
      return
    }
    if (event.repeat || (modal && !modal.classList.contains('hidden'))) return
    if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    const animalData = animalCatalog?.getData?.()
    const activeAnimal = animalData?.animals?.find((animal) => animal.id === activeAnimalId) || null
    if (animalCatalog && !activeAnimal) return

    const key = String(event.key || '').toUpperCase()
    if (!key) return
    pressedKeys.add(key)

    const matchingRows = rows.filter((row) => {
      const shortcut = normalizeShortcut(row.shortcut)
      if (!shortcut.primary) return false
      if (shortcut.operator === '+') {
        return Boolean(shortcut.secondary)
          && (key === shortcut.primary || key === shortcut.secondary)
          && pressedKeys.has(key === shortcut.primary ? shortcut.secondary : shortcut.primary)
      }
      return shortcut.primary === key || shortcut.secondary === key
    })
    if (!matchingRows.length) return
    event.preventDefault()

    matchingRows.forEach((row) => {
      const rowNode = Array.from(compactBody?.querySelectorAll('[data-row-id]') || [])
        .find((node) => node.dataset.rowId === String(row.id))
      if (!row.continuous) rowNode?.classList.add('active')
      window.dispatchEvent(new CustomEvent('etogram-activity-request', {
        detail: {
          activityId: row.id,
          activityName: row.name,
          activityColor: row.color,
          continuous: row.continuous,
          repeat: event.repeat,
          animalId: activeAnimal?.id || null
        }
      }))
    })
  })

  document.addEventListener('keyup', (event) => {
    const key = String(event.key || '').toUpperCase()
    pressedKeys.delete(key)
    rows.forEach((row) => {
      const shortcut = normalizeShortcut(row.shortcut)
      if (!row.continuous && (shortcut.primary === key || shortcut.secondary === key)) {
        const rowNode = Array.from(compactBody?.querySelectorAll('[data-row-id]') || [])
          .find((node) => node.dataset.rowId === String(row.id))
        rowNode?.classList.remove('active')
      }
    })
  })

  window.addEventListener('timeline-active-observations', (event) => {
    const active = event.detail?.active || new Set()
    rows.forEach((row) => {
      const rowNode = Array.from(compactBody?.querySelectorAll('[data-row-id]') || [])
        .find((node) => node.dataset.rowId === String(row.id))
      rowNode?.classList.toggle('active', active.has(`${activeAnimalId || ''}:${row.id}`))
    })
  })

  window.addEventListener('active-animal-changed', async (event) => {
    activeAnimalId = event.detail?.activeAnimal?.id || animalCatalog?.getData?.().activeAnimalId || null
    rows = normalizeRows(await loadRows(projectFile, animalCatalog, activeAnimalId))
    compactBody.innerHTML = renderCompactTable(rows)
    editorBody.innerHTML = renderEditorTable(rows)
  })
}

export const WorkspaceEtogramModule = {
  init,
  defaultEtogramRows,
  normalizeRows,
  renderCompactTable,
  renderEditorTable,
  loadRows,
  persistRows,
}

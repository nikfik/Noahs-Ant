export const defaultEtogramRows = []

function normalizeShortcut(value) {
  if (typeof value === 'string') {
    return { primary: value.trim().toUpperCase(), secondary: '', operator: '/' }
  }

  if (value && typeof value === 'object') {
    return {
      primary: String(value.primary || '').trim().toUpperCase(),
      secondary: String(value.secondary || '').trim().toUpperCase(),
      operator: value.operator === '+' ? '+' : '/',
    }
  }

  return { primary: '', secondary: '', operator: '/' }
}

export function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    id: row.id ?? `${Date.now()}-${index}`,
    category: String(row.category || '').trim(),
    name: String(row.name || '').trim(),
    shortcut: normalizeShortcut(row.shortcut),
    description: String(row.description || '').trim(),
    color: /^#[0-9a-f]{6}$/i.test(row.color) ? row.color : '#ff4f1a',
    continuous: Boolean(row.continuous),
  }))
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function shortcutLabel(shortcut) {
  const normalized = normalizeShortcut(shortcut)
  if (!normalized.primary) return '—'
  return normalized.secondary
    ? `${normalized.primary} ${normalized.operator} ${normalized.secondary}`
    : normalized.primary
}

export function renderCompactTable(rows) {
  return rows.map((row) => `
    <tr data-row-id="${escapeHtml(row.id)}" data-shortcut-primary="${escapeHtml(normalizeShortcut(row.shortcut).primary)}" style="--etogram-color: ${escapeHtml(row.color)}">
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

function makeEmptyRow(index) {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    category: '',
    name: '',
    shortcut: { primary: '', secondary: '', operator: '/' },
    description: '',
    color: '#ff4f1a',
    continuous: false,
  }
}

export async function loadRows(projectFile, animalData, animalId = animalData?.activeAnimalId, presets = []) {
  if (animalData) {
    const animal = animalData.animals.find((item) => item.id === animalId)
    const preset = presets.find((item) => item.id === animal?.etogramPresetId)
    return normalizeRows(preset?.activities || [])
  }

  if (!projectFile) return []

  try {
    const project = await window.electronAPI.openProject(projectFile)
    return normalizeRows(project.etogram || [])
  } catch (error) {
    return []
  }
}

export async function persistRows(projectFile, rows, animalCatalog, animalId) {
  if (animalCatalog?.getData && animalCatalog?.saveData) {
    const data = animalCatalog.getData()
    const animal = data.animals.find((item) => item.id === animalId)
    if (!animal) throw new Error('No active animal selected')
    const presets = animalCatalog.getPresets?.() || data.etogramPresets || []
    let preset = presets.find((item) => item.id === animal.etogramPresetId)
    if (!preset) {
      const group = data.groups.find((item) => item.id === animal.groupId)
      preset = { id: `etogram-${Date.now()}`, name: `${group?.name || animal.name} — etogram`, activities: [] }
      presets.push(preset)
      animal.etogramPresetId = preset.id
      await animalCatalog.savePresets?.(presets)
      await animalCatalog.saveData(data)
    }
    preset.activities = rows
    await animalCatalog.savePresets?.(presets)
    return
  }

  if (!projectFile || !window.electronAPI?.saveProjectEtogram) return
  await window.electronAPI.saveProjectEtogram(projectFile, rows)
}

export async function init(containerId = 'etogram-module', options = {}) {
  const host = document.getElementById(containerId)
  if (!host) return

  const projectFile = options.projectFile || ''
  const animalCatalog = options.animalCatalog || null
  let animalData = animalCatalog?.getData?.() || null
  let presets = animalCatalog?.getPresets?.() || animalData?.etogramPresets || []
  let activeGroupId = animalData?.activeGroupId || null
  let activeAnimalId = animalData?.activeAnimalId || null
  let rows = normalizeRows(await loadRows(projectFile, animalData, activeAnimalId, presets))
  let draftRows = normalizeRows(rows)
  let pendingShortcutCapture = null
  const pressedKeys = new Set()

  host.innerHTML = `
    <div class="module-card etogram-card">
      <div class="module-head"><h3>Etogram</h3><span class="etogram-count">${rows.length}</span></div>
      <div class="etogram-active-context">${escapeHtml(animalData?.groups.find((group) => group.id === activeGroupId)?.name || 'Wybierz lub dodaj grupę zwierząt')}</div>
      <div class="table-wrap">
        <table class="shortcut-table compact-table">
          <thead><tr><th>Skrót</th><th>Nazwa czynności</th></tr></thead>
          <tbody>${renderCompactTable(rows)}</tbody>
        </table>
        ${rows.length ? '' : '<p class="etogram-empty">Brak czynności. Otwórz edytor, aby dodać pierwszą.</p>'}
      </div>
      <div class="module-actions"><button id="open-etogram-editor" class="module-action" type="button">Edytuj etogram</button></div>
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
              <div class="etogram-preset-bar">
                <label for="etogram-preset-select">Preset etogramu</label>
                <select id="etogram-preset-select"></select>
                <button id="create-etogram-preset" type="button">＋ Nowy preset</button>
              </div>
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
                <tbody>${renderEditorTable(draftRows)}</tbody>
              </table>
              <div class="etogram-editor-empty ${draftRows.length ? 'hidden' : ''}">Lista jest pusta. Użyj „Dodaj czynność”, aby rozpocząć.</div>
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
  const compactBody = host.querySelector('.compact-table tbody')
  const editorBody = host.querySelector('.editor-table tbody')
  const editorEmpty = host.querySelector('.etogram-editor-empty')
  const saveStatus = host.querySelector('#etogram-save-status')
  const presetSelect = host.querySelector('#etogram-preset-select')

  function getActiveGroup() {
    return animalData?.groups.find((group) => group.id === activeGroupId) || null
  }

  function getActiveAnimal() {
    return animalData?.animals.find((animal) => animal.id === activeAnimalId) || null
  }

  function getActivePreset() {
    const animal = getActiveAnimal()
    return presets.find((preset) => preset.id === animal?.etogramPresetId) || null
  }

  function renderPresetOptions() {
    if (!presetSelect) return
    const animal = getActiveAnimal()
    presetSelect.innerHTML = presets.map((preset) => `
      <option value="${escapeHtml(preset.id)}" ${preset.id === animal?.etogramPresetId ? 'selected' : ''}>${escapeHtml(preset.name)}</option>
    `).join('')
    presetSelect.disabled = !animal || !animalCatalog
    host.querySelector('#create-etogram-preset').disabled = !animal || !animalCatalog
  }

  async function selectGroup(groupId, animalId = null) {
    activeGroupId = groupId
    activeAnimalId = animalId
    animalData = animalCatalog?.getData?.() || animalData
    presets = animalCatalog?.getPresets?.() || presets
    const group = getActiveGroup()
    rows = normalizeRows(await loadRows(projectFile, animalData, activeAnimalId, presets))
    draftRows = normalizeRows(rows)
    updateCompactRows()
    const activeAnimal = animalData?.animals.find((animal) => animal.id === activeAnimalId)
    host.querySelector('.etogram-active-context').textContent = group
      ? `${group.name}${activeAnimal ? ` · aktywne: ${activeAnimal.name}` : ' · wybierz osobnika, aby rejestrować czynności'}`
      : 'Wybierz lub dodaj grupę zwierząt'
    renderPresetOptions()
  }

  function renderDraft() {
    editorBody.innerHTML = renderEditorTable(draftRows)
    editorEmpty.classList.toggle('hidden', draftRows.length > 0)
  }

  function collectDraft() {
    draftRows = Array.from(editorBody.querySelectorAll('tr')).map((rowNode, index) => {
      const previous = draftRows[index] || makeEmptyRow(index)
      const get = (field) => rowNode.querySelector(`[data-field="${field}"]`)
      const primary = normalizeShortcut(previous.shortcut).primary
      const secondary = normalizeShortcut(previous.shortcut).secondary
      const operator = normalizeShortcut(previous.shortcut).operator
      return {
        id: previous.id,
        category: get('category')?.value.trim() || '',
        name: get('name')?.value.trim() || '',
        description: get('description')?.value.trim() || '',
        color: get('color')?.value || '#ff4f1a',
        continuous: Boolean(get('continuous')?.checked),
        shortcut: { primary, secondary, operator },
      }
    })
    return draftRows
  }

  function updateCompactRows() {
    compactBody.innerHTML = renderCompactTable(rows)
    host.querySelector('.etogram-count').textContent = String(rows.length)
    const empty = host.querySelector('.etogram-empty')
    if (empty) empty.remove()
    if (!rows.length) {
      host.querySelector('.table-wrap').insertAdjacentHTML('beforeend', '<p class="etogram-empty">Brak czynności. Otwórz edytor, aby dodać pierwszą.</p>')
    }
  }

  renderPresetOptions()

  function captureKey(button) {
    const rowNode = button.closest('tr')
    const rowIndex = Number(rowNode.dataset.index)
    const field = button.dataset.field
    pendingShortcutCapture = { rowIndex, field }
    saveStatus.textContent = 'Naciśnij klawisz, który chcesz przypisać…'
    button.textContent = 'Naciśnij klawisz…'
  }

  host.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]')
    if (!button) return
    const rowNode = button.closest('tr')
    const index = Number(rowNode?.dataset.index)

    if (button.dataset.action === 'remove-row') {
      collectDraft()
      draftRows.splice(index, 1)
      renderDraft()
    }

    if (button.dataset.action === 'capture-key') {
      collectDraft()
      captureKey(button)
    }

    if (button.dataset.action === 'toggle-operator') {
      collectDraft()
      const shortcut = normalizeShortcut(draftRows[index].shortcut)
      shortcut.operator = shortcut.operator === '+' ? '/' : '+'
      draftRows[index].shortcut = shortcut
      renderDraft()
    }

  })

  host.addEventListener('input', (event) => {
    const target = event.target
    if (!target.matches('[data-field]')) return
    const row = target.closest('tr')
    const index = Number(row?.dataset.index)
    if (!draftRows[index]) return
    if (target.dataset.field === 'continuous') {
      draftRows[index].continuous = target.checked
    } else if (target.dataset.field === 'color') {
      draftRows[index].color = target.value
    } else {
      draftRows[index][target.dataset.field] = target.value
    }
  })

  document.addEventListener('keydown', (event) => {
    if (pendingShortcutCapture) {
      event.preventDefault()
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return
      collectDraft()
      const { rowIndex, field } = pendingShortcutCapture
      const key = String(event.key || '').toUpperCase()
      if (draftRows[rowIndex]) {
        const shortcut = normalizeShortcut(draftRows[rowIndex].shortcut)
        shortcut[field] = key
        draftRows[rowIndex].shortcut = shortcut
      }
      pendingShortcutCapture = null
      saveStatus.textContent = ''
      renderDraft()
      return
    }

    if (modal && !modal.classList.contains('hidden')) return
    if (animalData && !activeAnimalId) return
    if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    const key = String(event.key || '').toUpperCase()
    if (!key) return
    pressedKeys.add(key)
    if (event.repeat) return

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
    matchingRows.forEach((matchingRow) => {
      const rowNode = Array.from(compactBody.querySelectorAll('[data-row-id]'))
        .find((node) => node.dataset.rowId === String(matchingRow.id))
      if (!rowNode) return
      const isStarting = matchingRow.continuous && !rowNode.classList.contains('active')
      if (matchingRow.continuous) {
        rowNode.classList.toggle('active')
      } else {
        rowNode.classList.add('active')
      }
      window.dispatchEvent(new CustomEvent('etogram-activity', {
        detail: {
          action: matchingRow.continuous ? (isStarting ? 'start' : 'stop') : 'pulse',
          timestamp: new Date().toISOString(),
          projectId: projectFile,
          groupId: activeGroupId,
          animalId: activeAnimalId,
          activityId: matchingRow.id,
          activityName: matchingRow.name,
          activityColor: matchingRow.color
        }
      }))
    })
  })

  document.addEventListener('keyup', (event) => {
    const key = String(event.key || '').toUpperCase()
    pressedKeys.delete(key)
    if (modal && !modal.classList.contains('hidden')) return
    if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    const matchingRows = rows.filter((row) => {
      const shortcut = normalizeShortcut(row.shortcut)
      if (row.continuous) return false
      if (shortcut.operator === '+') {
        return shortcut.primary === key || shortcut.secondary === key
      }
      return shortcut.primary === key || shortcut.secondary === key
    })
    matchingRows.forEach((row) => {
      const rowNode = Array.from(compactBody.querySelectorAll('[data-row-id]'))
        .find((node) => node.dataset.rowId === String(row.id))
      rowNode?.classList.remove('active')
    })
  })

  host.querySelector('#open-etogram-editor').addEventListener('click', () => {
    draftRows = normalizeRows(rows)
    renderDraft()
    modal.classList.remove('hidden')
  })
  host.querySelector('#close-etogram-modal').addEventListener('click', () => modal.classList.add('hidden'))
  host.querySelector('#cancel-etogram').addEventListener('click', () => modal.classList.add('hidden'))
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.add('hidden')
  })
  host.querySelector('#add-etogram-row').addEventListener('click', () => {
    collectDraft()
    draftRows.push(makeEmptyRow(draftRows.length))
    renderDraft()
    editorBody.querySelector('tr:last-child [data-field="name"]')?.focus()
  })

  host.querySelector('#save-etogram').addEventListener('click', async () => {
    const nextRows = normalizeRows(collectDraft())
    const missingName = nextRows.findIndex((row) => !row.name)
    if (missingName !== -1) {
      saveStatus.textContent = `Podaj nazwę czynności w wierszu ${missingName + 1}.`
      editorBody.querySelector(`tr[data-index="${missingName}"] [data-field="name"]`)?.focus()
      return
    }

    const saveButton = host.querySelector('#save-etogram')
    saveButton.disabled = true
    saveStatus.textContent = 'Zapisywanie…'
    try {
      await persistRows(projectFile, nextRows, animalCatalog, activeAnimalId)
      rows.splice(0, rows.length, ...nextRows)
      updateCompactRows()
      saveStatus.textContent = 'Zmiany zapisane.'
      modal.classList.add('hidden')
    } catch (error) {
      console.error('Nie udało się zapisać etogramu:', error)
      saveStatus.textContent = 'Nie udało się zapisać. Spróbuj ponownie.'
    } finally {
      saveButton.disabled = false
    }
  })

  presetSelect?.addEventListener('change', async () => {
    const animal = getActiveAnimal()
    if (!animal || !animalData) return
    animal.etogramPresetId = presetSelect.value
    await animalCatalog.saveData(animalData)
    animalData = animalCatalog.getData()
    await selectGroup(activeGroupId, activeAnimalId)
    renderDraft()
  })

  document.getElementById('create-etogram-preset')?.addEventListener('click', async () => {
    collectDraft()
    const animal = getActiveAnimal()
    const group = getActiveGroup()
    if (!animal || !group || !animalData || !animalCatalog) return
    const preset = {
      id: `etogram-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: `${group.name} — preset ${presets.filter((item) => item.name.startsWith(group.name)).length + 1}`,
      activities: normalizeRows(draftRows)
    }
    presets = await animalCatalog.savePresets([...presets, preset])
    animal.etogramPresetId = preset.id
    await animalCatalog.saveData(animalData)
    animalData = animalCatalog.getData()
    renderPresetOptions()
    presetSelect.value = preset.id
    rows = normalizeRows(preset.activities)
    draftRows = normalizeRows(rows)
    updateCompactRows()
    renderDraft()
  })

  const onActiveAnimalChanged = (event) => {
    if (!animalCatalog || !event.detail?.activeGroup) return
    selectGroup(event.detail.activeGroup.id, event.detail.activeAnimal?.id || null)
      .catch((error) => console.error('Failed to switch animal etogram:', error))
  }
  window.addEventListener('active-animal-changed', onActiveAnimalChanged)
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

if (typeof window !== 'undefined') {
  window.WorkspaceEtogramModule = WorkspaceEtogramModule
}

(function () {
  const defaultEtogramRows = [
    { id: 1, category: 'Bieg', name: 'Bieganie', shortcut: 'A', description: 'Krótki, szybki ruch w przód.', continuous: true },
    { id: 2, category: 'Sen', name: 'Spanie', shortcut: 'S', description: 'Przechodzi do stanu odpoczynku.', continuous: true },
    { id: 3, category: 'Jedzenie', name: 'Jedzenie', shortcut: 'D', description: 'Akcja pobrania pokarmu.', continuous: false },
    { id: 4, category: 'Socjalizacja', name: 'Socjalizacja', shortcut: 'F', description: 'Interakcja z innymi osobnikami.', continuous: false },
  ]

  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row, index) => ({
      id: row.id || `${Date.now()}-${index}`,
      category: row.category || 'Bez kategorii',
      name: row.name || 'Bez nazwy',
      shortcut: String(row.shortcut || '').trim().toUpperCase() || `K${index + 1}`,
      description: row.description || '',
      continuous: Boolean(row.continuous),
    }))
  }

  function renderCompactTable(rows) {
    return rows.map((row) => `
      <tr data-row-id="${row.id}" data-shortcut="${row.shortcut}">
        <td><span class="kbd">${row.shortcut}</span></td>
        <td>${row.name}</td>
      </tr>
    `).join('')
  }

  function renderEditorTable(rows) {
    return rows.map((row, index) => `
      <tr>
        <td><input data-field="category" data-index="${index}" value="${row.category}" /></td>
        <td><input data-field="name" data-index="${index}" value="${row.name}" /></td>
        <td><textarea data-field="description" data-index="${index}" rows="2">${row.description}</textarea></td>
        <td><input data-field="shortcut" data-index="${index}" value="${row.shortcut}" maxlength="2" /></td>
        <td><input data-field="continuous" data-index="${index}" type="checkbox" ${row.continuous ? 'checked' : ''} /></td>
      </tr>
    `).join('')
  }

  async function loadRows(projectFile) {
    if (!projectFile) {
      return [...defaultEtogramRows]
    }

    try {
      const project = await window.electronAPI.openProject(projectFile)
      const etogram = normalizeRows(project.etogram || [])
      if (etogram.length) {
        return etogram
      }
    } catch (_error) {
      console.warn('Nie udało się odczytać etogramu z projektu, używam wartości domyślnej.')
    }

    return [...defaultEtogramRows]
  }

  async function persistRows(projectFile, rows) {
    if (!projectFile || !window.electronAPI?.saveProjectEtogram) {
      return
    }

    await window.electronAPI.saveProjectEtogram(projectFile, rows)
  }

  async function init(containerId = 'etogram-module', options = {}) {
    const host = document.getElementById(containerId)
    if (!host) return

    const projectFile = options.projectFile || ''
    const rows = normalizeRows(await loadRows(projectFile))

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
        <div class="modal-card">
          <div class="modal-head">
            <h4>Edytor etogramu</h4>
            <button id="close-etogram-modal" class="modal-close" type="button">×</button>
          </div>
          <div class="table-wrap">
            <table class="shortcut-table editor-table">
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>Nazwa czynności</th>
                  <th>Opis</th>
                  <th>Skrót</th>
                  <th>Ciągła</th>
                </tr>
              </thead>
              <tbody>
                ${renderEditorTable(rows)}
              </tbody>
            </table>
          </div>
          <div class="modal-actions">
            <button id="save-etogram" class="module-action" type="button">Zapisz</button>
          </div>
        </div>
      </div>
    `

    const modal = host.querySelector('#etogram-modal')
    const openBtn = host.querySelector('#open-etogram-editor')
    const closeBtn = host.querySelector('#close-etogram-modal')
    const saveBtn = host.querySelector('#save-etogram')
    const compactBody = host.querySelector('.compact-table tbody')
    const editorBody = host.querySelector('.editor-table tbody')

    function highlightRow(rowId, active) {
      const rowNode = compactBody?.querySelector(`[data-row-id="${rowId}"]`)
      rowNode?.classList.toggle('active', active)
    }

    openBtn?.addEventListener('click', () => modal?.classList.remove('hidden'))
    closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'))
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.classList.add('hidden')
      }
    })

    saveBtn?.addEventListener('click', async () => {
      const nextRows = Array.from(editorBody.querySelectorAll('tr')).map((tr) => {
        const cells = tr.querySelectorAll('input, textarea')
        const row = {
          id: rows[Number(cells[0]?.dataset.index)]?.id || `${Date.now()}-${Math.random()}`,
          category: String(cells[0]?.value || 'Brak').trim(),
          name: String(cells[1]?.value || 'Brak').trim(),
          description: String(cells[2]?.value || '').trim(),
          shortcut: String(cells[3]?.value || '').trim().toUpperCase(),
          continuous: Boolean(cells[4]?.checked),
        }
        return row
      })

      const normalized = normalizeRows(nextRows)
      rows.splice(0, rows.length, ...normalized)
      const compactMarkup = renderCompactTable(normalized)
      compactBody.innerHTML = compactMarkup
      await persistRows(projectFile, normalized)
      modal?.classList.add('hidden')
    })

    document.addEventListener('keydown', (event) => {
      const key = String(event.key || '').toUpperCase()
      if (!key) return

      const matchingRow = rows.find((row) => row.shortcut === key)
      if (!matchingRow) return

      const rowNode = compactBody?.querySelector(`[data-row-id="${matchingRow.id}"]`)
      if (!rowNode) return

      if (matchingRow.continuous) {
        const nextActive = !rowNode.classList.contains('active')
        rowNode.classList.toggle('active', nextActive)
        highlightRow(matchingRow.id, nextActive)
      } else {
        highlightRow(matchingRow.id, true)
      }
    })

    document.addEventListener('keyup', (event) => {
      const key = String(event.key || '').toUpperCase()
      if (!key) return

      const matchingRow = rows.find((row) => row.shortcut === key)
      if (!matchingRow) return

      if (!matchingRow.continuous) {
        const rowNode = compactBody?.querySelector(`[data-row-id="${matchingRow.id}"]`)
        rowNode?.classList.remove('active')
      }
    })
  }

  window.WorkspaceEtogramModule = {
    init,
  }
})()

import { escapeHtml } from '../../shared/escape-html.js'
import { chooseAnimalColor, createAnimal, createGroup, createId, normalizeAnimalData } from './animal-model.js'

function renderCatalog(data) {
  if (!data.groups.length) {
    return '<div class="animal-catalog-empty">Dodaj grupę, aby rozpocząć katalog zwierząt.</div>'
  }

  return data.groups.map((group) => {
    const animals = data.animals.filter((animal) => animal.groupId === group.id)
    const expanded = group.id === data.activeGroupId
    return `
      <section class="animal-group ${expanded ? 'expanded' : ''}" data-group-id="${escapeHtml(group.id)}">
        <div class="animal-group-row">
          <button class="animal-group-toggle" type="button" data-action="toggle-group" aria-expanded="${expanded}">
            <span class="animal-chevron">${expanded ? '⌄' : '›'}</span>
            <span class="animal-group-name">${escapeHtml(group.name)}</span>
            <span class="animal-group-count">${animals.length}</span>
          </button>
          <button class="animal-icon-action" type="button" data-action="add-animal" title="Dodaj zwierzę do grupy" aria-label="Dodaj zwierzę">＋</button>
          <button class="animal-icon-action danger" type="button" data-action="remove-group" title="Usuń grupę" aria-label="Usuń grupę">×</button>
        </div>
        ${expanded ? `<div class="animal-group-children">${animals.map((animal) => `
          <div class="animal-entry ${animal.id === data.activeAnimalId ? 'active' : ''}" data-animal-id="${escapeHtml(animal.id)}">
            <button class="animal-entry-select" type="button" data-action="select-animal" data-animal-id="${escapeHtml(animal.id)}">
              <span class="animal-color-dot" style="--animal-color:${escapeHtml(animal.color)}"></span>
              <span class="animal-entry-name">${escapeHtml(animal.name)}</span>
            </button>
            <button class="animal-color-reroll" type="button" data-action="reroll-color" data-animal-id="${escapeHtml(animal.id)}" title="Losuj inny kolor" aria-label="Losuj inny kolor dla ${escapeHtml(animal.name)}">🎲</button>
            <button class="animal-entry-remove" type="button" data-action="remove-animal" data-animal-id="${escapeHtml(animal.id)}" title="Usuń zwierzę" aria-label="Usuń zwierzę ${escapeHtml(animal.name)}">×</button>
          </div>
        `).join('')}${animals.length ? '' : '<div class="animal-group-empty">Brak zwierząt w tej grupie.</div>'}</div>` : ''}
      </section>
    `
  }).join('')
}

export async function init(containerId = 'animal-panel', options = {}) {
  const host = document.getElementById(containerId)
  if (!host) return null

  const projectId = options.projectId || ''
  if (!projectId || !window.electronAPI?.getProjectAnimals) {
    host.innerHTML = '<section class="side-panel"><header class="side-panel-header"><div><span class="side-panel-eyebrow">Katalog projektu</span><h3>Zwierzęta</h3></div></header><p class="animal-catalog-empty">Otwórz projekt, aby zarządzać zwierzętami.</p></section>'
    return null
  }

  const loadedData = await window.electronAPI.getProjectAnimals(projectId)
  let data = normalizeAnimalData(loadedData)
  let presets = typeof window.electronAPI.getProjectEtograms === 'function'
    ? await window.electronAPI.getProjectEtograms(projectId)
    : (Array.isArray(loadedData.etogramPresets) ? loadedData.etogramPresets : [])
  let dialogAction = null

  host.innerHTML = `
    <section class="side-panel animal-catalog-card">
      <header class="side-panel-header">
        <div><span class="side-panel-eyebrow">Katalog projektu</span><h3>Zwierzęta</h3></div>
        <button class="side-panel-action" type="button" data-action="add-group" title="Dodaj grupę">＋ Grupa</button>
      </header>
      <div class="animal-catalog-tree">${renderCatalog(data)}</div>
    </section>
    <div class="animal-name-modal hidden">
      <form class="animal-name-dialog" role="dialog" aria-modal="true" aria-labelledby="animal-name-title">
        <h3 id="animal-name-title">Dodaj grupę</h3>
        <p class="animal-name-hint"></p>
        <label for="animal-name-input">Nazwa</label>
        <input id="animal-name-input" name="name" maxlength="80" required autocomplete="off" />
        <div class="animal-dialog-actions"><button type="button" data-action="cancel-name">Anuluj</button><button type="submit">Dodaj</button></div>
      </form>
    </div>
  `

  const tree = host.querySelector('.animal-catalog-tree')
  const dialog = host.querySelector('.animal-name-modal')
  const form = host.querySelector('.animal-name-dialog')
  const nameInput = host.querySelector('#animal-name-input')

  function emitSelection() {
    const activeAnimal = data.animals.find((animal) => animal.id === data.activeAnimalId) || null
    const activeGroup = data.groups.find((group) => group.id === data.activeGroupId) || null
    window.dispatchEvent(new CustomEvent('active-animal-changed', {
      detail: { data: getData(), activeAnimal, activeGroup }
    }))
  }

  async function persist() {
    data = normalizeAnimalData(data)
    data = normalizeAnimalData(await window.electronAPI.saveProjectAnimals(projectId, data))
    tree.innerHTML = renderCatalog(data)
    emitSelection()
  }

  async function saveData(nextData) {
    data = normalizeAnimalData(nextData)
    await persist()
    return data
  }

  async function savePresets(nextPresets) {
    if (typeof window.electronAPI.saveProjectEtograms === 'function') {
      presets = await window.electronAPI.saveProjectEtograms(projectId, nextPresets)
    } else {
      presets = nextPresets
    }
    emitSelection()
    return presets
  }

  function getData() {
    return data
  }

  async function ensureAnimalPreset(animal) {
    if (animal.etogramPresetId && presets.some((preset) => preset.id === animal.etogramPresetId)) return
    const inheritedPresetId = data.animals.find((candidate) =>
      candidate.id !== animal.id
      && candidate.groupId === animal.groupId
      && presets.some((preset) => preset.id === candidate.etogramPresetId)
    )?.etogramPresetId
    if (inheritedPresetId) {
      animal.etogramPresetId = inheritedPresetId
      return
    }
    const group = data.groups.find((item) => item.id === animal.groupId)
    const preset = {
      id: createId('etogram'),
      name: `${group?.name || animal.name} — etogram`,
      activities: []
    }
    presets = [...presets, preset]
    animal.etogramPresetId = preset.id
    await savePresets(presets)
  }

  // Steps through all animals in the order of the list (group by group) and wraps around; used by the keyboard shortcuts.
  async function selectAdjacentAnimal(step) {
    const order = data.groups.flatMap((group) => data.animals.filter((animal) => animal.groupId === group.id))
    if (!order.length) return

    const index = order.findIndex((animal) => animal.id === data.activeAnimalId)
    const next = index === -1
      ? (step > 0 ? order[0] : order[order.length - 1])
      : order[(index + step + order.length) % order.length]

    data.activeGroupId = next.groupId
    data.activeAnimalId = next.id
    await ensureAnimalPreset(next)
    await persist()
  }

  function openNameDialog(action, title, hint, placeholder) {
    dialogAction = action
    form.querySelector('h3').textContent = title
    form.querySelector('.animal-name-hint').textContent = hint
    nameInput.placeholder = placeholder
    nameInput.value = ''
    dialog.classList.remove('hidden')
    nameInput.focus()
  }

  async function handleCatalogAction(action, target) {
    const groupNode = target.closest('[data-group-id]')
    const groupId = groupNode?.dataset.groupId

    if (action === 'toggle-group') {
      data.activeGroupId = groupId
      const currentAnimal = data.animals.find((animal) => animal.id === data.activeAnimalId)
      if (currentAnimal?.groupId !== groupId) {
        data.activeAnimalId = null
      }
      await persist()
    } else if (action === 'select-animal') {
      const animal = data.animals.find((item) => item.id === target.dataset.animalId)
      if (!animal) return
      data.activeGroupId = animal.groupId
      data.activeAnimalId = animal.id
      await ensureAnimalPreset(animal)
      await persist()
    } else if (action === 'add-group') {
      openNameDialog('add-group', 'Dodaj grupę', 'Grupa może reprezentować gatunek lub inny zestaw obserwacji.', 'np. Mrówki')
    } else if (action === 'add-animal') {
      data.activeGroupId = groupId
      openNameDialog('add-animal', 'Dodaj zwierzę', 'Nowy osobnik zostanie przypisany do wybranej grupy.', 'np. Mrówka 1')
    } else if (action === 'remove-animal') {
      const animalId = target.dataset.animalId
      data.animals = data.animals.filter((animal) => animal.id !== animalId)
      if (data.activeAnimalId === animalId) data.activeAnimalId = null
      await persist()
    } else if (action === 'reroll-color') {
      const animal = data.animals.find((item) => item.id === target.dataset.animalId)
      if (!animal) return
      animal.color = chooseAnimalColor(data.animals.filter((item) => item.id !== animal.id), Math.random, animal.color)
      await persist()
    } else if (action === 'remove-group') {
      data.groups = data.groups.filter((group) => group.id !== groupId)
      data.animals = data.animals.filter((animal) => animal.groupId !== groupId)
      if (data.activeGroupId === groupId) data.activeGroupId = data.groups[0]?.id || null
      const activeAnimal = data.animals.find((animal) => animal.id === data.activeAnimalId)
      if (!activeAnimal) data.activeAnimalId = null
      await persist()
    }
  }

  host.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]')
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    handleCatalogAction(target.dataset.action, target).catch((error) => {
      console.error('Failed to update animal catalog:', error)
    })
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const name = nameInput.value.trim()
    if (!name) return

    if (dialogAction === 'add-group') {
      data = createGroup(data, name)
      data.activeGroupId = data.groups.at(-1)?.id || null
    } else if (dialogAction === 'add-animal') {
      data = createAnimal(data, data.activeGroupId, name)
      await ensureAnimalPreset(data.animals.at(-1))
    }

    dialog.classList.add('hidden')
    await persist()
  })

  form.querySelector('[data-action="cancel-name"]').addEventListener('click', () => dialog.classList.add('hidden'))
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.classList.add('hidden')
  })

  emitSelection()
  return {
    getData,
    persist,
    saveData,
    getPresets: () => presets,
    savePresets,
    selectAdjacentAnimal,
    chooseAnimalColor: () => chooseAnimalColor(data.animals)
  }
}

export const AnimalCatalogModule = { init, renderCatalog }

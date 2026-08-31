const defaultTheme = {
  bgColor: '#1a1a1a',
  textColor: '#e0e0e0',
  primaryColor: '#ff4f1a'
}

const themeState = {
  bgColor: defaultTheme.bgColor,
  textColor: defaultTheme.textColor,
  primaryColor: defaultTheme.primaryColor
}

let hasUnsavedChanges = false
let appSettings = { programShortcuts: [], projectShortcuts: [] }
let pendingShortcutEdit = null

const defaultShortcuts = {
  'move-forward': { primary: 'W', secondary: '', operator: '/' },
  'move-left': { primary: 'A', secondary: '', operator: '/' },
  'move-right': { primary: 'D', secondary: '', operator: '/' },
  sprint: { primary: 'Shift', secondary: '', operator: '/' },
  interact: { primary: 'E', secondary: '', operator: '/' },
  menu: { primary: 'Esc', secondary: '', operator: '/' }
}

const normalizeKeyValue = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return ''
  }

  const trimmed = value.trim()
  return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed
}

const normalizeShortcutEntry = (value) => {
  if (typeof value === 'string') {
    return { primary: normalizeKeyValue(value), secondary: '', operator: '/' }
  }

  if (value && typeof value === 'object') {
    return {
      primary: normalizeKeyValue(value.primary),
      secondary: normalizeKeyValue(value.secondary),
      operator: value.operator === '+' ? '+' : '/'
    }
  }

  return { primary: '', secondary: '', operator: '/' }
}

const getShortcutSignature = (shortcut) => {
  const primary = normalizeKeyValue(shortcut.primary)
  const secondary = normalizeKeyValue(shortcut.secondary)

  if (!primary && !secondary) {
    return ''
  }

  return secondary ? `${primary}${shortcut.operator}${secondary}` : primary
}

const settingsCatalog = {
  general: {
    title: 'Ogólne',
    options: [
      { id: 'bg-color', label: 'Kolor tła', type: 'color', key: 'bgColor' },
      { id: 'text-color', label: 'Kolor tekstu', type: 'color', key: 'textColor' },
      { id: 'accent-color', label: 'Kolor akcentu', type: 'color', key: 'primaryColor' }
    ]
  },
  graphics: {
    title: 'Graficzne',
    options: [
      { id: 'frame-rate', label: 'Frame Rate', type: 'select', value: '60fps', values: ['30fps', '60fps', '120fps'] },
      { id: 'shadow-quality', label: 'Shadow Quality', type: 'select', value: 'Ultra High', values: ['Low', 'Medium', 'High', 'Ultra High'] },
      { id: 'effects-quality', label: 'Special Effects Quality', type: 'select', value: 'High', values: ['Low', 'Medium', 'High', 'Ultra High'] },
      { id: 'lod-bias', label: 'LOD Bias', type: 'select', value: 'High', values: ['Low', 'Medium', 'High'] },
      { id: 'capsule-ao', label: 'Capsule AO', type: 'toggle', value: true },
      { id: 'volumetric-fog', label: 'Volumetric Fog', type: 'toggle', value: true },
      { id: 'volumetric-lighting', label: 'Volumetric Lighting', type: 'toggle', value: true },
      { id: 'motion-blur', label: 'Motion Blur', type: 'toggle', value: true }
    ]
  },
  shortcuts: {
    title: 'Skróty klawiszowe',
    options: [
      { id: 'move-forward', label: 'Ruch do przodu', type: 'keybind', value: { primary: 'W', secondary: '', operator: '/' } },
      { id: 'move-left', label: 'Ruch w lewo', type: 'keybind', value: { primary: 'A', secondary: '', operator: '/' } },
      { id: 'move-right', label: 'Ruch w prawo', type: 'keybind', value: { primary: 'D', secondary: '', operator: '/' } },
      { id: 'sprint', label: 'Sprint', type: 'keybind', value: { primary: 'Shift', secondary: '', operator: '/' } },
      { id: 'interact', label: 'Interakcja', type: 'keybind', value: { primary: 'E', secondary: '', operator: '/' } },
      { id: 'menu', label: 'Menu', type: 'keybind', value: { primary: 'Esc', secondary: '', operator: '/' } }
    ]
  }
}

function getColorValue(key) {
  return (themeState[key] || defaultTheme[key]).toUpperCase()
}

function getProgramShortcuts() {
  return settingsCatalog.shortcuts.options.map((option) => ({
    id: option.id,
    label: option.label,
    value: normalizeShortcutEntry(option.value)
  }))
}

function getShortcutConflictMessage(optionId, shortcut) {
  const keySignature = getShortcutSignature(shortcut)
  if (!keySignature) {
    return ''
  }

  const conflicts = getProgramShortcuts().filter((entry) => {
    return entry.id !== optionId && getShortcutSignature(entry.value) === keySignature
  })

  return conflicts.length > 0 ? `Powielony skrót: ${conflicts.map((entry) => entry.label).join(', ')}` : ''
}

async function persistAppSettings() {
  const programShortcuts = getProgramShortcuts().map((entry) => ({
    id: entry.id,
    label: entry.label,
    value: entry.value
  }))

  appSettings = {
    ...appSettings,
    programShortcuts
  }

  await window.electronAPI.saveAppSettings(appSettings)
  hasUnsavedChanges = false
}

async function loadSavedAppSettings() {
  const saved = await window.electronAPI.getAppSettings()
  appSettings = { ...appSettings, ...saved }

  if (Array.isArray(appSettings.programShortcuts)) {
    const savedMap = Object.fromEntries(appSettings.programShortcuts.map((entry) => [entry.id, normalizeShortcutEntry(entry.value)]))

    settingsCatalog.shortcuts.options.forEach((option) => {
      if (savedMap[option.id]) {
        option.value = savedMap[option.id]
      }
    })
  }
}

function applyCurrentTheme() {
  return window.electronAPI.setTheme({
    bgColor: themeState.bgColor,
    textColor: themeState.textColor,
    primaryColor: themeState.primaryColor
  }).then(() => {
    hasUnsavedChanges = false
  })
}

function syncTheme(theme = {}) {
  if (theme.bgColor) {
    themeState.bgColor = theme.bgColor
  }

  if (theme.textColor) {
    themeState.textColor = theme.textColor
  }

  if (theme.primaryColor) {
    themeState.primaryColor = theme.primaryColor
  }

  const activeTab = document.querySelector('.settings-tab.active')?.dataset.tab || 'general'
  renderOptions(activeTab)
}

function renderTabs() {
  const tabContainer = document.getElementById('settings-tabs')
  const tabEntries = Object.entries(settingsCatalog)

  tabEntries.forEach(([key, config]) => {
    const tabButton = document.createElement('button')
    tabButton.type = 'button'
    tabButton.className = 'settings-tab active'
    if (key !== 'general') {
      tabButton.classList.remove('active')
    }
    tabButton.dataset.tab = key
    tabButton.textContent = config.title

    tabButton.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach((button) => {
        button.classList.toggle('active', button === tabButton)
      })
      renderOptions(key)
    })

    tabContainer.appendChild(tabButton)
  })
}

function renderOptions(tabId) {
  const sectionTitle = document.getElementById('settings-section-title')
  const container = document.getElementById('settings-options')
  const section = settingsCatalog[tabId]

  if (!section) {
    return
  }

  sectionTitle.textContent = section.title
  container.innerHTML = ''

  section.options.forEach((option) => {
    const row = document.createElement('div')
    row.className = 'settings-option'

    const label = document.createElement('span')
    label.className = 'option-label'
    label.textContent = option.label

    const controlWrap = document.createElement('div')
    controlWrap.className = 'option-control'

    if (option.type === 'color') {
      const input = document.createElement('input')
      input.type = 'color'
      input.value = themeState[option.key].toLowerCase()
      input.setAttribute('aria-label', option.label)

      input.addEventListener('input', (event) => {
        themeState[option.key] = event.target.value
        hasUnsavedChanges = true
        const valueText = event.target.closest('.settings-option').querySelector('.option-value')
        if (valueText) {
          valueText.textContent = event.target.value.toUpperCase()
        }
      })

      const value = document.createElement('span')
      value.className = 'option-value'
      value.textContent = getColorValue(option.key)

      controlWrap.appendChild(input)
      controlWrap.appendChild(value)
    }

    if (option.type === 'select') {
      const select = document.createElement('select')
      option.values.forEach((value) => {
        const optionElement = document.createElement('option')
        optionElement.value = value
        optionElement.textContent = value
        if (value === option.value) {
          optionElement.selected = true
        }
        select.appendChild(optionElement)
      })
      select.addEventListener('change', (event) => {
        option.value = event.target.value
        hasUnsavedChanges = true
      })
      controlWrap.appendChild(select)
    }

    if (option.type === 'toggle') {
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = `option-toggle ${option.value ? 'active' : ''}`
      toggle.setAttribute('aria-label', option.label)
      toggle.addEventListener('click', () => {
        option.value = !option.value
        hasUnsavedChanges = true
        toggle.classList.toggle('active', option.value)
      })
      controlWrap.appendChild(toggle)
    }

    if (option.type === 'keybind') {
      const shortcut = normalizeShortcutEntry(option.value)
      option.value = shortcut

      const primaryButton = document.createElement('button')
      primaryButton.type = 'button'
      primaryButton.className = 'option-keybind'
      primaryButton.textContent = shortcut.primary || '—'

      const operatorButton = document.createElement('button')
      operatorButton.type = 'button'
      operatorButton.className = `combo-operator ${shortcut.secondary ? 'active' : ''}`
      operatorButton.textContent = shortcut.secondary ? shortcut.operator : ''
      operatorButton.title = shortcut.secondary ? 'Kliknij by zmienić operator. Prawy klik usuwa kombinację.' : 'Dodaj kombinację klawiszy'

      const secondaryButton = document.createElement('button')
      secondaryButton.type = 'button'
      secondaryButton.className = `option-keybind combo-slot ${shortcut.secondary ? 'active' : 'muted'}`
      secondaryButton.textContent = shortcut.secondary || ''
      secondaryButton.title = shortcut.secondary ? 'Kliknij, aby zmienić drugi klawisz.' : 'Kliknij, aby dodać drugi klawisz.'
      if (!shortcut.secondary) {
        secondaryButton.disabled = false
      }

      const setWarning = () => {
        const conflictText = getShortcutConflictMessage(option.id, shortcut)
        const warning = row.querySelector('.keybind-warning')

        if (warning) {
          warning.textContent = conflictText
          warning.hidden = !conflictText
        } else if (conflictText) {
          const newWarning = document.createElement('div')
          newWarning.className = 'keybind-warning'
          newWarning.textContent = conflictText
          row.appendChild(newWarning)
        }
      }

      const refreshButtons = () => {
        primaryButton.textContent = shortcut.primary || '—'
        operatorButton.textContent = shortcut.secondary ? shortcut.operator : ''
        operatorButton.classList.toggle('active', Boolean(shortcut.secondary))
        operatorButton.title = shortcut.secondary ? 'Kliknij by zmienić operator. Prawy klik usuwa kombinację.' : 'Dodaj kombinację klawiszy'
        secondaryButton.textContent = shortcut.secondary || ''
        secondaryButton.classList.toggle('active', Boolean(shortcut.secondary))
        secondaryButton.classList.toggle('muted', !shortcut.secondary)
        secondaryButton.title = shortcut.secondary ? 'Kliknij, aby zmienić drugi klawisz.' : 'Kliknij, aby dodać drugi klawisz.'
        option.value = shortcut
        setWarning()
      }

      const assignKey = (fieldName, callback) => {
        pendingShortcutEdit = { optionId: option.id, fieldName }

        const capture = (event) => {
          event.preventDefault()
          const nextKey = normalizeKeyValue(event.key)

          if (!nextKey) {
            window.removeEventListener('keydown', capture)
            pendingShortcutEdit = null
            return
          }

          if (fieldName === 'primary') {
            shortcut.primary = nextKey
          } else {
            shortcut.secondary = nextKey
          }

          hasUnsavedChanges = true
          refreshButtons()
          callback?.()
          pendingShortcutEdit = null
          window.removeEventListener('keydown', capture)
        }

        window.addEventListener('keydown', capture, { once: true })
      }

      primaryButton.addEventListener('click', () => {
        primaryButton.textContent = '...'
        assignKey('primary', () => {
          primaryButton.textContent = shortcut.primary || '—'
        })
      })

      secondaryButton.addEventListener('click', () => {
        if (!shortcut.secondary) {
          secondaryButton.textContent = '...'
          assignKey('secondary', () => {
            secondaryButton.textContent = shortcut.secondary || ''
          })
          return
        }

        secondaryButton.textContent = '...'
        assignKey('secondary', () => {
          secondaryButton.textContent = shortcut.secondary || ''
        })
      })

      operatorButton.addEventListener('click', () => {
        if (!shortcut.secondary) {
          return
        }

        shortcut.operator = shortcut.operator === '+' ? '/' : '+'
        hasUnsavedChanges = true
        refreshButtons()
      })

      const cancelShortcutEdit = () => {
        shortcut.primary = ''
        shortcut.secondary = ''
        shortcut.operator = '/'
        hasUnsavedChanges = true
        pendingShortcutEdit = null
        refreshButtons()
      }

      document.getElementById('apply-btn')?.addEventListener('click', () => {
        if (pendingShortcutEdit && pendingShortcutEdit.optionId === option.id) {
          cancelShortcutEdit()
        }
      })

      controlWrap.appendChild(primaryButton)
      controlWrap.appendChild(operatorButton)
      controlWrap.appendChild(secondaryButton)
      setWarning()
    }

    row.appendChild(label)
    row.appendChild(controlWrap)
    container.appendChild(row)
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  renderTabs()
  await loadSavedAppSettings()
  renderOptions('general')

  const theme = await window.electronAPI.getTheme()
  syncTheme(theme)

  document.getElementById('apply-btn').addEventListener('click', async () => {
    await persistAppSettings()
    await applyCurrentTheme()
    document.body.classList.add('applied')
    window.setTimeout(() => document.body.classList.remove('applied'), 500)
  })

  document.getElementById('reset-btn').addEventListener('click', async () => {
    themeState.bgColor = defaultTheme.bgColor
    themeState.textColor = defaultTheme.textColor
    themeState.primaryColor = defaultTheme.primaryColor
    settingsCatalog.shortcuts.options.forEach((option) => {
      option.value = { ...defaultShortcuts[option.id] }
    })
    hasUnsavedChanges = true
    renderOptions(document.querySelector('.settings-tab.active')?.dataset.tab || 'general')
    await persistAppSettings()
    await applyCurrentTheme()
  })

  document.querySelector('.window-close').addEventListener('click', async () => {
    if (!hasUnsavedChanges) {
      window.close()
      return
    }

    const shouldSave = window.confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')

    if (shouldSave) {
      await persistAppSettings()
      await applyCurrentTheme()
      window.close()
      return
    }

    const shouldDiscard = window.confirm('Czy odrzucić zmiany i zamknąć okno?')
    if (shouldDiscard) {
      window.close()
    }
  })

  window.electronAPI.onThemeChange((updatedTheme) => {
    syncTheme(updatedTheme)
  })
})

import { createDefaultAppSettings, defaultShortcuts, defaultTheme, settingsCatalog } from './settings-config.js'
import { getShortcutConflictMessage as findShortcutConflictMessage, normalizeKeyValue, normalizeShortcutEntry } from './shortcut-utils.js'
import { loadSettings, saveSettings } from './settings-service.js'

let appSettings = createDefaultAppSettings()
let themeState = { ...appSettings.theme }
let hasUnsavedChanges = false
let pendingShortcutEdit = null

function getColorValue(key) {
  return (themeState[key] || defaultTheme[key]).toUpperCase()
}

function getProgramShortcuts() {
  return appSettings.programShortcuts
}

function getShortcutConflictMessage(optionId, shortcut) {
  return findShortcutConflictMessage(optionId, shortcut, getProgramShortcuts())
}

async function persistAppSettings() {
  appSettings.theme = { ...themeState }
  appSettings = await saveSettings(window.electronAPI, appSettings)
  themeState = { ...appSettings.theme }
  hasUnsavedChanges = false
}

async function loadSavedAppSettings() {
  appSettings = await loadSettings(window.electronAPI)
  themeState = { ...appSettings.theme }
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
  appSettings.theme = { ...themeState }

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
      const settingsState = appSettings[option.storage || 'graphics']
      const settingKey = option.storage === 'timeline' && option.id === 'snap-threshold-px' ? 'snapThresholdPx' : option.id
      const selectedValue = settingsState[settingKey] ?? option.defaultValue
      option.values.forEach((value) => {
        const optionElement = document.createElement('option')
        optionElement.value = value
        optionElement.textContent = value
        if (value === selectedValue) {
          optionElement.selected = true
        }
        select.appendChild(optionElement)
      })
      select.addEventListener('change', (event) => {
        settingsState[settingKey] = option.storage === 'timeline' ? Number(event.target.value) : event.target.value
        hasUnsavedChanges = true
      })
      controlWrap.appendChild(select)
    }

    if (option.type === 'toggle') {
      const settingsState = appSettings[option.storage || 'graphics']
      const settingKey = option.storage === 'timeline' && option.id === 'snap-enabled' ? 'snapEnabled' : option.id
      const isEnabled = settingsState[settingKey] ?? option.defaultValue
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = `option-toggle ${isEnabled ? 'active' : ''}`
      toggle.setAttribute('aria-label', option.label)
      toggle.addEventListener('click', () => {
        settingsState[settingKey] = !settingsState[settingKey]
        hasUnsavedChanges = true
        toggle.classList.toggle('active', settingsState[settingKey])
      })
      controlWrap.appendChild(toggle)
    }

    if (option.type === 'keybind') {
      const shortcutEntry = appSettings.programShortcuts.find((entry) => entry.id === option.id)
      const shortcut = normalizeShortcutEntry(shortcutEntry?.value ?? defaultShortcuts[option.id])
      if (shortcutEntry) {
        shortcutEntry.value = shortcut
      }

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
        if (shortcutEntry) {
          shortcutEntry.value = shortcut
        }
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
    document.body.classList.add('applied')
    window.setTimeout(() => document.body.classList.remove('applied'), 500)
  })

  document.getElementById('reset-btn').addEventListener('click', async () => {
    appSettings = createDefaultAppSettings()
    themeState = { ...appSettings.theme }
    hasUnsavedChanges = true
    renderOptions(document.querySelector('.settings-tab.active')?.dataset.tab || 'general')
    await persistAppSettings()
  })

  document.querySelector('.window-close').addEventListener('click', async () => {
    if (!hasUnsavedChanges) {
      window.close()
      return
    }

    const shouldSave = window.confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')

    if (shouldSave) {
      await persistAppSettings()
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

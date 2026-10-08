import { createDefaultAppSettings, defaultTheme, settingsCatalog } from './settings-config.js'
import { createKeybindControl } from './keybind-control.js'
import { loadSettings, saveSettings } from './settings-service.js'

let appSettings = createDefaultAppSettings()
let themeState = { ...appSettings.theme }
let hasUnsavedChanges = false
let keybindControls = []

function getColorValue(key) {
  return (themeState[key] || defaultTheme[key]).toUpperCase()
}

function getProgramShortcuts() {
  return appSettings.programShortcuts
}

function renderActiveTab() {
  renderOptions(document.querySelector('.settings-tab.active')?.dataset.tab || 'general')
}

async function persistAppSettings() {
  appSettings.theme = { ...themeState }
  appSettings = await saveSettings(window.electronAPI, appSettings)
  themeState = { ...appSettings.theme }
  hasUnsavedChanges = false
  // Saving replaces the settings object, so the controls on screen must be rebuilt to edit the saved one.
  renderActiveTab()
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

  renderActiveTab()
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
  keybindControls = []

  let currentGroup = null
  section.options.forEach((option) => {
    if (option.group && option.group !== currentGroup) {
      currentGroup = option.group
      const heading = document.createElement('h3')
      heading.className = 'settings-group'
      heading.textContent = option.group
      container.appendChild(heading)
    }

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
      const entry = appSettings.programShortcuts.find((item) => item.id === option.id)
      if (entry) {
        const control = createKeybindControl({
          entry,
          getEntries: getProgramShortcuts,
          onChange: () => {
            hasUnsavedChanges = true
            keybindControls.forEach((item) => item.refresh())
          }
        })
        keybindControls.push(control)
        controlWrap.appendChild(control.element)
      }
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

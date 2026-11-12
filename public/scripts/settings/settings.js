import { createDefaultAppSettings, defaultTheme, settingsCatalog } from './settings-config.js'
import { createKeybindControl } from './keybind-control.js'
import { THEME_PRESETS, matchThemePreset } from '../shared/appearance.js'
import { applyTheme } from '../theme/theme-service.js'
import { initLanguage, t, translatePage } from '../shared/i18n.js'
import { loadSettings, saveSettings } from './settings-service.js'

let appSettings = createDefaultAppSettings()
let themeState = { ...appSettings.theme }
let hasUnsavedChanges = false
let keybindControls = []

function getColorValue(key) {
  return (themeState[key] || defaultTheme[key]).toUpperCase()
}

// Where an option keeps its value: the colors and the font are edited in `themeState`, the language sits at the top level.
function stateOf(option) {
  if (option.storage === 'theme') return themeState
  return option.storage === 'app' ? appSettings : appSettings[option.storage || 'graphics']
}

function getProgramShortcuts() {
  return appSettings.programShortcuts
}

function renderActiveTab() {
  renderOptions(document.querySelector('.settings-tab.active')?.dataset.tab || Object.keys(settingsCatalog)[0])
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
  applyTheme(themeState)
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

  if (theme.font) {
    themeState.font = theme.font
  }

  if (theme.custom) {
    themeState.custom = { ...theme.custom }
  }
  appSettings.theme = { ...themeState }
  applyTheme(themeState)

  renderActiveTab()
}

function renderTabs() {
  const tabContainer = document.getElementById('settings-tabs')
  const tabEntries = Object.entries(settingsCatalog)

  tabEntries.forEach(([key, config]) => {
    const tabButton = document.createElement('button')
    tabButton.type = 'button'
    tabButton.className = 'settings-tab active'
    if (key !== tabEntries[0][0]) {
      tabButton.classList.remove('active')
    }
    tabButton.dataset.tab = key
    tabButton.textContent = t(config.title)

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

  sectionTitle.textContent = t(section.title)
  container.innerHTML = ''
  keybindControls = []

  let currentGroup = null
  section.options.forEach((option) => {
    if (option.group && option.group !== currentGroup) {
      currentGroup = option.group
      const heading = document.createElement('h3')
      heading.className = 'settings-group'
      heading.textContent = t(option.group)
      container.appendChild(heading)
    }

    const row = document.createElement('div')
    row.className = 'settings-option'

    const label = document.createElement('span')
    label.className = 'option-label'
    label.textContent = t(option.label)

    const controlWrap = document.createElement('div')
    controlWrap.className = 'option-control'

    if (option.type === 'color') {
      const input = document.createElement('input')
      input.type = 'color'
      input.value = themeState[option.key].toLowerCase()
      input.setAttribute('aria-label', t(option.label))

      input.addEventListener('input', (event) => {
        themeState[option.key] = event.target.value
        themeState.preset = matchThemePreset(themeState)
        themeState.custom = { bgColor: themeState.bgColor, textColor: themeState.textColor, primaryColor: themeState.primaryColor }
        applyTheme(themeState)
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
      const settingsState = stateOf(option)
      const settingKey = option.key || option.id
      const selectedValue = String(settingsState[settingKey] ?? option.defaultValue)
      option.values.forEach((choice) => {
        const { value, label: text } = typeof choice === 'object' ? choice : { value: choice, label: choice }
        const optionElement = document.createElement('option')
        optionElement.value = value
        optionElement.textContent = t(text)
        if (String(value) === selectedValue) {
          optionElement.selected = true
        }
        select.appendChild(optionElement)
      })
      select.addEventListener('change', (event) => {
        settingsState[settingKey] = option.storage === 'timeline' ? Number(event.target.value) : event.target.value
        if (option.storage === 'theme') applyTheme(themeState)
        hasUnsavedChanges = true
      })
      controlWrap.appendChild(select)
    }

    if (option.type === 'themePresets') {
      const current = matchThemePreset(themeState)
      Object.entries(THEME_PRESETS).concat([['custom', { label: 'Własny' }]]).forEach(([id, preset]) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = `option-preset ${current === id ? 'active' : ''}`
        button.textContent = t(preset.label)
        button.addEventListener('click', () => {
          // A ready scheme only changes the colors in use; the user's own colors stay remembered for "Własny".
          const colors = id === 'custom' ? themeState.custom : preset
          Object.assign(themeState, { bgColor: colors.bgColor, textColor: colors.textColor, primaryColor: colors.primaryColor })
          themeState.preset = matchThemePreset(themeState)
          applyTheme(themeState)
          hasUnsavedChanges = true
          renderActiveTab()
        })
        controlWrap.appendChild(button)
      })
    }

    if (option.type === 'toggle') {
      const settingsState = appSettings[option.storage || 'graphics']
      const settingKey = option.key || option.id
      const isEnabled = settingsState[settingKey] ?? option.defaultValue
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = `option-toggle ${isEnabled ? 'active' : ''}`
      toggle.setAttribute('aria-label', t(option.label))
      toggle.addEventListener('click', () => {
        settingsState[settingKey] = !settingsState[settingKey]
        hasUnsavedChanges = true
        toggle.classList.toggle('active', settingsState[settingKey])
      })
      controlWrap.appendChild(toggle)
    }

    if (option.type === 'number') {
      const settingsState = appSettings[option.storage || 'graphics']
      const settingKey = option.key || option.id
      const input = document.createElement('input')
      input.type = 'number'
      input.min = String(option.min)
      input.max = String(option.max)
      input.step = String(option.step)
      input.value = String(settingsState[settingKey] ?? option.defaultValue)
      input.setAttribute('aria-label', t(option.label))
      input.addEventListener('change', () => {
        const value = Number(input.value.replace(',', '.'))
        // Out-of-range or empty input falls back to the last valid value.
        if (input.value.trim() !== '' && Number.isFinite(value) && value >= option.min && value <= option.max) {
          settingsState[settingKey] = value
          hasUnsavedChanges = true
        }
        input.value = String(settingsState[settingKey] ?? option.defaultValue)
      })
      controlWrap.appendChild(input)
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
  await initLanguage()
  translatePage()
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

  // The window asks before it closes (also when the system's × is used); only a confirmed close goes through.
  window.electronAPI.onSettingsCloseRequest(async () => {
    if (!hasUnsavedChanges) {
      window.electronAPI.confirmSettingsClose()
      return
    }

    if (window.confirm(t('Masz niezapisane zmiany. Czy chcesz je zapisać?'))) {
      await persistAppSettings()
      window.electronAPI.confirmSettingsClose()
      return
    }

    if (window.confirm(t('Czy odrzucić zmiany i zamknąć okno?'))) window.electronAPI.confirmSettingsClose()
  })

  window.electronAPI.onThemeChange((updatedTheme) => {
    syncTheme(updatedTheme)
  })
})

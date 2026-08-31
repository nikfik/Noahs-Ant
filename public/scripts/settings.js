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
      { id: 'move-forward', label: 'Ruch do przodu', type: 'keybind', value: 'W' },
      { id: 'move-left', label: 'Ruch w lewo', type: 'keybind', value: 'A' },
      { id: 'move-right', label: 'Ruch w prawo', type: 'keybind', value: 'D' },
      { id: 'sprint', label: 'Sprint', type: 'keybind', value: 'Shift' },
      { id: 'interact', label: 'Interakcja', type: 'keybind', value: 'E' },
      { id: 'menu', label: 'Menu', type: 'keybind', value: 'Esc' }
    ]
  }
}

function getColorValue(key) {
  return (themeState[key] || defaultTheme[key]).toUpperCase()
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
      const keyButton = document.createElement('button')
      keyButton.type = 'button'
      keyButton.className = 'option-keybind'
      keyButton.textContent = option.value
      keyButton.addEventListener('click', () => {
        keyButton.textContent = '...'
        const assignKey = (event) => {
          event.preventDefault()
          const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
          option.value = key
          hasUnsavedChanges = true
          keyButton.textContent = key
          window.removeEventListener('keydown', assignKey)
        }
        window.addEventListener('keydown', assignKey, { once: true })
      })
      controlWrap.appendChild(keyButton)
    }

    row.appendChild(label)
    row.appendChild(controlWrap)
    container.appendChild(row)
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  renderTabs()
  renderOptions('general')

  const theme = await window.electronAPI.getTheme()
  syncTheme(theme)

  document.getElementById('apply-btn').addEventListener('click', async () => {
    await applyCurrentTheme()
    document.body.classList.add('applied')
    window.setTimeout(() => document.body.classList.remove('applied'), 500)
  })

  document.getElementById('reset-btn').addEventListener('click', async () => {
    themeState.bgColor = defaultTheme.bgColor
    themeState.textColor = defaultTheme.textColor
    themeState.primaryColor = defaultTheme.primaryColor
    hasUnsavedChanges = true
    renderOptions(document.querySelector('.settings-tab.active')?.dataset.tab || 'general')
    await applyCurrentTheme()
  })

  document.querySelector('.window-close').addEventListener('click', async () => {
    if (!hasUnsavedChanges) {
      window.close()
      return
    }

    const shouldSave = window.confirm('Masz niezapisane zmiany. Czy chcesz je zapisać?')

    if (shouldSave) {
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

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

function componentToHex(value) {
  const hex = Number(value).toString(16)
  return hex.length === 1 ? `0${hex}` : hex
}

function rgbToHex(r, g, b) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized

  const intValue = parseInt(value, 16)
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  }
}

function setSliderValues(prefix, hexColor) {
  const { r, g, b } = hexToRgb(hexColor)
  document.getElementById(`${prefix}-r`).value = r
  document.getElementById(`${prefix}-g`).value = g
  document.getElementById(`${prefix}-b`).value = b
}

function updatePreview(prefix) {
  const r = Number(document.getElementById(`${prefix}-r`).value)
  const g = Number(document.getElementById(`${prefix}-g`).value)
  const b = Number(document.getElementById(`${prefix}-b`).value)
  const hex = rgbToHex(r, g, b)

  document.getElementById(`${prefix}-preview`).style.backgroundColor = hex
  document.getElementById(`${prefix}-value`).textContent = hex

  if (prefix === 'bg') {
    themeState.bgColor = hex
  } else {
    themeState.textColor = hex
  }
}

function applyCurrentTheme() {
  return window.electronAPI.setTheme({
    bgColor: themeState.bgColor,
    textColor: themeState.textColor,
    primaryColor: themeState.primaryColor
  })
}

function syncTheme(theme) {
  if (theme.bgColor) {
    themeState.bgColor = theme.bgColor
    setSliderValues('bg', theme.bgColor)
    updatePreview('bg')
  }

  if (theme.textColor) {
    themeState.textColor = theme.textColor
    setSliderValues('text', theme.textColor)
    updatePreview('text')
  }

  if (theme.primaryColor) {
    themeState.primaryColor = theme.primaryColor
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const theme = await window.electronAPI.getTheme()
  syncTheme(theme)

  document.querySelectorAll('.slider').forEach((slider) => {
    slider.addEventListener('input', (event) => {
      updatePreview(event.target.dataset.target)
    })
  })

  document.getElementById('apply-btn').addEventListener('click', async () => {
    await applyCurrentTheme()
    document.body.classList.add('applied')
    window.setTimeout(() => document.body.classList.remove('applied'), 500)
  })

  document.getElementById('reset-btn').addEventListener('click', async () => {
    themeState.bgColor = defaultTheme.bgColor
    themeState.textColor = defaultTheme.textColor
    themeState.primaryColor = defaultTheme.primaryColor

    setSliderValues('bg', defaultTheme.bgColor)
    setSliderValues('text', defaultTheme.textColor)
    updatePreview('bg')
    updatePreview('text')
    await applyCurrentTheme()
  })

  window.electronAPI.onThemeChange((updatedTheme) => {
    syncTheme(updatedTheme)
  })
})

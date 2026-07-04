document.addEventListener('DOMContentLoaded', async () => {
  const settingsTab = document.querySelector('.settings-tab')
  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      window.electronAPI.openSettingsWindow()
    })
  }

  const applyTheme = (theme) => {
    if (!theme) return

    document.documentElement.style.setProperty('--bg-color', theme.bgColor || '#1a1a1a')
    document.documentElement.style.setProperty('--text-color', theme.textColor || '#e0e0e0')
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor || '#ff4f1a')
  }

  const currentTheme = await window.electronAPI.getTheme()
  applyTheme(currentTheme)

  window.electronAPI.onThemeChange(applyTheme)
})

document.addEventListener('DOMContentLoaded', async () => {
  const settingsTab = document.querySelector('.settings-tab')

  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      window.electronAPI.openSettingsWindow()
    })
  }

  const currentTheme = await window.electronAPI.getTheme()
  window.ThemeService.applyTheme(currentTheme)

  await window.ProjectListController.initProjectList()
  window.electronAPI.onThemeChange(window.ThemeService.applyTheme)
})

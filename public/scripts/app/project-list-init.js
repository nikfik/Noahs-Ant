import { applyTheme } from '../theme/theme-service.js'
import { initProjectList } from '../projects/project-list-controller.js'

document.addEventListener('DOMContentLoaded', async () => {
  const settingsTab = document.querySelector('.settings-tab')

  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      window.electronAPI?.openSettingsWindow?.()
    })
  }

  try {
    const currentTheme = await window.electronAPI?.getTheme?.()
    if (currentTheme) applyTheme(currentTheme)
  } catch (error) {
    console.error('Failed to get theme:', error)
  }

  try {
    await initProjectList()
  } catch (error) {
    console.error('Failed to init project list:', error)
  }

  window.electronAPI?.onThemeChange?.((theme) => applyTheme(theme))
})

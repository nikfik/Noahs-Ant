import { ThemeService } from '../theme/theme-service.js'
import { ProjectListController } from '../projects/project-list-controller.js'
import { WorkspaceRouter } from '../workspace/workspace-router.js'
import { projectUtils } from '../projects/project-utils.js'

if (typeof window !== 'undefined') {
  window.ThemeService = ThemeService
  window.ProjectListController = ProjectListController
  window.WorkspaceRouter = WorkspaceRouter
  window.projectUtils = projectUtils
}

document.addEventListener('DOMContentLoaded', async () => {
  const settingsTab = document.querySelector('.settings-tab')

  if (settingsTab) {
    settingsTab.addEventListener('click', async () => {
      try {
        await window.electronAPI?.openSettingsWindow?.()
      } catch (error) {
        console.error('Failed to open settings window:', error)
      }
    })
  }

  try {
    const currentTheme = await window.electronAPI?.getTheme?.()
    if (currentTheme && window.ThemeService?.applyTheme) {
      window.ThemeService.applyTheme(currentTheme)
    }
  } catch (error) {
    console.error('Failed to get theme:', error)
  }

  if (window.ProjectListController?.initProjectList) {
    try {
      await window.ProjectListController.initProjectList()
    } catch (error) {
      console.error('Failed to init project list:', error)
    }
  }

  if (window.electronAPI?.onThemeChange) {
    window.electronAPI.onThemeChange((theme) => {
      if (window.ThemeService?.applyTheme) {
        window.ThemeService.applyTheme(theme)
      }
    })
  }
})

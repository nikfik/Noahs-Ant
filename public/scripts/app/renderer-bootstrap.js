import { ThemeService } from '../theme/theme-service.js'
import { ProjectListController } from '../projects/project-list-controller.js'
import { WorkspaceRouter } from '../workspace/workspace-router.js'

if (typeof window !== 'undefined') {
  window.ThemeService = ThemeService
  window.ProjectListController = ProjectListController
  window.WorkspaceRouter = WorkspaceRouter
}

document.addEventListener('DOMContentLoaded', async () => {
  const settingsTab = document.querySelector('.settings-tab')

  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      window.electronAPI?.openSettingsWindow?.()
    })
  }

  const currentTheme = await window.electronAPI?.getTheme?.()
  if (currentTheme && window.ThemeService?.applyTheme) {
    window.ThemeService.applyTheme(currentTheme)
  }

  if (window.ProjectListController?.initProjectList) {
    await window.ProjectListController.initProjectList()
  }

  if (window.electronAPI?.onThemeChange) {
    window.electronAPI.onThemeChange((theme) => {
      if (window.ThemeService?.applyTheme) {
        window.ThemeService.applyTheme(theme)
      }
    })
  }
})

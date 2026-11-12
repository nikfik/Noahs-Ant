import { initTheme } from '../theme/theme-service.js'
import { initLanguage, translatePage } from '../shared/i18n.js'
import { initProjectList } from '../projects/project-list-controller.js'

document.addEventListener('DOMContentLoaded', async () => {
  await initLanguage()
  translatePage()
  await initTheme()

  try {
    await initProjectList()
  } catch (error) {
    console.error('Failed to init project list:', error)
  }
})

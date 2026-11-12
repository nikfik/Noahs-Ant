import { initTheme } from '../theme/theme-service.js'
import { initProjectList } from '../projects/project-list-controller.js'

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme()

  try {
    await initProjectList()
  } catch (error) {
    console.error('Failed to init project list:', error)
  }
})

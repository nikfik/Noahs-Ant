(function () {
  class VideoIOService {
    static async loadProjectVideo(projectFile) {
      if (!projectFile || !window.electronAPI?.openProject) {
        return ''
      }

      try {
        const project = await window.electronAPI.openProject(projectFile)
        return typeof project?.videoPath === 'string' ? project.videoPath : ''
      } catch (_error) {
        return ''
      }
    }

    static async selectAndSaveProjectVideo(projectFile, stateNode) {
      if (!window.electronAPI?.selectVideoFile || !window.electronAPI?.saveProjectVideoPath) {
        if (stateNode) {
          stateNode.textContent = 'API do wyboru pliku video nie jest jeszcze dostępne.'
        }
        return ''
      }

      const selected = await window.electronAPI.selectVideoFile()
      if (!selected) {
        if (stateNode) {
          stateNode.textContent = 'Anulowano wybór pliku wideo.'
        }
        return ''
      }

      await window.electronAPI.saveProjectVideoPath(projectFile, selected)
      return selected
    }
  }

  window.VideoIOService = VideoIOService
})()

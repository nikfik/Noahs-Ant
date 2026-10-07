export class VideoIOService {
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

  static async selectAndSaveProjectVideo(projectFile) {
    if (!window.electronAPI?.selectVideoFile || !window.electronAPI?.saveProjectVideoPath) {
      return ''
    }

    const selected = await window.electronAPI.selectVideoFile()
    if (!selected) {
      return ''
    }

    await window.electronAPI.saveProjectVideoPath(projectFile, selected)
    return selected
  }
}

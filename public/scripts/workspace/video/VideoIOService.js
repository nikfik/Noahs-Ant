export class VideoIOService {
  static async selectVideoFile() {
    if (!window.electronAPI?.selectVideoFile) return ''
    return (await window.electronAPI.selectVideoFile()) || ''
  }

  // Checks the picked video and converts it when the player cannot open it as it is (camera MTS files, AVI, ...).
  static async prepareVideo(projectId, filePath, settings, onProgress) {
    const api = window.electronAPI
    if (!api?.prepareVideo) return { status: 'ready', videoPath: filePath, converted: false }

    const stopListening = api.onVideoConvertProgress?.((progress) => onProgress?.(progress.percent))
    try {
      return await api.prepareVideo({ projectId, filePath, settings })
    } finally {
      stopListening?.()
    }
  }

  // File name, size and stream details for the quality dialog; null when they cannot be read.
  static async inspectVideo(filePath) {
    try {
      return (await window.electronAPI?.inspectVideo?.(filePath)) ?? null
    } catch (_error) {
      return null
    }
  }

  // Which of the files still exist (all of them when the check is not available).
  static async pathsExist(paths) {
    try {
      return (await window.electronAPI?.pathsExist?.(paths)) ?? paths.map(() => true)
    } catch (_error) {
      return paths.map(() => true)
    }
  }

  static async findFilesInFolder(folder, names) {
    try {
      return (await window.electronAPI?.findFilesInFolder?.({ folder, names })) ?? {}
    } catch (_error) {
      return {}
    }
  }

  static cancelConversion() {
    return window.electronAPI?.cancelVideoConversion?.()
  }

  static async probeVideo(filePath) {
    try {
      return (await window.electronAPI?.probeVideo?.(filePath)) ?? null
    } catch (_error) {
      return null
    }
  }

  // Errors travel through Electron as "Error invoking remote method 'x': Error: message"; only the message is for the user.
  static friendlyError(error) {
    const message = String(error?.message || error).replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
    return message.includes('ffmpeg-missing')
      ? 'Ten format wymaga konwersji, ale nie znaleziono programu ffmpeg.'
      : `Nie udało się przygotować filmu. ${message}`
  }
}

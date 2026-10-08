export class VideoIOService {
  static async selectVideoFile() {
    if (!window.electronAPI?.selectVideoFile) return ''
    return (await window.electronAPI.selectVideoFile()) || ''
  }

  // Checks the picked video and converts it when the player cannot open it as it is (camera MTS files, AVI, ...).
  static async prepareVideo(projectId, filePath, onProgress) {
    const api = window.electronAPI
    if (!api?.prepareVideo) return { status: 'ready', videoPath: filePath, converted: false }

    const stopListening = api.onVideoConvertProgress?.((progress) => onProgress?.(progress.percent))
    try {
      return await api.prepareVideo({ projectId, filePath })
    } finally {
      stopListening?.()
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

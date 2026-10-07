export class VideoIOService {
  static async selectVideoFile() {
    if (!window.electronAPI?.selectVideoFile) return ''
    return (await window.electronAPI.selectVideoFile()) || ''
  }
}

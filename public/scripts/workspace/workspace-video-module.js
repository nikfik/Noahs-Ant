import { VideoPlayerController } from './video/VideoPlayerController.js'

export async function init(containerId = 'video-module', options = {}) {
  const controller = new VideoPlayerController(containerId, options)
  await controller.init()
}

export const WorkspaceVideoModule = { init }

if (typeof window !== 'undefined') {
  window.WorkspaceVideoModule = WorkspaceVideoModule
}

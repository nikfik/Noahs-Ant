async function ensureVideoDependencies() {
  const dependencyPaths = [
    './video/VideoPlayerUtils.js',
    './video/VideoIOService.js',
    './video/VideoPlaybackControls.js',
    './video/VideoZoomControls.js',
    './video/VideoPlayerUI.js',
    './video/VideoPlayerController.js',
  ]

  for (const dependencyPath of dependencyPaths) {
    if (dependencyPath.includes('VideoPlayerController') && window.VideoPlayerController) {
      continue
    }

    await import(dependencyPath)
  }

  if (!window.VideoPlayerController) {
    throw new Error('VideoPlayerController is not loaded')
  }
}

export async function init(containerId = 'video-module', options = {}) {
  await ensureVideoDependencies()

  const controller = new window.VideoPlayerController(containerId, options)
  await controller.init()
}

export const WorkspaceVideoModule = { init }

if (typeof window !== 'undefined') {
  window.WorkspaceVideoModule = WorkspaceVideoModule
}


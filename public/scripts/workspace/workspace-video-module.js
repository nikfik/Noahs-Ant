(function () {
  function ensureVideoDependencies() {
    if (window.VideoPlayerController && window.VideoPlayerUI && window.VideoPlayerUtils) {
      return true
    }

    if (typeof __dirname !== 'undefined') {
      const path = require('path')
      const dependencyFiles = [
        'video/VideoPlayerUtils.js',
        'video/VideoIOService.js',
        'video/VideoPlaybackControls.js',
        'video/VideoZoomControls.js',
        'video/VideoPlayerUI.js',
        'video/VideoPlayerController.js'
      ]

      dependencyFiles.forEach((relativePath) => {
        const absolutePath = path.resolve(__dirname, relativePath)
        if (!require.cache[absolutePath]) {
          require(absolutePath)
        }
      })

      return !!(window.VideoPlayerController && window.VideoPlayerUI && window.VideoPlayerUtils)
    }

    return false
  }

  async function init(containerId = 'video-module', options = {}) {
    if (!ensureVideoDependencies()) {
      throw new Error('VideoPlayerController is not loaded')
    }

    const controller = new window.VideoPlayerController(containerId, options)
    await controller.init()
  }

  window.WorkspaceVideoModule = { init }
})()

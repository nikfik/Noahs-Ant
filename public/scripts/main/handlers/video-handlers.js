import path from 'node:path'

export function registerVideoHandlers({ ipcMain, converter, projectsDirectory }) {
  let activeJob = null

  function getVideosDirectory(projectId) {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) {
      throw new Error('Invalid project identifier')
    }
    return path.join(projectsDirectory, projectId, 'videos')
  }

  const requireFilePath = (filePath) => {
    if (typeof filePath !== 'string' || !filePath) throw new Error('Nie wybrano pliku wideo.')
    return filePath
  }

  // Checks the video and, when the player cannot open it as it is, converts it into the project's "videos" folder.
  ipcMain.handle('prepare-video', async (event, request) => {
    const inputPath = requireFilePath(request?.filePath)
    const outputDir = getVideosDirectory(request?.projectId)
    if (activeJob) throw new Error('Trwa już konwersja innego filmu.')

    const job = new AbortController()
    activeJob = job
    try {
      return await converter.prepare({
        inputPath,
        outputDir,
        signal: job.signal,
        onProgress: (percent) => event.sender.send('video-convert-progress', { percent })
      })
    } finally {
      activeJob = null
    }
  })

  ipcMain.handle('cancel-video-conversion', () => {
    const running = Boolean(activeJob)
    activeJob?.abort()
    return running
  })

  // The frame rate and length of a video that needs no conversion (used to step by real frames).
  ipcMain.handle('probe-video', async (_event, filePath) => {
    const info = await converter.probe(requireFilePath(filePath))
    return { frameRate: info.video.fps, duration: info.duration }
  })
}

import path from 'node:path'
import { jest } from '@jest/globals'
import { registerVideoHandlers } from '../public/scripts/main/handlers/video-handlers.js'

function setup(converter) {
  const handlers = {}
  const ipcMain = { handle: (name, handler) => { handlers[name] = handler } }
  registerVideoHandlers({ ipcMain, converter, projectsDirectory: path.join('C:', 'Projects') })
  const sender = { send: jest.fn() }
  return { handlers, sender, event: { sender } }
}

describe('Video IPC handlers', () => {
  test('prepares a video into the videos folder of the project and forwards the progress', async () => {
    const converter = {
      prepare: jest.fn(async ({ onProgress }) => {
        onProgress(40)
        return { status: 'converted', videoPath: 'x.mp4' }
      })
    }
    const { handlers, sender, event } = setup(converter)

    const result = await handlers['prepare-video'](event, { projectId: 'Study', filePath: 'C:/Videos/a.MTS' })

    expect(result).toEqual({ status: 'converted', videoPath: 'x.mp4' })
    expect(converter.prepare).toHaveBeenCalledWith(expect.objectContaining({
      inputPath: 'C:/Videos/a.MTS',
      outputDir: path.join('C:', 'Projects', 'Study', 'videos')
    }))
    expect(sender.send).toHaveBeenCalledWith('video-convert-progress', { percent: 40 })
  })

  test('refuses bad requests before doing anything', async () => {
    const converter = { prepare: jest.fn() }
    const { handlers, event } = setup(converter)

    await expect(handlers['prepare-video'](event, { projectId: 'Study', filePath: '' })).rejects.toThrow('Nie wybrano pliku')
    await expect(handlers['prepare-video'](event, { projectId: '../escape', filePath: 'a.mts' })).rejects.toThrow('Invalid project identifier')
    await expect(handlers['prepare-video'](event, undefined)).rejects.toThrow()
    expect(converter.prepare).not.toHaveBeenCalled()
  })

  test('runs one conversion at a time, and can cancel the running one', async () => {
    let release
    const converter = {
      prepare: jest.fn(({ signal }) => new Promise((resolve) => {
        release = () => resolve({ status: signal.aborted ? 'cancelled' : 'converted' })
        signal.addEventListener('abort', release)
      }))
    }
    const { handlers, event } = setup(converter)
    const request = { projectId: 'Study', filePath: 'a.mts' }

    const first = handlers['prepare-video'](event, request)
    await expect(handlers['prepare-video'](event, request)).rejects.toThrow('Trwa już konwersja')

    expect(await handlers['cancel-video-conversion']()).toBe(true)
    expect(await first).toEqual({ status: 'cancelled' })
    expect(await handlers['cancel-video-conversion']()).toBe(false)

    const next = handlers['prepare-video'](event, request)
    release()
    expect((await next).status).toBe('converted')
  })

  test('frees the converter again after a failure', async () => {
    const converter = { prepare: jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ status: 'ready' }) }
    const { handlers, event } = setup(converter)
    const request = { projectId: 'Study', filePath: 'a.mts' }

    await expect(handlers['prepare-video'](event, request)).rejects.toThrow('boom')
    await expect(handlers['prepare-video'](event, request)).resolves.toEqual({ status: 'ready' })
  })

  test('probes the frame rate and length of a video', async () => {
    const converter = { probe: jest.fn(async () => ({ video: { fps: 25 }, duration: 108.06 })) }
    const { handlers } = setup(converter)

    expect(await handlers['probe-video']({}, 'C:/Videos/a.mp4')).toEqual({ frameRate: 25, duration: 108.06 })
    await expect(handlers['probe-video']({}, '')).rejects.toThrow('Nie wybrano pliku')
  })
})

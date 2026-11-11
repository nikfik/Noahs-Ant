// The picture on a project's card: a frame of the first video of the project, made once with ffmpeg and kept in the
// project folder. It stays on this computer (exports and backups do not contain it).
import { spawn as nodeSpawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { readProjectData } from './project-bundle.js'

const TIMEOUT_MS = 25000
const WIDTH = 320

export function createThumbnailService({ projectsDirectory, ffmpegPath, spawn = nodeSpawn }) {
  let queue = Promise.resolve()

  function grabFrame(video, target, seekSeconds) {
    return new Promise((resolve) => {
      const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seekSeconds), '-i', video, '-frames:v', '1', '-vf', `scale=${WIDTH}:-2`, '-q:v', '4', target], { windowsHide: true })
      const timer = setTimeout(() => child.kill(), TIMEOUT_MS)
      const finish = (ok) => {
        clearTimeout(timer)
        resolve(ok && fs.existsSync(target) && fs.statSync(target).size > 0)
      }
      child.on('error', () => finish(false))
      child.on('close', (code) => finish(code === 0))
    })
  }

  async function build(projectId) {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) throw new Error('Nieprawidłowy projekt.')
    const folder = path.join(projectsDirectory, projectId)
    const video = (readProjectData(projectsDirectory, projectId).trials?.trials || []).map((trial) => trial.videoPath).find((file) => typeof file === 'string' && file && fs.existsSync(file))
    if (!video || !ffmpegPath) return null

    const thumbnail = path.join(folder, 'thumbnail.jpg')
    const metaPath = path.join(folder, 'thumbnail.json')
    const stat = fs.statSync(video)
    const source = { videoPath: video, size: stat.size, mtimeMs: stat.mtimeMs }

    let meta = null
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch (_error) {
      meta = null
    }
    const upToDate = meta && meta.videoPath === source.videoPath && meta.size === source.size && meta.mtimeMs === source.mtimeMs
    if (upToDate && meta.failed) return null
    if (upToDate && fs.existsSync(thumbnail)) return { path: thumbnail, version: fs.statSync(thumbnail).mtimeMs }

    // A little way in, so the picture is not the black first frame; a very short film is tried from its start.
    const ok = (await grabFrame(video, thumbnail, 1)) || (await grabFrame(video, thumbnail, 0))
    fs.writeFileSync(metaPath, JSON.stringify({ ...source, failed: !ok }), 'utf8')
    if (!ok) {
      fs.rmSync(thumbnail, { force: true })
      return null
    }
    return { path: thumbnail, version: fs.statSync(thumbnail).mtimeMs }
  }

  // One picture at a time, so opening a long list does not start many ffmpeg processes.
  function get(projectId) {
    const run = queue.catch(() => {}).then(() => build(projectId))
    queue = run
    return run
  }

  return { get }
}

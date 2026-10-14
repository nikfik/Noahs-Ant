import { spawn as nodeSpawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { MP4_COPYABLE_AUDIO, normalizeQualitySettings, planConversion, qualitySuffix } from '../shared/video-quality.js'

export { planConversion }

const toSeconds = (hours, minutes, seconds) => Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)

// ffmpeg prints a summary of the file's streams when it is run without an output; this reads the parts we need.
export function parseProbeOutput(text) {
  const duration = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  const videoLine = text.split('\n').find((line) => /Stream #\d+:\d+.*: Video:/.test(line))
  if (!videoLine) return null

  const audioLine = text.split('\n').find((line) => /Stream #\d+:\d+.*: Audio:/.test(line))
  const size = videoLine.match(/,\s*(\d{2,5})x(\d{2,5})[\s,[]/)
  const fps = videoLine.match(/([\d.]+)\s*fps/) || videoLine.match(/([\d.]+)\s*tbr/)

  return {
    duration: duration ? toSeconds(duration[1], duration[2], duration[3]) : null,
    video: {
      codec: videoLine.match(/Video:\s*([a-z0-9_]+)/i)[1].toLowerCase(),
      width: size ? Number(size[1]) : null,
      height: size ? Number(size[2]) : null,
      fps: fps ? Number(fps[1]) : null,
      interlaced: /\((?:[^)]*,\s*)?(?:top first|bottom first|tt|bb|tb|bt)\)/.test(videoLine)
    },
    audio: audioLine ? { codec: audioLine.match(/Audio:\s*([a-z0-9_]+)/i)[1].toLowerCase() } : null
  }
}

export function buildFfmpegArgs({ inputPath, outputPath, plan, probe }) {
  const copyAudio = !probe.audio || MP4_COPYABLE_AUDIO.has(probe.audio.codec)
  const { target } = plan
  const filters = [
    ...(plan.interlaced ? [`yadif=mode=${target.deinterlaceMode}`] : []),
    ...(target.height ? [`scale=-2:${target.height}`] : []),
    ...(target.limitFrameRate ? [`fps=${target.frameRate}`] : [])
  ]
  const video = plan.action === 'remux'
    ? ['-c:v', 'copy']
    : [...(filters.length ? ['-vf', filters.join(',')] : []), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(target.crf), '-pix_fmt', 'yuv420p']
  const audio = copyAudio ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '160k', '-ac', '2']

  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    ...video, ...audio,
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    outputPath
  ]
}

// ffmpeg reports progress as "key=value" lines; "out_time_us" (microseconds) is how far the output has got.
export function parseProgress(text) {
  const matches = [...text.matchAll(/out_time_(?:us|ms)=(\d+)/g)]
  return matches.length ? Number(matches.at(-1)[1]) / 1e6 : null
}

function run(spawn, command, args, { onStdout, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stderr = ''
    let cancelled = false

    child.stdout?.on('data', (chunk) => onStdout?.(chunk.toString()))
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr, cancelled }))

    const cancel = () => {
      cancelled = true
      child.kill()
    }
    if (signal?.aborted) cancel()
    else signal?.addEventListener('abort', cancel, { once: true })
  })
}

export function createVideoConverter({ ffmpegPath, spawn = nodeSpawn, fileSystem = fs } = {}) {
  const requireFfmpeg = () => {
    if (!ffmpegPath) throw new Error('ffmpeg-missing')
    return ffmpegPath
  }

  async function probe(filePath) {
    const { stderr } = await run(spawn, requireFfmpeg(), ['-hide_banner', '-i', filePath])
    const result = parseProbeOutput(stderr)
    if (!result) throw new Error('Nie rozpoznano wideo w tym pliku.')
    return result
  }

  // A converted file is reused when the sidecar describes the very same source file (same path, size, modification
  // time) converted the same way, so one video can be kept in several qualities side by side.
  function chooseOutputPath(inputPath, outputDir, sourceInfo, suffix, conversionKey) {
    const base = `${path.basename(inputPath, path.extname(inputPath))}${suffix}`
    for (let counter = 1; ; counter += 1) {
      const outputPath = path.join(outputDir, `${base}${counter > 1 ? `-${counter}` : ''}.mp4`)
      if (!fileSystem.existsSync(outputPath)) return { outputPath, reuse: false }

      try {
        const sidecar = JSON.parse(fileSystem.readFileSync(`${outputPath}.json`, 'utf8'))
        if (sidecar.sourcePath === inputPath && sidecar.size === sourceInfo.size && sidecar.mtimeMs === sourceInfo.mtimeMs && sidecar.key === conversionKey) {
          return { outputPath, reuse: true }
        }
      } catch (_error) {
        // No readable sidecar: the file is not ours to reuse, so try the next name.
      }
    }
  }

  // What the dialog needs to know about a file before anything is converted.
  async function describe(filePath) {
    return {
      fileName: path.basename(filePath),
      extension: path.extname(filePath),
      size: fileSystem.statSync(filePath).size,
      probe: await probe(filePath)
    }
  }

  async function prepare({ inputPath, outputDir, settings, onProgress, signal }) {
    const ffmpeg = requireFfmpeg()
    const info = await probe(inputPath)
    const plan = planConversion(info, path.extname(inputPath), normalizeQualitySettings(settings))
    const summary = { frameRate: plan.frameRate, duration: info.duration, reasons: plan.reasons }
    if (plan.action === 'none') return { status: 'ready', videoPath: inputPath, converted: false, ...summary }

    fileSystem.mkdirSync(outputDir, { recursive: true })
    const stats = fileSystem.statSync(inputPath)
    const sourceInfo = { size: stats.size, mtimeMs: stats.mtimeMs }
    const conversionKey = `${plan.action}${qualitySuffix(plan)}`
    const { outputPath, reuse } = chooseOutputPath(inputPath, outputDir, sourceInfo, qualitySuffix(plan), conversionKey)
    const result = { status: 'converted', videoPath: outputPath, sourcePath: inputPath, mode: plan.action, converted: true, ...summary }
    if (reuse) return { ...result, reused: true }

    const partialPath = `${outputPath}.part.mp4`
    const removePartial = () => fileSystem.rmSync(partialPath, { force: true })
    const { code, stderr, cancelled } = await run(spawn, ffmpeg, buildFfmpegArgs({ inputPath, outputPath: partialPath, plan, probe: info }), {
      signal,
      onStdout: (text) => {
        const seconds = parseProgress(text)
        if (seconds !== null && info.duration) onProgress?.(Math.min(100, seconds / info.duration * 100))
      }
    })

    if (cancelled) {
      removePartial()
      return { status: 'cancelled' }
    }
    if (code !== 0) {
      removePartial()
      throw new Error(`Konwersja nie powiodła się: ${stderr.trim().split('\n').slice(-3).join(' ')}`)
    }

    fileSystem.renameSync(partialPath, outputPath)
    fileSystem.writeFileSync(`${outputPath}.json`, JSON.stringify({ sourcePath: inputPath, ...sourceInfo, key: conversionKey, mode: plan.action }, null, 2), 'utf8')
    onProgress?.(100)
    return result
  }

  return { probe, describe, prepare }
}

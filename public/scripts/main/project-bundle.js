// The .nsant file: a zip with a project's data (and, if wanted, its videos). It is used for exporting a project to
// share it and, without videos, for the backups. An exported file contains no paths from this computer.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import yauzl from 'yauzl'
import yazl from 'yazl'

export const BUNDLE_EXTENSION = '.nsant'
export const FORMAT_VERSION = 1
const APP_NAME = 'Noahs Ant'
const DATA_KEYS = ['ini', 'trials', 'animals', 'etograms', 'observations']
const MAX_ENTRIES = 5000
const MAX_JSON_BYTES = 200 * 1024 * 1024
const DATA_ENTRY = /^(manifest|ini|trials|animals|etograms|observations)\.json$/
const VIDEO_ENTRY = /^videos\/[A-Za-z0-9._-]{1,80}$/

export class BundleError extends Error {}

const fileOf = (projectsDirectory, projectId, key) => path.join(projectsDirectory, projectId, `${projectId}_${key}.json`)

export function readProjectData(projectsDirectory, projectId) {
  return Object.fromEntries(DATA_KEYS.map((key) => {
    try {
      return [key, JSON.parse(fs.readFileSync(fileOf(projectsDirectory, projectId, key), 'utf8'))]
    } catch (_error) {
      return [key, null]
    }
  }))
}

// Two backups with the same hash hold the same work (the "last opened" time does not count).
export function hashProjectData(data) {
  const { MostRecentOpen: _ignored, ...ini } = data.ini || {}
  return crypto.createHash('sha1').update(JSON.stringify({ ...data, ini })).digest('hex')
}

const videoFiles = (data) => [...new Set((data.trials?.trials || []).map((trial) => trial.videoPath).filter((file) => typeof file === 'string' && file && fs.existsSync(file)))]

export function estimateExport(projectsDirectory, projectId) {
  const files = videoFiles(readProjectData(projectsDirectory, projectId))
  return { videoCount: files.length, videoBytes: files.reduce((total, file) => total + fs.statSync(file).size, 0) }
}

// The data of a file that leaves this computer: no paths. With videos, each one is renamed (file names can contain
// personal names) and referred to inside the file; without them the path is simply empty.
function portableData(data, includeVideos) {
  const videos = []
  const entryOf = new Map()
  const trials = (data.trials?.trials || []).map((trial) => {
    let videoPath = ''
    if (includeVideos && videoFiles({ trials: { trials: [trial] } }).length) {
      if (!entryOf.has(trial.videoPath)) {
        const entry = `videos/video-${entryOf.size + 1}${path.extname(trial.videoPath).toLowerCase().replace(/[^.a-z0-9]/g, '')}`
        entryOf.set(trial.videoPath, entry)
        videos.push({ from: trial.videoPath, entry })
      }
      videoPath = entryOf.get(trial.videoPath)
    }
    return { ...trial, videoPath, sourcePath: '' }
  })
  return {
    data: { ...data, ini: data.ini ? { ...data.ini, videoPath: '' } : data.ini, trials: data.trials ? { ...data.trials, trials } : data.trials },
    videos
  }
}

const countOf = (data) => ({
  trials: data.trials?.trials?.length || 0,
  animals: data.animals?.animals?.length || 0,
  events: data.observations?.observations?.length || 0
})

// options: { kind: 'export' | 'auto' | 'manual' | 'safety', label, portable, includeVideos }
export async function writeBundle({ projectsDirectory, projectId, destPath, kind = 'export', label = '', portable = false, includeVideos = false, now = new Date() }) {
  const source = readProjectData(projectsDirectory, projectId)
  const { data, videos } = portable ? portableData(source, includeVideos) : { data: source, videos: [] }
  const manifest = {
    app: APP_NAME,
    formatVersion: FORMAT_VERSION,
    createdAt: now.toISOString(),
    kind,
    label,
    projectName: source.ini?.projectName || projectId,
    includesVideos: videos.length > 0,
    dataHash: hashProjectData(source),
    counts: countOf(source)
  }

  const zip = new yazl.ZipFile()
  zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2)), 'manifest.json')
  DATA_KEYS.forEach((key) => {
    if (data[key] !== null && data[key] !== undefined) zip.addBuffer(Buffer.from(JSON.stringify(data[key], null, 2)), `${key}.json`)
  })
  // Videos are already compressed; storing them as they are keeps the export fast.
  videos.forEach(({ from, entry }) => zip.addFile(from, entry, { compress: false }))

  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  const partPath = `${destPath}.part`
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(partPath)
    output.on('close', resolve)
    output.on('error', reject)
    zip.outputStream.on('error', reject).pipe(output)
    zip.end()
  }).catch((error) => {
    fs.rmSync(partPath, { force: true })
    throw error
  })
  fs.renameSync(partPath, destPath)

  return { path: destPath, manifest, videoCount: videos.length, size: fs.statSync(destPath).size }
}

const openZip = (filePath) => new Promise((resolve, reject) => {
  yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (error, zip) => (error ? reject(new BundleError('To nie jest poprawny plik projektu.')) : resolve(zip)))
})

const readStream = (zip, entry) => new Promise((resolve, reject) => {
  zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)))
})

async function readEntryText(zip, entry) {
  const stream = await readStream(zip, entry)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// Reads the data of a file. Videos are written to `videosDirectory` when one is given (otherwise they are skipped).
// Entries with unexpected names are ignored, and names that try to leave the folder make the whole file invalid.
export async function readBundle(filePath, { videosDirectory = null } = {}) {
  const zip = await openZip(filePath)
  const result = { manifest: null, data: {}, videos: [] }

  await new Promise((resolve, reject) => {
    let count = 0
    zip.on('error', () => reject(new BundleError('Plik projektu jest uszkodzony albo niebezpieczny.')))
    zip.on('end', resolve)
    zip.on('entry', async (entry) => {
      try {
        count += 1
        const name = entry.fileName
        if (count > MAX_ENTRIES || name.includes('..') || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) {
          throw new BundleError('Plik projektu jest uszkodzony albo niebezpieczny.')
        }

        if (DATA_ENTRY.test(name)) {
          if (entry.uncompressedSize > MAX_JSON_BYTES) throw new BundleError('Plik projektu jest zbyt duży.')
          const parsed = JSON.parse(await readEntryText(zip, entry))
          if (name === 'manifest.json') result.manifest = parsed
          else result.data[name.replace(/\.json$/, '')] = parsed
        } else if (VIDEO_ENTRY.test(name) && videosDirectory) {
          fs.mkdirSync(videosDirectory, { recursive: true })
          const target = path.join(videosDirectory, path.basename(name))
          const stream = await readStream(zip, entry)
          await new Promise((done, fail) => {
            const output = fs.createWriteStream(target)
            stream.on('error', fail)
            output.on('error', fail).on('close', done)
            stream.pipe(output)
          })
          result.videos.push(name)
        }
        zip.readEntry()
      } catch (error) {
        zip.close()
        reject(error instanceof SyntaxError ? new BundleError('Plik projektu jest uszkodzony.') : error)
      }
    })
    zip.readEntry()
  })

  if (result.manifest?.app !== APP_NAME || !Number.isInteger(result.manifest.formatVersion)) {
    throw new BundleError('To nie jest plik projektu Noah’s Ant.')
  }
  if (result.manifest.formatVersion > FORMAT_VERSION) {
    throw new BundleError('Ten plik pochodzi z nowszej wersji programu. Zaktualizuj program, aby go otworzyć.')
  }
  return result
}

export async function readManifest(filePath) {
  const zip = await openZip(filePath)
  return new Promise((resolve, reject) => {
    zip.on('error', () => reject(new BundleError('Plik projektu jest uszkodzony.')))
    zip.on('end', () => reject(new BundleError('Brak informacji o pliku.')))
    zip.on('entry', async (entry) => {
      if (entry.fileName !== 'manifest.json') {
        zip.readEntry()
        return
      }
      try {
        const manifest = JSON.parse(await readEntryText(zip, entry))
        zip.close()
        resolve(manifest)
      } catch (error) {
        zip.close()
        reject(error)
      }
    })
    zip.readEntry()
  })
}

const sanitizeName = (name) => name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-').trim()

// Creates a new project from a file; never touches an existing one.
export async function importProject({ projectsDirectory, filePath, now = new Date() }) {
  const manifest = await readManifest(filePath)
  const baseName = String(manifest?.projectName || 'Zaimportowany projekt').slice(0, 100)
  const safe = sanitizeName(baseName) || 'Zaimportowany-projekt'
  let projectId = safe
  let counter = 1
  while (fs.existsSync(path.join(projectsDirectory, projectId))) {
    counter += 1
    projectId = `${safe}-${counter}`
  }

  const projectDirectory = path.join(projectsDirectory, projectId)
  fs.mkdirSync(projectDirectory, { recursive: true })
  try {
    const { data, videos } = await readBundle(filePath, { videosDirectory: path.join(projectDirectory, 'videos') })
    const present = new Set(videos.map((entry) => path.basename(entry)))
    const projectName = counter > 1 ? `${baseName} (${counter})` : baseName
    const ini = { etogram: [], ...(data.ini || {}), projectName, videoPath: '', MostRecentOpen: now.toISOString() }
    ini.createdAt = ini.createdAt || now.toISOString()

    const trials = data.trials ? {
      ...data.trials,
      trials: (data.trials.trials || []).map((trial) => ({
        ...trial,
        sourcePath: '',
        videoPath: typeof trial.videoPath === 'string' && present.has(path.basename(trial.videoPath)) ? path.join(projectDirectory, 'videos', path.basename(trial.videoPath)) : ''
      }))
    } : null

    Object.entries({ ini, trials, animals: data.animals, etograms: data.etograms, observations: data.observations }).forEach(([key, value]) => {
      if (value) fs.writeFileSync(fileOf(projectsDirectory, projectId, key), JSON.stringify(value, null, 2), 'utf8')
    })
    return { fileName: projectId, projectId, ...ini, videoCount: videos.length }
  } catch (error) {
    fs.rmSync(projectDirectory, { recursive: true, force: true })
    throw error
  }
}

// Puts the data of a backup back into its project (video paths stay as they were when the backup was made).
export async function restoreProjectData({ projectsDirectory, projectId, backupPath, now = new Date() }) {
  const { data } = await readBundle(backupPath)
  Object.entries(data).forEach(([key, value]) => {
    if (!DATA_KEYS.includes(key)) return
    const next = key === 'ini' ? { ...value, MostRecentOpen: now.toISOString() } : value
    fs.writeFileSync(fileOf(projectsDirectory, projectId, key), JSON.stringify(next, null, 2), 'utf8')
  })
}

// Backups of a project's data (never its videos): automatic ones while a project is open, manual ones on request, and
// "safety" ones taken right before something is overwritten. Only automatic and safety backups are removed by themselves.
import fs from 'node:fs'
import path from 'node:path'
import { BUNDLE_EXTENSION, BundleError, hashProjectData, readManifest, readProjectData, restoreProjectData, writeBundle } from './project-bundle.js'

const NAME_PATTERN = /^(auto|manual|safety)-[0-9T_-]{10,40}(-\d+)?\.nsant$/
const SAFETY_LIMIT = 5

const stamp = (date) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

export function createBackupService({ projectsDirectory, getBackupSettings, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  let session = null
  let pending = Promise.resolve()

  const directoryOf = (projectId) => {
    if (typeof projectId !== 'string' || !projectId || path.basename(projectId) !== projectId) throw new BundleError('Nieprawidłowy projekt.')
    return path.join(projectsDirectory, projectId, 'backups')
  }
  const pathOf = (projectId, name) => {
    if (!NAME_PATTERN.test(String(name))) throw new BundleError('Nieprawidłowa kopia zapasowa.')
    return path.join(directoryOf(projectId), name)
  }

  // Everything that writes goes through one queue, so two backups never run at the same time.
  const enqueue = (task) => {
    const run = pending.catch(() => {}).then(task)
    pending = run
    return run
  }

  async function list(projectId) {
    const directory = directoryOf(projectId)
    if (!fs.existsSync(directory)) return []
    const backups = await Promise.all(fs.readdirSync(directory).filter((name) => NAME_PATTERN.test(name)).map(async (name) => {
      try {
        const manifest = await readManifest(path.join(directory, name))
        return { name, kind: manifest.kind, label: manifest.label || '', createdAt: manifest.createdAt, counts: manifest.counts || {}, dataHash: manifest.dataHash, size: fs.statSync(path.join(directory, name)).size }
      } catch (_error) {
        return null
      }
    }))
    return backups.filter(Boolean).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  }

  async function prune(projectId) {
    const settings = getBackupSettings()
    const backups = await list(projectId)
    const excess = (kind, limit) => backups.filter((backup) => backup.kind === kind).slice(limit)
    ;[...excess('auto', Math.max(1, settings.maxBackups)), ...excess('safety', SAFETY_LIMIT)].forEach((backup) => {
      fs.rmSync(pathOf(projectId, backup.name), { force: true })
    })
  }

  // Automatic and safety backups are skipped when nothing changed since the newest backup; a manual one is always made.
  function create(projectId, { kind = 'manual', label = '' } = {}) {
    return enqueue(async () => {
      const directory = directoryOf(projectId)
      if (kind !== 'manual') {
        const [newest] = await list(projectId)
        if (newest && newest.dataHash === hashProjectData(readProjectData(projectsDirectory, projectId))) return { created: false }
      }

      const date = now()
      let name = `${kind}-${stamp(date)}${BUNDLE_EXTENSION}`
      for (let counter = 2; fs.existsSync(path.join(directory, name)); counter += 1) name = `${kind}-${stamp(date)}-${counter}${BUNDLE_EXTENSION}`
      const result = await writeBundle({ projectsDirectory, projectId, destPath: path.join(directory, name), kind, label: String(label).slice(0, 80), now: date })
      await prune(projectId)
      return { created: true, backup: { name, kind, label: result.manifest.label, createdAt: result.manifest.createdAt, counts: result.manifest.counts, size: result.size } }
    })
  }

  function remove(projectId, name) {
    return enqueue(async () => {
      fs.rmSync(pathOf(projectId, name), { force: true })
      return true
    })
  }

  async function restore(projectId, name) {
    const backupPath = pathOf(projectId, name)
    if (!fs.existsSync(backupPath)) throw new BundleError('Tej kopii zapasowej już nie ma.')
    await create(projectId, { kind: 'safety', label: 'Przed przywróceniem kopii' })
    await enqueue(() => restoreProjectData({ projectsDirectory, projectId, backupPath, now: now() }))
    return true
  }

  const intervalMs = () => Math.max(1, getBackupSettings().intervalMinutes) * 60 * 1000
  const automaticOn = () => getBackupSettings().enabled

  function schedule() {
    if (!session) return
    session.timer = setTimer(async () => {
      try {
        if (automaticOn()) await create(session.projectId, { kind: 'auto' })
      } catch (error) {
        console.error('[main] automatic backup failed:', error)
      }
      schedule()
    }, intervalMs())
  }

  // While a project is open: a backup right away (when something changed) and then one every few minutes.
  async function startSession(projectId) {
    directoryOf(projectId)
    await stopSession()
    session = { projectId, timer: null }
    try {
      if (automaticOn()) await create(projectId, { kind: 'auto' })
    } catch (error) {
      console.error('[main] automatic backup failed:', error)
    }
    schedule()
  }

  async function stopSession() {
    if (!session) return
    const { projectId, timer } = session
    session = null
    clearTimer(timer)
    try {
      if (automaticOn()) await create(projectId, { kind: 'auto' })
    } catch (error) {
      console.error('[main] automatic backup failed:', error)
    }
  }

  return { list, create, remove, restore, startSession, stopSession, whenIdle: () => pending.catch(() => {}) }
}

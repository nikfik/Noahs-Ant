import path from 'node:path'
import { estimateExport, importProject, writeBundle, BUNDLE_EXTENSION } from '../project-bundle.js'

const projectIdOf = (value) => {
  if (typeof value !== 'string' || !value || path.basename(value) !== value) throw new Error('Nieprawidłowy projekt.')
  return value
}

export function registerBackupHandlers({ ipcMain, backupService }) {
  ipcMain.handle('backup-session-start', (_event, projectId) => backupService.startSession(projectIdOf(projectId)).then(() => true))
  // Sent while the page is closing, so it cannot wait for an answer.
  ipcMain.on('backup-session-stop', () => { backupService.stopSession() })
  ipcMain.handle('list-backups', (_event, projectId) => backupService.list(projectIdOf(projectId)))
  ipcMain.handle('create-backup', (_event, request) => backupService.create(projectIdOf(request?.projectId), { kind: 'manual', label: request?.label }))
  ipcMain.handle('delete-backup', (_event, request) => backupService.remove(projectIdOf(request?.projectId), request?.name))
  ipcMain.handle('restore-backup', (_event, request) => backupService.restore(projectIdOf(request?.projectId), request?.name))
}

// Exporting a project to a file and importing one back (the project list screen).
export function registerTransferHandlers({ ipcMain, dialog, projectsDirectory, getDefaultDirectory = () => '' }) {
  ipcMain.handle('estimate-project-export', (_event, projectId) => estimateExport(projectsDirectory, projectIdOf(projectId)))

  ipcMain.handle('export-project', async (_event, request) => {
    const projectId = projectIdOf(request?.projectId)
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(getDefaultDirectory(), `${projectId}${BUNDLE_EXTENSION}`),
      filters: [{ name: 'Projekt Noah’s Ant (.nsant)', extensions: ['nsant'] }]
    })
    if (result.canceled || !result.filePath) return { saved: false }

    const destPath = result.filePath.toLowerCase().endsWith(BUNDLE_EXTENSION) ? result.filePath : `${result.filePath}${BUNDLE_EXTENSION}`
    const written = await writeBundle({ projectsDirectory, projectId, destPath, kind: 'export', portable: true, includeVideos: Boolean(request?.includeVideos) })
    return { saved: true, filePath: written.path, videoCount: written.videoCount, size: written.size }
  })

  ipcMain.handle('import-project', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Projekt Noah’s Ant (.nsant)', extensions: ['nsant'] }]
    })
    if (result.canceled || !result.filePaths.length) return { imported: false }
    return { imported: true, project: await importProject({ projectsDirectory, filePath: result.filePaths[0] }) }
  })
}

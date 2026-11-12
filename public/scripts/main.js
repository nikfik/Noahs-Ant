import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { createThemeState } from './main/theme-state.js'
import { createSettingsStore } from './main/settings-store.js'
import { createProjectStore } from './main/project-store.js'
import { createAnimalsStore } from './main/animals-store.js'
import { createObservationsStore } from './main/observations-store.js'
import { createTrialsStore } from './main/trials-store.js'
import ffmpegPath from 'ffmpeg-static'
import { writeTextFiles, writeWorkbook } from './main/workbook-export.js'
import { createVideoConverter } from './main/video-converter.js'
import { createBackupService } from './main/backup-service.js'
import { createProjectLibrary } from './main/project-library.js'
import { createThumbnailService } from './main/project-thumbnails.js'
import { registerLibraryHandlers as registerLibraryHandlersModule } from './main/handlers/library-handlers.js'
import { registerBackupHandlers as registerBackupHandlersModule, registerTransferHandlers as registerTransferHandlersModule } from './main/handlers/backup-handlers.js'
import { createMainWindow, createSettingsWindow } from './main/windows.js'
import { registerThemeHandlers as registerThemeHandlersModule } from './main/handlers/theme-handlers.js'
import { registerSettingsHandlers as registerSettingsHandlersModule } from './main/handlers/settings-handlers.js'
import { registerProjectHandlers as registerProjectHandlersModule } from './main/handlers/project-handlers.js'
import { registerFileHandlers as registerFileHandlersModule } from './main/handlers/file-handlers.js'
import { registerVideoHandlers as registerVideoHandlersModule } from './main/handlers/video-handlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const APP_SETTINGS_PATH = path.join(__dirname, '..', '..', 'app-settings.json')
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'Projects')

const settingsStore = createSettingsStore(APP_SETTINGS_PATH)
const initialSettings = settingsStore.readAppSettings()
const themeState = createThemeState(initialSettings.theme)
const projectStore = createProjectStore(PROJECTS_DIR)
const backupService = createBackupService({ projectsDirectory: PROJECTS_DIR, getBackupSettings: () => settingsStore.readAppSettings().backup })
const animalsStore = createAnimalsStore(PROJECTS_DIR)
const trialsStore = createTrialsStore(PROJECTS_DIR)
const observationsStore = createObservationsStore(PROJECTS_DIR, {
  getDefaultTrialId: (projectId) => trialsStore.read(projectId).trials[0]?.id ?? null
})
const windowOptions = {
  BrowserWindow,
  preloadPath: path.join(__dirname, 'preload.cjs'),
  viewsDirectory: path.join(__dirname, '..', 'views'),
  getTheme: () => themeState.get()
}
const openSettingsWindow = createSettingsWindow(windowOptions)

// The size of the interface (a setting) is the zoom of every window, including the ones opened later.
const interfaceScale = () => (Number(settingsStore.readAppSettings().graphics.scale) || 100) / 100

function applyInterfaceScale() {
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.setZoomFactor(interfaceScale()))
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('did-finish-load', () => contents.setZoomFactor(interfaceScale()))
})

function registerThemeHandlers() {
  registerThemeHandlersModule({ ipcMain, BrowserWindow, themeState })
}

function registerSettingsHandlers() {
  registerSettingsHandlersModule({ ipcMain, BrowserWindow, settingsStore, openSettingsWindow, onSaved: applyInterfaceScale })
}

function registerProjectHandlers() {
  console.log('[main] registering project IPC handlers')
  registerProjectHandlersModule({ ipcMain, projectStore, animalsStore, observationsStore, trialsStore })
}

// A packaged app keeps binaries outside the asar archive, where they can be executed.
const videoConverter = createVideoConverter({ ffmpegPath: ffmpegPath?.replace('app.asar', 'app.asar.unpacked') })

function registerVideoHandlers() {
  registerVideoHandlersModule({ ipcMain, converter: videoConverter, projectsDirectory: PROJECTS_DIR })
}

function registerLibraryHandlers() {
  const library = createProjectLibrary({ projectsDirectory: PROJECTS_DIR })
  const thumbnails = createThumbnailService({ projectsDirectory: PROJECTS_DIR, ffmpegPath: ffmpegPath?.replace('app.asar', 'app.asar.unpacked') })
  registerLibraryHandlersModule({ ipcMain, library, thumbnails, trashItem: (target) => shell.trashItem(target) })
}

function registerBackupHandlers() {
  registerBackupHandlersModule({ ipcMain, backupService })
  registerTransferHandlersModule({ ipcMain, dialog, projectsDirectory: PROJECTS_DIR, getDefaultDirectory: () => app.getPath('documents') })
}

function registerFileHandlers() {
  registerFileHandlersModule({ ipcMain, dialog, writeWorkbook, writeTextFiles, getDefaultDirectory: () => app.getPath('documents') })
}

function createWindow() {
  return createMainWindow(windowOptions)
}

app.whenReady().then(() => {
  console.log('[main] Electron ready')
  registerThemeHandlers()
  registerSettingsHandlers()
  registerProjectHandlers()
  registerBackupHandlers()
  registerLibraryHandlers()
  registerFileHandlers()
  registerVideoHandlers()
  createWindow()
}).catch((error) => {
  console.error('[main] Startup failed:', error)
})

// A backup that is being written when the app is closed is finished first.
let finishingBackups = false
app.on('before-quit', (event) => {
  if (finishingBackups) return
  event.preventDefault()
  finishingBackups = true
  backupService.stopSession().then(() => backupService.whenIdle()).catch(() => {}).finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
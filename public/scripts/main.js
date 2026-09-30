import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createThemeState } from './main/theme-state.js'
import { createSettingsStore } from './main/settings-store.js'
import { createProjectStore } from './main/project-store.js'
import { createAnimalsStore } from './main/animals-store.js'
import { createMainWindow, createSettingsWindow } from './main/windows.js'
import { registerThemeHandlers as registerThemeHandlersModule } from './main/handlers/theme-handlers.js'
import { registerSettingsHandlers as registerSettingsHandlersModule } from './main/handlers/settings-handlers.js'
import { registerProjectHandlers as registerProjectHandlersModule } from './main/handlers/project-handlers.js'
import { registerFileHandlers as registerFileHandlersModule } from './main/handlers/file-handlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const APP_SETTINGS_PATH = path.join(__dirname, '..', '..', 'app-settings.json')
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'Projects')

const settingsStore = createSettingsStore(APP_SETTINGS_PATH)
const initialSettings = settingsStore.readAppSettings()
const themeState = createThemeState(initialSettings.theme)
const projectStore = createProjectStore(PROJECTS_DIR)
const animalsStore = createAnimalsStore(PROJECTS_DIR)
const windowOptions = {
  BrowserWindow,
  preloadPath: path.join(__dirname, 'preload.cjs'),
  viewsDirectory: path.join(__dirname, '..', 'views'),
  getTheme: () => themeState.get()
}
const openSettingsWindow = createSettingsWindow(windowOptions)

function registerThemeHandlers() {
  registerThemeHandlersModule({ ipcMain, BrowserWindow, themeState })
}

function registerSettingsHandlers() {
  registerSettingsHandlersModule({ ipcMain, settingsStore, openSettingsWindow })
}

function registerProjectHandlers() {
  console.log('[main] registering project IPC handlers')
  registerProjectHandlersModule({ ipcMain, projectStore, animalsStore })
}

function registerFileHandlers() {
  registerFileHandlersModule({ ipcMain, dialog })
}

function createWindow() {
  return createMainWindow(windowOptions)
}

app.whenReady().then(() => {
  console.log('[main] Electron ready')
  registerThemeHandlers()
  registerSettingsHandlers()
  registerProjectHandlers()
  registerFileHandlers()
  createWindow()
}).catch((error) => {
  console.error('[main] Startup failed:', error)
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
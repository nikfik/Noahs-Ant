import path from 'node:path'
import { applyThemeToWindow } from './theme-state.js'

function webPreferences(preloadPath) {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true
  }
}

export function createMainWindow({ BrowserWindow, preloadPath, viewsDirectory, getTheme }) {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: getTheme().bgColor,
    webPreferences: webPreferences(preloadPath)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] renderer failed to load:', errorCode, errorDescription, validatedURL)
  })
  win.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[renderer] ${sourceId}:${line} ${message}`)
  })

  win.loadFile(path.join(viewsDirectory, 'ProjectList.html'))
  win.webContents.once('did-finish-load', () => applyThemeToWindow(win, getTheme()))
  return win
}

export function createSettingsWindow({ BrowserWindow, preloadPath, viewsDirectory, getTheme }) {
  let settingsWindow = null

  return function openSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show()
      settingsWindow.focus()
      return
    }

    settingsWindow = new BrowserWindow({
      width: 1100,
      height: 760,
      minWidth: 900,
      minHeight: 620,
      resizable: true,
      title: 'Settings',
      backgroundColor: getTheme().bgColor,
      webPreferences: webPreferences(preloadPath)
    })

    settingsWindow.setMenuBarVisibility(false)
    settingsWindow.loadFile(path.join(viewsDirectory, 'Settings.html'))
    settingsWindow.webContents.once('did-finish-load', () => applyThemeToWindow(settingsWindow, getTheme()))
    settingsWindow.on('closed', () => {
      settingsWindow = null
    })
  }
}
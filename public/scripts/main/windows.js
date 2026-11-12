import path from 'node:path'
import { t } from '../shared/i18n.js'
import { applyThemeToWindow } from './theme-state.js'

function webPreferences(preloadPath) {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true
  }
}

export function createMainWindow({ BrowserWindow, preloadPath, viewsDirectory, getTheme, iconPath }) {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    backgroundColor: getTheme().bgColor,
    webPreferences: webPreferences(preloadPath)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] renderer failed to load:', errorCode, errorDescription, validatedURL)
  })
  win.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[renderer] ${sourceId}:${line} ${message}`)
  })

  // The only extra window a page may open is the one the video can be moved to (e.g. on a second screen).
  win.webContents.setWindowOpenHandler(({ frameName }) => frameName === 'noahs-ant-video'
    ? {
      action: 'allow',
      overrideBrowserWindowOptions: {
        title: t('Film – Noah\'s Ant'),
        minWidth: 420,
        minHeight: 300,
        autoHideMenuBar: true,
        ...(iconPath ? { icon: iconPath } : {}),
        backgroundColor: getTheme().bgColor,
        webPreferences: webPreferences(preloadPath)
      }
    }
    : { action: 'deny' })

  win.loadFile(path.join(viewsDirectory, 'ProjectList.html'))
  win.webContents.once('did-finish-load', () => applyThemeToWindow(win, getTheme()))
  return win
}

export function createSettingsWindow({ BrowserWindow, preloadPath, viewsDirectory, getTheme, iconPath, ipcMain }) {
  let settingsWindow = null

  return function openSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show()
      settingsWindow.focus()
      return
    }

    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      minWidth: 900,
      minHeight: 620,
      resizable: true,
      autoHideMenuBar: true,
      title: t('Ustawienia'),
      ...(iconPath ? { icon: iconPath } : {}),
      backgroundColor: getTheme().bgColor,
      webPreferences: webPreferences(preloadPath)
    })
    settingsWindow = win

    // Closing the window (the system's × too) first asks the page, which may have unsaved changes.
    let closeConfirmed = false
    const onConfirmed = (event) => {
      if (event.sender !== win.webContents || win.isDestroyed()) return
      closeConfirmed = true
      win.close()
    }
    ipcMain?.on('settings-close-confirmed', onConfirmed)
    win.on('close', (event) => {
      if (closeConfirmed || !ipcMain || win.webContents.isLoading()) return
      event.preventDefault()
      win.webContents.send('settings-close-request')
    })

    win.setMenuBarVisibility(false)
    win.loadFile(path.join(viewsDirectory, 'Settings.html'))
    win.webContents.once('did-finish-load', () => applyThemeToWindow(win, getTheme()))
    win.on('closed', () => {
      ipcMain?.removeListener('settings-close-confirmed', onConfirmed)
      settingsWindow = null
    })
  }
}
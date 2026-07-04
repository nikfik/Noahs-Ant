const path = require('path')
const { app, BrowserWindow, ipcMain } = require('electron')

const defaultTheme = { bgColor: '#1a1a1a', textColor: '#e0e0e0', primaryColor: '#ff4f1a' }
let currentTheme = { ...defaultTheme }
let settingsWindow = null

function applyThemeToWindow(win) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('theme-changed', currentTheme)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    backgroundColor: currentTheme.bgColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const indexPath = path.join(__dirname, '..', 'views', 'ProjectList.html')
  win.loadFile(indexPath)

  win.webContents.once('did-finish-load', () => {
    applyThemeToWindow(win)
  })
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 460,
    height: 700,
    resizable: false,
    title: 'Settings',
    backgroundColor: currentTheme.bgColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const settingsPath = path.join(__dirname, '..', 'views', 'Settings.html')
  settingsWindow.loadFile(settingsPath)

  settingsWindow.webContents.once('did-finish-load', () => {
    applyThemeToWindow(settingsWindow)
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

app.whenReady().then(() => {
  ipcMain.handle('get-theme', () => currentTheme)
  ipcMain.handle('set-theme', (_event, theme) => {
    currentTheme = { ...currentTheme, ...theme }
    BrowserWindow.getAllWindows().forEach((win) => {
      applyThemeToWindow(win)
    })
    return currentTheme
  })
  ipcMain.handle('open-settings-window', () => {
    createSettingsWindow()
    return true
  })

  createWindow()
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
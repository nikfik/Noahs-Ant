const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain } = require('electron')

const defaultTheme = { bgColor: '#1a1a1a', textColor: '#e0e0e0', primaryColor: '#ff4f1a' }
let currentTheme = { ...defaultTheme }
let settingsWindow = null
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'Projects')

function ensureProjectsDirectory() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true })
  }
}

function sanitizeFileName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '-').trim()
}

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

function readProjectFile(fileName) {
  const filePath = path.join(PROJECTS_DIR, fileName)
  const content = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function listProjectFiles() {
  ensureProjectsDirectory()
  return fs.readdirSync(PROJECTS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
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

  ipcMain.handle('create-project', (_event, projectName) => {
    ensureProjectsDirectory()
    const safeName = sanitizeFileName(projectName || 'Untitled Project') || 'Untitled-Project'
    let fileName = `${safeName}.json`
    let counter = 1

    while (fs.existsSync(path.join(PROJECTS_DIR, fileName))) {
      fileName = `${safeName}-${counter}.json`
      counter += 1
    }

    const now = new Date().toISOString()
    const projectData = {
      projectName: projectName || 'Untitled Project',
      createdAt: now,
      MostRecentOpen: now
    }

    fs.writeFileSync(path.join(PROJECTS_DIR, fileName), JSON.stringify(projectData, null, 2), 'utf8')
    return { ...projectData, fileName }
  })

  ipcMain.handle('list-projects', () => {
    ensureProjectsDirectory()
    return listProjectFiles().map((fileName) => {
      try {
        const project = readProjectFile(fileName)
        return { fileName, ...project }
      } catch (_error) {
        return null
      }
    }).filter(Boolean)
  })

  ipcMain.handle('open-project', (_event, fileName) => {
    ensureProjectsDirectory()
    const project = readProjectFile(fileName)
    project.MostRecentOpen = new Date().toISOString()
    fs.writeFileSync(path.join(PROJECTS_DIR, fileName), JSON.stringify(project, null, 2), 'utf8')
    return { fileName, ...project }
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
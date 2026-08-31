const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')

const defaultTheme = { bgColor: '#1a1a1a', textColor: '#e0e0e0', primaryColor: '#ff4f1a' }
const APP_SETTINGS_PATH = path.join(__dirname, '..', '..', 'app-settings.json')
let currentTheme = { ...defaultTheme }
let settingsWindow = null
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'Projects')

function ensureProjectsDirectory() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true })
  }
}

function readAppSettings() {
  try {
    if (!fs.existsSync(APP_SETTINGS_PATH)) {
      return { programShortcuts: [], projectShortcuts: [] }
    }

    const raw = fs.readFileSync(APP_SETTINGS_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      programShortcuts: Array.isArray(parsed.programShortcuts) ? parsed.programShortcuts : [],
      projectShortcuts: Array.isArray(parsed.projectShortcuts) ? parsed.projectShortcuts : []
    }
  } catch (_error) {
    return { programShortcuts: [], projectShortcuts: [] }
  }
}

function writeAppSettings(settings) {
  const payload = {
    programShortcuts: Array.isArray(settings?.programShortcuts) ? settings.programShortcuts : [],
    projectShortcuts: Array.isArray(settings?.projectShortcuts) ? settings.projectShortcuts : []
  }

  fs.writeFileSync(APP_SETTINGS_PATH, JSON.stringify(payload, null, 2), 'utf8')
  return payload
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
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    resizable: true,
    title: 'Settings',
    backgroundColor: currentTheme.bgColor,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  settingsWindow.setMenuBarVisibility(false)

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

  ipcMain.handle('get-app-settings', () => readAppSettings())

  ipcMain.handle('save-app-settings', (_event, settings) => {
    return writeAppSettings(settings)
  })

  ipcMain.handle('open-settings-window', () => {
    createSettingsWindow()
    return true
  })

  ipcMain.handle('select-video-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
    })

    if (result.canceled || !result.filePaths.length) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('save-project-video', (_event, fileName, videoPath) => {
    ensureProjectsDirectory()
    const project = readProjectFile(fileName)
    project.videoPath = videoPath
    project.MostRecentOpen = new Date().toISOString()

    fs.writeFileSync(path.join(PROJECTS_DIR, fileName), JSON.stringify(project, null, 2), 'utf8')
    return { fileName, ...project }
  })

  ipcMain.handle('save-project-etogram', (_event, fileName, etogramRows) => {
    ensureProjectsDirectory()
    const project = readProjectFile(fileName)
    project.etogram = Array.isArray(etogramRows) ? etogramRows : []
    project.MostRecentOpen = new Date().toISOString()

    fs.writeFileSync(path.join(PROJECTS_DIR, fileName), JSON.stringify(project, null, 2), 'utf8')
    return { fileName, ...project }
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
      MostRecentOpen: now,
      etogram: [],
      videoPath: ''
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
    project.etogram = Array.isArray(project.etogram) ? project.etogram : []
    project.videoPath = typeof project.videoPath === 'string' ? project.videoPath : ''
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
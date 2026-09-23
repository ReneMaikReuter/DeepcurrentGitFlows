import { app, BrowserWindow, shell, ipcMain, session } from 'electron'
import * as path from 'path'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipc/handlers'
import { registerDialogHandlers } from './ipc/dialogHandlers'
import { SettingsService } from './services/SettingsService'

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  })

  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL

  // Open external links in the system browser — never inside the Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Navigation lock: renderer can only stay at its own origin
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigin = isDev
      ? (process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173')
      : 'file://'
    if (!url.startsWith(allowedOrigin)) {
      event.preventDefault()
    }
  })

  // Disable DevTools in production — nobody should be able to inspect the main process from the UI
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools()
    })
  }

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    // Production: dist/ is output of `vite build`, dist-electron/main/ is this file's dir
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Window control IPC
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
}

function setupAutoUpdater(): void {
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:update-available', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:update-downloaded', info.version)
  })

  // Renderer requests immediate install & restart
  ipcMain.on('updater:install-now', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Check once on start, then every 2 hours
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000)
}

// Reject any TLS certificate that Electron doesn't trust natively
app.on('certificate-error', (event, _webContents, _url, _error, _cert, callback) => {
  event.preventDefault()
  callback(false)
})

function setupSecurityPolicies(): void {
  const defaultSession = session.defaultSession

  // Content-Security-Policy: lock down what the renderer may load/execute
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",           // Vite injects inline styles
            "img-src 'self' data: https://avatars.githubusercontent.com",
            "connect-src 'self' https://api.github.com https://github.com https://objects.githubusercontent.com",
            "font-src 'self' data:",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'none'",
          ].join('; '),
        ],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'Referrer-Policy': ['no-referrer'],
      },
    })
  })

  // Deny every permission request from the renderer (geolocation, microphone, camera, …)
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
}

app.whenReady().then(async () => {
  await SettingsService.getInstance().load()
  setupSecurityPolicies()
  registerIpcHandlers()
  registerDialogHandlers()
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

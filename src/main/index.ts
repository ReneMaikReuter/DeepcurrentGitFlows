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
    icon: path.join(__dirname, '../../assets/icon.ico'),
    backgroundColor: '#00000000',
    transparent: true,
    frame: false,
    thickFrame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  })

  // Gespeichertes Theme vor dem Anzeigen anwenden
  const savedTheme = SettingsService.getInstance().get().theme
  if (savedTheme === 'glass') {
    try { mainWindow.setBackgroundMaterial('acrylic' as any) } catch {}
  } else {
    mainWindow.setBackgroundColor('#111113')
  }

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

  // FancyZones / Windows Snap: force Electron to honour the new bounds after a snap resize.
  // Without this, transparent frameless windows sometimes keep their old content size.
  let resizeDebounce: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('resize', () => {
    if (resizeDebounce) clearTimeout(resizeDebounce)
    resizeDebounce = setTimeout(() => {
      if (!mainWindow) return
      const b = mainWindow.getBounds()
      mainWindow.setBounds(b)
    }, 50)
  })

  mainWindow.on('close', () => {
    // Vor dem Schließen Acrylic deaktivieren damit kein Ghost-Frame sichtbar bleibt
    try {
      mainWindow?.setBackgroundMaterial('none')
      mainWindow?.setBackgroundColor('#0f0f0f')
    } catch {}
  })

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
  ipcMain.handle('window:set-material', (_e, material: 'none' | 'acrylic' | 'mica') => {
    if (!mainWindow) return
    try {
      if (material === 'none') {
        mainWindow.setBackgroundMaterial('none')
        mainWindow.setBackgroundColor('#111113')
      } else {
        mainWindow.setBackgroundColor('#00000000')
        mainWindow.setBackgroundMaterial(material as any)
      }
    } catch (e) {
      // setBackgroundMaterial wirft auf Windows 10 oder aelteren Electron-Versionen
    }
  })

  // Theme beim Start anwenden (wird direkt nach dem ersten Renderer-Load aufgerufen)
  ipcMain.handle('window:apply-startup-material', async () => {
    if (!mainWindow) return
    const theme = SettingsService.getInstance().get().theme
    if (theme === 'glass') {
      try {
        mainWindow.setBackgroundColor('#00000000')
        mainWindow.setBackgroundMaterial('acrylic' as any)
      } catch {}
    }
  })
}

// Persisted updater state so renderer can query it on mount (avoids race condition)
const updaterState = {
  updateAvailable: false,
  updateDownloaded: false,
  version: null as string | null,
  downloadProgress: null as number | null,
}

function setupAutoUpdater(): void {
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL
  if (isDev) return

  // Write updater events to log file for diagnosis
  const logFile = path.join(app.getPath('userData'), 'updater.log')
  const writeLog = (msg: string) => {
    try {
      const line = `[${new Date().toISOString()}] ${msg}\n`
      require('fs').appendFileSync(logFile, line)
    } catch {}
  }

  autoUpdater.autoDownload = false  // manual download so we control the flow
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  autoUpdater.on('update-available', (info) => {
    writeLog(`update-available: ${info.version}`)
    updaterState.updateAvailable = true
    updaterState.version = info.version
    mainWindow?.webContents.send('updater:update-available', info.version)
    // Start download now
    autoUpdater.downloadUpdate().catch((e) => {
      writeLog(`downloadUpdate error: ${e?.message ?? e}`)
      mainWindow?.webContents.send('updater:error', String(e?.message ?? e))
    })
  })

  autoUpdater.on('update-not-available', () => {
    writeLog('update-not-available')
    mainWindow?.webContents.send('updater:no-update')
  })

  autoUpdater.on('download-progress', (progress) => {
    writeLog(`download-progress: ${Math.round(progress.percent)}% (${progress.transferred}/${progress.total} bytes)`)
    updaterState.downloadProgress = Math.round(progress.percent)
    mainWindow?.webContents.send('updater:download-progress', updaterState.downloadProgress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    writeLog(`update-downloaded: ${info.version}`)
    updaterState.updateDownloaded = true
    updaterState.downloadProgress = 100
    updaterState.version = info.version
    mainWindow?.webContents.send('updater:update-downloaded', info.version)
  })

  autoUpdater.on('error', (err) => {
    writeLog(`error: ${err?.message ?? err}`)
    mainWindow?.webContents.send('updater:error', err.message)
  })

  ipcMain.on('updater:install-now', () => {
    writeLog(`install-now requested, downloaded=${updaterState.updateDownloaded}`)
    if (!updaterState.updateDownloaded) {
      mainWindow?.webContents.send('updater:not-ready')
      return
    }
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('shell:open-external', (_, url: string) => {
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
      shell.openExternal(url)
    }
  })

  // Renderer queries current state on mount — fixes race condition on fast connections
  ipcMain.handle('updater:get-state', () => updaterState)

  ipcMain.handle('updater:check', async () => {
    try { await autoUpdater.checkForUpdates() } catch (e) {
      mainWindow?.webContents.send('updater:error', String(e))
    }
  })

  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 2 * 60 * 60 * 1000)
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
            "img-src 'self' data: https://avatars.githubusercontent.com",
            "connect-src 'self' https://api.github.com https://github.com https://objects.githubusercontent.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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

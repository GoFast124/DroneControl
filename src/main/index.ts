import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SerialPort } from 'serialport'
import { MavlinkLink } from './mavlink/link'
import { IPC } from '../shared/types'
import type { ConnectionConfig, VehicleCommand } from '../shared/types'
import type { MissionItem } from '../shared/mission'

const link = new MavlinkLink()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  link.on('connection-state', (state) => mainWindow.webContents.send(IPC.onConnectionState, state))
  link.on('telemetry', (state) => mainWindow.webContents.send(IPC.onTelemetry, state))
  link.on('param-progress', (progress) => mainWindow.webContents.send(IPC.onParamProgress, progress))
  link.on('param-update', (param) => mainWindow.webContents.send(IPC.onParamUpdate, param))
  link.on('log', (entry) => mainWindow.webContents.send(IPC.onLog, entry))
  link.on('mission-progress', (p) => mainWindow.webContents.send(IPC.onMissionProgress, p))
  link.on('setup-event', (event) => mainWindow.webContents.send(IPC.onSetupEvent, event))
  link.on('status-message', (msg) => mainWindow.webContents.send(IPC.onStatusMessage, msg))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (!is.dev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://server.arcgisonline.com https://tile.openstreetmap.org"
            ].join('; ')
          ]
        }
      })
    })
  }

  ipcMain.handle(IPC.listSerialPorts, async () => {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      friendlyName: (p as { friendlyName?: string }).friendlyName
    }))
  })

  ipcMain.handle(IPC.connect, async (_event, config: ConnectionConfig) => {
    await link.connect(config)
  })

  ipcMain.handle(IPC.disconnect, async () => {
    link.disconnect()
  })

  ipcMain.handle(IPC.getConnectionState, () => link.getConnectionState())

  ipcMain.handle(IPC.missionDownload, () => link.missionDownload())
  ipcMain.handle(IPC.missionUpload, (_e, items: MissionItem[], home: MissionItem | null) => link.missionUpload(items, home))
  ipcMain.handle(IPC.missionClear, () => link.missionClear())
  ipcMain.handle(IPC.missionSetCurrent, (_e, seq: number) => link.missionSetCurrent(seq))

  ipcMain.handle(IPC.sendCommand, async (_event, cmd: VehicleCommand) => {
    await link.sendCommand(cmd)
  })

  ipcMain.handle(IPC.requestParams, () => {
    link.requestParams()
  })

  ipcMain.handle(IPC.setParam, async (_event, id: string, value: number) => {
    await link.setParam(id, value)
  })

  ipcMain.handle(IPC.getParams, () => link.getParams())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  link.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

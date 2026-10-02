import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SerialPort } from 'serialport'
import { MavlinkLink } from './mavlink/link'
import type { MavlinkLinkEvents } from './mavlink/link'
import { getStationLocation } from './location'
import { IPC } from '../shared/types'
import type { ConnectionConfig, VehicleCommand } from '../shared/types'
import type { MissionItem } from '../shared/mission'

const link = new MavlinkLink()

// Link events that are passed on to the window, and the IPC channel each one uses.
const LINK_EVENTS: [keyof MavlinkLinkEvents, string][] = [
  ['connection-state', IPC.onConnectionState],
  ['telemetry', IPC.onTelemetry],
  ['param-progress', IPC.onParamProgress],
  ['param-update', IPC.onParamUpdate],
  ['log', IPC.onLog],
  ['mission-progress', IPC.onMissionProgress],
  ['setup-event', IPC.onSetupEvent],
  ['status-message', IPC.onStatusMessage]
]

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

  // Forward the vehicle link's events to this window. The link keeps running timers of its own (telemetry is sent on a
  // short delay), so an event can arrive just after the window has been closed; sending to a destroyed window throws,
  // so check first and stop forwarding once the window is gone.
  const forwarded: [keyof MavlinkLinkEvents, (payload: unknown) => void][] = LINK_EVENTS.map(([event, channel]) => [
    event,
    (payload) => {
      if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(channel, payload)
    }
  ])
  for (const [event, handler] of forwarded) link.on(event, handler)
  mainWindow.on('closed', () => {
    for (const [event, handler] of forwarded) link.off(event, handler)
  })

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

  ipcMain.handle(IPC.getStationLocation, () => getStationLocation())
  ipcMain.handle(IPC.setTrafficStation, (_event, pos: { lat: number; lon: number } | null) => link.setTrafficStation(pos))
  ipcMain.handle(IPC.setTrafficRange, (_event, km: number) => link.setTrafficRange(Number(km)))
  ipcMain.handle(IPC.setOnlineTraffic, (_event, enabled: boolean) => link.setOnlineTraffic(!!enabled))
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

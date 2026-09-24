import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { MissionItem } from '../shared/mission'
import type {
  ConnectionConfig,
  ConnectionState,
  LogEntry,
  MissionProgress,
  ParamEntry,
  ParamProgress,
  SerialPortInfo,
  SetupEvent,
  StatusMessage,
  TelemetryState,
  VehicleCommand
} from '../shared/types'

const api = {
  listSerialPorts: (): Promise<SerialPortInfo[]> => ipcRenderer.invoke(IPC.listSerialPorts),
  connect: (config: ConnectionConfig): Promise<void> => ipcRenderer.invoke(IPC.connect, config),
  disconnect: (): Promise<void> => ipcRenderer.invoke(IPC.disconnect),
  getConnectionState: (): Promise<ConnectionState> => ipcRenderer.invoke(IPC.getConnectionState),
  requestParams: (): Promise<void> => ipcRenderer.invoke(IPC.requestParams),
  setParam: (id: string, value: number): Promise<void> => ipcRenderer.invoke(IPC.setParam, id, value),
  setOnlineTraffic: (enabled: boolean): Promise<void> => ipcRenderer.invoke(IPC.setOnlineTraffic, enabled),
  getParams: (): Promise<ParamEntry[]> => ipcRenderer.invoke(IPC.getParams),
  missionDownload: (): Promise<{ home: MissionItem | null; items: MissionItem[] }> => ipcRenderer.invoke(IPC.missionDownload),
  missionUpload: (items: MissionItem[], home: MissionItem | null): Promise<void> =>
    ipcRenderer.invoke(IPC.missionUpload, items, home),
  missionClear: (): Promise<void> => ipcRenderer.invoke(IPC.missionClear),
  missionSetCurrent: (seq: number): Promise<void> => ipcRenderer.invoke(IPC.missionSetCurrent, seq),
  onMissionProgress: (cb: (p: MissionProgress) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, p: MissionProgress): void => cb(p)
    ipcRenderer.on(IPC.onMissionProgress, listener)
    return () => ipcRenderer.removeListener(IPC.onMissionProgress, listener)
  },
  sendCommand: (cmd: VehicleCommand): Promise<void> => ipcRenderer.invoke(IPC.sendCommand, cmd),

  onSetupEvent: (cb: (event: SetupEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, event: SetupEvent): void => cb(event)
    ipcRenderer.on(IPC.onSetupEvent, listener)
    return () => ipcRenderer.removeListener(IPC.onSetupEvent, listener)
  },
  onStatusMessage: (cb: (msg: StatusMessage) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, msg: StatusMessage): void => cb(msg)
    ipcRenderer.on(IPC.onStatusMessage, listener)
    return () => ipcRenderer.removeListener(IPC.onStatusMessage, listener)
  },

  onConnectionState: (cb: (state: ConnectionState) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: ConnectionState): void => cb(state)
    ipcRenderer.on(IPC.onConnectionState, listener)
    return () => ipcRenderer.removeListener(IPC.onConnectionState, listener)
  },
  onTelemetry: (cb: (state: TelemetryState) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, state: TelemetryState): void => cb(state)
    ipcRenderer.on(IPC.onTelemetry, listener)
    return () => ipcRenderer.removeListener(IPC.onTelemetry, listener)
  },
  onParamProgress: (cb: (progress: ParamProgress) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, progress: ParamProgress): void => cb(progress)
    ipcRenderer.on(IPC.onParamProgress, listener)
    return () => ipcRenderer.removeListener(IPC.onParamProgress, listener)
  },
  onParamUpdate: (cb: (param: ParamEntry) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, param: ParamEntry): void => cb(param)
    ipcRenderer.on(IPC.onParamUpdate, listener)
    return () => ipcRenderer.removeListener(IPC.onParamUpdate, listener)
  },
  onLog: (cb: (entry: LogEntry) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, entry: LogEntry): void => cb(entry)
    ipcRenderer.on(IPC.onLog, listener)
    return () => ipcRenderer.removeListener(IPC.onLog, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

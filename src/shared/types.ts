// Types shared between the main process (MAVLink link) and the renderer (UI).

export type SerialConnectionConfig = {
  kind: 'serial'
  path: string
  baudRate: number
}

export type UdpConnectionConfig = {
  kind: 'udp'
  bindPort: number
  remoteHost?: string
  remotePort?: number
}

export type TcpConnectionConfig = {
  kind: 'tcp'
  host: string
  port: number
}

export type ConnectionConfig = SerialConnectionConfig | UdpConnectionConfig | TcpConnectionConfig

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ConnectionState {
  status: ConnectionStatus
  config?: ConnectionConfig
  error?: string
  systemId?: number
  componentId?: number
}

export interface SerialPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  friendlyName?: string
}

export interface AttitudeData {
  roll: number
  pitch: number
  yaw: number
  rollspeed: number
  pitchspeed: number
  yawspeed: number
}

export interface VfrHudData {
  airspeed: number
  groundspeed: number
  heading: number
  throttle: number
  alt: number
  climb: number
}

export interface GlobalPositionData {
  lat: number
  lon: number
  alt: number
  relativeAlt: number
  vx: number
  vy: number
  vz: number
  hdg: number
}

export interface GpsRawData {
  fixType: number
  satellitesVisible: number
  eph: number
  epv: number
  lat: number
  lon: number
  alt: number
}

export interface BatteryData {
  voltageBattery: number
  currentBattery: number
  batteryRemaining: number
}

export interface HeartbeatData {
  type: number
  autopilot: number
  baseMode: number
  customMode: number
  systemStatus: number
}

export interface RcChannelsData {
  channels: number[]
  rssi: number
}

export interface TelemetryState {
  missionCurrent?: number
  armed: boolean
  flightMode: string
  lastHeartbeatAt?: number
  heartbeat?: HeartbeatData
  attitude?: AttitudeData
  vfrHud?: VfrHudData
  globalPosition?: GlobalPositionData
  gpsRaw?: GpsRawData
  battery?: BatteryData
  rc?: RcChannelsData
}

export type MavParamType = number

export interface ParamEntry {
  id: string
  value: number
  type: MavParamType
  index: number
}

export interface ParamProgress {
  received: number
  total: number
}

export interface LogEntry {
  timestamp: number
  direction: 'in' | 'out'
  msgId: number
  msgName: string
  summary: string
}

// MAVLink severity: 0 emergency … 7 debug. Lower is more severe.
export interface StatusMessage {
  timestamp: number
  severity: number
  text: string
  source: 'vehicle' | 'gcs'
}

export type VehicleCommand =
  | { type: 'arm'; force?: boolean }
  | { type: 'disarm'; force?: boolean }
  | { type: 'setMode'; mode: number }
  | { type: 'takeoff'; altitude: number }

export interface MissionProgress {
  op: 'upload' | 'download'
  done: number
  total: number
}

export const IPC = {
  missionDownload: 'mission:download',
  missionUpload: 'mission:upload',
  missionClear: 'mission:clear',
  missionSetCurrent: 'mission:set-current',
  onMissionProgress: 'mission:progress',
  sendCommand: 'link:send-command',
  onStatusMessage: 'link:status-message',
  listSerialPorts: 'link:list-serial-ports',
  connect: 'link:connect',
  disconnect: 'link:disconnect',
  getConnectionState: 'link:get-connection-state',
  requestParams: 'link:request-params',
  setParam: 'link:set-param',
  getParams: 'link:get-params',

  onConnectionState: 'link:connection-state',
  onTelemetry: 'link:telemetry',
  onParamProgress: 'link:param-progress',
  onParamUpdate: 'link:param-update',
  onLog: 'link:log'
} as const

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
  channels: number[] // raw microseconds, index 0 = channel 1; 0 = channel not received
  rssi: number
}

// Attitude the vehicle's controller is aiming for (ATTITUDE_TARGET), radians and rad/s.
export interface AttitudeTargetData {
  roll: number
  pitch: number
  yaw: number
  rollRate: number
  pitchRate: number
  yawRate: number
}

// Single-point distance sensor (rangefinder / one sector of a proximity sensor). Distances in metres.
export interface DistanceSensorData {
  id: number
  // MAV_SENSOR_ORIENTATION: 0-7 = yaw 0..315 deg clockwise, 24 = up, 25 = down, 100 = custom quaternion
  orientation: number
  distance: number
  min: number
  max: number
  fovDeg: number // horizontal field of view, 0 if the sensor doesn't report it
  yawDeg?: number // only for custom orientation
  timestamp: number
}

// 360 degree scan from OBSTACLE_DISTANCE. distances[i] is at angleOffset + i * increment (deg clockwise); NaN = no reading.
export interface ObstacleScanData {
  distances: number[]
  increment: number
  angleOffset: number
  min: number
  max: number
  frame: number // MAV_FRAME: body frames are vehicle-relative, GLOBAL (0) is north-aligned
  timestamp: number
}

export interface ProximityData {
  sensors: DistanceSensorData[]
  scan?: ObstacleScanData
}

// One axis of the rate/angle controller from PID_TUNING (needs GCS_PID_MASK set on the vehicle). Rates in deg/s.
export interface PidTuningData {
  desired: number
  achieved: number
  ff: number
  p: number
  i: number
  d: number
  timestamp: number
}

// Another aircraft, from the vehicle's ADS-B receiver (MAVLink ADSB_VEHICLE) or the optional online feed.
export interface Aircraft {
  id: string // ICAO 24-bit address, hex
  callsign: string // empty if unknown
  type: string // aircraft type code or emitter category, empty if unknown
  lat: number
  lon: number
  altitude?: number // metres above mean sea level as reported (barometric where available)
  onGround: boolean
  heading?: number // degrees true, direction of travel
  speed?: number // ground speed, m/s
  climb?: number // m/s, positive up
  source: 'vehicle' | 'online'
  lastSeen: number // ms since epoch
}

export interface TrafficData {
  aircraft: Aircraft[]
  online: {
    enabled: boolean
    error?: string // last fetch problem, if any
    updatedAt?: number
  }
}

// SYS_STATUS: which onboard subsystems exist, are in use and are working. Each is a bitmask (MAV_SYS_STATUS_SENSOR).
export interface SensorStatus {
  present: number
  enabled: number
  health: number
  cpuLoad: number // percent
  commDropPercent: number // packets lost on the link, percent
}

// EKF_STATUS_REPORT: what the state estimator currently trusts. flags is a bitmask (EKF_STATUS_FLAGS); variances are 0-1+.
export interface EkfData {
  flags: number
  velocityVariance: number
  posHorizVariance: number
  posVertVariance: number
  compassVariance: number
  terrainAltVariance: number
}

export interface VibrationData {
  x: number // m/s/s
  y: number
  z: number
  clipping: number[] // accelerometer clip counts, one per IMU
}

export interface PowerData {
  vcc: number // flight controller 5 V rail, volts
  vservo: number // servo rail, volts
}

export interface TelemetryState {
  sensors?: SensorStatus
  ekf?: EkfData
  vibration?: VibrationData
  power?: PowerData
  traffic?: TrafficData
  navTarget?: { roll: number; pitch: number } // degrees, from NAV_CONTROLLER_OUTPUT
  pid?: Record<number, PidTuningData> // keyed by axis: 1 roll, 2 pitch, 3 yaw
  servoOutputs?: number[] // SERVO_OUTPUT_RAW, microseconds, index 0 = output 1
  attitudeTarget?: AttitudeTargetData
  proximity?: ProximityData
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
  | { type: 'calibrate'; kind: 'gyro' | 'level' | 'baro' | 'accel' }
  | { type: 'accelPosition'; position: number } // tell the vehicle it has been placed in the requested orientation
  | { type: 'magCal'; action: 'start' | 'cancel' | 'accept'; mask?: number } // mask 0 = all compasses
  | { type: 'motorTest'; motor: number; throttlePercent: number; durationSec: number; count?: number }
  | { type: 'motorTestStop' }
  | { type: 'reboot' }
  | { type: 'messageRate'; messageId: number; hz: number } // hz 0 = restore the vehicle's default rate

// Events from the vehicle's calibration procedures.
export type SetupEvent =
  | { type: 'accelPosition'; position: number } // 1 level, 2 left, 3 right, 4 nose down, 5 nose up, 6 back; 16777215 = success, 16777216 = failed
  | { type: 'magProgress'; compassId: number; status: number; attempt: number; percent: number; mask: number[] }
  | {
      type: 'magReport'
      compassId: number
      status: number
      fitness: number
      autosaved: boolean
      offsets: [number, number, number]
    }

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
  onSetupEvent: 'setup:event',
  listSerialPorts: 'link:list-serial-ports',
  connect: 'link:connect',
  disconnect: 'link:disconnect',
  getConnectionState: 'link:get-connection-state',
  requestParams: 'link:request-params',
  setParam: 'link:set-param',
  setOnlineTraffic: 'traffic:set-online',
  getParams: 'link:get-params',

  onConnectionState: 'link:connection-state',
  onTelemetry: 'link:telemetry',
  onParamProgress: 'link:param-progress',
  onParamUpdate: 'link:param-update',
  onLog: 'link:log'
} as const

import type { StatusMessage, TelemetryState } from '../../shared/types'

// Health indicators for the vehicle's components, derived from telemetry. 'off' means not fitted, not in use, or no data yet.
export type Level = 'ok' | 'warn' | 'bad' | 'off'

export interface Indicator {
  id: string
  label: string
  level: Level
  detail: string
}

// MAV_SYS_STATUS_SENSOR bits
const SENSOR = {
  gyro: 0x1,
  accel: 0x2,
  mag: 0x4,
  baro: 0x8,
  gps: 0x20,
  opticalFlow: 0x40,
  motors: 0x8000,
  rc: 0x10000,
  gyro2: 0x20000,
  accel2: 0x40000,
  mag2: 0x80000,
  geofence: 0x100000,
  ahrs: 0x200000,
  terrain: 0x400000,
  logging: 0x1000000,
  battery: 0x2000000,
  proximity: 0x4000000,
  prearm: 0x10000000
}

// EKF_STATUS_FLAGS bits
const EKF = {
  attitude: 1,
  velocityHoriz: 2,
  velocityVert: 4,
  posHorizRel: 8,
  posHorizAbs: 16,
  posVertAbs: 32,
  constPosMode: 128,
  uninitialized: 1024,
  gpsGlitching: 32768
}

const GPS_FIX = ['No GPS', 'No fix', '2D fix', '3D fix', 'DGPS', 'RTK float', 'RTK fixed', 'Static', 'PPP']
const VEHICLE_STATE = ['Uninitialised', 'Booting', 'Calibrating', 'Standby', 'Active', 'Critical', 'Emergency', 'Powering off', 'Terminating']

const has = (mask: number, bit: number): boolean => (mask & bit) !== 0

// State of a group of sensors that are reported as a set (e.g. the primary and backup gyro).
function sensorGroup(t: TelemetryState, label: string, id: string, bits: number[], noun: string): Indicator {
  const s = t.sensors
  if (!s) return { id, label, level: 'off', detail: 'Waiting for data' }
  const fitted = bits.filter((b) => has(s.present, b))
  if (fitted.length === 0) return { id, label, level: 'off', detail: 'Not fitted' }
  const inUse = fitted.filter((b) => has(s.enabled, b))
  if (inUse.length === 0) return { id, label, level: 'off', detail: 'Disabled' }
  const healthy = inUse.filter((b) => has(s.health, b)).length
  const count = fitted.length > 1 ? `${healthy} of ${inUse.length} ${noun} healthy` : 'Healthy'
  return { id, label, level: healthy === inUse.length ? 'ok' : 'bad', detail: healthy === inUse.length ? count : `${count} - check the sensor` }
}

// A single subsystem with an optional custom "ok" description.
function single(t: TelemetryState, label: string, id: string, bit: number, okText: string, badText: string, offText = 'Not fitted'): Indicator {
  const s = t.sensors
  if (!s) return { id, label, level: 'off', detail: 'Waiting for data' }
  if (!has(s.present, bit)) return { id, label, level: 'off', detail: offText }
  if (!has(s.enabled, bit)) return { id, label, level: 'off', detail: 'Not enabled' }
  return has(s.health, bit) ? { id, label, level: 'ok', detail: okText } : { id, label, level: 'bad', detail: badText }
}

function vehicleIndicator(t: TelemetryState, linkAgeMs: number | undefined): Indicator {
  const state = t.heartbeat?.systemStatus
  const name = state === undefined ? 'Waiting' : (VEHICLE_STATE[state] ?? `State ${state}`)
  const armed = t.armed ? 'Armed' : 'Disarmed'
  if (linkAgeMs === undefined || linkAgeMs > 3000) return { id: 'vehicle', label: 'Vehicle', level: 'bad', detail: 'No heartbeat' }
  const level: Level = state === 6 ? 'bad' : state === 5 || state === 1 || state === 2 ? 'warn' : 'ok'
  return { id: 'vehicle', label: 'Vehicle', level, detail: `${armed} · ${name}` }
}

function linkIndicator(t: TelemetryState, linkAgeMs: number | undefined): Indicator {
  if (linkAgeMs === undefined) return { id: 'link', label: 'Link', level: 'off', detail: 'No heartbeat yet' }
  if (linkAgeMs > 3000) return { id: 'link', label: 'Link', level: 'bad', detail: `Lost ${Math.round(linkAgeMs / 1000)} s ago` }
  const drop = t.sensors?.commDropPercent ?? 0
  const level: Level = drop > 10 ? 'bad' : drop > 2 ? 'warn' : 'ok'
  return { id: 'link', label: 'Link', level, detail: t.sensors ? `${drop.toFixed(1)}% packets lost` : 'Heartbeat OK' }
}

function gpsIndicator(t: TelemetryState): Indicator {
  const g = t.gpsRaw
  if (!g) return { id: 'gps', label: 'GPS', level: 'off', detail: 'Waiting for data' }
  const fix = GPS_FIX[g.fixType] ?? `Type ${g.fixType}`
  if (g.fixType === 0) return { id: 'gps', label: 'GPS', level: 'bad', detail: 'No GPS detected' }
  if (g.fixType < 2) return { id: 'gps', label: 'GPS', level: 'bad', detail: `${fix} · ${g.satellitesVisible} sats` }
  const hdop = g.eph / 100
  const weak = g.fixType === 2 || g.satellitesVisible < 6 || hdop > 2
  return { id: 'gps', label: 'GPS', level: weak ? 'warn' : 'ok', detail: `${fix} · ${g.satellitesVisible} sats · HDOP ${hdop.toFixed(1)}` }
}

function attitudeIndicator(t: TelemetryState): Indicator {
  const e = t.ekf
  if (!e) {
    return single(t, 'Attitude', 'attitude', SENSOR.ahrs, 'AHRS healthy', 'AHRS unhealthy')
  }
  if (has(e.flags, EKF.uninitialized)) return { id: 'attitude', label: 'Attitude', level: 'warn', detail: 'EKF initialising' }
  if (!has(e.flags, EKF.attitude)) return { id: 'attitude', label: 'Attitude', level: 'bad', detail: 'No attitude estimate' }
  const ahrsBad = t.sensors && has(t.sensors.present, SENSOR.ahrs) && !has(t.sensors.health, SENSOR.ahrs)
  return { id: 'attitude', label: 'Attitude', level: ahrsBad ? 'bad' : 'ok', detail: ahrsBad ? 'AHRS unhealthy' : 'EKF attitude good' }
}

function positionIndicator(t: TelemetryState): Indicator {
  const e = t.ekf
  if (!e) return { id: 'position', label: 'Position estimate', level: 'off', detail: 'Waiting for data' }
  if (has(e.flags, EKF.uninitialized)) return { id: 'position', label: 'Position estimate', level: 'warn', detail: 'EKF initialising' }
  if (has(e.flags, EKF.gpsGlitching)) return { id: 'position', label: 'Position estimate', level: 'bad', detail: 'GPS glitching' }
  if (has(e.flags, EKF.posHorizAbs)) {
    const vel = has(e.flags, EKF.velocityHoriz) && has(e.flags, EKF.velocityVert)
    return { id: 'position', label: 'Position estimate', level: vel ? 'ok' : 'warn', detail: vel ? 'Absolute position and velocity' : 'Absolute position, velocity limited' }
  }
  if (has(e.flags, EKF.posHorizRel)) return { id: 'position', label: 'Position estimate', level: 'warn', detail: 'Relative only (no GPS position)' }
  return { id: 'position', label: 'Position estimate', level: 'warn', detail: 'None: position modes unavailable' }
}

function compassIndicator(t: TelemetryState): Indicator {
  const base = sensorGroup(t, 'Compass', 'compass', [SENSOR.mag, SENSOR.mag2], 'compasses')
  if (base.level !== 'ok' || !t.ekf) return base
  const v = t.ekf.compassVariance
  const level: Level = v >= 0.8 ? 'bad' : v >= 0.5 ? 'warn' : 'ok'
  return { ...base, level, detail: `${base.detail} · variance ${v.toFixed(2)}` }
}

function vibrationIndicator(t: TelemetryState): Indicator {
  const v = t.vibration
  if (!v) return { id: 'vibration', label: 'Vibration', level: 'off', detail: 'Waiting for data' }
  const worst = Math.max(v.x, v.y, v.z)
  const clips = v.clipping.reduce((a, b) => a + b, 0)
  const level: Level = worst >= 60 ? 'bad' : worst >= 30 || clips > 0 ? 'warn' : 'ok'
  const clipText = clips > 0 ? ` · ${clips} clips` : ''
  return { id: 'vibration', label: 'Vibration', level, detail: `${worst < 10 ? worst.toFixed(2) : worst.toFixed(0)} m/s² worst axis${clipText}` }
}

function rcIndicator(t: TelemetryState): Indicator {
  const rc = t.rc
  if (!rc) return { id: 'rc', label: 'RC receiver', level: 'off', detail: 'Waiting for data' }
  const receiving = rc.channels.some((c) => c > 0)
  const healthy = t.sensors ? has(t.sensors.health, SENSOR.rc) : receiving
  if (!receiving || !healthy) return { id: 'rc', label: 'RC receiver', level: t.armed ? 'bad' : 'warn', detail: 'No RC signal' }
  const rssi = rc.rssi === 255 ? '' : ` · RSSI ${Math.round((rc.rssi / 254) * 100)}%`
  return { id: 'rc', label: 'RC receiver', level: 'ok', detail: `${rc.channels.filter((c) => c > 0).length} channels${rssi}` }
}

function batteryIndicator(t: TelemetryState): Indicator {
  const b = t.battery
  if (!b) return { id: 'battery', label: 'Battery', level: 'off', detail: 'Waiting for data' }
  const monitored = !!t.sensors && has(t.sensors.present, SENSOR.battery) && has(t.sensors.enabled, SENSOR.battery)
  if (b.voltageBattery < 1) {
    return monitored
      ? { id: 'battery', label: 'Battery', level: t.armed ? 'bad' : 'warn', detail: `No battery voltage (${b.voltageBattery.toFixed(2)} V): power module or battery not connected?` }
      : { id: 'battery', label: 'Battery', level: 'off', detail: 'No battery monitor' }
  }
  const healthy = !t.sensors || !has(t.sensors.present, SENSOR.battery) || has(t.sensors.health, SENSOR.battery)
  const pct = b.batteryRemaining
  const level: Level = !healthy || (pct >= 0 && pct < 20) ? 'bad' : pct >= 0 && pct < 40 ? 'warn' : 'ok'
  const remaining = pct >= 0 ? ` · ${pct}%` : ''
  return { id: 'battery', label: 'Battery', level, detail: `${b.voltageBattery.toFixed(2)} V${remaining}${healthy ? '' : ' · unhealthy'}` }
}

function powerIndicator(t: TelemetryState): Indicator {
  const p = t.power
  if (!p) return { id: 'power', label: 'Board power', level: 'off', detail: 'Waiting for data' }
  const level: Level = p.vcc < 4.3 || p.vcc > 5.7 ? 'bad' : p.vcc < 4.5 || p.vcc > 5.5 ? 'warn' : 'ok'
  return { id: 'power', label: 'Board power', level, detail: `${p.vcc.toFixed(2)} V (5 V rail)` }
}

function cpuIndicator(t: TelemetryState): Indicator {
  const s = t.sensors
  if (!s) return { id: 'cpu', label: 'CPU load', level: 'off', detail: 'Waiting for data' }
  const level: Level = s.cpuLoad >= 95 ? 'bad' : s.cpuLoad >= 80 ? 'warn' : 'ok'
  return { id: 'cpu', label: 'CPU load', level, detail: `${s.cpuLoad.toFixed(0)}%` }
}

function prearmIndicator(t: TelemetryState, messages: StatusMessage[], now: number): Indicator {
  const s = t.sensors
  if (!s) return { id: 'prearm', label: 'Pre-arm checks', level: 'off', detail: 'Waiting for data' }
  if (!has(s.present, SENSOR.prearm)) return { id: 'prearm', label: 'Pre-arm checks', level: 'off', detail: 'Not reported' }
  // The vehicle leaves this bit off when arming checks are switched off (ARMING_CHECK = 0), which is worth calling out.
  if (!has(s.enabled, SENSOR.prearm)) return { id: 'prearm', label: 'Pre-arm checks', level: 'warn', detail: 'Switched off on the vehicle (ARMING_CHECK)' }
  const base: Indicator = has(s.health, SENSOR.prearm)
    ? { id: 'prearm', label: 'Pre-arm checks', level: 'ok', detail: 'All checks passing' }
    : { id: 'prearm', label: 'Pre-arm checks', level: 'bad', detail: 'Checks failing' }
  if (base.level !== 'bad') return base
  const last = [...messages].reverse().find((m) => m.source === 'vehicle' && /^PreArm/i.test(m.text) && now - m.timestamp < 120_000)
  return { ...base, level: 'warn', detail: last ? last.text.replace(/^PreArm:\s*/i, '') : 'Checks failing (try arming to see why)' }
}

export function buildIndicators(t: TelemetryState, messages: StatusMessage[], now = Date.now()): Indicator[] {
  const linkAgeMs = t.lastHeartbeatAt === undefined ? undefined : now - t.lastHeartbeatAt
  return [
    vehicleIndicator(t, linkAgeMs),
    linkIndicator(t, linkAgeMs),
    gpsIndicator(t),
    attitudeIndicator(t),
    positionIndicator(t),
    compassIndicator(t),
    sensorGroup(t, 'Gyroscope', 'gyro', [SENSOR.gyro, SENSOR.gyro2], 'gyros'),
    sensorGroup(t, 'Accelerometer', 'accel', [SENSOR.accel, SENSOR.accel2], 'accelerometers'),
    single(t, 'Barometer', 'baro', SENSOR.baro, 'Healthy', 'Unhealthy'),
    vibrationIndicator(t),
    rcIndicator(t),
    batteryIndicator(t),
    powerIndicator(t),
    cpuIndicator(t),
    single(t, 'Motor outputs', 'motors', SENSOR.motors, 'Outputs healthy', 'Output problem'),
    single(t, 'Logging', 'logging', SENSOR.logging, 'Logging to SD card', 'Log problem (SD card?)'),
    single(t, 'Geofence', 'fence', SENSOR.geofence, 'Inside fence', 'Fence breached', 'Not enabled'),
    single(t, 'Terrain', 'terrain', SENSOR.terrain, 'Terrain data OK', 'Terrain data missing'),
    single(t, 'Proximity', 'proximity', SENSOR.proximity, 'Sensor healthy', 'Sensor unhealthy'),
    single(t, 'Optical flow', 'flow', SENSOR.opticalFlow, 'Sensor healthy', 'Sensor unhealthy'),
    prearmIndicator(t, messages, now)
  ].filter((i) => !(NOT_FITTED_HIDDEN.has(i.id) && i.level === 'off'))
}

// Optional hardware: only worth a tile when the vehicle actually has it.
const NOT_FITTED_HIDDEN = new Set(['terrain', 'proximity', 'flow', 'fence'])

export function summarize(indicators: Indicator[]): { level: Level; text: string } {
  const bad = indicators.filter((i) => i.level === 'bad').length
  const warn = indicators.filter((i) => i.level === 'warn').length
  if (bad) return { level: 'bad', text: `${bad} problem${bad > 1 ? 's' : ''}${warn ? `, ${warn} warning${warn > 1 ? 's' : ''}` : ''}` }
  if (warn) return { level: 'warn', text: `${warn} warning${warn > 1 ? 's' : ''}` }
  return { level: 'ok', text: 'All OK' }
}

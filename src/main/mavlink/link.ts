import { EventEmitter } from 'node:events'
import { Writable } from 'node:stream'
import dgram from 'node:dgram'
import net from 'node:net'
import { SerialPort } from 'serialport'
import {
  MavLinkPacketSplitter,
  MavLinkPacketParser,
  MavLinkProtocolV2,
  MavLinkPacket,
  MavLinkPacketRegistry,
  MavLinkData,
  send,
  minimal,
  standard,
  common,
  ardupilotmega
} from 'node-mavlink'
import { OnlineTrafficFeed, type FeedResult } from '../traffic/onlineFeed'
import type {
  Aircraft,
  AttitudeData,
  BatteryData,
  ConnectionConfig,
  ConnectionState,
  DistanceSensorData,
  GlobalPositionData,
  GpsRawData,
  HeartbeatData,
  LogEntry,
  MissionProgress,
  ObstacleScanData,
  ParamEntry,
  ParamProgress,
  RcChannelsData,
  SetupEvent,
  SensorStatus,
  StatusMessage,
  TelemetryState,
  TrafficData,
  VehicleCommand,
  VfrHudData
} from '../../shared/types'
import { COPTER_MODES, MODE_GUIDED } from '../../shared/copterModes'
import { MissionClient } from './mission'
import type { MissionItem } from '../../shared/mission'

const REGISTRY: MavLinkPacketRegistry = {
  ...minimal.REGISTRY,
  ...standard.REGISTRY,
  ...common.REGISTRY,
  ...ardupilotmega.REGISTRY
}

const MAV_MODE_FLAG_SAFETY_ARMED = 0x80
const TELEMETRY_EMIT_MS = 33
// Vehicle-reported aircraft that haven't been heard from for this long are dropped.
const TRAFFIC_STALE_MS = 60_000
// Short names for the ADS-B emitter category (MAVLink ADSB_EMITTER_TYPE).
const EMITTER_TYPES: Record<number, string> = {
  1: 'Light', 2: 'Small', 3: 'Large', 4: 'Large', 5: 'Heavy', 6: 'Aerobatic', 7: 'Helicopter', 9: 'Glider', 10: 'Balloon',
  11: 'Parachute', 12: 'Ultralight', 14: 'UAV', 15: 'Space', 17: 'Ground vehicle', 18: 'Ground vehicle', 19: 'Obstacle'
}

const CMD_PREFLIGHT_CALIBRATION = 241
const CMD_PREFLIGHT_REBOOT = 246
const CMD_DO_MOTOR_TEST = 209
const CMD_SET_MESSAGE_INTERVAL = 511
const CMD_DO_START_MAG_CAL = 42424
const CMD_DO_ACCEPT_MAG_CAL = 42425
const CMD_DO_CANCEL_MAG_CAL = 42426
const CMD_ACCELCAL_VEHICLE_POS = 42429

class UdpWritable extends Writable {
  constructor(
    private readonly socket: dgram.Socket,
    private readonly getTarget: () => { host: string; port: number } | null
  ) {
    super()
  }

  override _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
    const target = this.getTarget()
    if (!target) {
      callback()
      return
    }
    this.socket.send(chunk, target.port, target.host, (err) => callback(err ?? null))
  }
}

export interface MavlinkLinkEvents {
  'connection-state': (state: ConnectionState) => void
  telemetry: (state: TelemetryState) => void
  'param-progress': (progress: ParamProgress) => void
  'param-update': (param: ParamEntry) => void
  log: (entry: LogEntry) => void
  'status-message': (message: StatusMessage) => void
  'mission-progress': (progress: MissionProgress) => void
  'setup-event': (event: SetupEvent) => void
}

export declare interface MavlinkLink {
  on<E extends keyof MavlinkLinkEvents>(event: E, listener: MavlinkLinkEvents[E]): this
  emit<E extends keyof MavlinkLinkEvents>(event: E, ...args: Parameters<MavlinkLinkEvents[E]>): boolean
}

export class MavlinkLink extends EventEmitter {
  private connectionState: ConnectionState = { status: 'disconnected' }
  private telemetry: TelemetryState = { armed: false, flightMode: 'UNKNOWN' }
  private params = new Map<string, ParamEntry>()
  private paramTotal = 0
  private proximitySensors = new Map<string, DistanceSensorData>()
  private proximityScan: ObstacleScanData | undefined
  private vehicleTraffic = new Map<string, Aircraft>()
  private onlineTraffic: FeedResult = { aircraft: [] }
  private onlineUpdatedAt: number | undefined
  private onlineFeed = new OnlineTrafficFeed(
    () => this.telemetry.globalPosition,
    (result) => {
      this.onlineTraffic = result
      this.onlineUpdatedAt = Date.now()
      this.emitTraffic()
    }
  )
  private telemetryTimer: NodeJS.Timeout | null = null

  private readonly mission = new MissionClient(
    (msg) => this.sendMessage(msg),
    () => ({ system: this.targetSystemId, component: this.targetComponentId })
  )

  private serialPort: SerialPort | null = null
  private udpSocket: dgram.Socket | null = null
  private udpTarget: { host: string; port: number } | null = null
  private tcpSocket: net.Socket | null = null
  private writable: Writable | SerialPort | net.Socket | null = null

  private heartbeatTimer: NodeJS.Timeout | null = null
  private systemId = 255
  private componentId = 190
  private targetSystemId = 1
  private targetComponentId = 1

  constructor() {
    super()
    this.mission.on('progress', (p: MissionProgress) => this.emit('mission-progress', p))
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  getTelemetry(): TelemetryState {
    return this.telemetry
  }

  getParams(): ParamEntry[] {
    return Array.from(this.params.values()).sort((a, b) => a.id.localeCompare(b.id))
  }

  async connect(config: ConnectionConfig): Promise<void> {
    this.disconnect()
    this.setConnectionState({ status: 'connecting', config })

    try {
      if (config.kind === 'serial') {
        await this.connectSerial(config.path, config.baudRate)
      } else if (config.kind === 'tcp') {
        await this.connectTcp(config.host, config.port)
      } else {
        await this.connectUdp(config.bindPort, config.remoteHost, config.remotePort)
      }
      this.setConnectionState({ status: 'connected', config })
      this.startHeartbeat()
      this.requestDataStreams()
    } catch (err) {
      this.setConnectionState({ status: 'error', config, error: (err as Error).message })
      throw err
    }
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.serialPort?.isOpen) {
      this.serialPort.close()
    }
    this.serialPort = null
    if (this.udpSocket) {
      this.udpSocket.close()
      this.udpSocket = null
    }
    this.udpTarget = null
    if (this.tcpSocket) {
      this.tcpSocket.destroy()
      this.tcpSocket = null
    }
    this.writable = null
    this.params.clear()
    this.paramTotal = 0
    this.proximitySensors.clear()
    this.proximityScan = undefined
    this.vehicleTraffic.clear()
    this.onlineTraffic = { aircraft: [] }
    this.telemetry = { armed: false, flightMode: 'UNKNOWN', traffic: this.trafficState() }
    if (this.connectionState.status !== 'disconnected') {
      this.setConnectionState({ status: 'disconnected' })
    }
  }

  requestParams(): void {
    this.params.clear()
    this.paramTotal = 0
    this.emit('param-progress', { received: 0, total: 0 })
    const msg = new common.ParamRequestList()
    msg.targetSystem = this.targetSystemId
    msg.targetComponent = this.targetComponentId
    void this.sendMessage(msg)
  }

  async setParam(id: string, value: number): Promise<void> {
    const existing = this.params.get(id)
    const msg = new common.ParamSet()
    msg.targetSystem = this.targetSystemId
    msg.targetComponent = this.targetComponentId
    msg.paramId = id
    msg.paramValue = value
    msg.paramType = existing?.type ?? common.MavParamType.REAL32
    await this.sendMessage(msg)
  }

  missionDownload(): Promise<{ home: MissionItem | null; items: MissionItem[] }> {
    return this.requireConnected(() => this.mission.download())
  }

  missionUpload(items: MissionItem[], home: MissionItem | null): Promise<void> {
    return this.requireConnected(() => this.mission.upload(items, home))
  }

  missionClear(): Promise<void> {
    return this.requireConnected(() => this.mission.clear())
  }

  missionSetCurrent(seq: number): Promise<void> {
    return this.requireConnected(() => this.mission.setCurrent(seq))
  }

  private requireConnected<T>(fn: () => Promise<T>): Promise<T> {
    if (this.connectionState.status !== 'connected') return Promise.reject(new Error('Not connected'))
    return fn()
  }

  async sendCommand(cmd: VehicleCommand): Promise<void> {
    if (this.connectionState.status !== 'connected') throw new Error('Not connected')
    switch (cmd.type) {
      case 'arm':
        return this.armDisarm(true, cmd.force)
      case 'disarm':
        return this.armDisarm(false, cmd.force)
      case 'setMode':
        return this.setMode(cmd.mode)
      case 'takeoff':
        return this.takeoff(cmd.altitude)
      case 'calibrate': {
        // PREFLIGHT_CALIBRATION: param1 gyro, param3 ground pressure (baro), param5 accel (1 = full six-position, 2 = level trim)
        const params = { gyro: [1], baro: [0, 0, 1], accel: [0, 0, 0, 0, 1], level: [0, 0, 0, 0, 2] }[cmd.kind]
        this.emitGcsMessage(`${cmd.kind} calibration requested`)
        return this.sendCommandLong(CMD_PREFLIGHT_CALIBRATION as common.MavCmd, params)
      }
      case 'accelPosition':
        return this.sendCommandLong(CMD_ACCELCAL_VEHICLE_POS as common.MavCmd, [cmd.position])
      case 'magCal': {
        if (cmd.action === 'start') {
          this.emitGcsMessage('Compass calibration requested')
          // mask, retry on failure, autosave (0: we ask the user to accept), delay, autoreboot
          return this.sendCommandLong(CMD_DO_START_MAG_CAL as common.MavCmd, [cmd.mask ?? 0, 1, 0, 0, 0])
        }
        const id = cmd.action === 'accept' ? CMD_DO_ACCEPT_MAG_CAL : CMD_DO_CANCEL_MAG_CAL
        return this.sendCommandLong(id as common.MavCmd, [cmd.mask ?? 0])
      }
      case 'motorTest': {
        if (this.telemetry.armed) throw new Error('Disarm before running a motor test')
        const { motor, throttlePercent, durationSec } = cmd
        if (!(throttlePercent >= 0 && throttlePercent <= 100)) throw new Error('Throttle must be between 0 and 100%')
        if (!(durationSec > 0 && durationSec <= 10)) throw new Error('Duration must be between 0 and 10 seconds')
        this.emitGcsMessage(`Motor test: motor ${motor}, ${throttlePercent}% for ${durationSec}s${cmd.count && cmd.count > 1 ? ` (sequence of ${cmd.count})` : ''}`)
        // motor instance, throttle type 0 (percent), throttle, timeout, motor count
        return this.sendCommandLong(CMD_DO_MOTOR_TEST as common.MavCmd, [motor, 0, throttlePercent, durationSec, cmd.count ?? 1])
      }
      case 'motorTestStop':
        this.emitGcsMessage('Motor test stop requested')
        return this.sendCommandLong(CMD_DO_MOTOR_TEST as common.MavCmd, [1, 0, 0, 0.1, 1])
      case 'reboot':
        this.emitGcsMessage('Reboot requested', 4)
        return this.sendCommandLong(CMD_PREFLIGHT_REBOOT as common.MavCmd, [1])
      case 'messageRate': {
        const interval = cmd.hz > 0 ? Math.round(1_000_000 / cmd.hz) : 0
        return this.sendCommandLong(CMD_SET_MESSAGE_INTERVAL as common.MavCmd, [cmd.messageId, interval])
      }
    }
  }

  private async sendCommandLong(command: common.MavCmd, params: number[] = []): Promise<void> {
    const msg = new common.CommandLong()
    msg.targetSystem = this.targetSystemId
    msg.targetComponent = this.targetComponentId
    msg.command = command
    msg.confirmation = 0
    msg._param1 = params[0] ?? 0
    msg._param2 = params[1] ?? 0
    msg._param3 = params[2] ?? 0
    msg._param4 = params[3] ?? 0
    msg._param5 = params[4] ?? 0
    msg._param6 = params[5] ?? 0
    msg._param7 = params[6] ?? 0
    await this.sendMessage(msg)
  }

  private async armDisarm(arm: boolean, force = false): Promise<void> {
    this.emitGcsMessage(`${arm ? 'Arm' : 'Disarm'}${force ? ' (forced)' : ''} requested`)
    // 21196 is the magic value that bypasses pre-arm / in-flight safety checks.
    await this.sendCommandLong(common.MavCmd.COMPONENT_ARM_DISARM, [arm ? 1 : 0, force ? 21196 : 0])
  }

  private async setMode(mode: number): Promise<void> {
    this.emitGcsMessage(`Mode change to ${COPTER_MODES[mode] ?? mode} requested`)
    // param1 = MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, param2 = ArduCopter custom mode
    await this.sendCommandLong(common.MavCmd.DO_SET_MODE, [1, mode])
  }

  private async takeoff(altitude: number): Promise<void> {
    if (!(altitude > 0 && altitude <= 1000)) throw new Error('Takeoff altitude must be between 0 and 1000 m')
    this.emitGcsMessage(`Takeoff to ${altitude} m requested (GUIDED, arm, climb)`)
    if (this.telemetry.heartbeat?.customMode !== MODE_GUIDED) {
      await this.sendCommandLong(common.MavCmd.DO_SET_MODE, [1, MODE_GUIDED])
      await this.waitFor(() => this.telemetry.heartbeat?.customMode === MODE_GUIDED, 3000, 'Vehicle did not enter GUIDED mode')
    }
    if (!this.telemetry.armed) {
      await this.sendCommandLong(common.MavCmd.COMPONENT_ARM_DISARM, [1, 0])
      await this.waitFor(() => this.telemetry.armed, 5000, 'Vehicle did not arm (see messages for the pre-arm reason)')
    }
    await this.sendCommandLong(common.MavCmd.NAV_TAKEOFF, [0, 0, 0, 0, 0, 0, altitude])
  }

  private async waitFor(condition: () => boolean, timeoutMs: number, failure: string): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (!condition()) {
      if (Date.now() > deadline) throw new Error(failure)
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  private emitGcsMessage(text: string, severity = 6): void {
    this.emit('status-message', { timestamp: Date.now(), severity, text, source: 'gcs' })
  }

  private setConnectionState(patch: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...patch }
    this.emit('connection-state', this.connectionState)
  }

  private async connectSerial(path: string, baudRate: number): Promise<void> {
    const port = new SerialPort({ path, baudRate, autoOpen: false })
    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()))
    })
    this.serialPort = port
    this.writable = port
    const reader = port.pipe(new MavLinkPacketSplitter()).pipe(new MavLinkPacketParser())
    reader.on('data', (packet: MavLinkPacket) => this.handlePacket(packet))
    // Ignore events from a previous connection: their delayed 'close' would otherwise clobber the new link's state.
    port.on('close', () => {
      if (this.serialPort === port) this.disconnect()
    })
    port.on('error', (err) => {
      if (this.serialPort === port) this.setConnectionState({ status: 'error', error: err.message })
    })
  }

  private async connectTcp(host: string, port: number): Promise<void> {
    const socket = new net.Socket()
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject)
      socket.connect(port, host, () => {
        socket.removeListener('error', reject)
        resolve()
      })
    })
    this.tcpSocket = socket
    this.writable = socket
    const reader = socket.pipe(new MavLinkPacketSplitter()).pipe(new MavLinkPacketParser())
    reader.on('data', (packet: MavLinkPacket) => this.handlePacket(packet))
    socket.on('close', () => {
      if (this.tcpSocket === socket) this.disconnect()
    })
    socket.on('error', (err) => {
      if (this.tcpSocket === socket) this.setConnectionState({ status: 'error', error: err.message })
    })
  }

  private async connectUdp(bindPort: number, remoteHost?: string, remotePort?: number): Promise<void> {
    const socket = dgram.createSocket('udp4')
    this.udpSocket = socket
    if (remoteHost && remotePort) {
      this.udpTarget = { host: remoteHost, port: remotePort }
    }
    const writable = new UdpWritable(socket, () => this.udpTarget)
    this.writable = writable

    const splitter = new MavLinkPacketSplitter()
    const parser = splitter.pipe(new MavLinkPacketParser())
    parser.on('data', (packet: MavLinkPacket) => this.handlePacket(packet))

    socket.on('message', (msg, rinfo) => {
      if (!this.udpTarget) {
        this.udpTarget = { host: rinfo.address, port: rinfo.port }
      }
      splitter.write(msg)
    })
    socket.on('error', (err) => {
      if (this.udpSocket === socket) this.setConnectionState({ status: 'error', error: err.message })
    })

    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject)
      socket.bind(bindPort, () => {
        socket.removeListener('error', reject)
        resolve()
      })
    })
  }

  private requestDataStreams(): void {
    // ArduPilot does not stream telemetry to a GCS unless asked. Request the
    // groups a HUD/param view needs; send twice a second apart in case the
    // first request lands before the vehicle has finished booting.
    const streams = [
      common.MavDataStream.RAW_SENSORS,
      common.MavDataStream.EXTENDED_STATUS,
      common.MavDataStream.RC_CHANNELS,
      common.MavDataStream.POSITION,
      common.MavDataStream.EXTRA1,
      common.MavDataStream.EXTRA2,
      common.MavDataStream.EXTRA3
    ]
    const request = (): void => {
      for (const streamId of streams) {
        const msg = new common.RequestDataStream()
        msg.targetSystem = this.targetSystemId
        msg.targetComponent = this.targetComponentId
        msg.reqStreamId = streamId
        msg.reqMessageRate = 4
        msg.startStop = 1
        void this.sendMessage(msg)
      }
    }
    request()
    setTimeout(request, 2000)
  }

  private startHeartbeat(): void {
    const beat = (): void => {
      const hb = new minimal.Heartbeat()
      hb.type = minimal.MavType.GCS
      hb.autopilot = minimal.MavAutopilot.INVALID
      hb.baseMode = 0 as minimal.MavModeFlag
      hb.customMode = 0
      hb.systemStatus = minimal.MavState.ACTIVE
      hb.mavlinkVersion = 3
      void this.sendMessage(hb)
    }
    beat()
    this.heartbeatTimer = setInterval(beat, 1000)
  }

  private async sendMessage(msg: MavLinkData): Promise<void> {
    if (!this.writable) return
    try {
      await send(this.writable as any, msg, new MavLinkProtocolV2(this.systemId, this.componentId))
      this.emit('log', {
        timestamp: Date.now(),
        direction: 'out',
        msgId: (msg.constructor as typeof MavLinkData).MSG_ID,
        msgName: (msg.constructor as typeof MavLinkData).MSG_NAME,
        summary: summarize(msg)
      })
    } catch {
      // best-effort; connection loss will surface via socket/port error events
    }
  }

  private handlePacket(packet: MavLinkPacket): void {
    const clazz = REGISTRY[packet.header.msgid]
    if (!clazz) return
    const data = packet.protocol.data(packet.payload, clazz)
    this.mission.handle(data)

    this.emit('log', {
      timestamp: Date.now(),
      direction: 'in',
      msgId: packet.header.msgid,
      msgName: clazz.MSG_NAME,
      summary: summarize(data)
    })

    if (data instanceof minimal.Heartbeat) {
      this.targetSystemId = packet.header.sysid
      this.targetComponentId = packet.header.compid
      const armed = (data.baseMode & MAV_MODE_FLAG_SAFETY_ARMED) !== 0
      const heartbeat: HeartbeatData = {
        type: data.type,
        autopilot: data.autopilot,
        baseMode: data.baseMode,
        customMode: data.customMode,
        systemStatus: data.systemStatus
      }
      this.updateTelemetry({
        heartbeat,
        armed,
        flightMode: COPTER_MODES[data.customMode] ?? `MODE(${data.customMode})`,
        lastHeartbeatAt: Date.now()
      })
    } else if (data instanceof common.Attitude) {
      const attitude: AttitudeData = {
        roll: data.roll,
        pitch: data.pitch,
        yaw: data.yaw,
        rollspeed: data.rollspeed,
        pitchspeed: data.pitchspeed,
        yawspeed: data.yawspeed
      }
      this.updateTelemetry({ attitude })
    } else if (data instanceof common.VfrHud) {
      const vfrHud: VfrHudData = {
        airspeed: data.airspeed,
        groundspeed: data.groundspeed,
        heading: data.heading,
        throttle: data.throttle,
        alt: data.alt,
        climb: data.climb
      }
      this.updateTelemetry({ vfrHud })
    } else if (data instanceof common.GlobalPositionInt) {
      const globalPosition: GlobalPositionData = {
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000,
        relativeAlt: data.relativeAlt / 1000,
        vx: data.vx / 100,
        vy: data.vy / 100,
        vz: data.vz / 100,
        hdg: data.hdg === 65535 ? NaN : data.hdg / 100
      }
      this.updateTelemetry({ globalPosition })
    } else if (data instanceof common.GpsRawInt) {
      const gpsRaw: GpsRawData = {
        fixType: data.fixType,
        satellitesVisible: data.satellitesVisible,
        eph: data.eph,
        epv: data.epv,
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000
      }
      this.updateTelemetry({ gpsRaw })
    } else if (data instanceof common.SysStatus) {
      const battery: BatteryData = {
        voltageBattery: data.voltageBattery / 1000,
        currentBattery: data.currentBattery / 100,
        batteryRemaining: data.batteryRemaining
      }
      const sensors: SensorStatus = {
        present: data.onboardControlSensorsPresent >>> 0,
        enabled: data.onboardControlSensorsEnabled >>> 0,
        health: data.onboardControlSensorsHealth >>> 0,
        cpuLoad: data.load / 10,
        commDropPercent: data.dropRateComm / 100
      }
      this.updateTelemetry({ battery, sensors })
    } else if (data instanceof ardupilotmega.EkfStatusReport) {
      this.updateTelemetry({
        ekf: {
          flags: data.flags as number,
          velocityVariance: data.velocityVariance,
          posHorizVariance: data.posHorizVariance,
          posVertVariance: data.posVertVariance,
          compassVariance: data.compassVariance,
          terrainAltVariance: data.terrainAltVariance
        }
      })
    } else if (data instanceof common.Vibration) {
      this.updateTelemetry({
        vibration: {
          x: data.vibrationX,
          y: data.vibrationY,
          z: data.vibrationZ,
          clipping: [data.clipping0, data.clipping1, data.clipping2]
        }
      })
    } else if (data instanceof common.PowerStatus) {
      this.updateTelemetry({ power: { vcc: data.Vcc / 1000, vservo: data.Vservo / 1000 } })
    } else if (data instanceof common.RcChannels) {
      const raw = data as unknown as Record<string, number>
      const count = Math.min(data.chancount || 18, 18)
      const channels: number[] = []
      for (let i = 1; i <= 18; i++) {
        const v = raw[`chan${i}Raw`]
        channels.push(i <= count && v !== 65535 ? v : 0)
      }
      const rc: RcChannelsData = { channels, rssi: data.rssi }
      this.updateTelemetry({ rc })
    } else if (data instanceof common.NavControllerOutput) {
      this.updateTelemetry({ navTarget: { roll: data.navRoll, pitch: data.navPitch } })
    } else if (data instanceof ardupilotmega.PidTuning) {
      const pid = { ...this.telemetry.pid }
      pid[data.axis] = { desired: data.desired, achieved: data.achieved, ff: data.FF, p: data.P, i: data.I, d: data.D, timestamp: Date.now() }
      this.updateTelemetry({ pid })
    } else if (data instanceof common.ServoOutputRaw) {
      const raw = data as unknown as Record<string, number>
      const servoOutputs: number[] = []
      for (let i = 1; i <= 16; i++) servoOutputs.push(raw[`servo${i}Raw`] ?? 0)
      this.updateTelemetry({ servoOutputs })
    } else if (data instanceof common.AttitudeTarget) {
      const [w, x, y, z] = data.q
      this.updateTelemetry({
        attitudeTarget: {
          roll: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
          pitch: Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))),
          yaw: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
          rollRate: data.bodyRollRate,
          pitchRate: data.bodyPitchRate,
          yawRate: data.bodyYawRate
        }
      })
    } else if (data instanceof common.CommandLong && (data.command as number) === CMD_ACCELCAL_VEHICLE_POS) {
      this.emit('setup-event', { type: 'accelPosition', position: data._param1 })
    } else if (data instanceof ardupilotmega.MagCalProgress) {
      this.emit('setup-event', {
        type: 'magProgress',
        compassId: data.compassId,
        status: data.calStatus,
        attempt: data.attempt,
        percent: data.completionPct,
        mask: Array.from(data.completionMask)
      })
    } else if (data instanceof common.MagCalReport) {
      this.emit('setup-event', {
        type: 'magReport',
        compassId: data.compassId,
        status: data.calStatus,
        fitness: data.fitness,
        autosaved: data.autosaved !== 0,
        offsets: [data.ofsX, data.ofsY, data.ofsZ]
      })
    } else if (data instanceof common.ParamValue) {
      this.handleParamValue(data)
    } else if (data instanceof common.DistanceSensor) {
      this.handleDistanceSensor(data)
    } else if (data instanceof common.ObstacleDistance) {
      this.handleObstacleDistance(data)
    } else if (data instanceof common.AdsbVehicle) {
      this.handleAdsbVehicle(data)
    } else if (data instanceof common.MissionCurrent) {
      this.updateTelemetry({ missionCurrent: data.seq })
    } else if (data instanceof common.StatusText) {
      this.emit('status-message', {
        timestamp: Date.now(),
        severity: data.severity,
        text: data.text.replace(/\0+$/, '').trim(),
        source: 'vehicle'
      })
    } else if (data instanceof common.CommandAck) {
      // Accepted acks are noise (the state change shows in the top bar); surface everything else.
      // Message-rate requests are best effort (a vehicle may simply not have that message), so their failures aren't worth showing.
      const bestEffort = (data.command as number) === CMD_SET_MESSAGE_INTERVAL
      if (!bestEffort && data.result !== common.MavResult.ACCEPTED && data.result !== common.MavResult.IN_PROGRESS) {
        const name = common.MavCmd[data.command] ?? `command ${data.command}`
        const result = common.MavResult[data.result] ?? data.result
        this.emitGcsMessage(`${name} ${String(result).toLowerCase().replace(/_/g, ' ')} by vehicle`, 4)
      }
    }
  }

  // Turns the online feed on or off. The feed needs the vehicle's position, so it idles until there is one.
  setOnlineTraffic(enabled: boolean): void {
    if (enabled) this.onlineFeed.start()
    else {
      this.onlineFeed.stop()
      this.onlineTraffic = { aircraft: [] }
      this.onlineUpdatedAt = undefined
    }
    this.emitTraffic()
  }

  private handleAdsbVehicle(data: common.AdsbVehicle): void {
    const flags = data.flags as number
    if (!(flags & common.AdsbFlags.VALID_COORDS)) return
    const now = Date.now()
    const id = data.ICAOAddress.toString(16).padStart(6, '0')
    const speed = flags & common.AdsbFlags.VALID_VELOCITY ? data.horVelocity / 100 : undefined
    this.vehicleTraffic.set(id, {
      id,
      callsign: flags & common.AdsbFlags.VALID_CALLSIGN ? data.callsign.replace(/ +$/, '').trim() : '',
      type: EMITTER_TYPES[data.emitterType as number] ?? '',
      lat: data.lat / 1e7,
      lon: data.lon / 1e7,
      altitude: flags & common.AdsbFlags.VALID_ALTITUDE ? data.altitude / 1000 : undefined,
      onGround: data.emitterType >= 17 && data.emitterType <= 18,
      heading: flags & common.AdsbFlags.VALID_HEADING ? data.heading / 100 : undefined,
      speed,
      climb: flags & common.AdsbFlags.VERTICAL_VELOCITY_VALID ? data.verVelocity / 100 : undefined,
      source: 'vehicle',
      lastSeen: now - data.tslc * 1000
    })
    this.emitTraffic()
  }

  private trafficState(): TrafficData {
    const now = Date.now()
    for (const [id, a] of this.vehicleTraffic) if (now - a.lastSeen > TRAFFIC_STALE_MS) this.vehicleTraffic.delete(id)
    // The vehicle's own receiver wins when both sources know the same aircraft.
    const aircraft = [...this.vehicleTraffic.values()]
    for (const a of this.onlineTraffic.aircraft) if (!this.vehicleTraffic.has(a.id)) aircraft.push(a)
    return { aircraft, online: { enabled: this.onlineFeed.running, error: this.onlineTraffic.error, updatedAt: this.onlineUpdatedAt } }
  }

  private emitTraffic(): void {
    this.updateTelemetry({ traffic: this.trafficState() })
  }

  private handleDistanceSensor(data: common.DistanceSensor): void {
    const now = Date.now()
    let yawDeg: number | undefined
    if (data.orientation === 100 && data.quaternion?.length === 4) {
      const [w, x, y, z] = data.quaternion
      yawDeg = (Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180) / Math.PI
    }
    this.proximitySensors.set(`${data.id}:${data.orientation}`, {
      id: data.id,
      orientation: data.orientation,
      distance: data.currentDistance / 100,
      min: data.minDistance / 100,
      max: data.maxDistance / 100,
      fovDeg: data.horizontalFov > 0 && data.horizontalFov < 360 ? (data.horizontalFov * 180) / Math.PI : 0,
      yawDeg,
      timestamp: now
    })
    for (const [key, s] of this.proximitySensors) if (now - s.timestamp > 5000) this.proximitySensors.delete(key)
    this.emitProximity()
  }

  private handleObstacleDistance(data: common.ObstacleDistance): void {
    const min = data.minDistance / 100
    const max = data.maxDistance / 100
    // UINT16_MAX means unknown; anything outside [min, max] is "nothing detected" for drawing purposes.
    const distances = data.distances.map((cm) => {
      const d = cm / 100
      return cm === 65535 || d < min || d > max ? NaN : d
    })
    this.proximityScan = {
      distances,
      increment: data.incrementF > 0 ? data.incrementF : data.increment,
      angleOffset: data.angleOffset || 0,
      min,
      max,
      frame: data.frame,
      timestamp: Date.now()
    }
    this.emitProximity()
  }

  private emitProximity(): void {
    this.updateTelemetry({ proximity: { sensors: [...this.proximitySensors.values()], scan: this.proximityScan } })
  }

  private handleParamValue(data: common.ParamValue): void {
    this.paramTotal = data.paramCount
    const entry: ParamEntry = {
      id: data.paramId.replace(/\0+$/, ''),
      value: data.paramValue,
      type: data.paramType,
      index: data.paramIndex
    }
    this.params.set(entry.id, entry)
    this.emit('param-update', entry)
    this.emit('param-progress', { received: this.params.size, total: this.paramTotal })
  }

  private updateTelemetry(patch: Partial<TelemetryState>): void {
    this.telemetry = { ...this.telemetry, ...patch }
    if (this.telemetryTimer) return
    // Coalesce bursts: the UI gets at most ~30 updates a second, always carrying the latest state.
    this.telemetryTimer = setTimeout(() => {
      this.telemetryTimer = null
      this.emit('telemetry', this.telemetry)
    }, TELEMETRY_EMIT_MS)
  }
}

function summarize(msg: MavLinkData): string {
  const fields = Object.entries(msg as unknown as Record<string, unknown>)
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, 4)
    .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed?.(3) ?? v : v}`)
  return fields.join(' ')
}

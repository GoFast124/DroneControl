import { EventEmitter } from 'node:events'
import { common, MavLinkData } from 'node-mavlink'
import { FRAME_ABSOLUTE, isMappable, normalizeFrame } from '../../shared/mission'
import type { MissionItem } from '../../shared/mission'
import type { MissionProgress } from '../../shared/types'

type Send = (msg: MavLinkData) => Promise<void>
type Target = () => { system: number; component: number }

interface Waiter {
  match: (d: MavLinkData) => boolean
  resolve: (d: MavLinkData) => void
}

const MISSION_TYPE_MISSION = common.MavMissionType.MISSION

// Implements the MAVLink mission microservice (download / upload / clear) with timeouts and retries.
export class MissionClient extends EventEmitter {
  private waiter: Waiter | null = null
  private busy = false

  constructor(
    private readonly send: Send,
    private readonly target: Target
  ) {
    super()
  }

  // Feed every incoming message here; returns true if a pending request consumed it.
  handle(data: MavLinkData): boolean {
    if (this.waiter?.match(data)) {
      this.waiter.resolve(data)
      return true
    }
    return false
  }

  async download(): Promise<{ home: MissionItem | null; items: MissionItem[] }> {
    return this.exclusive(async () => {
      const t = this.target()
      const list = new common.MissionRequestList()
      list.targetSystem = t.system
      list.targetComponent = t.component
      list.missionType = MISSION_TYPE_MISSION
      const count = (await this.request(() => this.send(list), (d) => d instanceof common.MissionCount, 2000, 3)) as common.MissionCount

      const all: MissionItem[] = []
      for (let seq = 0; seq < count.count; seq++) {
        const req = new common.MissionRequestInt()
        req.targetSystem = t.system
        req.targetComponent = t.component
        req.seq = seq
        req.missionType = MISSION_TYPE_MISSION
        const item = (await this.request(
          () => this.send(req),
          (d) => d instanceof common.MissionItemInt && d.seq === seq,
          2000,
          4
        )) as common.MissionItemInt
        all.push({
          command: item.command,
          frame: normalizeFrame(item.frame),
          param1: item.param1,
          param2: item.param2,
          param3: item.param3,
          param4: item.param4,
          lat: item.x / 1e7,
          lon: item.y / 1e7,
          alt: item.z
        })
        this.progress('download', seq + 1, count.count)
      }

      const ack = new common.MissionAck()
      ack.targetSystem = t.system
      ack.targetComponent = t.component
      ack.type = common.MavMissionResult.ACCEPTED
      ack.missionType = MISSION_TYPE_MISSION
      await this.send(ack)

      return { home: all[0] ?? null, items: all.slice(1) }
    })
  }

  async upload(items: MissionItem[], home: MissionItem | null): Promise<void> {
    return this.exclusive(async () => {
      const t = this.target()
      // Item 0 is the home position on ArduPilot; the vehicle keeps its own home and ignores this one.
      const firstPos = items.find(isMappable)
      const homeItem: MissionItem = home ?? {
        command: 16,
        frame: FRAME_ABSOLUTE,
        param1: 0,
        param2: 0,
        param3: 0,
        param4: 0,
        lat: firstPos?.lat ?? 0,
        lon: firstPos?.lon ?? 0,
        alt: 0
      }
      const all = [homeItem, ...items]

      const count = new common.MissionCount()
      count.targetSystem = t.system
      count.targetComponent = t.component
      count.count = all.length
      count.missionType = MISSION_TYPE_MISSION

      const isReply = (d: MavLinkData): boolean =>
        d instanceof common.MissionRequestInt || d instanceof common.MissionRequest || d instanceof common.MissionAck

      let action: () => Promise<void> = () => this.send(count)
      for (;;) {
        const reply = await this.request(action, isReply, 3000, 3)
        if (reply instanceof common.MissionAck) {
          if (reply.type === common.MavMissionResult.ACCEPTED) {
            this.progress('upload', all.length, all.length)
            return
          }
          throw new Error(`Vehicle rejected the mission: ${common.MavMissionResult[reply.type] ?? reply.type}`)
        }
        const seq = (reply as common.MissionRequestInt | common.MissionRequest).seq
        if (seq >= all.length) throw new Error(`Vehicle requested item ${seq} but mission has ${all.length}`)
        this.progress('upload', seq, all.length)
        action = () => this.send(this.toItemInt(all[seq], seq, t))
      }
    })
  }

  async clear(): Promise<void> {
    return this.exclusive(async () => {
      const t = this.target()
      const msg = new common.MissionClearAll()
      msg.targetSystem = t.system
      msg.targetComponent = t.component
      msg.missionType = MISSION_TYPE_MISSION
      const ack = (await this.request(() => this.send(msg), (d) => d instanceof common.MissionAck, 3000, 2)) as common.MissionAck
      if (ack.type !== common.MavMissionResult.ACCEPTED) {
        throw new Error(`Vehicle refused to clear the mission: ${common.MavMissionResult[ack.type] ?? ack.type}`)
      }
    })
  }

  async setCurrent(seq: number): Promise<void> {
    const t = this.target()
    const msg = new common.MissionSetCurrent()
    msg.targetSystem = t.system
    msg.targetComponent = t.component
    msg.seq = seq
    await this.send(msg)
  }

  private toItemInt(item: MissionItem, seq: number, t: ReturnType<Target>): common.MissionItemInt {
    const msg = new common.MissionItemInt()
    msg.targetSystem = t.system
    msg.targetComponent = t.component
    msg.seq = seq
    msg.frame = item.frame
    msg.command = item.command
    msg.current = 0
    msg.autocontinue = 1
    msg.param1 = item.param1
    msg.param2 = item.param2
    msg.param3 = item.param3
    msg.param4 = item.param4
    msg.x = Math.round(item.lat * 1e7)
    msg.y = Math.round(item.lon * 1e7)
    msg.z = item.alt
    msg.missionType = MISSION_TYPE_MISSION
    return msg
  }

  private progress(op: MissionProgress['op'], done: number, total: number): void {
    this.emit('progress', { op, done, total } satisfies MissionProgress)
  }

  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('Another mission operation is already in progress')
    this.busy = true
    try {
      return await fn()
    } finally {
      this.busy = false
      this.waiter = null
    }
  }

  private async request(
    send: () => Promise<void>,
    match: (d: MavLinkData) => boolean,
    timeoutMs: number,
    retries: number
  ): Promise<MavLinkData> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const reply = new Promise<MavLinkData | null>((resolve) => {
        const timer = setTimeout(() => {
          this.waiter = null
          resolve(null)
        }, timeoutMs)
        this.waiter = {
          match,
          resolve: (d) => {
            clearTimeout(timer)
            this.waiter = null
            resolve(d)
          }
        }
      })
      await send()
      const d = await reply
      if (d) return d
    }
    throw new Error('Vehicle did not respond (mission protocol timed out)')
  }
}

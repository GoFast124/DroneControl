import type { Aircraft } from '../../shared/types'

// Optional feed of nearby ADS-B traffic from adsb.lol (free, no key). It is opt-in because it sends the vehicle's
// approximate position to that service. The position is rounded to ~1 km and the search radius widened to compensate.
const ENDPOINT = 'https://api.adsb.lol/v2/point'
const NM_PER_KM = 1 / 1.852
const MAX_RADIUS_NM = 250 // the service's limit
const TIMEOUT_MS = 8000
// The service rejects generic user agents and asks clients to identify themselves.
const USER_AGENT = 'DroneControl/0.1 (+https://github.com/GoFast124/DroneControl)'
const FT_TO_M = 0.3048
const KT_TO_MS = 0.514444
const FPM_TO_MS = 0.00508

export interface FeedResult {
  aircraft: Aircraft[]
  error?: string
}

interface RawAircraft {
  hex?: string
  flight?: string
  t?: string
  lat?: number
  lon?: number
  alt_baro?: number | 'ground'
  alt_geom?: number
  gs?: number
  track?: number
  baro_rate?: number
  geom_rate?: number
  seen_pos?: number
}

export function parseAircraft(raw: RawAircraft, now: number): Aircraft | null {
  if (!raw.hex || typeof raw.lat !== 'number' || typeof raw.lon !== 'number') return null
  const onGround = raw.alt_baro === 'ground'
  const altFt = typeof raw.alt_baro === 'number' ? raw.alt_baro : raw.alt_geom
  const rate = raw.baro_rate ?? raw.geom_rate
  return {
    id: raw.hex.replace(/^~/, '').toLowerCase(),
    callsign: (raw.flight ?? '').trim(),
    type: raw.t ?? '',
    lat: raw.lat,
    lon: raw.lon,
    altitude: typeof altFt === 'number' ? altFt * FT_TO_M : undefined,
    onGround,
    heading: typeof raw.track === 'number' ? raw.track : undefined,
    speed: typeof raw.gs === 'number' ? raw.gs * KT_TO_MS : undefined,
    climb: typeof rate === 'number' ? rate * FPM_TO_MS : undefined,
    source: 'online',
    lastSeen: now - (raw.seen_pos ?? 0) * 1000
  }
}

export class OnlineTrafficFeed {
  private timer: NodeJS.Timeout | null = null
  private radiusNm = 7
  private pollMs = 5000
  private pausedUntil = 0
  private kick: NodeJS.Timeout | null = null
  private inFlight: AbortController | null = null

  constructor(
    private readonly getPosition: () => { lat: number; lon: number } | undefined,
    private readonly onResult: (result: FeedResult) => void
  ) {}

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.poll(), this.pollMs)
    void this.poll()
  }

  // Ask for aircraft out to `km` from the vehicle (plus a margin for the rounded position).
  // Wider searches return more data, so they are polled less often.
  setRangeKm(km: number): void {
    this.radiusNm = Math.max(2, Math.min(MAX_RADIUS_NM, Math.ceil(km * NM_PER_KM) + 1))
    this.pollMs = km > 20 ? 10_000 : 5000
    if (!this.timer) return
    this.inFlight?.abort()
    this.inFlight = null
    clearInterval(this.timer)
    this.timer = setInterval(() => void this.poll(), this.pollMs)
    this.pollSoon()
  }

  // Fetch shortly, once, however many times this is asked for in quick succession (flicking through the range options,
  // or the search centre changing), instead of one request per change.
  pollSoon(): void {
    if (!this.timer) return
    if (this.kick) clearTimeout(this.kick)
    this.kick = setTimeout(() => {
      this.kick = null
      void this.poll()
    }, 1500)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.kick) clearTimeout(this.kick)
    this.kick = null
    this.inFlight?.abort()
    this.inFlight = null
  }

  private async poll(): Promise<void> {
    if (this.inFlight || Date.now() < this.pausedUntil) return
    const pos = this.getPosition()
    if (!pos || (pos.lat === 0 && pos.lon === 0)) {
      this.onResult({ aircraft: [], error: 'Waiting for a GPS position' })
      return
    }
    const controller = new AbortController()
    this.inFlight = controller
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const url = `${ENDPOINT}/${pos.lat.toFixed(2)}/${pos.lon.toFixed(2)}/${this.radiusNm}`
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } })
      if (res.status === 429) {
        this.pausedUntil = Date.now() + 20_000 // back off rather than keep hitting a service that has asked us to slow down
        throw new Error('the service is rate limiting requests, will retry')
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { ac?: RawAircraft[] }
      const now = Date.now()
      const aircraft = (body.ac ?? []).map((a) => parseAircraft(a, now)).filter((a): a is Aircraft => a !== null)
      if (this.inFlight === controller) this.onResult({ aircraft })
    } catch (err) {
      if (this.inFlight === controller && this.timer) {
        this.onResult({ aircraft: [], error: `Online feed unavailable (${err instanceof Error ? err.message : String(err)})` })
      }
    } finally {
      clearTimeout(timeout)
      if (this.inFlight === controller) this.inFlight = null
    }
  }
}

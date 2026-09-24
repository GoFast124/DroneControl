import type { Aircraft } from '../../shared/types'

// Optional feed of nearby ADS-B traffic from adsb.lol (free, no key). It is opt-in because it sends the vehicle's
// approximate position to that service. The position is rounded to ~1 km and the search radius widened to compensate.
const ENDPOINT = 'https://api.adsb.lol/v2/point'
const RADIUS_NM = 7
const POLL_MS = 5000
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
    this.timer = setInterval(() => void this.poll(), POLL_MS)
    void this.poll()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.inFlight?.abort()
    this.inFlight = null
  }

  private async poll(): Promise<void> {
    if (this.inFlight) return
    const pos = this.getPosition()
    if (!pos || (pos.lat === 0 && pos.lon === 0)) {
      this.onResult({ aircraft: [], error: 'Waiting for a GPS position' })
      return
    }
    const controller = new AbortController()
    this.inFlight = controller
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const url = `${ENDPOINT}/${pos.lat.toFixed(2)}/${pos.lon.toFixed(2)}/${RADIUS_NM}`
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } })
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

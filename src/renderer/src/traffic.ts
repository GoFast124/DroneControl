import { distanceMeters } from '../../shared/mission'
import type { Aircraft, TelemetryState } from '../../shared/types'

export const TRAFFIC_RANGE_M = 10_000

export type Threat = 'none' | 'caution' | 'alert'

export interface NearbyAircraft extends Aircraft {
  distance: number // horizontal, metres
  bearing: number // degrees true from the vehicle to the aircraft
  relAlt?: number // metres above (+) or below (-) the vehicle, when both altitudes are known
  threat: Threat
}

export const THREAT_COLORS: Record<Threat, string> = {
  none: '#ffffff',
  caution: '#f5b942',
  alert: '#ef5757'
}

function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180
  const dLon = (bLon - aLon) * rad
  const y = Math.sin(dLon) * Math.cos(bLat * rad)
  const x = Math.cos(aLat * rad) * Math.sin(bLat * rad) - Math.sin(aLat * rad) * Math.cos(bLat * rad) * Math.cos(dLon)
  return ((Math.atan2(y, x) / rad) + 360) % 360
}

// Rough separation check. Reported altitudes are barometric or GNSS and only good to a few tens of metres, so the
// vertical thresholds are generous; with no altitude for either aircraft only the horizontal distance counts.
function threatLevel(distance: number, relAlt: number | undefined): Threat {
  const vertical = relAlt === undefined ? 0 : Math.abs(relAlt)
  if (distance < 2000 && vertical < 300) return 'alert'
  if (distance < 5000 && vertical < 600) return 'caution'
  return 'none'
}

export interface TrafficView {
  nearby: NearbyAircraft[] // airborne aircraft within range, nearest first
  onGround: number // aircraft in range that are on the ground (not listed)
}

export function nearbyTraffic(t: TelemetryState, rangeM = TRAFFIC_RANGE_M): TrafficView {
  const pos = t.globalPosition
  const list = t.traffic?.aircraft
  if (!pos || (pos.lat === 0 && pos.lon === 0) || !list) return { nearby: [], onGround: 0 }
  const nearby: NearbyAircraft[] = []
  let onGround = 0
  for (const a of list) {
    const distance = distanceMeters(pos.lat, pos.lon, a.lat, a.lon)
    if (distance > rangeM) continue
    if (a.onGround) {
      onGround++
      continue
    }
    const relAlt = a.altitude === undefined ? undefined : a.altitude - pos.alt
    nearby.push({ ...a, distance, bearing: bearingDeg(pos.lat, pos.lon, a.lat, a.lon), relAlt, threat: threatLevel(distance, relAlt) })
  }
  nearby.sort((a, b) => a.distance - b.distance)
  return { nearby, onGround }
}

export function aircraftName(a: Aircraft): string {
  return a.callsign || a.id.toUpperCase()
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}

export function formatRelAlt(relAlt: number | undefined): string {
  if (relAlt === undefined) return 'alt ?'
  const r = Math.round(relAlt / 10) * 10
  return `${r >= 0 ? '+' : '−'}${Math.abs(r)} m`
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export function compassPoint(bearing: number): string {
  return COMPASS[Math.round(bearing / 45) % 8]
}

export const ONLINE_TRAFFIC_KEY = 'onlineTraffic'

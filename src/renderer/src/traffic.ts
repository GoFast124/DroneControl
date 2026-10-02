import { useSyncExternalStore } from 'react'
import { distanceMeters } from '../../shared/mission'
import type { Aircraft } from '../../shared/types'

export const TRAFFIC_RANGES_KM = [5, 10, 20, 50, 100]
const RANGE_KEY = 'trafficRangeKm'
const DEFAULT_RANGE_KM = 10

function loadRangeKm(): number {
  try {
    const stored = Number(localStorage.getItem(RANGE_KEY))
    if (TRAFFIC_RANGES_KM.includes(stored)) return stored
  } catch {
    // fall through to the default
  }
  return DEFAULT_RANGE_KM
}

// How far out to show aircraft. Shared by the card, the map and the alerts, remembered between sessions, and passed
// to the online feed so it asks for the same area.
let rangeKm = loadRangeKm()
const rangeListeners = new Set<() => void>()

export function getTrafficRangeKm(): number {
  return rangeKm
}

export function setTrafficRangeKm(km: number): void {
  if (!TRAFFIC_RANGES_KM.includes(km) || km === rangeKm) return
  rangeKm = km
  try {
    localStorage.setItem(RANGE_KEY, String(km))
  } catch {
    // preference just won't persist
  }
  void window.api.setTrafficRange(km)
  for (const l of rangeListeners) l()
}

export function useTrafficRangeKm(): number {
  return useSyncExternalStore(
    (listener) => {
      rangeListeners.add(listener)
      return () => rangeListeners.delete(listener)
    },
    () => rangeKm
  )
}

export type Threat = 'none' | 'caution' | 'alert'

// Where traffic is measured from: the vehicle once it has a GPS position, otherwise the base station (the computer
// running the app), so traffic can be checked before the aircraft's GPS is powered up.
export interface TrafficCentre {
  lat: number
  lon: number
  alt?: number // metres MSL; only known for the vehicle
  source: 'vehicle' | 'station'
}

export interface NearbyAircraft extends Aircraft {
  distance: number // horizontal, metres
  bearing: number // degrees true from the vehicle to the aircraft
  relAlt?: number // metres above (+) or below (-) the vehicle, when both altitudes are known (not when measuring from the base station)
  threat: Threat
}

// The same levels for text on the dashboard card, where white would vanish on a light theme.
export const THREAT_TEXT_COLORS: Record<Threat, string> = {
  none: 'var(--text-1)',
  caution: 'var(--warn)',
  alert: 'var(--bad)'
}

// For marking aircraft on the map, which is always satellite imagery.
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
// Measured from the base station there is no height to compare, so it can only ever be a caution, never an alert.
function threatLevel(distance: number, relAlt: number | undefined, canAlert: boolean): Threat {
  const vertical = relAlt === undefined ? 0 : Math.abs(relAlt)
  if (canAlert && distance < 2000 && vertical < 300) return 'alert'
  if (distance < 5000 && vertical < 600) return 'caution'
  return 'none'
}

export interface TrafficView {
  nearby: NearbyAircraft[] // airborne aircraft within range, nearest first
  onGround: number // aircraft in range that are on the ground (not listed)
}

export function nearbyTraffic(list: Aircraft[] | undefined, pos: TrafficCentre | null, rangeM: number): TrafficView {
  if (!pos || !list) return { nearby: [], onGround: 0 }
  const nearby: NearbyAircraft[] = []
  let onGround = 0
  for (const a of list) {
    const distance = distanceMeters(pos.lat, pos.lon, a.lat, a.lon)
    if (distance > rangeM) continue
    if (a.onGround) {
      onGround++
      continue
    }
    const relAlt = a.altitude === undefined || pos.alt === undefined ? undefined : a.altitude - pos.alt
    const threat = threatLevel(distance, relAlt, pos.source === 'vehicle')
    nearby.push({ ...a, distance, bearing: bearingDeg(pos.lat, pos.lon, a.lat, a.lon), relAlt, threat })
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

// Height of an aircraft for display: relative to the vehicle when that is known, otherwise its own reported altitude.
export function formatHeight(a: NearbyAircraft): string {
  if (a.relAlt !== undefined) return formatRelAlt(a.relAlt)
  if (a.altitude !== undefined) return `${Math.round(a.altitude / 10) * 10} m MSL`
  return 'alt ?'
}

export function shortHeight(a: NearbyAircraft): string {
  if (a.relAlt !== undefined) return formatRelAlt(a.relAlt).replace(' m', '')
  return a.altitude !== undefined ? `${Math.round(a.altitude / 10) * 10}m` : ''
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

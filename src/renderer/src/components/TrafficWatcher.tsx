import { useEffect, useRef } from 'react'
import { getTelemetry, pushMessage, subscribeToStore } from '../store'
import { useTrafficCentre } from '../trafficCentre'
import { ONLINE_TRAFFIC_KEY, aircraftName, compassPoint, formatDistance, formatHeight, getTrafficRangeKm, nearbyTraffic } from '../traffic'

const ALERT_REPEAT_MS = 60_000

// Background housekeeping for the traffic overlay; renders nothing. Restores the online-feed preference on startup
// and posts a message to the vehicle-messages panel when an aircraft comes close.
export default function TrafficWatcher(): null {
  const centre = useTrafficCentre()
  const centreRef = useRef(centre)
  centreRef.current = centre

  // Tell the main process where the base station is, so the online feed can search around it while the vehicle has no
  // GPS position of its own. The vehicle's position takes over by itself once it has one.
  const stationLat = centre?.source === 'station' ? centre.lat : null
  const stationLon = centre?.source === 'station' ? centre.lon : null
  useEffect(() => {
    void window.api.setTrafficStation(stationLat !== null && stationLon !== null ? { lat: stationLat, lon: stationLon } : null)
  }, [stationLat, stationLon])

  useEffect(() => {
    void window.api.setTrafficRange(getTrafficRangeKm())
    try {
      if (localStorage.getItem(ONLINE_TRAFFIC_KEY) === 'true') void window.api.setOnlineTraffic(true)
    } catch {
      // storage unavailable: the feed simply starts off
    }

    const lastAlert = new Map<string, number>()
    return subscribeToStore(() => {
      const now = Date.now()
      // Alerts are about the vehicle's own airspace, so they are not raised for the base station position.
      const current = centreRef.current
      if (current?.source !== 'vehicle') return
      for (const a of nearbyTraffic(getTelemetry().traffic?.aircraft, current, getTrafficRangeKm() * 1000).nearby) {
        if (a.threat !== 'alert') continue
        if (now - (lastAlert.get(a.id) ?? 0) < ALERT_REPEAT_MS) continue
        lastAlert.set(a.id, now)
        pushMessage(`Traffic: ${aircraftName(a)} ${formatDistance(a.distance)} ${compassPoint(a.bearing)}, ${formatHeight(a)}`, 4)
      }
    })
  }, [])
  return null
}

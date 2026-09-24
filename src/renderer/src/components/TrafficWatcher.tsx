import { useEffect } from 'react'
import { getTelemetry, pushMessage, subscribeToStore } from '../store'
import { ONLINE_TRAFFIC_KEY, aircraftName, compassPoint, formatDistance, formatRelAlt, nearbyTraffic } from '../traffic'

const ALERT_REPEAT_MS = 60_000

// Background housekeeping for the traffic overlay; renders nothing. Restores the online-feed preference on startup
// and posts a message to the vehicle-messages panel when an aircraft comes close.
export default function TrafficWatcher(): null {
  useEffect(() => {
    try {
      if (localStorage.getItem(ONLINE_TRAFFIC_KEY) === 'true') void window.api.setOnlineTraffic(true)
    } catch {
      // storage unavailable: the feed simply starts off
    }

    const lastAlert = new Map<string, number>()
    return subscribeToStore(() => {
      const now = Date.now()
      for (const a of nearbyTraffic(getTelemetry()).nearby) {
        if (a.threat !== 'alert') continue
        if (now - (lastAlert.get(a.id) ?? 0) < ALERT_REPEAT_MS) continue
        lastAlert.set(a.id, now)
        pushMessage(`Traffic: ${aircraftName(a)} ${formatDistance(a.distance)} ${compassPoint(a.bearing)}, ${formatRelAlt(a.relAlt)}`, 4)
      }
    })
  }, [])
  return null
}

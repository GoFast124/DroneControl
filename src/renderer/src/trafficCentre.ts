import { useMemo } from 'react'
import { useConnection, useTelemetrySelector } from './store'
import { useStationLocation } from './stationLocation'
import type { TrafficCentre } from './traffic'

// The point traffic is measured from: the vehicle's GPS position when it has one, otherwise the base station's, so
// nearby aircraft can be seen before the aircraft's GPS (which runs from the flight battery) is switched on.
export function useTrafficCentre(): TrafficCentre | null {
  const connected = useConnection().status === 'connected'
  const lat = useTelemetrySelector((t) => t.globalPosition?.lat ?? 0)
  const lon = useTelemetrySelector((t) => t.globalPosition?.lon ?? 0)
  const alt = useTelemetrySelector((t) => t.globalPosition?.alt)
  const vehicleHasFix = lat !== 0 || lon !== 0
  const station = useStationLocation(connected && !vehicleHasFix)

  return useMemo(() => {
    if (vehicleHasFix) return { lat, lon, alt, source: 'vehicle' as const }
    if (connected && station.status === 'found') return { lat: station.lat, lon: station.lon, source: 'station' as const }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleHasFix, lat, lon, alt, connected, station.status === 'found' ? station.lat : 0, station.status === 'found' ? station.lon : 0])
}

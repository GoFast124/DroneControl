import { useTelemetry } from '../store'
import {
  ONLINE_TRAFFIC_KEY,
  THREAT_COLORS,
  TRAFFIC_RANGE_M,
  aircraftName,
  compassPoint,
  formatDistance,
  formatRelAlt,
  nearbyTraffic
} from '../traffic'

const LIST_LENGTH = 4

// Status box listing the nearest aircraft, styled like the other dashboard cards.
export default function TrafficCard(): React.JSX.Element {
  const telemetry = useTelemetry()
  const { nearby, onGround } = nearbyTraffic(telemetry)
  const online = telemetry.traffic?.online
  const hasPosition = !!telemetry.globalPosition && (telemetry.globalPosition.lat !== 0 || telemetry.globalPosition.lon !== 0)
  const fromVehicle = telemetry.traffic?.aircraft.some((a) => a.source === 'vehicle') ?? false

  function toggleOnline(enabled: boolean): void {
    try {
      localStorage.setItem(ONLINE_TRAFFIC_KEY, String(enabled))
    } catch {
      // preference just won't persist
    }
    void window.api.setOnlineTraffic(enabled)
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, width: 290 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: 0.5 }}>TRAFFIC WITHIN {TRAFFIC_RANGE_M / 1000} KM</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-1)' }}>{nearby.length}</span>
      </div>

      {nearby.length === 0 ? (
        <div style={{ color: 'var(--text-2)', fontSize: 11, lineHeight: 1.5, minHeight: 40 }}>
          {!hasPosition
            ? 'Waiting for a GPS position'
            : online?.enabled || fromVehicle
              ? 'No aircraft nearby'
              : 'No aircraft data. The vehicle has no ADS-B receiver reporting; turn on the online feed to see nearby traffic.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {nearby.slice(0, LIST_LENGTH).map((a) => {
            const color = THREAT_COLORS[a.threat]
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  title={`Bearing ${Math.round(a.bearing)}°`}
                  style={{ display: 'inline-block', width: 16, textAlign: 'center', color, transform: `rotate(${a.bearing}deg)` }}
                >
                  ↑
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span
                      style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {aircraftName(a)}
                      {a.type && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}> {a.type}</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: a.threat === 'none' ? undefined : color }}>
                      {formatDistance(a.distance)}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-1)' }}>
                    {compassPoint(a.bearing)} · {formatRelAlt(a.relAlt)}
                    {a.speed !== undefined && ` · ${Math.round(a.speed * 3.6)} km/h`}
                    {a.climb !== undefined && Math.abs(a.climb) >= 1 && ` · ${a.climb > 0 ? '↗' : '↘'}`}
                  </div>
                </div>
              </div>
            )
          })}
          {nearby.length > LIST_LENGTH && (
            <div style={{ fontSize: 10, color: 'var(--text-2)' }}>+{nearby.length - LIST_LENGTH} more further away</div>
          )}
        </div>
      )}
      {onGround > 0 && nearby.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 6 }}>{onGround} on the ground not listed</div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-1)', cursor: 'pointer' }}
          title="Fetches nearby ADS-B traffic from adsb.lol. This sends the vehicle's approximate position (about 1 km precision) to that service."
        >
          <input type="checkbox" checked={!!online?.enabled} onChange={(e) => toggleOnline(e.target.checked)} />
          Online feed (adsb.lol)
        </label>
        {online?.error && <div style={{ fontSize: 10, color: 'var(--warn)' }}>{online.error}</div>}
      </div>
    </div>
  )
}

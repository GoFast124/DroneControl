import AttitudeIndicator from '../components/hud/AttitudeIndicator'
import Tape from '../components/hud/Tape'
import HeadingRibbon from '../components/hud/HeadingRibbon'
import ProximityRadar from '../components/hud/ProximityRadar'
import MiniMap from '../components/hud/MiniMap'
import StatCard from '../components/StatCard'
import SystemStatus from '../components/SystemStatus'
import TrafficCard from '../components/TrafficCard'
import FlightControls from '../components/FlightControls'
import MessagesPanel from '../components/MessagesPanel'
import { useConnection, useTelemetry } from '../store'
import { usePersistedFlag } from '../usePersistedFlag'

const GPS_FIX_NAMES: Record<number, string> = {
  0: 'NO GPS',
  1: 'NO FIX',
  2: '2D FIX',
  3: '3D FIX',
  4: 'DGPS',
  5: 'RTK FLOAT',
  6: 'RTK FIXED',
  7: 'STATIC',
  8: 'PPP'
}

export default function Dashboard(): React.JSX.Element {
  const connection = useConnection()
  const telemetry = useTelemetry()
  const [showRadar, setShowRadar] = usePersistedFlag('showProximityRadar', true)
  const [showMap, setShowMap] = usePersistedFlag('showDashboardMap', true)

  if (connection.status !== 'connected') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>◎</div>
          <div>Not connected — click Connect to link to your vehicle</div>
        </div>
      </div>
    )
  }

  const attitude = telemetry.attitude ?? { roll: 0, pitch: 0, yaw: 0 }
  const vfr = telemetry.vfrHud
  const pos = telemetry.globalPosition
  const gps = telemetry.gpsRaw
  const battery = telemetry.battery
  const rc = telemetry.rc
  const hasPosition = !!pos && (pos.lat !== 0 || pos.lon !== 0)
  // RSSI 255 means the receiver isn't reporting one; with no RC channels there is nothing to show.
  const rssiText = !rc || (rc.rssi === 255 && !rc.channels.some((c) => c > 0)) ? '—' : `${Math.round((rc.rssi / 254) * 100)}%`
  const headingDeg = vfr?.heading ?? (attitude.yaw * 180) / Math.PI

  const batteryColor =
    battery && battery.batteryRemaining >= 0
      ? battery.batteryRemaining < 20
        ? 'var(--bad)'
        : battery.batteryRemaining < 40
          ? 'var(--warn)'
          : 'var(--good)'
      : undefined

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {showMap ? (
          <MiniMap onHide={() => setShowMap(false)} />
        ) : (
          <ShowButton onClick={() => setShowMap(true)}>Show map</ShowButton>
        )}
        <Tape value={vfr?.groundspeed ?? 0} unit="m/s GND" step={5} side="left" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <AttitudeIndicator rollRad={attitude.roll} pitchRad={attitude.pitch} />
          <HeadingRibbon headingDeg={headingDeg} />
        </div>
        <Tape value={pos?.relativeAlt ?? vfr?.alt ?? 0} unit="m ALT" step={10} side="right" />
        {showRadar ? (
          <ProximityRadar onHide={() => setShowRadar(false)} />
        ) : (
          <ShowButton onClick={() => setShowRadar(true)}>Show proximity radar</ShowButton>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
        <StatCard
          title="Battery"
          rows={[
            { label: 'Voltage', value: battery ? `${battery.voltageBattery.toFixed(2)} V` : '—' },
            { label: 'Current', value: battery ? `${battery.currentBattery.toFixed(1)} A` : '—' },
            {
              label: 'Remaining',
              value: battery && battery.batteryRemaining >= 0 ? `${battery.batteryRemaining}%` : '—',
              color: batteryColor
            }
          ]}
        />
        <StatCard
          title="GPS"
          rows={[
            { label: 'Fix', value: gps ? (GPS_FIX_NAMES[gps.fixType] ?? `TYPE ${gps.fixType}`) : '—' },
            { label: 'Satellites', value: gps ? String(gps.satellitesVisible) : '—' },
            { label: 'HDOP', value: gps ? (gps.eph / 100).toFixed(2) : '—' }
          ]}
        />
        <StatCard
          title="Position"
          rows={[
            { label: 'Lat', value: hasPosition && pos ? pos.lat.toFixed(6) : '—' },
            { label: 'Lon', value: hasPosition && pos ? pos.lon.toFixed(6) : '—' },
            { label: 'Rel Alt', value: pos ? `${pos.relativeAlt.toFixed(1)} m` : '—' }
          ]}
        />
        <StatCard
          title="Radio / Throttle"
          rows={[
            { label: 'RSSI', value: rssiText },
            { label: 'Throttle', value: vfr ? `${vfr.throttle}%` : '—' },
            { label: 'Climb', value: vfr ? `${vfr.climb.toFixed(1)} m/s` : '—' }
          ]}
        />
        <TrafficCard />
      </div>

      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 1100, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <FlightControls />
        <MessagesPanel />
      </div>

      <SystemStatus />
    </div>
  )
}

function ShowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-1)' }}
    >
      {children}
    </button>
  )
}

import { useEffect, useState } from 'react'
import type { DistanceSensorData } from '../../../../shared/types'
import { useTelemetry } from '../../store'

const SIZE = 280
const C = SIZE / 2
const R = 120
const STALE_MS = 2500
const RANGE_STEPS = [2, 5, 10, 20, 40]
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1]
const DEFAULT_BEAM_WIDTH_DEG = 14

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

// Angles are degrees clockwise from the vehicle's nose; the nose points up the screen.
function xy(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)]
}

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function distanceColor(d: number): string {
  if (d < 2) return 'var(--bad)'
  if (d < 5) return 'var(--warn)'
  return 'var(--good)'
}

const BEARING_NAMES = ['front', 'front-right', 'right', 'rear-right', 'rear', 'rear-left', 'left', 'front-left']
function bearingName(deg: number): string {
  return BEARING_NAMES[Math.round(normalize(deg) / 45) % 8]
}

// Bearing of a horizontal sensor, or null for up/down/other mounting orientations.
function sensorBearing(s: DistanceSensorData): number | null {
  if (s.orientation >= 0 && s.orientation <= 7) return s.orientation * 45
  if (s.orientation === 100) return normalize(s.yawDeg ?? 0)
  return null
}

function sensorValid(s: DistanceSensorData): boolean {
  return s.distance >= s.min && (s.max <= 0 || s.distance <= s.max)
}

function arcPath(startDeg: number, endDeg: number, r: number): string {
  const [x1, y1] = xy(startDeg, r)
  const [x2, y2] = xy(endDeg, r)
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

export default function ProximityRadar({ onHide }: { onHide: () => void }): React.JSX.Element {
  const telemetry = useTelemetry()
  const now = useNow(500)
  const [rangeSetting, setRangeSetting] = useState<'auto' | number>('auto')

  const prox = telemetry.proximity
  const yawDeg = ((telemetry.attitude?.yaw ?? 0) * 180) / Math.PI
  const scan = prox?.scan && now - prox.scan.timestamp < STALE_MS ? prox.scan : undefined
  const fresh = (prox?.sensors ?? []).filter((s) => now - s.timestamp < STALE_MS)
  const horizontal = fresh.filter((s) => sensorBearing(s) !== null)
  const up = fresh.find((s) => s.orientation === 24)
  const down = fresh.find((s) => s.orientation === 25)
  const other = fresh.filter((s) => sensorBearing(s) === null && s.orientation !== 24 && s.orientation !== 25)
  const hasData = !!scan || fresh.length > 0

  // 360 degree scan points, converted to vehicle-relative bearings.
  const worldFrame = scan?.frame === 0 || scan?.frame === 5
  const scanPoints: { bearing: number; d: number }[] = []
  if (scan) {
    scan.distances.forEach((d, i) => {
      if (Number.isNaN(d)) return
      const bearing = scan.angleOffset + i * scan.increment - (worldFrame ? yawDeg : 0)
      scanPoints.push({ bearing, d })
    })
  }

  // Auto range: smallest step that fits the farthest valid reading, so a 100 m lidar indoors isn't drawn tiny.
  const ratedMax = Math.max(scan?.max ?? 0, ...horizontal.map((s) => s.max))
  const farthest = Math.max(0, ...scanPoints.map((p) => p.d), ...horizontal.filter(sensorValid).map((s) => s.distance))
  const wanted = farthest > 0 ? Math.min(farthest * 1.15, ratedMax || Infinity) : ratedMax
  const autoRange = RANGE_STEPS.find((n) => n >= wanted) ?? RANGE_STEPS[RANGE_STEPS.length - 1]
  const range = rangeSetting === 'auto' ? autoRange : rangeSetting
  const rPx = (d: number): number => (Math.min(d, range) / range) * R

  let nearest: { d: number; bearing: number } | null = null
  for (const p of scanPoints) if (!nearest || p.d < nearest.d) nearest = p
  for (const s of horizontal) {
    if (sensorValid(s) && (!nearest || s.distance < nearest.d)) nearest = { d: s.distance, bearing: sensorBearing(s) as number }
  }
  const warning = nearest !== null && nearest.d < 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={C}
          cy={C}
          r={R + 8}
          fill="var(--bg-2)"
          stroke={warning ? 'var(--bad)' : 'var(--border)'}
          strokeWidth={warning ? 3 : 2}
        />
        {RING_FRACTIONS.map((f) => (
          <g key={f}>
            <circle cx={C} cy={C} r={f * R} fill="none" stroke="var(--border)" strokeWidth={1} />
            <text
              x={C + 3}
              y={C - f * R + 10}
              fontSize={9}
              fill="var(--text-2)"
              fontFamily="var(--mono)"
              stroke="var(--bg-2)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {`${+(range * f).toFixed(1)}m`}
            </text>
          </g>
        ))}
        <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="var(--border)" strokeWidth={1} />
        <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="var(--border)" strokeWidth={1} />

        {scanPoints.map((p, i) => {
          const half = Math.max((scan?.increment ?? 5) / 2, 1)
          return (
            <path
              key={i}
              d={arcPath(p.bearing - half, p.bearing + half, rPx(p.d))}
              fill="none"
              stroke={distanceColor(p.d)}
              strokeWidth={5}
              opacity={p.d > range ? 0.35 : 1}
            />
          )
        })}

        {horizontal.map((s) => {
          const bearing = sensorBearing(s) as number
          const key = `${s.id}:${s.orientation}`
          if (!sensorValid(s)) {
            const [ex, ey] = xy(bearing, rPx(s.max > 0 ? s.max : range))
            return <line key={key} x1={C} y1={C} x2={ex} y2={ey} stroke="var(--text-2)" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
          }
          const r = rPx(s.distance)
          const half = (s.fovDeg > 0 ? Math.min(Math.max(s.fovDeg, 4), 90) : DEFAULT_BEAM_WIDTH_DEG) / 2
          const [x1, y1] = xy(bearing - half, r)
          const color = distanceColor(s.distance)
          const [dx, dy] = xy(bearing, r)
          const [lx, ly] = xy(bearing, Math.min(r + 13, R - 8))
          return (
            <g key={key}>
              <path
                d={`M ${C} ${C} L ${x1.toFixed(1)} ${y1.toFixed(1)} ${arcPath(bearing - half, bearing + half, r).replace(/^M [\d.]+ [\d.]+ /, '')} Z`}
                fill={color}
                fillOpacity={0.2}
                stroke={color}
                strokeWidth={1}
              />
              <circle cx={dx} cy={dy} r={3.5} fill={color} />
              <text
                x={lx}
                y={ly + 3}
                fontSize={10}
                fill={color}
                textAnchor="middle"
                fontFamily="var(--mono)"
                fontWeight={700}
                stroke="var(--bg-2)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {s.distance.toFixed(1)}
              </text>
            </g>
          )
        })}

        <g stroke="var(--text-0)" strokeWidth={2} strokeLinecap="round">
          <line x1={C - 9} y1={C - 9} x2={C + 9} y2={C + 9} />
          <line x1={C + 9} y1={C - 9} x2={C - 9} y2={C + 9} />
        </g>
        <circle cx={C} cy={C} r={4} fill="var(--text-0)" />
        <polygon points={`${C},${C - 20} ${C - 5},${C - 11} ${C + 5},${C - 11}`} fill="var(--accent)" />

        {!hasData && (
          <text x={C} y={C + 52} fontSize={11} fill="var(--text-2)" textAnchor="middle">
            No proximity data
          </text>
        )}
      </svg>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', minHeight: 20, fontFamily: 'var(--mono)', fontSize: 11 }}>
        {[
          { label: '▲ Up', s: up },
          { label: '▼ Down', s: down },
          ...other.map((s) => ({ label: `#${s.id} (o${s.orientation})`, s }))
        ]
          .filter((c) => c.s)
          .map(({ label, s }) => (
            <span key={label} style={{ color: s && sensorValid(s) ? distanceColor(s.distance) : 'var(--text-2)' }}>
              {label} {s && sensorValid(s) ? `${s.distance.toFixed(1)} m` : '—'}
            </span>
          ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-1)' }}>
        <span style={{ color: nearest ? distanceColor(nearest.d) : 'var(--text-2)', fontFamily: 'var(--mono)', fontWeight: 600, minWidth: 150 }}>
          {nearest
            ? `Nearest ${nearest.d.toFixed(1)} m ${bearingName(nearest.bearing)}`
            : hasData
              ? 'Nothing in range'
              : 'Nearest —'}
        </span>
        <select
          value={rangeSetting}
          onChange={(e) => setRangeSetting(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
          title="Radar range"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-0)' }}
        >
          <option value="auto">Range: auto ({autoRange} m)</option>
          {RANGE_STEPS.map((n) => (
            <option key={n} value={n}>
              Range: {n} m
            </option>
          ))}
        </select>
        <button
          onClick={onHide}
          title="Hide the proximity radar"
          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', color: 'var(--text-1)' }}
        >
          Hide
        </button>
      </div>
    </div>
  )
}

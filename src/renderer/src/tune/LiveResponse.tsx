import { useEffect, useRef, useState } from 'react'
import { getTelemetry, pushMessage, runCommand, subscribeToStore, useConnection, writeParam } from '../store'
import type { Draft } from '../setup/ui'
import { AXES } from './tuneMeta'

const W = 560
const H = 230
const PAD = { l: 46, r: 12, t: 12, b: 26 }
const WINDOW_S = 10
const FRESH_MS = 1500
const RAD = 180 / Math.PI

interface Sample {
  t: number
  angle: number[] // roll, pitch, yaw actual (deg)
  rate: number[] // actual body rates (deg/s)
  angleTarget: (number | null)[] // roll, pitch, yaw target (deg)
  rateTarget: (number | null)[] // deg/s
}

const MESSAGES = [30 /* ATTITUDE */, 62 /* NAV_CONTROLLER_OUTPUT */, 194 /* PID_TUNING */]

export default function LiveResponse({ draft }: { draft: Draft }): React.JSX.Element {
  const connected = useConnection().status === 'connected'
  const [axis, setAxis] = useState(0)
  const [view, setView] = useState<'rate' | 'angle'>('rate')
  const [paused, setPaused] = useState(false)
  const [, setTick] = useState(0)
  const samples = useRef<Sample[]>([])
  const pausedRef = useRef(false)
  pausedRef.current = paused

  // Ask for faster updates while this graph is on screen, and put the vehicle's own rates back afterwards.
  useEffect(() => {
    if (!connected) return
    for (const id of MESSAGES) void runCommand({ type: 'messageRate', messageId: id, hz: 25 })
    return () => {
      for (const id of MESSAGES) void window.api.sendCommand({ type: 'messageRate', messageId: id, hz: 0 }).catch(() => undefined)
    }
  }, [connected])

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 150)
    return () => clearInterval(timer)
  }, [])

  // Collect samples straight from the store so the graph doesn't re-render on every telemetry update.
  useEffect(() => {
    let lastAttitude: unknown = null
    return subscribeToStore(() => {
      const telemetry = getTelemetry()
      const att = telemetry.attitude
      if (!att || att === lastAttitude || pausedRef.current) return
      lastAttitude = att
      const now = Date.now()
      const pid = telemetry.pid
      const target = telemetry.attitudeTarget
      const rateTarget = [1, 2, 3].map((a, i) => {
        const p = pid?.[a]
        if (p && now - p.timestamp < FRESH_MS) return p.desired
        if (target) return [target.rollRate, target.pitchRate, target.yawRate][i] * RAD
        return null
      })
      const nav = telemetry.navTarget
      samples.current.push({
        t: now,
        angle: [att.roll * RAD, att.pitch * RAD, att.yaw * RAD],
        rate: [att.rollspeed * RAD, att.pitchspeed * RAD, att.yawspeed * RAD],
        angleTarget: [nav?.roll ?? null, nav?.pitch ?? null, null],
        rateTarget
      })
      const cutoff = now - WINDOW_S * 1000 - 500
      while (samples.current.length && samples.current[0].t < cutoff) samples.current.shift()
    })
  }, [])

  const spec = AXES[axis]
  const yawAngle = axis === 2 && view === 'angle'
  const effectiveView = yawAngle ? 'rate' : view
  const now = samples.current.length ? samples.current[samples.current.length - 1].t : Date.now()
  const visible = samples.current.filter((s) => s.t >= now - WINDOW_S * 1000)
  const actual = visible.map((s) => ({ t: s.t, v: effectiveView === 'rate' ? s.rate[axis] : s.angle[axis] }))
  const targetRaw = visible.map((s) => ({ t: s.t, v: effectiveView === 'rate' ? s.rateTarget[axis] : s.angleTarget[axis] }))
  const target = targetRaw.filter((p): p is { t: number; v: number } => p.v !== null)

  const extent = Math.max(effectiveView === 'rate' ? 20 : 5, ...actual.map((p) => Math.abs(p.v)), ...target.map((p) => Math.abs(p.v))) * 1.15
  const px = (t: number): number => PAD.l + ((t - (now - WINDOW_S * 1000)) / (WINDOW_S * 1000)) * (W - PAD.l - PAD.r)
  const py = (v: number): number => PAD.t + (1 - (v + extent) / (2 * extent)) * (H - PAD.t - PAD.b)
  const line = (pts: { t: number; v: number }[]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.t).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ')

  const pidNow = getTelemetry().pid?.[spec.pidAxis]
  const pidFresh = pidNow && Date.now() - pidNow.timestamp < FRESH_MS
  const mask = draft.vehicle('GCS_PID_MASK')
  const unit = effectiveView === 'rate' ? '°/s' : '°'
  const hasTarget = target.length > 0

  async function enablePidData(): Promise<void> {
    const ok = await writeParam('GCS_PID_MASK', 7)
    pushMessage(ok ? 'GCS_PID_MASK set to 7: the vehicle now streams roll/pitch/yaw PID data' : 'GCS_PID_MASK change was not confirmed', ok ? 6 : 3)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {AXES.map((a, i) => (
          <button key={a.key} onClick={() => setAxis(i)} style={chip(axis === i, a.color)}>
            {a.label}
          </button>
        ))}
        <span style={{ width: 10 }} />
        <button onClick={() => setView('rate')} style={chip(view === 'rate')}>
          Rate
        </button>
        <button onClick={() => setView('angle')} disabled={axis === 2} style={chip(view === 'angle' && axis !== 2)} title={axis === 2 ? 'Yaw angle is shown as a rate' : ''}>
          Angle
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setPaused(!paused)} style={chip(paused)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={() => (samples.current = [])} style={chip(false)}>
          Clear
        </button>
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%', background: 'var(--bg-1)', borderRadius: 6, border: '1px solid var(--border)' }}>
        {[-1, -0.5, 0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(f * extent)} y2={py(f * extent)} stroke={f === 0 ? 'var(--text-2)' : 'var(--border)'} strokeDasharray={f === 0 ? '' : '3 4'} />
            <text x={PAD.l - 6} y={py(f * extent) + 4} fontSize={10} fill="var(--text-2)" textAnchor="end" fontFamily="var(--mono)">
              {(f * extent).toFixed(extent < 20 ? 1 : 0)}
            </text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10].map((s) => (
          <text key={s} x={px(now - (WINDOW_S - s) * 1000)} y={H - 8} fontSize={10} fill="var(--text-2)" textAnchor="middle" fontFamily="var(--mono)">
            {s - WINDOW_S}s
          </text>
        ))}
        {hasTarget && <path d={line(target)} fill="none" stroke="var(--text-1)" strokeWidth={1.5} strokeDasharray="5 3" />}
        {actual.length > 1 && <path d={line(actual)} fill="none" stroke={spec.color} strokeWidth={2} />}
        <text x={W - PAD.r - 4} y={PAD.t + 10} fontSize={10} fill="var(--text-2)" textAnchor="end">
          {unit}
        </text>
        {actual.length < 2 && (
          <text x={W / 2} y={H / 2} fontSize={12} fill="var(--text-2)" textAnchor="middle">
            Waiting for attitude data…
          </text>
        )}
      </svg>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-1)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>
          <span style={{ color: spec.color, fontWeight: 700 }}>━</span> actual
        </span>
        <span>
          <span style={{ fontWeight: 700 }}>╍</span> target {!hasTarget && <span style={{ color: 'var(--text-2)' }}>(not available from this vehicle{effectiveView === 'rate' ? ' — enable PID data' : ''})</span>}
        </span>
      </div>

      {mask !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-1)' }}>
          {mask === 0 ? (
            <button style={chip(false)} onClick={() => void enablePidData()}>
              Enable PID data
            </button>
          ) : (
            <span style={{ color: 'var(--good)' }}>PID data streaming is enabled (GCS_PID_MASK = {mask})</span>
          )}
          <span style={{ color: 'var(--text-2)' }}>Adds the vehicle’s desired rate and the P / I / D / FF contributions. Sets GCS_PID_MASK on the vehicle.</span>
        </div>
      )}

      {pidFresh && pidNow && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {(
            [
              ['P', pidNow.p],
              ['I', pidNow.i],
              ['D', pidNow.d],
              ['FF', pidNow.ff]
            ] as [string, number][]
          ).map(([name, v]) => (
            <div key={name} style={{ fontSize: 11, color: 'var(--text-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{name} term</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{v.toFixed(3)}</span>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'var(--bg-3)', borderRadius: 3 }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: v >= 0 ? '50%' : `${50 + Math.max(-50, v * 100)}%`,
                    width: `${Math.min(50, Math.abs(v) * 100)}%`,
                    background: spec.color,
                    borderRadius: 3
                  }}
                />
                <div style={{ position: 'absolute', left: '50%', top: -1, bottom: -1, width: 1, background: 'var(--text-2)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function chip(active: boolean, color = 'var(--accent)'): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: 14,
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? 'var(--bg-3)' : 'transparent',
    color: active ? color : 'var(--text-1)'
  }
}

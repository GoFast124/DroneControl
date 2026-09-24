import { useEffect, useState } from 'react'
import { useMessages, useTelemetry } from '../store'
import { usePersistedFlag } from '../usePersistedFlag'
import { buildIndicators, summarize, type Level } from '../status'

const LEVEL_COLOR: Record<Level, string> = {
  ok: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  off: 'var(--text-2)'
}

// Grid of component health lights (GPS, attitude, compass, sensors, power...), like Mission Planner's status page.
export default function SystemStatus(): React.JSX.Element {
  const telemetry = useTelemetry()
  const messages = useMessages()
  const [open, setOpen] = usePersistedFlag('showSystemStatus', true)
  const [now, setNow] = useState(Date.now())

  // Re-evaluate once a second so a silent link is noticed even when no telemetry arrives.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const indicators = buildIndicators(telemetry, messages, Math.max(now, telemetry.lastHeartbeatAt ?? 0))
  const summary = summarize(indicators)

  return (
    <div style={{ width: '100%', maxWidth: 1100, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: open ? 10 : 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: 0.5 }}>SYSTEM STATUS</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: LEVEL_COLOR[summary.level] }}>
          <Dot level={summary.level} />
          {summary.text}
        </span>
        <button
          onClick={() => setOpen(!open)}
          style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', color: 'var(--text-1)', fontSize: 11 }}
        >
          {open ? 'Collapse' : 'Show'}
        </button>
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
          {indicators.map((i) => (
            <div
              key={i.id}
              title={`${i.label}: ${i.detail}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                padding: '8px 10px',
                background: 'var(--bg-1)',
                border: `1px solid ${i.level === 'bad' ? 'var(--bad)' : i.level === 'warn' ? 'var(--accent-dim)' : 'var(--border)'}`,
                borderRadius: 6,
                minWidth: 0
              }}
            >
              <Dot level={i.level} style={{ marginTop: 3 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: i.level === 'off' ? 'var(--text-1)' : 'var(--text-0)' }}>{i.label}</div>
                <div style={{ fontSize: 11, color: i.level === 'ok' || i.level === 'off' ? 'var(--text-1)' : LEVEL_COLOR[i.level], lineHeight: 1.35 }}>{i.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Dot({ level, style }: { level: Level; style?: React.CSSProperties }): React.JSX.Element {
  const color = LEVEL_COLOR[level]
  return (
    <span
      style={{
        flex: 'none',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: level === 'off' ? 'transparent' : color,
        border: level === 'off' ? `2px solid ${color}` : 'none',
        boxShadow: level === 'off' ? 'none' : `0 0 6px ${color}`,
        ...style
      }}
    />
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMessages } from '../store'

const SEVERITY_NAMES = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG']

function severityColor(sev: number): string {
  if (sev <= 3) return 'var(--bad)'
  if (sev === 4) return 'var(--warn)'
  if (sev === 5) return 'var(--accent)'
  return 'var(--text-1)'
}

export default function MessagesPanel(): React.JSX.Element {
  const messages = useMessages()
  const [alertsOnly, setAlertsOnly] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const shown = useMemo(() => (alertsOnly ? messages.filter((m) => m.severity <= 4) : messages), [messages, alertsOnly])
  const alertCount = useMemo(() => messages.filter((m) => m.severity <= 4).length, [messages])

  useEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [shown])

  return (
    <div
      style={{
        flex: 1,
        minWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: 0.5 }}>VEHICLE MESSAGES</span>
        {alertCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--warn)' }}>
            {alertCount} warning{alertCount === 1 ? '' : 's'}/error{alertCount === 1 ? '' : 's'}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-1)' }}>
          <input type="checkbox" checked={alertsOnly} onChange={(e) => setAlertsOnly(e.target.checked)} />
          Warnings &amp; errors only
        </label>
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        style={{ flex: 1, minHeight: 200, maxHeight: 260, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: 12 }}
      >
        {shown.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              padding: '3px 12px',
              borderLeft: `3px solid ${m.severity <= 4 ? severityColor(m.severity) : 'transparent'}`,
              background: m.severity <= 3 ? 'rgba(239,87,87,0.08)' : 'transparent'
            }}
          >
            <span style={{ color: 'var(--text-2)', flexShrink: 0 }}>{new Date(m.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: severityColor(m.severity), width: 70, flexShrink: 0 }} title={SEVERITY_NAMES[m.severity]}>
              {m.source === 'gcs' ? 'GCS' : (SEVERITY_NAMES[m.severity] ?? m.severity)}
            </span>
            <span style={{ color: m.severity <= 4 ? severityColor(m.severity) : 'var(--text-0)', userSelect: 'text' }}>
              {m.text}
            </span>
          </div>
        ))}
        {shown.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)', fontFamily: 'var(--sans)' }}>
            {alertsOnly ? 'No warnings or errors.' : 'No messages yet.'}
          </div>
        )}
      </div>
    </div>
  )
}

import { useMemo, useRef, useState, useEffect } from 'react'
import { useLogs } from '../store'

export default function LogsView(): React.JSX.Element {
  const logs = useLogs()
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const f = filter.trim().toUpperCase()
    if (!f) return logs
    return logs.filter((l) => l.msgName.includes(f) || l.summary.toUpperCase().includes(f))
  }, [logs, filter])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [filtered, autoScroll])

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          placeholder="Filter by message name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 320,
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 10px',
            color: 'var(--text-0)'
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-1)', fontSize: 12 }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{filtered.length} messages (last 500 kept)</span>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)' }}>
        Live MAVLink message stream. Dataflash (.bin) log download &amp; graphing is a planned follow-up.
      </p>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
          fontFamily: 'var(--mono)',
          fontSize: 11
        }}
      >
        {filtered.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 10,
              padding: '3px 12px',
              borderBottom: '1px solid var(--bg-2)',
              color: l.direction === 'out' ? 'var(--accent)' : 'var(--text-0)'
            }}
          >
            <span style={{ color: 'var(--text-2)', width: 90 }}>
              {new Date(l.timestamp).toLocaleTimeString()}
            </span>
            <span style={{ width: 14 }}>{l.direction === 'out' ? '↑' : '↓'}</span>
            <span style={{ width: 180, fontWeight: 600 }}>{l.msgName}</span>
            <span style={{ color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.summary}</span>
          </div>
        ))}
        <div ref={bottomRef} />
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>No messages yet.</div>
        )}
      </div>
    </div>
  )
}

import { useMessages } from '../store'

// Recent vehicle/GCS messages that match a pattern, so a calibration page shows what the vehicle is saying.
export default function CalLog({ pattern, count = 6 }: { pattern: RegExp; count?: number }): React.JSX.Element {
  const lines = useMessages()
    .filter((m) => pattern.test(m.text))
    .slice(-count)
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 12, minHeight: 32 }}>
      {lines.length === 0 && <span style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)' }}>Vehicle messages about this will appear here.</span>}
      {lines.map((m, i) => (
        <div key={i} style={{ color: m.severity <= 3 ? 'var(--bad)' : m.severity === 4 ? 'var(--warn)' : 'var(--text-1)' }}>
          {new Date(m.timestamp).toLocaleTimeString()} {m.source === 'gcs' ? '[GCS] ' : ''}
          {m.text}
        </div>
      ))}
    </div>
  )
}

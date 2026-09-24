export default function StatCard({
  title,
  rows
}: {
  title: string
  rows: { label: string; value: string; color?: string }[]
}): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        minWidth: 160
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: 0.5, marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--text-1)', fontSize: 11 }}>{r.label}</span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 600,
                color: r.color ?? 'var(--text-0)'
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

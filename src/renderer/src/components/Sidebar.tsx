import type { ViewId } from '../App'

const ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'mission', label: 'Mission', icon: '⌖' },
  { id: 'parameters', label: 'Parameters', icon: '≡' },
  { id: 'logs', label: 'Logs', icon: '▤' }
]

export default function Sidebar({
  current,
  onSelect
}: {
  current: ViewId
  onSelect: (v: ViewId) => void
}): React.JSX.Element {
  return (
    <div
      style={{
        width: 76,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        gap: 6,
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 12
        }}
      >
        GC
      </div>
      {ITEMS.map((item) => {
        const active = item.id === current
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              width: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: active ? 'var(--bg-3)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-1)'
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 10 }}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

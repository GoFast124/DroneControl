import { useConnection, useTelemetry } from '../store'

const STATUS_COLOR: Record<string, string> = {
  disconnected: 'var(--text-2)',
  connecting: 'var(--warn)',
  connected: 'var(--good)',
  error: 'var(--bad)'
}

export default function TopBar({ onOpenConnection }: { onOpenConnection: () => void }): React.JSX.Element {
  const connection = useConnection()
  const telemetry = useTelemetry()
  const connected = connection.status === 'connected'

  async function handleClick(): Promise<void> {
    if (connected) {
      await window.api.disconnect()
    } else {
      onOpenConnection()
    }
  }

  return (
    <div
      style={{
        height: 48,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: STATUS_COLOR[connection.status],
            boxShadow: connected ? '0 0 6px var(--good)' : 'none'
          }}
        />
        <span style={{ color: 'var(--text-1)', textTransform: 'capitalize' }}>{connection.status}</span>
        {connection.error && <span style={{ color: 'var(--bad)' }}>— {connection.error}</span>}
      </div>

      {connected && (
        <>
          <Divider />
          <Stat label="MODE" value={telemetry.flightMode} highlight />
          <Stat label="ARMED" value={telemetry.armed ? 'ARMED' : 'DISARMED'} color={telemetry.armed ? 'var(--bad)' : 'var(--text-1)'} />
          <Stat
            label="LINK"
            value={
              telemetry.lastHeartbeatAt && Date.now() - telemetry.lastHeartbeatAt < 3000 ? 'OK' : 'STALE'
            }
          />
        </>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={handleClick}
        style={{
          padding: '6px 16px',
          borderRadius: 6,
          border: '1px solid ' + (connected ? 'var(--bad)' : 'var(--accent)'),
          background: 'transparent',
          color: connected ? 'var(--bad)' : 'var(--accent)',
          fontWeight: 600
        }}
      >
        {connected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  )
}

function Divider(): React.JSX.Element {
  return <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
}

function Stat({
  label,
  value,
  color,
  highlight
}: {
  label: string
  value: string
  color?: string
  highlight?: boolean
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
      <span style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: 0.5 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 13,
          fontWeight: 600,
          color: color ?? (highlight ? 'var(--accent)' : 'var(--text-0)')
        }}
      >
        {value}
      </span>
    </div>
  )
}

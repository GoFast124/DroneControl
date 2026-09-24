import { useEffect, useState } from 'react'
import { COPTER_MODES, MODE_LAND, MODE_RTL } from '../../../shared/copterModes'
import type { VehicleCommand } from '../../../shared/types'
import { pushMessage, useTelemetry } from '../store'

type Pending = 'arm' | 'disarm' | 'takeoff'

export default function FlightControls(): React.JSX.Element {
  const telemetry = useTelemetry()
  const [pending, setPending] = useState<Pending | null>(null)
  const [altitude, setAltitude] = useState(10)
  const [busy, setBusy] = useState(false)

  const currentMode = telemetry.heartbeat?.customMode
  const armed = telemetry.armed

  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setPending(null), 6000)
    return () => clearTimeout(t)
  }, [pending])

  async function run(cmd: VehicleCommand): Promise<void> {
    setPending(null)
    setBusy(true)
    try {
      await window.api.sendCommand(cmd)
    } catch (err) {
      pushMessage((err as Error).message.replace(/^Error invoking remote method '[^']*': (Error: )?/, ''), 3)
    } finally {
      setBusy(false)
    }
  }

  const confirmText: Record<Pending, string> = {
    arm: 'Arm motors?',
    disarm: 'Disarm motors?',
    takeoff: `${armed ? '' : 'Arm and '}take off to ${altitude} m?`
  }

  function confirmAction(): void {
    if (pending === 'arm') void run({ type: 'arm' })
    else if (pending === 'disarm') void run({ type: 'disarm' })
    else if (pending === 'takeoff') void run({ type: 'takeoff', altitude })
  }

  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: 0.5 }}>FLIGHT CONTROLS</div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-1)' }}>
        Flight mode
        <select
          value={currentMode ?? ''}
          disabled={busy || currentMode === undefined}
          onChange={(e) => void run({ type: 'setMode', mode: Number(e.target.value) })}
          style={fieldStyle}
        >
          {currentMode !== undefined && !(currentMode in COPTER_MODES) && <option value={currentMode}>MODE({currentMode})</option>}
          {Object.entries(COPTER_MODES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {pending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'var(--warn)', fontWeight: 600 }}>{confirmText[pending]}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={confirmAction} style={{ ...btn, borderColor: 'var(--bad)', color: 'var(--bad)', flex: 1 }}>
              Confirm
            </button>
            <button onClick={() => setPending(null)} style={{ ...btn, flex: 1 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={busy}
              onClick={() => setPending(armed ? 'disarm' : 'arm')}
              style={{ ...btn, flex: 1, borderColor: armed ? 'var(--good)' : 'var(--bad)', color: armed ? 'var(--good)' : 'var(--bad)' }}
            >
              {armed ? 'Disarm' : 'Arm'}
            </button>
            <button disabled={busy || !armed} onClick={() => void run({ type: 'setMode', mode: MODE_LAND })} style={{ ...btn, flex: 1 }}>
              Land
            </button>
            <button disabled={busy || !armed} onClick={() => void run({ type: 'setMode', mode: MODE_RTL })} style={{ ...btn, flex: 1 }}>
              RTL
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={1000}
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
              style={{ ...fieldStyle, width: 80 }}
            />
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>m</span>
            <button disabled={busy || !(altitude > 0)} onClick={() => setPending('takeoff')} style={{ ...btn, flex: 1 }}>
              Takeoff
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '7px 10px',
  color: 'var(--text-0)'
}

const btn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-0)',
  fontWeight: 600
}

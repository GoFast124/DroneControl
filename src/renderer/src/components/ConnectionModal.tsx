import { useEffect, useState } from 'react'
import type { SerialPortInfo } from '../../../shared/types'

const BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 111100, 115200, 230400, 460800, 921600]

export default function ConnectionModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [kind, setKind] = useState<'serial' | 'udp' | 'tcp'>('udp')
  const [ports, setPorts] = useState<SerialPortInfo[]>([])
  const [path, setPath] = useState('')
  const [baud, setBaud] = useState(57600)
  const [bindPort, setBindPort] = useState(14550)
  const [remoteHost, setRemoteHost] = useState('')
  const [remotePort, setRemotePort] = useState(14551)
  const [tcpHost, setTcpHost] = useState('127.0.0.1')
  const [tcpPort, setTcpPort] = useState(5760)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    void window.api.listSerialPorts().then((list) => {
      setPorts(list)
      if (list.length > 0) setPath(list[0].path)
    })
  }, [])

  async function handleConnect(): Promise<void> {
    setError(null)
    setConnecting(true)
    try {
      if (kind === 'serial') {
        if (!path) throw new Error('Select a serial port')
        await window.api.connect({ kind: 'serial', path, baudRate: baud })
      } else if (kind === 'tcp') {
        await window.api.connect({ kind: 'tcp', host: tcpHost, port: tcpPort })
      } else {
        await window.api.connect({
          kind: 'udp',
          bindPort,
          remoteHost: remoteHost || undefined,
          remotePort: remoteHost ? remotePort : undefined
        })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 20
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>Connect to vehicle</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <TabButton active={kind === 'udp'} onClick={() => setKind('udp')}>
            UDP / SITL
          </TabButton>
          <TabButton active={kind === 'tcp'} onClick={() => setKind('tcp')}>
            TCP
          </TabButton>
          <TabButton active={kind === 'serial'} onClick={() => setKind('serial')}>
            Serial / USB
          </TabButton>
        </div>

        {kind === 'serial' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Port">
              <select value={path} onChange={(e) => setPath(e.target.value)} style={selectStyle}>
                {ports.length === 0 && <option value="">No ports found</option>}
                {ports.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.path} {p.friendlyName ? `— ${p.friendlyName}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Baud rate">
              <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} style={selectStyle}>
                {BAUD_RATES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : kind === 'tcp' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Host">
              <input
                type="text"
                value={tcpHost}
                onChange={(e) => setTcpHost(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Port">
              <input
                type="number"
                value={tcpPort}
                onChange={(e) => setTcpPort(Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
            <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0 }}>
              For a Docker-based SITL (e.g. radarku/ardupilot-sitl), this is typically 127.0.0.1:5760.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Local bind port">
              <input
                type="number"
                value={bindPort}
                onChange={(e) => setBindPort(Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
            <Field label="Remote host (optional)">
              <input
                type="text"
                placeholder="e.g. 127.0.0.1 — leave blank to wait for first packet"
                value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)}
                style={inputStyle}
              />
            </Field>
            {remoteHost && (
              <Field label="Remote port">
                <input
                  type="number"
                  value={remotePort}
                  onChange={(e) => setRemotePort(Number(e.target.value))}
                  style={inputStyle}
                />
              </Field>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0 }}>
              For ArduPilot SITL, bind port 14550 with no remote host works out of the box — MAVProxy
              connects to us.
            </p>
          </div>
        )}

        {error && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryBtn}>
            Cancel
          </button>
          <button onClick={handleConnect} disabled={connecting} style={primaryBtn}>
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 0',
        borderRadius: 6,
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-1)'
      }}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-1)' }}>
      {label}
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  color: 'var(--text-0)'
}

const selectStyle: React.CSSProperties = { ...inputStyle }

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 6,
  border: '1px solid var(--accent)',
  background: 'var(--accent-dim)',
  color: 'var(--accent)',
  fontWeight: 600
}

const secondaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-1)'
}

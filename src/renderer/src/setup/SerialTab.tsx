import { useState } from 'react'
import { runCommand } from '../store'
import { btn, Card, dangerBtn, Notice, ParamSelect, Th, WriteBar } from './ui'
import type { Draft } from './ui'
import { SERIAL_BAUDS, SERIAL_PROTOCOLS } from './paramMeta'

export default function SerialTab({ draft }: { draft: Draft }): React.JSX.Element {
  const [confirmReboot, setConfirmReboot] = useState(false)
  const [written, setWritten] = useState(false)
  const ports = Array.from({ length: 9 }, (_, i) => i).filter((n) => draft.has(`SERIAL${n}_PROTOCOL`))

  if (ports.length === 0) return <Notice tone="warn">No SERIALn_PROTOCOL parameters were found on this vehicle.</Notice>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Serial ports">
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>Port</Th>
              <Th>Protocol</Th>
              <Th>Baud rate</Th>
            </tr>
          </thead>
          <tbody>
            {ports.map((n) => (
              <tr key={n} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>
                  SERIAL{n}
                  {n === 0 && <span style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)' }}> (USB)</span>}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <ParamSelect draft={draft} id={`SERIAL${n}_PROTOCOL`} options={SERIAL_PROTOCOLS} width={210} />
                </td>
                <td style={{ padding: '6px 10px' }}>{draft.has(`SERIAL${n}_BAUD`) && <ParamSelect draft={draft} id={`SERIAL${n}_BAUD`} options={SERIAL_BAUDS} width={110} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          Which physical connector each SERIALn maps to depends on your flight controller board (see its documentation). Changing the port you are connected through
          can lock you out.
        </span>
      </Card>

      <Card title="Reboot">
        <Notice tone={written ? 'warn' : 'info'}>Serial port changes take effect after the flight controller reboots.</Notice>
        {!confirmReboot ? (
          <div>
            <button style={btn} onClick={() => setConfirmReboot(true)}>Reboot flight controller</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--warn)', fontWeight: 600 }}>Reboot now? The link will drop.</span>
            <button
              style={dangerBtn}
              onClick={() => {
                setConfirmReboot(false)
                void runCommand({ type: 'reboot' })
              }}
            >
              Reboot
            </button>
            <button style={btn} onClick={() => setConfirmReboot(false)}>Cancel</button>
          </div>
        )}
      </Card>

      <WriteBar draft={draft} onWritten={(failed) => setWritten(failed.length === 0)} note="Reboot required afterwards" />
    </div>
  )
}

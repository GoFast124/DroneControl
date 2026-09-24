import { useTelemetry } from '../store'
import { Bar, Card, Notice, ParamNumber, ParamSelect, Th, WriteBar } from './ui'
import type { Draft } from './ui'
import { SERVO_FUNCTIONS } from './paramMeta'

export default function ServoTab({ draft }: { draft: Draft }): React.JSX.Element {
  const telemetry = useTelemetry()
  const outputs = telemetry.servoOutputs ?? []
  const rows = Array.from({ length: 32 }, (_, i) => i + 1).filter((n) => draft.has(`SERVO${n}_FUNCTION`))

  if (rows.length === 0) return <Notice tone="warn">No SERVOn_FUNCTION parameters were found on this vehicle.</Notice>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Notice tone="warn">
        Motor outputs (Motor 1-8) are driven by the flight controller: changing their function, range or direction can stop a motor or make the aircraft
        unflyable. Remove propellers before changing anything on this page.
      </Notice>
      <Card title="Servo / motor outputs">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <Th>Out</Th>
              <Th>Live output</Th>
              <Th>Function</Th>
              <Th>Min</Th>
              <Th>Trim</Th>
              <Th>Max</Th>
              <Th>Reverse</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const live = outputs[n - 1] ?? 0
              const reversed = draft.value(`SERVO${n}_REVERSED`) === 1
              return (
                <tr key={n} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)' }}>{n}</td>
                  <td style={{ padding: '6px 8px', minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Bar value={live} min={draft.value(`SERVO${n}_MIN`) ?? 1000} max={draft.value(`SERVO${n}_MAX`) ?? 2000} />
                      <span style={{ width: 40, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: live ? 'var(--text-0)' : 'var(--text-2)' }}>{live || '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <ParamSelect draft={draft} id={`SERVO${n}_FUNCTION`} options={SERVO_FUNCTIONS} width={150} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <ParamNumber draft={draft} id={`SERVO${n}_MIN`} width={62} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <ParamNumber draft={draft} id={`SERVO${n}_TRIM`} width={62} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <ParamNumber draft={draft} id={`SERVO${n}_MAX`} width={62} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {draft.has(`SERVO${n}_REVERSED`) && (
                      <input type="checkbox" checked={reversed} onChange={(e) => draft.set(`SERVO${n}_REVERSED`, e.target.checked ? 1 : 0)} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>The live bar spans each output’s Min to Max. A motor output that is disarmed normally sits at its minimum.</span>
      </Card>
      <WriteBar draft={draft} />
    </div>
  )
}

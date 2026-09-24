import { COPTER_MODES } from '../../../shared/copterModes'
import { useTelemetry } from '../store'
import { Bar, Card, Notice, ParamSelect, selectStyle, WriteBar } from './ui'
import type { Draft } from './ui'
import { FLIGHT_MODE_PWM_EDGES, flightModeSlot } from './paramMeta'

const MODE_OPTIONS: [number, string][] = Object.entries(COPTER_MODES).map(([id, name]) => [Number(id), name])
const SLOT_LABELS = ['≤ 1230', '1231 – 1360', '1361 – 1490', '1491 – 1620', '1621 – 1749', '≥ 1750']

function setBit(mask: number, bit: number, on: boolean): number {
  return on ? mask | (1 << bit) : mask & ~(1 << bit)
}

export default function FlightModesTab({ draft }: { draft: Draft }): React.JSX.Element {
  const telemetry = useTelemetry()
  const channelNumber = draft.value('FLTMODE_CH')
  const pwm = channelNumber ? (telemetry.rc?.channels[channelNumber - 1] ?? 0) : 0
  const active = flightModeSlot(pwm)
  const simple = draft.value('SIMPLE')
  const superSimple = draft.value('SUPER_SIMPLE')

  if (channelNumber === undefined) {
    return <Notice tone="warn">This vehicle does not expose FLTMODE_CH / FLTMODE1-6 parameters.</Notice>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Flight mode switch">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-1)' }}>Mode channel</span>
          <select value={channelNumber} onChange={(e) => draft.set('FLTMODE_CH', Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Channel {n}
              </option>
            ))}
          </select>
          <Bar value={pwm} marks={FLIGHT_MODE_PWM_EDGES} />
          <span style={{ width: 50, textAlign: 'right', fontFamily: 'var(--mono)' }}>{pwm || '—'}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Ticks show where the switch position changes. Move your mode switch to see the active slot highlight.</span>
      </Card>

      <Card title="Modes">
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Slot', 'PWM range', 'Mode', 'Simple', 'Super simple'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 10px', fontSize: 10, color: 'var(--text-2)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map((slot) => (
              <tr key={slot} style={{ background: active === slot - 1 ? 'var(--accent-dim)' : 'transparent' }}>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{slot}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-1)' }}>{SLOT_LABELS[slot - 1]}</td>
                <td style={{ padding: '6px 10px' }}>
                  <ParamSelect draft={draft} id={`FLTMODE${slot}`} options={MODE_OPTIONS} width={170} />
                </td>
                <td style={{ padding: '6px 10px' }}>
                  {simple !== undefined && (
                    <input type="checkbox" checked={((simple >> (slot - 1)) & 1) === 1} onChange={(e) => draft.set('SIMPLE', setBit(simple, slot - 1, e.target.checked))} />
                  )}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  {superSimple !== undefined && (
                    <input
                      type="checkbox"
                      checked={((superSimple >> (slot - 1)) & 1) === 1}
                      onChange={(e) => draft.set('SUPER_SIMPLE', setBit(superSimple, slot - 1, e.target.checked))}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <WriteBar draft={draft} />
    </div>
  )
}

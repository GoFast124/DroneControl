import { resetSetupState, runCommand, useSetupState, useTelemetry } from '../store'
import type { MagCalState } from '../store'
import CalLog from './CalLog'
import { Card, dangerBtn, Notice, ParamNumber, ParamSelect, primaryBtn, WriteBar } from './ui'
import type { Draft } from './ui'
import { MAG_CAL_STATUS, ORIENTATIONS } from './paramMeta'

const SUFFIX = ['', '2', '3']
const MAG_RUNNING = [1, 2, 3]

function offsetIds(index: number): string[] {
  const p = index === 0 ? 'COMPASS_OFS' : `COMPASS_OFS${index + 1}`
  return [`${p}_X`, `${p}_Y`, `${p}_Z`]
}

export default function CompassTab({ draft }: { draft: Draft }): React.JSX.Element {
  const telemetry = useTelemetry()
  const setup = useSetupState()
  const compasses = [0, 1, 2].filter((i) => draft.has(`COMPASS_DEV_ID${SUFFIX[i]}`))
  const armed = telemetry.armed
  const magStates = Object.entries(setup.mag).map(([id, s]) => [Number(id), s] as [number, MagCalState])
  const running = magStates.some(([, s]) => MAG_RUNNING.includes(s.status))
  const allDone = magStates.length > 0 && magStates.every(([, s]) => s.report)
  const canAccept = allDone && magStates.some(([, s]) => s.report?.status === 4 && !s.report.autosaved)

  if (compasses.length === 0) return <Notice tone="warn">No compass parameters (COMPASS_DEV_ID) were found on this vehicle.</Notice>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Compasses">
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Compass', 'Detected', 'Use', 'Mounting', 'Orientation', 'Offsets X / Y / Z'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 10px', fontSize: 10, color: 'var(--text-2)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compasses.map((i) => {
              const devId = draft.value(`COMPASS_DEV_ID${SUFFIX[i]}`) ?? 0
              const ext = draft.value(i === 0 ? 'COMPASS_EXTERNAL' : `COMPASS_EXTERN${SUFFIX[i]}`)
              const useId = `COMPASS_USE${SUFFIX[i]}`
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px' }}>Compass {i + 1}</td>
                  <td style={{ padding: '6px 10px', color: devId ? 'var(--good)' : 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {devId ? `#${devId.toString(16).toUpperCase()}` : 'not detected'}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    {draft.has(useId) && (
                      <input type="checkbox" checked={draft.value(useId) === 1} onChange={(e) => draft.set(useId, e.target.checked ? 1 : 0)} />
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-1)' }}>{ext === undefined ? '—' : ext ? 'External' : 'Internal'}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <ParamSelect draft={draft} id={`COMPASS_ORIENT${SUFFIX[i]}`} options={ORIENTATIONS} width={150} />
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-1)' }}>
                    {offsetIds(i)
                      .map((id) => Math.round(draft.value(id) ?? 0))
                      .join(' / ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {draft.has('COMPASS_AUTODEC') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-1)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={draft.value('COMPASS_AUTODEC') === 1} onChange={(e) => draft.set('COMPASS_AUTODEC', e.target.checked ? 1 : 0)} />
              Automatic declination (from GPS location)
            </label>
            {draft.has('COMPASS_DEC') && draft.value('COMPASS_AUTODEC') !== 1 && (
              <span>
                Declination (rad) <ParamNumber draft={draft} id="COMPASS_DEC" width={70} />
              </span>
            )}
          </div>
        )}
      </Card>

      <Card
        title="Compass calibration"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {!running && (
              <button
                style={primaryBtn}
                disabled={armed}
                onClick={() => {
                  resetSetupState()
                  void runCommand({ type: 'magCal', action: 'start' })
                }}
              >
                Start calibration
              </button>
            )}
            {running && (
              <button style={dangerBtn} onClick={() => void runCommand({ type: 'magCal', action: 'cancel' })}>
                Cancel
              </button>
            )}
            {canAccept && (
              <button style={primaryBtn} onClick={() => void runCommand({ type: 'magCal', action: 'accept' })}>
                Accept
              </button>
            )}
          </div>
        }
      >
        <Notice tone={armed ? 'bad' : 'info'}>
          {armed
            ? 'Disarm the vehicle before calibrating.'
            : 'Go outside, away from metal, vehicles and buildings. Press Start, then slowly rotate the aircraft so that every side points at the ground in turn, until every compass reaches 100%.'}
        </Notice>

        {magStates.length === 0 && <span style={{ color: 'var(--text-2)', fontSize: 12 }}>No calibration running.</span>}
        {magStates.map(([id, s]) => (
          <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 80 }}>Compass {id + 1}</span>
              <div style={{ flex: 1, height: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${s.report ? 100 : s.percent}%`, height: '100%', background: s.report && s.report.status !== 4 ? 'var(--bad)' : 'var(--accent)' }} />
              </div>
              <span style={{ width: 40, textAlign: 'right', fontFamily: 'var(--mono)' }}>{s.report ? 100 : s.percent}%</span>
              <span style={{ width: 130, fontSize: 12, color: s.status === 4 ? 'var(--good)' : s.status >= 5 ? 'var(--bad)' : 'var(--text-1)' }}>
                {MAG_CAL_STATUS[s.status] ?? `Status ${s.status}`}
              </span>
            </div>
            {!s.report && s.mask.length > 0 && <Coverage mask={s.mask} />}
            {s.report && (
              <div style={{ fontSize: 12, color: 'var(--text-1)', fontFamily: 'var(--mono)' }}>
                Fitness {s.report.fitness.toFixed(1)} (lower is better) · offsets {s.report.offsets.map((o) => o.toFixed(0)).join(' / ')}
                {s.report.status === 4 && (s.report.autosaved ? ' · saved' : ' · not saved yet — press Accept')}
              </div>
            )}
          </div>
        ))}
        <CalLog pattern={/mag|compass|calib/i} />
      </Card>

      <WriteBar draft={draft} />
    </div>
  )
}

// The vehicle reports which of 80 sections of the sphere have been sampled.
function Coverage({ mask }: { mask: number[] }): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(40, 1fr)', gap: 2 }} title="Sphere coverage">
      {Array.from({ length: 80 }, (_, i) => {
        const set = ((mask[i >> 3] ?? 0) >> (i & 7)) & 1
        return <div key={i} style={{ height: 8, borderRadius: 2, background: set ? 'var(--good)' : 'var(--bg-3)' }} />
      })}
    </div>
  )
}


import { useState } from 'react'
import { useArmed, useConnection } from '../store'
import { useEnsureParams, useParamDraft } from '../setup/useParamDraft'
import { btn, Card, dangerBtn, Notice, primaryBtn } from '../setup/ui'
import LiveResponse from '../tune/LiveResponse'
import RateCurves from '../tune/RateCurves'
import TuneSlider from '../tune/TuneSlider'
import { ACRO_SPECS, ANGLE_SPECS, AXES, MOTOR_SPECS, PILOT_SPECS, mirrorParam, rateAdvancedSpecs, ratePidSpecs } from '../tune/tuneMeta'

export default function TuneView(): React.JSX.Element {
  const connection = useConnection()
  const armed = useArmed()
  const { loaded, loading, progress } = useEnsureParams()
  const draft = useParamDraft()
  const [linked, setLinked] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  if (connection.status !== 'connected') return <Centered>Not connected — click Connect to link to your vehicle</Centered>
  if (!loaded) {
    return (
      <Centered>
        {loading ? `Loading parameters… ${progress.received} / ${progress.total}` : 'Waiting for the vehicle’s parameters…'}
      </Centered>
    )
  }

  // Roll and pitch move together while linked.
  function setValue(id: string, value: number): void {
    draft.set(id, value)
    const twin = linked ? mirrorParam(id) : null
    if (twin && draft.has(twin)) draft.set(twin, value)
  }

  async function write(): Promise<void> {
    setConfirming(false)
    const count = draft.dirtyIds.length
    const failed = await draft.writeAll()
    setResult(
      failed.length
        ? { ok: false, text: `Wrote ${count - failed.length} of ${count}. Not confirmed: ${failed.join(', ')}` }
        : { ok: true, text: `Wrote ${count} tuning change${count === 1 ? '' : 's'}, all confirmed by the vehicle` }
    )
  }

  const hasRatePids = AXES.some((a) => draft.has(`${a.prefix}P`))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {armed && (
          <div style={{ marginBottom: 14 }}>
            <Notice tone="warn">The vehicle is armed. Tuning changes take effect immediately, so make small changes and be ready to recover.</Notice>
          </div>
        )}
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 460px', minWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-1)' }}>
              <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
              Link roll and pitch (changes to one are copied to the other)
            </label>

            {!hasRatePids && <Notice tone="warn">No ATC_RAT_* rate controller parameters were found on this vehicle.</Notice>}

            {AXES.map((axis) => {
              if (!draft.has(`${axis.prefix}P`)) return null
              return (
                <Card key={axis.key} title={`${axis.label} rate controller`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ratePidSpecs(axis).map((s) => (
                      <TuneSlider key={s.id} draft={draft} spec={s} color={axis.color} onSet={setValue} />
                    ))}
                  </div>
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-2)' }}>Limits and filters</summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {rateAdvancedSpecs(axis).map((s) => (
                        <TuneSlider key={s.id} draft={draft} spec={s} color={axis.color} onSet={setValue} />
                      ))}
                    </div>
                  </details>
                </Card>
              )
            })}

            <Card title="Angle controller">
              {ANGLE_SPECS.map((s, i) => (
                <TuneSlider key={s.id} draft={draft} spec={s} color={AXES[i].color} onSet={setValue} />
              ))}
            </Card>

            <Card title="Rates and pilot input">
              {ACRO_SPECS.map((s) => (
                <TuneSlider key={s.id} draft={draft} spec={s} onSet={setValue} />
              ))}
              {PILOT_SPECS.map((s) => (
                <TuneSlider key={s.id} draft={draft} spec={s} onSet={setValue} />
              ))}
            </Card>

            <Card title="Motors">
              {MOTOR_SPECS.map((s) => (
                <TuneSlider key={s.id} draft={draft} spec={s} onSet={setValue} />
              ))}
            </Card>
          </div>

          <div style={{ flex: '1 1 540px', minWidth: 460, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 0 }}>
            <Card title="Live response">
              <LiveResponse draft={draft} />
            </Card>
            <Card title="ACRO stick response">
              <RateCurves draft={draft} />
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                Rate you get for each stick position in ACRO, from the rate and expo sliders. The curve shape is approximate; the full-stick rates are exact.
              </span>
            </Card>
          </div>
        </div>
      </div>

      {(draft.dirty || draft.busy || result) && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {draft.dirty || draft.busy ? (
            <>
              <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
                {draft.dirtyIds.length} change{draft.dirtyIds.length === 1 ? '' : 's'} not written
              </span>
              <span style={{ color: 'var(--text-2)', fontSize: 12 }}>The slider tick shows the value currently on the vehicle.</span>
              <div style={{ flex: 1 }} />
              {!confirming ? (
                <>
                  <button style={btn} disabled={draft.busy} onClick={() => draft.revert()}>
                    Discard
                  </button>
                  <button style={primaryBtn} disabled={draft.busy} onClick={() => setConfirming(true)}>
                    {draft.busy ? 'Writing…' : 'Write to vehicle'}
                  </button>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--warn)' }}>This changes how the aircraft flies. Continue?</span>
                  <button style={dangerBtn} onClick={() => void write()}>
                    Write {draft.dirtyIds.length}
                  </button>
                  <button style={btn} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </>
              )}
            </>
          ) : (
            result && (
              <>
                <span style={{ color: result.ok ? 'var(--good)' : 'var(--warn)' }}>{result.text}</span>
                <div style={{ flex: 1 }} />
                <button style={btn} onClick={() => setResult(null)}>
                  Dismiss
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>{children}</div>
}

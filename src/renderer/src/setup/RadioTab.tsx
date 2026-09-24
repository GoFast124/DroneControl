import { useEffect, useRef, useState } from 'react'
import { computeRcCalibration, recordRcSample } from '../../../shared/rcCalibration'
import type { RcCalResult, RcRange } from '../../../shared/rcCalibration'
import { useTelemetry } from '../store'
import { Bar, btn, Card, Notice, primaryBtn, Th, WriteBar } from './ui'
import type { Draft } from './ui'

type Phase = 'idle' | 'sticks' | 'centre' | 'review'

const CHANNELS = 16

export default function RadioTab({ draft }: { draft: Draft }): React.JSX.Element {
  const telemetry = useTelemetry()
  const channels = telemetry.rc?.channels ?? []
  const [phase, setPhase] = useState<Phase>('idle')
  const [ranges, setRanges] = useState<(RcRange | null)[]>([])
  const [results, setResults] = useState<RcCalResult[]>([])
  const latest = useRef<number[]>([])
  latest.current = channels

  const throttleChannel = draft.value('RCMAP_THROTTLE') ?? 3
  const roles: Record<number, string> = {}
  const roleParams: [string, string, number][] = [
    ['RCMAP_ROLL', 'Roll', 1],
    ['RCMAP_PITCH', 'Pitch', 2],
    ['RCMAP_THROTTLE', 'Throttle', 3],
    ['RCMAP_YAW', 'Yaw', 4]
  ]
  for (const [id, label, fallback] of roleParams) roles[draft.value(id) ?? fallback] = label
  const modeChannel = draft.value('FLTMODE_CH')
  if (modeChannel !== undefined) roles[modeChannel] = roles[modeChannel] ?? 'Flight mode'

  // While the "move sticks" step is active, keep the widest range seen on every channel.
  useEffect(() => {
    if (phase === 'sticks' && channels.length) setRanges((r) => recordRcSample(r, channels))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.rc, phase])

  function start(): void {
    setRanges([])
    setResults([])
    setPhase('sticks')
  }

  function finishSticks(): void {
    setPhase('centre')
  }

  function finishCentre(): void {
    setResults(computeRcCalibration(ranges, latest.current, throttleChannel))
    setPhase('review')
  }

  function apply(): void {
    for (const r of results) {
      if (r.skipped) continue
      draft.set(`RC${r.channel}_MIN`, r.min)
      draft.set(`RC${r.channel}_MAX`, r.max)
      if (r.trim !== null) draft.set(`RC${r.channel}_TRIM`, r.trim)
    }
    setPhase('idle')
  }

  const receiving = channels.some((v) => v > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!receiving && <Notice tone="warn">No RC channel data is being received. Turn on your transmitter and check the receiver connection.</Notice>}

      <Card
        title="Radio calibration"
        actions={phase === 'idle' ? <button style={primaryBtn} onClick={start} disabled={!receiving}>Calibrate radio</button> : undefined}
      >
        {phase === 'idle' && (
          <Notice>
            Turn on the transmitter with the propellers removed. Calibration records how far each stick and switch moves, then the centre position, and writes
            RCn_MIN / RCn_MAX / RCn_TRIM.
          </Notice>
        )}
        {phase === 'sticks' && (
          <>
            <Notice tone="warn">Step 1 of 2: move every stick and switch to both extremes, several times. The bars below show the range recorded so far.</Notice>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={primaryBtn} onClick={finishSticks}>Extremes done — next</button>
              <button style={btn} onClick={() => setPhase('idle')}>Cancel</button>
            </div>
          </>
        )}
        {phase === 'centre' && (
          <>
            <Notice tone="warn">Step 2 of 2: release the sticks so roll, pitch and yaw are centred and throttle is fully down, then continue.</Notice>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={primaryBtn} onClick={finishCentre}>Sticks centred — finish</button>
              <button style={btn} onClick={() => setPhase('idle')}>Cancel</button>
            </div>
          </>
        )}
        {phase === 'review' && (
          <>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <Th>Ch</Th>
                  <Th>Role</Th>
                  <Th>Min</Th>
                  <Th>Max</Th>
                  <Th>Trim</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.channel} style={{ opacity: r.skipped ? 0.5 : 1 }}>
                    <td style={cell}>{r.channel}</td>
                    <td style={cell}>{roles[r.channel] ?? ''}</td>
                    <td style={cell}>{r.min}</td>
                    <td style={cell}>{r.max}</td>
                    <td style={cell}>{r.trim ?? '—'}</td>
                    <td style={{ ...cell, color: 'var(--warn)' }}>{r.skipped ? `skipped: ${r.skipped}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={primaryBtn} onClick={apply} disabled={results.every((r) => r.skipped)}>
                Use these values
              </button>
              <button style={btn} onClick={start}>Redo</button>
              <button style={btn} onClick={() => setPhase('idle')}>Cancel</button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>“Use these values” stages the changes below; nothing is sent to the vehicle until you press Write.</span>
          </>
        )}
      </Card>

      <Card title="Live channels">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: CHANNELS }, (_, i) => {
            const n = i + 1
            const v = channels[i] ?? 0
            const min = draft.value(`RC${n}_MIN`)
            const max = draft.value(`RC${n}_MAX`)
            const trim = draft.value(`RC${n}_TRIM`)
            const range = phase === 'sticks' ? ranges[i] : null
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: v ? 1 : 0.45 }}>
                <span style={{ width: 24, color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>{n}</span>
                <span style={{ width: 82, fontSize: 12, color: 'var(--text-1)' }}>{roles[n] ?? ''}</span>
                <Bar value={v} marks={[min, trim, max].filter((m): m is number => m !== undefined)} />
                <span style={{ width: 44, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{v || '—'}</span>
                <span style={{ width: 96, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-2)' }}>
                  {range ? `${range.min}–${range.max}` : min !== undefined && max !== undefined ? `${min}–${max}` : ''}
                </span>
                {draft.has(`RC${n}_REVERSED`) && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-1)' }}>
                    <input
                      type="checkbox"
                      checked={(draft.value(`RC${n}_REVERSED`) ?? 0) === 1}
                      onChange={(e) => draft.set(`RC${n}_REVERSED`, e.target.checked ? 1 : 0)}
                    />
                    Reversed
                  </label>
                )}
              </div>
            )
          })}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Vertical ticks mark the stored minimum, trim and maximum for each channel.</span>
      </Card>

      <WriteBar draft={draft} />
    </div>
  )
}

const cell: React.CSSProperties = { padding: '4px 10px', fontFamily: 'var(--mono)' }

import NumberField from '../components/NumberField'
import type { Draft } from '../setup/ui'
import type { SliderSpec } from './tuneMeta'

// Slider + number box for one parameter. A tick on the track marks the value currently on the vehicle,
// so you can see how far you have moved from it.
export default function TuneSlider({
  draft,
  spec,
  color = 'var(--accent)',
  onSet
}: {
  draft: Draft
  spec: SliderSpec
  color?: string
  onSet: (id: string, value: number) => void
}): React.JSX.Element | null {
  const value = draft.value(spec.id)
  const vehicle = draft.vehicle(spec.id)
  if (value === undefined || vehicle === undefined) return null

  const max = Math.max(spec.max, value * 1.25, vehicle * 1.25)
  const pct = (v: number): number => Math.max(0, Math.min(100, ((v - spec.min) / (max - spec.min)) * 100))
  const changed = Math.fround(value) !== vehicle
  const decimals = spec.decimals ?? (spec.step < 1 ? 2 : 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr 84px 22px', alignItems: 'center', gap: 10 }} title={spec.hint}>
      <span style={{ fontSize: 12, color: changed ? 'var(--warn)' : 'var(--text-1)' }}>{spec.label}</span>
      <div style={{ position: 'relative', height: 22, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, background: 'var(--bg-3)' }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct(value)}%`, height: 4, borderRadius: 2, background: changed ? 'var(--warn)' : color, opacity: 0.85 }} />
        <div
          title={`On vehicle: ${vehicle}`}
          style={{ position: 'absolute', left: `${pct(vehicle)}%`, top: 1, bottom: 1, width: 2, marginLeft: -1, background: 'var(--text-0)', opacity: 0.7, pointerEvents: 'none' }}
        />
        <input
          type="range"
          min={spec.min}
          max={max}
          step={spec.step}
          value={value}
          onChange={(e) => onSet(spec.id, Number(e.target.value))}
          style={{ position: 'relative', width: '100%', margin: 0, background: 'transparent', accentColor: changed ? 'var(--warn)' : color }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <NumberField value={Number(value.toFixed(decimals + 1))} onChange={(v) => onSet(spec.id, v)} width={62} />
        {spec.unit && <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{spec.unit}</span>}
      </div>
      <button
        title="Back to the vehicle's value"
        disabled={!changed}
        onClick={() => draft.revert([spec.id])}
        style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-1)', fontSize: 12 }}
      >
        ↺
      </button>
    </div>
  )
}

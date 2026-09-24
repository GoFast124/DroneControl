import type { Draft } from '../setup/ui'
import { acroRates } from './tuneMeta'

const W = 440
const H = 250
const PAD = { l: 44, r: 14, t: 14, b: 32 }

// Rate at a given stick position (0..1). A higher expo flattens the centre and keeps the full rate at the edge.
function rate(maxRate: number, expo: number, x: number, power: number): number {
  const e = Math.max(0, Math.min(1, expo))
  return maxRate * (e * Math.pow(x, power) + (1 - e) * x)
}

export default function RateCurves({ draft }: { draft: Draft }): React.JSX.Element | null {
  const { rp: rpRate, yaw: yRate } = acroRates(draft.value)
  if (rpRate === undefined && yRate === undefined) return null

  const rpExpo = draft.value('ACRO_RP_EXPO') ?? 0
  const yExpo = draft.value('ACRO_Y_EXPO') ?? 0
  const top = Math.max(120, rpRate ?? 0, yRate ?? 0) * 1.1
  const px = (x: number): number => PAD.l + x * (W - PAD.l - PAD.r)
  const py = (v: number): number => H - PAD.b - (v / top) * (H - PAD.t - PAD.b)

  const curve = (maxRate: number, expo: number, power: number): string =>
    Array.from({ length: 41 }, (_, i) => {
      const x = i / 40
      return `${i === 0 ? 'M' : 'L'} ${px(x).toFixed(1)} ${py(rate(maxRate, expo, x, power)).toFixed(1)}`
    }).join(' ')

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((top * f) / 10) * 10)

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: '100%' }}>
      {gridValues.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} stroke="var(--border)" />
          <text x={PAD.l - 6} y={py(v) + 4} fontSize={10} fill="var(--text-2)" textAnchor="end" fontFamily="var(--mono)">
            {v}
          </text>
        </g>
      ))}
      {[0, 25, 50, 75, 100].map((s) => (
        <text key={s} x={px(s / 100)} y={H - PAD.b + 16} fontSize={10} fill="var(--text-2)" textAnchor="middle" fontFamily="var(--mono)">
          {s}%
        </text>
      ))}
      <text x={PAD.l} y={H - 4} fontSize={10} fill="var(--text-2)">
        stick deflection
      </text>
      <text x={PAD.l} y={PAD.t - 3} fontSize={10} fill="var(--text-2)">
        °/s
      </text>

      {rpRate !== undefined && (
        <>
          <path d={curve(rpRate, rpExpo, 5)} fill="none" stroke="#3ecfff" strokeWidth={2.5} />
          <circle cx={px(1)} cy={py(rpRate)} r={4} fill="#3ecfff" />
          <text x={px(1) - 8} y={py(rpRate) - 10} fontSize={11} fill="#3ecfff" textAnchor="end" fontFamily="var(--mono)" fontWeight={700}>
            roll/pitch {Math.round(rpRate)}°/s
          </text>
        </>
      )}
      {yRate !== undefined && (
        <>
          <path d={curve(yRate, yExpo, 3)} fill="none" stroke="#33d17a" strokeWidth={2.5} />
          <circle cx={px(1)} cy={py(yRate)} r={4} fill="#33d17a" />
          <text x={px(1) - 8} y={py(yRate) + 26} fontSize={11} fill="#33d17a" textAnchor="end" fontFamily="var(--mono)" fontWeight={700}>
            yaw {Math.round(yRate)}°/s
          </text>
        </>
      )}
    </svg>
  )
}

import type { FrameMotor } from './frames'

const CW_COLOR = '#3ecfff'
const CCW_COLOR = '#f5b942'
const NONE_COLOR = 'var(--text-2)'

// Top-down view of a frame: nose up, motors at their arm positions, numbered by output with the motor-test letter,
// and the propeller direction as seen from above. Motors that share an arm (coaxial pairs) are drawn side by side.
export default function FrameDiagram({
  motors,
  size = 300,
  onMotor,
  disabled
}: {
  motors: FrameMotor[]
  size?: number
  onMotor?: (motor: FrameMotor) => void
  disabled?: boolean
}): React.JSX.Element {
  const c = size / 2
  const radius = Math.max(13, size * (motors.length > 8 ? 0.055 : 0.07))
  const point = (angle: number, r: number): [number, number] => {
    const a = (angle * Math.PI) / 180
    return [c + r * Math.sin(a), c - r * Math.cos(a)]
  }

  // Group motors sharing an arm so coaxial pairs don't sit on top of each other.
  const groups = new Map<number, FrameMotor[]>()
  for (const m of motors) {
    const key = Math.round(m.angle * 10) / 10
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  const stacked = [...groups.values()].some((g) => g.length > 1)
  const arm = size * (stacked ? 0.28 : 0.33)
  const placed: { m: FrameMotor; x: number; y: number; ux: number; uy: number }[] = []
  for (const [angle, members] of groups) {
    members.forEach((m, i) => {
      const spread = (i - (members.length - 1) / 2) * radius * 2.4
      const [x, y] = point(angle, arm + spread)
      const [ux, uy] = point(angle, 1)
      placed.push({ m, x, y, ux: ux - c, uy: uy - c })
    })
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%' }}>
      <circle cx={c} cy={c} r={arm + radius * 1.9} fill="none" stroke="var(--border)" strokeDasharray="3 5" />
      {[...groups.keys()].map((angle) => {
        const [x, y] = point(angle, arm)
        return <line key={angle} x1={c} y1={c} x2={x} y2={y} stroke="var(--text-2)" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      })}
      <rect x={c - size * 0.06} y={c - size * 0.06} width={size * 0.12} height={size * 0.12} rx={6} fill="var(--bg-3)" stroke="var(--border)" />
      <polygon points={`${c},${c - size * 0.17} ${c - size * 0.035},${c - size * 0.1} ${c + size * 0.035},${c - size * 0.1}`} fill="var(--accent)" />
      <text x={c} y={c + 4} textAnchor="middle" fontSize={10} fill="var(--text-2)">
        FC
      </text>

      {placed.map(({ m, x, y, ux, uy }) => {
        const color = m.dir === 1 ? CCW_COLOR : m.dir === -1 ? CW_COLOR : NONE_COLOR
        const clickable = !!onMotor && !disabled
        return (
          <g
            key={m.n}
            onClick={() => clickable && onMotor?.(m)}
            style={{ cursor: onMotor ? (clickable ? 'pointer' : 'not-allowed') : 'default' }}
          >
            <circle cx={x} cy={y} r={radius} fill="var(--bg-2)" stroke={color} strokeWidth={2.5} />
            <text x={x} y={y + 1} textAnchor="middle" fontSize={radius > 16 ? 15 : 12} fontWeight={700} fill="var(--text-0)">
              {m.n}
            </text>
            <text x={x} y={y + radius * 0.62 + 4} textAnchor="middle" fontSize={9} fill="var(--text-2)">
              {String.fromCharCode(64 + m.order)}
            </text>
            {m.dir !== 0 && (
              <text
                x={x + ux * (radius + 10)}
                y={y + uy * (radius + 10) + 5}
                textAnchor="middle"
                fontSize={16}
                fill={color}
              >
                {m.dir === -1 ? '↻' : '↺'}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function FrameLegend({ hasDirections }: { hasDirections: boolean }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-1)' }}>
      {hasDirections && (
        <>
          <span>
            <span style={{ color: CW_COLOR, fontSize: 14 }}>↻</span> clockwise
          </span>
          <span>
            <span style={{ color: CCW_COLOR, fontSize: 14 }}>↺</span> counter-clockwise
          </span>
        </>
      )}
      <span>large number = motor output, small letter = motor test order</span>
      <span>viewed from above, nose up</span>
    </div>
  )
}

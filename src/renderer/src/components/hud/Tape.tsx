const HEIGHT = 280
const WIDTH = 70
const PX_PER_UNIT = 6

export default function Tape({
  value,
  unit,
  step = 5,
  side = 'left'
}: {
  value: number
  unit: string
  step?: number
  side?: 'left' | 'right'
}): React.JSX.Element {
  const center = Math.round(value / step) * step
  const marks = []
  for (let m = center - step * 8; m <= center + step * 8; m += step) {
    const y = HEIGHT / 2 - (m - value) * PX_PER_UNIT
    if (y < -10 || y > HEIGHT + 10) continue
    marks.push(
      <g key={m}>
        <line
          x1={side === 'left' ? WIDTH - 14 : 0}
          x2={side === 'left' ? WIDTH : 14}
          y1={y}
          y2={y}
          stroke="var(--text-1)"
          strokeWidth={1}
        />
        <text
          x={side === 'left' ? WIDTH - 18 : 18}
          y={y + 4}
          fontSize={11}
          fill="var(--text-1)"
          textAnchor={side === 'left' ? 'end' : 'start'}
          fontFamily="var(--mono)"
        >
          {Math.round(m)}
        </text>
      </g>
    )
  }

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={6} fill="var(--bg-2)" stroke="var(--border)" />
      <g clipPath="none">{marks}</g>
      <rect
        x={side === 'left' ? WIDTH - 46 : 0}
        y={HEIGHT / 2 - 12}
        width={46}
        height={24}
        fill="var(--accent-dim)"
      />
      <text
        x={side === 'left' ? WIDTH - 23 : 23}
        y={HEIGHT / 2 + 5}
        fontSize={13}
        fontWeight={700}
        fill="var(--accent)"
        textAnchor="middle"
        fontFamily="var(--mono)"
      >
        {value.toFixed(0)}
      </text>
      <text
        x={WIDTH / 2}
        y={HEIGHT - 6}
        fontSize={9}
        fill="var(--text-2)"
        textAnchor="middle"
      >
        {unit}
      </text>
    </svg>
  )
}

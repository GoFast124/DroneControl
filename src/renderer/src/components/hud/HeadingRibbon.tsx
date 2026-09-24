const WIDTH = 420
const HEIGHT = 46
const PX_PER_DEG = 6

function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export default function HeadingRibbon({ headingDeg }: { headingDeg: number }): React.JSX.Element {
  const marks = []
  for (let d = -40; d <= 40; d += 5) {
    const heading = wrap360(headingDeg + d)
    const x = WIDTH / 2 + d * PX_PER_DEG
    const major = heading % 30 === 0
    const label =
      heading === 0 ? 'N' : heading === 90 ? 'E' : heading === 180 ? 'S' : heading === 270 ? 'W' : String(heading)
    marks.push(
      <g key={d}>
        <line x1={x} x2={x} y1={major ? 6 : 12} y2={22} stroke="var(--text-1)" strokeWidth={1} />
        {major && (
          <text x={x} y={16} fontSize={11} fill="var(--text-1)" textAnchor="middle" fontFamily="var(--mono)">
            {label}
          </text>
        )}
      </g>
    )
  }

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={6} fill="var(--bg-2)" stroke="var(--border)" />
      {marks}
      <polygon
        points={`${WIDTH / 2},32 ${WIDTH / 2 - 6},44 ${WIDTH / 2 + 6},44`}
        fill="var(--accent)"
      />
      <rect x={WIDTH / 2 - 24} y={0} width={48} height={20} fill="var(--accent-dim)" />
      <text
        x={WIDTH / 2}
        y={15}
        fontSize={12}
        fontWeight={700}
        fill="var(--accent)"
        textAnchor="middle"
        fontFamily="var(--mono)"
      >
        {Math.round(wrap360(headingDeg))}°
      </text>
    </svg>
  )
}

const SIZE = 280
const CENTER = SIZE / 2
const RADIUS = 130
const PX_PER_DEG = 3.4

export default function AttitudeIndicator({
  rollRad,
  pitchRad
}: {
  rollRad: number
  pitchRad: number
}): React.JSX.Element {
  const rollDeg = (rollRad * 180) / Math.PI
  const pitchDeg = (pitchRad * 180) / Math.PI
  const pitchOffset = Math.max(-60, Math.min(60, pitchDeg)) * PX_PER_DEG

  const ladderLines = []
  for (let deg = -90; deg <= 90; deg += 10) {
    if (deg === 0) continue
    const y = -deg * PX_PER_DEG
    const width = deg % 30 === 0 ? 60 : deg % 20 === 0 ? 40 : 24
    ladderLines.push(
      <g key={deg}>
        <line x1={-width / 2} x2={width / 2} y1={y} y2={y} stroke="white" strokeWidth={1.5} />
        {deg % 30 === 0 && (
          <>
            <text x={-width / 2 - 14} y={y + 4} fill="white" fontSize={11} textAnchor="middle">
              {deg}
            </text>
            <text x={width / 2 + 14} y={y + 4} fill="white" fontSize={11} textAnchor="middle">
              {deg}
            </text>
          </>
        )}
      </g>
    )
  }

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <defs>
        <clipPath id="horizon-clip">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} />
        </clipPath>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5fb4" />
          <stop offset="100%" stopColor="#5aa9e6" />
        </linearGradient>
        <linearGradient id="ground-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a5a2e" />
          <stop offset="100%" stopColor="#4a3218" />
        </linearGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="var(--bg-2)" />

      <g clipPath="url(#horizon-clip)">
        <g transform={`translate(${CENTER} ${CENTER}) rotate(${-rollDeg})`}>
          <g transform={`translate(0 ${pitchOffset})`}>
            <rect x={-400} y={-800} width={800} height={800} fill="url(#sky-grad)" />
            <rect x={-400} y={0} width={800} height={800} fill="url(#ground-grad)" />
            <line x1={-400} x2={400} y1={0} y2={0} stroke="white" strokeWidth={2} />
            {ladderLines}
          </g>
        </g>
      </g>

      {/* roll scale */}
      <g transform={`translate(${CENTER} ${CENTER})`}>
        {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((deg) => (
          <line
            key={deg}
            x1={0}
            y1={-RADIUS - 2}
            x2={0}
            y2={-RADIUS + (deg % 30 === 0 ? 12 : 7)}
            stroke="white"
            strokeWidth={1.5}
            transform={`rotate(${deg})`}
          />
        ))}
        <polygon
          points="0,-118 -6,-104 6,-104"
          fill="var(--accent)"
          transform={`rotate(${-rollDeg})`}
        />
        <polygon points="0,-134 -7,-122 7,-122" fill="white" />
      </g>

      {/* fixed aircraft symbol */}
      <g transform={`translate(${CENTER} ${CENTER})`} stroke="#ffcc00" strokeWidth={3} strokeLinecap="round">
        <line x1={-34} y1={0} x2={-10} y2={0} />
        <line x1={10} y1={0} x2={34} y2={0} />
        <circle cx={0} cy={0} r={3} fill="#ffcc00" stroke="none" />
      </g>

      <circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="none" stroke="var(--border)" strokeWidth={3} />
    </svg>
  )
}

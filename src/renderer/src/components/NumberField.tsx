import { useEffect, useState } from 'react'

// Numeric input that tolerates in-progress text like "-" or "12." and commits only valid numbers.
export default function NumberField({
  value,
  onChange,
  width = 80,
  step
}: {
  value: number
  onChange: (v: number) => void
  width?: number
  step?: number
}): React.JSX.Element {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      value={text}
      inputMode="decimal"
      step={step}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && !Number.isNaN(n)) onChange(n)
      }}
      onBlur={() => setText(String(value))}
      style={{
        width,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 6px',
        color: 'var(--text-0)',
        fontFamily: 'var(--mono)',
        fontSize: 12
      }}
    />
  )
}

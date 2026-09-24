import type { CSSProperties, ReactNode } from 'react'
import NumberField from '../components/NumberField'
import type { Options } from './paramMeta'
import type { useParamDraft } from './useParamDraft'

export type Draft = ReturnType<typeof useParamDraft>

export const btn: CSSProperties = {
  padding: '7px 14px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-0)'
}

export const primaryBtn: CSSProperties = { ...btn, border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 }
export const dangerBtn: CSSProperties = { ...btn, border: '1px solid var(--bad)', color: 'var(--bad)' }

export const selectStyle: CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '5px 8px',
  color: 'var(--text-0)'
}

export function Card({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{title}</span>
        <div style={{ flex: 1 }} />
        {actions}
      </div>
      {children}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad'; children: ReactNode }): React.JSX.Element {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text-1)'
  return (
    <div style={{ fontSize: 12, lineHeight: 1.5, color, border: `1px solid ${tone === 'info' ? 'var(--border)' : color}`, borderRadius: 6, padding: '8px 10px' }}>
      {children}
    </div>
  )
}

export function Bar({
  value,
  min = 1000,
  max = 2000,
  color = 'var(--accent)',
  marks = []
}: {
  value: number
  min?: number
  max?: number
  color?: string
  marks?: number[]
}): React.JSX.Element {
  const pct = (v: number): number => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  return (
    <div style={{ position: 'relative', height: 10, background: 'var(--bg-1)', borderRadius: 5, border: '1px solid var(--border)', minWidth: 120, flex: 1 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${value ? pct(value) : 0}%`, background: color, borderRadius: 5, opacity: value ? 1 : 0.2 }} />
      {marks.map((m, i) => (
        <div key={i} style={{ position: 'absolute', left: `${pct(m)}%`, top: -2, bottom: -2, width: 2, background: 'var(--text-1)', opacity: 0.6 }} />
      ))}
    </div>
  )
}

// Drop-down bound to a parameter's draft value; unknown values are shown numerically instead of being hidden.
export function ParamSelect({ draft, id, options, width }: { draft: Draft; id: string; options: Options; width?: number }): React.JSX.Element {
  const v = draft.value(id)
  const known = options.some(([n]) => n === v)
  const changed = draft.dirtyIds.includes(id)
  return (
    <select
      value={v ?? ''}
      disabled={v === undefined}
      onChange={(e) => draft.set(id, Number(e.target.value))}
      style={{ ...selectStyle, width, borderColor: changed ? 'var(--warn)' : 'var(--border)' }}
    >
      {v === undefined && <option value="">—</option>}
      {v !== undefined && !known && <option value={v}>{`Value ${v}`}</option>}
      {options.map(([n, label]) => (
        <option key={n} value={n}>
          {label}
        </option>
      ))}
    </select>
  )
}

export function ParamNumber({ draft, id, width = 76 }: { draft: Draft; id: string; width?: number }): React.JSX.Element {
  const v = draft.value(id)
  if (v === undefined) return <span style={{ color: 'var(--text-2)' }}>—</span>
  return (
    <span style={{ outline: draft.dirtyIds.includes(id) ? '1px solid var(--warn)' : 'none', borderRadius: 4, display: 'inline-block' }}>
      <NumberField value={v} onChange={(n) => draft.set(id, n)} width={width} />
    </span>
  )
}

// Write/discard bar shown whenever a page has unsent parameter edits.
export function WriteBar({ draft, onWritten, note }: { draft: Draft; onWritten?: (failed: string[]) => void; note?: string }): React.JSX.Element | null {
  if (!draft.dirty && !draft.busy) return null
  return (
    <div style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-1)', border: '1px solid var(--warn)', borderRadius: 8 }}>
      <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
        {draft.dirtyIds.length} unsaved change{draft.dirtyIds.length === 1 ? '' : 's'}
      </span>
      {note && <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{note}</span>}
      <div style={{ flex: 1 }} />
      <button style={btn} disabled={draft.busy} onClick={() => draft.revert()}>
        Discard
      </button>
      <button style={primaryBtn} disabled={draft.busy} onClick={() => void draft.writeAll().then((f) => onWritten?.(f))}>
        {draft.busy ? 'Writing…' : 'Write to vehicle'}
      </button>
    </div>
  )
}

export function Th({ children }: { children?: ReactNode }): React.JSX.Element {
  return <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-2)', fontSize: 10, letterSpacing: 0.5, fontWeight: 600 }}>{children}</th>
}

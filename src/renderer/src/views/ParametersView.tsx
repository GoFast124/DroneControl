import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConnection, useParamProgress, useParams, writeParam } from '../store'
import { paramChoices } from '../paramOptions'
import type { ParamChoice } from '../paramOptions'

const TYPE_NAMES: Record<number, string> = {
  1: 'UINT8',
  2: 'INT8',
  3: 'UINT16',
  4: 'INT16',
  5: 'UINT32',
  6: 'INT32',
  7: 'UINT64',
  8: 'INT64',
  9: 'REAL32',
  10: 'REAL64'
}

type WriteStatus = 'saving' | 'ok' | 'failed'

// Shortest decimal string that still round-trips to the same float32, so unchanged values never look edited.
function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v)
  for (let precision = 6; precision < 9; precision++) {
    const s = String(Number(v.toPrecision(precision)))
    if (Math.fround(Number(s)) === v) return s
  }
  return String(Number(v.toPrecision(9)))
}

function parseParamText(text: string): { entries: [string, number][]; badLines: string[] } {
  const entries: [string, number][] = []
  const badLines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim()
    if (!line) continue
    const parts = line.split(/[,\s]+/)
    const value = Number(parts[1])
    if (parts.length < 2 || parts[1] === '' || Number.isNaN(value)) {
      badLines.push(rawLine.trim())
    } else {
      entries.push([parts[0].toUpperCase(), value])
    }
  }
  return { entries, badLines }
}

export default function ParametersView(): React.JSX.Element {
  const connection = useConnection()
  const params = useParams()
  const progress = useParamProgress()
  const [mode, setMode] = useState<'table' | 'raw'>('table')
  const [filter, setFilter] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, WriteStatus>>({})
  const [rawText, setRawText] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const pickChoice = useCallback((id: string, value: string) => setEdits((ed) => ({ ...ed, [id]: value })), [])

  const byId = useMemo(() => new Map(params.map((p) => [p.id, p])), [params])

  const filtered = useMemo(() => {
    const f = filter.trim().toUpperCase()
    if (!f) return params
    return params.filter((p) => p.id.includes(f))
  }, [params, filter])

  const dirtyIds = useMemo(
    () =>
      Object.keys(edits).filter((id) => {
        const p = byId.get(id)
        const n = Number(edits[id])
        return p !== undefined && edits[id].trim() !== '' && !Number.isNaN(n) && Math.fround(n) !== p.value
      }),
    [edits, byId]
  )

  if (connection.status !== 'connected') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
        Not connected — click Connect to link to your vehicle
      </div>
    )
  }

  const loading = progress.total > 0 && progress.received < progress.total

  async function writeMany(entries: [string, number][]): Promise<string[]> {
    const failed: string[] = []
    for (const [id, value] of entries) {
      setStatus((s) => ({ ...s, [id]: 'saving' }))
      const ok = await writeParam(id, value)
      setStatus((s) => ({ ...s, [id]: ok ? 'ok' : 'failed' }))
      if (ok) {
        setEdits((e) => {
          const next = { ...e }
          delete next[id]
          return next
        })
      } else {
        failed.push(id)
      }
    }
    return failed
  }

  async function saveOne(id: string): Promise<void> {
    const n = Number(edits[id])
    if (Number.isNaN(n) || edits[id].trim() === '') return
    setBusy(true)
    const failed = await writeMany([[id, n]])
    setMessage(
      failed.length
        ? { text: `${id}: vehicle did not confirm the new value`, ok: false }
        : { text: `${id} = ${formatValue(n)} confirmed by vehicle`, ok: true }
    )
    setBusy(false)
  }

  async function saveAllChanged(): Promise<void> {
    setBusy(true)
    const failed = await writeMany(dirtyIds.map((id) => [id, Number(edits[id])]))
    const okCount = dirtyIds.length - failed.length
    setMessage({
      text: failed.length
        ? `Wrote ${okCount} of ${dirtyIds.length}. Not confirmed: ${failed.join(', ')}`
        : `Wrote ${okCount} parameter${okCount === 1 ? '' : 's'}, all confirmed by vehicle`,
      ok: failed.length === 0
    })
    setBusy(false)
  }

  function enterRawMode(): void {
    setRawText(params.map((p) => `${p.id},${formatValue(p.value)}`).join('\n'))
    setMessage(null)
    setMode('raw')
  }

  async function applyRaw(): Promise<void> {
    const { entries, badLines } = parseParamText(rawText)
    const unknown = entries.filter(([id]) => !byId.has(id)).map(([id]) => id)
    const changed = entries.filter(([id, v]) => {
      const p = byId.get(id)
      return p !== undefined && Math.fround(v) !== p.value
    })
    if (changed.length === 0) {
      setMessage({ text: 'No changes to write', ok: true })
      return
    }
    setBusy(true)
    const failed = await writeMany(changed)
    const notes = [
      failed.length ? `not confirmed: ${failed.join(', ')}` : '',
      unknown.length ? `unknown, skipped: ${unknown.join(', ')}` : '',
      badLines.length ? `unparseable lines: ${badLines.length}` : ''
    ].filter(Boolean)
    setMessage({
      text: `Wrote ${changed.length - failed.length} of ${changed.length}` + (notes.length ? ` — ${notes.join('; ')}` : ''),
      ok: failed.length === 0 && unknown.length === 0 && badLines.length === 0
    })
    setBusy(false)
  }

  function exportFile(): void {
    const text = params.map((p) => `${p.id},${formatValue(p.value)}`).join('\n') + '\n'
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'vehicle.param'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(file: File): Promise<void> {
    setRawText(await file.text())
    setMessage({ text: `Loaded ${file.name} — review, then Apply to vehicle`, ok: true })
    setMode('raw')
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <ModeButton active={mode === 'table'} onClick={() => setMode('table')} left>
            Table
          </ModeButton>
          <ModeButton active={mode === 'raw'} onClick={enterRawMode}>
            Raw text
          </ModeButton>
        </div>

        {mode === 'table' && (
          <input
            placeholder="Filter parameters…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ ...inputStyle, width: 260 }}
          />
        )}

        <button onClick={() => window.api.requestParams()} style={secondaryBtn}>
          {progress.total > 0 && params.length >= progress.total ? 'Reload from vehicle' : 'Load parameters'}
        </button>
        <button onClick={() => fileInput.current?.click()} style={secondaryBtn}>
          Import .param
        </button>
        <button onClick={exportFile} disabled={params.length === 0} style={secondaryBtn}>
          Export .param
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".param,.parm,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importFile(f)
            e.target.value = ''
          }}
        />

        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 12 }}>
          {progress.total > 0 ? `${progress.received} / ${progress.total}` : `${params.length} loaded`}
        </span>

        {mode === 'table' && (
          <button
            onClick={() => void saveAllChanged()}
            disabled={dirtyIds.length === 0 || busy}
            style={{ ...primaryBtn, opacity: dirtyIds.length === 0 || busy ? 0.4 : 1 }}
          >
            Write {dirtyIds.length} changed
          </button>
        )}
        {mode === 'raw' && (
          <button onClick={() => void applyRaw()} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.4 : 1 }}>
            {busy ? 'Writing…' : 'Apply to vehicle'}
          </button>
        )}
      </div>

      {message && (
        <div style={{ fontSize: 12, color: message.ok ? 'var(--good)' : 'var(--warn)' }}>{message.text}</div>
      )}

      {loading && (
        <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${(progress.received / Math.max(1, progress.total)) * 100}%`,
              background: 'var(--accent)',
              transition: 'width 0.2s'
            }}
          />
        </div>
      )}

      {mode === 'raw' ? (
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          spellCheck={false}
          placeholder="NAME,VALUE — one per line. '#' starts a comment. Only changed values are written."
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            color: 'var(--text-0)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            lineHeight: 1.5
          }}
        />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
                <Th>Name</Th>
                <Th>Value</Th>
                <Th>Options</Th>
                <Th>Type</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const editValue = edits[p.id]
                const dirty = dirtyIds.includes(p.id)
                const st = status[p.id]
                const choices = paramChoices(p.id)
                const shown = editValue ?? formatValue(p.value)
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', color: 'var(--text-0)' }}>{p.id}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <input
                        value={editValue ?? formatValue(p.value)}
                        onChange={(e) => setEdits((ed) => ({ ...ed, [p.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && dirty && !busy) void saveOne(p.id)
                          if (e.key === 'Escape')
                            setEdits((ed) => {
                              const next = { ...ed }
                              delete next[p.id]
                              return next
                            })
                        }}
                        style={{
                          ...inputStyle,
                          width: 150,
                          padding: '4px 8px',
                          borderColor: dirty ? 'var(--warn)' : 'var(--border)',
                          fontFamily: 'var(--mono)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      {choices && <ChoiceSelect id={p.id} choices={choices} shown={shown} dirty={dirty} onPick={pickChoice} />}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--text-2)' }}>{TYPE_NAMES[p.type] ?? p.type}</td>
                    <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                      {dirty && st !== 'saving' && (
                        <button onClick={() => void saveOne(p.id)} disabled={busy} style={saveBtn}>
                          Write
                        </button>
                      )}
                      {st === 'saving' && <span style={{ color: 'var(--warn)', fontSize: 11 }}>Writing…</span>}
                      {!dirty && st === 'ok' && <span style={{ color: 'var(--good)', fontSize: 11 }}>✓ confirmed</span>}
                      {!dirty && st === 'failed' && <span style={{ color: 'var(--bad)', fontSize: 11 }}>not confirmed</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {params.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
              No parameters loaded yet — click "Load parameters".
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// The named choices for a parameter. There are over a thousand of these on the page and some lists have well over a
// hundred entries, so each one is plain text showing the current choice; the real dropdown only exists for the one
// that was clicked, and goes away again when a choice is made or the pointer moves elsewhere.
const ChoiceSelect = memo(function ChoiceSelect({
  id,
  choices,
  shown,
  dirty,
  onPick
}: {
  id: string
  choices: ParamChoice[]
  shown: string
  dirty: boolean
  onPick: (id: string, value: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const select = useRef<HTMLSelectElement>(null)
  const current = Math.fround(Number(shown))
  const matched = choices.find(([v]) => Math.fround(v) === current)
  const style: React.CSSProperties = {
    ...inputStyle,
    width: 300,
    padding: '4px 6px',
    fontSize: 12,
    borderColor: dirty ? 'var(--warn)' : 'var(--border)'
  }

  useEffect(() => {
    if (!open) return
    select.current?.focus()
    try {
      select.current?.showPicker()
    } catch {
      // the list still opens on the next click if the browser won't open it from here
    }
  }, [open])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Click to choose from the list"
        style={{ ...style, display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: matched ? 'var(--text-0)' : 'var(--text-2)' }}>
          {matched ? `${matched[0]} · ${matched[1]}` : `Other (${shown})`}
        </span>
        <span style={{ color: 'var(--text-2)' }}>▾</span>
      </button>
    )
  }

  return (
    <select
      ref={select}
      value={matched ? String(matched[0]) : 'other'}
      onChange={(e) => {
        onPick(id, e.target.value)
        setOpen(false)
      }}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
      style={style}
    >
      {!matched && (
        <option value="other" disabled>
          Other ({shown})
        </option>
      )}
      {choices.map(([value, label]) => (
        <option key={value} value={String(value)}>
          {value} · {label}
        </option>
      ))}
    </select>
  )
})

function ModeButton({
  active,
  onClick,
  left,
  children
}: {
  active: boolean
  onClick: () => void
  left?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        borderRadius: left ? '6px 0 0 6px' : '0 6px 6px 0',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-1)'
      }}
    >
      {children}
    </button>
  )
}

function Th({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        color: 'var(--text-2)',
        fontSize: 10,
        letterSpacing: 0.5,
        fontWeight: 600
      }}
    >
      {children}
    </th>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  color: 'var(--text-0)'
}

const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-1)'
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid var(--accent)',
  background: 'var(--accent-dim)',
  color: 'var(--accent)',
  fontWeight: 600
}

const saveBtn: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 4,
  border: '1px solid var(--good)',
  background: 'transparent',
  color: 'var(--good)',
  fontSize: 11
}

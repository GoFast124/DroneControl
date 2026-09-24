import { useEffect, useMemo, useRef, useState } from 'react'
import { useConnection, useParamMap, useParamProgress, writeParam } from '../store'

export type WriteStatus = 'saving' | 'ok' | 'failed'

// Loads the parameter list if it hasn't been loaded yet, so Setup/Tuning pages have something to show.
export function useEnsureParams(): { loaded: boolean; loading: boolean; progress: { received: number; total: number } } {
  const connection = useConnection()
  const params = useParamMap()
  const progress = useParamProgress()
  const connected = connection.status === 'connected'
  const complete = progress.total > 0 && params.size >= progress.total
  const loading = progress.total > 0 && params.size < progress.total
  const requests = useRef(0)

  // The vehicle can send a few parameters unprompted, so "some parameters present" doesn't mean the list is complete.
  useEffect(() => {
    if (!connected) {
      requests.current = 0
      return
    }
    if (!complete && requests.current === 0) {
      requests.current = 1
      void window.api.requestParams()
    }
  }, [connected, complete])

  // If a load stops making progress, ask once more.
  useEffect(() => {
    if (!connected || complete || requests.current === 0) return
    const timer = setTimeout(() => {
      if (requests.current < 2) {
        requests.current = 2
        void window.api.requestParams()
      }
    }, 8000)
    return () => clearTimeout(timer)
  }, [connected, complete, params.size])

  return { loaded: complete, loading, progress }
}

// Editable copy of parameters: edits stay local until written, and each write is confirmed by the vehicle.
export function useParamDraft() {
  const params = useParamMap()
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<Record<string, WriteStatus>>({})
  const [busy, setBusy] = useState(false)

  const dirtyIds = useMemo(
    () => Object.keys(draft).filter((id) => params.has(id) && Math.fround(draft[id]) !== params.get(id)!.value),
    [draft, params]
  )

  function value(id: string): number | undefined {
    return id in draft ? draft[id] : params.get(id)?.value
  }

  function set(id: string, v: number): void {
    setDraft((d) => ({ ...d, [id]: v }))
  }

  function revert(ids?: string[]): void {
    setDraft((d) => {
      if (!ids) return {}
      const next = { ...d }
      for (const id of ids) delete next[id]
      return next
    })
  }

  // Writes the given ids (default: everything edited). Returns the ids the vehicle did not confirm.
  async function writeAll(ids: string[] = dirtyIds): Promise<string[]> {
    setBusy(true)
    const failed: string[] = []
    for (const id of ids) {
      if (!(id in draft)) continue
      setStatus((s) => ({ ...s, [id]: 'saving' }))
      const ok = await writeParam(id, draft[id])
      setStatus((s) => ({ ...s, [id]: ok ? 'ok' : 'failed' }))
      if (ok) revert([id])
      else failed.push(id)
    }
    setBusy(false)
    return failed
  }

  return { value, set, revert, writeAll, dirtyIds, dirty: dirtyIds.length > 0, busy, status, has: (id: string) => params.has(id), vehicle: (id: string) => params.get(id)?.value }
}

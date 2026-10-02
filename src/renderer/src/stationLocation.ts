import { useEffect, useState } from 'react'
import type { StationLocationResult } from '../../shared/types'

// A found position is reused for a while (the computer isn't flying anywhere); a failure is only remembered briefly
// so that reopening the dashboard doesn't repeatedly ask the OS, but a fix to the problem is picked up soon.
const KEEP_FOUND_MS = 10 * 60 * 1000
const KEEP_FAILED_MS = 60 * 1000

let cached: { at: number; result: StationLocationResult } | null = null
let pending: Promise<StationLocationResult> | null = null

function lookup(): Promise<StationLocationResult> {
  if (cached && Date.now() - cached.at < (cached.result.ok ? KEEP_FOUND_MS : KEEP_FAILED_MS)) return Promise.resolve(cached.result)
  pending ??= window.api
    .getStationLocation()
    .catch((): StationLocationResult => ({ ok: false, error: 'Could not ask the system for the location' }))
    .then((result) => {
      cached = { at: Date.now(), result }
      return result
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export type StationLocationState = { status: 'idle' | 'loading' } | ({ status: 'found' } & Extract<StationLocationResult, { ok: true }>) | { status: 'failed'; error: string }

// The base station's position, looked up only while `enabled` (i.e. while the vehicle has no GPS fix of its own).
export function useStationLocation(enabled: boolean): StationLocationState {
  const [state, setState] = useState<StationLocationState>({ status: 'idle' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setState((s) => (s.status === 'found' ? s : { status: 'loading' }))
    void lookup().then((result) => {
      if (cancelled) return
      setState(result.ok ? { status: 'found', ...result } : { status: 'failed', error: result.error })
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}

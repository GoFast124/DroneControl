import { useSyncExternalStore } from 'react'
import { distanceMeters, newWaypoint } from '../../shared/mission'
import type { MissionItem } from '../../shared/mission'
import { DEFAULT_SURVEY_SETTINGS } from '../../shared/survey'
import type { LatLon, SurveySettings } from '../../shared/survey'
import type {
  ConnectionState,
  LogEntry,
  MissionProgress,
  ParamEntry,
  ParamProgress,
  SetupEvent,
  StatusMessage,
  TelemetryState,
  VehicleCommand
} from '../../shared/types'

interface AppState {
  connection: ConnectionState
  telemetry: TelemetryState
  params: Map<string, ParamEntry>
  paramProgress: ParamProgress
  logs: LogEntry[]
  messages: StatusMessage[]
  trail: [number, number][]
  mission: MissionEditor
  survey: SurveyEditor
}

export interface SurveyEditor {
  polygon: LatLon[]
  drawing: boolean // map clicks add corners
  settings: SurveySettings
}

export interface MissionEditor {
  items: MissionItem[]
  home: MissionItem | null
  selected: number | null
  defaultAlt: number
  // true when the editor differs from what was last read from / written to the vehicle
  dirty: boolean
  progress: MissionProgress | null
  busy: boolean
}

const MAX_LOGS = 500
const MAX_MESSAGES = 300

const SURVEY_SETTINGS_KEY = 'surveySettings'

// Camera and flight choices are remembered between sessions; anything missing or unreadable falls back to the defaults.
function loadSurveySettings(): SurveySettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SURVEY_SETTINGS_KEY) ?? 'null') as Partial<SurveySettings> | null
    if (stored && typeof stored === 'object') {
      return { ...DEFAULT_SURVEY_SETTINGS, ...stored, camera: { ...DEFAULT_SURVEY_SETTINGS.camera, ...stored.camera } }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SURVEY_SETTINGS
}

const state: AppState = {
  connection: { status: 'disconnected' },
  telemetry: { armed: false, flightMode: 'UNKNOWN' },
  params: new Map(),
  paramProgress: { received: 0, total: 0 },
  logs: [],
  messages: [],
  trail: [],
  mission: { items: [], home: null, selected: null, defaultAlt: 20, dirty: false, progress: null, busy: false },
  survey: { polygon: [], drawing: false, settings: loadSurveySettings() }
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

window.api.onConnectionState((connection) => {
  state.connection = connection
  if (connection.status === 'connecting' || connection.status === 'disconnected') {
    state.params = new Map()
    state.paramProgress = { received: 0, total: 0 }
    state.telemetry = { armed: false, flightMode: 'UNKNOWN' }
    state.trail = []
    state.mission = { ...state.mission, progress: null, busy: false }
  }
  if (connection.status === 'connecting') state.messages = []
  emit()
})

window.api.onTelemetry((telemetry) => {
  state.telemetry = telemetry
  const pos = telemetry.globalPosition
  if (pos && (pos.lat !== 0 || pos.lon !== 0)) {
    const last = state.trail[state.trail.length - 1]
    if (!last || distanceMeters(last[0], last[1], pos.lat, pos.lon) > 1.5) {
      state.trail = [...state.trail.slice(-2999), [pos.lat, pos.lon]]
    }
  }
  emit()
})

window.api.onParamProgress((progress) => {
  if (progress.received === 0 && progress.total === 0) state.params = new Map()
  state.paramProgress = progress
  emit()
})

window.api.onParamUpdate((param) => {
  const next = new Map(state.params)
  next.set(param.id, param)
  state.params = next
  emit()
})

export function pushMessage(text: string, severity = 3, source: StatusMessage['source'] = 'gcs'): void {
  state.messages = [...state.messages.slice(-(MAX_MESSAGES - 1)), { timestamp: Date.now(), severity, text, source }]
  emit()
}

window.api.onStatusMessage((msg) => pushMessage(msg.text, msg.severity, msg.source))

window.api.onLog((entry) => {
  const next = state.logs.length >= MAX_LOGS ? state.logs.slice(state.logs.length - MAX_LOGS + 1) : state.logs.slice()
  next.push(entry)
  state.logs = next
  emit()
})

void window.api.getConnectionState().then((c) => {
  state.connection = c
  emit()
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function paramMatches(id: string, value: number): boolean {
  const current = state.params.get(id)?.value
  if (current === undefined) return false
  const target = Math.fround(value)
  return Math.abs(current - target) <= Math.max(1e-6, Math.abs(target) * 1e-6)
}

// Resolves true once the vehicle echoes back the new value (PARAM_VALUE), false on timeout.
export async function writeParam(id: string, value: number): Promise<boolean> {
  const waitForAck = (ms: number): Promise<boolean> =>
    new Promise((resolve) => {
      if (paramMatches(id, value)) return resolve(true)
      const timer = setTimeout(() => {
        listeners.delete(check)
        resolve(false)
      }, ms)
      const check = (): void => {
        if (paramMatches(id, value)) {
          clearTimeout(timer)
          listeners.delete(check)
          resolve(true)
        }
      }
      listeners.add(check)
    })

  await window.api.setParam(id, value)
  if (await waitForAck(1500)) return true
  await window.api.setParam(id, value)
  return waitForAck(2000)
}

export function useConnection(): ConnectionState {
  return useSyncExternalStore(subscribe, () => state.connection)
}

// Re-renders only when the selected value changes, unlike useTelemetry() which re-renders on every update.
export function useTelemetrySelector<T>(select: (t: TelemetryState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state.telemetry))
}

export function useArmed(): boolean {
  return useTelemetrySelector((t) => t.armed)
}

export function getTelemetry(): TelemetryState {
  return state.telemetry
}

// Calls back on every store change without re-rendering anything. Returns an unsubscribe function.
export function subscribeToStore(listener: () => void): () => void {
  return subscribe(listener)
}

export function useTelemetry(): TelemetryState {
  return useSyncExternalStore(subscribe, () => state.telemetry)
}

export function useParams(): ParamEntry[] {
  const map = useSyncExternalStore(subscribe, () => state.params)
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id))
}

export function useParamProgress(): ParamProgress {
  return useSyncExternalStore(subscribe, () => state.paramProgress)
}

export function useLogs(): LogEntry[] {
  return useSyncExternalStore(subscribe, () => state.logs)
}

export function useMessages(): StatusMessage[] {
  return useSyncExternalStore(subscribe, () => state.messages)
}

export function useTrail(): [number, number][] {
  return useSyncExternalStore(subscribe, () => state.trail)
}

export function clearTrail(): void {
  state.trail = []
  emit()
}

export function useSurvey(): SurveyEditor {
  return useSyncExternalStore(subscribe, () => state.survey)
}

function setSurvey(patch: Partial<SurveyEditor>): void {
  state.survey = { ...state.survey, ...patch }
  emit()
}

export const surveyActions = {
  setDrawing(drawing: boolean): void {
    setSurvey({ drawing })
  },
  addPoint(lat: number, lon: number): void {
    setSurvey({ polygon: [...state.survey.polygon, [lat, lon]] })
  },
  movePoint(index: number, lat: number, lon: number): void {
    setSurvey({ polygon: state.survey.polygon.map((p, i) => (i === index ? [lat, lon] : p)) })
  },
  removePoint(index: number): void {
    setSurvey({ polygon: state.survey.polygon.filter((_, i) => i !== index) })
  },
  undoPoint(): void {
    setSurvey({ polygon: state.survey.polygon.slice(0, -1) })
  },
  clear(): void {
    setSurvey({ polygon: [], drawing: false })
  },
  updateSettings(patch: Partial<SurveySettings>): void {
    const settings = { ...state.survey.settings, ...patch }
    try {
      localStorage.setItem(SURVEY_SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // settings just won't be remembered
    }
    setSurvey({ settings })
  }
}

export function useMission(): MissionEditor {
  return useSyncExternalStore(subscribe, () => state.mission)
}

function setMission(patch: Partial<MissionEditor>): void {
  state.mission = { ...state.mission, ...patch }
  emit()
}

window.api.onMissionProgress((progress) => setMission({ progress }))

function errText(err: unknown): string {
  return (err as Error).message.replace(/^Error invoking remote method '[^']*': (Error: )?/, '')
}

export const missionActions = {
  addWaypoint(lat: number, lon: number): void {
    const m = state.mission
    setMission({ items: [...m.items, newWaypoint(lat, lon, m.defaultAlt)], selected: m.items.length, dirty: true })
  },
  addItem(item: MissionItem): void {
    const m = state.mission
    setMission({ items: [...m.items, item], selected: m.items.length, dirty: true })
  },
  updateItem(index: number, patch: Partial<MissionItem>): void {
    const items = state.mission.items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    setMission({ items, dirty: true })
  },
  removeItem(index: number): void {
    const m = state.mission
    const items = m.items.filter((_, i) => i !== index)
    setMission({ items, selected: m.selected === null || items.length === 0 ? null : Math.min(m.selected, items.length - 1), dirty: true })
  },
  moveItem(index: number, delta: -1 | 1): void {
    const items = [...state.mission.items]
    const target = index + delta
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    setMission({ items, selected: target, dirty: true })
  },
  select(index: number | null): void {
    setMission({ selected: index })
  },
  setDefaultAlt(alt: number): void {
    setMission({ defaultAlt: alt })
  },
  replaceAll(items: MissionItem[], home: MissionItem | null, dirty: boolean): void {
    setMission({ items, home, selected: null, dirty })
  },
  appendItems(items: MissionItem[]): void {
    const m = state.mission
    setMission({ items: [...m.items, ...items], selected: null, dirty: true })
  },
  clearEditor(): void {
    setMission({ items: [], selected: null, dirty: true })
  },

  async read(): Promise<void> {
    setMission({ busy: true, progress: null })
    try {
      const { home, items } = await window.api.missionDownload()
      setMission({ items, home, selected: null, dirty: false })
      pushMessage(`Read ${items.length} mission item${items.length === 1 ? '' : 's'} from vehicle`, 6)
    } catch (err) {
      pushMessage(`Mission read failed: ${errText(err)}`, 3)
    } finally {
      setMission({ busy: false, progress: null })
    }
  },
  async write(): Promise<void> {
    setMission({ busy: true, progress: null })
    try {
      await window.api.missionUpload(state.mission.items, state.mission.home)
      setMission({ dirty: false })
      pushMessage(`Wrote ${state.mission.items.length} mission item${state.mission.items.length === 1 ? '' : 's'} to vehicle`, 6)
    } catch (err) {
      pushMessage(`Mission write failed: ${errText(err)}`, 3)
    } finally {
      setMission({ busy: false, progress: null })
    }
  },
  async clearVehicle(): Promise<void> {
    setMission({ busy: true, progress: null })
    try {
      await window.api.missionClear()
      setMission({ items: [], selected: null, dirty: false })
      pushMessage('Vehicle mission cleared', 6)
    } catch (err) {
      pushMessage(`Mission clear failed: ${errText(err)}`, 3)
    } finally {
      setMission({ busy: false })
    }
  },
  async setActive(seq: number): Promise<void> {
    try {
      await window.api.missionSetCurrent(seq)
    } catch (err) {
      pushMessage(`Set active waypoint failed: ${errText(err)}`, 3)
    }
  }
}

export function useParamMap(): Map<string, ParamEntry> {
  return useSyncExternalStore(subscribe, () => state.params)
}

// Sends a vehicle command and reports failures in the messages panel. Resolves true on success.
export async function runCommand(cmd: VehicleCommand): Promise<boolean> {
  try {
    await window.api.sendCommand(cmd)
    return true
  } catch (err) {
    pushMessage(errText(err), 3)
    return false
  }
}

// ---- calibration progress (accelerometer prompts, compass calibration) ----

export interface MagCalState {
  status: number
  attempt: number
  percent: number
  mask: number[]
  report?: { status: number; fitness: number; autosaved: boolean; offsets: [number, number, number] }
}

export interface SetupState {
  accelPosition: number | null // last position the vehicle asked for (16777215 success, 16777216 failed)
  mag: Record<number, MagCalState>
}

const EMPTY_SETUP: SetupState = { accelPosition: null, mag: {} }
let setupState: SetupState = EMPTY_SETUP

function handleSetupEvent(event: SetupEvent): void {
  if (event.type === 'accelPosition') {
    setupState = { ...setupState, accelPosition: event.position }
  } else if (event.type === 'magProgress') {
    const prev = setupState.mag[event.compassId]
    setupState = {
      ...setupState,
      mag: { ...setupState.mag, [event.compassId]: { ...prev, status: event.status, attempt: event.attempt, percent: event.percent, mask: event.mask } }
    }
  } else {
    const prev = setupState.mag[event.compassId] ?? { status: event.status, attempt: 0, percent: 100, mask: [] }
    setupState = {
      ...setupState,
      mag: {
        ...setupState.mag,
        [event.compassId]: { ...prev, status: event.status, report: { status: event.status, fitness: event.fitness, autosaved: event.autosaved, offsets: event.offsets } }
      }
    }
  }
  emit()
}

window.api.onSetupEvent(handleSetupEvent)

export function resetSetupState(): void {
  setupState = EMPTY_SETUP
  emit()
}

export function useSetupState(): SetupState {
  return useSyncExternalStore(subscribe, () => setupState)
}

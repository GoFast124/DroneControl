import { useMemo, useRef, useState } from 'react'
import MissionMap from '../components/MissionMap'
import NumberField from '../components/NumberField'
import {
  commandInfo,
  FRAME_ABSOLUTE,
  FRAME_MISSION,
  FRAME_RELATIVE,
  FRAME_TERRAIN,
  isMappable,
  MISSION_COMMANDS,
  missionDistance,
  parseWaypoints,
  serializeWaypoints
} from '../../../shared/mission'
import type { MissionItem } from '../../../shared/mission'
import SurveyPanel from '../survey/SurveyPanel'
import { clearTrail, missionActions, pushMessage, surveyActions, useConnection, useMission, useSurvey, useTelemetry } from '../store'

type Confirm = 'clear' | 'auto' | null

const QUICK_ADD: { label: string; make: (alt: number) => MissionItem }[] = [
  { label: 'Takeoff', make: (alt) => ({ command: 22, frame: FRAME_RELATIVE, param1: 0, param2: 0, param3: 0, param4: 0, lat: 0, lon: 0, alt }) },
  { label: 'Land here', make: () => ({ command: 21, frame: FRAME_RELATIVE, param1: 0, param2: 0, param3: 0, param4: 0, lat: 0, lon: 0, alt: 0 }) },
  { label: 'Return to launch', make: () => ({ command: 20, frame: FRAME_MISSION, param1: 0, param2: 0, param3: 0, param4: 0, lat: 0, lon: 0, alt: 0 }) },
  { label: 'Change speed', make: () => ({ command: 178, frame: FRAME_MISSION, param1: 1, param2: 5, param3: -1, param4: 0, lat: 0, lon: 0, alt: 0 }) }
]

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

export default function MissionView(): React.JSX.Element {
  const connection = useConnection()
  const telemetry = useTelemetry()
  const mission = useMission()
  const [addMode, setAddMode] = useState(false)
  const [follow, setFollow] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [panel, setPanel] = useState<'waypoints' | 'survey'>('waypoints')
  const survey = useSurvey()
  const fileInput = useRef<HTMLInputElement>(null)

  const connected = connection.status === 'connected'
  const distance = useMemo(() => {
    const anchor = mission.home && (mission.home.lat !== 0 || mission.home.lon !== 0) ? mission.home : null
    return missionDistance(mission.items, anchor)
  }, [mission.items, mission.home])

  function exportFile(): void {
    const url = URL.createObjectURL(new Blob([serializeWaypoints(mission.items, mission.home)], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'mission.waypoints'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(file: File): Promise<void> {
    try {
      const { home, items } = parseWaypoints(await file.text())
      missionActions.replaceAll(items, home, true)
      pushMessage(`Loaded ${items.length} item${items.length === 1 ? '' : 's'} from ${file.name} (not yet written to vehicle)`, 6)
    } catch (err) {
      pushMessage(`Import failed: ${(err as Error).message}`, 3)
    }
  }

  async function startMission(): Promise<void> {
    setConfirm(null)
    try {
      await window.api.sendCommand({ type: 'setMode', mode: 3 })
    } catch (err) {
      pushMessage((err as Error).message, 3)
    }
  }

  function showPanel(next: 'waypoints' | 'survey'): void {
    setPanel(next)
    if (next === 'waypoints') surveyActions.setDrawing(false)
    else setAddMode(false)
  }

  const progress = mission.progress
  const busyText = mission.busy
    ? progress
      ? `${progress.op === 'upload' ? 'Writing' : 'Reading'} ${progress.done}/${progress.total}…`
      : 'Working…'
    : null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MissionMap addMode={addMode} follow={follow} surveyActive={panel === 'survey'} />
        <div style={{ position: 'absolute', top: 12, left: 56, zIndex: 1000, display: 'flex', gap: 8 }}>
          <MapButton
            active={addMode}
            onClick={() => {
              setAddMode(!addMode)
              surveyActions.setDrawing(false)
            }}
          >
            {addMode ? '✚ Click map to add waypoints' : '✚ Add waypoints'}
          </MapButton>
          <MapButton
            active={survey.drawing}
            onClick={() => {
              setPanel('survey')
              setAddMode(false)
              surveyActions.setDrawing(!survey.drawing)
            }}
          >
            {survey.drawing ? '⬠ Click map to draw the survey area' : '⬠ Draw survey area'}
          </MapButton>
          <MapButton active={follow} onClick={() => setFollow(!follow)}>
            Follow vehicle
          </MapButton>
          <MapButton onClick={clearTrail}>Clear trail</MapButton>
        </div>
      </div>

      <div
        style={{
          width: 440,
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          background: 'var(--bg-1)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          <PanelTab active={panel === 'waypoints'} onClick={() => showPanel('waypoints')}>
            Waypoints
          </PanelTab>
          <PanelTab active={panel === 'survey'} onClick={() => showPanel('survey')}>
            Survey grid
          </PanelTab>
        </div>

        {panel === 'survey' ? (
          <SurveyPanel onGenerated={() => showPanel('waypoints')} />
        ) : (
          <>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => void missionActions.read()} disabled={!connected || mission.busy} style={btn}>
              Read from vehicle
            </button>
            <button
              onClick={() => void missionActions.write()}
              disabled={!connected || mission.busy || mission.items.length === 0}
              style={{ ...btn, borderColor: 'var(--accent)', color: 'var(--accent)', background: mission.dirty ? 'var(--accent-dim)' : 'transparent' }}
            >
              Write to vehicle
            </button>
            <button onClick={() => setConfirm('clear')} disabled={!connected || mission.busy} style={btn}>
              Clear vehicle
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => fileInput.current?.click()} style={btn}>
              Import .waypoints
            </button>
            <button onClick={exportFile} disabled={mission.items.length === 0} style={btn}>
              Export .waypoints
            </button>
            <button onClick={() => missionActions.clearEditor()} disabled={mission.items.length === 0} style={btn}>
              Clear editor
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".waypoints,.txt,.wp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importFile(f)
                e.target.value = ''
              }}
            />
          </div>

          {confirm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--warn)', fontWeight: 600 }}>
                {confirm === 'clear' ? 'Erase the mission on the vehicle?' : 'Switch to AUTO and fly the mission?'}
              </span>
              <button
                onClick={() => {
                  if (confirm === 'clear') void missionActions.clearVehicle()
                  else void startMission()
                  setConfirm(null)
                }}
                style={{ ...btn, borderColor: 'var(--bad)', color: 'var(--bad)' }}
              >
                Confirm
              </button>
              <button onClick={() => setConfirm(null)} style={btn}>
                Cancel
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-1)' }}>
            <span>Default alt</span>
            <NumberField value={mission.defaultAlt} onChange={missionActions.setDefaultAlt} width={60} />
            <span>m</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setConfirm('auto')} disabled={!connected || mission.busy || telemetry.flightMode === 'AUTO'} style={btn}>
              Start mission (AUTO)
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', gap: 12 }}>
            <span>
              {mission.items.length} item{mission.items.length === 1 ? '' : 's'}
            </span>
            <span>{formatDistance(distance)}</span>
            {mission.dirty && <span style={{ color: 'var(--warn)' }}>● unsaved changes</span>}
            {busyText && <span style={{ color: 'var(--accent)' }}>{busyText}</span>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mission.items.map((item, i) => (
            <Row key={i} item={item} index={i} selected={mission.selected === i} current={telemetry.missionCurrent === i + 1} canActivate={connected} total={mission.items.length} />
          ))}
          {mission.items.length === 0 && (
            <div style={{ color: 'var(--text-2)', textAlign: 'center', padding: 24, lineHeight: 1.6 }}>
              No waypoints yet. Turn on “Add waypoints” and click the map, read the mission from the vehicle, or import a
              .waypoints file.
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Add:</span>
          {QUICK_ADD.map((q) => (
            <button key={q.label} onClick={() => missionActions.addItem(q.make(mission.defaultAlt))} style={{ ...btn, padding: '4px 10px', fontSize: 12 }}>
              {q.label}
            </button>
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  )
}

function PanelTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 0',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        background: 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-1)',
        fontWeight: 600
      }}
    >
      {children}
    </button>
  )
}

function Row({
  item,
  index,
  selected,
  current,
  canActivate,
  total
}: {
  item: MissionItem
  index: number
  selected: boolean
  current: boolean
  canActivate: boolean
  total: number
}): React.JSX.Element {
  const info = commandInfo(item.command)
  const unplaced = info.hasPosition && !isMappable(item)

  function changeCommand(id: number): void {
    const next = commandInfo(id)
    if (next.hasPosition) {
      missionActions.updateItem(index, { command: id, frame: item.frame === FRAME_MISSION ? FRAME_RELATIVE : item.frame })
    } else {
      missionActions.updateItem(index, { command: id, frame: FRAME_MISSION, lat: 0, lon: 0, alt: 0 })
    }
  }

  return (
    <div
      onClick={() => missionActions.select(index)}
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${selected ? 'var(--accent)' : current ? 'var(--good)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            minWidth: 26,
            textAlign: 'center',
            borderRadius: 10,
            padding: '2px 6px',
            fontWeight: 700,
            fontSize: 12,
            background: current ? 'var(--good)' : 'var(--bg-3)',
            color: current ? '#06210f' : 'var(--text-0)'
          }}
        >
          {index + 1}
        </span>
        <select
          value={item.command}
          onChange={(e) => changeCommand(Number(e.target.value))}
          style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', color: 'var(--text-0)' }}
        >
          {!MISSION_COMMANDS.some((c) => c.id === item.command) && <option value={item.command}>{info.name}</option>}
          {MISSION_COMMANDS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {canActivate && (
          <IconButton title="Make this the active waypoint" onClick={() => void missionActions.setActive(index + 1)}>
            ▶
          </IconButton>
        )}
        <IconButton title="Move up" disabled={index === 0} onClick={() => missionActions.moveItem(index, -1)}>
          ↑
        </IconButton>
        <IconButton title="Move down" disabled={index === total - 1} onClick={() => missionActions.moveItem(index, 1)}>
          ↓
        </IconButton>
        <IconButton title="Delete" onClick={() => missionActions.removeItem(index)}>
          ✕
        </IconButton>
      </div>

      {info.hasPosition && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Labeled label="Lat">
            <NumberField value={item.lat} onChange={(lat) => missionActions.updateItem(index, { lat })} width={92} />
          </Labeled>
          <Labeled label="Lon">
            <NumberField value={item.lon} onChange={(lon) => missionActions.updateItem(index, { lon })} width={92} />
          </Labeled>
          <Labeled label="Alt">
            <NumberField value={item.alt} onChange={(alt) => missionActions.updateItem(index, { alt })} width={56} />
          </Labeled>
          <select
            value={item.frame}
            onChange={(e) => missionActions.updateItem(index, { frame: Number(e.target.value) })}
            title="Altitude reference"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 4px', color: 'var(--text-1)', fontSize: 11 }}
          >
            <option value={FRAME_RELATIVE}>Rel home</option>
            <option value={FRAME_ABSOLUTE}>Abs MSL</option>
            <option value={FRAME_TERRAIN}>Terrain</option>
          </select>
        </div>
      )}
      {unplaced && (
        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
          {item.lat === 0 && item.lon === 0 && (item.command === 22 || item.command === 21)
            ? 'At current position — not drawn on the map'
            : 'No position set — not drawn on the map'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['param1', 'param2', 'param3', 'param4'] as const).map((key, n) =>
          info.params[n] ? (
            <Labeled key={key} label={info.params[n]}>
              <NumberField value={item[key]} onChange={(v) => missionActions.updateItem(index, { [key]: v })} width={70} />
            </Labeled>
          ) : null
        )}
      </div>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--text-2)' }}>
      {label}
      {children}
    </label>
  )
}

function IconButton({
  children,
  onClick,
  title,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{ width: 26, height: 26, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-1)', padding: 0 }}
    >
      {children}
    </button>
  )
}

function MapButton({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px',
        borderRadius: 6,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-dim)' : 'rgba(10,14,20,0.85)',
        color: active ? 'var(--accent)' : 'var(--text-0)',
        fontWeight: 600
      }}
    >
      {children}
    </button>
  )
}

const btn: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-0)'
}

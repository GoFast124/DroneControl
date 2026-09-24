import { useState } from 'react'
import NumberField from '../components/NumberField'
import { buildSurveyItems, cameraGeometry, CAMERA_PRESETS, computeCoverage, validateSettings } from '../../../shared/survey'
import type { SurveyCamera } from '../../../shared/survey'
import { missionActions, pushMessage, surveyActions, useMission, useSurvey } from '../store'
import { useSurveyPlan } from './useSurveyPlan'

function sameCamera(a: SurveyCamera, b: SurveyCamera): boolean {
  return (Object.keys(a) as (keyof SurveyCamera)[]).every((k) => a[k] === b[k])
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function formatDuration(sec: number): string {
  const min = Math.round(sec / 60)
  return min < 1 ? '< 1 min' : min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

// Survey grid planner: draw an area on the map, describe the camera and overlap, and turn it into a mission.
export default function SurveyPanel({ onGenerated }: { onGenerated: () => void }): React.JSX.Element {
  const survey = useSurvey()
  const mission = useMission()
  const result = useSurveyPlan()
  const [confirmReplace, setConfirmReplace] = useState(false)
  const s = survey.settings
  const cam = s.camera
  const set = surveyActions.updateSettings
  const setCam = (patch: Partial<SurveyCamera>): void => set({ camera: { ...cam, ...patch } })

  const settingsError = validateSettings(s)
  const coverage = settingsError ? null : computeCoverage(s)
  const geometry = settingsError ? null : cameraGeometry(cam, s.orientation)
  const plan = result?.plan
  const presetIndex = CAMERA_PRESETS.findIndex((p) => sameCamera(p.camera, cam))

  function switchCameraMode(mode: SurveyCamera['mode']): void {
    if (mode === cam.mode) return
    // Carry the current field of view across so the numbers don't jump.
    const hFov = cam.mode === 'sensor' && !settingsError ? Math.round(cameraGeometry({ ...cam, mode: 'sensor' }, 'landscape').acrossFovDeg * 10) / 10 : cam.hFovDeg
    setCam({ mode, hFovDeg: hFov })
  }

  function generate(replace: boolean): void {
    if (!plan) return
    const items = buildSurveyItems(plan, s)
    if (replace) missionActions.replaceAll(items, mission.home, true)
    else missionActions.appendItems(items)
    setConfirmReplace(false)
    surveyActions.setDrawing(false)
    pushMessage(`Survey: ${replace ? 'replaced the mission with' : 'added'} ${items.length} items (${plan.lines} lines, about ${plan.photos} photos). Not yet written to the vehicle.`, 6)
    onGenerated()
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title="Survey area">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => surveyActions.setDrawing(!survey.drawing)}
            style={{ ...btn, borderColor: survey.drawing ? 'var(--accent)' : 'var(--border)', color: survey.drawing ? 'var(--accent)' : 'var(--text-0)', background: survey.drawing ? 'var(--accent-dim)' : 'transparent' }}
          >
            {survey.drawing ? 'Finish drawing' : survey.polygon.length ? 'Add corners' : 'Draw area'}
          </button>
          <button onClick={() => surveyActions.undoPoint()} disabled={survey.polygon.length === 0} style={btn}>
            Undo corner
          </button>
          <button onClick={() => surveyActions.clear()} disabled={survey.polygon.length === 0} style={btn}>
            Clear area
          </button>
        </div>
        <Hint>
          {survey.drawing
            ? 'Click the map to place each corner of the area, then press Finish drawing.'
            : survey.polygon.length
              ? `${survey.polygon.length} corner${survey.polygon.length === 1 ? '' : 's'}${plan ? ` · ${plan.areaHa.toFixed(2)} ha` : ''}. Drag a corner to move it, right-click to remove it.`
              : 'Press Draw area, then click the map to outline the area to photograph.'}
        </Hint>
      </Section>

      <Section title="Camera">
        <Field label="Camera">
          <select
            value={presetIndex === -1 ? 'custom' : presetIndex}
            onChange={(e) => {
              if (e.target.value !== 'custom') setCam(CAMERA_PRESETS[Number(e.target.value)].camera)
            }}
            style={input}
          >
            {presetIndex === -1 && <option value="custom">Custom</option>}
            {CAMERA_PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Segmented
          value={cam.mode}
          onChange={switchCameraMode}
          options={[
            { value: 'sensor', label: 'Sensor and lens' },
            { value: 'fov', label: 'Field of view' }
          ]}
        />
        <Row>
          {cam.mode === 'sensor' ? (
            <>
              <Field label="Sensor width (mm)">
                <NumberField value={cam.sensorWidthMm} onChange={(v) => setCam({ sensorWidthMm: v })} width={80} />
              </Field>
              <Field label="Sensor height (mm)">
                <NumberField value={cam.sensorHeightMm} onChange={(v) => setCam({ sensorHeightMm: v })} width={80} />
              </Field>
              <Field label="Focal length (mm)">
                <NumberField value={cam.focalLengthMm} onChange={(v) => setCam({ focalLengthMm: v })} width={80} />
              </Field>
            </>
          ) : (
            <Field label="Horizontal field of view (°)">
              <NumberField value={cam.hFovDeg} onChange={(v) => setCam({ hFovDeg: v })} width={80} />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="Image width (px)">
            <NumberField value={cam.imageWidthPx} onChange={(v) => setCam({ imageWidthPx: v })} width={80} />
          </Field>
          <Field label="Image height (px)">
            <NumberField value={cam.imageHeightPx} onChange={(v) => setCam({ imageHeightPx: v })} width={80} />
          </Field>
          <Field label="Mounted">
            <select value={s.orientation} onChange={(e) => set({ orientation: e.target.value as 'landscape' | 'portrait' })} style={input}>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </Field>
        </Row>
        <Hint>
          {geometry
            ? `Field of view ${geometry.acrossFovDeg.toFixed(1)}° across the flight lines × ${geometry.alongFovDeg.toFixed(1)}° along them. The long side of the image is across the lines when landscape.`
            : settingsError}
        </Hint>
      </Section>

      <Section title="Overlap and height">
        <Row>
          <Field label="Front overlap (%)">
            <NumberField value={s.frontOverlap} onChange={(v) => set({ frontOverlap: v })} width={80} />
          </Field>
          <Field label="Side overlap (%)">
            <NumberField value={s.sideOverlap} onChange={(v) => set({ sideOverlap: v })} width={80} />
          </Field>
        </Row>
        <Segmented
          value={s.heightMode}
          onChange={(heightMode) => set({ heightMode })}
          options={[
            { value: 'altitude', label: 'Set altitude' },
            { value: 'gsd', label: 'Set resolution (GSD)' }
          ]}
        />
        <Row>
          {s.heightMode === 'altitude' ? (
            <Field label="Altitude (m)">
              <NumberField value={s.altitude} onChange={(v) => set({ altitude: v })} width={80} />
            </Field>
          ) : (
            <Field label="Ground sample distance (cm/px)">
              <NumberField value={s.gsdCm} onChange={(v) => set({ gsdCm: v })} width={80} />
            </Field>
          )}
        </Row>
        {coverage && (
          <div style={readout}>
            <Stat label="Altitude" value={`${coverage.altitude.toFixed(1)} m`} />
            <Stat label="GSD" value={`${coverage.gsdCm.toFixed(2)} cm/px`} />
            <Stat label="Photo covers" value={`${coverage.acrossM.toFixed(0)} × ${coverage.alongM.toFixed(0)} m`} />
            <Stat label="Line spacing" value={`${coverage.lineSpacing.toFixed(1)} m`} />
            <Stat label="Photo every" value={`${coverage.triggerDistance.toFixed(1)} m`} />
            <Stat label="At flight speed" value={`${coverage.shutterInterval.toFixed(1)} s`} />
          </div>
        )}
      </Section>

      <Section title="Flight">
        <Row>
          <Field label="Line direction">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Check checked={s.angleAuto} onChange={(angleAuto) => set({ angleAuto })} label="Auto" />
              <NumberField value={s.angleAuto && plan ? plan.angle : s.angle} onChange={(v) => set({ angle: v, angleAuto: false })} width={64} />
              <span style={{ color: 'var(--text-2)' }}>°</span>
            </div>
          </Field>
          <Field label="Speed (m/s)">
            <NumberField value={s.speed} onChange={(v) => set({ speed: v })} width={64} />
          </Field>
          <Field label="Overshoot (m)">
            <NumberField value={s.overshoot} onChange={(v) => set({ overshoot: v })} width={64} />
          </Field>
          <Field label="Fastest shutter (s)">
            <NumberField value={s.minShutterInterval} onChange={(v) => set({ minShutterInterval: v })} width={64} />
          </Field>
        </Row>
        <Check checked={s.crosshatch} onChange={(crosshatch) => set({ crosshatch })} label="Crosshatch: fly a second pass at 90° (better for 3D models)" />
        <Check checked={s.triggerOnLinesOnly} onChange={(triggerOnLinesOnly) => set({ triggerOnLinesOnly })} label="Only trigger the camera on the lines, not in the turns" />
        <Check checked={s.terrainFrame} onChange={(terrainFrame) => set({ terrainFrame })} label="Follow terrain (altitude above ground, needs terrain data on the vehicle)" />
        <Check checked={s.addTakeoff} onChange={(addTakeoff) => set({ addTakeoff })} label="Start with a takeoff" />
        <Check checked={s.addRtl} onChange={(addRtl) => set({ addRtl })} label="Finish with return to launch" />
      </Section>

      <Section title="Result">
        {result === null && <Hint>Draw an area to see the flight plan.</Hint>}
        {result?.error && <div style={{ color: 'var(--warn)', fontSize: 12 }}>{result.error}</div>}
        {plan && (
          <>
            <div style={readout}>
              <Stat label="Area" value={`${plan.areaHa.toFixed(2)} ha`} />
              <Stat label="Flight lines" value={`${plan.lines}${s.crosshatch ? ' (both passes)' : ''}`} />
              <Stat label="Direction" value={`${plan.angle}°`} />
              <Stat label="Distance" value={formatDistance(plan.totalLengthM)} />
              <Stat label="Flight time" value={`≈ ${formatDuration(plan.timeSec)}`} />
              <Stat label="Photos" value={`≈ ${plan.photos}`} />
              <Stat label="Mission items" value={String(plan.itemCount)} />
            </div>
            {plan.warnings.map((w) => (
              <div key={w} style={{ color: 'var(--warn)', fontSize: 12 }}>
                ⚠ {w}
              </div>
            ))}
            <Hint>Flight time is the survey only, without takeoff or the return leg, and no battery reserve. Check it against your battery.</Hint>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {confirmReplace ? (
            <>
              <span style={{ color: 'var(--warn)', fontWeight: 600, fontSize: 12 }}>Replace the {mission.items.length} items in the editor?</span>
              <button onClick={() => generate(true)} style={{ ...btn, borderColor: 'var(--bad)', color: 'var(--bad)' }}>
                Replace
              </button>
              <button onClick={() => setConfirmReplace(false)} style={btn}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => (mission.items.length ? setConfirmReplace(true) : generate(true))}
                disabled={!plan}
                style={{ ...btn, borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                Create mission
              </button>
              <button onClick={() => generate(false)} disabled={!plan || mission.items.length === 0} style={btn}>
                Add to current mission
              </button>
            </>
          )}
        </div>
        <Hint>This only fills the mission editor. Check it on the map, then use Write to vehicle from the Waypoints tab.</Hint>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{title.toUpperCase()}</div>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: 'var(--text-2)' }}>
      {label}
      {children}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>{children}</div>
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): React.JSX.Element {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-1)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }): React.JSX.Element {
  return (
    <div style={{ display: 'flex' }}>
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            ...btn,
            flex: 1,
            borderRadius: i === 0 ? '6px 0 0 6px' : i === options.length - 1 ? '0 6px 6px 0' : 0,
            marginLeft: i ? -1 : 0,
            borderColor: value === o.value ? 'var(--accent)' : 'var(--border)',
            color: value === o.value ? 'var(--accent)' : 'var(--text-1)',
            background: value === o.value ? 'var(--accent-dim)' : 'transparent'
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-0)',
  fontSize: 12
}

const input: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '5px 6px',
  color: 'var(--text-0)'
}

const readout: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '8px 12px',
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 10
}

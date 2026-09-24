import { useState } from 'react'
import NumberField from '../components/NumberField'
import { pushMessage, runCommand, useTelemetry, writeParam } from '../store'
import { btn, Card, dangerBtn, Notice, ParamNumber, ParamSelect, primaryBtn, WriteBar } from './ui'
import type { Draft } from './ui'
import FrameDiagram, { FrameLegend } from './FrameDiagram'
import { frameLabel, frameTypeDef } from './frames'
import { MOT_PWM_TYPES } from './paramMeta'

const LETTERS = 'ABCDEFGHIJKL'

export default function MotorsTab({ draft }: { draft: Draft }): React.JSX.Element {
  const telemetry = useTelemetry()
  const armed = telemetry.armed
  const frameClass = draft.vehicle('FRAME_CLASS')
  const frameType = draft.vehicle('FRAME_TYPE')
  const frame = frameTypeDef(frameClass, frameType)
  const detected = frame?.motors.length
  const [motorCount, setMotorCount] = useState<number | null>(null)
  const count = motorCount ?? detected ?? 4
  const [propsOff, setPropsOff] = useState(false)
  const [throttle, setThrottle] = useState(5)
  const [duration, setDuration] = useState(2)
  const [escConfirm, setEscConfirm] = useState(false)
  const [escSet, setEscSet] = useState(false)
  const canTest = propsOff && !armed

  function test(motor: number, motors = 1): void {
    void runCommand({ type: 'motorTest', motor, throttlePercent: throttle, durationSec: duration, count: motors })
  }

  async function enableEscCalibration(): Promise<void> {
    setEscConfirm(false)
    const ok = await writeParam('ESC_CALIBRATION', 3)
    setEscSet(ok)
    pushMessage(ok ? 'ESC_CALIBRATION set to 3 — power-cycle the aircraft to calibrate' : 'ESC_CALIBRATION was not confirmed by the vehicle', ok ? 6 : 3)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card title="Frame and motor outputs">
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--text-1)' }}>
          <span>
            Frame: <b style={{ color: 'var(--text-0)' }}>{frameLabel(frameClass, frameType)}</b> (change it on the Frame type page)
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            ESC protocol <ParamSelect draft={draft} id="MOT_PWM_TYPE" options={MOT_PWM_TYPES} width={110} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--text-1)' }}>
          <label>
            Spin when armed <ParamNumber draft={draft} id="MOT_SPIN_ARM" width={60} />
          </label>
          <label>
            Spin minimum <ParamNumber draft={draft} id="MOT_SPIN_MIN" width={60} />
          </label>
          <label>
            Spin maximum <ParamNumber draft={draft} id="MOT_SPIN_MAX" width={60} />
          </label>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Spin values are fractions of full throttle (0.10 = 10%).</span>
      </Card>

      <Card title="Motor test">
        <Notice tone="bad">
          Remove ALL propellers before running a motor test. Motors will spin. Keep hands and loose items clear.
        </Notice>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <input type="checkbox" checked={propsOff} onChange={(e) => setPropsOff(e.target.checked)} />I have removed the propellers
        </label>
        {armed && <Notice tone="warn">Disarm the vehicle to run a motor test.</Notice>}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {frame && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <FrameDiagram motors={frame.motors} size={260} onMotor={(m) => test(m.order)} disabled={!canTest} />
              <FrameLegend hasDirections={frame.motors.some((m) => m.dir !== 0)} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12, color: 'var(--text-1)' }}>
              <label>
                Throttle % <NumberField value={throttle} onChange={(v) => setThrottle(Math.max(0, Math.min(30, v)))} width={50} />
              </label>
              <label>
                Duration s <NumberField value={duration} onChange={(v) => setDuration(Math.max(0.5, Math.min(10, v)))} width={50} />
              </label>
              <label>
                Motors <NumberField value={count} onChange={(v) => setMotorCount(Math.max(1, Math.min(12, Math.round(v))))} width={44} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Array.from({ length: count }, (_, i) => (
                <button key={i} style={btn} disabled={!canTest} onClick={() => test(i + 1)}>
                  Motor {LETTERS[i]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={primaryBtn} disabled={!canTest} onClick={() => test(1, count)}>
                Test all in sequence
              </button>
              <button style={dangerBtn} onClick={() => void runCommand({ type: 'motorTestStop' })}>
                Stop
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-2)', maxWidth: 420 }}>
              Motors are tested in ArduPilot’s order: A, B, C… running clockwise from the front. Check each spins the right way for your frame diagram, and that the
              letter you pressed is the motor you expect. Throttle is capped at 30% here.
            </span>
          </div>
        </div>
      </Card>

      <Card title="ESC calibration">
        <Notice tone="warn">
          Only for ESCs that need their throttle range taught. Remove propellers. Setting this parameter does nothing until the next power-up: then unplug USB and
          battery, plug in the battery only, and the ESCs will beep and calibrate. The parameter clears itself afterwards.
        </Notice>
        {!escConfirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={btn} disabled={!draft.has('ESC_CALIBRATION') || armed} onClick={() => setEscConfirm(true)}>
              Enable ESC calibration on next power-up
            </button>
            {escSet && <span style={{ color: 'var(--good)', fontSize: 12 }}>ESC_CALIBRATION = 3 confirmed. Now power-cycle the aircraft (battery only).</span>}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--warn)', fontWeight: 600 }}>Propellers removed? Set ESC_CALIBRATION = 3.</span>
            <button style={dangerBtn} onClick={() => void enableEscCalibration()}>
              Set it
            </button>
            <button style={btn} onClick={() => setEscConfirm(false)}>
              Cancel
            </button>
          </div>
        )}
      </Card>

      <WriteBar draft={draft} />
    </div>
  )
}

import AttitudeIndicator from '../components/hud/AttitudeIndicator'
import { resetSetupState, runCommand, useSetupState, useTelemetry } from '../store'
import CalLog from './CalLog'
import { btn, Card, Notice, primaryBtn, WriteBar } from './ui'
import type { Draft } from './ui'
import { ACCEL_FAILED, ACCEL_POSITIONS, ACCEL_SUCCESS } from './paramMeta'

export default function AttitudeTab({ draft }: { draft: Draft }): React.JSX.Element {
  const telemetry = useTelemetry()
  const { accelPosition } = useSetupState()
  const att = telemetry.attitude
  const armed = telemetry.armed
  const deg = (r: number | undefined): string => (r === undefined ? '—' : ((r * 180) / Math.PI).toFixed(1) + '°')
  const accelRunning = accelPosition !== null && accelPosition !== ACCEL_SUCCESS && accelPosition !== ACCEL_FAILED
  const trimX = draft.value('AHRS_TRIM_X')
  const trimY = draft.value('AHRS_TRIM_Y')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {armed && <Notice tone="bad">The vehicle is armed. Disarm before calibrating sensors.</Notice>}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Card title="Attitude">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <AttitudeIndicator rollRad={att?.roll ?? 0} pitchRad={att?.pitch ?? 0} />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, display: 'flex', gap: 18 }}>
              <span>Roll {deg(att?.roll)}</span>
              <span>Pitch {deg(att?.pitch)}</span>
              <span>Yaw {deg(att?.yaw)}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'center', maxWidth: 280 }}>
              With the aircraft sitting level, roll and pitch should read close to 0°.
            </span>
          </div>
        </Card>

        <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Level horizon">
            <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
              Sets the level reference (AHRS trim) from the current pose. Put the aircraft on a flat, level surface and keep it still first.
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={primaryBtn} disabled={armed} onClick={() => void runCommand({ type: 'calibrate', kind: 'level' })}>
                Calibrate level
              </button>
              {trimX !== undefined && trimY !== undefined && (
                <>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-1)' }}>
                    Trim X {deg(trimX)} · Y {deg(trimY)}
                  </span>
                  <button
                    style={btn}
                    disabled={trimX === 0 && trimY === 0}
                    onClick={() => {
                      draft.set('AHRS_TRIM_X', 0)
                      draft.set('AHRS_TRIM_Y', 0)
                    }}
                  >
                    Reset trim
                  </button>
                </>
              )}
            </div>
          </Card>

          <Card title="Accelerometer calibration (6 positions)">
            {accelPosition === null && (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
                  The vehicle will ask for six orientations in turn: level, left side, right side, nose down, nose up, and upside down. Hold each position still until
                  you confirm it.
                </span>
                <div>
                  <button
                    style={primaryBtn}
                    disabled={armed}
                    onClick={() => {
                      resetSetupState()
                      void runCommand({ type: 'calibrate', kind: 'accel' })
                    }}
                  >
                    Start accelerometer calibration
                  </button>
                </div>
              </>
            )}
            {accelRunning && (
              <>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)' }}>{ACCEL_POSITIONS[accelPosition] ?? `Position ${accelPosition}`}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={primaryBtn} onClick={() => void runCommand({ type: 'accelPosition', position: accelPosition })}>
                    It’s in position — continue
                  </button>
                  <button style={btn} onClick={resetSetupState}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
            {accelPosition === ACCEL_SUCCESS && (
              <>
                <Notice>Calibration successful. Reboot the flight controller if it asks for it.</Notice>
                <div>
                  <button style={btn} onClick={resetSetupState}>Done</button>
                </div>
              </>
            )}
            {accelPosition === ACCEL_FAILED && (
              <>
                <Notice tone="bad">Calibration failed. Check the vehicle messages below and try again.</Notice>
                <div>
                  <button style={btn} onClick={resetSetupState}>Try again</button>
                </div>
              </>
            )}
          </Card>

          <Card title="Gyro and barometer">
            <span style={{ fontSize: 12, color: 'var(--text-1)' }}>Keep the aircraft completely still while these run.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={armed} onClick={() => void runCommand({ type: 'calibrate', kind: 'gyro' })}>
                Calibrate gyro
              </button>
              <button style={btn} disabled={armed} onClick={() => void runCommand({ type: 'calibrate', kind: 'baro' })}>
                Calibrate barometer
              </button>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Calibration messages">
        <CalLog pattern={/calib|accel|gyro|baro|level|place|trim/i} count={8} />
      </Card>

      <WriteBar draft={draft} />
    </div>
  )
}

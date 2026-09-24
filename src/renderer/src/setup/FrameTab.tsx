import { useState } from 'react'
import { runCommand, useArmed } from '../store'
import FrameDiagram, { FrameLegend } from './FrameDiagram'
import { FRAME_DEFS, frameClassDef, frameLabel, frameTypeDef } from './frames'
import { btn, Card, dangerBtn, Notice, WriteBar } from './ui'
import type { Draft } from './ui'

export default function FrameTab({ draft }: { draft: Draft }): React.JSX.Element {
  const armed = useArmed()
  const [confirmReboot, setConfirmReboot] = useState(false)
  const [written, setWritten] = useState(false)

  const classId = draft.value('FRAME_CLASS')
  const typeId = draft.value('FRAME_TYPE')
  const vehicleClass = draft.vehicle('FRAME_CLASS')
  const vehicleType = draft.vehicle('FRAME_TYPE')

  if (classId === undefined) return <Notice tone="warn">This vehicle does not have a FRAME_CLASS parameter (older firmware selects the frame in a different way).</Notice>

  const cls = frameClassDef(classId)
  const type = frameTypeDef(classId, typeId)
  const changed = draft.dirtyIds.includes('FRAME_CLASS') || draft.dirtyIds.includes('FRAME_TYPE')

  function chooseClass(id: number): void {
    draft.set('FRAME_CLASS', id)
    const next = frameClassDef(id)
    // Keep the current type when the new class has it, otherwise fall back to the class's first type.
    if (next && next.types.length > 0 && !next.types.some((t) => t.type === draft.value('FRAME_TYPE'))) draft.set('FRAME_TYPE', next.types[0].type)
    if (next && next.types.length === 0) draft.set('FRAME_TYPE', 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {armed && <Notice tone="bad">The vehicle is armed. Disarm before changing the frame.</Notice>}
      <Notice tone="warn">
        The frame decides which outputs drive which motors and in which direction. A wrong frame can make the aircraft flip on takeoff. Remove propellers before
        changing it, and check the result with the motor test before flying.
      </Notice>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 300 }}>
          <Card title="Frame class">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {FRAME_DEFS.map((c) => (
                <button
                  key={c.id}
                  disabled={armed}
                  onClick={() => chooseClass(c.id)}
                  style={{
                    ...btn,
                    textAlign: 'left',
                    padding: '9px 12px',
                    border: `1px solid ${classId === c.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: classId === c.id ? 'var(--accent-dim)' : 'transparent',
                    color: classId === c.id ? 'var(--accent)' : 'var(--text-0)'
                  }}
                >
                  {c.name}
                  {vehicleClass === c.id && <span style={{ display: 'block', fontSize: 10, color: 'var(--text-2)' }}>on vehicle</span>}
                </button>
              ))}
            </div>
            {!cls && <Notice>Class {classId} is not in this list. It will be left as it is unless you pick another class.</Notice>}
          </Card>

          {cls && cls.types.length > 0 && (
            <Card title="Frame type">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cls.types.map((t) => (
                  <button
                    key={t.type}
                    disabled={armed}
                    onClick={() => draft.set('FRAME_TYPE', t.type)}
                    style={{
                      ...btn,
                      padding: '7px 12px',
                      border: `1px solid ${typeId === t.type ? 'var(--accent)' : 'var(--border)'}`,
                      background: typeId === t.type ? 'var(--accent-dim)' : 'transparent',
                      color: typeId === t.type ? 'var(--accent)' : 'var(--text-0)'
                    }}
                  >
                    {t.name}
                    {vehicleClass === classId && vehicleType === t.type && <span style={{ display: 'block', fontSize: 10, color: 'var(--text-2)' }}>on vehicle</span>}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Which types a vehicle accepts depends on its firmware version. Plus and X are supported everywhere.</span>
            </Card>
          )}
          {cls && !cls.diagram && (
            <Notice>
              {cls.name} isn’t a multirotor matrix frame, so there is no motor layout to show here. Select it if that is your airframe; its outputs and servos are
              configured on the Servo outputs page.
            </Notice>
          )}
        </div>

        <div style={{ flex: '1 1 380px', minWidth: 340 }}>
          <Card title={type && cls ? `${cls.name} ${type.name}` : 'Layout'}>
            {type ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <FrameDiagram motors={type.motors} size={340} />
                <FrameLegend hasDirections={type.motors.some((m) => m.dir !== 0)} />
                {cls?.note && <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{cls.note}</span>}
                <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
                  {type.motors.length} motor{type.motors.length === 1 ? '' : 's'}
                </span>
              </div>
            ) : (
              <span style={{ color: 'var(--text-2)', fontSize: 12 }}>
                {cls?.diagram ? 'Pick a frame type to see its motor layout.' : 'No layout diagram for this frame class.'}
              </span>
            )}
          </Card>
        </div>
      </div>

      <Card title="Vehicle">
        <span style={{ fontSize: 13 }}>
          Currently set on the vehicle: <b>{frameLabel(vehicleClass, vehicleType)}</b>
          {changed && (
            <>
              {' '}
              → will become <b>{frameLabel(classId, typeId)}</b>
            </>
          )}
        </span>
        {written && (
          <Notice tone="warn">Written. The new frame only takes effect after the flight controller reboots.</Notice>
        )}
        {!confirmReboot ? (
          <div>
            <button style={btn} disabled={armed} onClick={() => setConfirmReboot(true)}>
              Reboot flight controller
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--warn)', fontWeight: 600 }}>Reboot now? The link will drop.</span>
            <button
              style={dangerBtn}
              onClick={() => {
                setConfirmReboot(false)
                void runCommand({ type: 'reboot' })
              }}
            >
              Reboot
            </button>
            <button style={btn} onClick={() => setConfirmReboot(false)}>
              Cancel
            </button>
          </div>
        )}
      </Card>

      <WriteBar draft={draft} onWritten={(failed) => setWritten(failed.length === 0)} note="Reboot required afterwards" />
    </div>
  )
}

import { useState } from 'react'
import { useConnection } from '../store'
import AttitudeTab from '../setup/AttitudeTab'
import CompassTab from '../setup/CompassTab'
import FlightModesTab from '../setup/FlightModesTab'
import MotorsTab from '../setup/MotorsTab'
import RadioTab from '../setup/RadioTab'
import SerialTab from '../setup/SerialTab'
import ServoTab from '../setup/ServoTab'
import { useEnsureParams, useParamDraft } from '../setup/useParamDraft'

const TABS = [
  { id: 'attitude', label: 'Accelerometer & level' },
  { id: 'compass', label: 'Compass' },
  { id: 'radio', label: 'Radio calibration' },
  { id: 'servo', label: 'Servo outputs' },
  { id: 'modes', label: 'Flight modes' },
  { id: 'serial', label: 'Serial ports' },
  { id: 'motors', label: 'Motors & ESC' }
] as const

type TabId = (typeof TABS)[number]['id']

export default function SetupView(): React.JSX.Element {
  const connection = useConnection()
  const { loaded, loading, progress } = useEnsureParams()
  const draft = useParamDraft()
  const [tab, setTab] = useState<TabId>('attitude')

  if (connection.status !== 'connected') {
    return <Centered>Not connected — click Connect to link to your vehicle</Centered>
  }
  if (!loaded) {
    return (
      <Centered>
        {loading ? `Loading parameters… ${progress.received} / ${progress.total}` : 'Waiting for the vehicle’s parameters…'}
        {!loading && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => void window.api.requestParams()}
              style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              Load parameters
            </button>
          </div>
        )}
      </Centered>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-1)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              textAlign: 'left',
              padding: '9px 12px',
              borderRadius: 6,
              border: 'none',
              background: tab === t.id ? 'var(--bg-3)' : 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-1)'
            }}
          >
            {t.label}
          </button>
        ))}
        {draft.dirty && <div style={{ marginTop: 10, padding: '6px 10px', fontSize: 11, color: 'var(--warn)' }}>{draft.dirtyIds.length} unsaved change(s)</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 18 }}>
        {tab === 'attitude' && <AttitudeTab draft={draft} />}
        {tab === 'compass' && <CompassTab draft={draft} />}
        {tab === 'radio' && <RadioTab draft={draft} />}
        {tab === 'servo' && <ServoTab draft={draft} />}
        {tab === 'modes' && <FlightModesTab draft={draft} />}
        {tab === 'serial' && <SerialTab draft={draft} />}
        {tab === 'motors' && <MotorsTab draft={draft} />}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-2)' }}>{children}</div>
}

import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './views/Dashboard'
import ParametersView from './views/ParametersView'
import LogsView from './views/LogsView'
import MissionView from './views/MissionView'
import SetupView from './views/SetupView'
import TuneView from './views/TuneView'
import ConnectionModal from './components/ConnectionModal'
import TrafficWatcher from './components/TrafficWatcher'

export type ViewId = 'dashboard' | 'mission' | 'setup' | 'tuning' | 'parameters' | 'logs'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('dashboard')
  const [connectionModalOpen, setConnectionModalOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar current={view} onSelect={setView} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <TopBar onOpenConnection={() => setConnectionModalOpen(true)} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {view === 'dashboard' && <Dashboard />}
          {view === 'mission' && <MissionView />}
          {view === 'setup' && <SetupView />}
          {view === 'tuning' && <TuneView />}
          {view === 'parameters' && <ParametersView />}
          {view === 'logs' && <LogsView />}
        </div>
      </div>
      <TrafficWatcher />
      {connectionModalOpen && <ConnectionModal onClose={() => setConnectionModalOpen(false)} />}
    </div>
  )
}

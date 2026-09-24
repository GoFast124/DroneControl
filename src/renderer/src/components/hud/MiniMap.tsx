import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isMappable } from '../../../../shared/mission'
import { useMission, useTelemetry, useTrail } from '../../store'

const SIZE = 280

const VEHICLE_SVG = `<svg viewBox="0 0 32 32" width="28" height="28" style="transition: transform 0.3s linear">
  <polygon points="16,3 26,27 16,22 6,27" fill="#3ecfff" stroke="#0a0e14" stroke-width="2" stroke-linejoin="round"/>
</svg>`

export default function MiniMap({ onHide }: { onHide: () => void }): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const vehicle = useRef<L.Marker | null>(null)
  const trailLine = useRef<L.Polyline | null>(null)
  const missionLayer = useRef<L.LayerGroup | null>(null)
  const followRef = useRef(true)
  const [follow, setFollow] = useState(true)
  followRef.current = follow

  const telemetry = useTelemetry()
  const trail = useTrail()
  const mission = useMission()
  const pos = telemetry.globalPosition
  const hasFix = !!pos && (pos.lat !== 0 || pos.lon !== 0)
  const heading = telemetry.vfrHud?.heading ?? 0

  useEffect(() => {
    const m = L.map(container.current as HTMLElement, { center: [0, 0], zoom: 2, zoomControl: false, attributionControl: false })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(m)
    L.control.zoom({ position: 'topright' }).addTo(m)
    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution('Tiles &copy; Esri').addTo(m)
    missionLayer.current = L.layerGroup().addTo(m)
    trailLine.current = L.polyline([], { color: '#3ecfff', weight: 2, opacity: 0.85 }).addTo(m)
    // Panning by hand means "let me look around": stop following until the user turns it back on.
    m.on('dragstart', () => setFollow(false))
    map.current = m
    return () => {
      m.remove()
      map.current = null
      vehicle.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !hasFix || !pos) return
    const latlng: L.LatLngTuple = [pos.lat, pos.lon]
    if (!vehicle.current) {
      vehicle.current = L.marker(latlng, {
        icon: L.divIcon({ className: '', html: VEHICLE_SVG, iconSize: [28, 28], iconAnchor: [14, 14] }),
        interactive: false,
        zIndexOffset: 1000
      }).addTo(m)
      m.setView(latlng, 17)
    } else {
      vehicle.current.setLatLng(latlng)
      if (followRef.current) m.panTo(latlng, { animate: false })
    }
    const svg = vehicle.current.getElement()?.querySelector('svg')
    if (svg) svg.style.transform = `rotate(${heading}deg)`
  }, [pos?.lat, pos?.lon, heading, hasFix])

  useEffect(() => {
    trailLine.current?.setLatLngs(trail)
  }, [trail])

  useEffect(() => {
    const layer = missionLayer.current
    if (!layer) return
    layer.clearLayers()
    const path: L.LatLngTuple[] = []
    mission.items.forEach((item, i) => {
      if (!isMappable(item)) return
      path.push([item.lat, item.lon])
      const current = telemetry.missionCurrent === i + 1
      L.circleMarker([item.lat, item.lon], {
        radius: 5,
        color: '#0a0e14',
        weight: 1.5,
        fillColor: current ? '#33d17a' : '#f5b942',
        fillOpacity: 1,
        interactive: false
      }).addTo(layer)
    })
    if (path.length > 1) L.polyline(path, { color: '#f5b942', weight: 2, dashArray: '6 5', interactive: false }).addTo(layer)
  }, [mission.items, telemetry.missionCurrent])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div ref={container} style={{ position: 'absolute', inset: 0, background: 'var(--bg-0)' }} />
        {!hasFix && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(10,14,20,0.7)',
              color: 'var(--text-1)',
              fontSize: 12,
              pointerEvents: 'none'
            }}
          >
            Waiting for GPS position
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
        <span style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', minWidth: 150 }}>
          {hasFix && pos ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : 'No position'}
        </span>
        <button onClick={() => setFollow(!follow)} style={smallBtn(follow)} title="Keep the aircraft centred">
          Follow
        </button>
        <button onClick={onHide} style={smallBtn(false)} title="Hide the map">
          Hide
        </button>
      </div>
    </div>
  )
}

function smallBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--accent-dim)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 4,
    padding: '3px 8px',
    color: active ? 'var(--accent)' : 'var(--text-1)'
  }
}

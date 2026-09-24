import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isMappable } from '../../../shared/mission'
import { missionActions, useMission, useTelemetry, useTrail } from '../store'

const VEHICLE_SVG = `<svg viewBox="0 0 32 32" width="32" height="32" style="transition: transform 0.3s linear">
  <polygon points="16,3 26,27 16,22 6,27" fill="#3ecfff" stroke="#0a0e14" stroke-width="2" stroke-linejoin="round"/>
</svg>`

function waypointIcon(label: string, selected: boolean, current: boolean): L.DivIcon {
  const cls = ['wp-marker', selected ? 'selected' : '', current ? 'current' : ''].join(' ')
  return L.divIcon({ className: '', html: `<div class="${cls}">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
}

export default function MissionMap({ addMode, follow }: { addMode: boolean; follow: boolean }): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const missionLayer = useRef<L.LayerGroup | null>(null)
  const vehicle = useRef<L.Marker | null>(null)
  const trailLine = useRef<L.Polyline | null>(null)
  const fitted = useRef(false)

  const mission = useMission()
  const telemetry = useTelemetry()
  const trail = useTrail()

  const addModeRef = useRef(addMode)
  addModeRef.current = addMode
  const latest = useRef({ mission, telemetry })
  latest.current = { mission, telemetry }

  useEffect(() => {
    const m = L.map(container.current as HTMLElement, { center: [0, 0], zoom: 2 })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    ).addTo(m)
    const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    })
    L.control.layers({ Satellite: satellite, Street: street }).addTo(m)
    missionLayer.current = L.layerGroup().addTo(m)
    trailLine.current = L.polyline([], { color: '#3ecfff', weight: 2, opacity: 0.8 }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (addModeRef.current) missionActions.addWaypoint(e.latlng.lat, e.latlng.lng)
    })

    const { mission: mi, telemetry: te } = latest.current
    const pos = te.globalPosition
    const points = mi.items.filter(isMappable).map((it) => [it.lat, it.lon] as L.LatLngTuple)
    if (pos && (pos.lat !== 0 || pos.lon !== 0)) {
      m.setView([pos.lat, pos.lon], 17)
      fitted.current = true
    } else if (points.length > 0) {
      m.fitBounds(L.latLngBounds(points).pad(0.3))
      fitted.current = true
    }

    const observer = new ResizeObserver(() => m.invalidateSize())
    observer.observe(container.current as HTMLElement)
    map.current = m
    return () => {
      observer.disconnect()
      m.remove()
      map.current = null
      vehicle.current = null
      fitted.current = false
    }
  }, [])

  useEffect(() => {
    if (map.current) map.current.getContainer().style.cursor = addMode ? 'crosshair' : ''
  }, [addMode])

  // Mission waypoints, home and the planned path.
  useEffect(() => {
    const layer = missionLayer.current
    if (!layer) return
    layer.clearLayers()
    const path: L.LatLngTuple[] = []
    const home = mission.home
    if (home && (home.lat !== 0 || home.lon !== 0)) {
      path.push([home.lat, home.lon])
      L.marker([home.lat, home.lon], {
        icon: L.divIcon({ className: '', html: '<div class="wp-marker home">H</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
        interactive: false
      }).addTo(layer)
    }
    const currentSeq = telemetry.missionCurrent
    mission.items.forEach((item, i) => {
      if (!isMappable(item)) return
      path.push([item.lat, item.lon])
      const marker = L.marker([item.lat, item.lon], {
        icon: waypointIcon(String(i + 1), mission.selected === i, currentSeq === i + 1),
        draggable: true
      })
      marker.on('dragend', () => {
        const p = marker.getLatLng()
        missionActions.updateItem(i, { lat: p.lat, lon: p.lng })
      })
      marker.on('click', () => missionActions.select(i))
      marker.addTo(layer)
    })
    if (path.length > 1) L.polyline(path, { color: '#f5b942', weight: 3, dashArray: '8 6', interactive: false }).addTo(layer)
  }, [mission.items, mission.home, mission.selected, telemetry.missionCurrent])

  // Live vehicle marker.
  const pos = telemetry.globalPosition
  const heading = telemetry.vfrHud?.heading ?? 0
  useEffect(() => {
    const m = map.current
    if (!m || !pos || (pos.lat === 0 && pos.lon === 0)) return
    const latlng: L.LatLngTuple = [pos.lat, pos.lon]
    if (!vehicle.current) {
      vehicle.current = L.marker(latlng, {
        icon: L.divIcon({ className: '', html: VEHICLE_SVG, iconSize: [32, 32], iconAnchor: [16, 16] }),
        interactive: false,
        zIndexOffset: 1000
      }).addTo(m)
    } else {
      vehicle.current.setLatLng(latlng)
    }
    const svg = vehicle.current.getElement()?.querySelector('svg')
    if (svg) svg.style.transform = `rotate(${heading}deg)`
    if (!fitted.current) {
      m.setView(latlng, 17)
      fitted.current = true
    } else if (follow) {
      m.panTo(latlng, { animate: false })
    }
  }, [pos?.lat, pos?.lon, heading, follow])

  useEffect(() => {
    trailLine.current?.setLatLngs(trail)
  }, [trail])

  return <div ref={container} style={{ position: 'absolute', inset: 0, background: 'var(--bg-0)' }} />
}

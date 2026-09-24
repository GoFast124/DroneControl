import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isMappable } from '../../../../shared/mission'
import { useMission, useTelemetry, useTrail } from '../../store'
import { usePersistedFlag } from '../../usePersistedFlag'
import {
  THREAT_COLORS,
  TRAFFIC_RANGE_M,
  aircraftName,
  compassPoint,
  formatDistance,
  formatRelAlt,
  nearbyTraffic,
  type NearbyAircraft
} from '../../traffic'

const SIZE = 280

const VEHICLE_SVG = `<svg viewBox="0 0 32 32" width="28" height="28" style="transition: transform 0.3s linear">
  <polygon points="16,3 26,27 16,22 6,27" fill="#3ecfff" stroke="#0a0e14" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const SVG_NS = 'http://www.w3.org/2000/svg'
const AIRCRAFT_PATH = 'M12 2 L14 9 L22 14 L22 16 L14 13.5 L13.5 19 L16 21 L16 22 L12 21 L8 22 L8 21 L10.5 19 L10 13.5 L2 16 L2 14 L10 9 Z'

// Built with DOM calls (not an HTML string) because callsigns come from outside and must not be interpreted as markup.
function aircraftElement(a: NearbyAircraft): HTMLElement {
  const color = THREAT_COLORS[a.threat]
  const root = document.createElement('div')
  root.style.cssText = 'position:relative;width:26px;height:26px'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '26')
  svg.setAttribute('height', '26')
  svg.style.transform = `rotate(${a.heading ?? 0}deg)`
  svg.style.filter = 'drop-shadow(0 0 2px #000)'
  const path = document.createElementNS(SVG_NS, a.heading === undefined ? 'circle' : 'path')
  if (a.heading === undefined) {
    path.setAttribute('cx', '12')
    path.setAttribute('cy', '12')
    path.setAttribute('r', '5')
  } else {
    path.setAttribute('d', AIRCRAFT_PATH)
  }
  path.setAttribute('fill', color)
  path.setAttribute('stroke', '#0a0e14')
  path.setAttribute('stroke-width', '1')
  svg.appendChild(path)
  const label = document.createElement('span')
  label.textContent = `${aircraftName(a)} ${formatRelAlt(a.relAlt).replace(' m', '')}`
  label.style.cssText = `position:absolute;left:50%;top:26px;transform:translateX(-50%);white-space:nowrap;font:600 10px var(--mono);color:${color};text-shadow:0 0 3px #000,0 0 3px #000`
  root.append(svg, label)
  return root
}

function aircraftTooltip(a: NearbyAircraft): HTMLElement {
  const el = document.createElement('div')
  const parts = [
    aircraftName(a) + (a.type ? ` (${a.type})` : ''),
    `${formatDistance(a.distance)} ${compassPoint(a.bearing)}, ${formatRelAlt(a.relAlt)}`,
    a.speed !== undefined ? `${Math.round(a.speed * 3.6)} km/h` : ''
  ].filter(Boolean)
  parts.forEach((line, i) => {
    if (i) el.appendChild(document.createElement('br'))
    el.appendChild(document.createTextNode(line))
  })
  return el
}

export default function MiniMap({ onHide }: { onHide: () => void }): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const vehicle = useRef<L.Marker | null>(null)
  const trailLine = useRef<L.Polyline | null>(null)
  const missionLayer = useRef<L.LayerGroup | null>(null)
  const trafficLayer = useRef<L.LayerGroup | null>(null)
  const trafficMarkers = useRef(new Map<string, L.Marker>())
  const trafficRing = useRef<L.Circle | null>(null)
  const trafficLooks = useRef(new Map<string, string>())
  const followRef = useRef(true)
  const [showTraffic, setShowTraffic] = usePersistedFlag('showMapTraffic', true)
  const [showWaypoints, setShowWaypoints] = usePersistedFlag('showMapWaypoints', true)
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
    trafficLayer.current = L.layerGroup().addTo(m)
    trailLine.current = L.polyline([], { color: '#3ecfff', weight: 2, opacity: 0.85 }).addTo(m)
    // Panning by hand means "let me look around": stop following until the user turns it back on.
    m.on('dragstart', () => setFollow(false))
    map.current = m
    return () => {
      m.remove()
      map.current = null
      vehicle.current = null
      trafficLayer.current = null
      trafficMarkers.current.clear()
      trafficLooks.current.clear()
      trafficRing.current = null
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

  // Nearby aircraft: one marker each plus a ring showing the traffic range around the vehicle.
  useEffect(() => {
    const layer = trafficLayer.current
    if (!layer) return
    const markers = trafficMarkers.current
    const { nearby } = showTraffic && hasFix ? nearbyTraffic(telemetry) : { nearby: [] }

    if (nearby.length || (showTraffic && hasFix)) {
      if (!trafficRing.current && pos) {
        trafficRing.current = L.circle([pos.lat, pos.lon], {
          radius: TRAFFIC_RANGE_M,
          color: '#8fa3b8',
          weight: 1,
          dashArray: '4 6',
          fill: false,
          interactive: false
        }).addTo(layer)
      }
      if (pos) trafficRing.current?.setLatLng([pos.lat, pos.lon])
    } else if (trafficRing.current) {
      trafficRing.current.remove()
      trafficRing.current = null
    }

    const seen = new Set<string>()
    for (const a of nearby) {
      seen.add(a.id)
      const element = aircraftElement(a)
      // Only swap the icon when what it shows has changed, so an open tooltip isn't torn down on every update.
      const look = element.outerHTML
      let marker = markers.get(a.id)
      if (!marker) {
        const icon = L.divIcon({ className: '', html: element, iconSize: [26, 26], iconAnchor: [13, 13] })
        marker = L.marker([a.lat, a.lon], { icon, keyboard: false }).addTo(layer)
        marker.bindTooltip(aircraftTooltip(a), { direction: 'top', offset: [0, -10] })
        markers.set(a.id, marker)
      } else {
        marker.setLatLng([a.lat, a.lon])
        marker.setTooltipContent(aircraftTooltip(a))
        if (trafficLooks.current.get(a.id) !== look) {
          marker.setIcon(L.divIcon({ className: '', html: element, iconSize: [26, 26], iconAnchor: [13, 13] }))
        }
      }
      trafficLooks.current.set(a.id, look)
    }
    for (const [id, marker] of markers) {
      if (seen.has(id)) continue
      marker.remove()
      markers.delete(id)
      trafficLooks.current.delete(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.traffic, pos?.lat, pos?.lon, pos?.alt, hasFix, showTraffic])

  function showTrafficRange(): void {
    if (!map.current || !pos) return
    map.current.fitBounds(L.latLng(pos.lat, pos.lon).toBounds(TRAFFIC_RANGE_M * 2.2), { animate: false })
  }

  useEffect(() => {
    trailLine.current?.setLatLngs(trail)
  }, [trail])

  useEffect(() => {
    const layer = missionLayer.current
    if (!layer) return
    layer.clearLayers()
    if (!showWaypoints) return
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
  }, [mission.items, telemetry.missionCurrent, showWaypoints])

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, fontSize: 11, maxWidth: 320 }}>
        <button onClick={() => setFollow(!follow)} style={smallBtn(follow)} title="Keep the aircraft centred">
          Follow
        </button>
        <button onClick={() => setShowWaypoints(!showWaypoints)} style={smallBtn(showWaypoints)} title="Show the mission waypoints and path">
          Waypoints
        </button>
        <button onClick={() => setShowTraffic(!showTraffic)} style={smallBtn(showTraffic)} title="Show nearby aircraft and the 10 km range ring">
          Traffic
        </button>
        <button onClick={showTrafficRange} disabled={!hasFix} style={smallBtn(false)} title="Zoom out to show everything within 10 km">
          10 km
        </button>
        <button onClick={onHide} style={smallBtn(false)} title="Hide the map">
          Hide
        </button>
      </div>
      <span style={{ color: 'var(--text-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
        {hasFix && pos ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : 'No position'}
      </span>
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

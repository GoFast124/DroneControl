import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isMappable } from '../../../shared/mission'
import { CMD_SET_CAM_TRIGG_DIST, photoPoints } from '../../../shared/survey'
import { missionActions, surveyActions, useMission, useSurvey, useTelemetry, useTrail } from '../store'
import { useSurveyPlan } from '../survey/useSurveyPlan'

const VEHICLE_SVG = `<svg viewBox="0 0 32 32" width="32" height="32" style="transition: transform 0.3s linear">
  <polygon points="16,3 26,27 16,22 6,27" fill="#3ecfff" stroke="#0a0e14" stroke-width="2" stroke-linejoin="round"/>
</svg>`

function waypointIcon(label: string, selected: boolean, current: boolean): L.DivIcon {
  const cls = ['wp-marker', selected ? 'selected' : '', current ? 'current' : ''].join(' ')
  return L.divIcon({ className: '', html: `<div class="${cls}">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
}

const SURVEY_COLOR = '#b388ff'

function cornerIcon(): L.DivIcon {
  return L.divIcon({ className: '', html: '<div class="survey-corner"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
}

// Camera trigger commands have no position of their own: they take effect when the vehicle reaches the waypoint before them.
function cameraIcon(seq: number, on: boolean): L.DivIcon {
  const color = on ? '#33d17a' : '#ef5757'
  return L.divIcon({
    className: '',
    html: `<div class="cmd-marker" style="border-color:${color};color:${color}">&#128247; ${seq}</div>`,
    iconSize: [40, 20],
    iconAnchor: [-6, 34]
  })
}

function endpointIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="survey-end" style="background:${color}">${label}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  })
}

export default function MissionMap({
  addMode,
  follow,
  surveyActive
}: {
  addMode: boolean
  follow: boolean
  surveyActive: boolean
}): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const missionLayer = useRef<L.LayerGroup | null>(null)
  const surveyLayer = useRef<L.LayerGroup | null>(null)
  const vehicle = useRef<L.Marker | null>(null)
  const trailLine = useRef<L.Polyline | null>(null)
  const fitted = useRef(false)

  const mission = useMission()
  const telemetry = useTelemetry()
  const trail = useTrail()
  const survey = useSurvey()
  const surveyResult = useSurveyPlan()

  const addModeRef = useRef(addMode)
  addModeRef.current = addMode
  const drawingRef = useRef(survey.drawing)
  drawingRef.current = survey.drawing
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
    surveyLayer.current = L.layerGroup().addTo(m)
    missionLayer.current = L.layerGroup().addTo(m)
    trailLine.current = L.polyline([], { color: '#3ecfff', weight: 2, opacity: 0.8 }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (drawingRef.current) surveyActions.addPoint(e.latlng.lat, e.latlng.lng)
      else if (addModeRef.current) missionActions.addWaypoint(e.latlng.lat, e.latlng.lng)
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
    if (map.current) map.current.getContainer().style.cursor = addMode || survey.drawing ? 'crosshair' : ''
  }, [addMode, survey.drawing])

  // Survey area, its corners (draggable while the Survey panel is open) and a preview of the flight lines.
  useEffect(() => {
    const layer = surveyLayer.current
    if (!layer) return
    layer.clearLayers()
    const poly = survey.polygon
    if (poly.length === 0) return
    if (poly.length >= 3) {
      L.polygon(poly, { color: SURVEY_COLOR, weight: 2, fillColor: SURVEY_COLOR, fillOpacity: 0.12, interactive: false }).addTo(layer)
    } else {
      L.polyline(poly, { color: SURVEY_COLOR, weight: 2, interactive: false }).addTo(layer)
    }

    // The preview is only for planning; once the mission exists its own waypoints show the path.
    const plan = surveyActive ? surveyResult?.plan : undefined
    if (plan) {
      for (const p of photoPoints(plan)) {
        L.circleMarker(p, { radius: 3, color: '#0a0e14', weight: 1, fillColor: '#ffffff', fillOpacity: 1, interactive: false }).addTo(layer)
      }
      plan.segments.forEach((seg, i) => {
        L.polyline([seg.a, seg.b], { color: SURVEY_COLOR, weight: 2.5, interactive: false }).addTo(layer)
        if (i > 0) L.polyline([plan.segments[i - 1].b, seg.a], { color: SURVEY_COLOR, weight: 1.5, dashArray: '3 5', opacity: 0.7, interactive: false }).addTo(layer)
      })
      const first = plan.segments[0].a
      const last = plan.segments[plan.segments.length - 1].b
      L.marker(first, { icon: endpointIcon('S', '#33d17a'), interactive: false }).addTo(layer)
      L.marker(last, { icon: endpointIcon('E', '#ef5757'), interactive: false }).addTo(layer)
    }

    if (surveyActive) {
      poly.forEach((p, i) => {
        const marker = L.marker(p, { icon: cornerIcon(), draggable: true, title: 'Drag to move, right-click to remove' })
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          surveyActions.movePoint(i, ll.lat, ll.lng)
        })
        marker.on('contextmenu', () => surveyActions.removePoint(i))
        marker.addTo(layer)
      })
    }
  }, [survey.polygon, surveyResult, surveyActive])

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
    let lastPosition: L.LatLngTuple | null = null
    mission.items.forEach((item, i) => {
      if (item.command === CMD_SET_CAM_TRIGG_DIST && lastPosition) {
        const on = item.param1 > 0
        L.marker(lastPosition, {
          icon: cameraIcon(i + 1, on),
          interactive: false,
          zIndexOffset: -100,
          title: on ? `Item ${i + 1}: photo every ${item.param1} m from here` : `Item ${i + 1}: camera trigger off`
        }).addTo(layer)
      }
      if (!isMappable(item)) return
      lastPosition = [item.lat, item.lon]
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

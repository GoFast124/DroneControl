// Survey (grid) mission planner: given a polygon, a camera and the wanted image overlap, works out the flying height,
// the spacing of the flight lines and the camera trigger distance, and lays out the waypoints.
import { FRAME_MISSION, FRAME_RELATIVE, FRAME_TERRAIN, newWaypoint } from './mission'
import type { MissionItem } from './mission'

export type LatLon = [number, number]

export interface SurveyCamera {
  // 'sensor': the field of view comes from the sensor size and focal length. 'fov': the horizontal field of view is entered directly.
  mode: 'sensor' | 'fov'
  sensorWidthMm: number
  sensorHeightMm: number
  focalLengthMm: number
  hFovDeg: number // used in 'fov' mode; describes the image's long side (the width)
  imageWidthPx: number
  imageHeightPx: number
}

export interface SurveySettings {
  camera: SurveyCamera
  // Landscape: the image's long side is across the flight direction. Portrait: the short side is.
  orientation: 'landscape' | 'portrait'
  frontOverlap: number // % overlap between consecutive photos along a line
  sideOverlap: number // % overlap between neighbouring lines
  heightMode: 'altitude' | 'gsd'
  altitude: number // m above the ground (or home)
  gsdCm: number // wanted ground sample distance, cm per pixel
  angleAuto: boolean
  angle: number // flight direction of the lines, degrees clockwise from north
  speed: number // m/s
  overshoot: number // m the lines run past the polygon edge
  crosshatch: boolean // fly a second pass at 90 degrees
  terrainFrame: boolean // waypoint altitudes follow the terrain instead of being relative to home
  triggerOnLinesOnly: boolean // switch the camera off in the turns between lines
  minShutterInterval: number // s, the fastest the camera can take pictures
  addTakeoff: boolean
  addRtl: boolean
}

export interface CameraPreset {
  name: string
  camera: SurveyCamera
}

const sensorCam = (w: number, h: number, f: number, px: number, py: number): SurveyCamera => ({
  mode: 'sensor',
  sensorWidthMm: w,
  sensorHeightMm: h,
  focalLengthMm: f,
  hFovDeg: 70,
  imageWidthPx: px,
  imageHeightPx: py
})

// Nominal figures from manufacturers' specifications. Check them against your own camera and lens.
export const CAMERA_PRESETS: CameraPreset[] = [
  { name: 'DJI Phantom 4 Pro (1", 8.8 mm)', camera: sensorCam(13.2, 8.8, 8.8, 5472, 3648) },
  { name: 'DJI Mavic 2 Pro (1", 10.3 mm)', camera: sensorCam(13.2, 8.8, 10.3, 5472, 3648) },
  { name: 'DJI Mavic 3 Enterprise wide (4/3")', camera: sensorCam(17.3, 13, 12.3, 5280, 3956) },
  { name: 'Sony a6000 / APS-C, 16 mm lens', camera: sensorCam(23.5, 15.6, 16, 6000, 4000) },
  { name: 'Sony RX1R II / full frame, 35 mm', camera: sensorCam(35.9, 24, 35, 7952, 5304) },
  { name: 'Raspberry Pi HQ camera, 16 mm lens', camera: sensorCam(6.287, 4.712, 16, 4056, 3040) },
  { name: 'MicaSense RedEdge-MX (multispectral)', camera: sensorCam(4.8, 3.6, 5.4, 1280, 960) }
]

export const DEFAULT_SURVEY_SETTINGS: SurveySettings = {
  camera: CAMERA_PRESETS[0].camera,
  orientation: 'landscape',
  frontOverlap: 75,
  sideOverlap: 65,
  heightMode: 'altitude',
  altitude: 60,
  gsdCm: 2,
  angleAuto: true,
  angle: 0,
  speed: 5,
  overshoot: 0,
  crosshatch: false,
  terrainFrame: false,
  triggerOnLinesOnly: false,
  minShutterInterval: 2,
  addTakeoff: true,
  addRtl: true
}

const RAD = Math.PI / 180
const EARTH_RADIUS = 6371000
const MAX_LINES = 400

export interface CameraGeometry {
  acrossFovDeg: number // field of view across the flight direction
  alongFovDeg: number // field of view along the flight direction
  acrossPx: number
  alongPx: number
}

export function cameraGeometry(camera: SurveyCamera, orientation: 'landscape' | 'portrait'): CameraGeometry {
  let hFov: number
  let vFov: number
  if (camera.mode === 'sensor') {
    hFov = 2 * Math.atan(camera.sensorWidthMm / (2 * camera.focalLengthMm)) / RAD
    vFov = 2 * Math.atan(camera.sensorHeightMm / (2 * camera.focalLengthMm)) / RAD
  } else {
    hFov = camera.hFovDeg
    vFov = 2 * Math.atan(Math.tan((hFov * RAD) / 2) * (camera.imageHeightPx / camera.imageWidthPx)) / RAD
  }
  return orientation === 'landscape'
    ? { acrossFovDeg: hFov, alongFovDeg: vFov, acrossPx: camera.imageWidthPx, alongPx: camera.imageHeightPx }
    : { acrossFovDeg: vFov, alongFovDeg: hFov, acrossPx: camera.imageHeightPx, alongPx: camera.imageWidthPx }
}

export interface Coverage {
  altitude: number // m
  gsdCm: number // cm per pixel at that altitude
  acrossM: number // ground width covered by one photo, across the flight direction
  alongM: number // ground length covered by one photo, along the flight direction
  lineSpacing: number // m between flight lines
  triggerDistance: number // m between photos
  shutterInterval: number // s between photos at the planned speed
  maxSpeedForShutter: number // m/s at which photos come exactly minShutterInterval apart
}

export function validateSettings(s: SurveySettings): string | null {
  const c = s.camera
  if (c.mode === 'sensor') {
    if (!(c.sensorWidthMm > 0 && c.sensorHeightMm > 0 && c.focalLengthMm > 0)) return 'Enter the sensor size and focal length.'
  } else if (!(c.hFovDeg > 0 && c.hFovDeg < 180)) return 'Field of view must be between 0 and 180 degrees.'
  if (!(c.imageWidthPx > 0 && c.imageHeightPx > 0)) return 'Enter the image size in pixels.'
  if (!(s.frontOverlap >= 0 && s.frontOverlap < 100 && s.sideOverlap >= 0 && s.sideOverlap < 100)) return 'Overlap must be between 0 and 99%.'
  if (s.heightMode === 'altitude' ? !(s.altitude > 0) : !(s.gsdCm > 0)) return s.heightMode === 'altitude' ? 'Altitude must be above zero.' : 'GSD must be above zero.'
  if (!(s.speed > 0)) return 'Speed must be above zero.'
  return null
}

// Flying height, image footprint, line spacing and photo spacing for the camera and overlap.
export function computeCoverage(s: SurveySettings): Coverage | null {
  if (validateSettings(s)) return null
  const g = cameraGeometry(s.camera, s.orientation)
  const acrossPerMetre = 2 * Math.tan((g.acrossFovDeg * RAD) / 2) // footprint width per metre of height
  const alongPerMetre = 2 * Math.tan((g.alongFovDeg * RAD) / 2)
  const altitude = s.heightMode === 'altitude' ? s.altitude : (s.gsdCm / 100 * g.acrossPx) / acrossPerMetre
  const acrossM = acrossPerMetre * altitude
  const alongM = alongPerMetre * altitude
  const lineSpacing = acrossM * (1 - s.sideOverlap / 100)
  const triggerDistance = alongM * (1 - s.frontOverlap / 100)
  return {
    altitude,
    gsdCm: (acrossM / g.acrossPx) * 100,
    acrossM,
    alongM,
    lineSpacing,
    triggerDistance,
    shutterInterval: triggerDistance / s.speed,
    maxSpeedForShutter: triggerDistance / s.minShutterInterval
  }
}

// ---- geometry ----

interface Enu {
  e: number
  n: number
}

class Projection {
  constructor(
    private lat0: number,
    private lon0: number
  ) {}
  toEnu([lat, lon]: LatLon): Enu {
    return {
      e: (lon - this.lon0) * RAD * EARTH_RADIUS * Math.cos(this.lat0 * RAD),
      n: (lat - this.lat0) * RAD * EARTH_RADIUS
    }
  }
  toLatLon({ e, n }: Enu): LatLon {
    return [this.lat0 + (n / EARTH_RADIUS) / RAD, this.lon0 + e / (EARTH_RADIUS * Math.cos(this.lat0 * RAD)) / RAD]
  }
}

export function polygonAreaM2(polygon: LatLon[]): number {
  if (polygon.length < 3) return 0
  const proj = new Projection(polygon[0][0], polygon[0][1])
  const pts = polygon.map((p) => proj.toEnu(p))
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    sum += a.e * b.n - b.e * a.n
  }
  return Math.abs(sum) / 2
}

interface Segment {
  a: Enu
  b: Enu
}

// Lines run along bearing `angle` (degrees clockwise from north). u is the position along a line, v across (to its right).
const toUv = (p: Enu, angle: number): { u: number; v: number } => ({
  u: p.e * Math.sin(angle * RAD) + p.n * Math.cos(angle * RAD),
  v: p.e * Math.cos(angle * RAD) - p.n * Math.sin(angle * RAD)
})
const fromUv = (u: number, v: number, angle: number): Enu => ({
  e: u * Math.sin(angle * RAD) + v * Math.cos(angle * RAD),
  n: u * Math.cos(angle * RAD) - v * Math.sin(angle * RAD)
})

// The direction for the lines that needs the fewest of them, which also means the fewest turns.
export function bestAngle(polygon: LatLon[], lineSpacing: number): number {
  const proj = new Projection(polygon[0][0], polygon[0][1])
  const pts = polygon.map((p) => proj.toEnu(p))
  let best = 0
  let bestWidth = Infinity
  for (let angle = 0; angle < 180; angle++) {
    const vs = pts.map((p) => toUv(p, angle).v)
    const width = Math.max(...vs) - Math.min(...vs)
    const lines = Math.ceil(width / lineSpacing)
    const bestLines = Math.ceil(bestWidth / lineSpacing)
    if (lines < bestLines || (lines === bestLines && width < bestWidth - 1e-6)) {
      best = angle
      bestWidth = width
    }
  }
  return best
}

// One pass of parallel lines across the polygon, as segments in flight order (boustrophedon).
function gridPass(pts: Enu[], angle: number, spacing: number, overshoot: number, near: Enu | null): { segments: Segment[]; lines: number; spacing: number } {
  const uv = pts.map((p) => toUv(p, angle))
  const vMin = Math.min(...uv.map((p) => p.v))
  const vMax = Math.max(...uv.map((p) => p.v))
  const count = Math.max(1, Math.ceil((vMax - vMin) / spacing - 1e-9))
  const actual = (vMax - vMin) / count // spread the lines evenly so the overlap is never less than asked for

  // Each line is a list of [u1, u2] runs inside the polygon (more than one when the polygon is concave).
  const lines: [number, number][][] = []
  for (let k = 0; k < count; k++) {
    const v = vMin + (k + 0.5) * actual
    const us: number[] = []
    for (let i = 0; i < uv.length; i++) {
      const p = uv[i]
      const q = uv[(i + 1) % uv.length]
      if (p.v <= v !== (q.v <= v)) us.push(p.u + ((v - p.v) / (q.v - p.v)) * (q.u - p.u))
    }
    us.sort((x, y) => x - y)
    const runs: [number, number][] = []
    for (let i = 0; i + 1 < us.length; i += 2) if (us[i + 1] - us[i] > 0.5) runs.push([us[i], us[i + 1]])
    lines.push(runs)
  }

  const build = (descending: boolean, startForward: boolean): Segment[] => {
    const order = lines.map((_, k) => k)
    if (descending) order.reverse()
    const out: Segment[] = []
    let flown = 0
    for (const k of order) {
      const runs = lines[k]
      if (runs.length === 0) continue
      const forward = startForward === (flown % 2 === 0)
      const ordered = forward ? runs : [...runs].reverse()
      const v = vMin + (k + 0.5) * actual
      for (const [u1, u2] of ordered) {
        const [from, to] = forward ? [u1 - overshoot, u2 + overshoot] : [u2 + overshoot, u1 - overshoot]
        out.push({ a: fromUv(from, v, angle), b: fromUv(to, v, angle) })
      }
      flown++
    }
    return out
  }

  const variants = [build(false, true), build(false, false), build(true, true), build(true, false)].filter((s) => s.length > 0)
  if (variants.length === 0) return { segments: [], lines: 0, spacing: actual }
  let chosen = variants[0]
  if (near) {
    const dist = (s: Segment[]): number => Math.hypot(s[0].a.e - near.e, s[0].a.n - near.n)
    chosen = variants.reduce((best, v) => (dist(v) < dist(best) ? v : best))
  }
  return { segments: chosen, lines: lines.filter((l) => l.length > 0).length, spacing: actual }
}

export interface SurveyPlan {
  coverage: Coverage
  angle: number
  lines: number // flight lines in the first pass
  lineSpacing: number // m, actual spacing after spreading the lines evenly
  segments: { a: LatLon; b: LatLon }[] // each run over the polygon, in flight order
  areaHa: number
  surveyLengthM: number // distance flown along the lines
  totalLengthM: number // including the transitions between lines
  photos: number
  timeSec: number
  waypointCount: number
  itemCount: number
  warnings: string[]
}

export type PlanResult = { plan: SurveyPlan; error?: undefined } | { plan?: undefined; error: string }

export function planSurvey(polygon: LatLon[], s: SurveySettings, near?: LatLon | null): PlanResult {
  if (polygon.length < 3) return { error: 'Draw at least three corners on the map.' }
  const invalid = validateSettings(s)
  if (invalid) return { error: invalid }
  const cov = computeCoverage(s)
  if (!cov) return { error: 'Invalid camera settings.' }
  if (cov.lineSpacing < 0.5) return { error: 'Line spacing is under half a metre. Raise the altitude or lower the side overlap.' }

  const proj = new Projection(polygon[0][0], polygon[0][1])
  const pts = polygon.map((p) => proj.toEnu(p))
  const angle = s.angleAuto ? bestAngle(polygon, cov.lineSpacing) : ((s.angle % 180) + 180) % 180
  const nearEnu = near ? proj.toEnu(near) : null

  const first = gridPass(pts, angle, cov.lineSpacing, s.overshoot, nearEnu)
  if (first.segments.length === 0) return { error: 'The area is too small for the line spacing.' }
  if (first.lines > MAX_LINES) return { error: `That needs ${first.lines} lines. Raise the altitude or lower the side overlap.` }
  let segments = first.segments
  let lines = first.lines
  if (s.crosshatch) {
    const last = segments[segments.length - 1].b
    const second = gridPass(pts, (angle + 90) % 180, cov.lineSpacing, s.overshoot, last)
    segments = segments.concat(second.segments)
    lines += second.lines
  }

  let survey = 0
  let total = 0
  segments.forEach((seg, i) => {
    const len = Math.hypot(seg.b.e - seg.a.e, seg.b.n - seg.a.n)
    survey += len
    total += len
    if (i > 0) total += Math.hypot(seg.a.e - segments[i - 1].b.e, seg.a.n - segments[i - 1].b.n)
  })

  const photos = Math.ceil((s.triggerOnLinesOnly ? survey : total) / cov.triggerDistance) + (s.triggerOnLinesOnly ? segments.length : 1)
  const warnings: string[] = []
  if (cov.shutterInterval < s.minShutterInterval) {
    warnings.push(`Photos would be ${cov.shutterInterval.toFixed(1)} s apart at ${s.speed} m/s. Slow to ${cov.maxSpeedForShutter.toFixed(1)} m/s or lower the front overlap.`)
  }
  if (cov.altitude > 120) warnings.push(`${Math.round(cov.altitude)} m is above the 120 m limit that applies in many countries.`)

  const result: SurveyPlan = {
    coverage: cov,
    angle,
    lines,
    lineSpacing: first.spacing,
    segments: segments.map((seg) => ({ a: proj.toLatLon(seg.a), b: proj.toLatLon(seg.b) })),
    areaHa: polygonAreaM2(polygon) / 10000,
    surveyLengthM: survey,
    totalLengthM: total,
    photos,
    timeSec: total / s.speed,
    waypointCount: segments.length * 2,
    itemCount: 0,
    warnings
  }
  result.itemCount = buildSurveyItems(result, s).length
  if (result.itemCount > 700) warnings.push(`${result.itemCount} mission items is more than most flight controllers can store (about 700). Split the area or fly higher.`)
  return { plan: result }
}

const cmd = (command: number, p1 = 0, p2 = 0, p3 = 0): MissionItem => ({
  command,
  frame: FRAME_MISSION,
  param1: p1,
  param2: p2,
  param3: p3,
  param4: 0,
  lat: 0,
  lon: 0,
  alt: 0
})

const CMD_TAKEOFF = 22
const CMD_RTL = 20
const CMD_CHANGE_SPEED = 178
export const CMD_SET_CAM_TRIGG_DIST = 206

// Where the camera will fire along the lines, for showing on the map.
export function photoPoints(plan: SurveyPlan, limit = 3000): LatLon[] {
  const step = plan.coverage.triggerDistance
  const points: LatLon[] = []
  for (const seg of plan.segments) {
    const proj = new Projection(seg.a[0], seg.a[1])
    const b = proj.toEnu(seg.b)
    const length = Math.hypot(b.e, b.n)
    for (let d = 0; d <= length + 1e-6 && points.length < limit; d += step) {
      points.push(proj.toLatLon({ e: (b.e * d) / length, n: (b.n * d) / length }))
    }
  }
  return points
}

// The mission items for a plan: optional takeoff, speed, the waypoints with camera trigger commands, optional return.
export function buildSurveyItems(plan: SurveyPlan, s: SurveySettings): MissionItem[] {
  const alt = Math.round(plan.coverage.altitude * 10) / 10
  const frame = s.terrainFrame ? FRAME_TERRAIN : FRAME_RELATIVE
  const wp = ([lat, lon]: LatLon): MissionItem => ({ ...newWaypoint(lat, lon, alt), frame })
  const dist = Math.round(plan.coverage.triggerDistance * 10) / 10
  const items: MissionItem[] = []
  if (s.addTakeoff) items.push({ ...cmd(CMD_TAKEOFF), frame: FRAME_RELATIVE, alt })
  items.push(cmd(CMD_CHANGE_SPEED, 1, s.speed, -1))

  if (s.triggerOnLinesOnly) {
    for (const seg of plan.segments) {
      items.push(wp(seg.a), cmd(CMD_SET_CAM_TRIGG_DIST, dist, 0, 1), wp(seg.b), cmd(CMD_SET_CAM_TRIGG_DIST, 0))
    }
  } else {
    plan.segments.forEach((seg, i) => {
      items.push(wp(seg.a))
      if (i === 0) items.push(cmd(CMD_SET_CAM_TRIGG_DIST, dist, 0, 1))
      items.push(wp(seg.b))
    })
    items.push(cmd(CMD_SET_CAM_TRIGG_DIST, 0))
  }
  if (s.addRtl) items.push(cmd(CMD_RTL))
  return items
}

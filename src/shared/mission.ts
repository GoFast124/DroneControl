// Mission item model shared by the main process (MAVLink protocol) and the renderer (editor).

// Frames are normalised to the non-INT variants: 0 absolute (MSL), 3 relative to home, 10 terrain.
export const FRAME_ABSOLUTE = 0
export const FRAME_MISSION = 2
export const FRAME_RELATIVE = 3
export const FRAME_TERRAIN = 10

export interface MissionItem {
  command: number
  frame: number
  param1: number
  param2: number
  param3: number
  param4: number
  lat: number // degrees
  lon: number // degrees
  alt: number // metres, interpreted per frame
}

export interface MissionCommandInfo {
  id: number
  name: string
  hasPosition: boolean
  params: [string, string, string, string] // labels for param1..4; '' = unused
}

export const MISSION_COMMANDS: MissionCommandInfo[] = [
  { id: 16, name: 'WAYPOINT', hasPosition: true, params: ['Hold (s)', 'Accept radius (m)', 'Pass radius (m)', 'Yaw (deg)'] },
  { id: 22, name: 'TAKEOFF', hasPosition: true, params: ['Pitch', '', '', 'Yaw (deg)'] },
  { id: 21, name: 'LAND', hasPosition: true, params: ['Abort alt (m)', '', '', 'Yaw (deg)'] },
  { id: 20, name: 'RETURN_TO_LAUNCH', hasPosition: false, params: ['', '', '', ''] },
  { id: 19, name: 'LOITER_TIME', hasPosition: true, params: ['Time (s)', '', 'Radius (m)', ''] },
  { id: 18, name: 'LOITER_TURNS', hasPosition: true, params: ['Turns', '', 'Radius (m)', ''] },
  { id: 17, name: 'LOITER_UNLIM', hasPosition: true, params: ['', '', 'Radius (m)', ''] },
  { id: 82, name: 'SPLINE_WAYPOINT', hasPosition: true, params: ['Hold (s)', '', '', ''] },
  { id: 178, name: 'DO_CHANGE_SPEED', hasPosition: false, params: ['Type (0 air, 1 gnd)', 'Speed (m/s)', 'Throttle %', ''] },
  { id: 177, name: 'DO_JUMP', hasPosition: false, params: ['Item #', 'Repeats', '', ''] },
  { id: 115, name: 'CONDITION_YAW', hasPosition: false, params: ['Angle (deg)', 'Rate (deg/s)', 'Dir (1 cw, -1 ccw)', 'Relative (1/0)'] },
  { id: 183, name: 'DO_SET_SERVO', hasPosition: false, params: ['Channel', 'PWM', '', ''] },
  { id: 206, name: 'DO_SET_CAM_TRIGG_DIST', hasPosition: false, params: ['Distance (m, 0 = off)', 'Shutter (ms)', 'Trigger now (1/0)', ''] },
  { id: 181, name: 'DO_SET_RELAY', hasPosition: false, params: ['Relay #', 'On (1/0)', '', ''] }
]

export function commandInfo(id: number): MissionCommandInfo {
  return MISSION_COMMANDS.find((c) => c.id === id) ?? { id, name: `CMD_${id}`, hasPosition: false, params: ['P1', 'P2', 'P3', 'P4'] }
}

export function newWaypoint(lat: number, lon: number, alt: number): MissionItem {
  return { command: 16, frame: FRAME_RELATIVE, param1: 0, param2: 0, param3: 0, param4: 0, lat, lon, alt }
}

// True if the item is a navigation item drawn on the map.
export function isMappable(item: MissionItem): boolean {
  return commandInfo(item.command).hasPosition && !(item.lat === 0 && item.lon === 0)
}

export function normalizeFrame(frame: number): number {
  if (frame === 5) return FRAME_ABSOLUTE
  if (frame === 6) return FRAME_RELATIVE
  if (frame === 11) return FRAME_TERRAIN
  return frame
}

export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function missionDistance(items: MissionItem[], home?: { lat: number; lon: number } | null): number {
  let total = 0
  let prev = home ?? null
  for (const it of items) {
    if (!isMappable(it)) continue
    if (prev) total += distanceMeters(prev.lat, prev.lon, it.lat, it.lon)
    prev = it
  }
  return total
}

// QGC WPL 110 — the text format used by Mission Planner and MAVProxy (.waypoints).
export function serializeWaypoints(items: MissionItem[], home: MissionItem | null): string {
  const homeItem: MissionItem = home ?? { command: 16, frame: FRAME_ABSOLUTE, param1: 0, param2: 0, param3: 0, param4: 0, lat: 0, lon: 0, alt: 0 }
  const rows = [homeItem, ...items].map((it, seq) =>
    [seq, seq === 0 ? 1 : 0, it.frame, it.command, it.param1, it.param2, it.param3, it.param4, it.lat, it.lon, it.alt, 1].join('\t')
  )
  return ['QGC WPL 110', ...rows].join('\n') + '\n'
}

export function parseWaypoints(text: string): { home: MissionItem | null; items: MissionItem[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines[0]?.startsWith('QGC WPL')) throw new Error('Not a .waypoints file (missing "QGC WPL" header)')
  const all: MissionItem[] = lines.slice(1).map((line, i) => {
    const f = line.split(/\s+/)
    if (f.length < 11) throw new Error(`Line ${i + 2}: expected 12 columns, found ${f.length}`)
    const n = f.slice(0, 11).map(Number)
    if (n.some(Number.isNaN)) throw new Error(`Line ${i + 2}: non-numeric value`)
    return { frame: normalizeFrame(n[2]), command: n[3], param1: n[4], param2: n[5], param3: n[6], param4: n[7], lat: n[8], lon: n[9], alt: n[10] }
  })
  return { home: all[0] ?? null, items: all.slice(1) }
}

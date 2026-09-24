// Radio calibration maths: turn recorded stick extremes and centre positions into RCn_MIN / RCn_MAX / RCn_TRIM values.

export interface RcRange {
  min: number
  max: number
}

export interface RcCalResult {
  channel: number // 1-based
  min: number
  max: number
  trim: number | null // null = leave RCn_TRIM alone
  skipped?: string // reason the channel is not calibrated
}

const MIN_TRAVEL_US = 200
const VALID_MIN_US = 800
const VALID_MAX_US = 2200

// Folds one RC_CHANNELS sample (0 = channel not received) into the running min/max per channel.
export function recordRcSample(ranges: (RcRange | null)[], channels: number[]): (RcRange | null)[] {
  return channels.map((v, i) => {
    const prev = ranges[i] ?? null
    if (!v) return prev
    return prev ? { min: Math.min(prev.min, v), max: Math.max(prev.max, v) } : { min: v, max: v }
  })
}

// centre: raw values with sticks released; roll/pitch/yaw are centred, throttle is at its lowest.
export function computeRcCalibration(ranges: (RcRange | null)[], centre: number[], throttleChannel = 3): RcCalResult[] {
  const results: RcCalResult[] = []
  ranges.forEach((range, i) => {
    if (!range) return
    const channel = i + 1
    const base = { channel, min: range.min, max: range.max, trim: null }
    if (range.max - range.min < MIN_TRAVEL_US) {
      results.push({ ...base, skipped: 'not moved enough' })
      return
    }
    if (range.min < VALID_MIN_US || range.max > VALID_MAX_US) {
      results.push({ ...base, skipped: 'values out of range' })
      return
    }
    let trim: number | null = null
    if (channel === throttleChannel) trim = range.min
    else if (channel <= 4) {
      const c = centre[i]
      trim = c && c >= range.min && c <= range.max ? c : Math.round((range.min + range.max) / 2)
    }
    results.push({ ...base, trim })
  })
  return results
}

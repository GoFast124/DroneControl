// Slider ranges are soft limits for the UI (the slider stretches if the vehicle's value is already beyond them).

export interface SliderSpec {
  id: string
  label: string
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  hint?: string
}

export interface AxisSpec {
  key: 'roll' | 'pitch' | 'yaw'
  label: string
  color: string
  prefix: string // e.g. ATC_RAT_RLL_
  angleP: string
  pidAxis: number // PID_TUNING axis id
}

export const AXES: AxisSpec[] = [
  { key: 'roll', label: 'Roll', color: '#3ecfff', prefix: 'ATC_RAT_RLL_', angleP: 'ATC_ANG_RLL_P', pidAxis: 1 },
  { key: 'pitch', label: 'Pitch', color: '#f5b942', prefix: 'ATC_RAT_PIT_', angleP: 'ATC_ANG_PIT_P', pidAxis: 2 },
  { key: 'yaw', label: 'Yaw', color: '#33d17a', prefix: 'ATC_RAT_YAW_', angleP: 'ATC_ANG_YAW_P', pidAxis: 3 }
]

export function ratePidSpecs(axis: AxisSpec): SliderSpec[] {
  const yaw = axis.key === 'yaw'
  return [
    { id: `${axis.prefix}P`, label: 'P', min: 0, max: yaw ? 2.5 : 0.5, step: yaw ? 0.01 : 0.001, decimals: 3, hint: 'Reacts to rate error. Too high: fast oscillation.' },
    { id: `${axis.prefix}I`, label: 'I', min: 0, max: 1, step: 0.005, decimals: 3, hint: 'Removes steady error. Too high: slow wobble.' },
    { id: `${axis.prefix}D`, label: 'D', min: 0, max: yaw ? 0.1 : 0.05, step: yaw ? 0.0005 : 0.0001, decimals: 4, hint: 'Damps the response. Too high: motor noise and hot motors.' },
    { id: `${axis.prefix}FF`, label: 'FF', min: 0, max: 0.5, step: 0.001, decimals: 3, hint: 'Feed-forward from the stick. Sharpens response without adding oscillation.' }
  ]
}

export function rateAdvancedSpecs(axis: AxisSpec): SliderSpec[] {
  return [
    { id: `${axis.prefix}IMAX`, label: 'I max', min: 0, max: 1, step: 0.01, decimals: 2 },
    { id: `${axis.prefix}FLTT`, label: 'Target filter', min: 0, max: 100, step: 1, unit: 'Hz' },
    { id: `${axis.prefix}FLTE`, label: 'Error filter', min: 0, max: 100, step: 1, unit: 'Hz' },
    { id: `${axis.prefix}FLTD`, label: 'D-term filter', min: 0, max: 100, step: 1, unit: 'Hz' }
  ]
}

export const ANGLE_SPECS: SliderSpec[] = AXES.map((a) => ({
  id: a.angleP,
  label: `${a.label} angle P`,
  min: 0,
  max: 12,
  step: 0.1,
  decimals: 1,
  hint: 'How hard the aircraft tries to reach the angle you ask for.'
}))

export const ACRO_SPECS: SliderSpec[] = [
  { id: 'ACRO_RP_RATE', label: 'Roll/pitch rate', min: 0, max: 720, step: 5, unit: '°/s', hint: 'Full-stick roll/pitch rate in ACRO.' },
  { id: 'ACRO_RP_EXPO', label: 'Roll/pitch expo', min: 0, max: 1, step: 0.05, decimals: 2, hint: 'Softens the centre of the stick, keeps full rate at the edges.' },
  { id: 'ACRO_Y_RATE', label: 'Yaw rate', min: 0, max: 720, step: 5, unit: '°/s', hint: 'Full-stick yaw rate in ACRO.' },
  { id: 'ACRO_Y_EXPO', label: 'Yaw expo', min: 0, max: 1, step: 0.05, decimals: 2 },
  // Older firmware expresses the same thing as a gain instead of a rate in deg/s.
  { id: 'ACRO_RP_P', label: 'Roll/pitch rate gain', min: 0, max: 10, step: 0.1, decimals: 1, hint: 'Older firmware: full-stick rate is about 45 × this value in °/s.' },
  { id: 'ACRO_YAW_P', label: 'Yaw rate gain', min: 0, max: 10, step: 0.1, decimals: 1, hint: 'Older firmware: full-stick rate is about 45 × this value in °/s.' }
]

// Full-stick ACRO rates in deg/s, whichever parameter naming the firmware uses.
export function acroRates(value: (id: string) => number | undefined): { rp?: number; yaw?: number } {
  const rp = value('ACRO_RP_RATE') ?? (value('ACRO_RP_P') !== undefined ? value('ACRO_RP_P')! * 45 : undefined)
  const yaw = value('ACRO_Y_RATE') ?? (value('ACRO_YAW_P') !== undefined ? value('ACRO_YAW_P')! * 45 : undefined)
  return { rp, yaw }
}

export const PILOT_SPECS: SliderSpec[] = [
  { id: 'PILOT_Y_RATE', label: 'Pilot yaw rate', min: 0, max: 360, step: 5, unit: '°/s', hint: 'Full-stick yaw rate in self-levelling modes.' },
  { id: 'ATC_INPUT_TC', label: 'Input time constant', min: 0, max: 1, step: 0.01, decimals: 2, unit: 's', hint: 'Smooths stick input. Lower = snappier, higher = softer.' },
  { id: 'ANGLE_MAX', label: 'Maximum lean angle', min: 1000, max: 8000, step: 100, unit: 'cdeg', hint: '4500 = 45°.' },
  { id: 'ATC_ACCEL_R_MAX', label: 'Roll accel limit', min: 0, max: 180000, step: 5000, unit: 'cdeg/s²', hint: '0 disables the limit.' },
  { id: 'ATC_ACCEL_P_MAX', label: 'Pitch accel limit', min: 0, max: 180000, step: 5000, unit: 'cdeg/s²' },
  { id: 'ATC_ACCEL_Y_MAX', label: 'Yaw accel limit', min: 0, max: 72000, step: 1000, unit: 'cdeg/s²' }
]

export const MOTOR_SPECS: SliderSpec[] = [
  { id: 'MOT_THST_EXPO', label: 'Thrust expo', min: 0, max: 1, step: 0.01, decimals: 2, hint: 'Compensates for the ESC/motor/prop thrust curve. Around 0.65 suits many 5 inch props.' },
  { id: 'MOT_THST_HOVER', label: 'Hover throttle', min: 0, max: 1, step: 0.005, decimals: 3, hint: 'Throttle needed to hover (learned automatically if enabled).' }
]

// Roll and pitch usually share tuning on a symmetric frame, so edits can be mirrored between them.
export function mirrorParam(id: string): string | null {
  if (id.includes('_RLL_')) return id.replace('_RLL_', '_PIT_')
  if (id.includes('_PIT_')) return id.replace('_PIT_', '_RLL_')
  return null
}

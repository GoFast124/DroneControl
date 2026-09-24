// ArduCopter custom_mode -> name (from ArduPilot's mode.h enum).
export const COPTER_MODES: Record<number, string> = {
  0: 'STABILIZE',
  1: 'ACRO',
  2: 'ALT_HOLD',
  3: 'AUTO',
  4: 'GUIDED',
  5: 'LOITER',
  6: 'RTL',
  7: 'CIRCLE',
  9: 'LAND',
  11: 'DRIFT',
  13: 'SPORT',
  14: 'FLIP',
  15: 'AUTOTUNE',
  16: 'POSHOLD',
  17: 'BRAKE',
  18: 'THROW',
  19: 'AVOID_ADSB',
  20: 'GUIDED_NOGPS',
  21: 'SMART_RTL',
  22: 'FLOWHOLD',
  23: 'FOLLOW',
  24: 'ZIGZAG',
  25: 'SYSTEMID',
  26: 'AUTOROTATE',
  27: 'AUTO_RTL'
}

export const MODE_GUIDED = 4
export const MODE_RTL = 6
export const MODE_LAND = 9

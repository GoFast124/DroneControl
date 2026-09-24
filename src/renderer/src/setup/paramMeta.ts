// Lookup tables for ArduCopter parameter values shown in the Setup pages.

export type Options = [number, string][]

export const SERIAL_PROTOCOLS: Options = [
  [-1, 'None'], [1, 'MAVLink 1'], [2, 'MAVLink 2'], [3, 'FrSky D'], [4, 'FrSky SPort'], [5, 'GPS'],
  [7, 'Alexmos Gimbal'], [8, 'SToRM32 Gimbal'], [9, 'Rangefinder'], [10, 'FrSky SPort Passthrough'],
  [11, 'Lidar 360'], [13, 'Beacon'], [14, 'Volz servo'], [15, 'SBus servo'], [16, 'ESC telemetry'],
  [17, 'Devo telemetry'], [18, 'Optical flow'], [19, 'Robotis servo'], [20, 'NMEA output'], [21, 'Wind vane'],
  [22, 'SLCAN'], [23, 'RC input'], [24, 'EFI'], [25, 'LTM'], [26, 'RunCam'], [27, 'HoTT telemetry'],
  [28, 'Scripting'], [29, 'Crossfire'], [30, 'Generator'], [31, 'Winch'], [32, 'MSP'], [33, 'DJI FPV'],
  [34, 'Airspeed'], [35, 'ADS-B'], [36, 'AHRS'], [37, 'SmartAudio'], [38, 'FETtec OneWire'], [39, 'Torqeedo'],
  [40, 'AIS'], [41, 'CoDevESC'], [42, 'DisplayPort'], [43, 'MAVLink high latency'], [44, 'IRC Tramp']
]

export const SERIAL_BAUDS: Options = [
  [1, '1200'], [2, '2400'], [4, '4800'], [9, '9600'], [19, '19200'], [38, '38400'], [57, '57600'],
  [111, '111100'], [115, '115200'], [230, '230400'], [256, '256000'], [460, '460800'], [500, '500000'],
  [921, '921600'], [1500, '1500000'], [2000, '2000000']
]

const RCIN_FUNCTIONS: Options = Array.from({ length: 16 }, (_, i): [number, string] => [51 + i, `RC input ${i + 1}`])
const MOTOR_FUNCTIONS: Options = [
  ...Array.from({ length: 8 }, (_, i): [number, string] => [33 + i, `Motor ${i + 1}`]),
  [82, 'Motor 9'], [83, 'Motor 10'], [84, 'Motor 11'], [85, 'Motor 12']
]

export const SERVO_FUNCTIONS: Options = [
  [-1, 'GPIO'], [0, 'Disabled'], [1, 'RC pass-through'], [6, 'Mount 1 yaw'], [7, 'Mount 1 pitch'], [8, 'Mount 1 roll'],
  [9, 'Mount 1 retract'], [10, 'Camera trigger'], [28, 'Gripper'], [29, 'Landing gear'], [70, 'Throttle'],
  ...MOTOR_FUNCTIONS,
  ...RCIN_FUNCTIONS,
  ...Array.from({ length: 16 }, (_, i): [number, string] => [94 + i, `Script ${i + 1}`])
]

const ORIENTATION_NAMES = [
  'None', 'Yaw 45', 'Yaw 90', 'Yaw 135', 'Yaw 180', 'Yaw 225', 'Yaw 270', 'Yaw 315', 'Roll 180', 'Roll 180 Yaw 45',
  'Roll 180 Yaw 90', 'Roll 180 Yaw 135', 'Pitch 180', 'Roll 180 Yaw 225', 'Roll 180 Yaw 270', 'Roll 180 Yaw 315',
  'Roll 90', 'Roll 90 Yaw 45', 'Roll 90 Yaw 90', 'Roll 90 Yaw 135', 'Roll 270', 'Roll 270 Yaw 45', 'Roll 270 Yaw 90',
  'Roll 270 Yaw 135', 'Pitch 90', 'Pitch 270', 'Pitch 180 Yaw 90', 'Pitch 180 Yaw 270', 'Roll 90 Pitch 90',
  'Roll 180 Pitch 90', 'Roll 270 Pitch 90', 'Roll 90 Pitch 180', 'Roll 270 Pitch 180', 'Roll 90 Pitch 270',
  'Roll 180 Pitch 270', 'Roll 270 Pitch 270', 'Roll 90 Pitch 180 Yaw 90', 'Roll 90 Yaw 270', 'Roll 90 Pitch 68 Yaw 293',
  'Pitch 315', 'Roll 90 Pitch 315'
]
export const ORIENTATIONS: Options = [...ORIENTATION_NAMES.map((n, i): [number, string] => [i, n]), [100, 'Custom']]

export const FRAME_CLASSES: Options = [
  [0, 'Undefined'], [1, 'Quad'], [2, 'Hexa'], [3, 'Octa'], [4, 'Octa-quad'], [5, 'Y6'], [6, 'Heli'], [7, 'Tri'],
  [8, 'Single copter'], [9, 'Coax copter'], [10, 'Bi copter'], [11, 'Heli dual'], [12, 'Dodeca-hexa'], [13, 'Heli quad'], [14, 'Deca']
]

export const FRAME_TYPES: Options = [
  [0, 'Plus'], [1, 'X'], [2, 'V'], [3, 'H'], [4, 'V-tail'], [5, 'A-tail'], [10, 'Y6 B'], [11, 'BetaFlight X'],
  [12, 'DJI X'], [13, 'Clockwise X'], [14, 'I']
]

// Motors driven by each FRAME_CLASS; used to size the motor test.
export const MOTORS_BY_FRAME_CLASS: Record<number, number> = { 1: 4, 2: 6, 3: 8, 4: 8, 5: 6, 7: 3, 8: 4, 9: 2, 10: 2, 12: 12, 14: 10 }

export const MOT_PWM_TYPES: Options = [
  [0, 'Normal'], [1, 'OneShot'], [2, 'OneShot125'], [3, 'Brushed'], [4, 'DShot150'], [5, 'DShot300'],
  [6, 'DShot600'], [7, 'DShot1200'], [8, 'PWM range']
]

// FLTMODEn is chosen by the pulse width on the mode channel.
export const FLIGHT_MODE_PWM_EDGES = [1231, 1361, 1491, 1621, 1750]
export function flightModeSlot(pwm: number): number {
  if (!pwm) return -1
  const i = FLIGHT_MODE_PWM_EDGES.findIndex((edge) => pwm < edge)
  return i === -1 ? 5 : i
}

export const MAG_CAL_STATUS: Record<number, string> = {
  0: 'Not started',
  1: 'Waiting to start',
  2: 'Running (step 1)',
  3: 'Running (step 2)',
  4: 'Success',
  5: 'Failed',
  6: 'Bad orientation',
  7: 'Bad radius'
}

export const ACCEL_POSITIONS: Record<number, string> = {
  1: 'Place the vehicle LEVEL',
  2: 'Place the vehicle on its LEFT side',
  3: 'Place the vehicle on its RIGHT side',
  4: 'Place the vehicle NOSE DOWN',
  5: 'Place the vehicle NOSE UP',
  6: 'Place the vehicle upside down (on its BACK)'
}
export const ACCEL_SUCCESS = 16777215
export const ACCEL_FAILED = 16777216

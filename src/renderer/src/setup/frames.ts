// Motor layouts for ArduCopter frames, generated from ArduPilot's libraries/AP_Motors/AP_MotorsMatrix.cpp (master).
// angle: degrees clockwise from the nose, seen from above. dir: propeller rotation seen from above (1 = counter-clockwise,
// -1 = clockwise, 0 = not specified). order: the position in the motor test sequence (test letter A = 1, B = 2, ...).
// Which frame types a given firmware accepts depends on its version.

export interface FrameMotor {
  n: number
  angle: number
  dir: 1 | -1 | 0
  order: number
}

export interface FrameTypeDef {
  type: number
  name: string
  motors: FrameMotor[]
}

export interface FrameClassDef {
  id: number
  name: string
  types: FrameTypeDef[]
  diagram: boolean
  note?: string
}

export const FRAME_DEFS: FrameClassDef[] = [
  {
    id: 1,
    name: 'Quad',
    diagram: true,
    types: [
      {
        type: 0,
        name: 'Plus',
        motors: [
          { n: 1, angle: 90, dir: 1, order: 2 },
          { n: 2, angle: -90, dir: 1, order: 4 },
          { n: 3, angle: 0, dir: -1, order: 1 },
          { n: 4, angle: 180, dir: -1, order: 3 },
        ]
      },
      {
        type: 1,
        name: 'X',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -135, dir: 1, order: 3 },
          { n: 3, angle: -45, dir: -1, order: 4 },
          { n: 4, angle: 135, dir: -1, order: 2 },
        ]
      },
      {
        type: 12,
        name: 'BetaFlight X',
        motors: [
          { n: 1, angle: 135, dir: -1, order: 2 },
          { n: 2, angle: 45, dir: 1, order: 1 },
          { n: 3, angle: -135, dir: 1, order: 3 },
          { n: 4, angle: -45, dir: -1, order: 4 },
        ]
      },
      {
        type: 18,
        name: 'BetaFlight X (reversed)',
        motors: [
          { n: 1, angle: 135, dir: 1, order: 2 },
          { n: 2, angle: 45, dir: -1, order: 1 },
          { n: 3, angle: -135, dir: -1, order: 3 },
          { n: 4, angle: -45, dir: 1, order: 4 },
        ]
      },
      {
        type: 13,
        name: 'DJI X',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -45, dir: -1, order: 4 },
          { n: 3, angle: -135, dir: 1, order: 3 },
          { n: 4, angle: 135, dir: -1, order: 2 },
        ]
      },
      {
        type: 14,
        name: 'Clockwise X',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: 135, dir: -1, order: 2 },
          { n: 3, angle: -135, dir: 1, order: 3 },
          { n: 4, angle: -45, dir: -1, order: 4 },
        ]
      },
      {
        type: 2,
        name: 'V',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -135, dir: 1, order: 3 },
          { n: 3, angle: -45, dir: -1, order: 4 },
          { n: 4, angle: 135, dir: -1, order: 2 },
        ]
      },
      {
        type: 3,
        name: 'H',
        motors: [
          { n: 1, angle: 45, dir: -1, order: 1 },
          { n: 2, angle: -135, dir: -1, order: 3 },
          { n: 3, angle: -45, dir: 1, order: 4 },
          { n: 4, angle: 135, dir: 1, order: 2 },
        ]
      },
      {
        type: 4,
        name: 'V-tail',
        motors: [
          { n: 1, angle: 60, dir: 0, order: 1 },
          { n: 2, angle: -160, dir: -1, order: 3 },
          { n: 3, angle: -60, dir: 0, order: 4 },
          { n: 4, angle: 160, dir: 1, order: 2 },
        ]
      },
      {
        type: 5,
        name: 'A-tail',
        motors: [
          { n: 1, angle: 60, dir: 0, order: 1 },
          { n: 2, angle: -160, dir: 1, order: 3 },
          { n: 3, angle: -60, dir: 0, order: 4 },
          { n: 4, angle: 160, dir: -1, order: 2 },
        ]
      },
      {
        type: 6,
        name: 'Plus (reversed)',
        motors: [
          { n: 1, angle: 90, dir: -1, order: 2 },
          { n: 2, angle: -90, dir: -1, order: 4 },
          { n: 3, angle: 0, dir: 1, order: 1 },
          { n: 4, angle: 180, dir: 1, order: 3 },
        ]
      },
      {
        type: 19,
        name: 'Y4',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -180, dir: -1, order: 2 },
          { n: 3, angle: -180, dir: 1, order: 3 },
          { n: 4, angle: -45, dir: -1, order: 4 },
        ]
      },
    ]
  },
  {
    id: 2,
    name: 'Hexa',
    diagram: true,
    types: [
      {
        type: 0,
        name: 'Plus',
        motors: [
          { n: 1, angle: 0, dir: -1, order: 1 },
          { n: 2, angle: 180, dir: 1, order: 4 },
          { n: 3, angle: -120, dir: -1, order: 5 },
          { n: 4, angle: 60, dir: 1, order: 2 },
          { n: 5, angle: -60, dir: 1, order: 6 },
          { n: 6, angle: 120, dir: -1, order: 3 },
        ]
      },
      {
        type: 1,
        name: 'X',
        motors: [
          { n: 1, angle: 90, dir: -1, order: 2 },
          { n: 2, angle: -90, dir: 1, order: 5 },
          { n: 3, angle: -30, dir: -1, order: 6 },
          { n: 4, angle: 150, dir: 1, order: 3 },
          { n: 5, angle: 30, dir: 1, order: 1 },
          { n: 6, angle: -150, dir: -1, order: 4 },
        ]
      },
      {
        type: 3,
        name: 'H',
        motors: [
          { n: 1, angle: 90, dir: -1, order: 2 },
          { n: 2, angle: -90, dir: 1, order: 5 },
          { n: 3, angle: -45, dir: -1, order: 6 },
          { n: 4, angle: 135, dir: 1, order: 3 },
          { n: 5, angle: 45, dir: 1, order: 1 },
          { n: 6, angle: -135, dir: -1, order: 4 },
        ]
      },
      {
        type: 13,
        name: 'DJI X',
        motors: [
          { n: 1, angle: 30, dir: 1, order: 1 },
          { n: 2, angle: -30, dir: -1, order: 6 },
          { n: 3, angle: -90, dir: 1, order: 5 },
          { n: 4, angle: -150, dir: -1, order: 4 },
          { n: 5, angle: 150, dir: 1, order: 3 },
          { n: 6, angle: 90, dir: -1, order: 2 },
        ]
      },
      {
        type: 14,
        name: 'Clockwise X',
        motors: [
          { n: 1, angle: 30, dir: 1, order: 1 },
          { n: 2, angle: 90, dir: -1, order: 2 },
          { n: 3, angle: 150, dir: 1, order: 3 },
          { n: 4, angle: -150, dir: -1, order: 4 },
          { n: 5, angle: -90, dir: 1, order: 5 },
          { n: 6, angle: -30, dir: -1, order: 6 },
        ]
      },
    ]
  },
  {
    id: 3,
    name: 'Octa',
    diagram: true,
    types: [
      {
        type: 0,
        name: 'Plus',
        motors: [
          { n: 1, angle: 0, dir: -1, order: 1 },
          { n: 2, angle: 180, dir: -1, order: 5 },
          { n: 3, angle: 45, dir: 1, order: 2 },
          { n: 4, angle: 135, dir: 1, order: 4 },
          { n: 5, angle: -45, dir: 1, order: 8 },
          { n: 6, angle: -135, dir: 1, order: 6 },
          { n: 7, angle: -90, dir: -1, order: 7 },
          { n: 8, angle: 90, dir: -1, order: 3 },
        ]
      },
      {
        type: 1,
        name: 'X',
        motors: [
          { n: 1, angle: 22.5, dir: -1, order: 1 },
          { n: 2, angle: -157.5, dir: -1, order: 5 },
          { n: 3, angle: 67.5, dir: 1, order: 2 },
          { n: 4, angle: 157.5, dir: 1, order: 4 },
          { n: 5, angle: -22.5, dir: 1, order: 8 },
          { n: 6, angle: -112.5, dir: 1, order: 6 },
          { n: 7, angle: -67.5, dir: -1, order: 7 },
          { n: 8, angle: 112.5, dir: -1, order: 3 },
        ]
      },
      {
        type: 2,
        name: 'V',
        motors: [
          { n: 1, angle: -68, dir: -1, order: 7 },
          { n: 2, angle: 116, dir: -1, order: 3 },
          { n: 3, angle: -116, dir: 1, order: 6 },
          { n: 4, angle: 153, dir: 1, order: 4 },
          { n: 5, angle: -45, dir: 1, order: 8 },
          { n: 6, angle: 68, dir: 1, order: 2 },
          { n: 7, angle: 45, dir: -1, order: 1 },
          { n: 8, angle: -153, dir: -1, order: 5 },
        ]
      },
      {
        type: 3,
        name: 'H',
        motors: [
          { n: 1, angle: 45, dir: -1, order: 1 },
          { n: 2, angle: -135, dir: -1, order: 5 },
          { n: 3, angle: 72, dir: 1, order: 2 },
          { n: 4, angle: 135, dir: 1, order: 4 },
          { n: 5, angle: -45, dir: 1, order: 8 },
          { n: 6, angle: -108, dir: 1, order: 6 },
          { n: 7, angle: -72, dir: -1, order: 7 },
          { n: 8, angle: 108, dir: -1, order: 3 },
        ]
      },
      {
        type: 15,
        name: 'I',
        motors: [
          { n: 1, angle: -162, dir: -1, order: 5 },
          { n: 2, angle: 18, dir: -1, order: 1 },
          { n: 3, angle: -135, dir: 1, order: 6 },
          { n: 4, angle: -18, dir: 1, order: 8 },
          { n: 5, angle: 162, dir: 1, order: 4 },
          { n: 6, angle: 45, dir: 1, order: 2 },
          { n: 7, angle: 135, dir: -1, order: 3 },
          { n: 8, angle: -45, dir: -1, order: 7 },
        ]
      },
      {
        type: 13,
        name: 'DJI X',
        motors: [
          { n: 1, angle: 22.5, dir: 1, order: 1 },
          { n: 2, angle: -22.5, dir: -1, order: 8 },
          { n: 3, angle: -67.5, dir: 1, order: 7 },
          { n: 4, angle: -112.5, dir: -1, order: 6 },
          { n: 5, angle: -157.5, dir: 1, order: 5 },
          { n: 6, angle: 157.5, dir: -1, order: 4 },
          { n: 7, angle: 112.5, dir: 1, order: 3 },
          { n: 8, angle: 67.5, dir: -1, order: 2 },
        ]
      },
      {
        type: 14,
        name: 'Clockwise X',
        motors: [
          { n: 1, angle: 22.5, dir: 1, order: 1 },
          { n: 2, angle: 67.5, dir: -1, order: 2 },
          { n: 3, angle: 112.5, dir: 1, order: 3 },
          { n: 4, angle: 157.5, dir: -1, order: 4 },
          { n: 5, angle: -157.5, dir: 1, order: 5 },
          { n: 6, angle: -112.5, dir: -1, order: 6 },
          { n: 7, angle: -67.5, dir: 1, order: 7 },
          { n: 8, angle: -22.5, dir: -1, order: 8 },
        ]
      },
    ]
  },
  {
    id: 4,
    name: 'Octa-quad',
    diagram: true,
    types: [
      {
        type: 0,
        name: 'Plus',
        motors: [
          { n: 1, angle: 0, dir: 1, order: 1 },
          { n: 2, angle: -90, dir: -1, order: 7 },
          { n: 3, angle: 180, dir: 1, order: 5 },
          { n: 4, angle: 90, dir: -1, order: 3 },
          { n: 5, angle: -90, dir: 1, order: 8 },
          { n: 6, angle: 0, dir: -1, order: 2 },
          { n: 7, angle: 90, dir: 1, order: 4 },
          { n: 8, angle: 180, dir: -1, order: 6 },
        ]
      },
      {
        type: 1,
        name: 'X',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -45, dir: -1, order: 7 },
          { n: 3, angle: -135, dir: 1, order: 5 },
          { n: 4, angle: 135, dir: -1, order: 3 },
          { n: 5, angle: -45, dir: 1, order: 8 },
          { n: 6, angle: 45, dir: -1, order: 2 },
          { n: 7, angle: 135, dir: 1, order: 4 },
          { n: 8, angle: -135, dir: -1, order: 6 },
        ]
      },
      {
        type: 2,
        name: 'V',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -45, dir: -1, order: 7 },
          { n: 3, angle: -135, dir: 1, order: 5 },
          { n: 4, angle: 135, dir: -1, order: 3 },
          { n: 5, angle: -45, dir: 1, order: 8 },
          { n: 6, angle: 45, dir: -1, order: 2 },
          { n: 7, angle: 135, dir: 1, order: 4 },
          { n: 8, angle: -135, dir: -1, order: 6 },
        ]
      },
      {
        type: 3,
        name: 'H',
        motors: [
          { n: 1, angle: 45, dir: -1, order: 1 },
          { n: 2, angle: -45, dir: 1, order: 7 },
          { n: 3, angle: -135, dir: -1, order: 5 },
          { n: 4, angle: 135, dir: 1, order: 3 },
          { n: 5, angle: -45, dir: -1, order: 8 },
          { n: 6, angle: 45, dir: 1, order: 2 },
          { n: 7, angle: 135, dir: -1, order: 4 },
          { n: 8, angle: -135, dir: 1, order: 6 },
        ]
      },
      {
        type: 14,
        name: 'Clockwise X',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: 45, dir: -1, order: 2 },
          { n: 3, angle: 135, dir: -1, order: 3 },
          { n: 4, angle: 135, dir: 1, order: 4 },
          { n: 5, angle: -135, dir: 1, order: 5 },
          { n: 6, angle: -135, dir: -1, order: 6 },
          { n: 7, angle: -45, dir: -1, order: 7 },
          { n: 8, angle: -45, dir: 1, order: 8 },
        ]
      },
      {
        type: 12,
        name: 'BetaFlight X',
        motors: [
          { n: 1, angle: 135, dir: -1, order: 3 },
          { n: 2, angle: 45, dir: 1, order: 1 },
          { n: 3, angle: -135, dir: 1, order: 5 },
          { n: 4, angle: -45, dir: -1, order: 7 },
          { n: 5, angle: 135, dir: 1, order: 4 },
          { n: 6, angle: 45, dir: -1, order: 2 },
          { n: 7, angle: -135, dir: -1, order: 6 },
          { n: 8, angle: -45, dir: 1, order: 8 },
        ]
      },
      {
        type: 18,
        name: 'BetaFlight X (reversed)',
        motors: [
          { n: 1, angle: 135, dir: 1, order: 3 },
          { n: 2, angle: 45, dir: -1, order: 1 },
          { n: 3, angle: -135, dir: -1, order: 5 },
          { n: 4, angle: -45, dir: 1, order: 7 },
          { n: 5, angle: 135, dir: -1, order: 4 },
          { n: 6, angle: 45, dir: 1, order: 2 },
          { n: 7, angle: -135, dir: 1, order: 6 },
          { n: 8, angle: -45, dir: -1, order: 8 },
        ]
      },
      {
        type: 20,
        name: 'X co-rotating',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: -45, dir: -1, order: 7 },
          { n: 3, angle: -135, dir: 1, order: 5 },
          { n: 4, angle: 135, dir: -1, order: 3 },
          { n: 5, angle: -45, dir: -1, order: 8 },
          { n: 6, angle: 45, dir: 1, order: 2 },
          { n: 7, angle: 135, dir: -1, order: 4 },
          { n: 8, angle: -135, dir: 1, order: 6 },
        ]
      },
      {
        type: 21,
        name: 'Clockwise X co-rotating',
        motors: [
          { n: 1, angle: 45, dir: 1, order: 1 },
          { n: 2, angle: 45, dir: 1, order: 2 },
          { n: 3, angle: 135, dir: -1, order: 3 },
          { n: 4, angle: 135, dir: -1, order: 4 },
          { n: 5, angle: -135, dir: 1, order: 5 },
          { n: 6, angle: -135, dir: 1, order: 6 },
          { n: 7, angle: -45, dir: -1, order: 7 },
          { n: 8, angle: -45, dir: -1, order: 8 },
        ]
      },
    ]
  },
  {
    id: 5,
    name: 'Y6',
    diagram: true,
    types: [
      {
        type: 10,
        name: 'Y6 B',
        motors: [
          { n: 1, angle: 63, dir: -1, order: 1 },
          { n: 2, angle: 63, dir: 1, order: 2 },
          { n: 3, angle: -180, dir: -1, order: 3 },
          { n: 4, angle: -180, dir: 1, order: 4 },
          { n: 5, angle: -63, dir: -1, order: 5 },
          { n: 6, angle: -63, dir: 1, order: 6 },
        ]
      },
      {
        type: 11,
        name: 'Y6 F (FireFly)',
        motors: [
          { n: 1, angle: -180, dir: 1, order: 3 },
          { n: 2, angle: 63, dir: 1, order: 1 },
          { n: 3, angle: -63, dir: 1, order: 5 },
          { n: 4, angle: -180, dir: -1, order: 4 },
          { n: 5, angle: 63, dir: -1, order: 2 },
          { n: 6, angle: -63, dir: -1, order: 6 },
        ]
      },
      {
        type: 0,
        name: 'Standard',
        motors: [
          { n: 1, angle: 56, dir: 1, order: 2 },
          { n: 2, angle: -56, dir: -1, order: 5 },
          { n: 3, angle: -56, dir: 1, order: 6 },
          { n: 4, angle: -180, dir: -1, order: 4 },
          { n: 5, angle: 56, dir: -1, order: 1 },
          { n: 6, angle: -180, dir: 1, order: 3 },
        ]
      },
    ]
  },
  {
    id: 12,
    name: 'Dodeca-hexa',
    diagram: true,
    types: [
      {
        type: 0,
        name: 'Plus',
        motors: [
          { n: 1, angle: 0, dir: 1, order: 1 },
          { n: 2, angle: 0, dir: -1, order: 2 },
          { n: 3, angle: 60, dir: -1, order: 3 },
          { n: 4, angle: 60, dir: 1, order: 4 },
          { n: 5, angle: 120, dir: 1, order: 5 },
          { n: 6, angle: 120, dir: -1, order: 6 },
          { n: 7, angle: 180, dir: -1, order: 7 },
          { n: 8, angle: 180, dir: 1, order: 8 },
          { n: 9, angle: -120, dir: 1, order: 9 },
          { n: 10, angle: -120, dir: -1, order: 10 },
          { n: 11, angle: -60, dir: -1, order: 11 },
          { n: 12, angle: -60, dir: 1, order: 12 },
        ]
      },
      {
        type: 1,
        name: 'X',
        motors: [
          { n: 1, angle: 30, dir: 1, order: 1 },
          { n: 2, angle: 30, dir: -1, order: 2 },
          { n: 3, angle: 90, dir: -1, order: 3 },
          { n: 4, angle: 90, dir: 1, order: 4 },
          { n: 5, angle: 150, dir: 1, order: 5 },
          { n: 6, angle: 150, dir: -1, order: 6 },
          { n: 7, angle: -150, dir: -1, order: 7 },
          { n: 8, angle: -150, dir: 1, order: 8 },
          { n: 9, angle: -90, dir: 1, order: 9 },
          { n: 10, angle: -90, dir: -1, order: 10 },
          { n: 11, angle: -30, dir: -1, order: 11 },
          { n: 12, angle: -30, dir: 1, order: 12 },
        ]
      },
    ]
  },
  {
    id: 14,
    name: 'Deca',
    diagram: true,
    types: [
      {
        type: 0,
        name: 'Plus',
        motors: [
          { n: 1, angle: 0, dir: 1, order: 1 },
          { n: 2, angle: 36, dir: -1, order: 2 },
          { n: 3, angle: 72, dir: 1, order: 3 },
          { n: 4, angle: 108, dir: -1, order: 4 },
          { n: 5, angle: 144, dir: 1, order: 5 },
          { n: 6, angle: 180, dir: -1, order: 6 },
          { n: 7, angle: -144, dir: 1, order: 7 },
          { n: 8, angle: -108, dir: -1, order: 8 },
          { n: 9, angle: -72, dir: 1, order: 9 },
          { n: 10, angle: -36, dir: -1, order: 10 },
        ]
      },
      {
        type: 1,
        name: 'X',
        motors: [
          { n: 1, angle: 18, dir: 1, order: 1 },
          { n: 2, angle: 54, dir: -1, order: 2 },
          { n: 3, angle: 90, dir: 1, order: 3 },
          { n: 4, angle: 126, dir: -1, order: 4 },
          { n: 5, angle: 162, dir: 1, order: 5 },
          { n: 6, angle: -162, dir: -1, order: 6 },
          { n: 7, angle: -126, dir: 1, order: 7 },
          { n: 8, angle: -90, dir: -1, order: 8 },
          { n: 9, angle: -54, dir: 1, order: 9 },
          { n: 10, angle: -18, dir: -1, order: 10 },
        ]
      },
      {
        type: 14,
        name: 'Clockwise X',
        motors: [
          { n: 1, angle: 18, dir: 1, order: 1 },
          { n: 2, angle: 54, dir: -1, order: 2 },
          { n: 3, angle: 90, dir: 1, order: 3 },
          { n: 4, angle: 126, dir: -1, order: 4 },
          { n: 5, angle: 162, dir: 1, order: 5 },
          { n: 6, angle: -162, dir: -1, order: 6 },
          { n: 7, angle: -126, dir: 1, order: 7 },
          { n: 8, angle: -90, dir: -1, order: 8 },
          { n: 9, angle: -54, dir: 1, order: 9 },
          { n: 10, angle: -18, dir: -1, order: 10 },
        ]
      },
    ]
  },
  {
    id: 7,
    name: 'Tricopter',
    diagram: true,
    note: 'Motors 1, 2 and 4 drive propellers; the tail servo goes on output 7. Propeller directions are not shown because they depend on your build.',
    types: [
      {
        type: 0,
        name: 'Standard',
        motors: [
          { n: 1, angle: 60, dir: 0, order: 1 },
          { n: 2, angle: -60, dir: 0, order: 2 },
          { n: 4, angle: 180, dir: 0, order: 3 }
        ]
      }
    ]
  },
  { id: 6, name: 'Helicopter', diagram: false, types: [] },
  { id: 11, name: 'Helicopter (dual)', diagram: false, types: [] },
  { id: 13, name: 'Helicopter (quad)', diagram: false, types: [] },
  { id: 8, name: 'Single copter', diagram: false, types: [] },
  { id: 9, name: 'Coax copter', diagram: false, types: [] },
  { id: 10, name: 'Tailsitter / Bicopter', diagram: false, types: [] },
  { id: 15, name: 'Scripting matrix', diagram: false, types: [] },
  { id: 16, name: '6DoF scripting', diagram: false, types: [] },
  { id: 17, name: 'Dynamic scripting matrix', diagram: false, types: [] },
]

export function frameClassDef(id: number | undefined): FrameClassDef | undefined {
  return FRAME_DEFS.find((c) => c.id === id)
}

export function frameTypeDef(classId: number | undefined, type: number | undefined): FrameTypeDef | undefined {
  return frameClassDef(classId)?.types.find((t) => t.type === type)
}

// Human-readable description, e.g. "Quad X".
export function frameLabel(classId: number | undefined, type: number | undefined): string {
  const cls = frameClassDef(classId)
  if (!cls) return classId === 0 ? 'Undefined' : `Class ${classId ?? '?'}`
  const t = cls.types.find((x) => x.type === type)
  return t ? `${cls.name} ${t.name}` : `${cls.name} (type ${type ?? '?'})`
}

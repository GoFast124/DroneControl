# DroneControl

A desktop ground control station for ArduCopter, built with Electron, React and TypeScript. It talks MAVLink directly to the flight controller (via [`node-mavlink`](https://github.com/ArduPilot/node-mavlink) and [`serialport`](https://serialport.io/)) and covers the everyday Mission Planner jobs in a cleaner interface.

> **Safety:** this software has only been tested against the ArduPilot SITL simulator, not real hardware. Try everything with props off first. Arm, takeoff, mode changes and mission writes send real commands to the vehicle.

## Features

- **Connections:** USB/serial (choose baud rate), UDP (listen on a port, optional remote host), and TCP.
- **Dashboard:** artificial horizon, ground speed and altitude tapes, heading ribbon, battery, GPS, position and radio readouts, plus a square satellite map that follows the aircraft (with its trail and the mission path). The map and the radar can each be hidden and the choice is remembered.
- **Proximity radar:** top-down radar on the dashboard for 360 degree lidar scans (`OBSTACLE_DISTANCE`) and single-point distance sensors (`DISTANCE_SENSOR`, including ArduPilot's 8-sector data). Beams and scan points are coloured by distance, with a nearest-obstacle readout, up/down sensor values, a warning ring under 2 m, and auto or fixed range (2-40 m). Data that stops arriving is cleared after a couple of seconds.
- **Flight controls:** mode selector, arm/disarm, takeoff to a chosen altitude, Land and RTL. Arm, disarm and takeoff ask for confirmation.
- **Vehicle messages:** live feed of the vehicle's status text, colour-coded by severity, so pre-arm failures, warnings and failsafes are visible. Includes a "warnings and errors only" filter.
- **Parameters:** load the full list, search, and edit either in a table (Enter to write) or as raw `NAME,VALUE` text. Every write is confirmed by the vehicle echoing the value back. Import and export `.param` files.
- **Setup:** the equivalent of Mission Planner's setup tab, in seven pages.
  - *Accelerometer & level:* live attitude, level trim, the six-position accelerometer calibration, gyro and barometer calibration.
  - *Compass:* detected compasses, use/orientation settings, and onboard calibration with per-compass progress, sphere coverage and the fitness report.
  - *Radio calibration:* live channel bars with stored min/trim/max, a stick calibration wizard, and reverse toggles.
  - *Servo outputs:* live output bars and function/min/trim/max/reverse for every output.
  - *Flight modes:* mode assignment for the six switch positions, simple/super-simple, with the active slot highlighted from the live switch.
  - *Serial ports:* protocol and baud rate per port, and a reboot button.
  - *Motors & ESC:* frame and ESC protocol, a motor test (propeller confirmation required, disarmed only, throttle capped at 30%), and ESC calibration.
- **Tuning:** slider-based editing of the roll/pitch/yaw rate PIDs, angle P, ACRO rates and expo, pilot input limits and motor thrust. A tick on each slider marks the value currently on the vehicle, roll and pitch can be linked, and writes are confirmed by the vehicle. A live graph compares actual and target roll/pitch/yaw (rate or angle) and shows the P/I/D/FF terms when PID data is enabled, alongside an ACRO stick-response curve.
- **Mission planning:** satellite/street map with the live vehicle marker and trail. Click to add waypoints, drag to move them, and edit commands and parameters in a list. Read, write and clear the mission on the vehicle, set the active waypoint, and import/export `.waypoints` files (the Mission Planner format).
- **Logs:** live MAVLink message stream with filtering.

## Requirements

- Node.js (developed and tested on Node 24)
- For the simulator: Docker (optional)

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload |
| `npm run build` | Production build into `out/` |
| `npm run typecheck` | Type-check the main, preload and renderer code |

Installer packaging (`npm run package`) is not set up or tested yet.

## Connecting

Click **Connect** in the top bar.

| Link | Typical use |
| --- | --- |
| **Serial / USB** | Flight controller over USB, or a telemetry radio on a COM port (57600 is the usual radio baud rate) |
| **UDP** | Bind port 14550 and leave the remote host blank. Works with MAVProxy and mavlink-router outputs |
| **TCP** | Simulator or companion computer, e.g. `127.0.0.1:5760` |

ArduPilot only streams telemetry to a GCS that asks for it, so the app requests the data streams automatically on connect.

## Trying it without a drone (SITL)

The community image [`radarku/ardupilot-sitl`](https://hub.docker.com/r/radarku/ardupilot-sitl) runs ArduCopter SITL on TCP port 5760:

```bash
docker run -d --name arducopter-sitl --rm -p 5760:5760 radarku/ardupilot-sitl
```

Wait about 45 seconds for it to boot and get a GPS fix, then connect over TCP to `127.0.0.1:5760`.

The simulator starts in Massachusetts by default. To start somewhere else, pass `LAT`, `LON` and `ALT` (metres) as environment variables, for example Flagstaff Hill, South Australia:

```bash
docker run -d --name arducopter-sitl --rm -p 5760:5760 --env LAT=-35.0500 --env LON=138.5830 --env ALT=120 radarku/ardupilot-sitl
```

- This image accepts only one client per boot. To reconnect, restart the container (`docker rm -f arducopter-sitl`, then run it again).
- To fly a mission: take off first with the Dashboard Takeoff button, then start AUTO from the Mission tab. ArduCopter will not auto-takeoff from the ground without a raised throttle stick, and will disarm itself after a few seconds.

## Project layout

```
src/
  main/       Electron main process
    mavlink/    link.ts (transports, telemetry, parameters, commands), mission.ts (mission protocol)
  preload/    Typed bridge exposed to the UI as window.api
  renderer/   React UI (views, components, store)
  shared/     Types and helpers used by both sides (mission model, .waypoints parser, mode table)
```

## Limitations

- Map tiles (Esri satellite, OpenStreetMap) are fetched online. There is no offline cache yet.
- Mission uploads send plain MAVLink frame numbers (0, 3, 10) inside `MISSION_ITEM_INT`, because the ArduPilot build tested rejected the `_INT` variants. Other firmware versions may behave differently.
- The proximity radar has only been tested with simulated MAVLink messages, since SITL has no proximity sensor configured. Check it against your real sensor and its orientation settings.
- The Setup and Tuning pages have been exercised against SITL only. Calibrations that need physical movement (accelerometer positions, compass rotation, radio sticks) and the motor test were checked for correct commands and progress reporting, not with a real aircraft.
- The live tuning graph needs `NAV_CONTROLLER_OUTPUT` (target roll/pitch) and, for rate targets, `PID_TUNING` (enabled with the Enable PID data button, which sets `GCS_PID_MASK`) or `ATTITUDE_TARGET`.
- Not implemented yet: click-to-fly (guided goto), geofence and rally points, dataflash log download and graphing, and a live-data graphing view.

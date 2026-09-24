# DroneControl

A desktop ground control station for ArduCopter, built with Electron, React and TypeScript. It talks MAVLink directly to the flight controller (via [`node-mavlink`](https://github.com/ArduPilot/node-mavlink) and [`serialport`](https://serialport.io/)) and covers the everyday Mission Planner jobs in a cleaner interface.

> **Safety:** this software has only been tested against the ArduPilot SITL simulator, not real hardware. Try everything with props off first. Arm, takeoff, mode changes and mission writes send real commands to the vehicle.

## Features

- **Connections:** USB/serial (choose baud rate), UDP (listen on a port, optional remote host), and TCP.
- **Dashboard:** artificial horizon, ground speed and altitude tapes, heading ribbon, battery, GPS, position and radio readouts.
- **Flight controls:** mode selector, arm/disarm, takeoff to a chosen altitude, Land and RTL. Arm, disarm and takeoff ask for confirmation.
- **Vehicle messages:** live feed of the vehicle's status text, colour-coded by severity, so pre-arm failures, warnings and failsafes are visible. Includes a "warnings and errors only" filter.
- **Parameters:** load the full list, search, and edit either in a table (Enter to write) or as raw `NAME,VALUE` text. Every write is confirmed by the vehicle echoing the value back. Import and export `.param` files.
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
- Not implemented yet: click-to-fly (guided goto), geofence and rally points, dataflash log download and graphing, and a live-data graphing view.

import { execFile } from 'node:child_process'
import type { StationLocationResult } from '../shared/types'

// The base station's (this computer's) own position, from the operating system's location service. Electron's built-in browser
// geolocation needs a Google API key, so on Windows this asks the OS directly (the same service Maps uses): it comes
// from Wi-Fi and network data unless the computer has a GPS receiver, so it is usually good to a few hundred metres.
const SCRIPT = `
Add-Type -AssemblyName System.Device
$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::Default)
$w.Start()
# The service can take a few seconds to produce its first position, so wait for one instead of reading it straight away.
$deadline = (Get-Date).AddSeconds(15)
while (($w.Status -ne 'Ready' -or $w.Position.Location.IsUnknown) -and $w.Permission -ne 'Denied' -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
$l = $w.Position.Location
if ($w.Permission -eq 'Denied') { 'DENIED' }
elseif ($l.IsUnknown) { 'UNKNOWN' }
else { 'OK ' + $l.Latitude + ' ' + $l.Longitude + ' ' + $l.HorizontalAccuracy }
$w.Stop()
`
// -EncodedCommand takes base64 UTF-16, which avoids any quoting problems with the script text.
const ENCODED_SCRIPT = Buffer.from(SCRIPT, 'utf16le').toString('base64')

export function getStationLocation(): Promise<StationLocationResult> {
  if (process.platform !== 'win32') {
    return Promise.resolve({ ok: false, error: "Finding the base station location is only supported on Windows so far" })
  }
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', ENCODED_SCRIPT],
      { timeout: 30_000, windowsHide: true },
      (err, stdout) => {
        const out = String(stdout).trim()
        if (out === 'DENIED') {
          resolve({ ok: false, error: 'Windows location access is turned off (Settings > Privacy & security > Location)' })
        } else if (out.startsWith('OK ')) {
          // Decimal commas are tolerated in case the system culture leaks into the number formatting.
          const [lat, lon, accuracy] = out.slice(3).split(/\s+/).map((v) => Number(v.replace(',', '.')))
          if ([lat, lon, accuracy].some(Number.isNaN)) resolve({ ok: false, error: 'Windows returned a location that could not be read' })
          else resolve({ ok: true, lat, lon, accuracy })
        } else if (err) {
          resolve({ ok: false, error: 'Could not ask Windows for the location' })
        } else {
          resolve({ ok: false, error: 'Windows could not work out where the base station is' })
        }
      }
    )
  })
}

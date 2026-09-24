@echo off
title DroneControl
rem Starts DroneControl. Put a shortcut to this file on the desktop (right-click it > Send to > Desktop).
rem Closing this window quits the app.

cd /d "D:\Documents\AICode\MissionPlanner2"
if errorlevel 1 (
  echo Project folder not found: D:\Documents\AICode\MissionPlanner2
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing dependencies, this takes a minute...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting DroneControl...
call npm run dev

echo.
echo DroneControl has stopped.
pause

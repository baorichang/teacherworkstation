@echo off
cd /d "%~dp0"
set "ELECTRON=%~dp0node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON%" (
  echo [Error] Electron runtime not found. Please run "npm install" in this folder first.
  pause
  exit /b 1
)

start "" "%ELECTRON%" .
exit /b 0

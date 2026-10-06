@echo off
setlocal
set "ELECTRON=%~dp0node_modules\electron\dist\electron.exe"
if not exist "%ELECTRON%" if exist "%~dp0node_modules\electron\install.js" node "%~dp0node_modules\electron\install.js"
if not exist "%ELECTRON%" (
  echo Electron is missing: %ELECTRON%
  echo Run npm install in this folder first.
  pause
  exit /b 1
)
start "" /D "%~dp0" "%ELECTRON%" "%~dp0"

@echo off
setlocal
rem Abandoned but not Forgotten: start the local server and open the browser.
rem   iniciar.cmd            this computer only
rem   iniciar.cmd --lan      also phones and tablets on the same Wi-Fi (offline museum)
rem   iniciar.cmd 8643       another port
set "NASA_NODE="
where node >nul 2>nul
if not errorlevel 1 set "NASA_NODE=node"
if not defined NASA_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NASA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if defined NASA_NODE (
  "%NASA_NODE%" "%~dp0tools\serve.cjs" %* --open
  exit /b %errorlevel%
)
rem No Node.js: use the PowerShell server included with Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" %*
exit /b %errorlevel%

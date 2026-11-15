@echo off
setlocal
set "NASA_NODE="
where node >nul 2>nul
if not errorlevel 1 set "NASA_NODE=node"
if not defined NASA_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NASA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NASA_NODE (
  echo No se encontro Node.js. Instala Node.js para ejecutar este servidor.
  exit /b 1
)
"%NASA_NODE%" "%~dp0tools\serve.cjs" %*
exit /b %errorlevel%

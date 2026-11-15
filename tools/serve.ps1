# Local static server for Windows computers without Node.js (PowerShell 5+ is built into Windows).
#   powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [port] [--lan]
# --lan lets phones on the same Wi-Fi connect. Windows only allows that from an administrator
# window; if it is refused, the server falls back to this computer only.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$port = 8642
$lan = $false
foreach ($a in $args) {
  if ($a -eq '--lan') { $lan = $true }
  elseif ($a -match '^\d+$') { $port = [int]$a }
}
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.png' = 'image/png'; '.webp' = 'image/webp'; '.glb' = 'model/gltf-binary'; '.gltf' = 'model/gltf+json'
  '.svg' = 'image/svg+xml'; '.woff2' = 'font/woff2'; '.wasm' = 'application/wasm'; '.md' = 'text/plain; charset=utf-8'
  '.txt' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
if ($lan) { $listener.Prefixes.Add("http://+:$port/") } else { $listener.Prefixes.Add("http://localhost:$port/"); $listener.Prefixes.Add("http://127.0.0.1:$port/") }
try { $listener.Start() }
catch {
  if (-not $lan) { Write-Host "No se pudo iniciar el servidor en el puerto $port. Prueba: iniciar.cmd 8643"; exit 1 }
  Write-Host "El modo LAN necesita abrir iniciar.cmd como administrador (clic derecho > Ejecutar como administrador)."
  Write-Host "Iniciando solo para este equipo..."
  $lan = $false
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$port/"); $listener.Prefixes.Add("http://127.0.0.1:$port/")
  $listener.Start()
}

$local = "http://127.0.0.1:$port/"
Write-Host ""
Write-Host "Abandoned but not Forgotten"
Write-Host "Abre $local"
if ($lan) {
  Write-Host ""
  Write-Host "Modo LAN (museo): los telefonos de la misma red Wi-Fi pueden abrir:"
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object {
    Write-Host ("  http://{0}:{1}/            tarjetas QR: http://{0}:{1}/museo.html" -f $_.IPAddress, $port)
  }
}
Write-Host "Cierra esta ventana para detener el servidor."
Write-Host ""
Start-Process $local

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  try {
    if ($req.HttpMethod -ne 'GET' -and $req.HttpMethod -ne 'HEAD') { $res.StatusCode = 405; continue }
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($rel -eq '/') { $rel = '/index.html' }
    $parts = $rel.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)
    if ($parts | Where-Object { $_.StartsWith('.') }) { $res.StatusCode = 403; continue }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root ($parts -join '\')))
    if (-not $file.StartsWith($root + '\')) { $res.StatusCode = 403; continue }
    if (-not [System.IO.File]::Exists($file)) { $res.StatusCode = 404; continue }
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $res.AddHeader('Cache-Control', 'no-cache')
    $stream = [System.IO.File]::OpenRead($file)
    try {
      $res.ContentLength64 = $stream.Length
      if ($req.HttpMethod -eq 'GET') { $stream.CopyTo($res.OutputStream) }
    } finally { $stream.Dispose() }
  } catch {
    try { $res.StatusCode = 500 } catch { }
  } finally {
    try { $res.Close() } catch { }
  }
}

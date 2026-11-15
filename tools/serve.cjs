// Local static server (no internet needed: every dependency lives in vendor/).
//   node tools/serve.cjs [port] [--lan] [--open]
//   --lan   also serve to phones and tablets on the same Wi-Fi (classroom "offline museum")
//   --open  open the experience in the default browser
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const lan = args.includes('--lan');
const port = Number(args.find((a) => /^\d+$/.test(a)) || 8642);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Usa un puerto entre 1024 y 65535. Ejemplo: iniciar.cmd 8643');
  process.exit(1);
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  let relative;
  try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + path.sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res);
  });
});
server.on('error', err => {
  console.error(err.code === 'EADDRINUSE'
    ? `El puerto ${port} ya esta ocupado. Si la web ya esta abierta, usa http://127.0.0.1:${port}/\nPara iniciar otra instancia: .\\iniciar.cmd ${port === 65535 ? 8643 : port + 1}`
    : `No se pudo iniciar el servidor: ${err.message}`);
  process.exitCode = 1;
});
server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  const local = `http://127.0.0.1:${port}/`;
  console.log(`\nAbandoned but not Forgotten\nAbre ${local}`);
  if (lan) {
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log('\nModo LAN (museo): los telefonos de la misma red Wi-Fi pueden abrir:');
    for (const ip of ips) console.log(`  http://${ip}:${port}/            tarjetas QR: http://${ip}:${port}/museo.html`);
    if (!ips.length) console.log('  (no se encontro una red; conecta este equipo a un Wi-Fi o crea un punto de acceso)');
  }
  console.log('Presiona Ctrl+C para detener el servidor.\n');
  if (args.includes('--open')) {
    const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', local]] : process.platform === 'darwin' ? ['open', [local]] : ['xdg-open', [local]];
    try { spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* no browser: the address is printed above */ }
  }
});

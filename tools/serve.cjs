// Local static server.
//   node tools/serve.cjs [port] [--lan] [--offline]
//   --lan      also serve to other devices on the same Wi-Fi (classroom "offline museum")
//   --offline  serve three.js, the QR library and the fonts from vendor/ instead of the internet
//              (prepare once with: node tools/offline-pack.mjs). --lan turns it on when vendor/ exists.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const lan = args.includes('--lan');
const portArg = args.find((a) => /^\d+$/.test(a));
const port = Number(portArg || 8642);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Usa un puerto entre 1024 y 65535. Ejemplo: iniciar.cmd 8643');
  process.exit(1);
}
const hasVendor = fs.existsSync(path.join(root, 'vendor', 'npm'));
const offline = hasVendor && (args.includes('--offline') || lan);
if (args.includes('--offline') && !hasVendor) console.warn('Aviso: no existe vendor/. Ejecuta primero: node tools/offline-pack.mjs (con internet).');

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8' };
const typeOf = (file) => (file.endsWith('+esm') ? mime['.js'] : mime[path.extname(file).toLowerCase()] || 'application/octet-stream');

// In offline mode, point CDN URLs at the local copies in vendor/.
function localize(text) {
  return text
    .replaceAll('https://cdn.jsdelivr.net/npm/', '/vendor/npm/')
    .replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"')\s]*/g, '/vendor/fonts/fonts.css');
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  let relative;
  try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + path.sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    const type = typeOf(file);
    if (offline && /^text\/(html|javascript|css)/.test(type)) {
      fs.readFile(file, 'utf8', (e, text) => {
        if (e) { res.writeHead(500).end(); return; }
        const body = Buffer.from(localize(text));
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : body);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
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
  console.log(`\nAbandoned but not Forgotten\nAbre http://127.0.0.1:${port}/`);
  if (lan) {
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log('\nModo LAN (museo): los telefonos de la misma red Wi-Fi pueden abrir:');
    for (const ip of ips) console.log(`  http://${ip}:${port}/            tarjetas QR: http://${ip}:${port}/museo.html`);
    if (!ips.length) console.log('  (no se encontro una red; conecta este equipo a un Wi-Fi o crea un punto de acceso)');
  }
  console.log(offline ? '\nRecursos externos: copia local en vendor/ (sin internet).' : (lan ? '\nRecursos externos: desde internet (sin vendor/; ver tools/offline-pack.mjs).' : ''));
  console.log('Presiona Ctrl+C para detener el servidor.\n');
});

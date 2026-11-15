// Refreshes vendor/: the local copies of three.js, the QR library and the web fonts that the site
// loads instead of a CDN (so it works the same online, offline, as a PWA and from the offline kit).
// Only needed when upgrading a dependency. Run with internet:  node tools/offline-pack.mjs
// It only saves files; nothing downloaded is executed here.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';
import net from 'node:net';

// Prefer IPv4 and give slow networks time (some classroom/home routers have broken IPv6).
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout?.(2000);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'vendor');
const CDN = 'https://cdn.jsdelivr.net/npm/';
const THREE = 'three@0.170.0/';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function get(url, binary = false) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}
async function save(rel, data) {
  const file = join(out, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log('  ' + rel);
}

// 1. three.js core + every addon the site imports, following their relative imports
const addons = new Set();
for (const f of await readdir(join(root, 'src'))) {
  if (!f.endsWith('.js')) continue;
  for (const m of (await readFile(join(root, 'src', f), 'utf8')).matchAll(/from 'three\/addons\/([^']+)'/g)) addons.add('examples/jsm/' + m[1]);
}
const queue = ['build/three.module.js', ...addons], seen = new Set();
console.log('three.js');
while (queue.length) {
  const rel = queue.shift(); if (seen.has(rel)) continue; seen.add(rel);
  const text = await get(CDN + THREE + rel);
  await save('npm/' + THREE + rel, text);
  for (const m of text.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(posix.normalize(posix.join(posix.dirname(rel), m[1])));
}
// Draco decoder (used by GLTFLoader for compressed models)
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  const rel = 'examples/jsm/libs/draco/gltf/' + f;
  await save('npm/' + THREE + rel, await get(CDN + THREE + rel, f.endsWith('.wasm')));
}

// 2. QR library (ES module build from jsDelivr); absolute /npm/ imports point at vendor/ too
console.log('qrcode-generator');
const qr = (await get(CDN + 'qrcode-generator@1.4.4/+esm')).replace(/\/\/# sourceMappingURL=.*$/m, '');
await save('npm/qrcode-generator@1.4.4/qrcode.esm.js', qr);   // .js so every host serves it as JavaScript

// 3. Web fonts (Inter, Public Sans, DM Mono — SIL Open Font License) with a local stylesheet
console.log('fonts');
const cssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Public+Sans:wght@300;400;600&family=DM+Mono:wght@400;500&display=swap';
// keep only the Latin subsets (English and Spanish text)
let css = (await get(cssUrl)).split(/(?=\/\* [a-z-]+ \*\/)/).filter((b) => /^\/\* latin(-ext)? \*\//.test(b)).join('');
let i = 0;
for (const m of [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)]) {
  const name = `font-${i++}.woff2`;
  await save('fonts/' + name, await get(m[1], true));
  css = css.replace(m[1], name);
}
await save('fonts/fonts.css', '/* Inter, Public Sans, DM Mono: SIL Open Font License 1.1 (Google Fonts). Latin subsets only. */\n' + css);

console.log(`\nListo: ${seen.size + 3} archivos de three.js, la libreria QR y las fuentes en vendor/.`);
console.log('Si cambiaron archivos, regenera la lista offline: node tools/offline-list.mjs');

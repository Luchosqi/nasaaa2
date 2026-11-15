// Headless screenshot + console log of the app (software WebGL), for quick visual checks without a headset.
// usage: node tools/shot.mjs "<url>" out.png [waitSeconds=20] [width=1280] [height=720]
// env: EVAL="js expression" runs in the page after the wait, WAIT2=seconds before the screenshot.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, wait = '20', W = '1280', H = '720'] = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), 'abnf-chrome-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${W},${H}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => { try { chrome.kill(); } catch {} setTimeout(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(code); }, 300); };

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find((x) => x.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
  if (!ws) await sleep(200);
}
if (!ws) { console.error('could not start chrome'); done(1); }
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(+wait * 1000);
if (process.env.EVAL) {
  const r = await send('Runtime.evaluate', { expression: process.env.EVAL, awaitPromise: true, returnByValue: true });
  logs.push('EVAL: ' + JSON.stringify(r.result?.result?.value ?? r.result));
  await sleep(+(process.env.WAIT2 || 2) * 1000);
}
const s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(s.result.data, 'base64'));
console.log(logs.join('\n'));
ws.close(); done(0);

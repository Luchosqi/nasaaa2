// "Read more": official NASA pages for extended reading, plus a QR code to continue on a phone.
// On screen it opens a dialog with links; inside a headset it shows a world-space panel with the QR.
import * as THREE from 'three';
import qrcode from 'qrcode-generator';
import { Panel, button, glass, drawText, FONT, MONO, BODY, THEME } from './ui.js';

const alsj = 'https://www.nasa.gov/history/alsj/';
const nssdc = (id) => `https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${id}`;
// Every link was checked to resolve (HTTP 200) on 2026-11-15.
export const READ_MORE = {
  eagle: [
    ['Apollo 11 mission', 'NASA', 'https://www.nasa.gov/mission/apollo-11/'],
    ['Apollo 11 Lunar Surface Journal', 'NASA History', alsj + 'a11/a11.html'],
    ['Apollo 11 Lunar Module Eagle', 'NASA Space Science Data Coordinated Archive', nssdc('1969-059C')],
  ],
  apollo15: [
    ['Apollo 15 mission', 'NASA', 'https://www.nasa.gov/mission/apollo-15/'],
    ['Apollo 15 Lunar Surface Journal', 'NASA History', alsj + 'a15/a15.html'],
    ['History of lunar exploration', 'NASA Science', 'https://science.nasa.gov/solar-system/moon/history-of-lunar-exploration/'],
  ],
  sojourner: [
    ['Mars Pathfinder and Sojourner', 'NASA Science', 'https://science.nasa.gov/mission/mars-pathfinder/'],
    ['Mars Pathfinder spacecraft details', 'NASA Space Science Data Coordinated Archive', nssdc('1996-068A')],
  ],
  spirit: [
    ['Spirit rover mission', 'NASA Science', 'https://science.nasa.gov/mission/mer-spirit/'],
    ['Silica-rich soil found by Spirit', 'NASA Photojournal', 'https://science.nasa.gov/photojournal/silica-rich-soil-found-by-spirit/'],
    ['Mars Exploration Rovers', 'NASA Science', 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/'],
  ],
  opportunity: [
    ['Opportunity rover mission', 'NASA Science', 'https://science.nasa.gov/mission/mer-opportunity/'],
    ['Mars Exploration Rovers', 'NASA Science', 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/'],
  ],
  ingenuity: [
    ['Ingenuity Mars Helicopter', 'NASA Science', 'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/'],
    ['Mars 2020 Perseverance', 'NASA Science', 'https://science.nasa.gov/mission/mars-2020-perseverance/'],
  ],
  voyager: [
    ['Voyager 1', 'NASA Science', 'https://science.nasa.gov/mission/voyager/voyager-1/'],
    ['Where are Voyager 1 and 2 now?', 'NASA Science', 'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/'],
  ],
  near: [
    ['NEAR Shoemaker mission', 'NASA Science', 'https://science.nasa.gov/mission/near-shoemaker/'],
    ['Asteroid 433 Eros', 'NASA Science', 'https://science.nasa.gov/solar-system/asteroids/433-eros/'],
  ],
  insight: [
    ['InSight Mars lander', 'NASA Science', 'https://science.nasa.gov/mission/insight/'],
    ['InSight science: inside Mars', 'NASA Science', 'https://science.nasa.gov/mission/insight/science/'],
  ],
};

/** Draw a QR code for `text` into ctx at (x, y) with side `size` (dark modules on a white quiet zone). */
export function drawQR(ctx, text, x, y, size) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
  }
}

let styled = false;
function addStyle() {
  if (styled) return; styled = true;
  const style = document.createElement('style');
  style.textContent = `
    #readmore-open{position:fixed;left:20px;bottom:38px;z-index:8;padding:10px 14px;min-height:44px;border:1px solid #758aaf;border-radius:6px;background:#122449;color:#fff;font:500 12px 'DM Mono',monospace;letter-spacing:.06em;cursor:pointer;box-shadow:0 8px 28px #0008}
    #readmore-open:hover{background:#0B3D91}#readmore-open:focus-visible,#readmore :focus-visible{outline:2px solid #fff;outline-offset:3px}
    body.in-vr #readmore-open,#readmore-open[hidden]{display:none}
    #readmore{margin:auto;width:min(560px,calc(100vw - 32px));padding:22px;border:1px solid #7487a866;border-top:3px solid var(--rm-color);border-radius:12px;background:rgba(4,10,26,.98);color:#fff;font-family:'Public Sans',sans-serif}
    #readmore::backdrop{background:#000a}
    #readmore h2{font:700 21px/1.2 'Inter',sans-serif;margin:6px 0 14px}#readmore .rm-eyebrow{font:11px 'DM Mono',monospace;letter-spacing:.1em;color:var(--rm-color)}
    #readmore .rm-body{display:flex;gap:20px;align-items:flex-start}#readmore ul{list-style:none;flex:1;display:grid;gap:10px}
    #readmore a{display:block;padding:10px 12px;border:1px solid #758aaf;border-radius:6px;color:#fff;text-decoration:none;background:#122449}#readmore a:hover{background:#0B3D91}
    #readmore a small{display:block;margin-top:3px;color:#b2bdcf;font:11px 'DM Mono',monospace}
    #readmore figure{width:150px;text-align:center;font:10px/1.4 'DM Mono',monospace;color:#b2bdcf}#readmore canvas{width:150px;height:150px;display:block;margin-bottom:6px;border-radius:4px}
    #readmore .rm-close{position:absolute;right:12px;top:10px;background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:6px 10px}
    @media(max-width:560px){#readmore .rm-body{flex-direction:column-reverse;align-items:center}#readmore ul{width:100%}#readmore-open{left:12px;bottom:46px}}
  `;
  document.head.appendChild(style);
}

/**
 * @returns {{ button3d: Panel, interactive: Panel[], open(xr: boolean): void, dispose(): void } | null}
 */
export function createReadMore(mission, isXR = () => false) {
  const links = READ_MORE[mission.id];
  if (!links) return null;
  addStyle();

  // screen: corner button + modal dialog
  const openBtn = document.createElement('button'); openBtn.id = 'readmore-open'; openBtn.type = 'button';
  openBtn.textContent = 'Read more on NASA.gov ↗';
  const dlg = document.createElement('dialog'); dlg.id = 'readmore'; dlg.style.setProperty('--rm-color', mission.color);
  dlg.setAttribute('aria-labelledby', 'readmore-title');
  dlg.innerHTML = `<button class="rm-close" aria-label="Close">×</button><div class="rm-eyebrow">${mission.short} · EXTENDED READING</div><h2 id="readmore-title">Official NASA sources</h2><div class="rm-body"><ul></ul><figure><canvas width="300" height="300" aria-hidden="true"></canvas><figcaption>Scan to keep reading on a phone</figcaption></figure></div>`;
  const ul = dlg.querySelector('ul');
  for (const [label, source, url] of links) {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.append(label + ' ↗'); const small = document.createElement('small'); small.textContent = source; a.append(small);
    li.append(a); ul.append(li);
  }
  drawQR(dlg.querySelector('canvas').getContext('2d'), links[0][2], 0, 0, 300);
  dlg.querySelector('.rm-close').onclick = () => dlg.close();
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  openBtn.onclick = () => dlg.showModal();
  document.body.append(openBtn, dlg);

  // headset: a world-space card with the QR (links cannot open inside an immersive session)
  const vrCard = new Panel(0.95, 0.62, (ctx, w, h) => {
    glass(ctx, w, h, mission.color, 30);
    const L = 50, q = h - 120;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = mission.color; ctx.font = `500 ${h * 0.045}px ${MONO}`; ctx.fillText(`${mission.short} · EXTENDED READING`, L, 50);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${h * 0.075}px ${FONT}`; ctx.fillText('Official NASA sources', L, 96);
    let y = 190; const W = w - q - L * 3;
    for (const [label, source] of links) {
      ctx.fillStyle = '#fff'; ctx.font = `600 ${h * 0.042}px ${BODY}`; y = drawText(ctx, label, L, y, W, h * 0.05);
      ctx.fillStyle = THEME.dim; ctx.font = `400 ${h * 0.03}px ${MONO}`; y = drawText(ctx, source, L, y + 4, W, h * 0.04) + 22;
    }
    drawQR(ctx, links[0][2], w - q - L, 60, q);
    ctx.fillStyle = THEME.text; ctx.font = `400 ${h * 0.03}px ${MONO}`; ctx.textAlign = 'center';
    ctx.fillText('Scan with a phone', w - q / 2 - L, 72 + q);
  });
  vrCard.visible = false;
  const button3d = button('READ MORE · NASA', 0.5, 0.09, THEME.red, () => api.open(isXR()));
  button3d.add(vrCard); vrCard.position.set(0, 0.76, 0.01);   // over the mission card the button belongs to

  const api = {
    button3d, interactive: [button3d],
    open(xr) {
      if (xr) { vrCard.visible = !vrCard.visible; button3d.set({ label: vrCard.visible ? 'CLOSE READING' : 'READ MORE · NASA' }); }
      else if (!dlg.open) dlg.showModal();
    },
    dispose() { if (dlg.open) dlg.close(); dlg.remove(); openBtn.remove(); vrCard.dispose(); button3d.removeFromParent(); button3d.dispose(); },
  };
  return api;
}

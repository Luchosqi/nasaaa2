// World-space UI: canvas-textured panels that work the same on a flat screen and inside any VR headset.
import * as THREE from 'three';

const PX_PER_M = 900;           // canvas resolution per metre of panel
// NASA Horizon Design System typefaces: Inter (headings), Public Sans (body), DM Mono (numbers, labels)
export const FONT = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const BODY = "'Public Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const MONO = "'DM Mono', ui-monospace, monospace";
export const THEME = {
  blue: '#0B3D91',      // NASA blue
  red: '#FC3D21',       // NASA red
  ink: '#FFFFFF', text: '#D6DCE8', dim: '#9AA5BB', faint: '#6B778F',
};

export function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// Word-wrap text, returns lines.
export function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawText(ctx, text, x, y, maxW, lh) {
  const lines = wrap(ctx, text, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

export function glass(ctx, w, h, accent, r = 28, alpha = 0.88) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `rgba(11,30,72,${alpha})`);       // NASA blue, deepened for legibility in space
  g.addColorStop(1, `rgba(4,8,20,${alpha * 0.92})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, r); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();
  if (accent) {
    ctx.fillStyle = accent;
    ctx.fillRect(r, 3, Math.min(160, w * 0.3), 6);
  }
}

// Dark rounded backing so white text stays readable over white hardware, the Sun or bright terrain.
export function plate(ctx, x, y, w, h, r = 24, alpha = 0.78) {
  ctx.save(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = `rgba(2,6,18,${alpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.restore();
}

// Soft dark halo around glyphs drawn after this call (second line of defence behind the plate).
export function textShadow(ctx, blur = 10) {
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
}

/**
 * A flat panel in the 3D world. `draw(ctx, w, h, state)` paints it.
 * Interactive panels get `onSelect` and a hover state that triggers a redraw.
 */
export class Panel extends THREE.Mesh {
  constructor(wM, hM, draw, opts = {}) {
    const cw = Math.round(wM * PX_PER_M), ch = Math.round(hM * PX_PER_M);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, toneMapped: false, depthWrite: false,
      side: THREE.DoubleSide, opacity: opts.opacity ?? 1,
    });
    super(new THREE.PlaneGeometry(wM, hM), mat);
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tex = tex;
    this.drawFn = draw; this.state = { hover: false, ...(opts.state || {}) };
    this.onSelect = opts.onSelect || null;
    this.interactive = !!opts.onSelect;
    this.renderOrder = opts.renderOrder ?? 10;
    this.redraw();
  }
  redraw() { this.drawFn(this.ctx, this.canvas.width, this.canvas.height, this.state); this.tex.needsUpdate = true; }
  setHover(h) { if (this.state.hover !== h) { this.state.hover = h; this.redraw(); } }
  set(patch) { Object.assign(this.state, patch); this.redraw(); }
  dispose() { this.geometry.dispose(); this.material.dispose(); this.tex.dispose(); }
}

/** A pill-shaped button. */
export function button(label, wM, hM, accent, onSelect) {
  return new Panel(wM, hM, (ctx, w, h, s) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = s.hover ? THEME.red : 'rgba(4,10,26,0.8)';
    ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, h / 2); ctx.fill();
    ctx.lineWidth = s.hover ? 6 : 3;
    ctx.strokeStyle = s.hover ? THEME.red : 'rgba(255,255,255,0.4)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 ${Math.round(h * 0.34)}px ${MONO}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.label ?? label, w / 2, h / 2 + 2);
  }, { onSelect, state: { label }, renderOrder: 12 });
}

/** Soft radial sprite texture (sun glow, stars, markers). */
export function glowTexture(stops = [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,240,220,0.6)'], [1, 'rgba(255,200,150,0)']], size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

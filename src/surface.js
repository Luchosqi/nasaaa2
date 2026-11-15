// Surface scenes (metres, 1:1 scale): the Moon at Tranquility Base, three Mars sites, and deep space for Voyager 1.
// You stand next to each piece of hardware at its real size.
import * as THREE from 'three';
import { createSurfaceMotion } from './surface-motion.js';
import { createExtraMotion } from './extra-motion.js';
import { raDecToVec, sunRaDec, sunFromMarsRaDec, azElToVec, alignFrames, POLES } from './astro.js';
import { earthMaterial, atmosphereShell } from './space.js';
import { Panel, glowTexture, FONT, MONO, BODY, hexA } from './ui.js';

// ---------------------------------------------------------------- noise
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, s = 0, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = (v) => (period ? ((v % period) + period) % period : v);
  const a = hash2(P(xi), P(yi), s), b = hash2(P(xi + 1), P(yi), s), c = hash2(P(xi), P(yi + 1), s), d = hash2(P(xi + 1), P(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct, s = 0, period = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17, period ? period * f : 0); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 | 0) >>> 0) / 4294967296; }

// Seamless detail textures (albedo variation + normal map) for the regolith, generated once.
function detailTextures(kind) {
  const S = 512, P = 16;
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = fbm(x / S * P, y / S * P, 6, kind === 'moon' ? 3 : 9, P);
    if (kind === 'mars') v = v * 0.7 + 0.3 * Math.pow(fbm(x / S * P * 2, y / S * P * 2, 3, 21, P * 2), 3);
    h[y * S + x] = v;
  }
  const alb = document.createElement('canvas'), nrm = document.createElement('canvas');
  alb.width = alb.height = nrm.width = nrm.height = S;
  const a = alb.getContext('2d'), n = nrm.getContext('2d');
  const ai = a.createImageData(S, S), ni = n.createImageData(S, S);
  const k = kind === 'moon' ? 7 : 5;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, v = h[i];
    const dx = (h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)]) * k;
    const dy = (h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]) * k;
    const l = Math.hypot(dx, dy, 1);
    ni.data[i * 4] = (-dx / l * 0.5 + 0.5) * 255; ni.data[i * 4 + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[i * 4 + 3] = 255;
    const g = 0.78 + 0.32 * v + (hash2(x, y, 5) - 0.5) * 0.12;
    ai.data[i * 4] = ai.data[i * 4 + 1] = ai.data[i * 4 + 2] = Math.min(255, g * 225); ai.data[i * 4 + 3] = 255;
  }
  a.putImageData(ai, 0, 0); n.putImageData(ni, 0, 0);
  const ta = new THREE.CanvasTexture(alb), tn = new THREE.CanvasTexture(nrm);
  ta.colorSpace = THREE.SRGBColorSpace;
  for (const t of [ta, tn]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  return { albedo: ta, normal: tn };
}

// ---------------------------------------------------------------- terrain
function makeHeightFn(kind, seed, opts) {
  const r = rng(seed);
  const craters = [];
  const nCr = kind === 'moon' ? 260 : 40;
  for (let i = 0; i < nCr; i++) {
    const rad = kind === 'moon' ? 0.6 + Math.pow(r(), 3.2) * 45 : 1.5 + Math.pow(r(), 3) * 25;
    const ang = r() * Math.PI * 2, dist = 6 + Math.pow(r(), 0.8) * 420;
    if (dist - rad * 1.8 < 18) continue;               // keep the landing area itself out of crater bowls
    craters.push([Math.cos(ang) * dist, Math.sin(ang) * dist, rad, kind === 'moon' ? 0.16 + r() * 0.08 : 0.07 + r() * 0.05]);
  }
  const clear = opts.clear || [];
  const slope = opts.slope || 0;
  const raw = (x, z) => {
    let y;
    if (kind === 'moon') {
      y = (fbm(x / 160, z / 160, 4, seed) - 0.5) * 2.6 + (fbm(x / 18, z / 18, 4, seed + 1) - 0.5) * 0.9 + (fbm(x / 3, z / 3, 3, seed + 2) - 0.5) * 0.14;
    } else {
      y = (fbm(x / 260, z / 260, 4, seed) - 0.5) * 9 + (fbm(x / 30, z / 30, 4, seed + 1) - 0.5) * 1.0;
      if (opts.ripples) {
        const w = Math.sin((x * 0.92 + z * 0.38) * 1.6 + fbm(x / 9, z / 9, 2, seed + 4) * 7);
        y += (w * 0.5 + 0.5) * 0.09 * fbm(x / 30, z / 30, 2, seed + 5);
      }
      y += slope * z;
    }
    for (const [cx, cz, R, d] of craters) {
      const dx = x - cx, dz = z - cz, q = (dx * dx + dz * dz) / (R * R);
      if (q > 5) continue;
      const rr = Math.sqrt(q);
      if (rr < 1) y += -d * R * (1 - q) + 0.06 * R;
      y += 0.06 * R * Math.exp(-Math.pow((rr - 1) / 0.28, 2));
    }
    return y;
  };
  const base = clear.map(([cx, cz]) => raw(cx, cz));
  return (x, z) => {
    let y = raw(x, z);
    // keep the hardware area gently flat (blend toward the local ground level, keeping any slope)
    clear.forEach(([cx, cz, R], i) => {
      const d = Math.hypot(x - cx, z - cz);
      if (d < R * 2) { const t = Math.min(1, Math.max(0, (d - R) / R)); const s = t * t * (3 - 2 * t); y = y * s + (base[i] + slope * (z - cz)) * (1 - s); }
    });
    return y;
  };
}

function buildTerrain(heightAt, bodyRadius, matOpts, tile) {
  const rings = 190, segs = 288, Rmax = 3200, b = 0.032;
  const a = Rmax / (Math.exp(b * rings) - 1);
  const pos = [], uv = [], col = [], idx = [];
  pos.push(0, heightAt(0, 0), 0); uv.push(0, 0); col.push(1, 1, 1);
  for (let i = 1; i <= rings; i++) {
    const r = a * (Math.exp(b * i) - 1);
    for (let j = 0; j < segs; j++) {
      const t = j / segs * Math.PI * 2 + (i % 2) * Math.PI / segs;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      const y = heightAt(x, z) - (r * r) / (2 * bodyRadius);
      pos.push(x, y, z); uv.push(x / tile, z / tile);
      const m = 0.82 + 0.36 * fbm(x / 60, z / 60, 3, 77) + (fbm(x / 7, z / 7, 2, 78) - 0.5) * 0.12;
      col.push(m, m, m);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) {
    const r0 = 1 + (i - 1) * segs, r1 = 1 + i * segs;
    for (let j = 0; j < segs; j++) {
      const j1 = (j + 1) % segs;
      idx.push(r0 + j, r0 + j1, r1 + j, r0 + j1, r1 + j1, r1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, ...matOpts }));
  m.receiveShadow = true;
  return m;
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 0.72 + 0.5 * fbm(v.x * 1.7 + seed, v.y * 1.7, 3, seed) + 0.12 * fbm(v.z * 5, v.x * 5, 2, seed + 3);
    v.multiplyScalar(n); v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function scatterRocks(heightAt, kind, count, seed, color, avoid) {
  const r = rng(seed);
  const geo = rockGeometry(seed % 97);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const ang = r() * Math.PI * 2, dist = 2.5 + Math.pow(r(), 1.6) * 160;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    const size = ((kind === 'moon' ? 0.04 : 0.05) + Math.pow(r(), 6) * (kind === 'moon' ? 0.6 : 0.7)) * Math.min(1, 0.35 + dist / 25);
    p.set(x, heightAt(x, z) - size * 0.25, z);
    e.set(r() * 0.5, r() * Math.PI * 2, r() * 0.5); q.setFromEuler(e);
    s.set(size * (0.8 + r() * 0.6), size * (0.7 + r() * 0.6), size * (0.8 + r() * 0.6));
    m4.compose(p, q, s); mesh.setMatrixAt(n, m4);
    const k = 0.75 + r() * 0.4; c.set(color).multiplyScalar(k); mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- sky pieces
function marsSkyDome(sunDir) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vDir;
      void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition);
        gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uSun; varying vec3 vDir;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 v = normalize(vDir), s = normalize(uSun);
        float h = max(v.y, 0.0), mu = max(dot(v, s), 0.0);
        float day = clamp(s.y * 5.0 + 0.35, 0.0, 1.0);
        float horizon = exp(-h * 6.0);
        vec3 dustSky = vec3(0.62, 0.40, 0.25) * (0.05 + 0.75 * horizon) * day;
        // Mars sunsets are blue: fine dust scatters blue light forward, around the Sun
        vec3 glow = vec3(0.36, 0.58, 0.98) * pow(mu, 10.0) * 1.3 + vec3(0.75, 0.85, 1.0) * pow(mu, 120.0) * 2.0;
        glow *= day * (0.5 + 0.5 * horizon);
        gl_FragColor = vec4(dustSky + glow, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(20000, 64, 32), mat);
  m.renderOrder = -5;
  return m;
}

function sunSprite(sizeDeg, dist = 15000, warm = false) {
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,253,245,1)'], [0.3, warm ? 'rgba(220,235,255,0.35)' : 'rgba(255,235,200,0.35)'], [1, 'rgba(255,200,150,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  }));
  const s = 2 * dist * Math.tan(sizeDeg * Math.PI / 360) * 3.3;
  core.scale.setScalar(s);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,240,220,0.4)'], [0.2, 'rgba(255,220,180,0.08)'], [1, 'rgba(255,180,120,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  }));
  halo.scale.setScalar(s * 9);
  const g = new THREE.Group(); g.add(halo, core); g.userData.dist = dist;
  return g;
}

export function label(title, sub, color = '#7fb2ff', w = 0.9) {
  const p = new Panel(w, w * 0.26, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,10,26,0.62)';
    ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, 22); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(4, 18, 8, H - 36);
    ctx.fillStyle = '#ffffff'; ctx.font = `700 ${H * 0.3}px ${FONT}`; ctx.textBaseline = 'top';
    ctx.fillText(title, 34, H * 0.16);
    if (sub) { ctx.fillStyle = '#9AA5BB'; ctx.font = `400 ${H * 0.19}px ${MONO}`; ctx.fillText(sub, 34, H * 0.58); }
  });
  p.userData.billboard = true;
  return p;
}

// ---------------------------------------------------------------- procedural hardware
function solarCellTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#0b1530'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = `rgb(${18 + (i * j) % 7},${30 + (i + j) % 9},${70 + ((i * 3 + j) % 11)})`;
    x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildSojourner() {
  // 0.65 m long, 0.48 m wide, 0.30 m tall, six 13 cm wheels on a rocker-bogie
  const g = new THREE.Group();
  g.userData.wheels = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.5, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.7, metalness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89a3c, roughness: 0.35, metalness: 1 });
  const cells = solarCellTexture(); cells.repeat.set(3, 2);
  const panel = new THREE.MeshStandardMaterial({ map: cells, roughness: 0.25, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.48), gold); body.position.y = 0.2; g.add(body);
  const sp = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.012, 0.6), panel); sp.position.y = 0.262; g.add(sp);
  for (const sx of [-1, 1]) {
    for (const z of [-0.24, 0, 0.24]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.075, 20), metal);
      const wheel = new THREE.Group(); wheel.position.set(sx * 0.27, 0.065, z); g.add(wheel); g.userData.wheels.push(wheel);
      w.rotation.z = Math.PI / 2; wheel.add(w);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const tread = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.008, 0.012), dark); tread.position.set(0, Math.cos(a) * 0.065, Math.sin(a) * 0.065); tread.rotation.x = a; wheel.add(tread); }
      const cleat = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.006, 6, 20), dark);
      cleat.rotation.y = Math.PI / 2; wheel.add(cleat);
    }
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.52), metal);
    rocker.position.set(sx * 0.235, 0.14, 0); rocker.rotation.x = 0.08; g.add(rocker);
    for (const z of [-0.12, 0.12]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), metal); leg.position.set(sx * 0.235, 0.1, z * 2); g.add(leg); }
  }
  for (const sx of [-0.06, 0.06]) { const cam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), dark); cam.position.set(sx, 0.2, -0.255); g.add(cam); }
  const apxs = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12), metal); apxs.position.set(0, 0.16, 0.29); apxs.rotation.x = Math.PI / 2; g.add(apxs);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6), dark); ant.position.set(0.15, 0.42, 0.18); g.add(ant);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildPathfinderLander() {
  const g = new THREE.Group();
  const cells = solarCellTexture(); cells.repeat.set(4, 4);
  const panel = new THREE.MeshStandardMaterial({ map: cells, roughness: 0.3, metalness: 0.4, side: THREE.DoubleSide });
  const white = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 });
  const bag = new THREE.MeshStandardMaterial({ color: 0xc9bfa9, roughness: 1 });
  const tri = (s) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s, 0); sh.lineTo(s / 2, s * 0.866); sh.closePath(); return new THREE.ShapeGeometry(sh); };
  const S = 1.0;
  const base = new THREE.Mesh(tri(S), white); base.rotation.x = -Math.PI / 2; base.position.set(-S / 2, 0.32, S * 0.289); g.add(base);
  const centre = new THREE.Vector3(0, 0.32, 0);
  const verts = [new THREE.Vector3(-S / 2, 0.32, S * 0.289), new THREE.Vector3(S / 2, 0.32, S * 0.289), new THREE.Vector3(0, 0.32, -S * 0.577)];
  for (let i = 0; i < 3; i++) {
    const a = verts[i], b = verts[(i + 1) % 3];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const out = mid.clone().sub(centre).setY(0).normalize();
    const tip = mid.clone().add(out.multiplyScalar(S * 0.82)); tip.y = 0.12;
    const geo = new THREE.BufferGeometry().setFromPoints([a, b, tip]);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2)); geo.computeVertexNormals();
    const petal = new THREE.Mesh(geo, panel); g.add(petal);
    for (let k = 0; k < 5; k++) {
      const p = a.clone().lerp(b, 0.15 + k * 0.17).lerp(tip, 0.2 + Math.random() * 0.5);
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16 + Math.random() * 0.1, 10, 8), bag);
      blob.scale.set(1.2, 0.35, 1); blob.position.set(p.x, 0.08, p.z); g.add(blob);
    }
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.36), white); box.position.set(0, 0.46, 0); g.add(box);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 8), white); mast.position.set(0.05, 0.95, 0); g.add(mast);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.6 })); head.position.set(0.05, 1.36, 0); g.add(head);
  const hga = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.04, 0.06, 20), white); hga.position.set(-0.18, 0.75, 0.05); hga.rotation.x = -0.6; g.add(hga);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.9), new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.5, metalness: 0.6 }));
  ramp.position.set(0.55, 0.17, 0.55); ramp.rotation.set(0.32, -Math.PI / 4, 0); g.add(ramp);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildEASEP() {
  // Passive Seismic Experiment Package (with two solar wings) + Laser Ranging RetroReflector
  const gold = new THREE.MeshStandardMaterial({ color: 0xcf9f45, roughness: 0.3, metalness: 1 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.3, metalness: 1 });
  const cells = solarCellTexture(); cells.repeat.set(2, 3);
  const panel = new THREE.MeshStandardMaterial({ map: cells, roughness: 0.25, metalness: 0.4 });
  const psep = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.45), gold); core.position.y = 0.2; psep.add(core);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.9), panel); w.position.set(sx * 0.55, 0.42, 0); w.rotation.z = sx * 0.12; psep.add(w); }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), silver); ant.position.set(0.1, 0.65, 0); psep.add(ant);
  const lrrr = new THREE.Group();
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#9a9ca2'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const g2 = x.createRadialGradient(13 + i * 25.4, 13 + j * 25.4, 1, 13 + i * 25.4, 13 + j * 25.4, 11); g2.addColorStop(0, '#e9eef8'); g2.addColorStop(1, '#2b2f3a'); x.fillStyle = g2; x.beginPath(); x.arc(13 + i * 25.4, 13 + j * 25.4, 10.5, 0, 7); x.fill(); }
  const rt = new THREE.CanvasTexture(c); rt.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.05), [silver, silver, silver, silver, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.15, metalness: 0.9 }), silver]);
  face.position.y = 0.3; face.rotation.x = -0.6; lrrr.add(face);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), silver); leg.position.set(0, 0.12, 0.08); lrrr.add(leg);
  for (const o of [psep, lrrr]) o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { psep, lrrr };
}

function buildFallenFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.9, roughness: 0.3 }));
  pole.rotation.z = Math.PI / 2 - 0.06; pole.position.y = 0.05; g.add(pole);
  const c = document.createElement('canvas'); c.width = 380; c.height = 200; const x = c.getContext('2d');
  for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f1f1f1' : '#b22234'; x.fillRect(0, i * 200 / 13, 380, 200 / 13 + 1); }
  x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, 152, 108);
  x.fillStyle = '#fff'; for (let i = 0; i < 9; i++) for (let j = 0; j < (i % 2 ? 5 : 6); j++) { x.beginPath(); x.arc(13 + j * 25 + (i % 2) * 12, 7 + i * 11.5, 3, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const fg = new THREE.PlaneGeometry(1.25, 0.8, 12, 6);
  const p = fg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.025);
  fg.computeVertexNormals();
  const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.rotation.x = -Math.PI / 2 + 0.05; flag.position.set(0.55, 0.03, 0.42); g.add(flag);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// ---------------------------------------------------------------- scene assembly
const SITES = {
  eagle: { lat: 0.674, date: '1969-07-20T20:17:00Z' },
  apollo15: {lat:26.13,date:'1971-07-30T22:16:29Z'},
  insight: {lat:4.5,date:'2018-11-26T19:52:59Z'},
  sojourner: { lat: 19.13, date: '1997-07-04T16:57:00Z' },
  spirit: { lat: -14.57, date: '2010-03-22T00:00:00Z' },
  opportunity: { lat: -2.28, date: '2018-06-10T00:00:00Z' },
  ingenuity: { lat: 18.4, date: '2024-01-18T00:00:00Z' },
};

function fitModel(obj, targetSize, axis = 'max') {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  const cur = axis === 'max' ? Math.max(size.x, size.y, size.z) : size[axis];
  obj.scale.multiplyScalar(targetSize / cur);
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  const holder = new THREE.Group(); holder.add(obj);   // so callers can move it without losing the offset
  return holder;
}

/**
 * Build the arrival scene for a mission. `models` holds loaded glTF scenes by id.
 * Returns { scene, start: {pos, yaw}, teleport: mesh|null, heightAt, update(dt,t), labels: [] }.
 */
export function createSurface(m, { tex, starTex, models }) {
  const scene = new THREE.Scene();
  scene.background = starTex;
  const out = { scene, labels: [], teleport: null, heightAt: () => 0, start: { pos: new THREE.Vector3(0, 0, 0), yaw: 0 }, updaters: [] };
  const kind = m.surface.kind;
  out.artifacts = [];

  if (kind === 'deep') return buildDeep(m, scene, out, models);
  if (kind === 'asteroid') return buildEros(m, scene, out, models, starTex);

  const site = SITES[m.id];
  const date = new Date(site.date);
  const sunLocal = azElToVec(m.surface.sun.az, m.surface.sun.el);
  const poleLocal = new THREE.Vector3(0, Math.sin(site.lat * Math.PI / 180), -Math.cos(site.lat * Math.PI / 180));
  const sr = kind === 'moon' ? sunRaDec(date) : sunFromMarsRaDec(date);
  const q = alignFrames(raDecToVec(...POLES[kind]), raDecToVec(sr.ra, sr.dec), poleLocal, sunLocal);
  scene.backgroundRotation.setFromQuaternion(q);

  const moon = kind === 'moon';
  const det = detailTextures(kind);
  const clear = [[0, -8, 7], [0, 0, 2.5]];
  const heightAt = makeHeightFn(kind, moon ? 11 : (m.id === 'sojourner' ? 23 : m.id === 'opportunity' ? 31 : 41), { clear, slope: m.surface.slope, ripples: m.id === 'ingenuity' });
  out.heightAt = heightAt;
  const baseCol = moon ? 0x9a9690 : 0xb4704a;
  const ground = buildTerrain(heightAt, moon ? 1.7374e6 : 3.3895e6, { map: det.albedo, normalMap: det.normal, normalScale: new THREE.Vector2(1.1, 1.1), color: baseCol }, moon ? 3.5 : 4.5);
  scene.add(ground);
  out.teleport = ground;

  // Lighting: one Sun, plus light bounced off the ground (and, on Mars, the dusty sky)
  const sun = new THREE.DirectionalLight(moon ? 0xfff6ec : 0xffe0c4, moon ? 4.2 : 3.0);
  sun.position.copy(sunLocal).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(moon ? 0x0a0c12 : 0xa07a60, moon ? 0x6a655e : 0x6a3c28, moon ? 0.35 : 1.4));

  scene.add(scatterRocks(heightAt, kind, moon ? 700 : 1100, 7 + m.id.length, moon ? 0x8a8680 : 0x7a4430, [[0, -9, 6], [0, 0, 1.6]]));

  const sunG = sunSprite(moon ? 0.53 : 0.35, 15000, !moon);
  sunG.position.copy(sunLocal).multiplyScalar(15000); scene.add(sunG);

  if (moon) {
    // Earth, high in the lunar sky, 1.9° wide, lit by the same Sun (so its phase is right)
    const eDir = azElToVec(m.surface.earth.az, m.surface.earth.el);
    const dist = 9000, rad = dist * Math.tan(0.95 * Math.PI / 180);
    const sunUniform = sunLocal.clone();
    const earth = new THREE.Mesh(new THREE.SphereGeometry(rad, 96, 48), earthMaterial(tex, sunUniform));
    earth.position.copy(eDir).multiplyScalar(dist);
    earth.rotation.set(0.41, 2.4, 0);
    const eAtmo = atmosphereShell(rad, 0x4d8dff, sunUniform, 1.3, 1.035);
    eAtmo.position.copy(earth.position);
    scene.add(earth, eAtmo);
    const lb = label('EARTH', '384,400 km away', '#5ea8ff', 1.1); lb.position.copy(eDir).multiplyScalar(40).add(new THREE.Vector3(0, -2.6, 0)); lb.scale.setScalar(12);
    scene.add(lb); out.labels.push(lb);
  } else {
    scene.add(marsSkyDome(sunLocal));
    scene.fog = new THREE.FogExp2(0x6b4530, 0.0011);
    scene.backgroundIntensity = 0.75;
  }

  // ---- hardware
  const place = (obj, x, z, yaw = 0, sink = 0) => { obj.position.set(x, heightAt(x, z) - sink, z); obj.rotation.y = yaw; scene.add(obj); out.artifacts.push(obj); return obj; };
  if (m.id === 'eagle' || m.id === 'apollo15') {
    const lm = models.eagle.clone(true);
    // Only the descent stage stays on the Moon: hide everything above it.
    const lmHolder = fitModel(lm, 7.04, 'y');
    const box = new THREE.Box3().setFromObject(lm), cut = box.min.y + (box.max.y - box.min.y) * 0.45;
    lm.traverse(o => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); if ((b.min.y + b.max.y) / 2 > cut) o.visible = false; o.castShadow = o.receiveShadow = true; } });
    place(lmHolder, 0, -10, 0.4);
    out.discoveryTarget = lmHolder;
    out.discoveryTargets = [lmHolder];
    const { psep, lrrr } = buildEASEP();
    place(psep, -6.5, -13, 0.3); place(lrrr, -4.2, -14, 0.1);
    if(m.id==='eagle') place(buildFallenFlag(), 3.5, -11.5, 2.2, 0.01);
    out.labels.push(addLabel(scene, m.id === 'apollo15' ? 'FALCON (DESCENT STAGE)' : 'EAGLE (DESCENT STAGE)', m.id === 'apollo15' ? 'Apollo 15 · July 1971' : 'Left here July 21, 1969', m.color, 0, 4.2, -10, 1.3));
    if (m.id === 'apollo15') { const rover=buildLunarRover(); place(rover,3,-7,0.6); out.discoveryTarget = rover; out.discoveryTargets.push(rover); out.labels.push(addLabel(scene,'LUNAR ROVING VEHICLE','Illustrative model · first used on Apollo 15',m.color,3,1.8,-7,1.1)); }
    out.labels.push(addLabel(scene, 'SEISMOMETER', 'Listened for moonquakes', m.color, -6.5, 1.6, -13, 0.8));
    out.labels.push(addLabel(scene, 'LASER MIRROR', 'Still used today', m.color, -4.2, 1.3, -14, 0.8));
    if(m.id==='eagle') out.labels.push(addLabel(scene, 'THE FLAG', 'Knocked over at liftoff', m.color, 3.5, 1.0, -11.5, 0.8));
  } else if (m.id === 'sojourner') {
    place(buildPathfinderLander(), 0, -6, 0.5);
    const rover = place(buildSojourner(), 2.2, -4.2, -0.9);
    out.discoveryTarget = rover;
    const yogi = new THREE.Mesh(rockGeometry(5), new THREE.MeshStandardMaterial({ color: 0x7c4a34, roughness: 0.95 }));
    yogi.scale.set(0.75, 0.85, 0.6); yogi.castShadow = yogi.receiveShadow = true; place(yogi, 3.0, -3.3, 0.4, 0.15);
    const bb = new THREE.Mesh(rockGeometry(9), yogi.material); bb.scale.set(0.3, 0.32, 0.25); bb.castShadow = true; place(bb, 1.2, -4.6, 0, 0.05);
    out.labels.push(addLabel(scene, 'SOJOURNER', 'Rover · 10.6 kg', m.color, rover.position.x, 0.8, rover.position.z, 0.8));
    out.labels.push(addLabel(scene, 'PATHFINDER LANDER', 'Renamed the Carl Sagan Memorial Station', m.color, 0, 2.1, -6, 1.1));
    out.labels.push(addLabel(scene, '“YOGI”', 'A rock Sojourner studied', m.color, 3.0, 1.4, -3.3, 0.7));
    out.labels.push(addLabel(scene, '“BARNACLE BILL”', 'Its first rock', m.color, 1.2, 0.75, -4.6, 0.7));
    out.start.pos.set(0.6, 0, 0.4);
  } else if (m.id === 'opportunity' || m.id === 'spirit') {
    // The NASA model has a low antenna hanging ~17% below the wheels: size and sink it so the wheels touch the ground.
    const rover = fitModel(models.opportunity.clone(true), 1.5 / 0.83, 'y');
    rover.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; dustify(o); } });
    place(rover, 0, -4.5, 0.6, 0.17 * 1.5 / 0.83);
    out.discoveryTarget = rover;
    out.labels.push(addLabel(scene, m.id === 'spirit' ? 'SPIRIT' : 'OPPORTUNITY', m.id === 'spirit' ? 'Columbia Hills · 7.73 km explored' : 'Its last stop, after 45.16 km', m.color, 0, 2.3, -4.5));
    if (m.id === 'spirit') {
      // The 2007 deposit was found near Home Plate, not at Spirit's final position.
      // Display an illustrative sample alongside the resting rover for storytelling.
      const deposit = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshStandardMaterial({ color: 0xded1b6, roughness: 1, side: THREE.DoubleSide }));
      deposit.rotation.x = -Math.PI / 2;
      deposit.position.set(1.8, heightAt(1.8, -3.5) + 0.04, -3.5);
      scene.add(deposit); out.artifacts.push(deposit);
      out.labels.push(addLabel(scene, 'SILICA-RICH SOIL', 'Illustration · found near Home Plate in 2007', m.color, 1.8, 0.65, -3.5, 0.9));
    }
    out.start.pos.set(0, 0, 0);
  } else if (m.id === 'insight') {
    const lander=fitModel(models.insight.clone(true),5.8,'max');
    lander.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}}); place(lander,0,-9,0.35);
    const seis=new THREE.Mesh(new THREE.SphereGeometry(.4,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xc8c5bc,roughness:.9})); place(seis,3,-8);
    out.discoveryTarget = lander; out.discoveryInstrument = seis; out.discoveryTargets = [lander, seis];
    out.labels.push(addLabel(scene,'INSIGHT','Stationary lander · Elysium Planitia',m.color,0,2.7,-9,1.2));
    out.labels.push(addLabel(scene,'SEIS','Seismometer · illustrative placement',m.color,3,1,-8,1));
  } else if (m.id === 'ingenuity') {
    const heli = fitModel(models.ingenuity.clone(true), 1.2, 'max');
    heli.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; dustify(o, 0.25); } });
    place(heli, 0, -2.2, 0.3);
    out.discoveryTarget = heli;
    out.start.pos.set(0.3, 0, 1.2);
    const frag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.06), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 }));
    frag.castShadow = true; place(frag, 9, -12, 1.1, -0.004); frag.rotation.z = 0.1;
    out.labels.push(addLabel(scene, 'INGENUITY', '72 flights · 1.8 kg', m.color, 0, 1.0, -2.2, 0.8));
    out.labels.push(addLabel(scene, 'BLADE PIECE', 'Found about 15 m away', m.color, 9, 0.5, -12, 0.7));
  }

  out.motion = m.id === 'insight' ? createExtraMotion(m,out,models) : createSurfaceMotion(m, out, models, buildSojourner, buildLunarRover);
  // A stable spectator viewpoint: no automatic camera movement in VR.
  if (out.motion) out.start.pos.set(0, 0, m.id === 'eagle' ? 9 : 6);
  out.update = (dt, t, camera) => { for (const f of out.updaters) f(dt, t, camera); };
  return out;
}

function dustify(mesh, k = 0.35) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mesh.material = mats.map(mt => { const c = mt.clone(); if (c.color) c.color.lerp(new THREE.Color(0xa0603c), k); if ('roughness' in c) c.roughness = Math.min(1, c.roughness + k); return c; });
  if (mesh.material.length === 1) mesh.material = mesh.material[0];
}

function addLabel(scene, title, sub, color, x, y, z, w = 1.0) {
  const l = label(title, sub, color, w); l.position.set(x, y, z); scene.add(l); return l;
}

function buildDeep(m, scene, out, models) {
  // Voyager 1: alone, 25.9 billion km from home. Real sky orientation: the Sun is in the
  // opposite direction of Voyager's position on our sky (RA 17h13m, Dec +12°).
  const sunCel = raDecToVec(77.5, -12.0);
  const sunLocal = new THREE.Vector3(-0.82, 0.22, 0.2).normalize();
  const q = alignFrames(sunCel, new THREE.Vector3(0, 1, 0), sunLocal, new THREE.Vector3(0, 1, 0));
  scene.backgroundRotation.setFromQuaternion(q);
  scene.backgroundIntensity = 1.1;

  const key = new THREE.DirectionalLight(0xfff4e6, 2.6); key.position.copy(sunLocal).multiplyScalar(30);
  scene.add(key, new THREE.AmbientLight(0x445577, 0.25));
  const rim = new THREE.DirectionalLight(0x8899ff, 0.5); rim.position.set(3, -2, -5); scene.add(rim);

  const v = fitModel(models.voyager.clone(true), 13, 'max');   // the magnetometer boom is 13 m long
  const pivot = new THREE.Group(); pivot.add(v); v.position.y -= 1.5;
  pivot.position.set(0.6, 1.3, -7.5);
  scene.add(pivot);
  out.voyager = pivot;
  out.discoveryTarget = pivot;
  // the dish (model +Y) faces the Sun and Earth
  pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunLocal);

  const sunG = sunSprite(0.15, 15000); sunG.position.copy(sunLocal).multiplyScalar(15000); scene.add(sunG);
  // Earth: 1 AU from the Sun, seen from 173 AU => about 0.33° from it
  const side = new THREE.Vector3().crossVectors(sunLocal, new THREE.Vector3(0, 1, 0)).normalize();
  const eDir = sunLocal.clone().add(side.multiplyScalar(Math.tan(0.33 * Math.PI / 180))).normalize();
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(180,215,255,1)'], [0.35, 'rgba(110,160,255,0.45)'], [1, 'rgba(80,140,255,0)']], 64), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  dot.position.copy(eDir).multiplyScalar(14000); dot.scale.setScalar(26); scene.add(dot);
  const ls = label('THE SUN', 'A very bright star from here', '#ffd27a', 1.0); ls.position.copy(sunLocal).multiplyScalar(40).add(new THREE.Vector3(0, 3.2, 0)); ls.scale.setScalar(5);
  const le = label('EARTH', 'The pale blue dot · 25.9 billion km in Nov 2026', '#7fb2ff', 1.2); le.position.copy(eDir).multiplyScalar(40).add(new THREE.Vector3(0, -3.4, 0)); le.scale.setScalar(5);
  scene.add(ls, le); out.labels.push(ls, le);
  out.gaze = [{ panel: ls, dir: sunLocal.clone(), kind: 'sun' }, { panel: le, dir: eDir.clone(), kind: 'earth' }];   // look at them to fly there
  out.labels.push(addLabel(scene, 'VOYAGER 1', 'Launched 1977 · still talking', m.color, 0.6, 4.6, -7.5, 1.0));
  out.start.pos.set(0, 0, 0);
  out.update = (dt, t) => { pivot.rotateOnWorldAxis(sunLocal, dt * 0.01); };
  return out;
}

// Approximate lunar buggy: geometry illustrates the LRV and is not a CAD model.
function buildLunarRover() {
  const g=new THREE.Group(), metal=new THREE.MeshStandardMaterial({color:0xc6c5bd,metalness:.6,roughness:.5}), dark=new THREE.MeshStandardMaterial({color:0x373839,roughness:.8});
  const part=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  part(new THREE.BoxGeometry(1.8,.12,2.8),metal,0,.65,0);
  for(const x of [-.7,.7]) { part(new THREE.BoxGeometry(.45,.12,.55),metal,x,.9,-.2);part(new THREE.BoxGeometry(.45,.6,.1),metal,x,1.2,.02); }
  g.userData.wheels=[];
  for(const x of [-1,1])for(const z of [-1,1]) {const pivot=new THREE.Group();pivot.position.set(x,.43,z);g.add(pivot);g.userData.wheels.push(pivot);const w=new THREE.Mesh(new THREE.TorusGeometry(.42,.055,8,24),dark);w.rotation.y=Math.PI/2;pivot.add(w);for(let a=0;a<4;a++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.025,.8,.025),metal);spoke.rotation.x=a*Math.PI/4;pivot.add(spoke);}}
  const dish=part(new THREE.ConeGeometry(.36,.18,24,1,true),metal,0,1.5,-1.2);dish.rotation.x=-Math.PI/2;
  part(new THREE.CylinderGeometry(.025,.025,.8),metal,0,1.05,-1.2);return g;
}

function buildEros(m,scene,out,models,starTex) {
  scene.background=starTex; scene.add(new THREE.HemisphereLight(0x9ba8c0,0x504438,1));
  const sun=new THREE.DirectionalLight(0xffe2bc,3);sun.position.set(-10,20,10);scene.add(sun);
  const height=(x,z)=>0.15*Math.sin(x*.4)*Math.cos(z*.3);out.heightAt=height;
  const terrain=buildTerrain(height,8000,{color:0x796954,roughness:1},4);scene.add(terrain);out.teleport=terrain;
  scene.add(scatterRocks(height,'moon',350,97,0x88735c,[[0,-9,5],[0,0,2]]));
  const probe=fitModel(models.near.clone(true),2.8,'max'); probe.position.set(0,height(0,-9),-9);scene.add(probe);out.artifacts.push(probe);
  out.discoveryTarget = probe;
  out.labels.push(addLabel(scene,'NEAR SHOEMAKER','Eros · approximate final orientation',m.color,0,2.5,-9,1.2));
  out.start.pos.set(0,0,6);out.motion=createExtraMotion(m,out,models);
  out.update=(dt,t,camera)=>{for(const f of out.updaters)f(dt,t,camera)};return out;
}



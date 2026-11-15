// Launch vehicles and their staging sequences (compressed in time, real order of events).
//   Apollo 11   -> Saturn V: S-IC, S-II, S-IVB + transposition & docking with Eagle
//   Pathfinder  -> Delta II 7925 (9 GEM-40 boosters, Star 48B third stage)
//   Opportunity -> Delta II 7925H (9 larger GEM-46 boosters)
//   Mars 2020   -> Atlas V 541 (4 solid boosters, 5 m fairing, Centaur)
//   Voyager 1   -> Titan IIIE / Centaur (2 big solids that light first, then the Titan core)
// Rocket axis = +Y, base at y = 0. Everything here is built in code at real dimensions (metres).
import * as THREE from 'three';
import { glowTexture } from './ui.js';

const std = (color, rough = 0.55, metal = 0.05, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// ---------------------------------------------------------------- paint jobs
function paintTex(draw, w = 512, h = 1024) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const quadrants = (x, w, y0, y1) => { x.fillStyle = '#111'; x.fillRect(0, y0, w / 4, y1 - y0); x.fillRect(w / 2, y0, w / 4, y1 - y0); };
const S_IC = () => paintTex((x, w, h) => {
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, w, h);
  quadrants(x, w, h * 0.86, h);                 // aft roll pattern
  x.fillStyle = '#111'; x.fillRect(0, h * 0.38, w, h * 0.05); // intertank
  quadrants(x, w, 0, h * 0.06);
  x.fillStyle = '#111'; x.font = 'bold 50px Helvetica, Arial'; x.textAlign = 'center';
  'USA'.split('').forEach((ch, i) => x.fillText(ch, w * 0.375, h * 0.5 + i * 56));
});
const S_IVB = () => paintTex((x, w, h) => { x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, w, h); quadrants(x, w, h * 0.72, h); });
const BANDS = (base, band, n) => paintTex((x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); x.fillStyle = band; for (let i = 1; i < n; i++) x.fillRect(0, h * i / n - 4, w, 8); });

// ---------------------------------------------------------------- pieces
function cyl(r, h, mat, y, rTop = r, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 48, 1, open), mat);
  m.position.y = y + h / 2; m.castShadow = true; return m;
}
function nose(r, h, mat, y) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(r * Math.sqrt(1 - t * t * 0.98) * (1 - Math.pow(t, 6) * 0.1), y + t * h)); }
  pts.push(new THREE.Vector2(0, y + h));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mat);
}
function bell(rExit, len, y, mat = std(0x2a2622, 0.4, 0.85, { side: THREE.DoubleSide })) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rExit * 0.38, rExit, len, 28, 1, true), mat);
  m.position.y = y - len / 2; return m;
}

// Exhaust plume. kind: kerolox (bright orange), solid (white-hot, dense), hydrolox (faint blue), hypergolic (faint orange)
const PLUME = {
  kerolox: { core: [1.0, 0.95, 0.8], edge: [1.0, 0.45, 0.12], k: 1.6 },
  solid: { core: [1.0, 1.0, 0.95], edge: [1.0, 0.55, 0.2], k: 2.0 },
  hydrolox: { core: [0.75, 0.8, 1.0], edge: [0.35, 0.3, 0.9], k: 0.55 },
  hypergolic: { core: [1.0, 0.8, 0.65], edge: [0.9, 0.35, 0.25], k: 0.8 },
};
function plume(rExit, kind) {
  const P = PLUME[kind];
  const len = rExit * 14;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uCore: { value: new THREE.Vector3(...P.core) }, uEdge: { value: new THREE.Vector3(...P.edge) }, uK: { value: P.k } },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT, uOn, uK; uniform vec3 uCore, uEdge; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        #include <logdepthbuf_fragment>
        float along = vUv.y;                         // 1 at the nozzle, 0 at the far end
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        float flick = 0.85 + 0.15 * sin(uT * 47.0 + along * 31.0) * sin(uT * 23.0 + vUv.x * 40.0);
        float a = pow(along, 2.2) * facing * flick * uOn * uK;
        vec3 col = mix(uEdge, uCore, pow(along, 3.0));
        gl_FragColor = vec4(col * a, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(rExit * 3.2, len, 32, 1, true), mat);
  cone.position.y = -len / 2; cone.rotation.x = Math.PI;   // narrow at the nozzle, opening downstream
  const core = new THREE.Mesh(new THREE.ConeGeometry(rExit * 0.9, len * 0.35, 24, 1, true), mat.clone());
  core.material.uniforms.uK.value = P.k * 1.6;
  core.position.y = -len * 0.175; core.rotation.x = Math.PI;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,240,210,1)'], [0.25, 'rgba(255,170,80,0.5)'], [1, 'rgba(255,120,40,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
  glow.scale.setScalar(rExit * 7); glow.position.y = -rExit * 0.8;
  g.add(cone, core, glow);
  g.userData = { mats: [cone.material, core.material], glow, on: 0, target: 0, kind };
  return g;
}

// ---------------------------------------------------------------- rocket assembly
/** A stage = group of meshes that separates together, with optional engines/plumes. */
function stage(name) { const g = new THREE.Group(); g.name = name; g.userData.plumes = []; return g; }
function addEngine(st, rExit, len, x, y, z, kind) {
  const b = bell(rExit, len, y); b.position.x = x; b.position.z = z; st.add(b);
  const p = plume(rExit, kind); p.position.set(x, y - len, z); st.add(p); st.userData.plumes.push(p);
}

function saturnV(vehicle) {
  const R = 5.05, white = std(0xf4f4f0, 0.6, 0.05), black = std(0x151515, 0.6, 0.1);
  const root = new THREE.Group();
  const s1 = stage('S-IC'), s2 = stage('S-II'), s3 = stage('S-IVB'), les = stage('LES');
  // S-IC: 42 m, 5 F-1 engines, 4 fins
  s1.add(cyl(R, 42, std(0xffffff, 0.6, 0.05, { map: S_IC() }), 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 3.4), white); fin.position.set(Math.cos(a) * (R + 1.2), 3, Math.sin(a) * (R + 1.2)); fin.rotation.y = -a; s1.add(fin);
    const fair = cyl(1.0, 6, white, 0); fair.position.x = Math.cos(a) * (R - 0.4); fair.position.z = Math.sin(a) * (R - 0.4); s1.add(fair);
  }
  addEngine(s1, 1.85, 5.8, 0, 0, 0, 'kerolox');
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; addEngine(s1, 1.85, 5.8, Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1, 'kerolox'); }
  // S-II: 24.8 m + conical adapter to the S-IVB, 5 J-2 engines (hydrolox: nearly invisible flame)
  s2.add(cyl(R, 24.8, white, 42), cyl(R, 1.2, black, 42 + 24.8 - 1.2), cyl(R, 5.6, white, 66.8, 3.3));
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; addEngine(s2, 1.0, 3.4, i ? Math.cos(a) * 2.6 : 0, 42, i ? Math.sin(a) * 2.6 : 0, 'hydrolox'); }
  // S-IVB: 17.8 m + Instrument Unit + the SLA panels that hide Eagle
  s3.add(cyl(3.3, 17.8, std(0xffffff, 0.6, 0.05, { map: S_IVB() }), 72.4), cyl(3.3, 0.9, std(0xe6e6e0, 0.5, 0.2), 90.2));
  addEngine(s3, 1.0, 3.4, 0, 72.4, 0, 'hydrolox');
  const sla = [];
  for (let i = 0; i < 4; i++) {
    // the four SLA panels are hinged at their base (on the S-IVB) and swing open like petals
    const petal = new THREE.Group(); petal.position.y = 91.1;
    const geo = new THREE.CylinderGeometry(1.98, 3.3, 8.5, 12, 1, true, i * Math.PI / 2, Math.PI / 2);
    const m = new THREE.Mesh(geo, std(0xd8d8d0, 0.5, 0.3, { side: THREE.DoubleSide })); m.position.y = 4.25; petal.add(m);
    const c = i * Math.PI / 2 + Math.PI / 4;
    petal.userData.radial = new THREE.Vector3(Math.sin(c), 0, Math.cos(c));
    petal.userData.hinge = new THREE.Vector3(Math.cos(c), 0, -Math.sin(c));   // = up x radial
    s3.add(petal); sla.push(petal);
  }
  // Spacecraft: Eagle sits inside the SLA, Columbia on top pointing up with the escape tower
  const u = vehicle.userData, inner = u.inner;
  vehicle.position.y = 91.4;
  u.csm.rotation.x = Math.PI; u.csm.position.y = (99.6 - 91.4) + u.csmLen;
  u.lm.visible = false;
  s3.add(vehicle);
  les.add(cyl(0.35, 4.5, std(0xb83a2a, 0.5, 0.2), 0), cyl(0.5, 3.6, std(0xffffff, 0.5, 0.2), 4.5), nose(0.5, 1.6, std(0xffffff, 0.5, 0.2), 8.1));
  const lesBase = 99.6 + u.csmLen;   // CM apex
  les.position.y = lesBase; s3.add(les);
  addEngineGlow(les, 0.35, 0, 'solid');
  root.add(s1, s2, s3);
  return {
    root, stack: [s1, s2, s3], name: 'Saturn V', length: lesBase + 10, debris: [],
    events: [
      { t: 0, caption: 'SATURN V · FIVE F-1 ENGINES', fn: (L) => L.ignite(s1) },
      { t: 3.6, caption: 'S-IC STAGING · 67 km UP', fn: (L) => { L.separate(s1); L.ignite(s2); } },
      { t: 5.4, caption: 'LAUNCH ESCAPE TOWER JETTISONED', fn: (L) => L.jettison(les, 60, 0.5) },
      { t: 9.6, caption: 'S-II STAGING · 185 km UP', fn: (L) => { L.separate(s2); L.ignite(s3); } },
      { t: 12.6, caption: 'EARTH ORBIT · THEN TRANS-LUNAR INJECTION', fn: (L) => L.cut(s3) },
      { t: 13.8, caption: 'TRANS-LUNAR INJECTION · NEXT STOP: THE MOON', fn: (L) => L.ignite(s3) },
      { t: 17.0, caption: 'S-IVB SHUTDOWN', fn: (L) => L.cut(s3) },
      { t: 17.8, caption: 'COLUMBIA SEPARATES · THE PANELS OPEN', fn: (L) => {
          u.lm.visible = true;
          L.anim(2.4, (k) => { for (const p of sla) p.quaternion.setFromAxisAngle(p.userData.hinge, k * 0.8); });
          const y0 = u.csm.position.y; L.anim(2.4, (k) => { u.csm.position.y = y0 + k * 9; });
        } },
      { t: 20.4, caption: 'TRANSPOSITION · COLUMBIA TURNS AROUND', fn: (L) => {
          for (const p of sla) L.jettisonKeep(p, 4 + Math.random() * 2);
          L.anim(3, (k) => { u.csm.rotation.x = Math.PI * (1 - k); u.csm.position.y = (99.6 - 91.4) + u.csmLen + 9 + Math.sin(k * Math.PI) * 4 - k * 0; });
        } },
      { t: 23.6, caption: 'DOCKING WITH EAGLE', fn: (L) => {
          const y0 = u.csm.position.y; L.anim(3, (k) => { u.csm.position.y = y0 + (u.dockY - y0) * k; });
        } },
      { t: 27.0, caption: 'EAGLE PULLED FREE · S-IVB SENT AWAY', fn: (L) => {
          const v0 = vehicle.position.y; L.anim(3, (k) => { vehicle.position.y = v0 + k * 14; });
          L.release(vehicle, s3);
        } },
    ],
    duration: 30.5,
  };
}

function addEngineGlow(group, r, y, kind) { const p = plume(r, kind); p.position.y = y; group.add(p); group.userData.plumes = [p]; }

function delta2(vehicle, heavy) {
  const R = 1.22, teal = std(0x48989a, 0.55, 0.1), white = std(0xf2f2ee, 0.55, 0.05), dark = std(0x26282c, 0.5, 0.3);
  const root = new THREE.Group();
  const s1 = stage('Stage 1'), s2 = stage('Stage 2'), s3 = stage('Star 48B'), gA = stage('GEM A'), gB = stage('GEM B');
  s1.add(cyl(R, 26, teal, 0), cyl(R, 1.0, dark, 25));
  addEngine(s1, 0.55, 1.6, 0, 0, 0, 'kerolox');
  const gr = heavy ? 0.58 : 0.51, gh = heavy ? 14.7 : 13;
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9, g = i < 6 ? gA : gB;
    const b = new THREE.Group(); b.position.set(Math.cos(a) * (R + gr), 0.8, Math.sin(a) * (R + gr));
    b.add(cyl(gr, gh, white, 0), nose(gr, 1.2, white, gh));
    const p = plume(gr * 0.75, 'solid'); p.position.y = -0.2; b.add(p); g.userData.plumes.push(p);
    b.userData.dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    g.add(b);
  }
  s2.add(cyl(R, 6, white, 26), cyl(R, 0.6, dark, 26));
  addEngine(s2, 0.42, 1.2, 0, 26, 0, 'hypergolic');
  // Star 48B solid third stage + the spacecraft, inside the fairing
  s3.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), dark)); s3.children[0].position.y = 33.0;
  addEngine(s3, 0.38, 0.6, 0, 32.4, 0, 'solid');
  const inner = vehicle.userData.inner; inner.rotation.x = Math.PI;   // heat shield faces forward during launch
  vehicle.position.y = 33.6 + 1.6; s3.add(vehicle);
  const fair = [0, 1].map((i) => {
    const h = new THREE.Group();
    const geo = new THREE.CylinderGeometry(1.5, 1.5, 5.6, 32, 1, true, i * Math.PI, Math.PI);
    const body = new THREE.Mesh(geo, std(0xf6f6f2, 0.5, 0.05, { side: THREE.DoubleSide })); body.position.y = 32 + 2.8;
    const tip = new THREE.Mesh(new THREE.LatheGeometry([...Array(17)].map((_, k) => new THREE.Vector2(1.5 * Math.cos(k / 16 * Math.PI / 2) ** 0.8, 37.6 + k / 16 * 3.2)), 32, i * Math.PI, Math.PI), body.material);
    h.add(body, tip); h.userData.dir = new THREE.Vector3(i ? -1 : 1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    s3.add(h); return h;
  });
  root.add(s1, s2, s3); s1.add(gA, gB);
  return {
    root, stack: [s1, s2, s3], name: heavy ? 'Delta II 7925H' : 'Delta II 7925', length: 41, debris: [],
    events: [
      { t: 0, caption: (heavy ? 'DELTA II HEAVY' : 'DELTA II') + ' · 6 OF 9 BOOSTERS FIRING', fn: (L) => { L.ignite(s1); L.ignite(gA); } },
      { t: 2.8, caption: 'SIX BOOSTERS DROP · THREE MORE LIGHT UP', fn: (L) => { L.separateEach(gA); L.ignite(gB); } },
      { t: 5.6, caption: 'LAST THREE BOOSTERS DROP', fn: (L) => L.separateEach(gB) },
      { t: 8.6, caption: 'FIRST STAGE SEPARATION', fn: (L) => { L.separate(s1); L.ignite(s2); } },
      { t: 10.6, caption: 'NOSE FAIRING OPENS', fn: (L) => fair.forEach((f) => L.jettisonSide(f, f.userData.dir)) },
      { t: 14.4, caption: 'SECOND STAGE SEPARATION · THIRD STAGE SPINS UP', fn: (L) => { L.separate(s2); L.spin(s3, 6); } },
      { t: 15.6, caption: 'STAR 48 FIRES · LEAVING EARTH FOR MARS', fn: (L) => L.ignite(s3) },
      { t: 19.2, caption: 'SPACECRAFT SEPARATION', fn: (L) => { L.cut(s3); L.release(vehicle, s3); } },
    ],
    duration: 22.5,
  };
}

function atlasV(vehicle, insight = false) {
  const R = 1.905, bronze = std(0xc27c45, 0.7, 0.1), white = std(0xf2f2ee, 0.55, 0.05), dark = std(0x26282c, 0.5, 0.4);
  const root = new THREE.Group();
  const s1 = stage('Atlas core'), srb = stage('Solids'), cen = stage('Centaur');
  s1.add(cyl(R, 32.5, bronze, 0), cyl(R, 1.4, white, 32.5));
  addEngine(s1, 0.8, 2.6, -0.55, 0, 0, 'kerolox'); addEngine(s1, 0.8, 2.6, 0.55, 0, 0, 'kerolox');
  for (let i = 0; i < (insight ? 0 : 4); i++) {
    const a = i * Math.PI / 2 + 0.4;
    const b = new THREE.Group(); b.position.set(Math.cos(a) * (R + 0.8), 1, Math.sin(a) * (R + 0.8));
    b.add(cyl(0.8, 19, white, 0), nose(0.8, 2.0, white, 19));
    const p = plume(0.6, 'solid'); p.position.y = -0.3; b.add(p); srb.userData.plumes.push(p);
    b.userData.dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); srb.add(b);
  }
  s1.add(srb);
  cen.add(cyl(1.53, 12.7, std(0xdedcd6, 0.4, 0.4), 34.2)); addEngine(cen, 0.6, 1.8, 0, 34.2, 0, 'hydrolox');
  const inner = vehicle.userData.inner; inner.rotation.x = Math.PI;
  vehicle.position.y = 34.2 + 12.7 + 2.0; cen.add(vehicle);
  const fair = [0, 1].map((i) => {
    const h = new THREE.Group();
    const mat = std(0xf6f6f2, 0.5, 0.05, { side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 14, 40, 1, true, i * Math.PI, Math.PI), mat); body.position.y = 33.9 + 7;
    const tip = new THREE.Mesh(new THREE.LatheGeometry([...Array(17)].map((_, k) => new THREE.Vector2(2.7 * Math.cos(k / 16 * Math.PI / 2) ** 0.8, 47.9 + k / 16 * 7)), 40, i * Math.PI, Math.PI), mat);
    h.add(body, tip); h.userData.dir = new THREE.Vector3(i ? -1 : 1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    cen.add(h); return h;
  });
  root.add(s1, cen);
  return {
    root, stack: [s1, cen], name: insight ? 'Atlas V 401' : 'Atlas V 541', length: 57, debris: [],
    events: [
      { t: 0, caption: insight ? 'ATLAS V 401 · RD-180 CORE, NO SOLID BOOSTERS' : 'ATLAS V 541 · RD-180 + FOUR SOLID BOOSTERS', fn: (L) => { L.ignite(s1); L.ignite(srb); } },
      { t: 3.6, caption: insight ? 'ATLAS CORE CONTINUES ASCENT' : 'SOLID BOOSTERS DROP AWAY', fn: (L) => L.separateEach(srb) },
      { t: 6.4, caption: 'PAYLOAD FAIRING OPENS', fn: (L) => fair.forEach((f) => L.jettisonSide(f, f.userData.dir)) },
      { t: 9.6, caption: 'BOOSTER SEPARATION · CENTAUR IGNITION', fn: (L) => { L.separate(s1); L.ignite(cen); } },
      { t: 12.8, caption: 'COASTING IN EARTH ORBIT', fn: (L) => L.cut(cen) },
      { t: 14.0, caption: 'CENTAUR FIRES AGAIN · OFF TO MARS', fn: (L) => L.ignite(cen) },
      { t: 17.6, caption: 'SPACECRAFT SEPARATION', fn: (L) => { L.cut(cen); L.release(vehicle, cen); } },
    ],
    duration: 21,
  };
}

function titan3e(vehicle) {
  const white = std(0xf2f2ee, 0.55, 0.05), core = std(0xd9d6cc, 0.55, 0.15), dark = std(0x26282c, 0.5, 0.4);
  const root = new THREE.Group();
  const srb = stage('UA1205 solids'), s1 = stage('Titan stage 1'), s2 = stage('Titan stage 2'), cen = stage('Centaur'), pm = stage('Propulsion module');
  s1.add(cyl(1.525, 22.2, core, 0)); addEngine(s1, 0.75, 2.2, -0.6, 0, 0, 'hypergolic'); addEngine(s1, 0.75, 2.2, 0.6, 0, 0, 'hypergolic');
  const bandTex = BANDS('#f2f2ee', '#3a3a3a', 6);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Group(); b.position.set(i ? -3.1 : 3.1, -1.2, 0);
    b.add(cyl(1.55, 25.9, std(0xffffff, 0.55, 0.05, { map: bandTex }), 0), nose(1.55, 2.6, white, 25.9));
    const p = plume(1.3, 'solid'); p.position.y = -0.4; b.add(p); srb.userData.plumes.push(p);
    b.userData.dir = new THREE.Vector3(i ? -1 : 1, 0, 0); srb.add(b);
  }
  s1.add(srb);
  s2.add(cyl(1.525, 7.1, core, 22.2)); addEngine(s2, 0.7, 1.8, 0, 22.2, 0, 'hypergolic');
  cen.add(cyl(1.5, 9.6, std(0xdedcd6, 0.4, 0.4), 30.6)); addEngine(cen, 0.5, 1.4, 0, 30.6, 0, 'hydrolox');
  pm.add(new THREE.Mesh(new THREE.SphereGeometry(0.47, 20, 14), dark)); pm.children[0].position.y = 41.2;
  addEngine(pm, 0.3, 0.6, 0, 40.7, 0, 'solid');
  cen.add(pm);
  vehicle.position.y = 47.5; vehicle.visible = false; pm.add(vehicle);   // booms were folded inside the shroud
  const shroud = [0, 1].map((i) => {
    const h = new THREE.Group(); const mat = std(0xf6f6f2, 0.5, 0.05, { side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 13, 40, 1, true, i * Math.PI, Math.PI), mat); body.position.y = 29.8 + 6.5;
    const tip = new THREE.Mesh(new THREE.LatheGeometry([...Array(17)].map((_, k) => new THREE.Vector2(2.1 * Math.cos(k / 16 * Math.PI / 2) ** 0.8, 42.8 + k / 16 * 4.7)), 40, i * Math.PI, Math.PI), mat);
    h.add(body, tip); h.userData.dir = new THREE.Vector3(i ? -1 : 1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    s2.add(h); return h;
  });
  root.add(s1, s2, cen);
  return {
    root, stack: [s1, s2, cen], name: 'Titan IIIE / Centaur', length: 48.8, debris: [],
    events: [
      { t: 0, caption: 'TITAN IIIE · TWO GIANT SOLIDS DO THE LIFTING', fn: (L) => L.ignite(srb) },
      { t: 2.8, caption: 'TITAN CORE IGNITES IN FLIGHT', fn: (L) => L.ignite(s1) },
      { t: 3.8, caption: 'SOLID BOOSTERS DROP AWAY', fn: (L) => L.separateEach(srb) },
      { t: 7.0, caption: 'TITAN STAGE 1 SEPARATION', fn: (L) => { L.separate(s1); L.ignite(s2); } },
      { t: 8.8, caption: 'CENTAUR SHROUD OPENS', fn: (L) => { vehicle.visible = true; shroud.forEach((f) => L.jettisonSide(f, f.userData.dir)); } },
      { t: 11.4, caption: 'TITAN STAGE 2 SEPARATION · CENTAUR IGNITION', fn: (L) => { L.separate(s2); L.ignite(cen); } },
      { t: 15.0, caption: 'CENTAUR SEPARATION · VOYAGER’S OWN KICK MOTOR FIRES', fn: (L) => { L.cut(cen); L.release(pm, cen); L.later(0.6, () => L.ignite(pm)); } },
      { t: 18.6, caption: 'KICK MOTOR DROPPED · VOYAGER 1 IS ON ITS WAY', fn: (L) => { L.cut(pm); L.release(vehicle, pm); } },
    ],
    duration: 21.5,
  };
}

/**
 * Build the launch for a mission. `vehicle` is the cruise spacecraft (from buildVehicle) which gets mounted on top.
 * Returns a controller: { root, update(dt), events, duration, caption, speed (0..1 thrust), done, vehicle }.
 */
export function buildLaunch(mission, vehicle) {
  const spec = (mission.id === 'eagle' || mission.id === 'apollo15') ? saturnV(vehicle)
    : (mission.id === 'sojourner' || mission.id === 'near' || mission.id === 'spirit') ? delta2(vehicle, false)
      : mission.id === 'opportunity' ? delta2(vehicle, true)
        : (mission.id === 'ingenuity' || mission.id === 'insight') ? atlasV(vehicle, mission.id === 'insight') : titan3e(vehicle);
  if (mission.id === 'near') { spec.name = 'Delta II 7925-8'; spec.events.forEach(e => { e.caption = e.caption.replace('LEAVING EARTH FOR MARS', 'LEAVING EARTH FOR EROS'); }); }
  if (mission.id === 'apollo15') spec.events.forEach(e => { e.caption = e.caption.replaceAll('EAGLE', 'FALCON').replaceAll('COLUMBIA', 'ENDEAVOUR'); });
  const root = spec.root;
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const light = new THREE.PointLight(0xffb070, 0, 0, 1.4); root.add(light);
  const anims = [], timers = [], debris = [];
  let t = 0, nextEvent = 0;
  const L = {
    root, spec, caption: '', captionT: 0, thrust: 0, released: null, onEvent: null,
    ignite(st) { for (const p of st.userData.plumes || []) p.userData.target = 1; },
    cut(st) { for (const p of st.userData.plumes || []) p.userData.target = 0; },
    anim(dur, fn) { anims.push({ t: 0, dur, fn }); },
    later(s, fn) { timers.push({ t: s, fn }); },
    /** detach a part: it keeps falling behind (the rest keeps accelerating) and tumbles */
    separate(st, push = 1.5) {
      this.cut(st);
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion(); st.updateWorldMatrix(true, false);
      st.matrixWorld.decompose(wp, wq, new THREE.Vector3());
      root.attach(st);
      debris.push({ o: st, v: new THREE.Vector3((Math.random() - .5) * 0.6, -push, (Math.random() - .5) * 0.6), a: -9, w: new THREE.Vector3((Math.random() - .5) * 0.12, 0, (Math.random() - .5) * 0.12), life: 0 });
      this.flash(st);
    },
    separateEach(group) {
      for (const b of [...group.children]) {
        root.attach(b);
        const d = b.userData.dir || new THREE.Vector3(1, 0, 0);
        debris.push({ o: b, v: d.clone().multiplyScalar(3).add(new THREE.Vector3(0, -2, 0)), a: -9, w: new THREE.Vector3(d.z * 0.5, 0, -d.x * 0.5), life: 0 });
        for (const p of b.children) if (p.userData.mats) p.userData.target = 0;
      }
      group.userData.plumes = [];
      this.flash(group);
    },
    jettison(part, speed, spinRate) { this.ignite(part); this.later(1.2, () => this.cut(part)); root.attach(part); debris.push({ o: part, v: new THREE.Vector3(2, speed, 0), a: 0, w: new THREE.Vector3(0, 0, spinRate), life: 0 }); },
    jettisonSide(part, dir) { root.attach(part); debris.push({ o: part, v: dir.clone().multiplyScalar(4).add(new THREE.Vector3(0, -1, 0)), a: -4, w: new THREE.Vector3(dir.z * 0.6, 0, -dir.x * 0.6), life: 0 }); },
    jettisonKeep(part, s) { root.attach(part); const dir = part.userData.radial.clone(); debris.push({ o: part, v: dir.multiplyScalar(s).add(new THREE.Vector3(0, -1.5, 0)), a: -1, w: new THREE.Vector3(Math.random() - .5, 0, Math.random() - .5).multiplyScalar(0.8), life: 0 }); },
    spin(st, rate) { st.userData.spin = rate; },
    /** the payload flies free: from here on it is the cruise spacecraft */
    release(v, from) { root.attach(v); from.userData.spinStop = true; this.released = v; this.later(0.2, () => this.separate(from, 2.5)); },
    flash() { this.flashT = 0.35; },
    update(dt) {
      t += dt;
      while (nextEvent < spec.events.length && t >= spec.events[nextEvent].t) {
        const e = spec.events[nextEvent++];
        e.fn(L); if (e.caption) { L.caption = e.caption; L.captionT = 0; L.onEvent && L.onEvent(e); }
      }
      L.captionT += dt;
      for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(k * k * (3 - 2 * k)); if (k >= 1) anims.splice(i, 1); }
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
      for (const d of debris) {
        d.life += dt; d.v.y += d.a * dt;
        d.o.position.addScaledVector(d.v, dt);
        d.o.rotation.x += d.w.x * dt; d.o.rotation.y += d.w.y * dt; d.o.rotation.z += d.w.z * dt;
        if (d.life > 14) d.o.visible = false;
      }
      // spinning upper stages
      root.traverse((o) => { if (o.userData.spin && !o.userData.spinStop) o.rotateY(o.userData.spin * dt); });
      // plumes
      let thrust = 0;
      root.traverse((o) => {
        const u = o.userData; if (!u.mats) return;
        u.on += (u.target - u.on) * Math.min(1, dt * (u.target > u.on ? 6 : 3));
        for (const m of u.mats) { m.uniforms.uOn.value = u.on; m.uniforms.uT.value = t; }
        u.glow.material.opacity = u.on * (u.kind === 'hydrolox' ? 0.35 : 1);
        if (o.visible && u.on > 0.05 && !isDebris(o)) thrust = Math.max(thrust, u.on * (u.kind === 'hydrolox' ? 0.55 : 1));
      });
      L.thrust = thrust;
      light.intensity = thrust * 900;
      L.flashT = Math.max(0, (L.flashT || 0) - dt);
      L.done = t >= spec.duration;
      L.t = t;
    },
    /** time of the next captioned event (or the end), so step mode can hold just before it */
    nextEventT() { return nextEvent < spec.events.length ? spec.events[nextEvent].t : spec.duration; },
    /** current active stack (not yet separated) — for camera framing */
    activeBox() {
      const box = new THREE.Box3();
      for (const st of spec.stack) if (!isDebris(st) && st.parent) box.expandByObject(st);
      if (L.released && !isDebris(L.released)) box.expandByObject(L.released);
      return box;
    },
  };
  function isDebris(o) { for (let p = o; p; p = p.parent) if (debris.some((d) => d.o === p)) return true; return false; }
  light.position.y = -6;
  return L;
}

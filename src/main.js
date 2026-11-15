// Abandoned but not Forgotten — one continuous universe, on a flat screen or in any WebXR headset.
//   hub (orbit, solar system around you) -> launch on the real rocket, staging -> warp cruise with the
//   real spacecraft -> arrival at 1:1 scale.  From Voyager 1 you can look at the Sun or Earth to fly there.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { MISSIONS } from './missions.js';
import { Panel, button, glass, drawText, hexA, FONT, MONO, BODY, THEME } from './ui.js';
import { buildVehicle, updateVehicle } from './vehicles.js';
import { buildLaunch } from './rockets.js';
import { createSolarMarkers } from './solar.js';
import { BRAND } from './brand.js';
import { createSpace, R_EARTH, R_MOON, R_MARS } from './space.js';
import { createSurface } from './surface.js';
import { createMotionControls } from './motion-controls.js';
import { createDiscovery } from './discovery.js';
import { raDecToVec, alignFrames } from './astro.js';
import { initAudio, setRumble, setWarp, setHum, boom, toggleMute } from './audio.js';

const $ = (id) => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(0.4);
$('app').appendChild(renderer.domElement);

const BASE_FOV = 62;
const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.03, 1e12);
const rig = new THREE.Group();
rig.add(camera);
const EYE = 1.6;
camera.position.set(0, EYE, 0);
let lookYaw = 0, lookPitch = 0;
const inXR = () => renderer.xr.isPresenting;

// Fade sphere (blink transitions are the comfortable way to change place in VR)
const fade = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false }));
fade.renderOrder = 9999; camera.add(fade);
let fadeTarget = 1, fadeSpeed = 2;
function fadeTo(v, speed = 2.5) { fadeTarget = v; fadeSpeed = speed; return new Promise((res) => { const chk = () => (Math.abs(fade.material.opacity - v) < 0.01 ? res() : requestAnimationFrame(chk)); chk(); }); }
// White flash for stage separations (kept soft in VR)
const flash = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2dd, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
flash.renderOrder = 9997; camera.add(flash);

// Comfort vignette for VR during flights
const vignette = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
  uniforms: { uAmt: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform float uAmt; varying vec2 vUv; void main(){ float r=length(vUv-0.5)*2.0; gl_FragColor=vec4(0.0,0.0,0.0,smoothstep(0.35,0.95,r)*uAmt); }',
}));
vignette.position.z = -0.12; vignette.scale.setScalar(0.32); vignette.renderOrder = 9998; camera.add(vignette);

// Desktop-only post-processing (bloom). In a headset we render straight to the eyes.
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 1.25);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ loading
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => { $('loadbar').style.width = Math.round(done / total * 100) + '%'; };
const texLoader = new THREE.TextureLoader(manager);
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const gltf = new GLTFLoader(manager).setDRACOLoader(draco);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(url, srgb = true) {
  return new Promise((res, rej) => texLoader.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso); res(t); }, undefined, rej));
}
const glb = (url) => new Promise((res, rej) => gltf.load(url, (g) => res(g.scene), undefined, rej));

const bigSky = renderer.capabilities.maxTextureSize >= 8192;
const T = 'assets/tex/';
const [starTex, day, night, clouds, moonT, moonN, marsT, sunT, mercT, venT, jupT, satT, satRing, uraT, nepT, eagleM, oppM, ingM, voyM, nearM, insightM] = await Promise.all([
  tex(bigSky ? 'assets/sky/starmap_8k.jpg' : 'assets/sky/starmap_4k.jpg'),
  tex(T + 'earth_day_4k.jpg'), tex(T + 'earth_night_4k.jpg'), tex(T + 'earth_clouds_4k.jpg', false),
  tex(T + 'moon_4k.jpg'), tex(T + 'moon_normal.jpg', false), tex(T + 'mars_4k.jpg'), tex(T + 'sun_2k.jpg'),
  tex(T + '2k_mercury.jpg'), tex(T + '2k_venus_atmosphere.jpg'), tex(T + '2k_jupiter.jpg'), tex(T + '2k_saturn.jpg'), tex(T + '2k_saturn_ring_alpha.png'),
  tex(T + '2k_uranus.jpg'), tex(T + '2k_neptune.jpg'),
  glb('assets/models/apollo_lm.glb'), glb('assets/models/opportunity.glb'), glb('assets/models/ingenuity.glb'), glb('assets/models/voyager.glb'), glb('assets/models/near.glb'), glb('assets/models/insight.glb'),
  document.fonts.load(`700 40px 'Inter'`), document.fonts.load(`800 40px 'Inter'`), document.fonts.load(`400 40px 'Public Sans'`), document.fonts.load(`400 40px 'DM Mono'`), document.fonts.load(`500 40px 'DM Mono'`),
]);
starTex.mapping = THREE.EquirectangularReflectionMapping;
const TEX = { day, night, clouds, moon: moonT, moonNormal: moonN, mars: marsT, sun: sunT, mercury: mercT, venus: venT, jupiter: jupT, saturn: satT, saturnRing: satRing, uranus: uraT, neptune: nepT };
const MODELS = { eagle: eagleM, opportunity: oppM, ingenuity: ingM, voyager: voyM, near: nearM, insight: insightM };

// ------------------------------------------------------------------ worlds
const now = new Date();
const space = createSpace({ tex: TEX, starTex, now });
let world = space.scene;          // the scene currently rendered
let surface = null;               // current surface scene (built on arrival)
world.add(rig);
const solar = createSolarMarkers(space, TEX, now);
space.scene.add(solar.group);

const POLE = V3(0, 1, 0);
const HUB_EARTH = V3(0, -1.25e7, -1.55e7);                // where Earth's centre sits in front of you (metres)
let hubQ = null;
function enterHub() {
  space.setDate(now);
  hubQ = alignFrames(space.sunCel, POLE, V3(0.85, 0.35, 0.4).normalize(), V3(0, 1, 0));
  space.setFrame(hubQ);
  space.obs.copy(HUB_EARTH).negate().applyQuaternion(hubQ.clone().invert());
  solar.group.visible = true;
}
enterHub();

// UI root that follows where the user is facing when it is (re)placed
const uiRoot = new THREE.Group(); space.scene.add(uiRoot);
function placeUI(root, dist = 0) {
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  camera.getWorldPosition(p); camera.getWorldDirection(d);
  d.y = 0; if (d.lengthSq() < 1e-4) d.set(0, 0, -1); d.normalize();
  root.position.set(p.x, rig.position.y, p.z).addScaledVector(d, dist);
  root.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
}
const headForward = () => { const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; if (d.lengthSq() < 1e-4) d.set(0, 0, -1); return d.normalize(); };

// ------------------------------------------------------------------ hub
const hub = new THREE.Group(); uiRoot.add(hub);
let logoImg = null;
const title = new Panel(1.8, 0.46, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const H = h; ctx.save(); ctx.translate(0, H * 0.3); h = H * 0.7;   // top 30% reserved for an approved logo
  if (logoImg) { const lh = H * 0.22, lw = lh * logoImg.width / logoImg.height; ctx.drawImage(logoImg, w / 2 - lw / 2, -H * 0.15 - lh / 2, lw, lh); }
  ctx.fillStyle = THEME.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = `800 ${h * 0.24}px ${FONT}`; ctx.letterSpacing = '12px';
  ctx.fillText('ABANDONED BUT NOT FORGOTTEN', w / 2, h * 0.12);
  ctx.letterSpacing = '4px';
  ctx.fillStyle = THEME.text; ctx.font = `400 ${h * 0.13}px ${MONO}`;
  ctx.fillText('THE HARDWARE NASA LEFT ON THE MOON, ON MARS AND BEYOND', w / 2, h * 0.5);
  ctx.fillStyle = THEME.dim; ctx.font = `400 ${h * 0.11}px ${MONO}`;
  ctx.fillText('Choose a story · Look around: the Sun, the Moon and every planet are where they really are today', w / 2, h * 0.74);
  ctx.restore();
});
$('disc').textContent = BRAND.disclaimer;
if (BRAND.logo) {
  const im = new Image();
  im.onload = () => { logoImg = im; title.redraw(); const el = $('logo'); el.src = BRAND.logo; el.alt = BRAND.logoAlt; el.hidden = false; };
  im.src = BRAND.logo;
}
title.position.set(0, 2.22, -2.6); hub.add(title);

const cards = MISSIONS.map((m, i) => {
  const p = new Panel(0.5, 0.7, (ctx, w, h, s) => {
    glass(ctx, w, h, null, 30, s.hover ? 0.9 : 0.72);
    if (s.hover) { ctx.lineWidth = 6; ctx.strokeStyle = THEME.red; ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, 30); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    g.addColorStop(0, hexA(m.color, 0.35)); g.addColorStop(1, hexA(m.color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h * 0.5, [30, 30, 0, 0]); ctx.fill();
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = m.color; ctx.font = `500 ${w * 0.055}px ${MONO}`; ctx.fillText('MISSION 0' + (i + 1), 36, 40);
    ctx.fillStyle = '#ffffff'; ctx.font = `800 ${w * 0.2}px ${FONT}`; ctx.fillText(m.year, 32, 90);
    ctx.font = `700 ${w * 0.095}px ${FONT}`; let y = drawText(ctx, m.name, 36, h * 0.47, w - 72, w * 0.11);
    ctx.fillStyle = THEME.dim; ctx.font = `400 ${w * 0.05}px ${MONO}`;
    y = drawText(ctx, (m.dest + ' · ' + m.site).toUpperCase(), 36, y + 14, w - 72, w * 0.07);
    const live = m.status[1];
    ctx.font = `500 ${w * 0.045}px ${MONO}`;
    const tw = ctx.measureText(m.status[0]).width;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(36, h - 110, tw + 80, 60, 30); ctx.stroke();
    ctx.fillStyle = live ? '#5bff9c' : '#7a86a8'; ctx.beginPath(); ctx.arc(68, h - 80, 10, 0, 7); ctx.fill();
    ctx.fillStyle = THEME.ink; ctx.textBaseline = 'middle'; ctx.fillText(m.status[0], 92, h - 78);
  }, { onSelect: () => launch(i) });
  const a = (i - (MISSIONS.length - 1) / 2) * 0.29;
  p.position.set(Math.sin(a) * 2.4, 1.38, -Math.cos(a) * 2.4);
  p.rotation.y = -a;
  p.userData.base = p.position.clone();
  hub.add(p);
  return p;
});
const hubHelp = new Panel(1.3, 0.12, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = THEME.faint; ctx.font = `400 ${h * 0.26}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('VR: point + trigger (or pinch)  ·  Screen: click, drag to look  ·  M: sound', w / 2, h / 2);
});
hubHelp.position.set(0, 0.88, -2.3); hubHelp.rotation.x = -0.35; hub.add(hubHelp);

// ------------------------------------------------------------------ flight UI: big story text on the sides
const flight = new THREE.Group(); flight.visible = false; uiRoot.add(flight);
let cur = null;
function storyPanel(side) {
  const p = new Panel(1.3, 0.66, (ctx, w, h, s) => {
    ctx.clearRect(0, 0, w, h);
    if (!cur || s.i < 0) return;
    const c = cur.chapters[s.i];
    const right = side > 0;
    // soft backing so text reads against stars, Sun and Earth
    const g = ctx.createLinearGradient(right ? w : 0, 0, right ? 0 : w, 0);
    g.addColorStop(0, 'rgba(2,6,18,0.78)'); g.addColorStop(0.75, 'rgba(2,6,18,0.45)'); g.addColorStop(1, 'rgba(2,6,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cur.color; ctx.fillRect(right ? w - 10 : 0, h * 0.1, 10, h * 0.8);
    const L = right ? w - 60 : 60, W = w * 0.82;
    ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.font = `800 ${h * 0.42}px ${FONT}`;
    ctx.fillText(String(s.i + 1).padStart(2, '0'), right ? 60 + ctx.measureText('00').width : w - 40, h * 0.04);
    ctx.fillStyle = cur.color; ctx.font = `500 ${h * 0.06}px ${MONO}`; ctx.letterSpacing = '6px';
    ctx.fillText(c[0].toUpperCase(), L, h * 0.12); ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff'; ctx.font = `800 ${h * 0.14}px ${FONT}`;
    const y = drawText(ctx, c[1], L, h * 0.22, W, h * 0.15);
    ctx.fillStyle = THEME.text; ctx.font = `400 ${h * 0.068}px ${BODY}`;
    drawText(ctx, c[2], L, y + h * 0.04, W, h * 0.095);
    ctx.fillStyle = THEME.faint; ctx.font = `400 ${h * 0.042}px ${MONO}`;
    ctx.fillText(`${s.i + 1} / ${cur.chapters.length}  ·  TRIGGER / CLICK / SPACE FOR NEXT`, L, h * 0.88);
  }, { state: { i: -1 }, renderOrder: 14 });
  const a = side * 0.52;
  p.userData.home = V3(Math.sin(a) * 2.35, 1.66, -Math.cos(a) * 2.35);
  p.userData.out = V3(Math.sin(a) * 2.35 + side * 0.45, 1.66, -Math.cos(a) * 2.35);
  p.rotation.y = -a; p.position.copy(p.userData.home);
  p.userData.vis = 0; p.material.opacity = 0;
  flight.add(p);
  return p;
}
const storyL = storyPanel(-1), storyR = storyPanel(1);
let storyIndex = -1;
function showChapter(i) {
  if (i === storyIndex) return;
  storyIndex = i;
  const p = i % 2 ? storyR : storyL, o = i % 2 ? storyL : storyR;
  p.set({ i }); p.userData.target = 1; p.userData.vis = 0; o.userData.target = 0;
}

const hud = new Panel(1.25, 0.24, (ctx, w, h, s) => {
  if (!cur) return;
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'top';
  ctx.fillStyle = THEME.ink; ctx.font = `700 ${h * 0.14}px ${FONT}`; ctx.textAlign = 'center'; ctx.letterSpacing = '8px';
  ctx.fillText(s.title || (cur.name + '  →  ' + cur.dest).toUpperCase(), w / 2, 6); ctx.letterSpacing = '0px';
  const y = h * 0.42;
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(40, y, w - 80, 5);
  const fx = 40 + (w - 80) * s.p;
  const g = ctx.createLinearGradient(40, 0, fx, 0); g.addColorStop(0, hexA(THEME.red, 0)); g.addColorStop(1, THEME.red);
  ctx.fillStyle = g; ctx.fillRect(40, y, fx - 40, 5);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, y + 2.5, 9, 0, 7); ctx.fill();
  ctx.font = `400 ${h * 0.1}px ${MONO}`; ctx.fillStyle = THEME.dim;
  ctx.textAlign = 'left'; ctx.fillText(s.left || '', 40, y + 22);
  ctx.textAlign = 'right'; ctx.fillStyle = THEME.ink; ctx.fillText(s.right || '', w - 40, y + 22);
  if (s.clock) { ctx.textAlign = 'center'; ctx.fillStyle = THEME.red; ctx.font = `500 ${h * 0.12}px ${MONO}`; ctx.fillText(s.clock, w / 2, y + 52); }
}, { state: { p: 0 } });
hud.position.set(0, 1.0, -1.9); hud.rotation.x = -0.45; flight.add(hud);
const skipBtn = button('SKIP ▸▸', 0.3, 0.075, THEME.red, () => skipFlight());
skipBtn.position.set(0, 0.82, -1.8); skipBtn.rotation.x = -0.45; flight.add(skipBtn);

// launch event captions (top centre)
const caption = new Panel(1.4, 0.13, (ctx, w, h, s) => {
  ctx.clearRect(0, 0, w, h); if (!s.text) return;
  let fs = h * 0.34; ctx.letterSpacing = '6px'; ctx.font = `500 ${fs}px ${MONO}`;
  while (ctx.measureText(s.text).width > w - 120 && fs > 10) { fs -= 2; ctx.font = `500 ${fs}px ${MONO}`; }
  const tw = ctx.measureText(s.text).width + 90;
  ctx.fillStyle = 'rgba(2,6,18,0.72)'; ctx.beginPath(); ctx.roundRect((w - tw) / 2, 6, tw, h - 12, 12); ctx.fill();
  ctx.fillStyle = THEME.red; ctx.fillRect((w - tw) / 2, 6, 10, h - 12);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.text, w / 2 + 6, h / 2 + 2);
}, { state: { text: '' }, renderOrder: 15 });
caption.position.set(0, 2.25, -2.4); flight.add(caption);

function fmtDist(km) {
  if (km >= 1e9) return (km / 1e9).toFixed(2) + ' billion km';
  if (km >= 1e6) return (km / 1e6).toFixed(1) + ' million km';
  return Math.round(km).toLocaleString('en-US') + ' km';
}
const fmtDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();

// ------------------------------------------------------------------ warp streaks (stars stretching past you)
const WARP_N = 750;
const warpPos = new Float32Array(WARP_N * 6), warpCol = new Float32Array(WARP_N * 6);
const warpSeed = [];
for (let i = 0; i < WARP_N; i++) {
  const a = Math.random() * Math.PI * 2, r = 3 + Math.pow(Math.random(), 0.7) * 55;
  warpSeed.push({ x: Math.cos(a) * r, y: EYE + Math.sin(a) * r * 0.8, z: -Math.random() * 320 + 30, b: 0.4 + Math.random() * 0.6 });
}
const warpGeo = new THREE.BufferGeometry();
warpGeo.setAttribute('position', new THREE.BufferAttribute(warpPos, 3));
warpGeo.setAttribute('color', new THREE.BufferAttribute(warpCol, 3));
const warp = new THREE.LineSegments(warpGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
warp.frustumCulled = false; uiRoot.add(warp);
const warpTint = new THREE.Color(0xbfd4ff);
function updateWarp(dt, amt) {
  const xr = inXR();
  const speed = (xr ? 12 : 25) + amt * (xr ? 380 : 950), len = 0.2 + amt * (xr ? 18 : 45);
  for (let i = 0; i < WARP_N; i++) {
    const s = warpSeed[i];
    s.z += speed * dt;
    if (s.z > 30) { s.z -= 350; }
    const j = i * 6;
    warpPos[j] = s.x; warpPos[j + 1] = s.y; warpPos[j + 2] = s.z;
    warpPos[j + 3] = s.x; warpPos[j + 4] = s.y; warpPos[j + 5] = s.z - len;
    const b = s.b;
    warpCol[j] = warpTint.r * b; warpCol[j + 1] = warpTint.g * b; warpCol[j + 2] = warpTint.b * b;
    warpCol[j + 3] = 0; warpCol[j + 4] = 0; warpCol[j + 5] = 0;
  }
  warpGeo.attributes.position.needsUpdate = true; warpGeo.attributes.color.needsUpdate = true;
  warp.material.opacity += ((amt > 0.001 ? 0.2 + amt * 0.8 : 0) - warp.material.opacity) * Math.min(1, dt * 3);
  warp.visible = warp.material.opacity > 0.01;
}

// ------------------------------------------------------------------ arrival card
const surfUI = new THREE.Group();
let cardPanel = null, backBtn = null, motionControls = null, discovery = null;
function buildCard(m) {
  const c = m.card;
  cardPanel = new Panel(0.95, 1.38, (ctx, w, h) => {
    glass(ctx, w, h, m.color, 34, 0.8);
    const L = 56, W = w - 112;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = m.color; ctx.font = `500 ${w * 0.03}px ${MONO}`; ctx.letterSpacing = '5px'; ctx.fillText(c.tag, L, 60); ctx.letterSpacing = '0px';
    ctx.fillStyle = '#fff'; ctx.font = `800 ${w * 0.085}px ${FONT}`; let y = drawText(ctx, m.name, L, 104, W, w * 0.09);
    ctx.fillStyle = THEME.dim; ctx.font = `400 ${w * 0.034}px ${BODY}`; y = drawText(ctx, c.place, L, y + 6, W, w * 0.045);
    ctx.font = `500 ${w * 0.028}px ${MONO}`; const tw = ctx.measureText(m.status[0]).width;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(L, y + 18, tw + 74, 50, 25); ctx.stroke();
    ctx.fillStyle = m.status[1] ? '#5bff9c' : '#7a86a8'; ctx.beginPath(); ctx.arc(L + 28, y + 43, 9, 0, 7); ctx.fill();
    ctx.fillStyle = THEME.ink; ctx.textBaseline = 'middle'; ctx.fillText(m.status[0], L + 50, y + 44); ctx.textBaseline = 'top';
    y += 100;
    for (const [k, v] of c.facts) {
      ctx.fillStyle = THEME.dim; ctx.font = `400 ${w * 0.024}px ${MONO}`; ctx.fillText(k.toUpperCase(), L, y + 6);
      ctx.fillStyle = THEME.ink; ctx.font = `400 ${w * 0.032}px ${BODY}`; y = drawText(ctx, v, L + W * 0.3, y, W * 0.7, w * 0.042) + 10;
    }
    const sec = (head, body) => {
      y += 18; ctx.fillStyle = m.color; ctx.font = `500 ${w * 0.026}px ${MONO}`; ctx.letterSpacing = '5px'; ctx.fillText(head, L, y); ctx.letterSpacing = '0px';
      ctx.fillStyle = THEME.text; ctx.font = `400 ${w * 0.032}px ${BODY}`; y = drawText(ctx, body, L, y + 40, W, w * 0.046);
    };
    sec('WHAT IT DISCOVERED', c.sci);
    sec('DID YOU KNOW?', c.fun);
    if (c.plaque) sec('THE PLAQUE ON ITS LEG', c.plaque);
    if (m.id === 'voyager') sec('TRY THIS', 'Look at the Sun or at Earth for two seconds (or point at the label) to fly there.');
  });
  backBtn = button('◂  BACK TO ORBIT', 0.5, 0.09, THEME.red, () => goHome());
  cardPanel.position.set(0, 1.5, 0); backBtn.position.set(0, 0.74, 0.02);
  const holder = new THREE.Group(); holder.add(cardPanel, backBtn);
  surfUI.clear(); surfUI.add(holder);
  holder.position.set(-1.35, 0, -1.75); holder.rotation.y = 0.62;
}

// trip UI (Voyager -> Sun / Earth)
const tripUI = new THREE.Group(); tripUI.visible = false; uiRoot.add(tripUI);
let tripCard = null;
const tripBack = button('◂  BACK TO VOYAGER 1', 0.56, 0.09, THEME.red, () => backToVoyager());
const tripHome = button('BACK TO ORBIT', 0.42, 0.09, THEME.red, () => goHome());
tripBack.position.set(-0.3, 0.62, -1.7); tripHome.position.set(0.3, 0.62, -1.7);
tripBack.rotation.x = tripHome.rotation.x = -0.4;
tripUI.add(tripBack, tripHome);
const TRIP_FACTS = {
  sun: ['THE SUN', 'Our star', ['1.39 million km across: 109 Earths would fit side by side.', 'At the November 2026 distance, sunlight takes about 24 hours to reach Voyager 1 and 8 minutes to reach Earth.', 'Voyager 1 left the Sun’s bubble of wind in 2012, but it still has about 300 years to go before it reaches the Oort Cloud, the icy edge of the solar system.']],
  earth: ['EARTH', 'Home', ['Seen from Voyager 1 it is far smaller than a pixel: the Pale Blue Dot.', 'Every person who ever lived, lived here.', 'At the November 2026 distance, a radio signal from Voyager 1 takes about a day to reach Earth.']],
};
function buildTripCard(kind) {
  if (tripCard) { tripUI.remove(tripCard); tripCard.dispose(); }
  const [t1, t2, lines] = TRIP_FACTS[kind];
  tripCard = new Panel(1.1, 0.62, (ctx, w, h) => {
    glass(ctx, w, h, kind === 'sun' ? '#ffb347' : '#5ea8ff', 30, 0.75);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.dim; ctx.font = `500 ${h * 0.05}px ${MONO}`; ctx.letterSpacing = '6px'; ctx.fillText('FROM VOYAGER 1 · ' + t2.toUpperCase(), 50, 52); ctx.letterSpacing = '0px';
    ctx.fillStyle = '#fff'; ctx.font = `800 ${h * 0.13}px ${FONT}`; ctx.fillText(t1, 46, 96);
    let y = 200; ctx.fillStyle = THEME.text; ctx.font = `400 ${h * 0.055}px ${BODY}`;
    for (const l of lines) y = drawText(ctx, '·  ' + l, 50, y, w - 100, h * 0.078) + 14;
  });
  tripCard.position.set(0, 0.98, -1.95); tripCard.rotation.x = -0.32; tripUI.add(tripCard);   // below the Sun / Earth, not in front of it
}

// ------------------------------------------------------------------ interaction (mouse, touch, any XR controller, hands, gaze)
const ray = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(9, 9);
let interactive = [];
function setInteractive(list) { interactive = list.filter(Boolean); }
setInteractive(cards);

const controllers = [];
const ctrlFactory = new XRControllerModelFactory();
const handFactory = new XRHandModelFactory();
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(), V3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  line.scale.z = 3; c.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  c.add(dot); c.userData = { line, dot, hover: null, mode: 'tracked-pointer' };
  c.addEventListener('connected', (e) => { c.userData.mode = e.data.targetRayMode; c.userData.gamepad = e.data.gamepad; line.visible = dot.visible = e.data.targetRayMode === 'tracked-pointer'; });
  c.addEventListener('disconnected', () => { c.userData.gamepad = null; });
  c.addEventListener('select', () => onSelect(c));
  rig.add(c); controllers.push(c);
  const grip = renderer.xr.getControllerGrip(i); grip.add(ctrlFactory.createControllerModel(grip)); rig.add(grip);
  const hand = renderer.xr.getHand(i); hand.add(handFactory.createHandModel(hand, 'mesh')); rig.add(hand);
}
function castFrom(obj) {
  obj.updateMatrixWorld(true);
  ray.ray.origin.setFromMatrixPosition(obj.matrixWorld);
  ray.ray.direction.set(0, 0, -1).transformDirection(obj.matrixWorld);
}
function isShown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return o.material.opacity > 0.3; }
function hitTest() {
  const hits = ray.intersectObjects(interactive.filter((o) => isShown(o)), false);
  if (hits.length) return { panel: hits[0].object, dist: hits[0].distance };
  if (phase === 'surface' && !busy && discovery) {
    const hit = discovery.hitTest(ray);
    if (hit) return { equipment: true, dist: hit.distance };
  }
  if (surface && surface.teleport && world === surface.scene) {
    const g = ray.intersectObject(surface.teleport, false)[0];
    if (g && g.distance < 45) return { ground: g.point, dist: g.distance };
  }
  return null;
}
function onSelect(src) {
  initAudio();
  if (busy) return;
  if (src === 'mouse') ray.setFromCamera(pointerNDC, camera); else castFrom(src);
  const h = hitTest();
  if (h && h.panel) return h.panel.onSelect && h.panel.onSelect();
  if (h && h.equipment) return discovery.show();
  if (h && h.ground && phase === 'surface') return teleport(h.ground);
  if (phase === 'cruise') nextChapter();
}

let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { initAudio(); drag = { x: e.clientX, y: e.clientY, moved: 0, yaw: lookYaw, pitch: lookPitch }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', (e) => {
  pointerNDC.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
  lookYaw = drag.yaw + dx * 0.0042; lookPitch = Math.max(-1.45, Math.min(1.45, drag.pitch + dy * 0.0042));
});
renderer.domElement.addEventListener('pointerup', (e) => { if (drag && drag.moved < 6) { pointerNDC.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); onSelect('mouse'); } drag = null; });
renderer.domElement.addEventListener('pointercancel', () => { drag = null; });
const keys = {};
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
  if (e.code === 'Escape' && discovery?.isOpen) { e.preventDefault(); discovery.close(); return; }
  if (e.code === 'KeyE' && phase === 'surface' && !busy && !e.repeat) { e.preventDefault(); discovery?.show(); return; }
  if (e.target.closest?.('button,a')) return;
  keys[e.code] = true;
  if ((e.code === 'Space' || e.code === 'Enter') && phase === 'cruise') nextChapter();
  if (e.code === 'KeyM') { const m = toggleMute(); $('mute').textContent = m ? 'SOUND OFF' : 'SOUND ON'; }
  if (e.code === 'Escape' && (phase === 'surface' || phase === 'cruise' || phase === 'ascent' || phase === 'tripHere')) goHome();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
$('mute').onclick = () => { initAudio(); const m = toggleMute(); $('mute').textContent = m ? 'SOUND OFF' : 'SOUND ON'; };

function teleport(p) {
  const head = new THREE.Vector3(); camera.getWorldPosition(head);
  const off = head.sub(rig.position); off.y = 0;
  fadeTo(1, 8).then(() => { rig.position.set(p.x - off.x, surface.heightAt(p.x - off.x, p.z - off.z), p.z - off.z); fadeTo(0, 5); });
}

// ------------------------------------------------------------------ the story state machine
let phase = 'hub', phaseT = 0, sel = -1, busy = false;
let flightPlan = null, vehicle = null, launchCtl = null, ascentRoot = null;
const fill = new THREE.DirectionalLight(0xc8d4ff, 0); fill.position.set(0.3, 0.6, 1); camera.add(fill); camera.add(fill.target); fill.target.position.set(0, 0, -1);
function dropVehicle() { if (vehicle && vehicle.parent) vehicle.parent.remove(vehicle); vehicle = null; }
function dropAscent() { if (ascentRoot) { uiRoot.remove(ascentRoot); ascentRoot = null; } launchCtl = null; }

const CAPE = { lat: 28.5, lon: -80.6 };
const ROCKET_DIR = V3(-0.5, 0.36, -0.79).normalize();    // the rocket climbs ahead of you, crossing to the left

function launch(i) {
  if (phase !== 'hub' || busy) return;
  initAudio();
  sel = i; cur = MISSIONS[i]; phase = 'depart'; phaseT = 0;
  storyIndex = -1; storyL.userData.target = storyR.userData.target = 0;
  flightPlan = { fwd: headForward() };
}

/** Under a blink: put the viewer 70 km above Cape Canaveral on launch day, next to the real rocket. */
function startAscent() {
  const m = cur;
  hub.visible = false; solar.group.visible = false;
  const date = new Date(m.launch);
  space.setDate(date);
  const launchSite = m.id === 'insight' ? {lat:34.75,lon:-120.62} : CAPE;
  const lat = launchSite.lat * Math.PI / 180, lon = launchSite.lon * Math.PI / 180;
  const site = V3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).applyAxisAngle(POLE, space.earth.rotation.y);
  const east = new THREE.Vector3().crossVectors(POLE, site).normalize();
  placeUI(uiRoot);
  const fwd = headForward();
  space.setFrame(alignFrames(site, east, V3(0, 1, 0), fwd));
  space.obs.copy(site).multiplyScalar(R_EARTH + 70e3);
  flightPlan.fwd = fwd;

  vehicle = buildVehicle(m, MODELS);
  launchCtl = buildLaunch(m, vehicle);
  ascentRoot = new THREE.Group();
  ascentRoot.quaternion.setFromUnitVectors(V3(0, 1, 0), ROCKET_DIR);
  ascentRoot.add(launchCtl.root);
  uiRoot.add(ascentRoot);
  const L = launchCtl.spec.length;
  ascentRoot.position.set(L * 0.26, EYE + L * 0.08, -L * 1.2);
  launchCtl.root.position.y = -L * 0.5;
  launchCtl.onEvent = (e) => {
    caption.set({ text: e.caption });
    if (/SEPARAT|STAGING|DROP|JETTISON|OPENS|FREE|SENT AWAY/.test(e.caption)) { boom(0.8); flash.material.opacity = inXR() ? 0.15 : 0.35; }
  };
  flight.visible = true; hud.visible = true; skipBtn.visible = true; caption.visible = true;
  showChapter(0);
  hud.set({ p: 0, title: `${m.name} · ${launchCtl.spec.name}`.toUpperCase(), left: m.id === 'insight' ? 'LAUNCH · VANDENBERG, CALIFORNIA' : 'LAUNCH · CAPE CANAVERAL, FLORIDA', right: fmtDate(date), clock: '' });
  setInteractive([skipBtn]);
  phase = 'ascent'; phaseT = 0;
}

/** Under a blink: turn the universe so the destination is straight ahead and start the long cruise. */
function startCruise() {
  const m = cur;
  // the spacecraft leaves the rocket behind and flies with you from here on
  const u = vehicle.userData;
  if (u.inner) u.inner.rotation.set(0, 0, 0);
  if (u.csm) { u.csm.rotation.set(0, 0, 0); u.csm.position.y = u.dockY; u.lm.visible = true; }
  vehicle.visible = true;
  dropAscent();
  caption.set({ text: '' });
  const obs = space.obs;
  let dest, Dfinal = 0;
  if (m.body === 'moon') { dest = space.moon.position.clone(); Dfinal = R_MOON * 3.3; }
  else if (m.body === 'mars') { dest = space.mars.position.clone(); Dfinal = R_MARS * 3.2; }
  else if (m.body === 'asteroid') dest = space.obs.clone().add(raDecToVec(85, 10).multiplyScalar(m.distKm * 1000)); // illustrative direction, not Eros ephemeris
  else dest = raDecToVec(257.3, 12.1).multiplyScalar(2.59e13);
  if (Dfinal) {   // arrive on the day side, whatever the phase is today
    const back = obs.clone().sub(dest).normalize();
    dest.addScaledVector(back.multiplyScalar(0.45).add(space.sunCel.clone().multiplyScalar(0.55)).normalize(), Dfinal);
  }
  const dir = dest.clone().sub(obs), D0 = dir.length(); dir.normalize();
  placeUI(uiRoot);
  const fwd = headForward();
  const q = alignFrames(dir, POLE, fwd, V3(0, 1, 0));
  space.setFrame(q);
  const n = m.chapters.length;
  Object.assign(flightPlan, { dir, D0, from: obs.clone(), dest, T: Math.max(30, (n - 1) * 7.5), t: 0, hold: 0 });
  flightPlan.offset = (m.body === 'moon' || m.body === 'mars') ? V3(0, 1, 0).applyQuaternion(q.clone().invert()).multiplyScalar((m.body === 'moon' ? R_MOON : R_MARS) * 1.1) : null;
  u.home = V3(u.distance * 0.36, EYE - u.distance * 0.24, -u.distance);   // below the story text, beside the HUD
  space.update(0, 0);
  const sl = space.sunWorld.clone().applyQuaternion(uiRoot.quaternion.clone().invert());
  u.home.x = Math.abs(u.home.x) * (sl.x > 0 ? -1 : 1);
  vehicle.position.copy(u.home); vehicle.quaternion.identity();
  uiRoot.add(vehicle);
  showChapter(1);
  phase = 'cruise'; phaseT = 0;
}

function nextChapter() {
  if (!cur || phase !== 'cruise') return;
  const fp = flightPlan, n = cur.chapters.length, per = fp.T / (n - 1);
  const nextI = Math.min(n - 2, Math.floor(fp.t / per) + 1);
  fp.t = Math.max(fp.t, nextI * per + 0.01);
}
function skipFlight() {
  if (phase === 'ascent' && !busy) blinkTo(startCruise);
  else if (phase === 'cruise') flightPlan.t = flightPlan.T;
  else if (phase === 'trip') tripPlan.t = tripPlan.T;
}
function blinkTo(fn, out = 3.5, inn = 2.5) {
  if (busy) return; busy = true;
  fadeTo(1, out).then(() => { fn(); busy = false; fadeTo(0, inn); });
}

async function arrive() {
  if (busy) return; busy = true;
  phase = 'arriving';
  await fadeTo(1, 1.2);
  flight.visible = false; tripUI.visible = false;
  dropVehicle(); dropAscent();
  setWarp(0); setRumble(0); setHum(0.25);
  surface = createSurface(cur, { tex: TEX, starTex, models: MODELS });
  enterSurface(true);
  await fadeTo(0, 0.8);
  busy = false;
  if (surface.motion) surface.motion.play();
}
function enterSurface(first) {
  world = surface.scene; world.add(rig); world.add(surfUI);
  if (first) {
    rig.position.copy(surface.start.pos); rig.position.y = surface.heightAt(rig.position.x, rig.position.z);
    rig.rotation.set(0, surface.start.yaw, 0); lookYaw = 0; lookPitch = -0.08;
    buildCard(cur);
    surfUI.position.copy(rig.position); surfUI.rotation.y = rig.rotation.y;
    if (motionControls) motionControls.dispose();
    motionControls = surface.motion ? createMotionControls(surface.motion, cur.name, () => goHome()) : null;
    if (motionControls) surfUI.add(motionControls.root);
    discovery?.dispose();
    discovery = createDiscovery(cur, surface);
    if (discovery) surfUI.add(discovery.root);
  }
  const gazeTargets = surface.gaze || [];
  for (const g of gazeTargets) g.panel.onSelect = () => tripTo(g.kind);
  setInteractive([backBtn, ...(motionControls ? motionControls.interactive : []), ...(discovery ? discovery.interactive : []), ...gazeTargets.map((g) => g.panel)]);
  gaze.kind = null; gaze.t = 0;
  phase = 'surface'; phaseT = 0;
}

async function goHome() {
  if (busy) return; busy = true;
  phase = 'leaving';
  await fadeTo(1, 2);
  dropVehicle(); dropAscent();
  if (motionControls) { motionControls.dispose(); motionControls = null; }
  if (discovery) { discovery.dispose(); discovery = null; }
  if (surface) { surface.motion?.dispose(); surface.scene.remove(rig, surfUI); surface.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); surface = null; }
  flight.visible = false; tripUI.visible = false;
  world = space.scene; world.add(rig);
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.fov = BASE_FOV; camera.updateProjectionMatrix();
  setWarp(0); setRumble(0); setHum(0.2);
  enterHub();
  placeUI(uiRoot);
  hub.visible = true; cards.forEach((c) => { c.material.opacity = 1; c.scale.setScalar(1); c.position.copy(c.userData.base); });
  title.material.opacity = hubHelp.material.opacity = 1;
  setInteractive(cards);
  cur = null; sel = -1; phase = 'hub';
  await fadeTo(0, 1);
  busy = false;
}

// ---- Voyager: look at the Sun or Earth to fly there
const gaze = { kind: null, t: 0 };
const gazeRing = new Panel(0.5, 0.5, (ctx, w, h, s) => {
  ctx.clearRect(0, 0, w, h); if (s.p <= 0) return;
  ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.4, 0, 7); ctx.stroke();
  ctx.strokeStyle = THEME.red; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.4, -Math.PI / 2, -Math.PI / 2 + s.p * Math.PI * 2); ctx.stroke();
}, { state: { p: 0 }, renderOrder: 30 });
gazeRing.material.depthTest = false;
let tripPlan = null;

function tripTo(kind) {
  if (busy || phase !== 'surface') return;
  busy = true; phase = 'tripStart';
  fadeTo(1, 3).then(() => {
    surface.scene.remove(rig, surfUI, gazeRing);
    world = space.scene; world.add(rig);
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
    space.setDate(now); solar.group.visible = false; hub.visible = false;
    const voy = raDecToVec(257.3, 12.1).multiplyScalar(2.59e13);
    space.obs.copy(voy);
    let dest, Dfinal;
    if (kind === 'sun') { dest = space.sunCel.clone().multiplyScalar(space.AU); Dfinal = space.R_SUN * 9; }
    else {
      dest = V3(0, 0, 0); Dfinal = 0;
      const back = voy.clone().normalize();
      dest.addScaledVector(back.multiplyScalar(0.4).add(space.sunCel.clone().multiplyScalar(0.6)).normalize(), 2.6e7);
    }
    const dir = dest.clone().sub(voy), D0 = dir.length(); dir.normalize();
    placeUI(uiRoot);
    space.setFrame(alignFrames(dir, POLE, headForward(), V3(0, 1, 0)));
    tripPlan = { kind, dir, D0, Dfinal, from: voy.clone(), T: 16, t: 0, hold: 0 };
    flight.visible = true; storyL.userData.target = storyR.userData.target = 0; caption.set({ text: '' });
    hud.set({ p: 0, title: kind === 'sun' ? 'VOYAGER 1  →  THE SUN' : 'VOYAGER 1  →  EARTH', left: 'LIGHT DOES THIS TRIP IN ABOUT 24 HOURS', right: '', clock: '' });
    setInteractive([skipBtn]);
    phase = 'trip'; phaseT = 0; busy = false;
    fadeTo(0, 2);
  });
}
function backToVoyager() {
  if (busy) return; busy = true;
  fadeTo(1, 3).then(() => {
    tripUI.visible = false; flight.visible = false;
    space.scene.remove(rig);
    enterSurface(false);
    busy = false; fadeTo(0, 2);
  });
}

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
let snapCool = 0, warpAmt = 0, shake = 0;

function update(dt, t) {
  phaseT += dt;
  const fo = fade.material.opacity;
  fade.material.opacity = fo + Math.sign(fadeTarget - fo) * Math.min(Math.abs(fadeTarget - fo), dt * fadeSpeed);
  fade.visible = fade.material.opacity > 0.001;
  flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.6); flash.visible = flash.material.opacity > 0.001;

  // desktop look + walk (+ camera shake during launch; never in VR)
  if (!inXR()) {
    camera.position.set((Math.random() - .5) * shake * 0.03, EYE + (Math.random() - .5) * shake * 0.03, 0);
    camera.rotation.set(-lookPitch + (Math.random() - .5) * shake * 0.004, -lookYaw + (Math.random() - .5) * shake * 0.004, 0, 'YXZ');
    if (phase === 'surface') {
      const f = new THREE.Vector3(-Math.sin(-lookYaw), 0, -Math.cos(-lookYaw)).applyQuaternion(rig.quaternion);
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const sp = (keys.ShiftLeft ? 6 : 2.2) * dt;
      if (keys.KeyW || keys.ArrowUp) rig.position.addScaledVector(f, sp);
      if (keys.KeyS || keys.ArrowDown) rig.position.addScaledVector(f, -sp);
      if (keys.KeyD || keys.ArrowRight) rig.position.addScaledVector(r, sp);
      if (keys.KeyA || keys.ArrowLeft) rig.position.addScaledVector(r, -sp);
      rig.position.y = surface.heightAt(rig.position.x, rig.position.z);
    }
    const fov = BASE_FOV + warpAmt * 14;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  } else {
    snapCool -= dt;
    for (const c of controllers) {
      const gp = c.userData.gamepad; if (!gp || !gp.axes) continue;
      const x = gp.axes[2] ?? gp.axes[0] ?? 0;
      if (Math.abs(x) > 0.75 && snapCool <= 0) {
        snapCool = 0.35;
        const head = new THREE.Vector3(); camera.getWorldPosition(head);
        const ang = -Math.sign(x) * Math.PI / 6;
        rig.position.sub(head).applyAxisAngle(V3(0, 1, 0), ang).add(head);
        rig.rotation.y += ang;
      }
    }
  }

  // hover
  const pointers = inXR() ? controllers.filter((c) => c.userData.mode === 'tracked-pointer') : ['mouse'];
  const hovered = new Set();
  for (const p of pointers) {
    if (p === 'mouse') ray.setFromCamera(pointerNDC, camera); else castFrom(p);
    const h = hitTest();
    if (h && h.panel) hovered.add(h.panel);
    if (p !== 'mouse') { p.userData.line.scale.z = h ? h.dist : 3; p.userData.dot.position.set(0, 0, -(h ? h.dist : 3)); p.userData.dot.visible = !!h; }
  }
  for (const o of interactive) o.setHover && o.setHover(hovered.has(o));
  renderer.domElement.style.cursor = hovered.size || (!inXR() && hitTest()?.equipment) ? 'pointer' : (drag ? 'grabbing' : 'grab');

  shake *= Math.pow(0.02, dt);
  let targetWarp = 0;

  if (phase === 'hub') {
    for (const c of cards) {
      const k = c.state.hover ? 1.06 : 1;
      c.scale.setScalar(c.scale.x + (k - c.scale.x) * Math.min(1, dt * 8));
      c.position.y = c.userData.base.y + Math.sin(t * 0.8 + c.userData.base.x * 3) * 0.012;
    }
    solar.update(camera);
  }

  if (phase === 'depart') {
    const k = clamp01(phaseT / 1.4);
    cards.forEach((c, i) => {
      if (i === sel) { c.position.lerpVectors(c.userData.base, V3(0, 1.6, -0.9), ease(k)); c.material.opacity = 1 - clamp01((k - 0.5) * 2); }
      else c.material.opacity = 1 - clamp01(k * 2);
    });
    title.material.opacity = hubHelp.material.opacity = 1 - k;
    solar.update(camera);
    if (k >= 1) blinkTo(startAscent, 3, 1.6);
  }

  if (phase === 'ascent' && launchCtl) {
    launchCtl.update(dt);
    const thrust = launchCtl.thrust;
    setRumble(thrust); setHum(0.15);
    shake = Math.max(shake, thrust * 1.2);
    // frame the part of the rocket that is still flying
    const box = launchCtl.activeBox();
    if (!box.isEmpty()) {
      const c = box.getCenter(tmpV), size = box.getSize(tmpV2).length();
      launchCtl.root.worldToLocal(c);
      launchCtl.root.position.y += (-c.y - launchCtl.root.position.y) * Math.min(1, dt * 1.2);
      const L = Math.max(14, size * 0.75);
      const target = V3(L * 0.26, EYE + L * 0.08, -L * 1.2);
      ascentRoot.position.lerp(target, Math.min(1, dt * 0.8));
    }
    // climb away from Earth along the rocket's path
    const v = 2400 + phaseT * 420;
    tmpV.copy(ROCKET_DIR).applyQuaternion(uiRoot.quaternion).applyQuaternion(space.universe.quaternion.clone().invert());
    space.obs.addScaledVector(tmpV, v * dt);
    if (launchCtl.done && !busy) blinkTo(startCruise, 2.5, 2.5);
  }

  if (phase === 'cruise') {
    const fp = flightPlan;
    fp.t = Math.min(fp.T, fp.t + dt);
    const s = fp.t / fp.T;
    const pw = cur.body === 'mars' ? 5 : cur.body === 'moon' ? 3 : 2.2;
    const remaining = fp.D0 * Math.pow(1 - s, pw);
    space.obs.copy(fp.from).addScaledVector(fp.dir, fp.D0 - remaining);
    if (fp.offset) space.obs.addScaledVector(fp.offset, ease(clamp01(s * 1.3)));
    targetWarp = smooth(0.03, 0.16, s) * (1 - smooth(0.8, 0.95, s));
    const n = cur.chapters.length;
    showChapter(Math.min(n - 1, 1 + Math.floor(s * (n - 1) * 0.999)));
    const launchD = new Date(cur.launch), arriveD = cur.arrive ? new Date(cur.arrive) : now;
    const dNow = new Date(launchD.getTime() + (arriveD - launchD) * s);
    const days = Math.floor((dNow - launchD) / 864e5);
    hud.set({ p: s, title: '', left: cur.distLabel.toUpperCase(), right: fmtDist(cur.distKm * s), clock: `${fmtDate(dNow)}  ·  ${days > 800 ? 'YEAR ' + (Math.floor(days / 365.25) + 1) : 'DAY ' + (days + 1)}` });
    setRumble(0); setHum(0.35);
    if (s >= 1) {
      fp.hold += dt;
      if (vehicle) vehicle.position.z -= dt * vehicle.userData.distance * 1.2 * fp.hold * fp.hold;   // it goes on ahead to land
      if (fp.hold > 2.6) arrive();
    }
  }

  if (phase === 'trip' && tripPlan) {
    const tp = tripPlan;
    tp.t = Math.min(tp.T, tp.t + dt);
    const s = tp.t / tp.T;
    const remaining = tp.Dfinal + (tp.D0 - tp.Dfinal) * Math.pow(1 - s, 4.5);
    space.obs.copy(tp.from).addScaledVector(tp.dir, tp.D0 - remaining);
    targetWarp = smooth(0.02, 0.12, s) * (1 - smooth(0.78, 0.95, s));
    hud.set({ p: s, right: fmtDist(remaining / 1000) + ' to go' });
    if (s >= 1) {
      tp.hold += dt;
      if (tp.hold > 1 && !tripUI.visible) { flight.visible = false; buildTripCard(tp.kind); tripUI.visible = true; setInteractive([tripBack, tripHome]); phase = 'tripHere'; }
    }
  }

  // Voyager gaze: look at the Sun or Earth for 2 s
  if (phase === 'surface' && surface && surface.gaze) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    let best = null;
    for (const g of surface.gaze) { const ang = f.angleTo(g.dir); if (ang < 0.09 && (!best || ang < best.ang)) best = { g, ang }; }
    if (best && (gaze.kind === best.g.kind || !gaze.kind)) { gaze.kind = best.g.kind; gaze.t += dt; gaze.dir = best.g.dir; }
    else { gaze.t = Math.max(0, gaze.t - dt * 2); if (gaze.t === 0) gaze.kind = null; }
    const p = clamp01(gaze.t / 2);
    if (Math.abs(gazeRing.state.p - p) > 0.01) gazeRing.set({ p });
    if (gaze.kind) {
      if (!gazeRing.parent) surface.scene.add(gazeRing);
      camera.getWorldPosition(tmpV);
      gazeRing.position.copy(tmpV).addScaledVector(gaze.dir, 30); gazeRing.scale.setScalar(9); gazeRing.lookAt(tmpV);
    }
    if (p >= 1) { gaze.t = 0; tripTo(gaze.kind); }
  }

  // story panels: slide + fade
  for (const sp of [storyL, storyR]) {
    const target = sp.userData.target || 0;
    sp.userData.vis += (target - sp.userData.vis) * Math.min(1, dt * (target ? 2.6 : 4));
    sp.material.opacity = sp.userData.vis;
    sp.position.lerpVectors(sp.userData.out, sp.userData.home, ease(sp.userData.vis));
  }

  warpAmt += (targetWarp - warpAmt) * Math.min(1, dt * 1.5);
  if (world === space.scene) updateWarp(dt, warpAmt);
  setWarp(warpAmt);

  const moving = phase === 'cruise' || phase === 'ascent' || phase === 'trip';
  vignette.material.uniforms.uAmt.value += (((inXR() && moving) ? 0.55 + warpAmt * 0.35 : 0) - vignette.material.uniforms.uAmt.value) * Math.min(1, dt * 2);

  if (vehicle && world === space.scene && phase === 'cruise') {
    const u = vehicle.userData;
    if (!(flightPlan.hold > 0)) {
      vehicle.position.lerp(u.home, Math.min(1, dt * 2));
      vehicle.position.y = u.home.y + Math.sin(t * 0.35) * u.distance * 0.006;
    }
    const inv = uiRoot.quaternion.clone().invert();
    updateVehicle(vehicle, dt, space.sunWorld.clone().applyQuaternion(inv), space.obs.clone().negate().normalize().applyQuaternion(space.universe.quaternion).applyQuaternion(inv));
  }
  fill.intensity += ((world === space.scene && (phase === 'cruise' || phase === 'ascent') ? 0.9 : 0) - fill.intensity) * Math.min(1, dt * 2);
  if (world === space.scene) space.update(dt, t);
  if (surface && world === surface.scene) {
    surface.update(dt, t, camera);
    discovery?.update(dt, inXR(), phase === 'surface' && !busy, camera);
    if (motionControls) {
      motionControls.update(inXR(), phase === 'surface' && !busy && !discovery?.isOpen);
    }
    cardPanel.parent.visible = !surface.motion?.state.active && !discovery?.isOpen;
    camera.getWorldPosition(tmpV);
    for (const l of surface.labels) l.lookAt(tmpV.x, l.position.y, tmpV.z);
  }
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  update(dt, t);
  if (inXR()) renderer.render(world, camera);
  else { renderPass.scene = world; composer.render(); }
});

// ------------------------------------------------------------------ start screen
renderer.xr.addEventListener('sessionstart', () => { initAudio(); document.body.classList.add('in-vr'); $('loader').classList.add('gone'); fadeTo(0, 0.8); setTimeout(() => placeUI(uiRoot), 300); });
renderer.xr.addEventListener('sessionend', () => { document.body.classList.remove('in-vr'); placeUI(uiRoot); });
const vrBtn = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] });
vrBtn.id = 'vrbutton';
$('vrslot').appendChild(vrBtn);
$('loader').classList.add('ready');
$('begin').onclick = () => { initAudio(); setHum(0.2); $('loader').classList.add('gone'); fadeTo(0, 0.6); };
placeUI(uiRoot);

// Shortcuts for demos and testing:  ?start  ?go=eagle  ?fly=voyager&t=seconds  ?trip=sun|earth  ?yaw=deg&pitch=deg
const qp = new URLSearchParams(location.search);
if (qp.has('start') || qp.has('go') || qp.has('fly')) { $('loader').classList.add('gone'); fadeTo(0, 3); }
const applyLook = () => { if (qp.has('yaw')) lookYaw = +qp.get('yaw') * Math.PI / 180; if (qp.has('pitch')) lookPitch = -qp.get('pitch') * Math.PI / 180; };
applyLook();
const qi = MISSIONS.findIndex((m) => m.id === (qp.get('go') || qp.get('fly')));
if (qi >= 0 && qp.has('go')) { cur = MISSIONS[qi]; sel = qi; arrive().then(() => { applyLook(); if (surface.motion && qp.has('motion')) surface.motion.seek(Number(qp.get('motion'))); if (qp.get('trip')) { phase = 'surface'; tripTo(qp.get('trip')); } }); }
if (qi >= 0 && qp.has('fly')) {
  launch(qi);
  const tt = +(qp.get('t') || 0);
  if (tt) {
    // fast-forward: first through the launch, then into the cruise
    const w = () => {
      if (phase === 'ascent' && launchCtl) {
        const dur = launchCtl.spec.duration, adv = Math.min(tt, dur - 0.3);
        for (let k = 0; k < adv * 30; k++) launchCtl.update(1 / 30);
        if (tt > dur) { skipFlight(); setTimeout(w, 100); }
        return;
      }
      if (phase === 'cruise') { flightPlan.t = Math.min(flightPlan.T, tt - 25); return; }
      setTimeout(w, 100);
    };
    w();
  }
}
window.__app = { MISSIONS, launch, goHome, space, camera, renderer, rig, tripTo, skip: () => skipFlight(), get phase() { return phase; }, get vehicle() { return vehicle; }, get surface() { return surface; }, get launchCtl() { return launchCtl; } };

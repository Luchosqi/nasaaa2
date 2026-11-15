// The solar system around the orbit hub: every planet in its real direction today (approximate circular
// orbits), the Moon and the Sun labelled, and the ecliptic drawn as a faint line. Planets are far too
// small to see at true size, so they are drawn ENLARGED (the label says by how much) but in the right place.
import * as THREE from 'three';
import { raDecToVec, eclToRaDec, julian } from './astro.js';
import { Panel, plate, FONT, MONO, THEME } from './ui.js';

const D = 900;                      // drawing distance (m). Direction is all that matters for things this far away.
const AU_KM = 1.496e8;
const PLANETS = [
  // name, texture, true radius (km), a (AU), mean longitude at J2000 (deg), deg/day, drawn angular radius (deg)
  ['Mercury', 'mercury', 2440, 0.387, 252.25, 4.09233445, 0.45],
  ['Venus', 'venus', 6052, 0.723, 181.98, 1.60213034, 0.7],
  ['Mars', 'mars', 3390, 1.524, 355.45, 0.52403840, 0.6],
  ['Jupiter', 'jupiter', 69911, 5.203, 34.40, 0.08308676, 1.5],
  ['Saturn', 'saturn', 58232, 9.537, 49.94, 0.03344414, 1.2],
  ['Uranus', 'uranus', 25362, 19.19, 313.23, 0.01172834, 0.8],
  ['Neptune', 'neptune', 24622, 30.07, 304.88, 0.00598103, 0.8],
];

function helio(L0, rate, a, d) { const L = (L0 + rate * d) * Math.PI / 180; return new THREE.Vector2(a * Math.cos(L), a * Math.sin(L)); }

function tag(title, sub, note, color) {
  const p = new Panel(1.0, 0.3, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    // backing sized to the widest line, so labels read over Earth, the Sun and the Milky Way
    ctx.font = `700 ${H * 0.27}px ${FONT}`; let bw = ctx.measureText(title).width;
    ctx.font = `400 ${H * 0.15}px ${MONO}`; bw = Math.max(bw, ctx.measureText(sub).width);
    if (note) { ctx.font = `400 ${H * 0.12}px ${MONO}`; bw = Math.max(bw, ctx.measureText(note).width); }
    bw = Math.min(W - 8, bw + 60);
    plate(ctx, (W - bw) / 2, 0, bw, note ? H * 0.88 : H * 0.7, 18, 0.66);
    ctx.fillStyle = color; ctx.fillRect(W / 2 - 40, 4, 80, 6);
    ctx.fillStyle = '#ffffff'; ctx.font = `700 ${H * 0.27}px ${FONT}`; ctx.fillText(title, W / 2, H * 0.12);
    ctx.fillStyle = THEME.dim; ctx.font = `400 ${H * 0.15}px ${MONO}`; ctx.fillText(sub, W / 2, H * 0.48);
    if (note) { ctx.fillStyle = THEME.faint; ctx.font = `400 ${H * 0.12}px ${MONO}`; ctx.fillText(note, W / 2, H * 0.7); }
  });
  p.material.depthTest = false; p.renderOrder = 20;
  return p;
}

export function createSolarMarkers(space, tex, date = new Date()) {
  const group = new THREE.Group();
  const labels = [];
  const d = julian(date) - 2451545.0;
  // Earth (heliocentric) from the Sun's geocentric longitude
  const g = (357.528 + 0.9856003 * d) * Math.PI / 180;
  const sunLon = (280.460 + 0.9856474 * d + 1.915 * Math.sin(g)) * Math.PI / 180;
  const E = new THREE.Vector2(-Math.cos(sunLon), -Math.sin(sunLon));

  for (const [name, key, rKm, a, L0, rate, angDeg] of PLANETS) {
    const P = helio(L0, rate, a, d), G = P.clone().sub(E);
    const lon = Math.atan2(G.y, G.x) * 180 / Math.PI, distAU = G.length();
    const rd = eclToRaDec(lon, 0, julian(date));
    const dir = raDecToVec(rd.ra, rd.dec);
    const r = D * Math.tan(angDeg * Math.PI / 180);
    const mat = new THREE.MeshStandardMaterial({ map: tex[key], roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: tex[key], emissiveIntensity: 0.22 });   // a little self-light so the night side still reads
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), mat);
    m.position.copy(dir).multiplyScalar(D);
    group.add(m);
    if (key === 'saturn' && tex.saturnRing) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.24, r * 2.27, 96, 1), new THREE.MeshStandardMaterial({ map: tex.saturnRing, alphaMap: tex.saturnRing, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
      // ring texture is radial: remap UVs so u runs from inner to outer edge
      const uv = ring.geometry.attributes.uv, pos = ring.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < uv.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - r * 1.24) / (r * 1.03), 0.5); }
      ring.rotation.x = -Math.PI / 2 + 0.47; m.add(ring);
    }
    const realDeg = Math.atan(rKm / (distAU * AU_KM)) * 180 / Math.PI;
    const k = Math.round(angDeg / realDeg);
    const lb = tag(name.toUpperCase(), `${distAU < 2 ? (distAU * AU_KM / 1e6).toFixed(0) + ' million km' : (distAU * AU_KM / 1e9).toFixed(2) + ' billion km'}`, `drawn ${k.toLocaleString('en-US')}× bigger`, '#9AA5BB');
    lb.position.copy(dir).multiplyScalar(D * 0.98); lb.userData.dir = dir; lb.userData.off = r + 30;
    lb.scale.setScalar(115); group.add(lb); labels.push(lb);
  }

  // The ecliptic: the plane the planets (and the Sun) travel along
  const pts = [];
  for (let i = 0; i <= 360; i += 2) { const rd = eclToRaDec(i, 0, julian(date)); pts.push(raDecToVec(rd.ra, rd.dec).multiplyScalar(D * 1.01)); }
  const ecl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fa6d8, transparent: true, opacity: 0.18, depthWrite: false }));
  group.add(ecl);

  // Sun and Moon tags (the bodies themselves are the real ones in the space scene)
  const sunTag = tag('THE SUN', '150 million km', 'never look at it directly', THEME.red);
  sunTag.scale.setScalar(140); group.add(sunTag); labels.push(sunTag);
  const moonTag = tag('THE MOON', '384,400 km', 'true size', '#ffffff');
  moonTag.scale.setScalar(115); group.add(moonTag); labels.push(moonTag);

  const tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    group, labels,
    update(camera) {
      group.quaternion.copy(space.universe.quaternion);
      q.copy(group.quaternion).invert();
      // Sun & Moon: directions from where we are, back into the group's (celestial) frame
      sunTag.userData.anchor = space.sunCel.clone().multiplyScalar(D * 0.98); sunTag.userData.off = 75;
      moonTag.userData.anchor = tmp.copy(space.moon.position).sub(space.obs).normalize().multiplyScalar(D * 0.98).clone(); moonTag.userData.off = 30;
      const cam = camera.getWorldPosition(new THREE.Vector3());
      const down = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
      for (const l of labels) {
        // sit just below its object (screen-down), facing the viewer
        if (!l.userData.anchor) l.userData.anchor = l.position.clone();
        l.position.copy(l.userData.anchor).addScaledVector(down, l.userData.off || 0);
        l.lookAt(cam);
      }
    },
  };
}

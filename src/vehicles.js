// The spacecraft that actually made each trip, flying alongside you during the cruise.
//   Apollo 11  -> Columbia (Command/Service Module) docked to Eagle, in "barbecue roll"
//   Sojourner  -> Mars Pathfinder cruise stage + aeroshell (spin-stabilised, ~2 rpm)
//   Opportunity-> MER-B cruise stage + aeroshell (spin-stabilised, ~2 rpm)
//   Ingenuity  -> Mars 2020 cruise stage + aeroshell, carrying Perseverance and Ingenuity (~2 rpm)
//   Voyager 1  -> Voyager 1 itself (3-axis stabilised, dish pointed back at Earth)
import * as THREE from 'three';

const std = (color, rough = 0.5, metal = 0.0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function cellTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1f2a'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = 30 + ((i * 7 + j * 13) % 9) * 3;
    x.fillStyle = `rgb(${v * 0.45},${v * 0.6},${v * 1.5})`; x.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function radiatorTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#e9e9e6'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#cfcfcc';
  for (let i = 0; i < 512; i += 16) x.fillRect(i, 0, 3, 256);
  x.fillStyle = '#b8b8b4'; x.fillRect(0, 60, 512, 4); x.fillRect(0, 190, 512, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Apollo Command/Service Module "Columbia" docked nose-to-nose with the full Lunar Module "Eagle". Long axis = +Y.
 *  userData.csm is the CSM group, pivoting at the docking point, so the launch sequence can play the real
 *  "transposition and docking": CSM separates, turns 180°, docks with Eagle and pulls it out of the rocket. */
function apolloStack(lmModel) {
  const g = new THREE.Group();
  const lm = lmModel.clone(true);
  const b = new THREE.Box3().setFromObject(lm), s = b.getSize(new THREE.Vector3());
  lm.scale.multiplyScalar(7.04 / s.y);
  const b2 = new THREE.Box3().setFromObject(lm), c = b2.getCenter(new THREE.Vector3());
  lm.position.set(-c.x, -b2.min.y, -c.z);
  const lmG = new THREE.Group(); lmG.add(lm); g.add(lmG);
  const top = 7.04 - 0.15;

  const cmMat = std(0xd9dde3, 0.22, 1.0);           // the CM's outer skin was polished aluminised Mylar
  const smMat = std(0xffffff, 0.55, 0.15, { map: radiatorTex() });
  const dark = std(0x2a2a2a, 0.6, 0.4);
  const csm = new THREE.Group(); csm.position.y = top; g.add(csm);   // origin = docking point, body extends along +Y

  const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.95, 3.2, 48, 1), cmMat);
  cm.position.y = 1.6; cm.rotation.x = Math.PI; csm.add(cm);
  const heat = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.9, 0.25, 48), std(0x6b5a46, 0.8, 0.1)); heat.position.y = 3.32; csm.add(heat);
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.5, 12), dark); probe.position.y = 0.05; csm.add(probe);
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 7.5, 48, 1, true), smMat);
  sm.position.y = 3.45 + 3.75; csm.add(sm);
  const smCap = new THREE.Mesh(new THREE.CircleGeometry(1.95, 48), std(0x9a9a96, 0.6, 0.6)); smCap.rotation.x = -Math.PI / 2; smCap.position.y = 3.45 + 7.5; csm.add(smCap);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.3), std(0xdedcd6, 0.5, 0.2));
    q.position.set(Math.cos(a) * 2.05, 4.6, Math.sin(a) * 2.05); q.rotation.y = -a; csm.add(q);
  }
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.25, 2.9, 40, 1, true), std(0x2b2724, 0.45, 0.85, { side: THREE.DoubleSide }));
  bell.position.y = 3.45 + 7.5 + 1.45; csm.add(bell);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), dark);
  boom.rotation.z = Math.PI / 2; boom.position.set(2.7, 10.6, 0); csm.add(boom);
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 4), std(0xe8e8e8, 0.4, 0.3, { side: THREE.DoubleSide }));
    d.position.set(3.4 + (i % 2) * 0.55, 10.4 + Math.floor(i / 2) * 0.55, 0); d.rotation.z = Math.PI / 2; csm.add(d);
  }
  g.userData = { length: top + 3.45 + 7.5 + 2.9, distance: 34, side: 0, spin: 0.3 * Math.PI / 180, axis: 'roll', csm, lm: lmG, dockY: top, csmLen: 3.45 + 7.5 + 2.9 };
  return g;
}

/** Mars cruise stack: cruise stage (solar cells facing the Sun) on top of a backshell + heat shield. Spin axis = +Y. */
function marsCruise(diameter, opts = {}) {
  const g = new THREE.Group();
  const R = diameter / 2;
  const cells = cellTex(); cells.repeat.set(4, 4);
  // Heat shield: 70° sphere-cone, tan ablator
  const hs = new THREE.Mesh(new THREE.ConeGeometry(R, R * 0.36, 64, 1, true), std(opts.heat ?? 0x8a6a48, 0.85, 0.0, { side: THREE.DoubleSide }));
  hs.rotation.x = Math.PI; hs.position.y = -R * 0.18; g.add(hs);
  // Backshell: truncated cone, white with dark thermal blankets
  const bsH = R * 0.75;
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.48, R * 0.99, bsH, 64, 1, true), std(opts.back ?? 0xe4e2dc, 0.6, 0.15, { side: THREE.DoubleSide }));
  bs.position.y = bsH / 2; g.add(bs);
  const parachute = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.42, R * 0.18, 40), std(0xbdbab2, 0.5, 0.3));
  parachute.position.y = bsH + R * 0.09; g.add(parachute);
  // Cruise stage: a ring/disc a bit wider than the aeroshell, solar cells on top
  const csY = bsH + R * 0.22;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, R * 0.16, 64, 1, true), std(0xc7c5bf, 0.4, 0.7, { side: THREE.DoubleSide }));
  ring.position.y = csY; g.add(ring);
  const panel = new THREE.Mesh(new THREE.RingGeometry(R * 0.34, R * 1.02, 64, 1), std(0xffffff, 0.25, 0.5, { map: cells, side: THREE.DoubleSide }));
  panel.rotation.x = -Math.PI / 2; panel.position.y = csY + R * 0.08; g.add(panel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.34, R * 0.34, R * 0.28, 32), std(0xd6c08a, 0.35, 1.0));
  hub.position.y = csY + R * 0.06; g.add(hub);
  // medium-gain antenna + thrusters
  const mga = new THREE.Mesh(new THREE.ConeGeometry(R * 0.09, R * 0.35, 20, 1, true), std(0xeeeeee, 0.4, 0.3, { side: THREE.DoubleSide }));
  mga.position.set(R * 0.12, csY + R * 0.38, 0); mga.rotation.x = Math.PI; g.add(mga);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const t = new THREE.Mesh(new THREE.ConeGeometry(R * 0.04, R * 0.1, 10), std(0x333333, 0.5, 0.8)); t.position.set(Math.cos(a) * R * 1.05, csY - R * 0.05, Math.sin(a) * R * 1.05); g.add(t); }
  g.userData = { length: R * 2, distance: opts.distance ?? diameter * 2.8, side: opts.side ?? diameter * 0.9, spin: 2 * Math.PI * 2 / 60, axis: 'sun' };
  return g;
}

function voyagerCruise(model) {
  const g = new THREE.Group();
  const v = model.clone(true);
  const b = new THREE.Box3().setFromObject(v), s = b.getSize(new THREE.Vector3());
  v.scale.multiplyScalar(13 / Math.max(s.x, s.y, s.z));
  const c = new THREE.Box3().setFromObject(v).getCenter(new THREE.Vector3()); v.position.sub(c);
  g.add(v);
  g.userData = { length: 13, distance: 22, side: 0, spin: 0, axis: 'earth' };
  return g;
}

export function buildVehicle(mission, models) {
  let g;
  if (mission.id === 'eagle' || mission.id === 'apollo15') g = apolloStack(models.eagle);
  else if (mission.id === 'sojourner') g = marsCruise(2.65, { distance: 11 });
  else if (mission.id === 'opportunity' || mission.id === 'spirit') g = marsCruise(2.65, { distance: 11, back: 0xdad6cc });
  else if (mission.id === 'ingenuity') g = marsCruise(4.5, { distance: 17, heat: 0x7a5a3c });
  else if (mission.id === 'insight') g = marsCruise(2.65, { distance: 12 });
  else if (mission.id === 'near') g = voyagerCruise(models.near);
  else g = voyagerCruise(models.voyager);
  g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  const pivot = new THREE.Group(); pivot.add(g); pivot.userData = { ...g.userData, inner: g };
  return pivot;
}

/**
 * Orient and animate a vehicle each frame.
 * sunDir / earthDir are world-space unit vectors; dt seconds.
 */
export function updateVehicle(v, dt, sunDir, earthDir) {
  const u = v.userData, inner = u.inner;
  const up = new THREE.Vector3(0, 1, 0);
  if (u.axis === 'sun') v.quaternion.setFromUnitVectors(up, sunDir);              // solar cells toward the Sun
  else if (u.axis === 'earth') v.quaternion.setFromUnitVectors(up, earthDir);     // Voyager's dish (+Y) toward Earth
  else {
    // Apollo "passive thermal control": long axis roughly perpendicular to the Sun, slow roll
    const axis = new THREE.Vector3().crossVectors(sunDir, up).normalize();
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    const tilt = new THREE.Quaternion().setFromAxisAngle(up, 0.5);
    v.quaternion.setFromUnitVectors(up, axis.applyQuaternion(tilt));
  }
  if (u.spin) inner.rotateY(u.spin * dt);
}

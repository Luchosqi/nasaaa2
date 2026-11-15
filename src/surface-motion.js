// Historical vignettes, with compressed time and illustrative terrain/routes.
// Source trail is recorded in MOTION_SOURCES.md. This is not trajectory telemetry.
import * as THREE from 'three';
import { createPlayback } from './playback.js';

const clamp = x => Math.max(0, Math.min(1, x));
const progress = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => x * x * (3 - 2 * x);
const mix = (a, b, p) => a + (b - a) * p;
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.15, ...extra });
function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function box(parent, size, color, pos) { return mesh(new THREE.BoxGeometry(...size), material(color), parent, ...pos); }
function rod(parent, a, b, radius = 0.025, color = 0xc9cdd5) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
  const m = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material(color), parent);
  m.position.copy(av.add(bv).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
function model(source, size, axis = 'y') {
  const object = source.clone(true), g = new THREE.Group(); g.add(object);
  const b = new THREE.Box3().setFromObject(object), s = b.getSize(new THREE.Vector3());
  object.scale.multiplyScalar(size / (axis === 'max' ? Math.max(s.x, s.y, s.z) : s[axis]));
  const bb = new THREE.Box3().setFromObject(object), c = bb.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
  object.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}
function plume(parent, radius = 0.3, length = 2) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xb6cfff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = mesh(new THREE.ConeGeometry(radius, length, 16, 1, true), mat, parent, 0, -length / 2, 0);
  m.castShadow = m.receiveShadow = false; return m;
}
function dust(parent, color) {
  const group = new THREE.Group(); parent.add(group);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const m = mesh(new THREE.SphereGeometry(0.55, 8, 5), mat, group, Math.cos(a), 0.08, Math.sin(a));
    m.scale.set(1.7, 0.12, 0.8); m.castShadow = m.receiveShadow = false;
  }
  return { group, set(amount, time) { group.visible = amount > 0.01; group.scale.setScalar(1 + amount * 3); group.rotation.y = time * 0.15; mat.opacity = amount * 0.2; } };
}
function parachute(parent, radius = 2.7) {
  const group = new THREE.Group(); parent.add(group);
  mesh(new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), material(0xf4eee2, { side: THREE.DoubleSide }), group, 0, 4, 0);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rod(group, [0, 0, 0], [Math.cos(a) * radius, 4, Math.sin(a) * radius], 0.012); }
  return group;
}
function airbagLander(parent) {
  const group = new THREE.Group(); parent.add(group);
  const bags = new THREE.Group(); group.add(bags);
  const bagMat = material(0xcbb99a, { roughness: 1 });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    mesh(new THREE.SphereGeometry(0.95, 14, 10), bagMat, bags, Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
  }
  mesh(new THREE.SphereGeometry(1.0, 14, 10), bagMat, bags, 0, 0.5, 0);
  const backshell = new THREE.Group(); backshell.position.y = 3.2; group.add(backshell);
  mesh(new THREE.CylinderGeometry(0.45, 1.15, 0.8, 24), material(0xe2ddd0), backshell);
  const chute = parachute(backshell);
  const thruster = new THREE.Group(); backshell.add(thruster);
  const tethers = new THREE.Group(); group.add(tethers);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, x = Math.cos(a), z = Math.sin(a);
    const jet = new THREE.Group(); jet.position.set(x * 1.1, -0.4, z * 1.1); jet.rotation.set(-z * 0.5, 0, x * 0.5); thruster.add(jet); plume(jet, 0.16, 1.6);
    rod(tethers, [x * 0.5, 0.5, z * 0.5], [x * 0.8, 3, z * 0.8], 0.012);
  }
  return { group, bags, chute, thruster, backshell, tethers };
}
function petals(parent, size = 1) {
  const group = new THREE.Group(); parent.add(group);
  box(group, [size, 0.18, size], 0xc2b8a0, [0, 0.12, 0]);
  const wings = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(), angle = i * Math.PI * 2 / 3;
    const mount = new THREE.Group(); mount.rotation.y = angle; group.add(mount);
    mount.position.set(Math.sin(angle) * size * 0.45, 0.2, Math.cos(angle) * size * 0.45); mount.add(pivot);
    const shape = new THREE.Shape(); shape.moveTo(-size / 2, 0); shape.lineTo(size / 2, 0); shape.lineTo(0, size); shape.closePath();
    const wing = mesh(new THREE.ShapeGeometry(shape), material(0x203153, { side: THREE.DoubleSide }), pivot);
    wing.rotation.x = Math.PI / 2; wings.push(pivot);
  }
  return { group, set(p) { wings.forEach(w => { w.rotation.x = mix(-1.8, 0, p); }); } };
}
// Articulated illustration for MER / Mars 2020: the supplied Opportunity GLB
// is one merged mesh, so its wheels cannot rotate independently.
function rover(parent, large = false) {
  const group = new THREE.Group(); parent.add(group); const wheels = [], r = large ? 0.25 : 0.14;
  const span = large ? 0.9 : 0.48, length = large ? 1.0 : 0.55;
  box(group, [span * 1.6, 0.35, length * 1.55], 0xcfbc8b, [0, r + 0.32, 0]);
  if (!large) box(group, [1.7, 0.035, 1.3], 0x182c4e, [0, 0.72, 0]);
  else box(group, [0.55, 0.45, 0.55], 0x9b9b9a, [0, 0.7, 1]);
  rod(group, [0.25, 0.6, -0.45], [0.25, large ? 1.8 : 1.4, -0.45], 0.045);
  const head = new THREE.Group(); head.position.set(0.25, large ? 1.8 : 1.4, -0.45); group.add(head);
  box(head, [0.45, 0.2, 0.18], 0xd3d3cf, [0, 0, 0]);
  for (const x of [-0.13, 0.13]) mesh(new THREE.SphereGeometry(0.065, 10, 8), material(0x121924), head, x, 0, -0.12);
  for (const side of [-1, 1]) for (const z of [-length, 0, length]) {
    rod(group, [side * span * 0.7, 0.5, 0], [side * span, r, z]);
    const pivot = new THREE.Group(); pivot.position.set(side * span, r, z); group.add(pivot); wheels.push(pivot);
    const w = mesh(new THREE.CylinderGeometry(r, r, r * 0.75, 20), material(0x303235), pivot); w.rotation.z = Math.PI / 2;
    for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; const tread = box(pivot, [r * 0.8, 0.022, 0.04], 0x92969b, [0, Math.cos(a) * r, Math.sin(a) * r]); tread.rotation.x = a; }
  }
  const arm = new THREE.Group(); arm.position.set(-0.35, 0.5, -length * 0.8); group.add(arm);
  rod(arm, [0, 0, 0], [0, -0.15, -0.5]); rod(arm, [0, -0.15, -0.5], [0.1, -0.3, -0.8]);
  box(arm, [0.22, 0.14, 0.18], 0x93999d, [0.1, -0.3, -0.8]);
  return { group, wheels, head, arm, radius: r };
}

export function createSurfaceMotion(mission, out, models, buildSojourner, buildLunarRover) {
  const id = mission.id;
  if (!['eagle', 'apollo15', 'sojourner', 'opportunity', 'ingenuity'].includes(id)) return null;
  const historical = new THREE.Group(); historical.name = 'Historical reconstruction'; out.scene.add(historical);
  // Existing artifacts remain untouched and return at the end of the replay.
  const artifacts = out.artifacts;
  const groundY = out.heightAt(0, -9);
  historical.position.set(0, groundY, -9);
  // Gentle presentation fill keeps small moving mechanisms readable on screen.
  const fill = new THREE.DirectionalLight(0xdde8ff, 0.65);
  fill.position.set(2, 9, 12); historical.add(fill, fill.target);
  const cloud = dust(historical, id === 'eagle' ? 0xa6a19a : 0xc79363);
  let duration, render;

  if (id === 'eagle' || id === 'apollo15') {
    duration = 32;
    const full = model(models.eagle, 7.04); historical.add(full);
    const ascent = model(models.eagle, 7.04); historical.add(ascent);
    const lunarRover = id === 'apollo15' ? buildLunarRover() : null;
    if (lunarRover) historical.add(lunarRover);
    const cut = 7.04 * 0.45, upper = [];
    full.updateMatrixWorld(true); ascent.updateMatrixWorld(true);
    full.traverse(o => { if (o.isMesh && new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).y - groundY > cut) upper.push(o); });
    ascent.traverse(o => { if (o.isMesh && new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).y - groundY <= cut) o.visible = false; });
    const descentFlame = plume(full, 0.5, 2.4), ascentFlame = plume(ascent, 0.3, 2); ascentFlame.position.y += 3.2;
    render = t => {
      const p = ease(progress(t, 0, 12)), lift = progress(t, 22, 30);
      full.position.set(mix(-3, 0, p), 12 * (1 - p), -12 * (1 - p)); full.rotation.z = 0.07 * (1 - p);
      upper.forEach(o => { o.visible = t < 22; });
      descentFlame.visible = t < 12; descentFlame.scale.y = 0.7 + 0.15 * Math.sin(t * 30);
      ascent.visible = t >= 22 && t < 31; ascent.position.set(lift * lift * 3, lift * lift * 24, -lift * lift * 15);
      if (lunarRover) { const drive = ease(progress(t, 16, 21)); lunarRover.visible = t >= 16 && t < 31; lunarRover.position.set(3 + drive * 2, 0, drive * 2); lunarRover.rotation.y = 0.8; (lunarRover.userData.wheels || []).forEach(w => { w.rotation.x = -drive * 6; }); }
      cloud.set(t < 12 ? progress(t, 7, 12) : t < 15 ? 1 - progress(t, 12, 15) : t >= 22 && t < 25 ? 1 - progress(t, 22, 25) : 0, t);
      if (t < 12) return (id === 'apollo15' ? 'JUL 30, 1971 · Falcon descends toward Hadley–Apennine using a rocket engine.' : 'JUL 20, 1969 · Eagle slows its descent with a rocket engine. No parachute: the Moon has no substantial atmosphere.');
      if (t < 17) return 'TOUCHDOWN · The engine stops. Both stages of the lunar module are on the Moon.';
      if (t < 22) return (id === 'apollo15' ? 'TIME JUMP · After exploring the Moon with a rover, Scott and Irwin prepare to leave.' : 'TIME JUMP · After their surface work, Armstrong and Aldrin prepare to leave on July 21.');
      return 'LIFTOFF · Only the ascent stage rises. The descent stage remains on the Moon.';
    };
  } else if (id === 'sojourner' || id === 'opportunity') {
    duration = 40;
    const pack = airbagLander(historical), lander = petals(historical, id === 'sojourner' ? 1 : 1.7);
    const vehicle = id === 'sojourner' ? { group: buildSojourner(), radius: 0.065 } : rover(historical);
    if (id === 'sojourner') historical.add(vehicle.group);
    const homeY = 0.3;
    render = t => {
      const falling = ease(progress(t, 0, 9)), bounce = progress(t, 9, 16), deploy = ease(progress(t, 19, 23)), drive = ease(progress(t, 23, 34));
      pack.group.visible = t < 20; pack.group.position.set(-1.8 * (1 - falling), mix(12, 1, falling) + (t >= 9 ? Math.abs(Math.sin(bounce * Math.PI * 3)) * 2.4 * (1 - bounce) : 0), -12 * (1 - falling));
      pack.bags.rotation.z = t < 9 ? 0 : Math.sin(bounce * Math.PI * 3) * 0.35 * (1 - bounce);
      pack.bags.scale.set(1, 1 - 0.85 * progress(t, 16, 20), 1 + 0.2 * progress(t, 16, 20));
      pack.backshell.visible = t < 8; pack.tethers.visible = t < 8; pack.chute.rotation.z = Math.sin(t) * 0.07; pack.thruster.visible = t >= 6 && t < 8;
      lander.group.visible = t >= 18; lander.set(deploy);
      vehicle.group.visible = t >= 20;
      const dx = drive * 3.3, dz = drive * 2.3, surfaceY = out.heightAt(dx, -9 + dz) - groundY;
      vehicle.group.position.set(dx, mix(homeY, surfaceY, progress(drive, 0, 0.3)), dz);
      vehicle.group.rotation.y = -2.18;
      const wheels = vehicle.wheels || vehicle.group.userData.wheels || [];
      wheels.forEach(w => { w.rotation.x = -drive * 4 / vehicle.radius; });
      if (vehicle.head) vehicle.head.rotation.y = t > 34 ? Math.sin((t - 34) * 0.8) * 0.4 : 0;
      if (vehicle.arm) vehicle.arm.rotation.x = t > 34 ? -0.5 * ease(progress(t, 34, 38)) : 0;
      cloud.set(t > 9 && t < 17 ? Math.abs(Math.sin(bounce * Math.PI * 3)) * (1 - bounce) : 0, t);
      const name = id === 'sojourner' ? 'PATHFINDER · Ares Vallis, 1997' : 'OPPORTUNITY · Eagle Crater, 2004';
      if (t < 6) return name + ' · A parachute slows the lander in the Martian atmosphere.';
      if (t < 9) return 'FINAL DESCENT · Braking rockets slow the airbag-protected lander before release.';
      if (t < 17) return 'BOUNCE LANDING · Inflated airbags cushion repeated impacts. This short replay illustrates the sequence.';
      if (t < 23) return 'DEPLOYMENT · Airbags deflate and the lander petals open. The rover is prepared to drive off.';
      if (t < 34) return 'EXPLORATION · Wheels carry the rover away from its lander. This is an illustrative route, with accelerated motion.';
      return id === 'sojourner' ? 'READING ROCKS · Sojourner used a spectrometer to measure the composition of rocks and soil.' : 'SCIENCE STOP · Opportunity points its cameras and lowers its instrument arm to investigate a rock.';
    };
  } else {
    duration = 48;
    const carrier = rover(historical, true), crane = new THREE.Group(); historical.add(crane);
    box(crane, [2.8, 0.4, 1.7], 0xb49b61, [0, 0, 0]);
    for (const x of [-0.8, 0.8]) {
      const tank = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 16), material(0xbfc4c7), crane, x, 0.32, 0); tank.rotation.x = Math.PI / 2;
      rod(crane, [x, 0, -0.7], [x * 1.8, -0.3, -0.9], 0.07);
      rod(crane, [x, 0, 0.7], [x * 1.8, -0.3, 0.9], 0.07);
    }
    const cables = [], jets = [];
    for (const x of [-1, 1]) {
      for (const z of [-0.6, 0.6]) { const g = new THREE.Group(); g.position.set(x * 1.4, -0.2, z); crane.add(g); jets.push(plume(g, 0.18, 1.6)); }
    }
    const anchorPoints = [[-0.6, -0.5], [0.6, -0.5], [0, 0.7]];
    for (const [x, z] of anchorPoints) cables.push(rod(historical, [x, 0, z], [x, 1, z], 0.014));
    const heli = model(models.ingenuity, 1.2, 'max'); historical.add(heli);
    const rotors = [];
    heli.updateMatrixWorld(true);
    const rotorMeshes = [];
    heli.traverse(o => { if (o.isMesh && /^rotors_/.test(o.name)) rotorMeshes.push(o); });
    for (const rotor of rotorMeshes) {
      const pivot = new THREE.Group(), parent = rotor.parent;
      const center = new THREE.Box3().setFromObject(rotor).getCenter(new THREE.Vector3());
      parent.worldToLocal(center); pivot.position.copy(center); parent.add(pivot); pivot.updateWorldMatrix(true, false); pivot.attach(rotor);
      pivot.userData.spinAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      rotors.push(pivot);
    }
    render = t => {
      const descent = ease(progress(t, 0, 10)), lower = ease(progress(t, 6, 14)), depart = ease(progress(t, 14, 20));
      const drive = ease(progress(t, 24, 28));
      const craneHeight = mix(12, 7.5, descent);
      carrier.group.visible = t < 28; carrier.group.position.set(drive * 8, t < 14 ? Math.max(0, craneHeight - (2 + 5.5 * lower)) : 0, 0);
      carrier.wheels.forEach(w => { w.rotation.x = -drive * 8 / carrier.radius; });
      crane.visible = t < 21; crane.position.set(depart * -10, craneHeight + depart * 14, 0);
      cables.forEach((c, i) => { c.visible = t < 14; const bottom = carrier.group.position.y + 0.8, top = crane.position.y; c.position.set(anchorPoints[i][0], (bottom + top) / 2, anchorPoints[i][1]); c.scale.y = Math.max(0.01, top - bottom); });
      jets.forEach(j => { j.scale.y = 0.8 + 0.15 * Math.sin(t * 25); });
      heli.visible = true;
      const flight = ease(progress(t, 28, 33)) * (1 - ease(progress(t, 39, 44)));
      heli.position.set(0, t < 21 ? carrier.group.position.y + 0.1 : 0.1 * (1 - ease(progress(t, 21, 24))) + 3 * flight, 0);
      heli.rotation.y = 0.3 + Math.PI / 2 * ease(progress(t, 34, 38));
      const coast = Math.min(3, Math.max(0, t - 44));
      const spin = t < 27 ? 0 : t < 44 ? (t - 27) * 30 : 510 + 30 * (coast - coast * coast / 6);
      rotors.forEach((r, i) => { r.quaternion.setFromAxisAngle(r.userData.spinAxis, (i % 2 ? -1 : 1) * spin); });
      cloud.set(t < 14 ? progress(t, 8, 12) * (1 - progress(t, 12, 14)) : flight * 0.15, t);
      if (t < 6) return 'FEB 18, 2021 · Final powered descent: Perseverance carries Ingenuity beneath its belly. Earlier entry and parachute stages are omitted.';
      if (t < 14) return 'SKY CRANE · The descent stage lowers Perseverance on cables until its wheels reach the surface.';
      if (t < 21) return 'TOUCHDOWN · Cables are released and the descent stage flies away. Perseverance later drives to the helicopter airfield.';
      if (t < 28) return 'TIME JUMP · Ingenuity is placed on Mars on April 3. On April 19 it prepares for its first flight.';
      if (t < 39) return 'FIRST FLIGHT · Counter-rotating blades lift Ingenuity 3 metres. It hovers and turns; the actual flight lasted 39.1 seconds.';
      return 'LANDING · Ingenuity descends and its rotors stop. The historical flight ends; next comes its final resting site.';
    };
  }
  const motion = createPlayback(duration, (t, active) => {
    historical.visible = active;
    artifacts.forEach(o => { o.visible = !active; });
    out.labels.forEach(o => { o.visible = !active; });
    return active ? render(t) : 'FINAL RESTING SITE · Explore the equipment left behind. Replay to see its history.';
  });
  motion.finish();
  out.updaters.push(dt => motion.update(dt));
  motion.dispose = () => {
    // Imported models share buffers with the asset library. Dispose only resources
    // owned by the illustrative animation, and never the shared source models.
    const shared = new Set(), disposed = new Set();
    Object.values(models).forEach(g => g.traverse(o => { if (o.isMesh) { shared.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => shared.add(m)); } }));
    historical.traverse(o => {
      for (const resource of [o.geometry, ...(o.material ? Array.isArray(o.material) ? o.material : [o.material] : [])]) {
        if (resource && !shared.has(resource) && !disposed.has(resource)) { resource.dispose(); disposed.add(resource); }
      }
    });
    historical.removeFromParent();
  };
  return motion;
}

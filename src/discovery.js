import * as THREE from 'three';
import { Panel, button, glass, drawText, FONT, BODY, MONO } from './ui.js';
import { DISCOVERIES } from './discovery-stories.js';

const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => { const p = clamp(v); return p * p * (3 - 2 * p); };

// One short action at a time, with exact restoration of the resting pose.
export function createDiscovery(mission, surface) {
  const stories = DISCOVERIES[mission.id], target = surface.discoveryTarget;
  if (!stories?.length || !target) return null;
  const root = new THREE.Group(), detail = new THREE.Group(); root.add(detail);
  const effects = new THREE.Group(); surface.scene.add(effects); effects.visible = false;
  const rings = Array.from({ length: 3 }, () => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), new THREE.MeshBasicMaterial({ color: mission.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    effects.add(ring); return ring;
  });
  const wheels = (target.userData.wheels || []).map(object => ({ object, rotation: object.rotation.clone() }));
  const rotors = [];
  if (mission.id === 'ingenuity') {
    target.updateWorldMatrix(true, true);
    const meshes = []; target.traverse(o => { if (o.isMesh && /^rotors_/.test(o.name)) meshes.push(o); });
    for (const mesh of meshes) {
      const parent = mesh.parent, pivot = new THREE.Group();
      pivot.position.copy(parent.worldToLocal(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())));
      parent.add(pivot); pivot.updateWorldMatrix(true, false); pivot.attach(mesh);
      rotors.push({ pivot, axis: new THREE.Vector3(0, 1, 0).applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize() });
    }
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = -1, open = false, elapsed = 0, running = false, enabled = false;
  let base = null, labelVisibility = null, returnFocus = null;
  const duration = 6, direction = new THREE.Vector3(), center = new THREE.Vector3(), bounds = new THREE.Box3();

  function restore() {
    if (base) { target.position.copy(base.position); target.quaternion.copy(base.quaternion); base = null; }
    wheels.forEach(w => w.object.rotation.copy(w.rotation));
    rotors.forEach(r => r.pivot.quaternion.identity());
    if (labelVisibility) { surface.labels.forEach((l, i) => { l.visible = labelVisibility[i]; }); labelVisibility = null; }
    effects.visible = false; running = false;
  }
  function run() {
    restore();
    if (reducedMotion.matches) return;
    base = { position: target.position.clone(), quaternion: target.quaternion.clone() };
    direction.set(0, 0, -1).applyQuaternion(base.quaternion);
    labelVisibility = surface.labels.map(l => l.visible); surface.labels.forEach(l => { l.visible = false; });
    elapsed = 0; running = true;
  }
  function show(next = true) {
    if (!enabled) return;
    restore();
    surface.motion?.finish();
    if (!open) returnFocus = document.activeElement;
    index = next ? (index + 1) % stories.length : Math.max(0, index);
    open = true;
    const story = stories[index];
    get('eyebrow').textContent = `${mission.name.toUpperCase()} · ${index + 1} / ${stories.length}`;
    get('title').textContent = story.title; get('text').textContent = story.text; get('note').textContent = story.note;
    get('source').href = story.source;
    panel.set({ story, count: `${index + 1} / ${stories.length}` });
    run(); sync();
  }
  function close() {
    restore(); open = false; sync();
    if (dom.contains(document.activeElement)) (returnFocus?.isConnected ? returnFocus : get('trigger')).focus();
  }

  if (!document.getElementById('discovery-style')) {
    const style = document.createElement('style'); style.id = 'discovery-style';
    style.textContent = `
      #discovery{position:fixed;right:20px;bottom:38px;z-index:8;width:min(370px,calc(100vw - 32px));color:#fff;font-family:'Public Sans',sans-serif}
      #discovery[hidden],#discovery [hidden],body.in-vr #discovery{display:none!important}
      #discovery button,#discovery a{font:500 12px 'DM Mono',monospace;color:white;border:1px solid #758aaf;background:#122449;border-radius:6px;padding:10px 12px;min-height:44px;cursor:pointer}
      #discovery button:hover,#discovery a:hover{background:#0B3D91}#discovery :focus-visible{outline:2px solid white;outline-offset:3px}
      #discovery-trigger{width:100%;box-shadow:0 8px 28px #0008}#discovery-trigger small{display:block;margin-top:6px;color:#c1cde0;font:11px 'Public Sans',sans-serif}
      #discovery-card{padding:20px;background:rgba(4,10,26,.97);border:1px solid #7487a866;border-top:3px solid var(--discovery-color);border-radius:12px;box-shadow:0 10px 40px #0008;max-height:calc(100dvh - 100px);overflow:auto}
      #discovery-eyebrow{font:11px 'DM Mono',monospace;color:var(--discovery-color);padding-right:40px;line-height:1.6}
      #discovery-title{font:700 23px/1.18 'Inter',sans-serif;margin:13px 0}#discovery-text{font-size:15px;line-height:1.6;margin-bottom:12px}
      #discovery-note{font-size:11px;line-height:1.5;color:#afbdd4;margin:14px 0}
      #discovery .discovery-actions{display:flex;flex-wrap:wrap;gap:8px}#discovery a{display:inline-flex;align-items:center;text-decoration:none;background:transparent}
      #discovery #discovery-close{position:absolute;right:12px;top:10px;padding:8px 12px;background:transparent;border-color:transparent;font-size:20px}
      body.showing-discovery #motion-panel{display:none}
      @media(max-width:750px){#discovery{right:12px;bottom:46px;width:min(340px,calc(100vw - 24px))}#discovery[data-open="true"]{top:52px;bottom:auto}#discovery-card{padding:14px;max-height:48dvh}#discovery-title{font-size:19px}#discovery-text{font-size:13px}#discovery-note{font-size:10px}#discovery button,#discovery a{font-size:11px}}
      @media(max-height:500px){#discovery{bottom:20px}#discovery-card{max-height:calc(100dvh - 76px)}}
    `;
    document.head.appendChild(style);
  }
  const dom = document.createElement('section'); dom.id = 'discovery'; dom.hidden = true;
  dom.setAttribute('aria-label', 'Interactive mission story'); dom.style.setProperty('--discovery-color', mission.color);
  dom.innerHTML = `<button id="discovery-trigger">Discover this mission <small>Click the equipment or press E</small></button><article id="discovery-card" hidden aria-labelledby="discovery-title"><button id="discovery-close" aria-label="Close discovery">×</button><div id="discovery-eyebrow"></div><div role="status" aria-live="polite" aria-atomic="true"><h2 id="discovery-title"></h2><p id="discovery-text"></p></div><p id="discovery-note"></p><div class="discovery-actions"><button id="discovery-replay">Replay action</button><button id="discovery-next">Next fact</button><a id="discovery-source" target="_blank" rel="noopener noreferrer">NASA source ↗</a></div></article>`;
  document.body.appendChild(dom);
  const get = id => dom.querySelector('#discovery-' + id);
  get('trigger').onclick = () => show(); get('close').onclick = close;
  get('replay').onclick = () => show(false); get('next').onclick = () => show();
  get('next').hidden = stories.length < 2;

  const panel = new Panel(1.35, .84, (ctx, w, h, s) => {
    glass(ctx, w, h, mission.color); if (!s.story) return;
    ctx.textBaseline = 'top'; ctx.fillStyle = mission.color; ctx.font = `500 28px ${MONO}`;
    ctx.fillText(`${mission.short} · DISCOVERY ${s.count}`, 40, 36);
    ctx.fillStyle = '#fff'; ctx.font = `700 50px ${FONT}`;
    let y = drawText(ctx, s.story.title, 40, 94, w - 80, 60);
    ctx.fillStyle = '#e0e7f2'; ctx.font = `400 32px ${BODY}`;
    y = drawText(ctx, s.story.text, 40, y + 24, w - 80, 44);
    ctx.fillStyle = '#afbdd4'; ctx.font = `400 24px ${BODY}`;
    drawText(ctx, s.story.note, 40, y + 24, w - 80, 32);
    ctx.font = `400 23px ${MONO}`; ctx.fillText('Source: NASA · open link below', 40, h - 45);
  });
  panel.position.set(0, 1.55, 0); detail.add(panel);
  const next = button('NEXT FACT', .38, .12, mission.color, () => show());
  const replay = button('REPLAY', .3, .12, mission.color, () => show(false));
  const source = button('NASA SOURCE', .4, .12, mission.color, () => window.open(stories[index].source, '_blank', 'noopener,noreferrer'));
  const dismiss = button('CLOSE', .3, .12, mission.color, close);
  [replay, next, source, dismiss].forEach((b, i) => { b.position.set([-.5, -.14, .28, .66][i], 1.04, .02); detail.add(b); });
  next.visible = stories.length > 1;
  detail.position.set(1.3, 0, -2.5); detail.rotation.y = -.4;
  const trigger = button('DISCOVER THIS MISSION', .85, .12, mission.color, () => show());
  trigger.position.set(0, .45, -2.4); root.add(trigger);
  let xr = false;
  function sync() {
    dom.hidden = !enabled || xr; get('card').hidden = !open; get('trigger').hidden = open;
    root.visible = enabled && xr; detail.visible = open; trigger.visible = !open;
    document.body.classList.toggle('showing-discovery', enabled && open && !xr);
    dom.dataset.open = String(open); dom.dataset.running = String(running);
  }
  return {
    root, interactive: [trigger, replay, next, source, dismiss],
    get isOpen() { return open; }, show, close,
    hitTest(ray) {
      if (!enabled || surface.motion?.state.active) return null;
      const hits = ray.intersectObjects(surface.discoveryTargets || [target], true);
      return hits.find(hit => { for (let o = hit.object; o; o = o.parent) if (!o.visible) return false; return hit.object.isMesh; }) || null;
    },
    update(dt, isXR, visible, camera) {
      xr = isXR; enabled = visible;
      if ((!visible || surface.motion?.state.active) && open) close();
      if (running && reducedMotion.matches) restore();
      if (running) {
        elapsed = Math.min(duration, elapsed + Math.max(0, dt));
        const p = elapsed / duration, envelope = ease(p / .3) * (1 - ease((p - .7) / .3));
        const action = stories[index].action;
        if (action === 'drive') {
          const distance = (mission.id === 'sojourner' ? .45 : 1.25) * envelope;
          target.position.copy(base.position).addScaledVector(direction, distance);
          target.position.y = base.position.y + surface.heightAt(target.position.x, target.position.z) - surface.heightAt(base.position.x, base.position.z);
          wheels.forEach(w => { w.object.rotation.x = w.rotation.x - distance / (mission.id === 'sojourner' ? .065 : .42); });
        } else if (action === 'flight') {
          target.position.copy(base.position); target.position.y += envelope * 1.1;
          rotors.forEach((r, i) => r.pivot.quaternion.setFromAxisAngle(r.axis, (i % 2 ? -1 : 1) * elapsed * 30));
        }
        target.updateWorldMatrix(true, true);
        bounds.setFromObject(action === 'seismic' ? surface.discoveryInstrument || target : target).getCenter(center);
        effects.position.copy(center);
        if (action === 'seismic') effects.position.y = surface.heightAt(center.x, center.z) + .04;
        if (action === 'signal' || action === 'seismic') {
          effects.visible = true;
          if (action === 'signal') { camera.getWorldPosition(center); effects.lookAt(center); }
          else effects.rotation.set(-Math.PI / 2, 0, 0);
          rings.forEach((ring, i) => {
            const wave = (p * 2 + i / 3) % 1;
            ring.scale.setScalar(.3 + wave * (mission.id === 'voyager' ? 3 : 2));
            ring.material.opacity = (1 - wave) * envelope * .7;
          });
        }
        if (elapsed >= duration) restore();
      }
      sync();
    },
    dispose() {
      restore(); dom.remove(); root.removeFromParent(); effects.removeFromParent();
      document.body.classList.remove('showing-discovery');
      [panel, trigger, replay, next, source, dismiss].forEach(p => p.dispose());
      rings.forEach(r => { r.geometry.dispose(); r.material.dispose(); });
    },
  };
}

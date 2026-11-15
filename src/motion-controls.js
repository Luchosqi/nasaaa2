import * as THREE from 'three';
import { Panel, button, glass, drawText, FONT, BODY, MONO } from './ui.js';

export function createMotionControls(motion, name, onHome) {
  const root = new THREE.Group();
  const style = document.getElementById('motion-style') || document.createElement('style');
  if (!style.id) {
    style.id = 'motion-style';
    style.textContent = `
      #motion-panel{position:fixed;z-index:7;left:20px;top:56px;width:310px;padding:16px 20px;background:rgba(4,10,26,.94);border:1px solid #ffffff38;border-top:3px solid #FC3D21;border-radius:12px;color:#fff;font-family:'Public Sans',sans-serif;box-shadow:0 10px 40px #0008}
      #motion-panel[hidden],body.in-vr #motion-panel{display:none}
      #motion-panel[data-active="false"]{left:auto;right:20px}
      #motion-panel .motion-heading{display:flex;justify-content:space-between;gap:10px;font:11px 'DM Mono',monospace;letter-spacing:.08em;color:#9bbfff}
      #motion-caption{margin:10px 0;font-size:15px;line-height:1.5;min-height:44px}
      #motion-panel .motion-note{font-size:11px;line-height:1.5;color:#b2bdcf}
      #motion-progress{width:100%;height:3px;display:block;accent-color:#FC3D21;margin:12px 0}
      #motion-panel .motion-actions{display:flex;gap:8px;flex-wrap:wrap}
      #motion-panel button{padding:9px 12px;min-height:40px;background:#122449;border:1px solid #6682ac;border-radius:6px;color:#fff;cursor:pointer;font:12px 'DM Mono',monospace}
      #motion-panel button:hover{background:#0B3D91}#motion-panel button:focus-visible{outline:2px solid white;outline-offset:3px}#motion-panel button:disabled{opacity:.4;cursor:default}
      @media(max-width:750px){#motion-panel,#motion-panel[data-active="false"]{top:52px;left:14px;right:auto;width:calc(100vw - 28px);padding:10px 12px}#motion-caption{font-size:12px;min-height:0;margin:6px 0}#motion-panel .motion-heading{font-size:9px}#motion-panel button{padding:8px;font-size:10px}#motion-panel .motion-note{font-size:9px}#motion-progress{margin:7px 0}}
    `;
    document.head.appendChild(style);
  }
  const dom = document.createElement('section'); dom.id = 'motion-panel'; dom.setAttribute('aria-label', 'Historical animation controls');
  dom.innerHTML = `<div class="motion-heading"><span id="motion-title"></span><span id="motion-time"></span></div><p id="motion-caption" role="status" aria-live="polite"></p><p class="motion-note">Historical reconstruction · compressed time · illustrative terrain, route and models</p><progress id="motion-progress" max="1" value="0" aria-label="Animation progress"></progress><div class="motion-actions"><button id="motion-pause">Pause</button><button id="motion-replay">Replay landing</button><button id="motion-finish">Resting site</button><button id="motion-home">Back to orbit</button></div>`;
  document.body.appendChild(dom);
  const get = id => dom.querySelector('#motion-' + id);
  get('replay').onclick = () => motion.play(); get('pause').onclick = () => motion.pause();
  get('finish').onclick = () => motion.finish(); get('home').onclick = onHome;
  const panel = new Panel(1.7, 0.43, (ctx, w, h, s) => {
    glass(ctx, w, h, '#FC3D21'); ctx.textBaseline = 'top';
    ctx.fillStyle = '#9bbfff'; ctx.font = `500 ${h * 0.085}px ${MONO}`; ctx.fillText('HISTORICAL RECONSTRUCTION', 30, 25);
    ctx.fillStyle = '#fff'; ctx.font = `500 ${h * 0.12}px ${BODY}`; drawText(ctx, s.caption || '', 30, h * 0.23, w - 60, h * 0.16);
    ctx.fillStyle = '#acb7ca'; ctx.font = `400 ${h * 0.07}px ${FONT}`; ctx.fillText('Compressed time · illustrative terrain, route and models', 30, h * 0.84);
  });
  panel.position.set(0, 0.9, -2.8); root.add(panel);
  const actions = [button('PAUSE', 0.4, 0.1, '#FC3D21', () => motion.pause()), button('REPLAY', 0.4, 0.1, '#FC3D21', () => motion.play()), button('RESTING SITE', 0.5, 0.1, '#FC3D21', () => motion.finish()), button('ORBIT', 0.3, 0.1, '#FC3D21', onHome)];
  actions.forEach((b, i) => { b.position.set([-0.65, -0.2, 0.3, 0.75][i], 0.6, -2.8); root.add(b); });
  let previous = '', previousPause = '';
  return {
    root, interactive: actions,
    update(xr, visible) {
      root.visible = xr && visible; dom.hidden = !visible || xr;
      const s = motion.state, caption = s.caption;
      if (caption !== previous) { previous = caption; get('caption').textContent = caption; panel.set({ caption }); }
      const pause = s.playing ? 'Pause' : s.active ? 'Resume' : 'Finished';
      if (pause !== previousPause) { previousPause = pause; get('pause').textContent = pause; actions[0].set({ label: pause.toUpperCase() }); }
      get('pause').disabled = !s.active; get('finish').disabled = !s.active;
      get('title').textContent = name.toUpperCase() + (s.active ? ' · HISTORY' : ' · RESTING SITE');
      get('time').textContent = Math.floor(s.time) + ' / ' + s.duration + ' s';
      get('progress').value = s.time / s.duration;
      dom.dataset.time = s.time.toFixed(2); dom.dataset.playing = String(s.playing); dom.dataset.active = String(s.active);
    },
    dispose() { dom.remove(); root.removeFromParent(); panel.dispose(); actions.forEach(b => b.dispose()); },
  };
}

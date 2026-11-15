// Procedural sound (no files): rocket rumble, staging thumps, warp wind. Starts on the first click / Enter VR.
// (Space is silent; this is a cinematic choice, mutable with the M key or the sound button.)
let ctx = null, master, rumbleG, rumbleF, warpG, warpF, humG;
let muted = false;

function noiseBuffer(c, seconds = 3) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brown noise
  return b;
}
function loop(c, buf) { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  const nb = noiseBuffer(ctx);
  // rumble: low brown noise + a sub tone
  rumbleF = ctx.createBiquadFilter(); rumbleF.type = 'lowpass'; rumbleF.frequency.value = 140;
  rumbleG = ctx.createGain(); rumbleG.gain.value = 0;
  loop(ctx, nb).connect(rumbleF); rumbleF.connect(rumbleG); rumbleG.connect(master);
  const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 34; const subG = ctx.createGain(); subG.gain.value = 0.5;
  sub.connect(subG); subG.connect(rumbleG); sub.start();
  // warp wind: band-passed noise whose pitch follows the speed
  warpF = ctx.createBiquadFilter(); warpF.type = 'bandpass'; warpF.frequency.value = 400; warpF.Q.value = 0.8;
  warpG = ctx.createGain(); warpG.gain.value = 0;
  loop(ctx, nb).connect(warpF); warpF.connect(warpG); warpG.connect(master);
  // a soft, wide pad underneath everything
  humG = ctx.createGain(); humG.gain.value = 0.0; humG.connect(master);
  for (const f of [55, 82.4, 110.2]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(humG); o.start(); }
}

const ramp = (param, v, t = 0.25) => { if (ctx) param.setTargetAtTime(v, ctx.currentTime, t); };

/** thrust 0..1 */
export function setRumble(v) { if (!ctx) return; ramp(rumbleG.gain, v * 0.9, 0.15); ramp(rumbleF.frequency, 90 + v * 160, 0.3); }
/** warp 0..1 */
export function setWarp(v) { if (!ctx) return; ramp(warpG.gain, v * 0.35, 0.4); ramp(warpF.frequency, 250 + v * 900, 0.5); }
export function setHum(v) { if (!ctx) return; ramp(humG.gain, v, 1.2); }

/** staging "thump" */
export function boom(strength = 1) {
  if (!ctx || muted) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, 1.2);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * strength, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
export function toggleMute() { muted = !muted; if (master) ramp(master.gain, muted ? 0 : 0.8, 0.1); return muted; }
export function isMuted() { return muted; }

// Deterministic playback: rendering depends on time, never accumulated transforms.
// In step mode playback holds each time the caption changes, so every stage waits for the visitor.
export function createPlayback(duration, render) {
  const state = { time: 0, duration, playing: false, active: false, caption: '', step: false };
  const draw = () => { state.caption = render(state.time, state.active); };
  return {
    state,
    play() { state.time = 0; state.active = true; state.playing = !state.step; draw(); },
    pause() { if (state.active) state.playing = !state.playing; },
    finish() { state.time = duration; state.active = false; state.playing = false; draw(); },
    seek(time) { if (!Number.isFinite(time)) return; state.time = Math.max(0, Math.min(duration, time)); state.active = state.time < duration; state.playing = false; draw(); },
    setStep(on) { state.step = !!on; },
    update(dt) {
      if (!state.playing) return;
      const before = state.caption;
      state.time = Math.min(duration, state.time + Math.max(0, dt));
      if (state.time >= duration) { state.active = false; state.playing = false; }
      draw();
      if (state.step && state.active && state.caption !== before) state.playing = false;
    },
  };
}

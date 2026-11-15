// Deterministic playback: rendering depends on time, never accumulated transforms.
export function createPlayback(duration, render) {
  const state = { time: 0, duration, playing: false, active: false, caption: '' };
  const draw = () => { state.caption = render(state.time, state.active); };
  return {
    state,
    play() { state.time = 0; state.active = true; state.playing = true; draw(); },
    pause() { if (state.active) state.playing = !state.playing; },
    finish() { state.time = duration; state.active = false; state.playing = false; draw(); },
    seek(time) { if (!Number.isFinite(time)) return; state.time = Math.max(0, Math.min(duration, time)); state.active = state.time < duration; state.playing = false; draw(); },
    update(dt) {
      if (!state.playing) return;
      state.time = Math.min(duration, state.time + Math.max(0, dt));
      if (state.time >= duration) { state.active = false; state.playing = false; }
      draw();
    },
  };
}

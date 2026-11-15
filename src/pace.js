// Experience pace: 'auto' plays everything through; 'step' waits for the visitor before each new event.
const KEY = 'abnf-pace';
const listeners = new Set();
let step = false;
try { step = localStorage.getItem(KEY) === 'step'; } catch { /* private mode: default to auto */ }
try { const q = new URLSearchParams(location.search).get('pace'); if (q === 'step' || q === 'auto') step = q === 'step'; } catch { /* no location */ }

export const pace = {
  get step() { return step; },
  set(value) {
    step = !!value;
    try { localStorage.setItem(KEY, step ? 'step' : 'auto'); } catch { /* ignore */ }
    listeners.forEach((fn) => fn(step));
  },
  toggle() { this.set(!step); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  label() { return step ? 'STEP BY STEP' : 'AUTOMATIC'; },
};

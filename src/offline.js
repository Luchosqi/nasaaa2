// Start-screen controls: "Save for offline" (service worker cache on this device) and the
// link to the downloadable offline kit for classrooms without internet.
import { KIT_URL } from './site.js';
import { handheld } from './device.js';

const KEY = 'abnf-offline';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage blocked */ } };

export function initOffline() {
  const $ = (id) => document.getElementById(id);
  const kit = $('kit'), btn = $('save-offline'), status = $('offline-status');
  if (kit) kit.href = KIT_URL;
  // Service workers need HTTPS or localhost; on a plain-http LAN address only the kit link is shown.
  if (!btn || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});

  let list = null, busy = false;
  const files = () => list.files.filter((f) => !(handheld && f.endsWith('starmap_8k.jpg')));
  const show = () => {
    if (!list || busy) return;
    const saved = read(), mb = Math.round(list.bytes / 1048576);
    btn.hidden = false;
    btn.disabled = saved === list.version;
    btn.textContent = saved === list.version ? 'Saved for offline ✓' : saved ? 'Update offline copy' : `Save for offline (~${mb} MB)`;
  };
  fetch('offline-files.json', { cache: 'no-cache' }).then((r) => r.json()).then((l) => { list = l; show(); }).catch(() => {});

  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data; if (d?.type !== 'save-progress') return;
    status.textContent = `Saving for offline… ${Math.round(d.done / d.total * 100)} %`;
    if (d.done < d.total) return;
    busy = false;
    // The 8K sky is optional: without it the offline copy uses the 4K sky.
    const real = (d.errors || []).filter((e) => !e.includes('starmap_8k.jpg'));
    if (d.failed) console.warn('[offline] not saved:', d.errors);
    if (real.length) status.textContent = `${real.length} files could not be saved. Check the connection and try again.`;
    else { write(list.version); status.textContent = 'Ready: this device can now open the experience without internet.'; }
    show();
  });

  btn.onclick = async () => {
    if (!list || busy) return;
    busy = true; btn.disabled = true; status.textContent = 'Preparing…';
    try { await navigator.storage?.persist?.(); } catch { /* optional */ }
    const reg = await navigator.serviceWorker.ready;
    const saved = read();
    reg.active.postMessage({ type: 'save', urls: files().map((f) => new URL(f, document.baseURI).href), refresh: !!saved && saved !== list.version });
  };
}

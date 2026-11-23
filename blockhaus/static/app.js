'use strict';
/* Blockhaus – Frontend. Kein Framework, keine externen Skripte. */

// ───────────────────────── Grundlagen ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('wb.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('wb.' + k, JSON.stringify(v)); } catch { /* egal */ } },
};

const P = {
  rotl: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  rotr: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5z"/><path d="m16 7 5 5-5 5z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  terminal: '<rect x="2" y="3" width="20" height="18" rx="3"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folderplus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  restart: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 1 0 6 19z"/>',
  rain: '<path d="M16 13a4 4 0 0 0-.8-7.9A5.5 5.5 0 0 0 4.5 8 3.5 3.5 0 0 0 5 15h11"/><path d="M8 19v2M12 18v3M16 19v2"/>',
  storm: '<path d="M16 13a4 4 0 0 0-.8-7.9A5.5 5.5 0 0 0 4.5 8 3.5 3.5 0 0 0 5 15h2"/><path d="m13 12-3 5h4l-3 5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  megaphone: '<path d="m3 11 18-5v12L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alert: '<path d="m10.3 3.9-8.1 14a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3l-8.1-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  food: '<path d="M7 2v8a3 3 0 0 0 6 0V2M10 2v20"/><path d="M17 22V2c-2 1.5-3 4-3 7h3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  crown: '<path d="m2 5 4 11h12l4-11-6 5-4-7-4 7z"/><path d="M6 20h12"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  rename: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
const ico = (n, cls = '') => `<span class="ico ${cls}">${svg(n)}</span>`;
// Aktualisiert nur, was sich wirklich geändert hat (statt innerHTML neu zu setzen):
// Bilder laden nicht neu, Hover/Fokus bleiben erhalten und CSS-Übergänge (Ringe, Balken) laufen weich.
function patch(el, html) {
  if (!el || el._ph === html) return;
  el._ph = html;
  const t = document.createElement('template');
  t.innerHTML = html;
  morphKids(el, t.content);
}
function morphKids(a, b) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  bn.forEach((n, i) => {
    const o = an[i];
    if (!o) return a.appendChild(n);
    if (o.nodeType === 1 && o.dataset.fbOf !== undefined && n.nodeName === 'IMG' && o.dataset.fbOf === n.getAttribute('src')) return;
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) return a.replaceChild(n, o);
    if (n.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return; }
    for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
    for (const { name, value } of [...n.attributes]) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
    morphKids(o, n);
  });
  for (let i = bn.length; i < an.length; i++) an[i].remove();
}
function hydrateIcons(root = document) { $$('[data-i]', root).forEach((el) => { el.innerHTML = svg(el.dataset.i); el.removeAttribute('data-i'); }); }

const fmtBytes = (b) => {
  if (b == null) return '–';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b >= 100 || i === 0 ? 0 : 1).replace('.', I18N.dec)} ${u[i]}`;
};
const fmtDur = (s) => {
  if (s == null) return '–';
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d} T ${h} Std`;
  if (h >= 10) return `${h} Std`;
  if (h) return `${h} Std ${m} Min`;
  if (m) return `${m} Min`;
  return `${s} s`;
};
const fmtAgo = (t) => {
  if (!t) return '–';
  const s = Date.now() / 1000 - t;
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`;
  if (s < 86400 * 30) return `vor ${Math.floor(s / 86400)} T`;
  return fmtDate(t);
};
const fmtDate = (t) => new Date(t * 1000).toLocaleString(I18N.locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const num = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : Number(v).toFixed(d).replace('.', I18N.dec));
const headUrl = (p) => `https://mc-heads.net/avatar/${encodeURIComponent(p.uuid || p.name || p)}/64`;
const headImg = (p, cls = 'head') => {
  const name = p.name || p;
  return `<img class="${cls}" src="${esc(headUrl(p))}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(String(name)[0] || '?')}">`;
};
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName === 'IMG' && el.classList.contains('blk')) {  // Textur fehlt → normales Symbol bzw. nichts
    if (el.dataset.ico) el.outerHTML = ico(el.dataset.ico); else el.remove();
    return;
  }
  if (el.tagName === 'IMG' && el.dataset.fallback !== undefined) {
    const span = document.createElement('span');
    span.className = el.className + ' avatar';
    span.textContent = el.dataset.fallback.toUpperCase();
    span.dataset.fbOf = el.getAttribute('src') || '';  // damit patch() das Ersatz-Symbol nicht wieder durch das Bild ersetzt
    el.replaceWith(span);
  }
}, true);

// ───────────────────────── Zustand & API ─────────────────────────
const S = { me: null, csrf: '', stats: {}, history: [], logs: [], task: null, es: null, subs: new Set(), page: null, cleanup: null };

async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (opts.raw !== undefined) { o.body = opts.raw; o.headers['Content-Type'] = 'application/octet-stream'; }
  else if (opts.body !== undefined) { o.body = JSON.stringify(opts.body); o.headers['Content-Type'] = 'application/json'; }
  if (o.method !== 'GET') o.headers['X-CSRF'] = S.csrf;
  o.headers['X-Lang'] = I18N.lang;
  let r;
  try { r = await fetch(path, o); } catch { throw new Error('Panel nicht erreichbar'); }
  let j = {};
  try { j = await r.json(); } catch { /* leer */ }
  if (r.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Sitzung abgelaufen – bitte neu anmelden'); }
  if (!r.ok) throw new Error(j.error || `Fehler ${r.status}`);
  return j;
}
const post = (p, b) => api(p, { method: 'POST', body: b });

async function run(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok', r && r.output);
    return r;
  } catch (e) { toast(e.message, 'err'); return null; }
}
const rcon = (command, quiet) => run(() => post('/api/command', { command }), quiet ? null : (r) => (r.output ? 'Befehl ausgeführt' : `/${command} ausgeführt`));

// ───────────────────────── UI-Bausteine ─────────────────────────
function toast(msg, type = 'ok', detail) {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `${ico(type === 'err' ? 'alert' : 'check')}<div>${esc(msg)}${detail ? `<pre>${esc(String(detail).slice(0, 600))}</pre>` : ''}</div>`;
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'err' ? 6000 : detail ? 5000 : 2800);
}

function modal(html, { wide = false, onOpen } = {}) {
  return new Promise((resolve) => {
    const wrap = $('#modal'), old = $('#modal-box'), box = old.cloneNode(false);  // frisches Element: keine Handler vom letzten Dialog
    old.replaceWith(box);
    box.className = 'modal' + (wide ? ' modal-wide' : '');
    box.innerHTML = html;
    hydrateIcons(box);
    wrap.hidden = false;
    const prevFocus = document.activeElement;
    const close = (v) => { wrap.hidden = true; box.innerHTML = ''; document.removeEventListener('keydown', key, true); prevFocus && prevFocus.focus && prevFocus.focus(); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    document.addEventListener('keydown', key, true);
    wrap.onclick = (e) => { if (e.target === wrap) close(null); };
    box.onclick = (e) => { const b = e.target.closest('[data-close]'); if (b) close(b.dataset.close === 'ok' ? collect(box) : null); };
    const form = $('form', box);
    if (form) form.onsubmit = (e) => { e.preventDefault(); close(collect(box)); };
    onOpen && onOpen(box, close);
    const f = $('[autofocus], input, select, textarea, .btn-primary, .btn-danger', box);
    f && setTimeout(() => f.focus(), 30);
  });
}
const collect = (box) => { const o = {}; $$('[name]', box).forEach((el) => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };

function confirmBox({ title, text, ok = 'Bestätigen', danger = false, input, inputLabel, placeholder = '', requireText }) {
  return modal(`<form>
    <h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}
    ${input ? `<label class="field"><span>${esc(inputLabel || '')}</span><input name="value" placeholder="${esc(placeholder)}" autocomplete="off" ${requireText ? `data-need="${esc(requireText)}"` : ''}></label>` : ''}
    <div class="btns"><button type="button" class="btn btn-ghost" data-close="x">Abbrechen</button>
    <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" ${requireText ? 'disabled' : ''}>${esc(ok)}</button></div></form>`, {
    onOpen(box) {
      const inp = $('[data-need]', box);
      if (inp) inp.oninput = () => { $('[type=submit]', box).disabled = inp.value.trim() !== inp.dataset.need; };
    },
  });
}

function gauge(pct, label, color) {
  const r = 26, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, (pct ?? 0) / 100));
  return `<div class="gauge"><svg viewBox="0 0 62 62"><circle class="track" cx="31" cy="31" r="${r}" fill="none" stroke-width="6"/>
    <circle class="val" cx="31" cy="31" r="${r}" fill="none" stroke-width="6" stroke-linecap="round" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>
    <span class="num">${esc(label)}</span></div>`;
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const levelColor = (pct, warn = 70, bad = 90) => (pct >= bad ? css('--red') : pct >= warn ? css('--gold') : css('--accent'));

// ───────────────────────── Theme ─────────────────────────
function applyTheme(t = store.get('theme', 'auto')) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}
applyTheme();

// ───────────────────────── Login / Start ─────────────────────────
async function showLogin() {
  if (S.es) { S.es.close(); S.es = null; }
  S.me = null;
  try { const st = await api('/api/setup/status'); if (st.needed) { showSetup(st); return; } } catch { /* weiter zum Login */ }
  $('#setup').hidden = true;
  $('#login-lang').value = I18N.lang;
  $('#app').hidden = true; $('#login').hidden = false;
  hideSplash();
  $('#palette').hidden = true; $('#modal').hidden = true;
  setTimeout(() => $('#login-form [name=user]').focus(), 50);
}

$('#login-lang').onchange = (e) => setLanguage(e.target.value);
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, btn = $('button', f);
  btn.disabled = true; $('#login-err').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: { user: f.user.value, password: f.password.value } });
    f.password.value = '';
    await boot();
  } catch (err) { $('#login-err').textContent = err.message; }
  btn.disabled = false;
});

async function boot() {
  let me;
  try { me = await api('/api/me'); } catch { return showLogin(); }
  if (me.language && me.language !== I18N.lang) {  // Sprache aus dem Konto (gilt auf allen Geräten)
    try { localStorage.setItem('bh.lang', me.language); } catch { /* privat */ }
    location.reload(); return;
  }
  S.me = me; S.csrf = me.csrf;
  $('#login').hidden = true; $('#app').hidden = false;
  $('#me-name').textContent = me.user;
  $('#me-avatar').textContent = me.user[0].toUpperCase();
  applyVersion();
  hydrateIcons();
  buildNav();
  connect();
  route();
  loadMaint();
  updateNotice();
  hideSplash();
  if (!S.maintTimer) S.maintTimer = setInterval(() => S.me && loadMaint(), 60000);
}
$('#maint-chip').onclick = () => toggleMaintenance();

// Server-Software (Vanilla/Fabric/Forge/NeoForge/Paper/Purpur) – bestimmt u. a., ob es „Mods“ oder „Plugins“ heißt
const ver = () => (S.me && S.me.version) || {};
const isPlugins = () => ver().kind === 'plugin';
const contentWord = (plural = true) => (isPlugins() ? (plural ? 'Plugins' : 'Plugin') : (plural ? 'Mods' : 'Mod'));
function applyVersion() {
  const v = ver();
  $('#brand-ver').textContent = v.mc ? `${v.mc} · ${v.loaderName || v.loader || ''}` : 'Minecraft';
  const mp = PAGES.find((p) => p.id === 'mods');
  if (mp) mp.label = isPlugins() ? 'Plugins' : 'Mods';
}
// Nach einem Update/Wechsel: neue Version holen, Navigation und aktuelle Seite auffrischen
async function refreshVersion() {
  let me;
  try { me = await api('/api/me'); } catch { return; }
  const before = JSON.stringify(ver());
  S.me = { ...S.me, ...me };
  if (JSON.stringify(ver()) === before) return;
  applyVersion();
  buildNav();
  route();
}

$('#logout').onclick = async () => { await run(() => post('/api/logout', {})); showLogin(); };

// ───────────────────────── Live-Verbindung ─────────────────────────
function connect() {
  if (S.es) S.es.close();
  const es = new EventSource('/api/events');
  S.es = es;
  es.addEventListener('init', (e) => {
    const d = JSON.parse(e.data);
    // Nach einem Update läuft eine neue Blockhaus-Version: Seite neu laden, damit auch die Oberfläche neu ist
    if (d.version && S.me && S.me.appVersion && d.version !== S.me.appVersion) { location.replace(`/?v=${encodeURIComponent(d.version)}${location.hash}`); return; }
    S.logs = d.logs; S.history = d.history; S.task = d.task;
    setStats(d.stats || {}, true);
    renderTask();
    emit('logs-reset');
  });
  es.addEventListener('log', (e) => {
    const lines = JSON.parse(e.data);
    mcToasts(lines);
    S.logs.push(...lines);
    if (S.logs.length > 2000) S.logs.splice(0, S.logs.length - 1500);
    emit('log', lines);
  });
  es.addEventListener('stats', (e) => setStats(JSON.parse(e.data)));
  es.addEventListener('task', (e) => { const prev = S.task; S.task = JSON.parse(e.data); renderTask(); emit('task', prev); if (prev && !S.task) refreshVersion(); });
  es.onerror = async () => {
    setStatusPill('unknown', 'Verbindung unterbrochen', '');
    if (es.readyState === EventSource.CLOSED) {
      try { await api('/api/me'); setTimeout(connect, 3000); } catch { /* showLogin wurde aufgerufen */ }
    }
  };
}
// ── Spiel-Ereignisse als Minecraft-Toast (nur live, nicht beim ersten Laden) ──
const DEATH_RX = /^(was |were |fell |drowned|died|blew up|burned|went |hit the ground|tried to swim|walked into|froze|starved|suffocated|withered|experienced kinetic|discovered the floor|didn't want to live|left the confines|is no more|got finished)/;
// Welche Spiel-Ereignisse oben rechts erscheinen (pro Browser einstellbar)
const MCT_KINDS = [['join', 'Spieler betritt den Server'], ['leave', 'Spieler verlässt den Server'], ['adv', 'Erfolge & Fortschritte'], ['death', 'Tode']];
function mctPrefs() {
  const all = store.get('mcToasts', true);  // alter Gesamtschalter als Vorgabe
  return Object.assign(Object.fromEntries(MCT_KINDS.map(([k]) => [k, all])), store.get('mcToastKinds', {}));
}
function mcToasts(lines) {
  const pref = mctPrefs();
  if (!MCT_KINDS.some(([k]) => pref[k])) return;
  for (const [kind, line] of lines) {
    if (kind !== 'log') continue;
    const m = line.match(/^\[[\d:]+\] \[[^\]]+\/INFO\]: (.*?)\s*$/);  // jeder Thread (Paper, Fabric, Forge …)
    if (!m) continue;
    const msg = m[1];
    let r;
    if ((r = msg.match(/^([A-Za-z0-9_]{1,16})(?: \(formerly known as [A-Za-z0-9_]{1,16}\))? (joined|left) the game$/))) pref[r[2] === 'joined' ? 'join' : 'leave'] && mcToast(r[2] === 'joined' ? 'join' : 'leave', r[1], r[2] === 'joined' ? 'Spieler beigetreten' : 'Spieler gegangen', r[2] === 'joined' ? `${r[1]} ist jetzt online` : `${r[1]} hat das Spiel verlassen`);
    else if ((r = msg.match(/^([A-Za-z0-9_]{1,16}) has (made the advancement|completed the challenge|reached the goal) \[(.+)\]$/))) {
      const t = { 'made the advancement': ['adv', 'Fortschritt erzielt!'], 'completed the challenge': ['challenge', 'Aufgabe erledigt!'], 'reached the goal': ['goal', 'Ziel erreicht!'] }[r[2]];
      if (pref.adv) mcToast(t[0], r[1], t[1], `${r[1]}: ${r[3]}`);
    } else if ((r = msg.match(/^([A-Za-z0-9_]{1,16}) (.+)$/)) && DEATH_RX.test(r[2]) && (S.stats.online || []).includes(r[1])) pref.death && mcToast('death', r[1], 'Gestorben', msg);
  }
}
function mcToast(cls, player, title, text) {
  const box = $('#mctoasts');
  if (!box || !S.me) return;
  while (box.childElementCount >= 3) box.firstElementChild.remove();
  const t = document.createElement('div');
  t.className = 'mctoast ' + cls;
  t.innerHTML = `${headImg(player)}<div><b>${esc(title)}</b><small>${esc(text)}</small></div>`;
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, 5500);
}

function emit(ev, data) { S.subs.forEach((fn) => fn(ev, data)); }
function sub(fn) { S.subs.add(fn); return () => S.subs.delete(fn); }

function setStats(st, init) {
  S.stats = st;
  if (!init && st.t) {
    S.history.push({ t: st.t, cpu: st.cpu, jcpu: st.jcpu, jmem: st.jmem, heapUsed: st.heapUsed, mspt: st.mspt, players: st.players });
    if (S.history.length > 240) S.history.shift();
  }
  const [cls, label] = srvState(st);
  let sub = '';
  if (cls === 'online') sub = `${st.players ?? 0}/${st.maxPlayers ?? '–'} Spieler`;
  else if (cls === 'offline') sub = st.state === 'failed' ? 'Dienst fehlgeschlagen' : 'gestoppt';
  else sub = 'bitte warten';
  setStatusPill(cls, label, sub);
  renderPower(cls);
  const nb = $('#nav [data-badge=players]');
  if (nb) { nb.textContent = st.players || ''; nb.hidden = !st.players; }
  const mb = $('#nav [data-badge=mods]');
  if (mb) { mb.innerHTML = ico('restart'); mb.className = 'badge chip-gold'; mb.title = 'Neustart erforderlich'; mb.hidden = !st.modsPending; }
  const cb = $('#nav [data-badge=crash]');
  if (cb) { const fresh = st.lastCrash && st.lastCrash > store.get('crashSeen', 0); cb.textContent = '!'; cb.className = 'badge chip-red'; cb.hidden = !fresh; }
  emit('stats', st);
}

function srvState(st) {
  switch (st.state) {
    case 'active': return st.ready ? ['online', st.paused ? 'Online · pausiert' : 'Online'] : ['starting', 'Startet …'];
    case 'activating': case 'reloading': return ['starting', 'Startet …'];
    case 'deactivating': return ['stopping', 'Stoppt …'];
    case 'failed': return ['offline', 'Abgestürzt'];
    case 'inactive': return ['offline', 'Offline'];
    default: return ['unknown', 'Verbinde …'];
  }
}
const MCUBE_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse class="sh" cx="50" cy="97" rx="30" ry="4.5"/><g class="blk"><path class="t" d="M50 12 86 32 50 52 14 32z"/><path class="l" d="M14 32 50 52v40L14 72z"/><path class="r" d="M86 32 50 52v40l36-20z"/><path class="lt d" d="M26 78.7 38 85.3V63.3L26 56.7z"/><path class="lt w" d="M60 64.4 74 56.7V44.7L60 52.4z"/></g></svg>';
const mcube = (lg) => `<span class="mcube${lg ? ' lg' : ''}">${MCUBE_SVG}</span>`;
function setStatusPill(cls, label, sub) {
  const p = $('#status-pill');
  p.className = 'status-pill st-' + cls + (S.stats.state === 'failed' ? ' crashed' : '');
  $('#status-text').textContent = label;
  $('#status-sub').textContent = sub;
}

let lastPower = '';
function renderPower(cls) {
  if (cls === lastPower) return;
  lastPower = cls;
  const el = $('#power');
  if (cls === 'offline') {
    el.innerHTML = `<button class="btn btn-primary" data-pw="start">${ico('play')}<span class="lbl">Starten</span></button>`;
  } else if (cls === 'online' || cls === 'starting') {
    el.innerHTML = `<button class="btn" data-pw="restart" title="Neu starten">${ico('restart')}<span class="lbl">Neustart</span></button>
      <button class="btn btn-danger" data-pw="stop" title="Stoppen">${ico('stop')}<span class="lbl">Stoppen</span></button>`;
  } else if (cls === 'stopping') {
    el.innerHTML = `<button class="btn btn-danger" data-pw="kill" title="Prozess sofort beenden">${ico('zap')}<span class="lbl">Hart beenden</span></button>`;
  } else el.innerHTML = '';
}
$('#power').addEventListener('click', (e) => { const b = e.target.closest('[data-pw]'); if (b) power(b.dataset.pw); });

async function power(action) {
  if (action === 'start') return run(() => post('/api/server', { action }), 'Server wird gestartet');
  if (action === 'kill') {
    const ok = await confirmBox({ title: 'Prozess hart beenden?', text: 'Der Java-Prozess wird sofort abgeschossen. <b>Nicht gespeicherte Änderungen der letzten Minuten können verloren gehen.</b> Nur nutzen, wenn der Server hängt.', ok: 'Hart beenden', danger: true });
    if (ok) run(() => post('/api/server', { action }), 'Prozess beendet');
    return;
  }
  const word = action === 'restart' ? 'Neustart' : 'Stopp';
  const online = S.stats.players || 0;
  const res = await modal(`<h3>Server ${action === 'restart' ? 'neu starten' : 'stoppen'}</h3>
    <p>${online ? `<b>${online} Spieler online.</b> Mit Countdown bekommen alle eine Warnung im Chat.` : 'Gerade ist niemand online.'}</p>
    <div class="quick" style="grid-template-columns:repeat(3,1fr)">
      <button class="qa" data-close="ok" data-d="0" style="--qa:var(--${action === 'stop' ? 'red' : 'accent'})">${ico(action === 'restart' ? 'restart' : 'stop')}<b>Sofort</b><small>Welt wird gespeichert</small></button>
      <button class="qa" data-close="ok" data-d="60" style="--qa:var(--gold)">${ico('hourglass')}<b>In 1 Minute</b><small>mit Warnung</small></button>
      <button class="qa" data-close="ok" data-d="300" style="--qa:var(--aqua)">${ico('clock')}<b>In 5 Minuten</b><small>mit Warnung</small></button>
    </div>
    <div class="btns"><button class="btn btn-ghost" data-close="x">Abbrechen</button></div>`, {
    onOpen(box, close) { $$('[data-d]', box).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); close({ d: +b.dataset.d }); }; }); },
  });
  if (!res) return;
  run(() => post('/api/server', { action, delay: res.d }), res.d ? `${word} in ${res.d / 60} Min geplant` : `${word} ausgelöst`);
}

function renderTask() {
  const t = S.task, el = $('#task');
  if (!t) { el.hidden = true; return; }
  el.hidden = false;
  $('#task-msg').textContent = t.msg;
  $('#task-cancel').hidden = t.kind !== 'countdown' || !t.end;
}
$('#task-cancel').onclick = () => run(() => post('/api/server', { action: 'cancel' }), 'Abgebrochen');

// ───────────────────────── Navigation ─────────────────────────
const PAGES = [
  { id: 'overview', label: 'Übersicht', icon: 'home', sec: 'Server' },
  { id: 'console', label: 'Konsole', icon: 'terminal', sec: 'Server' },
  { id: 'players', label: 'Spieler', icon: 'users', sec: 'Server', badge: 'players' },
  { id: 'chat', label: 'Chat', icon: 'chat', sec: 'Server' },
  { id: 'history', label: 'Verlauf', icon: 'history', sec: 'Server' },
  { id: 'map', label: 'Weltkarte 3D', icon: 'map', sec: 'Server' },
  { id: 'world', label: 'Welt & Regeln', icon: 'globe', sec: 'Server' },
  { id: 'diagnose', label: 'Diagnose', icon: 'activity', sec: 'Server', badge: 'crash' },
  { id: 'settings', label: 'Einstellungen', icon: 'sliders', sec: 'Konfiguration' },
  { id: 'mods', label: 'Mods', icon: 'box', sec: 'Konfiguration', badge: 'mods' },
  { id: 'content', label: 'Datapacks & Pakete', icon: 'archive', sec: 'Konfiguration' },
  { id: 'schedules', label: 'Zeitpläne', icon: 'calendar', sec: 'Konfiguration' },
  { id: 'backups', label: 'Backups', icon: 'archive', sec: 'Konfiguration' },
  { id: 'updates', label: 'Updates & Software', icon: 'rocket', sec: 'Konfiguration' },
  { id: 'files', label: 'Dateien', icon: 'folder', sec: 'Konfiguration' },
  { id: 'admins', label: 'Panel & Admins', icon: 'shield', sec: 'Panel' },
];

const SUBPAGES = { player: { label: 'Spieler', nav: 'players' }, create: { label: 'Server erstellen', nav: 'overview' } };
const NO_SERVER_OK = new Set(['create', 'admins', 'settings']);  // ohne Server erreichbare Seiten

function buildNav() {
  let sec = '', html = '';
  for (const p of PAGES) {
    if (p.sec !== sec) { sec = p.sec; html += `<div class="nav-sec">${esc(sec)}</div>`; }
    const icon = PAGE_BLK[p.id] ? `<img class="nav-blk blk" src="/api/texture?p=${encodeURIComponent(PAGE_BLK[p.id])}" alt="" data-ico="${p.icon}">` : ico(p.icon);
    html += `<a class="nav-item" href="#/${p.id}" data-page="${p.id}">${icon}<span>${esc(p.label)}</span>${p.badge ? `<span class="badge chip-green" data-badge="${p.badge}" hidden></span>` : ''}</a>`;
  }
  $('#nav').innerHTML = html;
}
$('#menu-btn').onclick = () => $('#rail').classList.toggle('open');
document.addEventListener('click', (e) => {
  const rail = $('#rail');
  if (rail.classList.contains('open') && !e.target.closest('#rail') && !e.target.closest('#menu-btn')) rail.classList.remove('open');
});

window.addEventListener('hashchange', route);
function route() {
  if (!S.me) return;
  let [, id = 'overview', param] = location.hash.match(/^#\/(\w+)(?:\/([\w-]+))?/) || [];
  if (!S.me.hasServer && !NO_SERVER_OK.has(id)) { id = 'create'; if (location.hash !== '#/create') history.replaceState(null, '', '#/create'); }
  const subp = SUBPAGES[id];
  const page = subp ? { id, label: subp.label, nav: subp.nav } : (PAGES.find((p) => p.id === id) || PAGES[0]);
  if (S.cleanup) { try { S.cleanup(); } catch { /* egal */ } S.cleanup = null; }
  S.page = page.id;
  document.body.dataset.page = page.id;  // z. B. Status-Anzeige oben auf der Übersicht ausblenden
  $$('#nav .nav-item').forEach((a) => a.classList.toggle('active', a.dataset.page === (page.nav || page.id)));
  $('#rail').classList.remove('open');
  document.title = `${page.label} · Blockhaus`;
  // Neues, leeres Element statt nur innerHTML = '': Sonst bleiben die Klick-Handler jeder zuvor
  // geöffneten Seite am Container hängen und ein Klick löst die Aktion mehrfach aus.
  const old = $('#view'), view = old.cloneNode(false);
  old.replaceWith(view);
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  view.classList.add('fresh');  // Karten fliegen nur beim Öffnen der Seite ein
  clearTimeout(S.freshT); S.freshT = setTimeout(() => view.classList.remove('fresh'), 1000);
  window.scrollTo(0, 0);
  const r = VIEWS[page.id](view, param);
  S.cleanup = typeof r === 'function' ? r : null;
  hydrateIcons(view);
}

// Passender Minecraft-Block pro Seite (Texturen aus der Client-Datei)
const PAGE_BLK = {
  overview: 'item/nether_star', console: 'block/command_block_front', players: 'item/armor_stand', chat: 'item/oak_sign',
  history: 'item/clock_00', map: 'item/filled_map', world: 'block/grass_block_side', diagnose: 'block/redstone_torch',
  settings: 'item/comparator', mods: 'block/crafting_table_front', content: 'block/bookshelf', schedules: 'item/compass_00',
  backups: 'block/barrel_side', updates: 'item/experience_bottle', files: 'item/bundle', admins: 'item/writable_book',
};
const blkImg = (p, cls = 'ph-blk') => `<img class="${cls} blk" src="/api/texture?p=${encodeURIComponent(p)}" alt="">`;
const head = (title, sub, actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="actions">${actions}</div></div>`;

// ───────────────────────── Seiten ─────────────────────────
const VIEWS = {};

// ── Übersicht ──
VIEWS.overview = (v) => {
  const me = S.me;
  const addr = me.address ? `${me.address}:${me.port}` : `Port ${me.port}`;
  v.innerHTML = `
  ${head(greeting(), `Alles Wichtige zu deinem Server auf einen Blick.`)}
  <div id="ov-alert"></div><div id="ov-ob"></div>
  <div class="grid g-main">
    <div class="card hero" id="ov-hero"><div class="sky" id="ov-sky"><div class="stars"></div><div class="orb"></div><div class="rain"></div><div class="ground"></div></div><div class="hero-c"></div></div>
    <div class="card"><div class="card-h"><h2>Gerade online</h2><span class="sub" id="ov-pcount"></span><div class="right"><a class="btn btn-ghost btn-sm" href="#/players">Alle ${ico('chevron')}</a></div></div><div class="plist" id="ov-online"></div></div>
  </div>
  <div class="grid g-4" style="margin-top:16px" id="ov-metrics"></div>
  <div class="grid g-main" style="margin-top:16px">
    <div class="card chart-card">
      <div class="card-h"><h2>Vitalwerte</h2><span class="sub" id="ov-span"></span>
        <div class="right"><div class="chart-tabs" id="ov-tabs">
          <button data-k="mspt" class="on">Tick</button><button data-k="jcpu">CPU</button><button data-k="heapUsed">RAM</button><button data-k="players">Spieler</button></div></div></div>
      <div class="chart-bar"><div class="chart-tabs" id="ov-range"><button data-r="live">Live</button><button data-r="1h">1 Std</button><button data-r="24h">24 Std</button><button data-r="7d">7 Tage</button><button data-r="30d">30 Tage</button></div>
        <span class="chart-sum" id="ov-sum"></span></div>
      <div class="chart" id="ov-chart"><canvas></canvas><div class="chart-tip" hidden></div></div>
    </div>
    <div class="card">
      <div class="card-h"><h2>Schnellaktionen</h2></div>
      <div class="quick">
        <button class="qa" data-w="day" style="--qa:var(--gold)">${ico('sun')}<b>Tag</b><small>Zeit auf Morgen</small></button>
        <button class="qa" data-w="night" style="--qa:var(--violet)">${ico('moon')}<b>Nacht</b><small>Zeit auf Abend</small></button>
        <button class="qa" data-w="clear" style="--qa:var(--aqua)">${ico('sun')}<b>Klares Wetter</b><small>Regen stoppen</small></button>
        <button class="qa" data-w="save">${ico('save')}<b>Speichern</b><small>Welt sichern</small></button>
        <button class="qa" data-act="backup" style="--qa:var(--aqua)">${ico('archive')}<b>Backup</b><small>Jetzt erstellen</small></button>
        <button class="qa" data-act="maint" style="--qa:var(--red)">${ico('lock')}<b>Wartung</b><small>${S.maint ? 'beenden' : 'Server sperren'}</small></button>
      </div>
      <form class="broadcast" id="ov-say"><input class="input" name="msg" placeholder="Nachricht an alle Spieler …" maxlength="250" autocomplete="off"><button class="btn btn-primary" title="Senden">${ico('megaphone')}</button></form>
    </div>
  </div>
  <div class="grid g-main" style="margin-top:16px">
    <a class="card" href="#/console" style="text-decoration:none;color:inherit"><div class="card-h"><h2>Live-Log</h2><span class="sub">zum Öffnen klicken</span></div><div class="mini-log" id="ov-log"></div></a>
    <div class="card"><div class="card-h"><h2>System</h2><span class="sub">Rechner</span></div><div id="ov-sys"></div></div>
  </div>`;
  onboardingCard($('#ov-ob', v));
  maybeTour();

  let chartKey = store.get('chartKey', 'mspt');
  if (chartKey === 'jmem') chartKey = 'heapUsed';
  $$('#ov-tabs button', v).forEach((b) => {
    b.classList.toggle('on', b.dataset.k === chartKey);
    b.onclick = () => { chartKey = b.dataset.k; store.set('chartKey', chartKey); $$('#ov-tabs button', v).forEach((x) => x.classList.toggle('on', x === b)); drawChart(); };
  });
  const chart = makeChart($('#ov-chart', v));
  let range = store.get('chartRange', 'live'), hist = null, histAt = 0;
  const HIST_FIELD = { mspt: ['mspt', 'mspt_max'], jcpu: ['jcpu'], heapUsed: ['heap'], players: ['players', 'players_max'] };
  const RANGE_LBL = { '1h': 'letzte Stunde', '24h': 'letzte 24 Stunden', '7d': 'letzte 7 Tage', '30d': 'letzte 30 Tage' };
  const drawChart = () => {
    if (range === 'live') {
      const data = S.history.filter((d) => d[chartKey] != null).map((d) => ({ t: d.t, v: d[chartKey] }));
      const mins = data.length > 1 ? Math.max(1, Math.round((data[data.length - 1].t - data[0].t) / 60)) : 0;
      $('#ov-span', v).textContent = mins ? `live · letzte ${mins} Min` : 'live';
      $('#ov-sum', v).textContent = '';
      return chart.draw(chartKey, data, { live: true });
    }
    $('#ov-span', v).textContent = RANGE_LBL[range];
    if (!hist) return chart.draw(chartKey, [], {});
    const [f, fm] = HIST_FIELD[chartKey];
    const data = hist.points.filter((p) => p[f] != null).map((p) => ({ t: p.t, v: p[f], mx: fm ? p[fm] : null }));
    const s = hist.summary || {};
    const parts = [];
    if (s.tps != null) parts.push(`Ø ${num(s.tps, 1)} TPS`);
    if (s.playersMax != null) parts.push(`max. ${s.playersMax} Spieler`);
    if (s.uptime != null) parts.push(`${num(s.uptime * 100, s.uptime > 0.995 && s.uptime < 1 ? 1 : 0)} % online`);
    if (s.heapMax) parts.push(`RAM bis ${fmtBytes(s.heapMax)}`);
    const coverage = s.first ? (hist.now - s.first) / (hist.now - hist.since) : 0;
    if (s.first && coverage < 0.9) parts.push(`seit ${new Date(s.first * 1000).toLocaleString(I18N.locale, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    $('#ov-sum', v).textContent = parts.join(' · ');
    chart.draw(chartKey, data, { t0: hist.since, t1: hist.now, bucket: hist.bucket });
  };
  const loadHist = async () => {
    if (range === 'live') return drawChart();
    const want = range;
    try { const r = await api('/api/metrics?range=' + want); if (want === range) { hist = r; histAt = Date.now(); } } catch (e) { hist = null; toast(e.message, 'err'); }
    drawChart();
  };
  $$('#ov-range button', v).forEach((b) => {
    b.classList.toggle('on', b.dataset.r === range);
    b.onclick = () => { range = b.dataset.r; store.set('chartRange', range); hist = null; $$('#ov-range button', v).forEach((x) => x.classList.toggle('on', x === b)); drawChart(); loadHist(); };
  });
  if (range !== 'live') loadHist();

  v.addEventListener('click', (e) => {
    const w = e.target.closest('[data-w]');
    if (w) worldAction(w.dataset.w);
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act === 'backup') run(() => post('/api/backups', { action: 'create' }), 'Backup gestartet');
    if (a && a.dataset.act === 'maint') toggleMaintenance();
  });
  $('#ov-say', v).onsubmit = async (e) => {
    e.preventDefault();
    const inp = e.target.msg;
    if (!inp.value.trim()) return;
    const r = await run(() => post('/api/world', { action: 'say', message: inp.value }), 'Nachricht gesendet');
    if (r) inp.value = '';
  };

  const renderAll = () => {
    const st = S.stats;
    const [cls, label] = srvState(st);
    const fresh = st.lastCrash && st.lastCrash > store.get('crashSeen', 0) && Date.now() / 1000 - st.lastCrash < 7 * 86400;
    patch($('#ov-alert', v), (fresh ? `<a class="notice" href="#/diagnose" style="text-decoration:none;border-color:color-mix(in srgb, var(--red) 35%, transparent);background:var(--red-soft)">${ico('alert')}<div><b>Absturz erkannt</b> · ${fmtAgo(st.lastCrash)} – zur Analyse</div></a>` : '')
      + (st.modsPending ? `<a class="notice" href="#/mods" style="text-decoration:none">${ico('restart')}<div><b>Neustart erforderlich</b> – Mod-Änderungen sind noch nicht aktiv. Zu den Mods</div></a>` : ''));
    const hero = $('#ov-hero', v);
    const color = { online: 'var(--accent)', starting: 'var(--gold)', stopping: 'var(--gold)', offline: 'var(--red)' }[cls] || 'var(--muted)';
    hero.style.setProperty('--hero', color);
    updateSky($('#ov-sky', v), st);
    const ig = st.daytime != null ? ingameClock(st.daytime) : null;
    patch($('.hero-c', hero), `
      <div class="hero-state st-${cls}${st.state === 'failed' ? ' crashed' : ''}">${mcube(true)}<div><div class="big">${esc(label)}</div>
      <div class="muted hero-motd">${me.motd ? motdHtml(me.motd.replace(/\\n|\n/g, ' · ')) : 'Minecraft-Server'}</div></div></div>
      <div class="hero-meta">
        <span>Laufzeit <b>${st.uptime != null ? fmtDur(st.uptime) : '–'}</b></span>
        <span>Version <b>${esc((me.version && me.version.mc) || '–')}</b></span>
        <span>Software <b>${esc(me.version ? `${me.version.loaderName || me.version.loader || ''} ${me.version.loaderVersion || ''}` : '–')}</b></span>
        <span>Autostart <b>${st.enabled === 'enabled' ? 'an' : esc(st.enabled || '–')}</b></span>
        ${ig ? `<span class="ingame">Ingame <b>${ig}</b>${st.day ? ` · Tag <b>${st.day}</b>` : ''}${st.thundering ? ' · Gewitter' : st.raining ? ' · Regen' : ''}</span>` : ''}
      </div>
      <div class="addr"><span>${esc(addr)}</span><button class="icon-btn" title="Adresse kopieren" id="ov-copy">${ico('copy')}</button></div>`);
    $('#ov-copy', hero).onclick = () => copy(addr);

    const online = st.online || [];
    $('#ov-pcount', v).textContent = st.maxPlayers ? `${online.length} von ${st.maxPlayers}` : '';
    patch($('#ov-online', v), online.length
      ? online.map((n) => `<div class="prow">${headImg(n)}<div><div class="nm">${esc(n)}</div><div class="meta">online</div></div>
          <div class="right"><button class="icon-btn" title="Heilen" data-pa="heal" data-n="${esc(n)}">${ico('heart')}</button><button class="icon-btn danger" title="Kicken" data-pa="kick" data-n="${esc(n)}">${ico('logout')}</button></div></div>`).join('')
      : `<div class="empty">${ico('users')}${cls === 'online' ? 'Niemand online – der Server pausiert nach 60 s automatisch.' : 'Server ist nicht online.'}</div>`);

    // Echter Verbrauch = belegter Java-Heap (aus den JVM-Zählern); Fallback: Prozessspeicher
    const memMax = st.heapMax || 8 * 1024 ** 3;
    const memUsedJ = st.heapUsed ?? st.jmem;
    const firstMetrics = !v._counted && st.state === 'active' && st.tps != null;
    const jmemPct = memUsedJ ? (memUsedJ / memMax) * 100 : 0;
    const tpsPct = st.tps != null ? (st.tps / 20) * 100 : 0;
    const msptPct = st.mspt != null ? Math.min(100, (st.mspt / 50) * 100) : 0;
    const pPct = st.maxPlayers ? ((st.players || 0) / st.maxPlayers) * 100 : 0;
    patch($('#ov-metrics', v), [
      metric(gauge(tpsPct, st.tps != null ? num(st.tps, 0) : '–', st.tps == null ? css('--muted') : st.tps >= 19 ? css('--accent') : st.tps >= 15 ? css('--gold') : css('--red')), 'TPS', st.tps != null ? `${num(st.tps, 1)} / 20` : '–', st.mspt != null ? `${num(st.mspt, 1)} ms pro Tick` : 'keine Daten'),
      metric(gauge(msptPct, st.mspt != null ? Math.round(msptPct) + '%' : '–', levelColor(msptPct, 60, 90)), 'Tick-Auslastung', st.mspt != null ? `${num(st.mspt, 1)} ms` : '–', 'Budget: 50 ms'),
      metric(gauge(st.jcpu, st.jcpu != null ? Math.round(st.jcpu) + '%' : '–', levelColor(st.jcpu || 0)), 'CPU (Server)', st.jcpu != null ? `${num(st.jcpu, 0)} %` : '–', `System ${num(st.cpu, 0)} % · ${st.ncpu || '–'} Kerne`),
      metric(gauge(jmemPct, memUsedJ ? Math.round(jmemPct) + '%' : '–', levelColor(jmemPct, 80, 95)), 'RAM (Server)', fmtBytes(memUsedJ),
        st.heapUsed ? `belegt · max. ${fmtBytes(memMax)}` : `von max. ${fmtBytes(memMax)}`),
    ].join(''));
    if (firstMetrics) {  // beim ersten Anzeigen: Zahlen zählen hoch, Ringe füllen sich
      v._counted = true;
      $$('#ov-metrics .metric .v', v).forEach((el) => countUp(el));
      if (!REDUCED_MOTION) $$('#ov-metrics .gauge .val', v).forEach((c) => { const to = c.getAttribute('stroke-dashoffset'); c.setAttribute('stroke-dashoffset', c.getAttribute('stroke-dasharray')); requestAnimationFrame(() => requestAnimationFrame(() => c.setAttribute('stroke-dashoffset', to))); });
    }

    const memUsed = st.memTotal && st.memAvail ? st.memTotal - st.memAvail : null;
    const diskUsed = st.diskTotal ? st.diskTotal - st.diskFree : null;
    patch($('#ov-sys', v), `
      ${sysBar('Arbeitsspeicher', memUsed, st.memTotal)}
      ${sysBar('Festplatte', diskUsed, st.diskTotal)}
      <dl class="kv" style="margin-top:14px"><dt>Last (1 Min)</dt><dd>${num(st.load, 2)}</dd><dt>Spieler-Kapazität</dt><dd>${pPct ? num(pPct, 0) + ' %' : '–'}</dd><dt>Prozess-ID</dt><dd>${st.pid || '–'}</dd></dl>`);
  };
  const metric = (g, l, val, s) => `<div class="card metric">${g}<div><div class="lbl">${esc(l)}</div><div class="v">${esc(val)}</div><div class="s">${esc(s)}</div></div></div>`;
  const sysBar = (l, used, total) => {
    const pct = used != null && total ? (used / total) * 100 : 0;
    return `<div style="margin-bottom:12px"><div class="row" style="margin-bottom:6px;font-size:13px"><span>${l}</span><span class="grow"></span><span class="mono muted">${fmtBytes(used)} / ${fmtBytes(total)}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${levelColor(pct, 75, 90)}"></i></div></div>`;
  };
  const renderLog = () => {
    patch($('#ov-log', v), S.logs.filter((e) => !isNoise(e) && e[0] !== 'adminchat').slice(-14).map(([, l]) => `<div>${esc(l.replace(/^\[[^\]]*\] \[[^\]]*\]: /, ''))}</div>`).join(''));
  };
  v.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pa]');
    if (b) { e.preventDefault(); playerAction(b.dataset.pa, b.dataset.n); }
  });

  renderAll(); renderLog(); drawChart();
  const onResize = () => drawChart();
  window.addEventListener('resize', onResize);
  const unsub = sub((ev) => {
    if (ev === 'stats') {
      renderAll();
      if (range === 'live') drawChart();
      else if (Date.now() - histAt > 60000) { histAt = Date.now(); loadHist(); }  // gespeicherte Daten jede Minute neu holen
    }
    if (ev === 'log' || ev === 'logs-reset') renderLog();
  });
  return () => { unsub(); window.removeEventListener('resize', onResize); };
};

// ── Himmel nach Ingame-Tageszeit (0 = 6:00 Uhr Sonnenaufgang, 6000 = Mittag, 12000 = Sonnenuntergang, 18000 = Mitternacht) ──
const SKY_KEYS = [
  [0, '#5b78b8', '#f3a46c', 0.15], [1500, '#4a8ae0', '#a7cff3', 0], [10500, '#4a8ae0', '#a7cff3', 0],
  [12000, '#3d4f90', '#f0895c', 0.2], [13200, '#151b3d', '#2b2654', 0.85], [18000, '#060a1d', '#111737', 1],
  [22800, '#151b3d', '#3a2f5a', 0.7], [24000, '#5b78b8', '#f3a46c', 0.15],
];
const mixHex = (a, b, t) => '#' + [0, 2, 4].map((i) => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - t) + parseInt(b.substr(1 + i, 2), 16) * t).toString(16).padStart(2, '0')).join('');
function ingameClock(dt) { const m = Math.floor(((dt / 1000 + 6) % 24) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function updateSky(el, st) {
  if (!el) return;
  const online = st.state === 'active' && st.daytime != null;
  el.style.opacity = online ? 1 : 0.35;
  const dt = online ? st.daytime : 6000;
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= dt) i++;
  const [t0, a0, b0, s0] = SKY_KEYS[i], [t1, a1, b1, s1] = SKY_KEYS[i + 1];
  const f = (dt - t0) / (t1 - t0 || 1);
  el.style.setProperty('--sky-a', mixHex(a0, a1, f));
  el.style.setProperty('--sky-b', mixHex(b0, b1, f));
  el.style.setProperty('--stars', (s0 + (s1 - s0) * f).toFixed(2));
  const orb = $('.orb', el), day = dt < 12000;
  const p = (day ? dt : dt - 12000) / 12000;             // 0 → Aufgang, 1 → Untergang
  orb.className = 'orb ' + (day ? 'sun' : 'moon');
  orb.style.left = (52 + p * 42) + '%';
  orb.style.top = (88 - Math.sin(p * Math.PI) * 70) + '%';
  el.classList.toggle('raining', !!(online && (st.raining || st.thundering)));
  el.classList.toggle('thundering', !!(online && st.thundering));
}

function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  return `${g}, ${S.me.user}`;
}

function copy(text) {
  const done = () => toast('Kopiert: ' + text);
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() {
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select();
    try { document.execCommand('copy'); done(); } catch { toast('Kopieren nicht möglich', 'err'); }
    t.remove();
  }
}

// Diagramm auf Canvas – leichtgewichtig, ohne Bibliothek.
// draw(key, data, opt): data = [{t, v, mx?}], opt = {t0, t1, bucket, live}
const CHART_CONF = {
  mspt: { col: '--accent', max: (m) => Math.max(60, m * 1.2), fmt: (v) => `${num(v, 1)} ms`, line: 50, lineLbl: '50 ms Limit', mxLbl: 'Spitze' },
  jcpu: { col: '--aqua', max: (m) => Math.max(100, m * 1.1), fmt: (v) => `${num(v, 0)} %` },
  heapUsed: { col: '--violet', max: () => S.stats.heapMax || 8 * 1024 ** 3, fmt: (v) => fmtBytes(v) },
  players: { col: '--gold', max: (m) => Math.max(5, Math.ceil(m) + 2), fmt: (v) => `${num(v, v % 1 ? 1 : 0)} Spieler`, mxLbl: 'max.' },
};
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function makeChart(wrap) {
  const cv = $('canvas', wrap), tip = $('.chart-tip', wrap);
  let last = null, hover = null, pts = [], reveal = 1, revealSig = null;
  function draw(key, data, opt = {}) {
    if (key !== undefined) {
      last = { key: CHART_CONF[key] ? key : 'mspt', data, opt };
      // beim Wechsel von Wert/Zeitraum zeichnet sich die Linie von links nach rechts ein
      const sig = key + '|' + (opt.live ? 'live' : opt.bucket);
      if (sig !== revealSig && data && data.length > 1) {
        revealSig = sig;
        if (!REDUCED_MOTION) {
          reveal = 0;
          const t0 = performance.now();
          const step = (t) => { reveal = Math.min(1, (t - t0) / 750); reveal = 1 - Math.pow(1 - reveal, 3); draw(); if (reveal < 1) requestAnimationFrame(step); };
          requestAnimationFrame(step);
        }
      }
    }
    if (!last) return;
    ({ key, data, opt } = last);
    const dpr = window.devicePixelRatio || 1, w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);
    const cf = CHART_CONF[key], color = css(cf.col), line = css('--line-2'), muted = css('--muted');
    const padL = 6, padR = 6, padT = 14, padB = 20;
    c.font = '11px ui-monospace, monospace';
    c.strokeStyle = line; c.lineWidth = 1; c.setLineDash([2, 4]);
    for (let i = 0; i <= 3; i++) { const y = padT + (h - padT - padB) * i / 3; c.beginPath(); c.moveTo(padL, y); c.lineTo(w - padR, y); c.stroke(); }
    c.setLineDash([]);
    if (!data || data.length < (opt.live ? 2 : 1)) {
      c.fillStyle = muted; c.textAlign = 'center';
      c.fillText(tr(opt.live ? (S.stats.state === 'active' ? 'Daten werden gesammelt …' : 'Keine Daten – Server ist offline') : 'Für diesen Zeitraum gibt es noch keine Daten'), w / 2, h / 2);
      pts = []; tip.hidden = true; return;
    }
    const t1 = opt.t1 || data[data.length - 1].t, t0 = opt.t0 || Math.min(data[0].t, t1 - 60);
    const mx = cf.max(Math.max(...data.map((d) => Math.max(d.v, d.mx ?? 0))));
    const X = (t) => padL + (w - padL - padR) * (t - t0) / (t1 - t0 || 1);
    const Y = (val) => padT + (h - padT - padB) * (1 - Math.min(1, val / mx));
    pts = data.map((d) => ({ x: X(d.t + (opt.bucket ? opt.bucket / 2 : 0)), y: Y(d.v), ym: d.mx != null ? Y(d.mx) : null, v: d.v, mx: d.mx, t: d.t }));
    // in zusammenhängende Abschnitte teilen (Lücke = Server/Panel war aus)
    const gap = opt.bucket ? opt.bucket * 2.5 : 40;
    const segs = [];
    pts.forEach((p, i) => { if (!i || p.t - pts[i - 1].t > gap) segs.push([]); segs[segs.length - 1].push(p); });
    if (cf.line && cf.line < mx) {
      const y = Y(cf.line);
      c.strokeStyle = css('--red'); c.globalAlpha = .5; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(padL, y); c.lineTo(w - padR, y); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      c.fillStyle = css('--red'); c.textAlign = 'right'; c.fillText(cf.lineLbl, w - padR, y - 4);
    }
    const g = c.createLinearGradient(0, padT, 0, h - padB);
    g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
    c.save();
    if (reveal < 1) { c.beginPath(); c.rect(0, 0, padL + (w - padL - padR) * reveal + 6, h); c.clip(); }
    for (const s of segs) {
      if (s.some((p) => p.ym != null)) {  // Band bis zum Spitzenwert
        c.beginPath(); s.forEach((p, i) => (i ? c.lineTo(p.x, p.ym ?? p.y) : c.moveTo(p.x, p.ym ?? p.y)));
        for (let i = s.length - 1; i >= 0; i--) c.lineTo(s[i].x, s[i].y);
        c.closePath(); c.fillStyle = color + '30'; c.fill();
      }
      if (s.length === 1) { c.beginPath(); c.arc(s[0].x, s[0].y, 2.5, 0, Math.PI * 2); c.fillStyle = color; c.fill(); continue; }
      c.beginPath(); c.moveTo(s[0].x, h - padB); s.forEach((p) => c.lineTo(p.x, p.y)); c.lineTo(s[s.length - 1].x, h - padB); c.closePath(); c.fillStyle = g; c.fill();
      c.beginPath(); s.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'round'; c.shadowColor = color; c.shadowBlur = 8; c.stroke(); c.shadowBlur = 0;
    }
    if (opt.live) { const lp = pts[pts.length - 1]; c.beginPath(); c.arc(lp.x, lp.y, 4, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
    c.restore();
    // Achsen-Beschriftung
    c.fillStyle = muted; c.textAlign = 'left'; c.fillText(`max ${cf.fmt(mx)}`, padL, 10);
    const span = t1 - t0;
    const lbl = (t) => { const d = new Date(t * 1000); return span > 2 * 86400 ? d.toLocaleDateString(I18N.locale, { weekday: 'short', day: 'numeric' }) : d.toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit' }); };
    if (opt.live) { c.textAlign = 'right'; c.fillText(tr('jetzt'), w - padR, h - 5); c.textAlign = 'left'; c.fillText(`−${Math.max(1, Math.round(span / 60))} Min`, padL, h - 5); }
    else {
      const n = w < 500 ? 3 : 5;
      for (let i = 0; i <= n; i++) { const t = t0 + span * i / n; c.textAlign = i === 0 ? 'left' : i === n ? 'right' : 'center'; c.fillText(i === n ? 'jetzt' : lbl(t), X(t), h - 5); }
    }
    if (hover != null && pts.length) {
      const p = pts.reduce((a, b) => (Math.abs(b.x - hover) < Math.abs(a.x - hover) ? b : a));
      c.strokeStyle = muted; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, padT); c.lineTo(p.x, h - padB); c.stroke();
      c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI * 2); c.fillStyle = css('--surface'); c.fill(); c.strokeStyle = color; c.lineWidth = 2; c.stroke();
      const d = new Date(p.t * 1000);
      const when = opt.live ? d.toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : d.toLocaleString(I18N.locale, span > 86400 ? { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
      tip.textContent = `${opt.live ? '' : 'Ø '}${cf.fmt(p.v)}${p.mx != null && cf.mxLbl ? ` · ${cf.mxLbl} ${cf.fmt(p.mx)}` : ''} · ${when}`;
      tip.hidden = false;
      const tw = tip.offsetWidth;  // Tooltip immer vollständig im Diagramm halten
      tip.style.left = Math.max(0, Math.min(p.x - tw / 2, w - tw)) + 'px';
    } else tip.hidden = true;
  }
  cv.addEventListener('pointermove', (e) => { hover = e.offsetX; draw(); });
  cv.addEventListener('pointerleave', () => { hover = null; draw(); });
  return { draw };
}

async function worldAction(a, extra = {}) {
  const labels = { day: 'Es ist Tag', noon: 'Mittag', night: 'Es ist Nacht', midnight: 'Mitternacht', clear: 'Wetter klar', rain: 'Regen', thunder: 'Gewitter', save: 'Welt gespeichert', peaceful: 'Friedlich', easy: 'Einfach', normal: 'Normal', hard: 'Schwer', 'kill-items': 'Herumliegende Items entfernt' };
  return run(() => post('/api/world', { action: a, ...extra }), labels[a] || 'Erledigt');
}

// ── Konsole ──
const CMDS = [
  ['list', 'Spieler online'], ['say', 'Nachricht an alle'], ['tellraw', 'Formatierte Nachricht'], ['msg', 'Private Nachricht'],
  ['time set', 'Zeit setzen (day, night, noon …)'], ['weather', 'Wetter (clear, rain, thunder)'], ['difficulty', 'Schwierigkeit'],
  ['gamemode', 'Spielmodus ändern'], ['give', 'Items geben'], ['tp', 'Teleportieren'], ['kick', 'Spieler kicken'],
  ['ban', 'Spieler bannen'], ['pardon', 'Bann aufheben'], ['op', 'Operator machen'], ['deop', 'Operator entfernen'],
  ['whitelist add', 'Zur Whitelist'], ['whitelist remove', 'Von Whitelist entfernen'], ['whitelist list', 'Whitelist anzeigen'],
  ['gamerule', 'Spielregel'], ['save-all', 'Welt speichern'], ['kill', 'Entities töten'], ['effect give', 'Effekt geben'],
  ['experience add', 'XP geben'], ['summon', 'Entity erzeugen'], ['locate structure', 'Struktur finden'], ['seed', 'Welt-Seed'],
  ['tick query', 'Tick-Leistung'], ['spawnpoint', 'Spawnpunkt setzen'], ['setworldspawn', 'Weltspawn setzen'], ['clear', 'Inventar leeren'],
  ['enchant', 'Verzaubern'], ['worldborder set', 'Weltgrenze'], ['banlist', 'Bannliste'], ['scoreboard', 'Scoreboards'],
];

// Technisches Rauschen, das standardmäßig ausgeblendet wird (Punkt 1)
const NOISE = /Thread RCON Client|RCON Listener|\[Viewer - |No clients have pinged|Client connected: clientId=|spark-heath-report-socket/;
const isNoise = (entry) => entry[0] === 'log' && NOISE.test(entry[1]);
function parseLog([kind, line]) {
  if (kind === 'adminchat') {
    const [u, to, ...m] = line.split('|');
    return { kind: 'cmd', cls: 'chat', html: `<span class="t">Admin</span> <b>${esc(u)}</b>${to ? ` → ${esc(to)}` : ''}: ${esc(m.join('|'))}` };
  }
  if (kind !== 'log') return { kind, html: esc(line) };
  const m = line.match(/^\[(\d\d:\d\d:\d\d)\] \[([^\]]+?)\/(\w+)\]: ?(.*)$/);
  if (!m) return { kind, html: esc(line), lvl: 'info' };
  const [, t, th, lvl, msg] = m;
  let cls = lvl === 'WARN' ? 'warn' : lvl === 'ERROR' || lvl === 'FATAL' ? 'error' : '';
  if (!cls && /^<[^>]+>/.test(msg)) cls = 'chat';
  else if (!cls && / (joined|left) the game$/.test(msg)) cls = 'join';
  return { kind, lvl: lvl.toLowerCase(), cls, html: `<span class="t">${t}</span> <span class="th">${esc(th.replace(/^Server thread$/, 'Server'))}</span> <span class="${cls}">${esc(msg)}</span>` };
}

VIEWS.console = (v) => {
  let filter = store.get('logFilter', 'all'), q = '', follow = true, hideNoise = store.get('hideNoise', true);
  v.innerHTML = `${head('Konsole', 'Live-Log des Servers und direkter Befehlszugang (ohne / am Anfang).',
    `<a class="btn" href="/api/download?path=logs/latest.log">${ico('download')}<span>Log herunterladen</span></a>`)}
  <div class="card console-card">
    <div class="console-tools">
      <div class="seg" id="c-filter"><button data-f="all">Alles</button><button data-f="chat">Chat</button><button data-f="warn">Warnungen</button><button data-f="cmd">Befehle</button></div>
      <div class="search-in"><span class="ico" data-i="search"></span><input class="input" id="c-q" placeholder="Im Log suchen …"></div>
      <label class="row" style="gap:8px;font-size:13px;color:var(--text-2)" title="Blendet technische Meldungen aus (RCON-Verbindungen, Karten-Viewer)"><span class="switch"><input type="checkbox" id="c-noise"><span></span></span>Rauschen ausblenden</label>
      <span class="grow"></span>
      <div class="qchips" id="c-quick">${['list', 'tick query', 'save-all', 'whitelist list', 'seed'].map((c) => `<button data-c="${c}">${c}</button>`).join('')}</div>
    </div>
    <div class="console" id="c-out" role="log" aria-live="off"></div>
    <form class="console-in" id="c-form" autocomplete="off">
      <div class="suggest" id="c-sug" hidden></div>
      <span class="prompt">/</span><input id="c-in" placeholder="Befehl eingeben … (Tab = Vervollständigen, ↑↓ = Verlauf)" spellcheck="false" autocapitalize="off">
      <button class="btn btn-primary btn-sm" type="submit">${ico('send')}<span class="hide-mobile">Senden</span></button>
    </form>
  </div>`;
  const out = $('#c-out', v), inp = $('#c-in', v), sug = $('#c-sug', v);
  $$('#c-filter button', v).forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
  const match = (p) => {
    if (filter === 'chat' && !(p.cls === 'chat' || p.cls === 'join')) return false;
    if (filter === 'warn' && !(p.cls === 'warn' || p.cls === 'error' || p.kind === 'err')) return false;
    if (filter === 'cmd' && !(p.kind === 'cmd' || p.kind === 'out' || p.kind === 'sys')) return false;
    return true;
  };
  const lineEl = (entry) => {
    if (hideNoise && isNoise(entry)) return null;
    const p = parseLog(entry);
    if (!match(p)) return null;
    if (q && !entry[1].toLowerCase().includes(q)) return null;
    const d = document.createElement('div');
    d.className = 'l ' + p.kind;
    let html = p.html;
    if (q) html = html.replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (x) => `<mark>${x}</mark>`);
    d.innerHTML = html;
    return d;
  };
  const renderAll = () => {
    const f = document.createDocumentFragment();
    S.logs.slice(-1200).forEach((e) => { const d = lineEl(e); if (d) f.append(d); });
    out.replaceChildren(f);
    if (!out.childElementCount) out.innerHTML = `<div class="empty">${S.logs.length ? 'Keine passenden Zeilen' : 'Noch keine Log-Einträge'}</div>`;
    out.scrollTop = out.scrollHeight;
  };
  const append = (lines) => {
    const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
    const emptyEl = $('.empty', out);
    const f = document.createDocumentFragment();
    lines.forEach((e) => { const d = lineEl(e); if (d) f.append(d); });
    if (f.childElementCount) { emptyEl && emptyEl.remove(); out.append(f); }
    while (out.childElementCount > 1500) out.firstElementChild.remove();
    if (atBottom || follow) { out.scrollTop = out.scrollHeight; follow = false; }
  };
  renderAll();
  $('#c-filter', v).onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; store.set('logFilter', filter); $$('#c-filter button', v).forEach((x) => x.classList.toggle('on', x === b)); renderAll(); };
  $('#c-noise', v).checked = hideNoise;
  $('#c-noise', v).onchange = (e) => { hideNoise = e.target.checked; store.set('hideNoise', hideNoise); renderAll(); };
  let qt; $('#c-q', v).oninput =(e) => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim().toLowerCase(); renderAll(); }, 150); };
  $('#c-quick', v).onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) send(b.dataset.c); };

  const hist = store.get('cmdHist', []);
  let hi = hist.length, sel = 0, items = [];
  async function send(cmd) {
    cmd = cmd.trim().replace(/^\//, '');
    if (!cmd) return;
    if (hist[hist.length - 1] !== cmd) { hist.push(cmd); if (hist.length > 100) hist.shift(); store.set('cmdHist', hist); }
    hi = hist.length;
    follow = true;
    if (/^stop\b/.test(cmd)) {
      const ok = await confirmBox({ title: 'Server stoppen?', text: 'Mit <b>stop</b> fährt der Server herunter. Tipp: Nutze lieber den Stopp-Knopf oben – der bietet einen Countdown.', ok: 'Trotzdem stoppen', danger: true });
      if (!ok) return;
    }
    try { await post('/api/command', { command: cmd }); } catch (e) { toast(e.message, 'err'); }
  }
  const showSug = () => {
    const val = inp.value.replace(/^\//, '');
    const words = val.split(' ');
    items = [];
    if (val && words.length <= 2) {
      items = CMDS.filter(([c]) => c.startsWith(val.toLowerCase()) && c !== val).slice(0, 8).map(([c, d]) => ({ v: c + ' ', c, d }));
    }
    const base = CMDS.find(([c]) => val.startsWith(c + ' '));
    if (!items.length && base && /^(gamemode|kick|ban|pardon|op|deop|tp|give|msg|whitelist add|whitelist remove|effect give|clear|experience add)$/.test(base[0])) {
      const rest = val.slice(base[0].length + 1);
      if (base[0] === 'gamemode' && !rest.includes(' ')) {
        items = ['survival', 'creative', 'adventure', 'spectator'].filter((m) => m.startsWith(rest) && m !== rest).map((m) => ({ v: `gamemode ${m} `, c: m, d: 'Modus' }));
      } else {
        const parts = rest.split(' '); const last = parts[parts.length - 1];
        const names = (S.stats.online || []).filter((n) => n.toLowerCase().startsWith(last.toLowerCase()) && n !== last);
        items = names.map((n) => ({ v: val.slice(0, val.length - last.length) + n + ' ', c: n, d: 'online' }));
      }
    }
    sel = 0;
    sug.hidden = !items.length;
    sug.innerHTML = items.map((it, i) => `<div data-i="${i}" class="${i === sel ? 'on' : ''}">${esc(it.c)}<small>${esc(it.d)}</small></div>`).join('');
  };
  const pick = (i) => { if (!items[i]) return; inp.value = items[i].v; showSug(); inp.focus(); };
  sug.onmousedown = (e) => { const d = e.target.closest('[data-i]'); if (d) { e.preventDefault(); pick(+d.dataset.i); } };
  inp.oninput = showSug;
  inp.onblur = () => setTimeout(() => { sug.hidden = true; }, 120);
  inp.onkeydown = (e) => {
    if (!sug.hidden && items.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        $$('div', sug).forEach((d, i) => d.classList.toggle('on', i === sel)); return;
      }
      if (e.key === 'Tab') { e.preventDefault(); pick(sel); return; }
      if (e.key === 'Escape') { sug.hidden = true; return; }
    }
    if (e.key === 'Tab') e.preventDefault();
    if (e.key === 'ArrowUp' && hi > 0) { e.preventDefault(); inp.value = hist[--hi]; }
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
  };
  $('#c-form', v).onsubmit = (e) => { e.preventDefault(); const c = inp.value; inp.value = ''; sug.hidden = true; send(c); };
  if (window.matchMedia('(min-width: 861px)').matches) setTimeout(() => inp.focus({ preventScroll: true }), 50);
  return sub((ev, data) => { if (ev === 'log') append(data); if (ev === 'logs-reset') renderAll(); });
};

// ── Spieler ──
const BAN_DUR = [[0, 'Dauerhaft'], [3600, '1 Stunde'], [21600, '6 Stunden'], [86400, '1 Tag'], [259200, '3 Tage'], [604800, '1 Woche'], [2592000, '30 Tage']];
async function playerAction(action, name) {
  let reason = '', duration = 0;
  if (action === 'ban') {
    const r = await modal(`<form autocomplete="off"><h3>${esc(name)} bannen?</h3>
      <p>Der Spieler kann den Server nicht betreten, bis der Bann abläuft oder aufgehoben wird.</p>
      <div class="field"><span>Dauer</span><div class="seg" id="ban-dur" style="flex-wrap:wrap">${BAN_DUR.map(([s, l], i) => `<button type="button" data-s="${s}" class="${i === 3 ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <label class="field"><span>Grund (optional, sieht der Spieler)</span><input name="reason" placeholder="z. B. Griefing"></label>
      <div class="btns"><button type="button" class="btn btn-ghost" data-close="x">Abbrechen</button><button class="btn btn-danger">${ico('ban')}Bannen</button></div></form>`, {
      onOpen(box, close) {
        $('#ban-dur', box).onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) $$('#ban-dur button', box).forEach((x) => x.classList.toggle('on', x === b)); };
        $('form', box).onsubmit = (e) => { e.preventDefault(); close({ reason: e.target.reason.value, duration: +$('#ban-dur .on', box).dataset.s }); };
      },
    });
    if (!r) return null;
    reason = r.reason || ''; duration = r.duration;
    return run(() => post('/api/players/action', { action, name, reason, duration }), `${name} gebannt${duration ? ' – ' + BAN_DUR.find((x) => x[0] === duration)[1] : ''}`);
  }
  if (action === 'kick' || action === 'ban-ip') {
    const r = await confirmBox({
      title: `${name} ${action === 'kick' ? 'kicken' : 'bannen'}?`, text: action === 'kick' ? 'Der Spieler wird vom Server geworfen, kann aber wieder joinen.' : 'Der Spieler kann den Server nicht mehr betreten, bis der Bann aufgehoben wird.',
      ok: action === 'kick' ? 'Kicken' : 'Bannen', danger: true, input: true, inputLabel: 'Grund (optional)', placeholder: 'z. B. Griefing',
    });
    if (!r) return null;
    reason = r.value || '';
  }
  if (action === 'op') {
    const ok = await confirmBox({ title: `${name} zum Operator machen?`, text: 'Operatoren haben im Spiel volle Admin-Rechte (Level 4).', ok: 'OP geben' });
    if (!ok) return null;
  }
  const words = { 'whitelist-add': 'zur Whitelist hinzugefügt', 'whitelist-remove': 'von der Whitelist entfernt', op: 'ist jetzt OP', deop: 'ist kein OP mehr', kick: 'gekickt', ban: 'gebannt', pardon: 'entbannt', 'pardon-ip': 'IP entbannt', 'ban-ip': 'IP gebannt', survival: '→ Überleben', creative: '→ Kreativ', adventure: '→ Abenteuer', spectator: '→ Zuschauer', heal: 'geheilt', feed: 'gesättigt' };
  return run(() => post('/api/players/action', { action, name, reason }), `${name} ${words[action] || ''}`);
}

VIEWS.players = (v) => {
  let tab = store.get('ptab', 'all'), data = null, q = '';
  v.innerHTML = `${head('Spieler', 'Whitelist, Operatoren, Banns und Spieler-Aktionen.', `
    <label class="row" style="gap:10px;margin-right:6px"><span class="switch"><input type="checkbox" id="p-wl"><span></span></span><span>Whitelist aktiv</span></label>
    <button class="btn btn-primary" id="p-add">${ico('userplus')}<span>Spieler hinzufügen</span></button>`)}
    <div class="row" style="margin-bottom:16px"><div class="seg" id="p-tabs">
      <button data-t="all">Alle</button><button data-t="online">Online</button><button data-t="wl">Whitelist</button><button data-t="ops">Operatoren</button><button data-t="bans">Gebannt</button></div>
      <span class="grow"></span><div class="search-in"><span class="ico" data-i="search"></span><input class="input" id="p-q" placeholder="Spieler suchen …" style="width:220px"></div></div>
    <div id="p-body"><div class="mods">${'<div class="card"><div class="skeleton" style="width:60%"></div><div class="skeleton" style="margin-top:12px"></div></div>'.repeat(3)}</div></div>`;
  $$('#p-tabs button', v).forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  $('#p-tabs', v).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; store.set('ptab', tab); $$('#p-tabs button', v).forEach((x) => x.classList.toggle('on', x === b)); render(); };
  $('#p-q', v).oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
  $('#p-add', v).onclick = async () => {
    const r = await confirmBox({ title: 'Spieler zur Whitelist hinzufügen', text: 'Der Minecraft-Name (Java Edition). Der Server muss laufen.', ok: 'Hinzufügen', input: true, inputLabel: 'Spielername', placeholder: 'z. B. Notch' });
    if (r && r.value.trim()) { await playerAction('whitelist-add', r.value.trim()); load(); }
  };
  $('#p-wl', v).onchange = async (e) => {
    const on = e.target.checked;
    const r = await run(() => post('/api/players/action', { action: on ? 'whitelist-on' : 'whitelist-off', name: '' }), on ? 'Whitelist aktiviert' : 'Whitelist deaktiviert – jeder kann joinen');
    if (!r) e.target.checked = !on;
  };
  v.addEventListener('click', async (e) => {
    const inv = e.target.closest('[data-inv]');
    if (inv) { openInventory({ uuid: inv.dataset.inv, name: inv.dataset.n }); return; }
    const b = e.target.closest('[data-pa]');
    if (!b) return;
    const r = await playerAction(b.dataset.pa, b.dataset.n);
    if (r) setTimeout(load, 400);
  });
  v.addEventListener('change', async (e) => {
    const s = e.target.closest('select[data-gm]');
    if (!s || !s.value) return;
    await playerAction(s.value, s.dataset.gm); s.value = '';
  });

  async function load() {
    try { data = await api('/api/players'); } catch (e) { $('#p-body', v).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    $('#p-wl', v).checked = data.whitelistOn;
    render();
  }
  function render() {
    if (!data) return;
    const online = new Set(S.stats.online || data.online || []);
    const wl = new Set(data.whitelist), banned = new Set(data.bans.map((b) => b.name));
    let list = data.players.slice();
    for (const n of online) if (!list.some((p) => p.name === n)) list.push({ name: n, uuid: null, stats: null });
    list = list.filter((p) => p.name);
    if (tab === 'online') list = list.filter((p) => online.has(p.name));
    if (tab === 'wl') list = list.filter((p) => wl.has(p.name));
    if (tab === 'ops') list = list.filter((p) => p.name in data.ops);
    if (tab === 'bans') list = list.filter((p) => banned.has(p.name));
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    list.sort((a, b) => (online.has(b.name) - online.has(a.name)) || a.name.localeCompare(b.name));
    let html = list.length ? '<div class="mods">' + list.map((p) => {
      const on = online.has(p.name), isOp = p.name in data.ops, isWl = wl.has(p.name), isBan = banned.has(p.name);
      const st = p.stats;
      const ban = data.bans.find((b) => b.name === p.name);
      return `<div class="card pcard">
        <div class="pcard-top">${headImg(p, 'head head-lg' + (on ? ' online-ring' : ''))}
          <div style="min-width:0"><div class="nm">${p.uuid ? `<a class="plink" href="#/player/${esc(p.uuid)}">${esc(p.name)}</a>` : esc(p.name)}</div>
          <div class="chips" style="margin-top:4px">${on ? '<span class="chip chip-green">● online</span>' : ''}${isOp ? '<span class="chip chip-gold">OP</span>' : ''}${isWl ? '<span class="chip chip-aqua">Whitelist</span>' : ''}${isBan ? '<span class="chip chip-red">Gebannt</span>' : ''}</div></div></div>
        ${isBan && ban ? `<div class="muted" style="font-size:12.5px">Grund: ${esc(ban.reason || '–')} · von ${esc(ban.source || '–')}</div>` : ''}
        <div class="pstats"><div><small>Spielzeit</small><b>${st ? fmtDur(st.playTime) : '–'}</b></div><div><small>Tode</small><b>${st ? st.deaths : '–'}</b></div><div><small>Zuletzt</small><b>${on ? 'jetzt' : st ? fmtAgo(st.lastSeen) : '–'}</b></div></div>
        <div class="pcard-actions">
          ${on ? `<div class="pa-row"><select class="input" data-gm="${esc(p.name)}"><option value="">Spielmodus …</option><option value="survival">Überleben</option><option value="creative">Kreativ</option><option value="adventure">Abenteuer</option><option value="spectator">Zuschauer</option></select>
            <button class="icon-btn" title="Heilen" data-pa="heal" data-n="${esc(p.name)}">${ico('heart')}</button>
            <button class="icon-btn" title="Sättigen" data-pa="feed" data-n="${esc(p.name)}">${ico('food')}</button>
            <button class="icon-btn danger" title="Kicken" data-pa="kick" data-n="${esc(p.name)}">${ico('logout')}</button></div>` : ''}
          <div class="pa-row">
          ${p.uuid ? `<button class="btn btn-sm btn-ghost" title="Inventar & Position" data-inv="${esc(p.uuid)}" data-n="${esc(p.name)}" style="margin-right:auto">${ico('bag')}Inventar</button>` : '<span style="margin-right:auto"></span>'}
          <button class="icon-btn" title="${isOp ? 'OP entziehen' : 'Zum OP machen'}" data-pa="${isOp ? 'deop' : 'op'}" data-n="${esc(p.name)}" style="${isOp ? 'color:var(--gold)' : ''}">${ico('crown')}</button>
          <button class="icon-btn" title="${isWl ? 'Von Whitelist entfernen' : 'Zur Whitelist'}" data-pa="${isWl ? 'whitelist-remove' : 'whitelist-add'}" data-n="${esc(p.name)}" style="${isWl ? 'color:var(--aqua)' : ''}">${ico(isWl ? 'check' : 'plus')}</button>
          <button class="icon-btn danger" title="${isBan ? 'Entbannen' : 'Bannen'}" data-pa="${isBan ? 'pardon' : 'ban'}" data-n="${esc(p.name)}" style="${isBan ? 'color:var(--red)' : ''}">${ico('ban')}</button>
        </div></div></div>`;
    }).join('') + '</div>' : `<div class="card"><div class="empty">${ico('users')}Keine Spieler in dieser Ansicht</div></div>`;
    if (tab === 'bans' && data.ipBans.length) {
      html += `<div class="card card-flush" style="margin-top:16px"><div class="card-h"><h2>Gebannte IPs</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>IP</th><th>Grund</th><th>Seit</th><th></th></tr></thead><tbody>
        ${data.ipBans.map((b) => `<tr><td class="mono">${esc(b.ip)}</td><td>${esc(b.reason || '–')}</td><td class="muted">${esc(b.created || '')}</td><td class="r"><button class="btn btn-sm" data-pa="pardon-ip" data-n="${esc(b.ip)}">Entbannen</button></td></tr>`).join('')}</tbody></table></div></div>`;
    }
    $('#p-body', v).innerHTML = html;
  }
  load();
  let lastOnline = JSON.stringify(S.stats.online || []);
  return sub((ev) => {
    if (ev === 'stats') { const o = JSON.stringify(S.stats.online || []); if (o !== lastOnline) { lastOnline = o; render(); } }
  });
};

// ── Weltkarte (BlueMap) ──
const MAP_NAME = { world: 'Oberwelt', world_the_nether: 'Nether', world_the_end: 'Ende' };
const deRemain = (s) => (s ? s.replace(/(\d+) hours?/, '$1 Std').replace(/(\d+) minutes?/, '$1 Min').replace(/(\d+) seconds?/, '$1 s').replace(/ and |, /g, ' ') : '');
VIEWS.map = (v) => {
  v.innerHTML = `${head('Weltkarte', '3D-Karte deiner Welt. Klicke oben auf der Karte ein Werkzeug an, um Marker zu setzen oder ein Gebiet zu wählen.', '<div class="row" id="map-actions"></div>')}<div id="map-body"><div class="card"><div class="skeleton"></div></div></div>`;
  const body = $('#map-body', v), actions = $('#map-actions', v);
  let info = null, built = false, ctl = null, timer = null;
  async function load() {
    try { info = await api('/api/map'); } catch (e) { if (!built) body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    if (!info.installed) {
      body.innerHTML = `<div class="card"><div class="empty">${ico('map')}${info.disabled ? 'BlueMap ist installiert, aber deaktiviert. Unter <a href="#/mods">Mods</a> aktivieren und neu starten.' : 'BlueMap ist nicht installiert. Unter <a href="#/mods">Mods → Empfohlen/Entdecken</a> installieren.'}</div></div>`;
      return;
    }
    if (!info.configured) {
      body.innerHTML = `<div class="card"><div class="empty">${ico('restart')}BlueMap ist installiert, aber noch nicht geladen. Starte den Server einmal neu.<br><br><button class="btn btn-primary" data-m="restart">${ico('restart')}Neu starten</button></div></div>`;
      return;
    }
    if (!info.accepted) {
      body.innerHTML = `<div class="card" style="max-width:720px"><div class="card-h"><h2>Karte aktivieren</h2></div>
        <p>BlueMap braucht die Block-Texturen aus dem offiziellen Minecraft-Client. Dafür lädt es die Client-Datei einmalig von Mojang herunter.</p>
        <p>Mit dem Klick stimmst du der <a href="https://www.minecraft.net/eula" target="_blank" rel="noopener noreferrer">Minecraft-EULA</a> für diesen Download zu.</p>
        <button class="btn btn-primary" data-m="accept">${ico('check')}EULA zustimmen &amp; Karte aktivieren</button></div>`;
      return;
    }
    if (!built) { built = true; ctl = mapPage(body, actions); }
    ctl.status(info.render);
  }
  v.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    if (b.dataset.m === 'restart') return power('restart');
    if (b.dataset.m === 'accept' && await confirmBox({ title: 'Minecraft-EULA zustimmen?', text: 'BlueMap lädt dann die Minecraft-Client-Datei von Mojang herunter und beginnt, die Karte zu rendern.', ok: 'Ich stimme zu' })) {
      if (await run(() => post('/api/map', { action: 'accept' }), 'BlueMap wird geladen …')) setTimeout(load, 4000);
    }
  });
  load();
  timer = setInterval(load, 8000);
  return () => { clearInterval(timer); ctl && ctl.destroy(); };
};

// ── Welt & Regeln ──
const RULE_DE = {
  advance_time: ['Tageszeit läuft', 'Tag-Nacht-Zyklus'], advance_weather: ['Wetter wechselt', 'Automatischer Wetterwechsel'],
  keep_inventory: ['Inventar behalten', 'Items bleiben nach dem Tod erhalten'], mob_griefing: ['Mob-Griefing', 'Mobs dürfen Blöcke verändern'],
  fall_damage: ['Fallschaden'], fire_damage: ['Feuerschaden'], drowning_damage: ['Ertrinkungsschaden'], freeze_damage: ['Erfrierungsschaden'],
  immediate_respawn: ['Sofortiger Respawn', 'Kein Todesbildschirm'], natural_health_regeneration: ['Natürliche Regeneration'],
  show_death_messages: ['Todesnachrichten im Chat'], show_advancement_messages: ['Fortschritte im Chat'],
  spawn_mobs: ['Mobs spawnen'], spawn_phantoms: ['Phantome spawnen'], spawn_wardens: ['Warden spawnen'], spawn_patrols: ['Patrouillen spawnen'],
  spawn_wandering_traders: ['Fahrende Händler'], spawn_monsters: ['Monster spawnen'],
  players_sleeping_percentage: ['Schlafende Spieler (%)', 'Anteil, der für die Nacht schlafen muss'], respawn_radius: ['Spawn-Radius', 'Streuung beim Respawn in Blöcken'],
  max_entity_cramming: ['Entity-Gedränge', 'Max. Entities auf einem Block'], command_block_output: ['Befehlsblock-Ausgabe'],
  command_blocks_work: ['Befehlsblöcke aktiv'], log_admin_commands: ['Admin-Befehle melden'], send_command_feedback: ['Befehls-Rückmeldung'],
  block_drops: ['Blöcke droppen Items'], entity_drops: ['Entities droppen Items'], mob_drops: ['Mobs droppen Loot'],
  tnt_explodes: ['TNT explodiert'], tnt_explosion_drop_decay: ['TNT-Drops verfallen'], random_tick_speed: ['Random-Tick-Rate', 'Wachstumsgeschwindigkeit'],
  forgive_dead_players: ['Verstorbenen vergeben', 'Wütende Mobs beruhigen sich'], universal_anger: ['Universeller Zorn'],
  water_source_conversion: ['Wasserquellen bilden sich'], lava_source_conversion: ['Lavaquellen bilden sich'],
  elytra_movement_check: ['Elytra-Bewegungsprüfung'], player_movement_check: ['Bewegungsprüfung', 'Anti-Cheat für Bewegung'],
  spectators_generate_chunks: ['Zuschauer laden Chunks'], limited_crafting: ['Eingeschränktes Craften', 'Nur freigeschaltete Rezepte'],
  reduced_debug_info: ['Reduzierte Debug-Info'], global_sound_events: ['Globale Sounds'], spread_vines: ['Ranken wachsen'],
  pvp: ['PvP', 'Spieler können sich angreifen'], allow_entering_nether_using_portals: ['Netherportale nutzbar'],
  players_nether_portal_default_delay: ['Portal-Verzögerung (Ticks)'], players_nether_portal_creative_delay: ['Portal-Verzögerung Kreativ'],
  max_command_sequence_length: ['Max. Befehlskette'], max_command_forks: ['Max. Befehls-Forks'], snow_accumulation_height: ['Schneehöhe'],
  disable_raids: ['Überfälle aus'], raids: ['Überfälle'], fire_spread_radius_around_player: ['Feuer-Ausbreitung (Radius)'],
  creeper_griefing: ['Creeper zerstören Blöcke', 'Mod: Mob Explosion Griefing'], mob_explosion_griefing: ['Mob-Explosionen zerstören Blöcke', 'Mod: Mob Explosion Griefing'],
  wither_griefing: ['Wither zerstört Blöcke', 'Mod: Mob Explosion Griefing'], door_breaking_griefing: ['Zombies brechen Türen auf', 'Mod: Mob Explosion Griefing'],
  ghast_griefing: ['Ghasts zerstören Blöcke', 'Mod: Mob Explosion Griefing'], ender_dragon_griefing: ['Enderdrache zerstört Blöcke', 'Mod: Mob Explosion Griefing'],
  enderman_griefing: ['Endermen nehmen Blöcke', 'Mod: Mob Explosion Griefing'], turtle_egg_griefing: ['Schildkröteneier zertrampeln', 'Mod: Mob Explosion Griefing'],
  block_explosion_drop_decay: ['Block-Explosionen: Drops verfallen', 'z. B. Betten, Respawn-Anker'], mob_explosion_drop_decay: ['Mob-Explosionen: Drops verfallen', 'z. B. Creeper'],
  ender_pearls_vanish_on_death: ['Enderperlen verschwinden beim Tod'], locator_bar: ['Ortungsleiste', 'Zeigt Mitspieler-Richtung an'],
  max_block_modifications: ['Max. Blockänderungen pro Befehl'], projectiles_can_break_blocks: ['Geschosse zerstören Blöcke'],
  spawner_blocks_work: ['Spawner aktiv'], max_snow_accumulation_height: ['Max. Schneehöhe'],
};
const ruleLabel = (id) => {
  const k = id.split(':').pop();
  const de = RULE_DE[k];
  const pretty = k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return { name: de ? de[0] : pretty, desc: de && de[1] ? de[1] : '', mod: !id.startsWith('minecraft:') && id.includes(':') };
};

VIEWS.world = (v) => {
  v.innerHTML = `${head('Welt & Regeln', 'Zeit, Wetter, Schwierigkeit und alle Spielregeln – Änderungen wirken sofort.')}
  <div class="grid g-3">
    <div class="card"><div class="card-h"><h2>Tageszeit</h2></div><div class="quick" style="grid-template-columns:repeat(2,1fr)">
      <button class="qa" data-w="day" style="--qa:var(--gold)">${ico('sunrise')}<b>Morgen</b></button>
      <button class="qa" data-w="noon" style="--qa:var(--gold)">${ico('sun')}<b>Mittag</b></button>
      <button class="qa" data-w="night" style="--qa:var(--violet)">${ico('moon')}<b>Abend</b></button>
      <button class="qa" data-w="midnight" style="--qa:var(--violet)">${ico('moon')}<b>Mitternacht</b></button></div></div>
    <div class="card"><div class="card-h"><h2>Wetter</h2></div><div class="quick" style="grid-template-columns:repeat(3,1fr)">
      <button class="qa" data-w="clear" style="--qa:var(--gold)">${ico('sun')}<b>Klar</b></button>
      <button class="qa" data-w="rain" style="--qa:var(--aqua)">${ico('rain')}<b>Regen</b></button>
      <button class="qa" data-w="thunder" style="--qa:var(--violet)">${ico('storm')}<b>Gewitter</b></button></div></div>
    <div class="card"><div class="card-h"><h2>Schwierigkeit</h2></div>
      <div class="seg" id="w-diff" style="width:100%;display:grid;grid-template-columns:repeat(4,1fr)">
        <button data-d="peaceful">Friedlich</button><button data-d="easy">Einfach</button><button data-d="normal">Normal</button><button data-d="hard">Schwer</button></div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-sm" data-w="save">${ico('save')}Speichern</button>
        <button class="btn btn-sm" id="w-items">${ico('sparkle')}Items aufräumen</button></div></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-h"><h2>Spielregeln</h2><span class="sub" id="w-src"></span>
      <div class="right"><div class="search-in"><span class="ico" data-i="search"></span><input class="input" id="w-q" placeholder="Regel suchen …" style="width:200px;height:32px"></div></div></div>
    <div id="w-rules"><div class="skeleton"></div></div>
  </div>`;
  let rules = [], q = '';
  const setDiff = (d) => $$('#w-diff button', v).forEach((b) => b.classList.toggle('on', b.dataset.d === d));
  api('/api/properties').then((r) => setDiff(r.props.difficulty)).catch(() => {});
  $('#w-diff', v).onclick = async (e) => { const b = e.target.closest('[data-d]'); if (!b) return; const r = await worldAction(b.dataset.d); if (r) setDiff(b.dataset.d); };
  v.addEventListener('click', (e) => { const w = e.target.closest('[data-w]'); if (w) worldAction(w.dataset.w); });
  $('#w-items', v).onclick = async () => {
    const ok = await confirmBox({ title: 'Herumliegende Items entfernen?', text: 'Alle gedroppten Items in geladenen Chunks werden gelöscht. Hilft bei Lag.', ok: 'Aufräumen', danger: true });
    if (ok) worldAction('kill-items');
  };
  $('#w-q', v).oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
  function render() {
    const list = rules.map((r) => ({ ...r, ...ruleLabel(r.id) }))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.includes(q))
      .sort((a, b) => (a.type === 'bool' ? 0 : 1) - (b.type === 'bool' ? 0 : 1) || a.name.localeCompare(b.name, 'de'));
    $('#w-rules', v).innerHTML = list.length ? `<div class="rules">${list.map((r) => `
      <div class="rule"><div class="rt"><b>${esc(r.name)} ${r.mod ? '<span class="chip chip-aqua" style="margin-left:4px">Mod</span>' : ''}</b><code title="${esc(r.desc)}">${esc(r.desc || r.id)}</code></div>
      ${r.type === 'bool' ? `<label class="switch"><input type="checkbox" data-rule="${esc(r.id)}" ${r.value ? 'checked' : ''}><span></span></label>`
        : `<input class="input num" type="number" data-rule="${esc(r.id)}" value="${esc(r.value)}">`}</div>`).join('')}</div>`
      : `<div class="empty">${rules.length ? 'Keine passende Regel' : 'Keine Spielregeln gefunden'}</div>`;
  }
  v.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-rule]');
    if (!el) return;
    const id = el.dataset.rule;
    const value = el.type === 'checkbox' ? el.checked : parseInt(el.value, 10);
    if (el.type !== 'checkbox' && Number.isNaN(value)) return;
    el.disabled = true;
    const r = await run(() => post('/api/gamerules', { id, value }), `${ruleLabel(id).name}: ${value === true ? 'an' : value === false ? 'aus' : value}`);
    el.disabled = false;
    const rule = rules.find((x) => x.id === id);
    if (r && rule) rule.value = value;
    else if (el.type === 'checkbox') el.checked = !value;
  });
  api('/api/gamerules').then((r) => {
    rules = r.rules;
    $('#w-src', v).textContent = r.live ? `${rules.length} Regeln · live vom Server` : `${rules.length} Regeln · aus der Welt-Datei (Server offline)`;
    render();
  }).catch((e) => { $('#w-rules', v).innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
};

// ── Einstellungen (server.properties) ──
const PROPS = [
  ['Allgemein', 'info', [
    ['motd', 'Server-Beschreibung (MOTD)', 'Text in der Serverliste', 'text'],
    ['max-players', 'Maximale Spieler', '', 'int', 1, 1000],
    ['white-list', 'Whitelist', 'Nur freigeschaltete Spieler können joinen', 'bool'],
    ['enforce-whitelist', 'Whitelist erzwingen', 'Nicht freigeschaltete Spieler werden beim Neuladen gekickt', 'bool'],
    ['online-mode', 'Online-Modus', 'Prüft Accounts bei Mojang – nur abschalten, wenn du weißt, was du tust', 'bool'],
    ['pause-when-empty-seconds', 'Pausieren wenn leer (s)', 'Spart Leistung, wenn niemand online ist. 0 = nie', 'int', 0, 86400],
    ['player-idle-timeout', 'AFK-Kick (Minuten)', '0 = aus', 'int', 0, 1440],
    ['hide-online-players', 'Spielerliste verstecken', 'In der Serverliste keine Namen zeigen', 'bool'],
    ['enable-status', 'In Serverliste sichtbar', 'Status/Ping beantworten', 'bool'],
  ]],
  ['Gameplay', 'sword', [
    ['gamemode', 'Standard-Spielmodus', '', 'enum', ['survival', 'creative', 'adventure', 'spectator'], ['Überleben', 'Kreativ', 'Abenteuer', 'Zuschauer']],
    ['force-gamemode', 'Spielmodus erzwingen', 'Spieler beim Join auf den Standardmodus setzen', 'bool'],
    ['difficulty', 'Schwierigkeit', '', 'enum', ['peaceful', 'easy', 'normal', 'hard'], ['Friedlich', 'Einfach', 'Normal', 'Schwer']],
    ['hardcore', 'Hardcore', 'Ein Leben – nach dem Tod Zuschauer', 'bool'],
    ['allow-flight', 'Fliegen erlauben', 'Verhindert Kicks durch Fly-Erkennung (z. B. bei Mods)', 'bool'],
    ['spawn-protection', 'Spawn-Schutz (Blöcke)', 'Radius, in dem nur OPs bauen dürfen. 0 = aus', 'int', 0, 1000],
    ['generate-structures', 'Strukturen generieren', 'Dörfer, Tempel usw. in neuen Chunks', 'bool'],
  ]],
  ['Leistung', 'gauge', [
    ['view-distance', 'Sichtweite (Chunks)', 'Wichtigster Leistungsregler. 8–10 ist ein guter Wert', 'int', 3, 32],
    ['simulation-distance', 'Simulationsdistanz (Chunks)', 'Wie weit Mobs, Redstone und Pflanzen aktiv sind', 'int', 3, 32],
    ['entity-broadcast-range-percentage', 'Entity-Sichtweite (%)', '', 'int', 10, 1000],
    ['max-tick-time', 'Watchdog (ms)', 'Server stoppt, wenn ein Tick länger dauert. -1 = aus', 'int', -1, 600000],
    ['network-compression-threshold', 'Netzwerk-Kompression ab (Bytes)', '', 'int', -1, 65535],
    ['sync-chunk-writes', 'Synchrones Chunk-Speichern', 'Sicherer, aber langsamer', 'bool'],
    ['rate-limit', 'Paket-Limit pro Sekunde', '0 = aus', 'int', 0, 100000],
  ]],
  ['Netzwerk', 'globe', [
    ['server-port', 'Server-Port', 'Achtung: Die Portfreigabe im Router muss dazu passen', 'int', 1, 65535],
    ['server-ip', 'Gebunden an IP', 'Leer lassen = alle Netzwerkkarten', 'text'],
    ['enable-query', 'GameSpy-Query', '', 'bool'],
    ['query.port', 'Query-Port', '', 'int', 1, 65535],
    ['prevent-proxy-connections', 'Proxy/VPN blockieren', '', 'bool'],
    ['accepts-transfers', 'Transfers annehmen', '', 'bool'],
  ]],
  ['Welt', 'globe', [
    ['level-name', 'Welt-Ordner', 'Neuer Name = neue Welt beim nächsten Start', 'text'],
    ['level-seed', 'Seed', 'Nur für neu erzeugte Welten', 'text'],
    ['level-type', 'Welttyp', 'Nur für neu erzeugte Welten', 'text'],
    ['max-world-size', 'Max. Weltgröße (Radius)', '', 'int', 1, 29999984],
  ]],
  ['Ressourcenpaket', 'box', [
    ['resource-pack', 'URL', 'Direkter Download-Link zur .zip', 'text'],
    ['resource-pack-sha1', 'SHA-1', '', 'text'],
    ['require-resource-pack', 'Pflicht', 'Spieler ohne Paket werden getrennt', 'bool'],
    ['resource-pack-prompt', 'Hinweistext', '', 'text'],
  ]],
  ['Rechte & Chat', 'shield', [
    ['op-permission-level', 'OP-Rechtestufe', '', 'enum', ['1', '2', '3', '4'], ['1 – Spawn-Schutz umgehen', '2 – Cheats & Befehlsblöcke', '3 – Spieler verwalten', '4 – Alles']],
    ['function-permission-level', 'Funktions-Rechtestufe', '', 'enum', ['1', '2', '3', '4'], ['1', '2', '3', '4']],
    ['enforce-secure-profile', 'Signierter Chat erzwingen', '', 'bool'],
    ['broadcast-console-to-ops', 'Konsole an OPs senden', '', 'bool'],
    ['log-ips', 'IPs protokollieren', '', 'bool'],
    ['enable-code-of-conduct', 'Verhaltenskodex anzeigen', '', 'bool'],
  ]],
];

VIEWS.settings = (v) => {
  let orig = {}, cur = {}, locked = [], q = '';
  v.innerHTML = `${head('Einstellungen', 'server.properties – die meisten Änderungen werden erst nach einem Neustart aktiv.',
    `<div class="search-in"><span class="ico" data-i="search"></span><input class="input" id="s-q" placeholder="Einstellung suchen …" style="width:220px"></div>`)}
    <div id="s-res"></div><div id="s-sys"></div><div id="s-list"></div>
    <div class="settings-layout"><nav class="toc" id="s-toc"></nav><div id="s-body"><div class="card"><div class="skeleton"></div></div></div></div>`;
  const known = new Set(PROPS.flatMap(([, , items]) => items.map((i) => i[0])));
  function control(key, def) {
    const val = cur[key] ?? '';
    const dis = locked.includes(key) ? 'disabled' : '';
    const [, , , type, a, b] = def;
    if (type === 'bool') return `<label class="switch"><input type="checkbox" data-k="${esc(key)}" ${val === 'true' ? 'checked' : ''} ${dis}><span></span></label>`;
    if (type === 'enum') return `<select class="input" data-k="${esc(key)}" ${dis}>${a.map((o, i) => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(b[i])}</option>`).join('')}${a.includes(val) ? '' : `<option selected>${esc(val)}</option>`}</select>`;
    if (type === 'int') return `<input class="input mono" type="number" data-k="${esc(key)}" value="${esc(val)}" ${a != null ? `min="${a}" max="${b}"` : ''} ${dis}>`;
    return `<input class="input" data-k="${esc(key)}" value="${esc(val)}" ${dis} spellcheck="false">`;
  }
  const rowHtml = (key, def) => `<div class="prop ${cur[key] !== orig[key] ? 'changed' : ''}" data-row="${esc(key)}">
    <div class="pt"><b>${esc(def[1])}${locked.includes(key) ? ' <span class="chip">vom Panel verwaltet</span>' : ''}</b>${def[2] ? `<small>${esc(def[2])}</small>` : ''}<code>${esc(key)}</code></div>
    <div class="pc">${control(key, def)}</div></div>`;
  function render() {
    const groups = PROPS.map(([g, icn, items]) => [g, icn, items.filter((d) => d[0] in orig)]);
    const extra = Object.keys(orig).filter((k) => !known.has(k)).sort().map((k) => {
      const v0 = orig[k];
      return [k, k, '', v0 === 'true' || v0 === 'false' ? 'bool' : /^-?\d+$/.test(v0) ? 'int' : 'text'];
    });
    groups.push(['Erweitert', 'sliders', extra]);
    const filt = (d) => !q || d[0].includes(q) || d[1].toLowerCase().includes(q) || (d[2] || '').toLowerCase().includes(q);
    $('#s-toc', v).innerHTML = groups.filter(([, , it]) => it.some(filt)).map(([g]) => `<a href="#" data-g="${esc(g)}">${esc(g)}</a>`).join('');
    $('#s-body', v).innerHTML = groups.map(([g, , items]) => {
      const it = items.filter(filt);
      if (!it.length) return '';
      return `<div class="card prop-group" id="g-${esc(g)}"><div class="card-h"><h2>${esc(g)}</h2><span class="sub">${it.length}</span></div>${it.map((d) => rowHtml(d[0], d)).join('')}</div>`;
    }).join('') || '<div class="card"><div class="empty">Nichts gefunden</div></div>';
    renderBar();
  }
  function renderBar() {
    const changed = Object.keys(cur).filter((k) => cur[k] !== orig[k]);
    let bar = $('#s-bar', v);
    if (!changed.length) { bar && bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.className = 'savebar'; bar.id = 's-bar'; $('#s-body', v).append(bar); }
    bar.innerHTML = `${ico('info')}<span class="grow"><b>${changed.length} ${changed.length === 1 ? 'Änderung' : 'Änderungen'}</b> <span class="muted hide-mobile">· wirkt nach Neustart</span></span>
      <button class="btn btn-ghost btn-sm" data-s="reset">Verwerfen</button><button class="btn btn-sm" data-s="save">Speichern</button><button class="btn btn-primary btn-sm" data-s="restart">${ico('restart')}Speichern & Neustart</button>`;
  }
  v.addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    cur[el.dataset.k] = el.type === 'checkbox' ? String(el.checked) : el.value;
    const row = el.closest('.prop'); row && row.classList.toggle('changed', cur[el.dataset.k] !== orig[el.dataset.k]);
    renderBar();
  });
  v.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-g]');
    if (t) { e.preventDefault(); const el = document.getElementById('g-' + t.dataset.g); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    const b = e.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'reset') { cur = { ...orig }; render(); return; }
    const changes = {};
    Object.keys(cur).forEach((k) => { if (cur[k] !== orig[k]) changes[k] = cur[k]; });
    if (changes['server-port'] || changes['online-mode'] === 'false') {
      const ok = await confirmBox({ title: 'Wirklich speichern?', text: changes['server-port'] ? `Der Port ändert sich auf <b>${esc(changes['server-port'])}</b>. Die Portfreigabe im Router musst du dann ebenfalls anpassen, sonst ist der Server von außen nicht mehr erreichbar.` : 'Ohne Online-Modus können sich Spieler mit beliebigen Namen anmelden – auch als du.', ok: 'Speichern', danger: true });
      if (!ok) return;
    }
    const r = await run(() => post('/api/properties', { changes }), 'Einstellungen gespeichert');
    if (!r) return;
    orig = { ...cur }; render();
    if (b.dataset.s === 'restart') power('restart');
  });
  $('#s-q', v).oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
  resourcesCard($('#s-res', v));
  systemCard($('#s-sys', v));
  if (S.me.hasServer) serverListCard($('#s-list', v));
  api('/api/properties').then((r) => { orig = r.props; cur = { ...orig }; locked = r.locked; render(); hydrateIcons(v); })
    .catch((e) => { $('#s-body', v).innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; });
};

// ── Mods ──
VIEWS.mods = (v) => {
  let tab = store.get('modTab', 'installed'), updates = {}, q = '', offset = 0;
  const V = ver(), W = contentWord(), W1 = contentWord(false), dir = V.dir;
  if (!V.kind) {
    v.innerHTML = `${head('Mods & Plugins', `Der Server läuft mit <b>Vanilla ${esc(V.mc || '')}</b>.`)}
      <div class="card"><div class="empty">${ico('box')}<div><b>Vanilla lädt keine Mods und keine Plugins.</b><br>Datapacks funktionieren weiterhin – unter <a href="#/content">Datapacks &amp; Pakete</a>.</div></div>
        <div class="notice info" style="margin:0">${ico('info')}<div>Für Mods (z. B. Performance, Voice-Chat, 3D-Karte) unter <a href="#/updates">Updates</a> auf <b>Fabric</b>, <b>NeoForge</b> oder <b>Forge</b> wechseln, für Plugins auf <b>Paper</b> oder <b>Purpur</b>. Früher genutzte Mods/Plugins wurden beim Wechsel geparkt und kommen dann automatisch zurück.</div></div></div>`;
    return;
  }
  v.innerHTML = `${head(W, `${esc(V.loaderName)}-${W} für <b>Minecraft ${esc(V.mc || '')}</b> · Ordner <span class="mono">${esc(dir)}/</span>. Änderungen wirken nach einem Neustart.`,
    `<button class="btn" id="m-restart">${ico('restart')}<span>Neu starten</span></button><button class="btn" id="m-up">${ico('upload')}<span>.jar hochladen</span></button><input type="file" id="m-file" accept=".jar" multiple hidden>`)}
    <div class="row" style="margin-bottom:16px"><div class="seg" id="m-tabs"><button data-t="installed">Installiert</button><button data-t="rec">${ico('sparkle')} Empfohlen</button><button data-t="discover">${ico('search')} Entdecken</button></div>
      <span class="grow"></span><div id="m-tools" class="row"></div></div>
    <div id="m-pane"></div>`;
  const pane = $('#m-pane', v), tools = $('#m-tools', v);
  $$('#m-tabs button', v).forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  $('#m-tabs', v).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; store.set('modTab', tab); $$('#m-tabs button', v).forEach((x) => x.classList.toggle('on', x === b)); show(); };
  $('#m-restart', v).onclick = () => power('restart');
  $('#m-up', v).onclick = () => $('#m-file', v).click();
  $('#m-file', v).onchange = async (e) => { await uploadFiles([...e.target.files], dir); e.target.value = ''; tab = 'installed'; show(); };
  function show() {
    pane.innerHTML = ''; tools.innerHTML = '';
    if (tab === 'installed') {
      pane.innerHTML = '<div id="m-pending"></div><div id="m-body" class="mods"></div>';
      tools.innerHTML = `<span class="muted upd-info" id="m-upd-info">Suche nach Updates …</span><button class="btn btn-primary btn-sm" id="m-upd-all" hidden>${ico('download')}Alle aktualisieren</button>`;
      load(); checkUpdates();
    } else if (tab === 'rec') {
      recommendedMods(pane);
    } else {
      pane.innerHTML = `<form class="row" id="m-sform" style="margin-bottom:16px"><div class="search-in grow"><span class="ico">${svg('search')}</span><input class="input" name="q" placeholder="${isPlugins() ? 'Plugins auf Modrinth suchen – z. B. „luckperms“, „graves“, „chunky“ …' : 'Auf Modrinth suchen – z. B. „chunky“, „voice chat“, „backup“ …'}" value="${esc(q)}" autocomplete="off"></div><button class="btn btn-primary">Suchen</button></form>
        <div class="notice info">${ico('info')}<div>${isPlugins() ? `Es werden nur <b>Plugins</b> (Paper/Spigot/Bukkit) mit einer Version für Minecraft ${esc(V.mc || '')} angezeigt.` : `Es werden nur Mods angezeigt, die <b>auf dem Server laufen</b> und eine Version für ${esc(V.loaderName)} ${esc(V.mc || '')} haben.`} Benötigte Abhängigkeiten werden automatisch mitinstalliert.</div></div>
        <div id="m-results" class="mods"></div><div class="row" style="justify-content:center;margin-top:16px"><button class="btn" id="m-more" hidden>Mehr laden</button></div>`;
      $('#m-sform', v).onsubmit = (e) => { e.preventDefault(); q = e.target.q.value.trim(); offset = 0; search(); };
      $('#m-more', v).onclick = () => { offset += 24; search(true); };
      search();
    }
  }
  async function search(more) {
    const box = $('#m-results', v);
    if (!more) box.innerHTML = '<div class="card"><div class="skeleton" style="width:50%"></div><div class="skeleton" style="margin-top:12px"></div></div>'.repeat(3);
    let r;
    try { r = await api(`/api/modrinth/search?q=${encodeURIComponent(q)}&offset=${offset}`); } catch (e) { box.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    const have = new Set(r.installed);
    const html = r.hits.map((m) => `<div class="card mod">
      <div class="mod-top">${m.icon_url ? `<img class="mod-ico" src="${esc(m.icon_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(m.title[0])}">` : `<span class="mod-ico">${esc(m.title[0])}</span>`}
        <div style="min-width:0"><div class="nm">${esc(m.title)}</div><div class="ver">von ${esc(m.author)} · ${fmtNum(m.downloads)} Downloads</div></div></div>
      <p title="${esc(m.description)}">${esc(m.description)}</p>
      <div class="chips">${!isPlugins() && m.server_side === 'required' ? '<span class="chip chip-aqua">nur Server nötig</span>' : ''}${!isPlugins() && m.client_side === 'required' ? '<span class="chip chip-gold">auch Spieler brauchen ihn</span>' : ''}${(m.categories || []).slice(0, 3).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      <div class="mod-foot"><a class="btn btn-ghost btn-sm" href="https://modrinth.com/${isPlugins() ? 'plugin' : 'mod'}/${esc(m.slug)}" target="_blank" rel="noopener noreferrer">${ico('external')}Details</a><span class="grow"></span>
        ${have.has(m.project_id) ? `<span class="chip chip-green">${ico('check')} installiert</span>` : `<button class="btn btn-primary btn-sm" data-inst="${esc(m.project_id)}" data-title="${esc(m.title)}" data-client="${m.client_side === 'required' ? 1 : ''}">${ico('download')}Installieren</button>`}</div></div>`).join('');
    if (more) box.insertAdjacentHTML('beforeend', html); else box.innerHTML = html || `<div class="card"><div class="empty">${ico('search')}Nichts gefunden</div></div>`;
    $('#m-more', v).hidden = offset + 24 >= r.total;
  }
  async function checkUpdates() {
    try { updates = (await api('/api/modrinth/updates')).updates; } catch (e) { const i = $('#m-upd-info', v); if (i) i.textContent = 'Update-Prüfung nicht möglich'; return; }
    const n = Object.values(updates).filter((e) => e.status === 'update').length;
    const i = $('#m-upd-info', v), b = $('#m-upd-all', v);
    if (i) i.innerHTML = n ? `<b style="color:var(--gold)">${n} ${n === 1 ? 'Update' : 'Updates'} verfügbar</b>` : `${ico('check')}Alle ${W} aktuell`;
    if (b) b.hidden = !n;
    load();
  }
  v.addEventListener('click', async (e) => {
    const ins = e.target.closest('[data-inst]');
    if (ins) {
      if (ins.dataset.client) {
        const ok = await confirmBox({ title: `${ins.dataset.title} installieren?`, text: isPlugins() ? 'Für dieses Plugin brauchen Spieler <b>zusätzlich einen Client-Mod</b>, sonst funktioniert es für sie nicht.' : 'Dieser Mod muss <b>auch bei jedem Spieler</b> installiert sein, sonst können sie nicht mehr joinen.', ok: 'Trotzdem installieren' });
        if (!ok) return;
      }
      ins.disabled = true; ins.innerHTML = `<span class="spinner"></span>Lädt …`;
      const r = await run(() => post('/api/modrinth/install', { project: ins.dataset.inst }), (x) => `Installiert: ${x.installed.join(', ')} – Neustart nötig`);
      if (r) ins.outerHTML = `<span class="chip chip-green">${ico('check')} installiert</span>`; else { ins.disabled = false; ins.innerHTML = `${ico('download')}Installieren`; }
      return;
    }
    const up = e.target.closest('[data-upd], #m-upd-all');
    if (up) {
      up.disabled = true;
      const body = up.id === 'm-upd-all' ? { all: true } : { file: up.dataset.upd };
      if (await run(() => post('/api/modrinth/update', body), (x) => `Aktualisiert: ${x.updated.length} – Neustart nötig`)) checkUpdates();
      else up.disabled = false;
    }
  });
  v.addEventListener('change', async (e) => {
    const s = e.target.closest('[data-toggle]');
    if (!s) return;
    if (await run(() => post('/api/mods/action', { action: 'toggle', file: s.dataset.toggle }), s.checked ? `${W1} aktiviert – Neustart nötig` : `${W1} deaktiviert – Neustart nötig`)) load();
    else s.checked = !s.checked;
  });
  v.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-del]');
    if (!d) return;
    const ok = await confirmBox({ title: `${W1} löschen?`, text: `<span class="mono">${esc(d.dataset.del)}</span> wird endgültig entfernt.`, ok: 'Löschen', danger: true });
    if (ok && await run(() => post('/api/mods/action', { action: 'delete', file: d.dataset.del }), `${W1} gelöscht`)) load();
  });
  dropZone(v, async (files) => { await uploadFiles(files.filter((f) => f.name.endsWith('.jar')), dir); if (tab === 'installed') { load(); checkUpdates(); } });
  async function load() {
    let r;
    const body = $('#m-body', v);
    if (!body) return;
    try { r = await api('/api/mods'); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!body.isConnected) return;
    const pend = (r.pending && r.pending.files) || {};
    const removed = (r.pending && r.pending.removed) || [];
    const PEND = { new: ['Neu – wird beim Neustart geladen', 'chip-gold'], update: ['Aktualisiert – Neustart nötig', 'chip-gold'], disabled: ['Deaktiviert – läuft bis zum Neustart', 'chip-gold'] };
    const nPend = Object.keys(pend).length + removed.length;
    const pb = $('#m-pending', v);
    if (pb) {
      pb.innerHTML = nPend ? `<div class="notice restart-notice">${ico('restart')}<div class="grow"><b>Neustart erforderlich</b> – ${nPend} ${nPend === 1 ? 'Änderung ist' : 'Änderungen sind'} noch nicht aktiv.
        ${removed.length ? `<div class="muted" style="font-size:12.5px;margin-top:2px">Gelöscht, aber noch geladen: ${removed.map(esc).join(', ')}</div>` : ''}</div>
        <button class="btn btn-sm btn-primary" id="m-pend-restart">${ico('restart')}Jetzt neu starten</button></div>` : '';
      const rb = $('#m-pend-restart', pb); if (rb) rb.onclick = () => power('restart');
    }
    const updBadge = (f) => {
      const u = updates[f];
      if (!u) return '';
      if (u.status === 'update') return `<button class="btn btn-sm" data-upd="${esc(f)}" title="${esc(u.current)} → ${esc(u.latest)}" style="color:var(--gold)">${ico('download')}Update</button>`;
      if (u.status === 'unknown') return '<span class="chip" title="Nicht auf Modrinth gefunden – manuell installiert">manuell</span>';
      return '';
    };
    body.innerHTML = r.mods.length ? r.mods.map((m) => `
      <div class="card mod ${m.enabled ? '' : 'off'}">
        <div class="mod-top">${m.hasIcon ? `<img class="mod-ico" src="/api/mods/icon?file=${encodeURIComponent(m.file)}" alt="" loading="lazy" data-fallback="${esc((m.name || m.file)[0])}">` : `<span class="mod-ico">${esc((m.name || m.file)[0].toUpperCase())}</span>`}
          <div style="min-width:0"><div class="nm">${esc(m.name || m.file)}</div><div class="ver">${esc(m.version || '')}${m.authors && m.authors.length ? ' · ' + esc(m.authors.join(', ')) : ''}</div></div></div>
        ${m.description ? `<p title="${esc(m.description)}">${esc(m.description)}</p>` : ''}
        ${pend[m.file] || m.compatible === false ? `<div class="chips">${pend[m.file] ? `<span class="chip ${PEND[pend[m.file]][1]}">${ico('restart')}${PEND[pend[m.file]][0]}</span>` : ''}${m.compatible === false ? `<span class="chip chip-red" title="Diese Datei ist für ${esc(typeName(m.types))} gebaut und wird von ${esc(V.loaderName)} nicht geladen">${ico('alert')}${esc(typeName(m.types))} – läuft nicht mit ${esc(V.loaderName)}</span>` : ''}</div>` : ''}
        <div class="mod-foot"><label class="switch" title="${m.enabled ? 'Deaktivieren' : 'Aktivieren'}"><input type="checkbox" data-toggle="${esc(m.file)}" ${m.enabled ? 'checked' : ''}><span></span></label>
          <span class="muted mono" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(m.file)}">${fmtBytes(m.size)}</span><span class="grow"></span>
          ${updBadge(m.file)}
          <a class="icon-btn" title="Herunterladen" href="/api/download?path=${encodeURIComponent('mods/' + m.file)}">${ico('download')}</a>
          <button class="icon-btn danger" title="Löschen" data-del="${esc(m.file)}">${ico('trash')}</button></div>
      </div>`).join('') : `<div class="card"><div class="empty">${ico('box')}Keine ${W} installiert</div></div>`;
  }
  show();
  let lastPending = S.stats.modsPending;
  return sub((ev) => {
    if (ev === 'stats' && S.stats.modsPending !== lastPending) { lastPending = S.stats.modsPending; if (tab === 'installed') load(); }
  });
};
const TYPE_NAMES = { fabric: 'Fabric-Mod', quilt: 'Quilt-Mod', forge: 'Forge-Mod', neoforge: 'NeoForge-Mod', plugin: 'Plugin' };
const typeName = (types) => (types || []).map((t) => TYPE_NAMES[t] || t).join(' / ') || 'unbekannt';
// Zahl in einem Element von 0 hochzählen lassen (Format/Einheit bleiben erhalten)
function countUp(el, ms = 700) {
  if (REDUCED_MOTION || !el) return;
  const txt = el.textContent, m = txt.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return;
  const target = parseFloat(m[0].replace(',', '.')), dec = (m[0].split(/[.,]/)[1] || '').length;
  if (!target) return;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    if (!el.isConnected) return;
    el.textContent = txt.replace(m[0], (target * e).toFixed(dec).replace('.', I18N.dec));
    if (p < 1) requestAnimationFrame(step); else el.textContent = txt;
  };
  requestAnimationFrame(step);
}
const fmtNum = (n) => (n >= 1e6 ? num(n / 1e6, 1) + ' Mio' : n >= 1e4 ? num(n / 1e3, 0) + ' Tsd' : n >= 1e3 ? num(n / 1e3, 1) + ' Tsd' : String(n ?? 0));

async function uploadFiles(files, dir) {
  for (const f of files) {
    toast(`Lade ${f.name} hoch …`);
    try {
      await api(`/api/upload?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(f.name)}`, { method: 'PUT', raw: f });
      toast(`${f.name} hochgeladen`);
    } catch (e) { toast(`${f.name}: ${e.message}`, 'err'); }
  }
}
function dropZone(el, onFiles) {
  let n = 0;
  el.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); n++; el.classList.add('drop'); } });
  el.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  el.addEventListener('dragleave', () => { if (--n <= 0) { n = 0; el.classList.remove('drop'); } });
  el.addEventListener('drop', (e) => { e.preventDefault(); n = 0; el.classList.remove('drop'); const f = [...e.dataTransfer.files]; if (f.length) onFiles(f); });
}

// ── Backups ──
VIEWS.backups = (v) => {
  v.innerHTML = `${head('Backups', 'Sicherungen der Welt. Backups laufen mit niedriger Priorität, damit der Server flüssig bleibt.',
    `<button class="btn btn-primary" id="b-new">${ico('plus')}<span>Backup jetzt erstellen</span></button>`)}
    <div class="grid g-4" id="b-stats"></div>
    <div class="grid g-main" style="margin-top:16px">
      <div class="card card-flush"><div class="card-h"><h2>Sicherungen</h2><span class="sub" id="b-count"></span></div><div class="table-wrap" id="b-list"></div></div>
      <div class="card"><div class="card-h"><h2>Automatik</h2></div>
        <form id="b-auto">
          <label class="field"><span>Automatisches Backup alle … Stunden</span><input class="input mono" name="h" type="number" min="0" max="168" step="1"></label>
          <label class="field"><span>Automatische Backups behalten</span><input class="input mono" name="k" type="number" min="1" max="100"></label>
          <p class="muted" style="font-size:12.5px;margin:0 0 14px">0 Stunden = Automatik aus. Ältere automatische Backups werden gelöscht, manuelle bleiben erhalten.</p>
          <button class="btn btn-primary btn-sm">Übernehmen</button></form>
        <div class="notice info" style="margin:18px 0 0">${ico('info')}<div>Vor jeder Wiederherstellung wird die aktuelle Welt automatisch gesichert (<span class="mono">…-vor-restore</span>).</div></div>
      </div>
    </div>`;
  $('#b-new', v).onclick = () => run(() => post('/api/backups', { action: 'create' }), 'Backup gestartet – läuft im Hintergrund');
  $('#b-auto', v).onsubmit = async (e) => {
    e.preventDefault();
    if (await run(() => post('/api/admins', { action: 'settings', settings: { auto_backup_hours: +e.target.h.value, auto_backup_keep: +e.target.k.value } }), 'Automatik gespeichert')) load();
  };
  v.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-b]');
    if (!b) return;
    const name = b.dataset.n;
    if (b.dataset.b === 'del') {
      const ok = await confirmBox({ title: 'Backup löschen?', text: `<span class="mono">${esc(name)}</span> wird endgültig gelöscht.`, ok: 'Löschen', danger: true });
      if (ok && await run(() => post('/api/backups', { action: 'delete', name }), 'Backup gelöscht')) load();
    }
    if (b.dataset.b === 'restore') {
      const ok = await confirmBox({ title: 'Backup wiederherstellen?', text: `Der Server wird gestoppt, die aktuelle Welt gesichert und durch <span class="mono">${esc(name)}</span> ersetzt. Danach startet der Server wieder.<br><br>Zum Bestätigen <b>wiederherstellen</b> eintippen:`, ok: 'Wiederherstellen', danger: true, input: true, inputLabel: '', placeholder: 'wiederherstellen', requireText: 'wiederherstellen' });
      if (ok) run(() => post('/api/backups', { action: 'restore', name }), 'Wiederherstellung gestartet');
    }
  });
  async function load() {
    let r;
    try { r = await api('/api/backups'); } catch (e) { $('#b-list', v).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const total = r.backups.reduce((a, b) => a + b.size, 0);
    const last = r.backups[0];
    const st = (l, val, s) => `<div class="card metric"><div><div class="lbl">${l}</div><div class="v">${val}</div><div class="s">${s}</div></div></div>`;
    $('#b-stats', v).innerHTML = st('Letztes Backup', last ? fmtAgo(last.mtime) : '–', last ? fmtDate(last.mtime) : 'noch keins')
      + st('Anzahl', r.backups.length, `${r.backups.filter((b) => b.kind === 'auto').length} automatisch`)
      + st('Belegt', fmtBytes(total), `Freier Platz: ${fmtBytes(S.stats.diskFree)}`)
      + st('Weltgröße', fmtBytes(r.worldSize), 'unkomprimiert');
    $('#b-count', v).textContent = r.backups.length ? `${r.backups.length} Dateien` : '';
    const f = $('#b-auto', v); f.h.value = r.autoHours; f.k.value = r.autoKeep;
    const chip = { auto: 'chip-aqua', manuell: 'chip-green', 'pre-restore': 'chip-gold', 'vor-update': 'chip-gold', serverdateien: '' };
    const lbl = { auto: 'Auto', manuell: 'Manuell', 'pre-restore': 'Vor Restore', 'vor-update': 'Welt vor Update', serverdateien: 'Serverdateien' };
    $('#b-list', v).innerHTML = r.backups.length ? `<table class="table"><thead><tr><th>Zeitpunkt</th><th>Art</th><th class="r">Größe</th><th class="r"></th></tr></thead><tbody>
      ${r.backups.map((b) => `<tr><td><b>${fmtDate(b.mtime)}</b><div class="muted mono" style="font-size:11.5px;overflow-wrap:anywhere">${esc(b.name)}</div></td>
        <td><span class="chip ${chip[b.kind]}">${lbl[b.kind]}</span></td><td class="r mono">${fmtBytes(b.size)}</td>
        <td class="r"><a class="icon-btn" title="Herunterladen" href="/api/download?backup=${encodeURIComponent(b.name)}">${ico('download')}</a>
        <button class="icon-btn" title="Wiederherstellen" data-b="restore" data-n="${esc(b.name)}">${ico('restart')}</button>
        <button class="icon-btn danger" title="Löschen" data-b="del" data-n="${esc(b.name)}">${ico('trash')}</button></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">${ico('archive')}Noch keine Backups – erstelle das erste mit dem Knopf oben.</div>`;
    $('#b-new', v).disabled = !!S.task;
  }
  load();
  return sub((ev, prev) => { if (ev === 'task') { $('#b-new', v).disabled = !!S.task; if (prev && !S.task) load(); } });
};

// ── Dateien ──
const TEXT_EXT = /\.(txt|json|json5|properties|cfg|conf|toml|ya?ml|log|sh|md|mcmeta|ini|csv|xml|js|snbt|lang|bat)$/i;
VIEWS.files = (v) => {
  let path = store.get('fpath', '');
  v.innerHTML = `${head('Dateien', 'Alle Dateien im Server-Ordner. Bearbeiten, hochladen, herunterladen.',
    `<button class="btn" id="f-mkdir">${ico('folderplus')}<span>Neuer Ordner</span></button><button class="btn btn-primary" id="f-up">${ico('upload')}<span>Hochladen</span></button><input type="file" id="f-file" multiple hidden>`)}
    <div class="card card-flush" id="f-card"><div class="card-h" style="padding-bottom:12px"><div class="crumbs" id="f-crumbs"></div><div class="right"><button class="icon-btn" id="f-reload" title="Neu laden">${ico('refresh')}</button></div></div>
    <div class="table-wrap" id="f-list"></div></div>
    <p class="muted" style="font-size:12.5px;margin-top:10px">Tipp: Dateien einfach auf die Liste ziehen, um sie in den aktuellen Ordner hochzuladen.</p>`;
  const join = (a, b) => (a ? a + '/' + b : b);
  $('#f-reload', v).onclick = () => load();
  $('#f-up', v).onclick = () => $('#f-file', v).click();
  $('#f-file', v).onchange = async (e) => { await uploadFiles([...e.target.files], path); e.target.value = ''; load(); };
  $('#f-mkdir', v).onclick = async () => {
    const r = await confirmBox({ title: 'Neuer Ordner', ok: 'Erstellen', input: true, inputLabel: 'Name', placeholder: 'ordner' });
    if (r && r.value.trim() && await run(() => post('/api/files/action', { action: 'mkdir', path: path || '.', name: r.value.trim() }), 'Ordner erstellt')) load();
  };
  dropZone($('#f-card', v), async (files) => { await uploadFiles(files, path); load(); });
  v.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cd]');
    if (c) { path = c.dataset.cd; store.set('fpath', path); load(); return; }
    const a = e.target.closest('[data-fa]');
    if (!a) return;
    const p = a.dataset.p, name = p.split('/').pop();
    if (a.dataset.fa === 'edit') editFile(p);
    if (a.dataset.fa === 'del') {
      const ok = await confirmBox({ title: `${a.dataset.dir ? 'Ordner' : 'Datei'} löschen?`, text: `<span class="mono">${esc(p)}</span>${a.dataset.dir ? ' und <b>alles darin</b>' : ''} wird endgültig gelöscht.`, ok: 'Löschen', danger: true, ...(a.dataset.dir ? { input: true, inputLabel: `Zum Bestätigen „${name}“ eintippen`, requireText: name } : {}) });
      if (ok && await run(() => post('/api/files/action', { action: 'delete', path: p }), 'Gelöscht')) load();
    }
    if (a.dataset.fa === 'ren') {
      const r = await modal(`<form><h3>Umbenennen</h3><label class="field"><span>Neuer Name</span><input name="value" value="${esc(name)}" autocomplete="off"></label>
        <div class="btns"><button type="button" class="btn btn-ghost" data-close="x">Abbrechen</button><button class="btn btn-primary">Umbenennen</button></div></form>`);
      if (r && r.value.trim() && r.value !== name && await run(() => post('/api/files/action', { action: 'rename', path: p, name: r.value.trim() }), 'Umbenannt')) load();
    }
  });
  async function load() {
    let r;
    try { r = await api('/api/files?path=' + encodeURIComponent(path)); } catch (e) {
      if (path) { path = ''; store.set('fpath', ''); return load(); }
      $('#f-list', v).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return;
    }
    path = r.path;
    const parts = path ? path.split('/') : [];
    $('#f-crumbs', v).innerHTML = `<button data-cd="">${ico('home')}</button>` + parts.map((p, i) => `<span>/</span><button data-cd="${esc(parts.slice(0, i + 1).join('/'))}">${esc(p)}</button>`).join('');
    const up = path ? `<tr><td colspan="4"><div class="fname">${ico('up')}<button data-cd="${esc(parts.slice(0, -1).join('/'))}">..</button></div></td></tr>` : '';
    $('#f-list', v).innerHTML = `<table class="table"><thead><tr><th>Name</th><th class="r hide-mobile">Größe</th><th class="r hide-mobile">Geändert</th><th class="r"></th></tr></thead><tbody>${up}
      ${r.entries.map((e) => {
        const p = join(path, e.name);
        const editable = !e.dir && (TEXT_EXT.test(e.name) || !e.name.includes('.')) && e.size < 2 * 1024 * 1024;
        return `<tr><td><div class="fname">${ico(e.dir ? 'folder' : 'file', e.dir ? 'dir' : '')}${e.dir ? `<button data-cd="${esc(p)}">${esc(e.name)}</button>` : editable ? `<button data-fa="edit" data-p="${esc(p)}">${esc(e.name)}</button>` : `<span>${esc(e.name)}</span>`}</div></td>
        <td class="r mono muted hide-mobile">${e.dir ? '' : fmtBytes(e.size)}</td><td class="r muted hide-mobile">${fmtAgo(e.mtime)}</td>
        <td class="r">${editable ? `<button class="icon-btn" title="Bearbeiten" data-fa="edit" data-p="${esc(p)}">${ico('edit')}</button>` : ''}
          ${e.dir ? '' : `<a class="icon-btn" title="Herunterladen" href="/api/download?path=${encodeURIComponent(p)}">${ico('download')}</a>`}
          <button class="icon-btn" title="Umbenennen" data-fa="ren" data-p="${esc(p)}">${ico('rename')}</button>
          <button class="icon-btn danger" title="Löschen" data-fa="del" data-p="${esc(p)}" ${e.dir ? 'data-dir="1"' : ''}>${ico('trash')}</button></td></tr>`;
      }).join('')}</tbody></table>${r.entries.length ? '' : '<div class="empty">Ordner ist leer</div>'}`;
  }
  load();
};

async function editFile(p) {
  let r;
  try { r = await api('/api/file?path=' + encodeURIComponent(p)); } catch (e) { toast(e.message, 'err'); return; }
  const isJson = /\.json$/i.test(p);
  await modal(`<div class="card-h" style="margin-bottom:12px"><h3 style="margin:0">${ico('file')} <span class="mono" style="font-size:14px">${esc(p)}</span></h3>
      <div class="right"><span class="muted hide-mobile" style="font-size:12px">Strg+S speichert</span></div></div>
    <textarea class="editor" id="ed" spellcheck="false"></textarea>
    <p class="login-err" id="ed-err"></p>
    <div class="btns" style="margin-top:6px"><button class="btn btn-ghost" data-close="x">Schließen</button><button class="btn btn-primary" id="ed-save">${ico('save')}Speichern</button></div>`, {
    wide: true,
    onOpen(box) {
      const ta = $('#ed', box);
      ta.value = r.content;
      const save = async () => {
        if (isJson) { try { JSON.parse(ta.value); $('#ed-err', box).textContent = ''; } catch (err) { $('#ed-err', box).textContent = 'Ungültiges JSON: ' + err.message; return; } }
        try {
          await api('/api/file?path=' + encodeURIComponent(p), { method: 'PUT', raw: new Blob([ta.value], { type: 'text/plain' }) });
          toast('Gespeichert');
        } catch (e) { toast(e.message, 'err'); }
      };
      $('#ed-save', box).onclick = save;
      ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
        if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); }
      });
      setTimeout(() => ta.focus(), 30);
    },
  });
}

// ── Panel & Admins ──
VIEWS.admins = (v) => {
  v.innerHTML = `${head('Panel & Admins', 'Wer Zugriff auf dieses Panel hat und was zuletzt passiert ist.')}
  <div class="grid g-main">
    <div class="card audit-card"><div class="card-h"><h2>Aktivitätsprotokoll</h2><span class="sub">letzte 300 Aktionen</span></div><div class="audit" id="a-log"></div></div>
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="card"><div class="card-h"><h2>Administratoren</h2><div class="right"><button class="btn btn-sm" id="a-add">${ico('userplus')}Hinzufügen</button></div></div><div class="plist" id="a-list"></div></div>
      <div class="card"><div class="card-h"><h2>Mein Passwort</h2></div>
        <form id="a-pw" autocomplete="off"><label class="field"><span>Aktuelles Passwort</span><input type="password" name="old" autocomplete="current-password" required></label>
        <label class="field"><span>Neues Passwort</span><input type="password" name="new" minlength="10" autocomplete="new-password" required></label>
        <button class="btn btn-primary btn-sm">${ico('key')}Ändern</button></form></div>
      <div class="card"><div class="card-h"><h2>Darstellung & Panel</h2></div>
        <div class="field"><span>Farbschema</span><div class="seg theme-seg" id="a-theme" style="flex-wrap:wrap"><button data-t="auto">Automatisch</button><button data-t="dark"><span class="theme-dot" style="background:#4ee59a"></span>Dunkel</button><button data-t="light"><span class="theme-dot" style="background:#12a462;box-shadow:0 0 0 1px #ccc"></span>Hell</button>
          <button data-t="nether">${blkImg('block/netherrack', 'theme-dot')}Nether</button><button data-t="end">${blkImg('block/end_stone', 'theme-dot')}End</button></div></div>
        <div class="field"><span>Benachrichtigungen oben rechts</span><div class="mct-list" id="a-mctoast">${MCT_KINDS.map(([k, l]) => `<label class="row"><span class="switch"><input type="checkbox" data-k="${k}"><span></span></span>${esc(l)}</label>`).join('')}</div></div>
        <form id="a-set"><label class="field"><span>Öffentliche Server-Adresse (für die Anzeige)</span><input class="input mono" name="addr"></label>
        <button class="btn btn-sm">Speichern</button></form>
        <div class="row" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)"><span class="muted grow" style="font-size:13px">Panel neu laden (z. B. nach Updates des Panels)</span><button class="btn btn-sm" id="a-restart">${ico('refresh')}Panel neu starten</button></div></div>
    </div>
  </div>`;
  const theme = store.get('theme', 'auto');
  $$('#a-theme button', v).forEach((b) => b.classList.toggle('on', b.dataset.t === theme));
  $('#a-theme', v).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; store.set('theme', b.dataset.t); applyTheme(b.dataset.t); $$('#a-theme button', v).forEach((x) => x.classList.toggle('on', x === b)); };
  const mp = mctPrefs();
  $$('#a-mctoast input', v).forEach((i) => { i.checked = !!mp[i.dataset.k]; });
  $('#a-mctoast', v).onchange = (e) => {
    const k = e.target.dataset.k, p = mctPrefs();
    p[k] = e.target.checked; store.set('mcToastKinds', p);
    if (e.target.checked) {  // kurze Vorschau, wie es aussieht
      const n = S.me.user;
      const ex = { join: ['join', 'Spieler beigetreten', `${n} ist jetzt online`], leave: ['leave', 'Spieler gegangen', `${n} hat das Spiel verlassen`],
        adv: ['adv', 'Fortschritt erzielt!', `${n}: Diamanten!`], death: ['death', 'Gestorben', `${n} fell from a high place`] }[k];
      mcToast(ex[0], n, ex[1], ex[2]);
    }
  };
  $('#a-restart', v).onclick = async () => {
    if (!await confirmBox({ title: 'Panel neu starten?', text: 'Das Panel ist ein paar Sekunden nicht erreichbar. Der Minecraft-Server läuft dabei weiter.', ok: 'Neu starten' })) return;
    await run(() => post('/api/panel/restart', {}), 'Panel startet neu …');
    setTimeout(() => location.reload(), 4000);
  };
  $('#a-pw', v).onsubmit = async (e) => {
    e.preventDefault();
    if (await run(() => post('/api/admins', { action: 'password', old: e.target.old.value, new: e.target.new.value }), 'Passwort geändert')) e.target.reset();
  };
  $('#a-set', v).onsubmit = async (e) => {
    e.preventDefault();
    if (await run(() => post('/api/admins', { action: 'settings', settings: { public_address: e.target.addr.value } }), 'Gespeichert')) S.me.address = e.target.addr.value;
  };
  $('#a-add', v).onclick = async () => {
    const r = await modal(`<form autocomplete="off"><h3>Admin hinzufügen</h3><p>Der neue Admin hat vollen Zugriff auf Server und Panel.</p>
      <label class="field"><span>Benutzername</span><input name="name" required autocomplete="off" spellcheck="false"></label>
      <label class="field"><span>Passwort (min. 10 Zeichen)</span><input name="password" type="text" minlength="10" required autocomplete="off" class="mono" value="${esc(genPw())}"></label>
      <div class="btns"><button type="button" class="btn btn-ghost" data-close="x">Abbrechen</button><button class="btn btn-primary">Anlegen</button></div></form>`);
    if (r && await run(() => post('/api/admins', { action: 'add', name: r.name.trim(), password: r.password }), `Admin ${r.name} angelegt`)) { copy(r.password); load(); }
  };
  v.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const ok = await confirmBox({ title: `${b.dataset.rm} entfernen?`, text: 'Der Admin wird sofort abgemeldet und kann sich nicht mehr anmelden.', ok: 'Entfernen', danger: true });
    if (ok && await run(() => post('/api/admins', { action: 'remove', name: b.dataset.rm }), 'Admin entfernt')) load();
  });
  const AL = { login: 'Angemeldet', logout: 'Abgemeldet', 'login-fehlgeschlagen': 'Fehlgeschlagener Login', befehl: 'Befehl', 'server-start': 'Server gestartet', 'server-stop': 'Server gestoppt', 'server-restart': 'Server neu gestartet', 'server-kill': 'Server hart beendet', properties: 'Einstellungen geändert', gamerule: 'Spielregel', 'backup-erstellen': 'Backup erstellt', 'backup-löschen': 'Backup gelöscht', 'backup-wiederherstellen': 'Backup wiederhergestellt', 'datei-gespeichert': 'Datei bearbeitet', upload: 'Hochgeladen',
    'spark-profile': 'Profiler gestartet', 'spark-stop': 'Profiler beendet', 'spark-health': 'Gesundheitscheck', 'spark-heap': 'Speicheranalyse',
    'zeitplan-gespeichert': 'Zeitplan gespeichert', 'zeitplan-gelöscht': 'Zeitplan gelöscht', 'zeitplan-manuell': 'Zeitplan manuell ausgeführt', zeitplan: 'Zeitplan ausgeführt',
    'mod-installiert': 'Mod installiert', 'plugin-installiert': 'Plugin installiert', 'mod-aktualisiert': 'Mod aktualisiert', 'mod-toggle': 'Mod an/aus', 'mod-delete': 'Mod gelöscht',
    'update-gestartet': 'Update gestartet', 'update-fertig': 'Update abgeschlossen', 'update-fehlgeschlagen': 'Update fehlgeschlagen',
    'bluemap-download-akzeptiert': 'BlueMap aktiviert (EULA)', 'bluemap-pause': 'Karten-Rendern pausiert', 'bluemap-resume': 'Karten-Rendern fortgesetzt',
    'panel-neustart': 'Panel neu gestartet', 'panel-einstellungen': 'Panel-Einstellungen', 'passwort-geändert': 'Passwort geändert',
    'admin-hinzugefügt': 'Admin hinzugefügt', 'admin-entfernt': 'Admin entfernt', 'crash-report-gelöscht': 'Absturzbericht gelöscht',
    'wartung-an': 'Wartung gestartet', 'wartung-aus': 'Wartung beendet', 'wartung-ende': 'Wartung automatisch beendet', chat: 'Chat-Nachricht',
    'gebiet-zurückgesetzt': 'Gebiet zurückgesetzt', 'marker-add': 'Marker gesetzt', 'marker-delete': 'Marker gelöscht', 'server-icon': 'Server-Icon geändert',
    'datapack-enable': 'Datapack aktiviert', 'datapack-disable': 'Datapack deaktiviert', 'datapack-delete': 'Datapack gelöscht',
    ressourcenpaket: 'Ressourcenpaket gesetzt', 'ressourcenpaket-hochgeladen': 'Ressourcenpaket hochgeladen', 'ressourcenpaket-entfernt': 'Ressourcenpaket entfernt',
    'notiz-add': 'Notiz', 'notiz-verwarnung': 'Verwarnung', 'notiz-delete': 'Notiz gelöscht', 'tempban-abgelaufen': 'Bann abgelaufen',
    'geplant: restart': 'Neustart geplant', 'geplant: stop': 'Stopp geplant', 'geplante Aktion abgebrochen': 'Geplante Aktion abgebrochen' };
  async function load() {
    let r;
    try { r = await api('/api/admins'); } catch (e) { toast(e.message, 'err'); return; }
    $('#a-set', v).addr.value = r.settings.public_address || '';
    $('#a-list', v).innerHTML = r.admins.map((a) => `<div class="prow"><span class="avatar">${esc(a.name[0].toUpperCase())}</span>
      <div><div class="nm">${esc(a.name)} ${a.name === S.me.user ? '<span class="chip">du</span>' : ''}</div><div class="meta">${a.active ? '<span style="color:var(--accent)">● aktiv</span> ' + fmtAgo(a.active) : 'seit ' + (a.created ? fmtDate(a.created) : '–')}</div></div>
      <div class="right">${a.name !== S.me.user ? `<button class="icon-btn danger" title="Entfernen" data-rm="${esc(a.name)}">${ico('trash')}</button>` : ''}</div></div>`).join('');
    $('#a-log', v).innerHTML = r.audit.length ? r.audit.map((a) => `<div class="audit-row"><span class="when">${fmtDate(a.t)}</span><span class="who">${esc(a.user)}</span>
      <span class="what" style="${a.action === 'login-fehlgeschlagen' ? 'color:var(--red)' : ''}">${esc(AL[a.action] || prettyAction(a.action))}${a.detail ? ` <small>${esc(a.detail)}</small>` : ''} <small>· ${esc(a.ip)}</small></span></div>`).join('')
      : '<div class="empty">Noch keine Einträge</div>';
  }
  load();
};
function prettyAction(a) {
  const P2 = { 'whitelist-add': 'zur Whitelist', 'whitelist-remove': 'von Whitelist entfernt', op: 'OP gegeben', deop: 'OP entzogen', kick: 'gekickt', ban: 'gebannt', pardon: 'entbannt', 'ban-ip': 'IP gebannt', 'pardon-ip': 'IP entbannt', heal: 'geheilt', feed: 'gesättigt', survival: 'Modus Überleben', creative: 'Modus Kreativ', adventure: 'Modus Abenteuer', spectator: 'Modus Zuschauer', 'whitelist-on': 'Whitelist an', 'whitelist-off': 'Whitelist aus' };
  const W = { day: 'Tag', noon: 'Mittag', night: 'Nacht', midnight: 'Mitternacht', clear: 'klares Wetter', rain: 'Regen', thunder: 'Gewitter', save: 'gespeichert', say: 'Durchsage', 'kill-items': 'Items aufgeräumt', peaceful: 'Friedlich', easy: 'Einfach', normal: 'Normal', hard: 'Schwer' };
  if (a.startsWith('spieler-')) return 'Spieler: ' + (P2[a.slice(8)] || a.slice(8));
  if (a.startsWith('welt-')) return 'Welt: ' + (W[a.slice(5)] || a.slice(5));
  if (a.startsWith('datei-')) return 'Datei: ' + a.slice(6);
  return a;
}
function genPw() {
  const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = new Uint32Array(16); crypto.getRandomValues(r);
  return [...r].map((x) => a[x % a.length]).join('');
}

// ───────────────────────── Gemeinsame Helfer (Erweiterungen) ─────────────────────────
const playerColor = (name) => { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 70% 58%)`; };
const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString(I18N.locale, { hour: '2-digit', minute: '2-digit' });
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
function tabs(v, sel, items, key, onChange) {
  const el = $(sel, v);
  el.innerHTML = items.map(([k, l, i]) => `<button data-t="${k}">${i ? ico(i) : ''}${esc(l)}</button>`).join('');
  let cur = store.get(key, items[0][0]);
  if (!items.some(([k]) => k === cur)) cur = items[0][0];
  const set = (k) => { cur = k; store.set(key, k); $$('button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === k)); onChange(k); };
  el.onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) set(b.dataset.t); };
  set(cur);
}

// ── Verlauf (Spieler-Historie) ──
VIEWS.history = (v) => {
  let data = null, day = dayStart(Date.now()), q = '', days = store.get('histDays', 30), tab = 'timeline';
  v.innerHTML = `${head('Verlauf', 'Wer wann gespielt hat, Chat, Tode und Erfolge – ausgewertet aus den Server-Logs.',
    `<select class="input" id="h-days" style="width:auto"><option value="7">7 Tage</option><option value="30">30 Tage</option><option value="90">90 Tage</option></select>`)}
    <div class="row" style="margin-bottom:16px"><div class="seg" id="h-tabs"></div><span class="grow"></span><div id="h-tools"></div></div>
    <div id="h-body"><div class="card"><div class="skeleton"></div></div></div>`;
  $('#h-days', v).value = days;
  $('#h-days', v).onchange = (e) => { days = +e.target.value; store.set('histDays', days); load(); };
  async function load() {
    try { data = await api('/api/history?days=' + days); } catch (e) { $('#h-body', v).innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    render();
  }
  const sessEnd = (s) => s[2] ?? data.now;
  function render() {
    if (!data) return;
    const body = $('#h-body', v), tools = $('#h-tools', v);
    tools.innerHTML = '';
    if (tab === 'timeline') {
      const d0 = day.getTime() / 1000, d1 = d0 + 86400;
      const today = dayStart(Date.now()).getTime() / 1000;
      const daily = [];
      for (let i = 13; i >= 0; i--) {
        const a = today - i * 86400, b = a + 86400;
        let mins = 0; const who = new Set();
        data.sessions.forEach((s) => { const o = Math.min(b, sessEnd(s)) - Math.max(a, s[1]); if (o > 0) { mins += o / 60; who.add(s[0]); } });
        daily.push({ a, mins, who: who.size });
      }
      const maxM = Math.max(60, ...daily.map((x) => x.mins));
      const rows = {};
      data.sessions.forEach((s) => { if (sessEnd(s) > d0 && s[1] < d1) (rows[s[0]] = rows[s[0]] || []).push(s); });
      const names = Object.keys(rows).sort();
      const pct = (t) => Math.max(0, Math.min(100, ((t - d0) / 86400) * 100));
      body.innerHTML = `
        <div class="card"><div class="card-h"><h2>Letzte 14 Tage</h2><span class="sub">Spielzeit aller Spieler pro Tag · Tag anklicken</span></div>
          <div class="days">${daily.map((x) => `<button class="dayb ${x.a === d0 ? 'on' : ''}" data-day="${x.a}" title="${fmtDur(x.mins * 60)} · ${x.who} Spieler">
            <span class="dbar"><i style="height:${Math.max(3, (x.mins / maxM) * 100)}%"></i></span><small>${WD[(new Date(x.a * 1000).getDay() + 6) % 7]}</small><small class="mono">${new Date(x.a * 1000).getDate()}.</small></button>`).join('')}</div></div>
        <div class="card" style="margin-top:16px">
          <div class="card-h"><button class="icon-btn" data-nav="-1" title="Vorheriger Tag">${ico('chevronLeft')}</button>
            <h2>${day.toLocaleDateString(I18N.locale, { weekday: 'long', day: '2-digit', month: 'long' })}</h2>
            <button class="icon-btn" data-nav="1" title="Nächster Tag" ${d0 >= today ? 'disabled' : ''}>${ico('chevron')}</button>
            <span class="sub">${names.length} Spieler</span></div>
          ${names.length ? `<div class="tl"><div class="tl-axis"><span></span><div>${[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => `<b style="left:${(h / 24) * 100}%">${h}</b>`).join('')}</div></div>
            ${names.map((n) => {
              const total = rows[n].reduce((a, s) => a + Math.min(d1, sessEnd(s)) - Math.max(d0, s[1]), 0);
              return `<div class="tl-row"><span class="tl-name">${headImg({ name: n })}<b>${esc(n)}</b><small>${fmtDur(total)}</small></span><div class="tl-track">
                ${rows[n].map((s) => { const a = pct(s[1]), b = pct(sessEnd(s)); return `<i class="${s[2] == null ? 'live' : ''}" style="left:${a}%;width:${Math.max(0.4, b - a)}%;background:${playerColor(n)}" title="${fmtTime(s[1])} – ${s[2] == null ? 'jetzt' : fmtTime(s[2])} (${fmtDur(sessEnd(s) - s[1])})"></i>`; }).join('')}
                ${d0 <= data.now && data.now < d1 ? `<em style="left:${pct(data.now)}%"></em>` : ''}</div></div>`;
            }).join('')}</div>` : `<div class="empty">${ico('history')}An diesem Tag war niemand online</div>`}
        </div>`;
    } else if (tab === 'board') {
      const last = {};
      data.sessions.forEach((s) => { last[s[0]] = Math.max(last[s[0]] || 0, s[2] == null ? data.now : s[2]); });
      const online = new Set(data.online);
      body.innerHTML = `<div class="card card-flush"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Spieler</th><th class="r">Spielzeit</th><th class="r">Tode</th><th class="r hide-mobile">Mob-Kills</th><th class="r hide-mobile">Gelaufen</th><th class="r">Zuletzt</th></tr></thead><tbody>
        ${data.leaderboard.map((p, i) => `<tr><td class="mono muted">${i + 1}</td><td><div class="fname">${headImg(p)}<b>${esc(p.name)}</b>${i === 0 ? `<span style="color:var(--gold)">${ico('trophy')}</span>` : ''}</div></td>
          <td class="r mono">${fmtDur(p.playTime)}</td><td class="r mono">${p.deaths}</td><td class="r mono hide-mobile">${fmtNum(p.mobKills)}</td><td class="r mono hide-mobile">${num(p.walked / 1000, 1)} km</td>
          <td class="r muted">${online.has(p.name) ? '<span style="color:var(--accent)">● online</span>' : last[p.name] ? fmtAgo(last[p.name]) : fmtAgo(p.lastSeen)}</td></tr>`).join('')}</tbody></table></div></div>`;
    } else {
      const src = { chat: data.chat, deaths: data.deaths, adv: data.advancements }[tab];
      tools.innerHTML = `<div class="search-in"><span class="ico">${svg('search')}</span><input class="input" id="h-q" placeholder="Filtern …" value="${esc(q)}" style="width:200px"></div>`;
      $('#h-q', v).oninput = (e) => { q = e.target.value.toLowerCase(); paintList(); };
      body.innerHTML = '<div class="card"><div class="hist-list" id="h-list"></div></div>';
      paintList();
      function paintList() {
        const icn = { chat: 'chat', deaths: 'skull', adv: 'trophy' }[tab];
        const list = src.filter((r) => !q || (r[1] + ' ' + r[2]).toLowerCase().includes(q)).slice().reverse();
        $('#h-list', v).innerHTML = list.length ? list.map(([t, n, txt]) => `<div class="hrow"><span class="when">${fmtDate(t)}</span>
          <span class="who" style="color:${playerColor(n)}">${esc(n)}</span><span class="what">${tab === 'chat' ? esc(txt) : `${ico(icn)} ${esc(tab === 'adv' ? txt : txt.replace(n + ' ', ''))}`}</span></div>`).join('')
          : `<div class="empty">${ico(icn)}Keine Einträge im gewählten Zeitraum</div>`;
      }
    }
  }
  v.addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]');
    if (d) { day = new Date(+d.dataset.day * 1000); render(); }
    const n = e.target.closest('[data-nav]');
    if (n && !n.disabled) { day = dayStart(day.getTime() + (+n.dataset.nav) * 86400000 + 3600000 * 2); render(); }
  });
  tabs(v, '#h-tabs', [['timeline', 'Zeitleiste', 'history'], ['board', 'Rangliste', 'trophy'], ['chat', 'Chat', 'chat'], ['deaths', 'Tode', 'skull'], ['adv', 'Erfolge', 'sparkle']], 'histTab', (k) => { tab = k; render(); });
  load();
  const t = setInterval(() => { if (tab === 'timeline') load(); }, 60000);
  return () => clearInterval(t);
};

// ── Inventar ──
const DIM_DE = { 'minecraft:overworld': 'Oberwelt', 'minecraft:the_nether': 'Nether', 'minecraft:the_end': 'Ende' };
const GM_DE = ['Überleben', 'Kreativ', 'Abenteuer', 'Zuschauer'];
function showOnMap(dim, pos) {
  const map = { 'minecraft:overworld': 'world', 'minecraft:the_nether': 'world_the_nether', 'minecraft:the_end': 'world_the_end' }[dim] || 'world';
  const [x, y, z] = pos.map((n) => Math.round(n));
  store.set('mapFocus', `#${map}:${x}:${y}:${z}:120:0:0.7:0:0:perspective`);
  if (location.hash === '#/map') route(); else location.hash = '#/map';
}
async function openInventory(p, refresh) {
  for (const k in ITEM_TIPS) delete ITEM_TIPS[k];
  const url = (r) => `/api/players/inventory?uuid=${encodeURIComponent(p.uuid)}&name=${encodeURIComponent(p.name || '')}${r ? '&refresh=1' : ''}`;
  let d;
  try { d = await api(url(refresh)); } catch (e) { toast(e.message, 'err'); return; }
  let tab = 'inv';
  const slot = (it, key, extra = '') => {
    if (!it) return `<div class="slot ${extra}"></div>`;
    ITEM_TIPS[key] = it;  // feste Schlüssel je Platz, damit die Live-Aktualisierung nur Geändertes austauscht
    return `<div class="slot ${extra} ${it.ench && it.ench.length ? 'ench' : ''}" data-tip="${key}">
      ${d.icons ? `<img src="/api/itemicon?id=${encodeURIComponent(it.id)}" alt="" loading="lazy" data-fallback="${esc(it.name[0])}">` : `<span class="avatar">${esc(it.name[0])}</span>`}
      ${it.count > 1 ? `<b>${it.count}</b>` : ''}</div>`;
  };
  const bySlot = (list, s) => list.find((x) => x.slot === s);
  const grid = (list, pre, from, to, sel) => { let h = ''; for (let s = from; s <= to; s++) h += slot(bySlot(list, s), pre + s, s === sel ? 'sel' : ''); return h; };
  const html = () => {
    const online = (S.stats.online || []).includes(p.name);
    const eq = d.equipment || {};
    const hearts = Math.round((d.health || 0) / 2 * 10) / 10;
    const posTxt = d.pos ? d.pos.map((n) => Math.round(n)).join(' / ') : '–';
    const stand = d.live ? `<span class="inv-live"><i></i>Live</span> · aktualisiert sich laufend` : `Stand: ${online ? 'letzte Speicherung' : 'beim Ausloggen'} · ${fmtAgo(d.mtime)}`;
    return `<div class="card-h inv-head" style="margin-bottom:16px">${headImg(p, 'head head-lg' + (online ? ' online-ring' : ''))}
      <div><h3 style="margin:0">${esc(p.name)}</h3><div class="muted" style="font-size:12.5px">${stand}</div></div>
      <div class="right">${online && !d.live ? `<button class="btn btn-sm" id="inv-refresh">${ico('refresh')}Aktualisieren</button>` : ''}<button class="icon-btn" data-close="x" title="Schließen">${ico('x')}</button></div></div>
    <div class="inv-stats">
      <div><small>Leben</small><b style="color:var(--red)">${ico('heart')} ${num(hearts, 1)} / 10</b></div>
      <div><small>Hunger</small><b style="color:var(--gold)">${ico('food')} ${d.food ?? '–'} / 20</b></div>
      <div><small>Level</small><b style="color:var(--accent)">${d.xpLevel ?? '–'}</b></div>
      <div><small>Modus</small><b>${esc(GM_DE[d.gamemode] || '–')}</b></div>
      <div class="wide"><small>${esc(DIM_DE[d.dim] || d.dim || 'Position')}</small><b class="mono">${posTxt}</b>
        ${d.pos ? `<button class="btn btn-sm" id="inv-map">${ico('pin')}Auf Karte</button>` : ''}</div>
    </div>
    <div class="seg" id="inv-tabs" style="margin:14px 0"><button data-t="inv" class="${tab === 'inv' ? 'on' : ''}">${ico('bag')}Inventar</button><button data-t="ender" class="${tab === 'ender' ? 'on' : ''}">Endertruhe (${d.ender.length})</button></div>
    <div id="inv-main" class="inv"${tab === 'inv' ? '' : ' hidden'}>
      <div class="inv-eq">${slot(eq.head, 'qh', 'eq eq-head')}${slot(eq.chest, 'qc', 'eq eq-chest')}${slot(eq.legs, 'ql', 'eq eq-legs')}${slot(eq.feet, 'qf', 'eq eq-feet')}<div style="height:10px"></div>${slot(eq.offhand, 'qo', 'eq eq-off')}</div>
      <div><div class="inv-grid">${grid(d.inventory, 'i', 9, 35)}</div><div class="inv-grid hotbar">${grid(d.inventory, 'i', 0, 8, d.selected)}</div></div>
    </div>
    <div id="inv-ender" class="inv"${tab === 'ender' ? '' : ' hidden'}><div><div class="inv-grid">${grid(d.ender, 'e', 0, 26)}</div></div></div>
    ${d.lastDeath && d.lastDeath.pos ? `<p class="muted" style="font-size:12.5px;margin:14px 0 0">${ico('skull')} Letzter Tod: ${esc(DIM_DE[d.lastDeath.dim] || d.lastDeath.dim)} bei <span class="mono">${d.lastDeath.pos.join(' / ')}</span> <button class="link-btn" id="inv-death">auf Karte</button></p>` : ''}
    ${d.icons ? '' : '<p class="muted" style="font-size:12px;margin-top:10px">Item-Bilder erscheinen, sobald BlueMap die Minecraft-Client-Datei geladen hat.</p>'}`;
  };
  let timer = null, busy = false, closed = false;
  await modal(`<div id="inv-body">${html()}</div><div class="inv-tip" id="inv-tip" hidden></div>`, {
    wide: true,
    onOpen(box, close) {
      box.style.width = 'min(640px, 100%)';
      const body = $('#inv-body', box), tip = $('#inv-tip', box);
      body._ph = null;
      let hoverKey = null;
      const showTip = (s) => {
        const it = s && ITEM_TIPS[s.dataset.tip];
        if (!it) { tip.hidden = true; hoverKey = null; return; }
        hoverKey = s.dataset.tip;
        tip.innerHTML = `<b class="${it.ench.length ? 'en' : ''}">${it.custom ? `<i>${esc(it.custom)}</i>` : esc(it.name)}</b>
          ${it.custom ? `<small>${esc(it.name)}</small>` : ''}${it.ench.map(([n, l]) => `<small class="e">${esc(n)} ${roman(l)}</small>`).join('')}
          ${it.damage ? `<small>Abnutzung: ${it.damage}</small>` : ''}${it.contents ? `<small>Inhalt: ${it.contents.length ? it.contents.map((c) => `${c.count}× ${esc(c.name)}`).join(', ') : 'leer'}</small>` : ''}
          <small class="id">${esc(it.id)}</small>`;
        tip.hidden = false;
        const br = box.getBoundingClientRect(), sr = s.getBoundingClientRect();
        tip.style.left = Math.min(sr.right - br.left + 6, br.width - 230) + 'px';
        tip.style.top = (sr.top - br.top + box.scrollTop) + 'px';
      };
      box.addEventListener('click', (e) => {
        const t = e.target.closest('#inv-tabs [data-t]');
        if (t) { tab = t.dataset.t; for (const k in ITEM_TIPS) delete ITEM_TIPS[k]; patch(body, html()); hydrateIcons(body); }
        if (e.target.closest('#inv-refresh')) { close(null); openInventory(p, true); }
        if (e.target.closest('#inv-map')) { close(null); showOnMap(d.dim, d.pos); }
        if (e.target.closest('#inv-death')) { close(null); showOnMap(d.lastDeath.dim, d.lastDeath.pos); }
      });
      box.addEventListener('mouseover', (e) => showTip(e.target.closest('[data-tip]')));
      box.addEventListener('mouseleave', () => { tip.hidden = true; hoverKey = null; });
      // Live: solange der Spieler online ist, alle 2 s den aktuellen Stand direkt vom Server holen
      timer = setInterval(async () => {
        if (busy || closed || !(S.stats.online || []).includes(p.name)) return;
        busy = true;
        try {
          const nd = await api(url(false));
          if (closed) return;
          d = nd;
          for (const k in ITEM_TIPS) delete ITEM_TIPS[k];
          patch(body, html());
          hydrateIcons(body);
          if (hoverKey) showTip($(`[data-tip="${hoverKey}"]`, body));
        } catch { /* nächster Versuch */ } finally { busy = false; }
      }, 2000);
    },
  });
  closed = true;
  clearInterval(timer);
}
const ITEM_TIPS = {};
const roman = (n) => (n > 0 && n < 11 ? ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] : String(n));

// ── Diagnose (Abstürze + Lag-Analyse) ──
VIEWS.diagnose = (v) => {
  let tab = 'crash';
  v.innerHTML = `${head('Diagnose', 'Abstürze verstehen und Lag finden.')}
    <div class="row" style="margin-bottom:16px"><div class="seg" id="d-tabs"></div></div><div id="d-body"></div>`;
  const body = $('#d-body', v);
  let unsub = null;
  async function crashes() {
    store.set('crashSeen', Date.now() / 1000);
    const nb = $('#nav [data-badge=crash]'); if (nb) nb.hidden = true;
    body.innerHTML = '<div class="card"><div class="skeleton"></div></div>';
    let r;
    try { r = await api('/api/crashes'); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    body.innerHTML = r.crashes.length ? r.crashes.map((c) => `<div class="card crash" style="margin-bottom:14px">
      <div class="card-h"><span class="crash-ico">${ico(c.kind === 'jvm' ? 'zap' : 'alert')}</span><div style="min-width:0"><h2>${esc(c.description || 'Absturz')}</h2><span class="sub">${fmtDate(c.mtime)} · ${fmtAgo(c.mtime)} · <span class="mono">${esc(c.path)}</span></span></div>
        <div class="right"><button class="btn btn-sm" data-cv="${esc(c.path)}">${ico('file')}Report</button><button class="icon-btn danger" title="Löschen" data-cd="${esc(c.path)}">${ico('trash')}</button></div></div>
      ${c.exception ? `<pre class="crash-exc">${esc(c.exception)}${c.causes.length ? '\n' + esc(c.causes.join('\n')) : ''}</pre>` : ''}
      ${c.suspects.length ? `<div class="row" style="margin-top:12px"><span class="muted" style="font-size:13px">Verdächtig:</span>${c.suspects.map(([m, sc], i) => `<span class="chip ${i === 0 ? 'chip-red' : ''}" title="Treffer-Punkte: ${sc}">${esc(m)}</span>`).join('')}</div>` : '<div class="muted" style="font-size:13px;margin-top:10px">Kein bestimmter Mod im Stacktrace erkennbar – vermutlich Minecraft selbst oder die Umgebung.</div>'}
      ${c.hint ? `<div class="notice" style="margin:12px 0 0">${ico('info')}<div>${esc(c.hint)}</div></div>` : ''}</div>`).join('')
      : `<div class="card"><div class="empty">${ico('check')}Keine Absturzberichte – der Server läuft stabil.${r.serviceState === 'failed' ? '<br><br><b style="color:var(--red)">Der Dienst ist aber im Fehlerzustand. Schau in die Konsole.</b>' : ''}</div></div>`;
  }
  async function lag() {
    body.innerHTML = '<div class="card"><div class="skeleton"></div></div>';
    let r;
    try { r = await api('/api/spark'); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    if (!r.installed) {
      body.innerHTML = `<div class="card" style="max-width:680px"><div class="card-h"><h2>spark installieren</h2></div>
        <p>Für die Lag-Analyse nutzt das Panel <b>spark</b>, den Standard-Profiler für Minecraft-Server. Er misst, welche Mods, Entities oder Chunks Rechenzeit fressen. Im Leerlauf kostet er praktisch keine Leistung.</p>
        <button class="btn btn-primary" data-sp="install">${ico('download')}spark installieren</button></div>`;
      return;
    }
    body.innerHTML = `<div class="grid g-main">
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="card"><div class="card-h"><h2>Profiler</h2><span class="sub">findet heraus, was den Server bremst</span></div>
          <p class="muted" style="margin:0 0 14px;font-size:13px">Am besten starten, während der Lag gerade auftritt. Nach Ablauf erscheint unten ein Link zum Bericht.</p>
          <div class="row"><div class="seg" id="sp-dur"><button data-s="30">30 s</button><button data-s="60" class="on">1 Min</button><button data-s="180">3 Min</button><button data-s="300">5 Min</button></div>
            <button class="btn btn-primary" data-sp="profile">${ico('play')}Starten</button><button class="btn" data-sp="stop">${ico('stop')}Jetzt beenden</button></div></div>
        <div class="card"><div class="card-h"><h2>Schnell-Checks</h2></div><div class="quick">
          <button class="qa" data-sp="health" style="--qa:var(--aqua)">${ico('heart')}<b>Gesundheit</b><small>Bericht mit Link</small></button>
          <button class="qa" data-sp="heap" style="--qa:var(--violet)">${ico('cpu')}<b>Speicher</b><small>was belegt den RAM</small></button></div></div>
        <div class="card"><div class="card-h"><h2>Live-Ausgabe</h2></div><div class="console" id="sp-out" style="max-height:220px;min-height:90px;border-radius:9px"></div></div>
      </div>
      <div class="card"><div class="card-h"><h2>Berichte</h2><span class="sub">${r.reports.length}</span></div><div id="sp-reps">
        ${r.reports.length ? r.reports.map((x) => `<div class="prow"><span class="crash-ico" style="background:var(--accent-soft);color:var(--accent)">${ico({ profiler: 'activity', health: 'heart', heap: 'cpu' }[x.kind] || 'file')}</span>
          <div><div class="nm">${esc({ profiler: 'Profiler', health: 'Gesundheit', heap: 'Speicher' }[x.kind] || 'Bericht')}</div><div class="meta">${fmtDate(x.t)}</div></div>
          <div class="right"><a class="btn btn-sm" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${ico('external')}Öffnen</a></div></div>`).join('')
          : `<div class="empty">${ico('activity')}Noch keine Berichte</div>`}</div>
        <p class="muted" style="font-size:12px;margin:14px 0 0">Berichte werden auf spark.lucko.me hochgeladen. Sie sind nicht öffentlich gelistet, aber jeder mit dem Link kann sie ansehen.</p></div></div>`;
    const out = $('#sp-out', v);
    const paint = (lines) => { lines.forEach(([k, l]) => { if (/⚡|spark|Profiler|TPS|MSPT|Tick/i.test(l) && (k !== 'log' || /⚡|spark/i.test(l))) { const d = document.createElement('div'); d.className = 'l ' + k; d.innerHTML = esc(l.replace(/^\[[^\]]*\] \[[^\]]*\]: /, '')).replace(/(https:\/\/spark\.lucko\.me\/\w+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'); out.append(d); } }); out.scrollTop = out.scrollHeight; };
    paint(S.logs.slice(-200));
    if (!out.childElementCount) out.innerHTML = '<div class="muted">Noch keine spark-Ausgaben.</div>';
    unsub && unsub();
    unsub = sub((ev, data) => {
      if (ev === 'log') {
        const ph = $('.muted', out); if (ph && data.some(([, l]) => /⚡|spark/i.test(l))) ph.remove();
        paint(data);
        if (data.some(([, l]) => l.includes('spark.lucko.me/'))) setTimeout(() => { if (tab === 'lag') lag(); }, 800);
      }
    });
  }
  v.addEventListener('click', async (e) => {
    const cv = e.target.closest('[data-cv]');
    if (cv) {
      let r; try { r = await api('/api/crashes/view?path=' + encodeURIComponent(cv.dataset.cv)); } catch (er) { toast(er.message, 'err'); return; }
      modal(`<div class="card-h"><h3 style="margin:0">${esc(r.analysis.description || 'Absturzbericht')}</h3><div class="right"><a class="btn btn-sm" href="/api/download?path=${encodeURIComponent(cv.dataset.cv)}">${ico('download')}</a><button class="icon-btn" data-close="x">${ico('x')}</button></div></div>
        <pre class="editor" style="min-height:60vh;white-space:pre-wrap">${esc(r.text)}</pre>`, { wide: true });
    }
    const cd = e.target.closest('[data-cd]');
    if (cd && await confirmBox({ title: 'Report löschen?', ok: 'Löschen', danger: true }) && await run(() => post('/api/crashes', { action: 'delete', path: cd.dataset.cd }), 'Gelöscht')) crashes();
    const dur = e.target.closest('#sp-dur [data-s]');
    if (dur) $$('#sp-dur button', v).forEach((b) => b.classList.toggle('on', b === dur));
    const sp = e.target.closest('[data-sp]');
    if (sp) {
      const a = sp.dataset.sp;
      if (a === 'install') {
        sp.disabled = true; sp.innerHTML = '<span class="spinner"></span>Installiere …';
        if (await run(() => post('/api/spark', { action: 'install' }), 'spark installiert')) {
          const ok = await confirmBox({ title: 'Jetzt neu starten?', text: 'spark wird erst nach einem Server-Neustart aktiv.', ok: 'Neustart …' });
          if (ok) power('restart');
          lag();
        } else { sp.disabled = false; sp.innerHTML = `${ico('download')}spark installieren`; }
        return;
      }
      const secs = +(($('#sp-dur .on', v) || {}).dataset || {}).s || 60;
      const msgs = { profile: `Profiler läuft ${secs < 60 ? secs + ' s' : secs / 60 + ' Min'} – der Bericht erscheint danach`, stop: 'Profiler wird beendet …', health: 'Gesundheitscheck läuft …', heap: 'Speicheranalyse läuft …', tps: 'TPS abgefragt' };
      run(() => post('/api/spark', { action: a, seconds: secs }), msgs[a]);
    }
  });
  tabs(v, '#d-tabs', [['crash', 'Abstürze', 'alert'], ['lag', 'Lag-Analyse', 'activity']], 'diagTab', (k) => { tab = k; unsub && unsub(); unsub = null; (k === 'crash' ? crashes : lag)(); });
  return () => unsub && unsub();
};

// ── Zeitpläne ──
const SCHED_T = {
  restart: ['Neustart', 'restart', 'var(--accent)'], stop: ['Server stoppen', 'stop', 'var(--red)'], start: ['Server starten', 'play', 'var(--accent)'],
  backup: ['Backup', 'archive', 'var(--aqua)'], command: ['Befehl', 'terminal', 'var(--violet)'], broadcast: ['Durchsage', 'megaphone', 'var(--gold)'],
};
const SCHED_PRESETS = [
  { name: 'Täglicher Neustart', type: 'restart', mode: 'daily', time: '05:00', days: [0, 1, 2, 3, 4, 5, 6], warn: 300 },
  { name: 'Backup alle 6 Stunden', type: 'backup', mode: 'interval', interval: 360 },
  { name: 'Stündliche Durchsage', type: 'broadcast', mode: 'interval', interval: 60, message: 'Viel Spaß auf dem Server! Denk an deine Pausen.', only_players: true },
  { name: 'Items aufräumen', type: 'command', mode: 'interval', interval: 30, command: 'kill @e[type=minecraft:item]', only_players: true },
];
function schedDesc(t) {
  if (t.mode === 'interval') { const m = t.interval; return m % 60 === 0 ? `alle ${m / 60} Std` : `alle ${m} Min`; }
  const d = t.days || [];
  const days = d.length === 7 ? 'täglich' : d.length === 5 && !d.includes(5) && !d.includes(6) ? 'werktags' : d.length === 2 && d.includes(5) && d.includes(6) ? 'am Wochenende' : d.map((x) => WD[x]).join(', ');
  return `${days} um ${t.time} Uhr`;
}
async function editSchedule(t) {
  t = { type: 'restart', mode: 'daily', time: '05:00', days: [0, 1, 2, 3, 4, 5, 6], interval: 60, warn: 60, enabled: true, ...t };
  const iv = t.interval % 60 === 0 ? [t.interval / 60, 'h'] : [t.interval, 'm'];
  const r = await modal(`<form id="se" autocomplete="off"><h3>${t.id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h3>
    <label class="field"><span>Name</span><input name="name" value="${esc(t.name || '')}" maxlength="60" placeholder="z. B. Nächtlicher Neustart"></label>
    <label class="field"><span>Was soll passieren?</span><select name="type">${Object.entries(SCHED_T).map(([k, [l]]) => `<option value="${k}" ${k === t.type ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="field" data-for="command"><span>Befehle (einer pro Zeile, ohne /)</span><textarea name="command" rows="3" class="mono" spellcheck="false">${esc(t.command || '')}</textarea></div>
    <label class="field" data-for="broadcast"><span>Nachricht</span><input name="message" value="${esc(t.message || '')}" maxlength="250"></label>
    <div class="field"><span>Wann?</span><div class="seg" id="se-mode"><button type="button" data-m="daily">Zu einer Uhrzeit</button><button type="button" data-m="interval">Regelmäßig</button></div></div>
    <div data-mode="daily"><div class="row" style="margin-bottom:14px"><input class="input" type="time" name="time" value="${esc(t.time)}" style="width:130px">
      <div class="seg" id="se-days">${WD.map((w, i) => `<button type="button" data-d="${i}" class="${t.days.includes(i) ? 'on' : ''}">${w}</button>`).join('')}</div></div></div>
    <div data-mode="interval"><div class="row" style="margin-bottom:14px"><span>alle</span><input class="input mono" type="number" name="ivn" min="1" value="${iv[0]}" style="width:90px">
      <select class="input" name="ivu" style="width:auto"><option value="m" ${iv[1] === 'm' ? 'selected' : ''}>Minuten</option><option value="h" ${iv[1] === 'h' ? 'selected' : ''}>Stunden</option></select></div></div>
    <label class="field" data-for="restart stop"><span>Vorwarnung im Chat (nur wenn jemand online ist)</span><select name="warn">${[[0, 'keine'], [30, '30 Sekunden'], [60, '1 Minute'], [300, '5 Minuten'], [600, '10 Minuten']].map(([s, l]) => `<option value="${s}" ${+t.warn === s ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="row" data-for="command broadcast" style="margin-bottom:14px"><span class="switch"><input type="checkbox" name="only_players" ${t.only_players ? 'checked' : ''}><span></span></span>Nur ausführen, wenn jemand online ist</label>
    <p class="muted" style="font-size:12px;margin:0">Zeiten gelten in der Zeitzone des Servers.</p>
    <div class="btns"><button type="button" class="btn btn-ghost" data-close="x">Abbrechen</button><button class="btn btn-primary">Speichern</button></div></form>`, {
    onOpen(box, close) {
      const f = $('#se', box);
      let mode = t.mode;
      const sync = () => {
        $$('[data-for]', box).forEach((el) => { el.hidden = !el.dataset.for.split(' ').includes(f.type.value); });
        $$('[data-mode]', box).forEach((el) => { el.hidden = el.dataset.mode !== mode; });
        $$('#se-mode button', box).forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      };
      f.type.onchange = sync;
      $('#se-mode', box).onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; sync(); } };
      $('#se-days', box).onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) b.classList.toggle('on'); };
      sync();
      f.onsubmit = (e) => {
        e.preventDefault();
        close({
          ...t, name: f.name.value.trim() || SCHED_T[f.type.value][0], type: f.type.value, mode, time: f.time.value || '05:00',
          days: $$('#se-days .on', box).map((b) => +b.dataset.d), interval: Math.max(1, +f.ivn.value || 1) * (f.ivu.value === 'h' ? 60 : 1),
          warn: +f.warn.value, command: f.command.value, message: f.message.value, only_players: f.only_players.checked,
        });
      };
    },
  });
  if (!r) return false;
  if (r.mode === 'daily' && !r.days.length) { toast('Bitte mindestens einen Wochentag wählen', 'err'); return false; }
  return !!(await run(() => post('/api/schedules', { action: 'save', task: r }), 'Zeitplan gespeichert'));
}
VIEWS.schedules = (v) => {
  v.innerHTML = `${head('Zeitpläne', 'Wiederkehrende Aufgaben: Neustarts, Backups, Befehle und Durchsagen.', `<button class="btn btn-primary" id="z-new">${ico('plus')}<span>Neue Aufgabe</span></button>`)}
    <div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Vorlagen</h2><span class="sub">ein Klick, dann anpassen</span></div><div class="quick presets" id="z-presets">
      ${SCHED_PRESETS.map((p, i) => `<button class="qa" data-preset="${i}" style="--qa:${SCHED_T[p.type][2]}">${ico(SCHED_T[p.type][1])}<b>${esc(p.name)}</b><small>${esc(schedDesc({ days: [0, 1, 2, 3, 4, 5, 6], ...p }))}</small></button>`).join('')}</div></div>
    <div id="z-list"></div>`;
  async function load() {
    let r;
    try { r = await api('/api/schedules'); } catch (e) { $('#z-list', v).innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    v._tasks = r.tasks;
    $('#z-list', v).innerHTML = r.tasks.length ? `<div class="grid g-2">${r.tasks.map((t) => {
      const [lbl, icn, col] = SCHED_T[t.type] || ['?', 'info', 'var(--muted)'];
      return `<div class="card sched ${t.enabled ? '' : 'off'}"><div class="card-h"><span class="crash-ico" style="background:color-mix(in srgb, ${col} 14%, transparent);color:${col}">${ico(icn)}</span>
        <div style="min-width:0"><h2>${esc(t.name)}</h2><span class="sub">${esc(lbl)} · ${esc(schedDesc(t))}</span></div>
        <div class="right"><label class="switch" title="An/Aus"><input type="checkbox" data-zt="${t.id}" ${t.enabled ? 'checked' : ''}><span></span></label></div></div>
        ${t.type === 'command' ? `<pre class="crash-exc">${esc(t.command)}</pre>` : t.type === 'broadcast' ? `<pre class="crash-exc">${esc(t.message)}</pre>` : ''}
        <dl class="kv" style="margin-top:10px"><dt>Nächste Ausführung</dt><dd>${t.next ? `${fmtDate(t.next)}` : '–'}</dd>
          <dt>Zuletzt</dt><dd style="${t.last_ok === false ? 'color:var(--red)' : ''}">${t.last_run ? `${fmtAgo(t.last_run)} · ${esc(t.last_result || '')}` : 'noch nie'}</dd></dl>
        <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn btn-sm btn-ghost" data-zr="${t.id}">${ico('play')}Jetzt ausführen</button><button class="btn btn-sm" data-ze="${t.id}">${ico('edit')}Bearbeiten</button><button class="icon-btn danger" data-zd="${t.id}" title="Löschen">${ico('trash')}</button></div></div>`;
    }).join('')}</div>` : `<div class="card"><div class="empty">${ico('calendar')}Noch keine Zeitpläne – nimm eine Vorlage oder lege eine neue Aufgabe an.</div></div>`;
  }
  v.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-preset]');
    if (p && await editSchedule({ ...SCHED_PRESETS[+p.dataset.preset] })) load();
    if (e.target.closest('#z-new') && await editSchedule({})) load();
    const ed = e.target.closest('[data-ze]');
    if (ed && await editSchedule(v._tasks.find((t) => t.id === ed.dataset.ze))) load();
    const del = e.target.closest('[data-zd]');
    if (del && await confirmBox({ title: 'Aufgabe löschen?', ok: 'Löschen', danger: true }) && await run(() => post('/api/schedules', { action: 'delete', id: del.dataset.zd }), 'Gelöscht')) load();
    const rn = e.target.closest('[data-zr]');
    if (rn && await confirmBox({ title: 'Jetzt ausführen?', text: 'Die Aufgabe wird sofort einmal ausgeführt.', ok: 'Ausführen' })) { await run(() => post('/api/schedules', { action: 'run', id: rn.dataset.zr }), 'Wird ausgeführt'); setTimeout(load, 2500); }
  });
  v.addEventListener('change', async (e) => {
    const s = e.target.closest('[data-zt]');
    if (s && await run(() => post('/api/schedules', { action: 'toggle', id: s.dataset.zt, enabled: s.checked }), s.checked ? 'Aktiviert' : 'Pausiert')) load();
  });
  load();
  const t = setInterval(load, 30000);
  return () => clearInterval(t);
};

// ── Updates & Server-Software ──
VIEWS.updates = (v) => {
  v.innerHTML = `${head('Updates & Software', 'Minecraft aktualisieren oder die Server-Software wechseln (Vanilla, Fabric, Forge, NeoForge, Paper, Purpur) – mit Kompatibilitätsprüfung und automatischem Backup.')}
    <div class="grid g-main"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="card" id="u-cur"><div class="skeleton"></div></div>
      <div class="card"><div class="card-h"><h2>Ziel</h2></div>
        <div class="field" style="margin:0 0 6px"><span>Server-Software</span></div>
        <div class="sw-grid" id="u-sw"></div>
        <div class="row"><label class="field grow" style="margin:0"><span>Minecraft</span><select class="input" id="u-mc"></select></label>
        <label class="field grow" style="margin:0" id="u-lv-wrap"><span id="u-lv-label">Version</span><select class="input" id="u-loader"></select></label></div>
        <div class="row" style="margin-top:14px"><button class="btn btn-primary" id="u-check">${ico('search')}Kompatibilität prüfen</button><span class="muted" id="u-hint" style="font-size:13px"></span></div></div>
      <div id="u-result"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="card"><div class="card-h"><h2>So läuft es ab</h2></div><ol class="steps">
        <li>Software, Java und alle Mods/Plugins werden geprüft</li><li>Backup der <b>Welt</b> und der <b>Serverdateien</b> (inkl. Mods und Plugins)</li><li>Server stoppt, die neue Software wird aus der offiziellen Quelle installiert</li>
        <li>Gleiche Software: Mods/Plugins werden aktualisiert, inkompatible deaktiviert.<br>Wechsel: der alte Mod-/Plugin-Ordner wird <b>geparkt</b>, passende Projekte werden für die neue Software installiert</li><li>Server startet wieder</li></ol>
        <p class="muted" style="font-size:12.5px;margin:10px 0 0">Zurück geht es über <a href="#/backups">Backups</a>: erst „Serverdateien (vor Update)“, dann die Welt „vor Update“ wiederherstellen. Oder einfach zurückwechseln – geparkte Mods/Plugins kommen dabei automatisch wieder. Eine Welt, die mit einer neueren Version geöffnet wurde, läuft nicht mehr auf einer älteren.</p></div>
      <div class="card"><div class="card-h"><h2>Verlauf</h2></div><div id="u-hist"></div></div>
      <div class="card"><div class="card-h"><h2>Live</h2></div><div class="console" id="u-log" style="max-height:220px;min-height:80px;border-radius:9px"><div class="muted">Hier erscheinen die Schritte während eines Updates.</div></div></div>
    </div></div>`;
  let vers = null, check = null, sel = null, LD = [];
  const KIND = { mod: ['Mods', 'chip-aqua'], plugin: ['Plugins', 'chip-gold'] };
  const ldName = (id) => (LD.find((l) => l.id === id) || {}).name || id || '?';
  const cur = () => (vers && vers.current) || ver();
  function tiles() {
    $('#u-sw', v).innerHTML = LD.map((l) => `<button type="button" class="sw-tile ${l.id === sel ? 'on' : ''}" data-sw="${l.id}" aria-pressed="${l.id === sel}">
      <span class="sw-h"><b>${esc(l.name)}</b>${l.kind ? `<span class="chip ${KIND[l.kind][1]}">${KIND[l.kind][0]}</span>` : '<span class="chip">ohne Mods</span>'}</span>
      <p>${esc(l.desc)}</p>${l.id === cur().loader ? '<span class="sw-cur">● läuft gerade</span>' : ''}</button>`).join('');
  }
  async function loadGames(keepMc) {
    const mcSel = $('#u-mc', v), lvSel = $('#u-loader', v);
    mcSel.innerHTML = '<option>lädt …</option>'; lvSel.innerHTML = ''; mcSel.disabled = true;
    $('#u-result', v).innerHTML = '';
    let r;
    try { r = await api(`/api/update/versions?loader=${encodeURIComponent(sel)}`); } catch (e) { mcSel.innerHTML = ''; $('#u-hint', v).textContent = e.message; return; }
    if (r.loader !== sel) return;  // inzwischen andere Software gewählt
    mcSel.disabled = false;
    const c = cur();
    const want = keepMc && r.games.includes(keepMc) ? keepMc : (sel === c.loader && r.newer.length ? r.newer[r.newer.length - 1] : (r.games.includes(c.mc) ? c.mc : r.games[0]));
    mcSel.innerHTML = r.games.map((g) => `<option ${g === want ? 'selected' : ''}>${esc(g)}</option>`).join('') || '<option value="">keine Version verfügbar</option>';
    $('#u-hint', v).textContent = r.games.length ? '' : `Für ${ldName(sel)} wurden keine Versionen gefunden.`;
    await loadBuilds();
  }
  async function loadBuilds() {
    const lvSel = $('#u-loader', v), mc = $('#u-mc', v).value;
    const meta = LD.find((l) => l.id === sel) || {};
    $('#u-lv-wrap', v).hidden = !meta.verLabel;
    $('#u-lv-label', v).textContent = meta.verLabel || '';
    $('#u-result', v).innerHTML = '';
    if (!meta.verLabel || !mc) { lvSel.innerHTML = ''; return; }
    lvSel.innerHTML = '<option>lädt …</option>'; lvSel.disabled = true;
    let r;
    try { r = await api(`/api/update/builds?loader=${encodeURIComponent(sel)}&mc=${encodeURIComponent(mc)}`); } catch (e) { lvSel.innerHTML = ''; $('#u-hint', v).textContent = e.message; return; }
    if (r.loader !== sel || r.mc !== $('#u-mc', v).value) return;
    lvSel.disabled = false;
    const c = cur();
    const pick = sel === c.loader && mc === c.mc && r.builds.includes(c.loaderVersion) && r.recommended === c.loaderVersion ? c.loaderVersion : r.recommended;
    lvSel.innerHTML = r.builds.map((b) => `<option value="${esc(b)}" ${b === pick ? 'selected' : ''}>${esc(b)}${b === r.recommended ? ' (empfohlen)' : ''}${sel === c.loader && mc === c.mc && b === c.loaderVersion ? ' – installiert' : ''}</option>`).join('') || '<option value="">keine Version für diese Minecraft-Version</option>';
    $('#u-hint', v).textContent = r.builds.length ? '' : `${ldName(sel)} gibt es für Minecraft ${mc} (noch) nicht.`;
  }
  async function load() {
    try { vers = await api('/api/update/versions'); } catch (e) { $('#u-cur', v).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    LD = vers.loaders;
    const c = vers.current;
    if (!sel) sel = c.loader;
    $('#u-cur', v).innerHTML = `<div class="card-h"><h2>Installiert</h2></div><div class="hero-meta" style="font-size:14px"><span>Software <b>${esc(c.loaderName)}</b></span><span>Minecraft <b>${esc(c.mc || '?')}</b></span>${c.loaderVersion ? `<span>${esc((LD.find((l) => l.id === c.loader) || {}).verLabel || 'Version')} <b>${esc(c.loaderVersion)}</b></span>` : ''}</div>
      ${vers.newer.length ? `<div class="notice" style="margin:14px 0 0">${ico('rocket')}<div><b>Minecraft ${esc(vers.newer[0])}</b> ist für ${esc(c.loaderName)} verfügbar.</div></div>` : `<div class="notice info" style="margin:14px 0 0">${ico('check')}<div>Du bist auf der neuesten Minecraft-Version, die es für ${esc(c.loaderName)} gibt.</div></div>`}`;
    tiles();
    await loadGames();
    try {
      const h = (await api('/api/update/history')).history;
      $('#u-hist', v).innerHTML = h.length ? h.map((x) => {
        const from = x.from_type || 'fabric', to = x.to_type || 'fabric';
        const sw = from !== to ? `${ldName(from)} → ${ldName(to)} · ` : `${ldName(to)} · `;
        return `<div class="prow"><div><div class="nm">${from !== to ? `${esc(ldName(from))} ${esc(x.from_mc)} → ${esc(ldName(to))} ${esc(x.to_mc)}` : `${esc(x.from_mc)} → ${esc(x.to_mc)}`}</div><div class="meta">${fmtDate(x.t)} · ${esc(x.user)} · ${esc(sw)}${esc(x.to_loader || '')}</div></div></div>`;
      }).join('') : '<div class="empty">Noch keine Updates über das Panel</div>';
    } catch { /* egal */ }
  }
  $('#u-sw', v).onclick = (e) => {
    const b = e.target.closest('[data-sw]');
    if (!b || b.dataset.sw === sel) return;
    const keep = $('#u-mc', v).value;
    sel = b.dataset.sw; tiles(); loadGames(keep);
  };
  $('#u-mc', v).onchange = () => loadBuilds();
  $('#u-loader', v).onchange = () => { $('#u-result', v).innerHTML = ''; };
  $('#u-check', v).onclick = async () => {
    const mc = $('#u-mc', v).value, loaderVersion = $('#u-loader', v).value;
    const box = $('#u-result', v);
    if (!mc) return;
    box.innerHTML = `<div class="card"><div class="row"><span class="spinner"></span>Prüfe ${esc(ldName(sel))}, Java und alle Mods/Plugins auf Modrinth …</div></div>`;
    try { check = await post('/api/update/check', { loader: sel, mc, loaderVersion }); } catch (e) { box.innerHTML = `<div class="card"><div class="notice">${ico('alert')}<div>${esc(e.message)}</div></div></div>`; return; }
    const st = {
      ok: ['chip-green', 'läuft weiter'], update: ['chip-aqua', 'wird aktualisiert'], missing: ['chip-red', 'keine Version – wird deaktiviert'], unknown: ['chip-gold', 'unbekannt – bitte selbst prüfen'],
      migrate: ['chip-aqua', `wird für ${check.loaderName} installiert`], parked: ['chip', 'wird geparkt (bleibt erhalten)'],
    };
    const rst = { ok: ['chip-green', 'kommt zurück'], update: ['chip-aqua', 'kommt zurück + Update'], missing: ['chip-red', 'kommt zurück, wird deaktiviert'], unknown: ['chip-gold', 'kommt zurück – bitte prüfen'] };
    const sw = check.mode === 'switch';
    const word = check.fromKind === 'plugin' ? 'Plugins' : 'Mods';
    const title = sw ? `Wechsel ${check.fromName} → ${check.loaderName} ${check.mc}` : `${check.loaderName} ${check.mc}${check.loaderVersion ? ` · ${check.loaderVersion}` : ''}`;
    const row = (m, map) => `<tr><td><b>${esc(m.name)}</b><div class="muted mono" style="font-size:11.5px">${esc(m.current || m.file)}${m.latest && !sw ? ' → ' + esc(m.latest) : ''}</div></td><td class="r"><span class="chip ${map[m.status][0]}">${map[m.status][1]}</span></td></tr>`;
    const bad = check.missing.length || (sw && check.mods.some((m) => m.status === 'parked'));
    box.innerHTML = `<div class="card card-flush"><div class="card-h"><h2>Ergebnis: ${esc(title)}</h2></div>
      <div class="table-wrap"><table class="table"><tbody>
        <tr><td><b>Java</b><div class="muted" style="font-size:12px">${check.java.required ? `benötigt Java ${check.java.required}, installiert ${check.java.installed ?? '?'}` : 'keine Angabe'}</div></td><td class="r"><span class="chip ${check.javaOk ? 'chip-green' : 'chip-red'}">${check.javaOk ? 'passt' : 'zu alt'}</span></td></tr>
        ${check.mods.length ? `<tr><td colspan="2" class="muted" style="font-size:12px;font-weight:600;padding-top:14px">${sw ? `Bisherige ${word} (${esc(check.fromName)})` : (check.kind === 'plugin' ? 'Plugins' : 'Mods')}</td></tr>` : ''}
        ${check.mods.map((m) => row(m, st)).join('')}
        ${check.restore.length ? `<tr><td colspan="2" class="muted" style="font-size:12px;font-weight:600;padding-top:14px">Aus der früheren ${esc(check.loaderName)}-Installation</td></tr>${check.restore.map((m) => row(m, rst)).join('')}` : ''}
      </tbody></table></div>
      <div style="padding:16px 18px">
        <div class="notice-list">
        ${check.warnings.map((w) => `<div class="notice info">${ico('info')}<div>${w}</div></div>`).join('')}
        ${!sw && check.missing.length ? `<div class="notice">${ico('alert')}<div>Für <b>${esc(check.missing.join(', '))}</b> gibt es noch keine passende Version. Diese werden deaktiviert. Ggf. lieber ein paar Tage warten.</div></div>` : ''}
        ${sw && check.parked.length ? `<div class="notice">${ico('alert')}<div>Für <b>${esc(check.parked.join(', '))}</b> gibt es keine ${esc(check.loaderName)}-Version (oder es ist nicht auf Modrinth). Diese fehlen nach dem Wechsel, bleiben aber geparkt.</div></div>` : ''}
        ${!check.javaOk ? `<div class="notice">${ico('alert')}<div>Bitte zuerst Java ${check.java.required} installieren oder in den Einstellungen Java auf „automatisch“ stellen.</div></div>` : ''}
        </div>
        <button class="btn ${bad ? 'btn-danger' : 'btn-primary'}" id="u-run" ${!check.javaOk || check.same || S.task ? 'disabled' : ''}>${ico('rocket')}${check.same ? 'Bereits installiert' : sw ? `Zu ${esc(check.loaderName)} wechseln` : `Auf ${esc(check.mc)} aktualisieren`}</button></div></div>`;
  };
  v.addEventListener('click', async (e) => {
    if (!e.target.closest('#u-run')) return;
    const players = S.stats.players || 0;
    const sw = check.mode === 'switch';
    const word = sw ? 'wechseln' : 'update';
    const ok = await confirmBox({
      title: sw ? `Zu ${check.loaderName} ${check.mc} wechseln?` : `Auf ${check.loaderName} ${check.mc} aktualisieren?`,
      text: `Der Server wird gestoppt${players ? ` – <b>${players} Spieler werden getrennt</b>` : ''}. Vorher werden Welt und Serverdateien gesichert.${sw && check.kind === 'mod' ? ` Spieler, die Client-Mods brauchen, müssen diese danach mit <b>${esc(check.loaderName)}</b> nutzen.` : ''} Spieler brauchen Minecraft ${esc(check.mc)}.<br><br>Zum Bestätigen <b>${word}</b> eintippen:`,
      ok: sw ? 'Wechsel starten' : 'Update starten', danger: true, input: true, inputLabel: '', placeholder: word, requireText: word,
    });
    if (ok) run(() => post('/api/update/run', { loader: check.loader, mc: check.mc, loaderVersion: check.loaderVersion }), `${sw ? 'Wechsel' : 'Update'} gestartet – Fortschritt oben und rechts`);
  });
  const logBox = $('#u-log', v);
  const paint = (lines) => { const f = lines.filter(([k, l]) => (k === 'sys' || k === 'err') && /^Update/.test(l)); if (!f.length) return; const ph = $('.muted', logBox); ph && ph.remove(); f.forEach(([k, l]) => { const d = document.createElement('div'); d.className = 'l ' + k; d.textContent = l; logBox.append(d); }); logBox.scrollTop = logBox.scrollHeight; };
  paint(S.logs.slice(-300));
  load();
  return sub((ev, data) => { if (ev === 'log') paint(data); if (ev === 'task' && !S.task) { sel = null; load(); } });
};

// ═════════════════════════ Runde 3 ═════════════════════════
const prettyId = (id) => String(id || '').split(':').pop().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const DIM_MAP = { overworld: 'world', the_nether: 'world_the_nether', the_end: 'world_the_end' };
const DIM_NAME = { overworld: 'Oberwelt', the_nether: 'Nether', the_end: 'Ende' };
const fmtUntil = (t) => new Date(t * 1000).toLocaleString(I18N.locale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ── Karten-Seite: Werkzeuge, Vorschau in der Karte, Render-Status ──
function mapPage(body, actions) {
  const focus = store.get('mapFocus', '');
  if (focus) store.set('mapFocus', '');
  actions.innerHTML = `<span class="render-chip" id="mp-chip"></span><a class="btn" href="/bluemap/" target="_blank" rel="noopener">${ico('external')}<span>Vollbild</span></a>`;
  body.innerHTML = `<div class="map-layout">
    <div class="map-stage card card-flush">
      <iframe class="map-frame" id="map-frame" src="/bluemap/${esc(focus)}" title="BlueMap Weltkarte" allow="fullscreen"></iframe>
      <div class="map-tools" id="mp-tools">
        <button data-mode="view" class="on" title="Karte bewegen und ansehen">${ico('globe')}<span>Ansehen</span></button>
        <button data-mode="marker" title="Auf die Karte klicken, um einen Marker zu setzen">${ico('pin')}<span>Marker setzen</span></button>
        <button data-mode="area" title="Zwei Ecken auf der Karte anklicken">${ico('restart')}<span>Gebiet wählen</span></button>
      </div>
      <div class="map-hint" id="mp-hint" hidden></div>
    </div>
    <aside class="card map-side">
      <div class="seg ms-tabs" id="ms-tabs"><button data-t="status">${ico('activity')}Status</button><button data-t="markers">${ico('pin')}Marker</button><button data-t="region">${ico('restart')}Gebiet</button></div>
      <div id="ms-status"></div><div id="ms-markers" hidden></div><div id="ms-region" hidden></div>
    </aside></div>
    <p class="muted map-help">Maus: links ziehen = verschieben · rechts ziehen = drehen/kippen · Mausrad = zoomen · Doppelklick = heranfliegen</p>`;
  const frame = $('#map-frame', body), hint = $('#mp-hint', body);
  const S2 = { mode: 'view', marker: null, area: { a: null, b: null }, render: null, markers: [], backups: [], tab: 'status' };

  // ---- Zugriff auf BlueMap im iframe (gleiche Herkunft dank Proxy) ----
  const bm = () => { try { const w = frame.contentWindow; return w && w.bluemap && w.BlueMap && w.bluemap.mapViewer ? { app: w.bluemap, BM: w.BlueMap } : null; } catch { return null; } };
  let previewSet = null, hooked = null;
  function pset() {
    const b = bm(); if (!b) return null;
    if (!previewSet || previewSet.parent !== b.app.mapViewer.markers) {
      previewSet = new b.BM.MarkerSet('werkbank-vorschau');
      previewSet.data.label = 'Vorschau'; previewSet.data.toggleable = false;
      b.app.mapViewer.markers.add(previewSet);
    }
    return previewSet;
  }
  function clearPreview(id) { try { const s = pset(); if (!s) return; for (const c of [...s.children]) if (!id || (c.data && c.data.id === id)) s.remove(c); } catch { /* egal */ } }
  // BlueMap erwartet vollständige Marker-Daten (wie aus markers.json)
  const mkData = (extra) => ({ classes: [], sorting: 0, listed: false, minDistance: 0, maxDistance: 100000, link: null, newTab: false, ...extra });
  const safe = (fn) => () => { try { fn(); } catch (e) { console.warn('Vorschau:', e); } };
  function previewPoi() { safe(previewPoiRaw)(); }
  function previewArea() { safe(previewAreaRaw)(); }
  function previewPoiRaw() {
    clearPreview('wb-poi');
    const m = S2.marker; const b = bm(), s = pset();
    if (!m || !b || !s || DIM_MAP[m.dim] !== curMap()) return;
    const poi = new b.BM.PoiMarker('wb-poi');
    poi.updateFromData(mkData({ type: 'poi', position: { x: m.x + 0.5, y: m.y + 1, z: m.z + 0.5 }, label: m.label || 'Neuer Marker', icon: 'assets/poi.svg', anchor: { x: 25, y: 45 },
      detail: `<b>${esc(m.label || 'Neuer Marker')}</b>${m.detail ? '<br>' + esc(m.detail) : ''}<br><i>Vorschau – noch nicht gespeichert</i>` }));
    s.add(poi);
  }
  function previewAreaRaw() {
    clearPreview('wb-area'); clearPreview('wb-corner');
    const { a, b: c } = S2.area; const B = bm(), s = pset();
    if (!B || !s || !a || (c && c.dim !== a.dim) || DIM_MAP[a.dim] !== curMap()) return;
    if (!c) {  // erst eine Ecke gesetzt → kleiner Punkt-Marker
      const p = new B.BM.PoiMarker('wb-corner');
      p.updateFromData(mkData({ type: 'poi', position: { x: a.x + 0.5, y: a.y + 1, z: a.z + 0.5 }, label: 'Ecke 1', icon: 'assets/poi.svg', anchor: { x: 25, y: 45 }, detail: 'Ecke 1 – jetzt die zweite Ecke anklicken' }));
      s.add(p); return;
    }
    const r = chunkRect(a, c);
    const shape = new B.BM.ShapeMarker('wb-area');
    const y = Math.max(a.y, c.y) + 2;
    shape.updateFromData(mkData({ type: 'shape', position: { x: (r.x1 + r.x2 + 1) / 2, y, z: (r.z1 + r.z2 + 1) / 2 }, label: 'Gebiet zum Zurücksetzen', detail: 'Gebiet zum Zurücksetzen',
      shape: [{ x: r.x1, z: r.z1 }, { x: r.x2 + 1, z: r.z1 }, { x: r.x2 + 1, z: r.z2 + 1 }, { x: r.x1, z: r.z2 + 1 }], holes: [],
      shapeY: y, lineWidth: 3, depthTest: false, lineColor: { r: 255, g: 90, b: 90, a: 1 }, fillColor: { r: 255, g: 90, b: 90, a: 0.22 } }));
    s.add(shape);
  }
  const curMap = () => { const b = bm(); return b && b.app.mapViewer.map ? b.app.mapViewer.map.data.id : null; };
  const camera = () => { const b = bm(); if (!b) return null; const p = b.app.mapViewer.controlsManager.position; const id = curMap(); return { dim: Object.keys(DIM_MAP).find((k) => DIM_MAP[k] === id) || 'overworld', x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) }; };
  async function flyTo(dim, x, y, z, dist = 90) {
    const b = bm(); if (!b) return;
    if (curMap() !== DIM_MAP[dim]) { try { await b.app.switchMap(DIM_MAP[dim]); } catch { /* egal */ } }
    const cm = b.app.mapViewer.controlsManager; cm.position.set(x, y, z); cm.distance = dist;
    setTimeout(() => { previewPoi(); previewArea(); }, 300);
  }
  function setMode(m) {
    S2.mode = m;
    $$('#mp-tools button', body).forEach((x) => x.classList.toggle('on', x.dataset.mode === m));
    try { frame.contentDocument.body.style.cursor = m === 'view' ? '' : 'crosshair'; } catch { /* egal */ }
    updateHint();
    if (m === 'marker') showTab('markers');
    if (m === 'area') { showTab('region'); if (S2.area.a && S2.area.b) { S2.area = { a: null, b: null }; renderRegionInfo(); previewArea(); } }
  }
  function updateHint() {
    const t = S2.mode === 'marker' ? 'Klicke auf die Stelle, an der der Marker stehen soll.' : S2.mode === 'area' ? (!S2.area.a ? 'Klicke die erste Ecke des Gebiets an.' : !S2.area.b ? 'Jetzt die gegenüberliegende Ecke anklicken.' : 'Gebiet gewählt – rechts prüfen und zurücksetzen. Erneut klicken = neu wählen.') : '';
    hint.hidden = !t; hint.innerHTML = t ? `${ico(S2.mode === 'marker' ? 'pin' : 'restart')}${esc(t)}` : '';
  }
  function onMapClick(e) {
    if (S2.mode === 'view') return;
    const d = e.detail || {};
    const h = d.hiresHit || d.hit || (d.lowresHits || [])[0] || (d.intersections || [])[0];  // genaue Blockkarte bevorzugen
    if (!h || !h.point) return;
    const id = curMap(), dim = Object.keys(DIM_MAP).find((k) => DIM_MAP[k] === id) || 'overworld';
    // Weit herausgezoomt gibt es nur die grobe Übersichtskarte ohne Höhen → Geländehöhe der Kartenmitte nehmen
    const cam = camera();
    const y = d.hiresHit ? Math.floor(h.point.y) : (cam && cam.y > 0 ? cam.y : 64);
    const pt = { dim, x: Math.floor(h.point.x), y, z: Math.floor(h.point.z) };
    if (S2.mode === 'marker') {
      S2.marker = { ...(S2.marker || {}), ...pt };
      fillMarkerForm(); previewPoi();
      const f = $('#mk-form', body); f && f.label.focus();
    } else {
      if (!S2.area.a || S2.area.b) S2.area = { a: pt, b: null };
      else S2.area.b = pt;
      renderRegionInfo(); previewArea();
    }
    updateHint();
  }
  // BlueMap im iframe anbinden, sobald es bereit ist (auch nach Neuladen des iframes)
  const hook = setInterval(() => {
    const b = bm(); if (!b || hooked === b.app) return;
    hooked = b.app; previewSet = null;
    b.app.events.addEventListener('bluemapMapInteraction', onMapClick);
    b.app.events.addEventListener('bluemapMapChanged', () => setTimeout(() => { previewSet = null; previewPoi(); previewArea(); }, 500));
    try { frame.contentDocument.body.style.cursor = S2.mode === 'view' ? '' : 'crosshair'; } catch { /* egal */ }
    previewPoi(); previewArea();
  }, 700);

  // ---- Seitenleiste ----
  function showTab(t) {
    S2.tab = t; store.set('mapSideTab2', t);
    $$('#ms-tabs button', body).forEach((x) => x.classList.toggle('on', x.dataset.t === t));
    ['status', 'markers', 'region'].forEach((k) => { $('#ms-' + k, body).hidden = k !== t; });
    if (t === 'markers') renderMarkers();
    if (t === 'region') renderRegion();
  }
  $('#ms-tabs', body).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) showTab(b.dataset.t); };
  $('#mp-tools', body).onclick = (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); };

  // Status
  function renderStatus() {
    const r = S2.render, el = $('#ms-status', body), chip = $('#mp-chip');
    if (!r) { el.innerHTML = '<div class="empty">Server offline – kein Render-Status.</div>'; if (chip) chip.innerHTML = ''; return; }
    const busy = r.maps.some((m) => m.state !== 'done' || m.pending);
    const state = r.paused ? ['paused', 'Pausiert', 'pause'] : r.threads && busy ? ['run', 'Rendert', 'activity'] : ['done', 'Alles aktuell', 'check'];
    if (chip) chip.innerHTML = `<span class="rc rc-${state[0]}">${ico(state[2])}${state[1]}${state[0] === 'run' && r.current ? ` · ${num(r.current.progress, 0)} %` : ''}</span>`;
    el.innerHTML = `<div class="rs-head rc-${state[0]}">${ico(state[2])}<div><b>${state[1]}</b><small>${r.paused ? 'Das Rendern ist angehalten – die Karte wird nicht aktualisiert.' : busy ? `${r.threads} Render-Thread${r.threads === 1 ? '' : 's'} · niedrigste Priorität` : 'Alle Gebiete sind auf dem neuesten Stand.'}</small></div></div>
      <div class="rs-maps">${r.maps.map((m) => {
        const rendering = m.state === 'rendering';
        const pct = rendering ? m.progress ?? 0 : m.state === 'done' && !m.pending ? 100 : 0;
        const label = rendering ? `${num(m.progress, 1)} %${m.remaining && !r.paused ? ` · noch ca. ${deRemain(m.remaining)}` : ''}` : m.pending ? `wartet · ${m.pending} Aufgabe${m.pending === 1 ? '' : 'n'}` : 'aktuell';
        return `<div class="rs-map ${rendering ? 'active' : ''}"><div class="row"><b>${esc(MAP_NAME[m.id] || m.id)}</b><span class="grow"></span><span class="muted">${esc(label)}</span></div>
          <div class="bar"><i style="width:${pct}%;${rendering && !r.paused ? '' : 'background-color:var(--muted)'}"></i></div></div>`;
      }).join('')}</div>
      ${r.current && !r.paused ? `<p class="muted" style="font-size:12px;margin:10px 0 0">Gerade: ${esc(r.current.detail ? r.current.detail.replace('updating region', 'Region') : '')} in ${esc(MAP_NAME[r.current.map] || r.current.map)}</p>` : ''}
      <div class="row" style="margin-top:16px">${r.paused ? `<button class="btn btn-primary btn-sm" data-rs="resume">${ico('play')}Rendern fortsetzen</button>`
        : busy ? `<button class="btn btn-sm" data-rs="pause">${ico('pause')}Rendern pausieren</button>` : `<button class="btn btn-sm" disabled>${ico('check')}Nichts zu tun</button>`}
        <button class="btn btn-sm btn-ghost" data-rs="update" title="Prüft die ganze Welt auf Änderungen und rendert sie nach">${ico('refresh')}Auf Änderungen prüfen</button></div>
      <p class="muted" style="font-size:12px;margin:12px 0 0">Neu gebaute oder erkundete Gebiete rendert BlueMap automatisch nach. Pausieren lohnt sich nur, wenn der Server gerade ruckelt.</p>`;
  }
  $('#ms-status', body).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rs]'); if (!b) return;
    b.disabled = true;
    const msg = { pause: 'Rendern pausiert', resume: 'Rendern läuft weiter', update: 'Prüfung gestartet' }[b.dataset.rs];
    if (await run(() => post('/api/map', { action: b.dataset.rs }), msg)) { const r = await api('/api/map').catch(() => null); if (r) { S2.render = r.render; renderStatus(); } }
    b.disabled = false;
  });

  // Marker
  function fillMarkerForm() {
    const f = $('#mk-form', body); if (!f || !S2.marker) return;
    ['x', 'y', 'z'].forEach((k) => { if (S2.marker[k] != null) f[k].value = S2.marker[k]; });
    if (S2.marker.dim) f.dim.value = S2.marker.dim;
    $('#mk-pos', body).innerHTML = `${ico('pin')}${DIM_NAME[S2.marker.dim] || ''} · <span class="mono">${S2.marker.x} / ${S2.marker.y} / ${S2.marker.z}</span>`;
  }
  async function renderMarkers() {
    const el = $('#ms-markers', body);
    try { S2.markers = (await api('/api/markers')).markers; } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    el.innerHTML = `<form id="mk-form" autocomplete="off">
        <div class="mk-pos" id="mk-pos">${ico('pin')}<span>Noch keine Position – wähle oben <b>„Marker setzen“</b> und klicke auf die Karte.</span></div>
        <label class="field"><span>Name</span><input name="label" maxlength="60" placeholder="z. B. Felix’ Basis" required></label>
        <label class="field"><span>Beschreibung (optional)</span><input name="detail" maxlength="200" placeholder="erscheint beim Anklicken"></label>
        <details class="mk-adv"><summary>Koordinaten von Hand</summary>
          <div class="row" style="margin:10px 0"><select class="input" name="dim">${Object.entries(DIM_NAME).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
            <button type="button" class="btn btn-sm btn-ghost" id="mk-cam">${ico('pin')}Kartenmitte</button></div>
          <div class="xyz"><input class="input mono" name="x" type="number" placeholder="X" required><input class="input mono" name="y" type="number" placeholder="Y" required><input class="input mono" name="z" type="number" placeholder="Z" required></div></details>
        <div class="row" style="margin-top:12px"><button class="btn btn-primary btn-sm">${ico('check')}Marker speichern</button><button type="button" class="btn btn-sm btn-ghost" id="mk-reset">Verwerfen</button></div></form>
      <div class="ms-list"><div class="ms-list-h">Gespeicherte Marker <span class="muted">${S2.markers.length}</span></div>${S2.markers.length ? S2.markers.map((m) => `<div class="prow mk-row" data-mgo='${esc(JSON.stringify([m.dim, m.x, m.y, m.z]))}' title="Auf der Karte zeigen">
        <span class="crash-ico" style="background:var(--accent-soft);color:var(--accent)">${ico('pin')}</span>
        <div style="min-width:0"><div class="nm">${esc(m.label)}</div><div class="meta mono">${DIM_NAME[m.dim]} · ${m.x} / ${m.y} / ${m.z}</div></div>
        <div class="right"><button class="icon-btn danger" title="Löschen" data-mdel="${esc(m.id)}">${ico('trash')}</button></div></div>`).join('') : '<div class="empty">Noch keine Marker</div>'}</div>`;
    const f = $('#mk-form', body);
    if (S2.marker) { f.label.value = S2.marker.label || ''; f.detail.value = S2.marker.detail || ''; fillMarkerForm(); }
    f.addEventListener('input', () => {
      S2.marker = { ...(S2.marker || {}), label: f.label.value, detail: f.detail.value, dim: f.dim.value, x: +f.x.value, y: +f.y.value, z: +f.z.value };
      if (f.x.value !== '' && f.z.value !== '') { fillMarkerForm(); previewPoi(); }
    });
    $('#mk-cam', body).onclick = () => { const c = camera(); if (!c) return toast('Karte noch nicht geladen', 'err'); S2.marker = { ...(S2.marker || {}), ...c }; fillMarkerForm(); previewPoi(); };
    $('#mk-reset', body).onclick = () => { S2.marker = null; clearPreview('wb-poi'); renderMarkers(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (f.x.value === '' || f.z.value === '') return toast('Bitte zuerst eine Position auf der Karte anklicken', 'err');
      const m = { label: f.label.value, detail: f.detail.value, dim: f.dim.value, x: +f.x.value, y: +f.y.value, z: +f.z.value };
      if (await run(() => post('/api/markers', { action: 'add', marker: m }), `„${m.label}“ gespeichert – erscheint gleich auf der Karte`)) {
        S2.marker = null; clearPreview('wb-poi'); setMode('view'); renderMarkers();
      }
    };
  }
  $('#ms-markers', body).addEventListener('click', async (e) => {
    const d = e.target.closest('[data-mdel]');
    if (d) { e.stopPropagation(); if (await confirmBox({ title: 'Marker löschen?', ok: 'Löschen', danger: true }) && await run(() => post('/api/markers', { action: 'delete', id: d.dataset.mdel }), 'Marker gelöscht')) renderMarkers(); return; }
    const g = e.target.closest('[data-mgo]');
    if (g) { const [dim, x, y, z] = JSON.parse(g.dataset.mgo); flyTo(dim, x, y, z); }
  });

  // Gebiet
  const chunkRect = (a, b) => ({ x1: Math.floor(Math.min(a.x, b.x) / 16) * 16, z1: Math.floor(Math.min(a.z, b.z) / 16) * 16, x2: Math.floor(Math.max(a.x, b.x) / 16) * 16 + 15, z2: Math.floor(Math.max(a.z, b.z) / 16) * 16 + 15 });
  async function renderRegion() {
    const el = $('#ms-region', body);
    try { S2.backups = (await api('/api/backups')).backups.filter((x) => x.kind !== 'serverdateien'); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    el.innerHTML = `<div class="steps-v">
        <div class="stp"><span>1</span><div><b>Gebiet wählen</b><small>Oben <b>„Gebiet wählen“</b> und zwei Ecken auf der Karte anklicken – oder um die Kartenmitte:</small>
          <div class="row" style="margin-top:8px"><div class="seg" id="rg-rad">${[16, 32, 64, 128].map((r) => `<button type="button" data-r="${r}">± ${r}</button>`).join('')}</div></div></div></div>
        <div class="stp"><span>2</span><div><b>Backup wählen</b><select class="input" id="rg-backup" style="margin-top:8px">${S2.backups.map((x) => `<option value="${esc(x.name)}">${fmtDate(x.mtime)} · ${esc({ auto: 'Auto', manuell: 'Manuell', 'vor-update': 'vor Update', 'pre-restore': 'vor Restore' }[x.kind] || x.kind)}</option>`).join('')}</select></div></div>
        <div class="stp"><span>3</span><div><b>Prüfen & zurücksetzen</b><div id="rg-info" class="rg-info"></div>
          <button class="btn btn-danger btn-sm" id="rg-go" style="margin-top:10px">${ico('restart')}Gebiet zurücksetzen</button></div></div></div>
      <div class="notice info" style="font-size:12.5px;margin:14px 0 0">${ico('info')}<div>Nur der rot markierte Bereich wird auf den Stand des Backups gebracht – immer in ganzen 16×16-Chunks. Der Server startet dafür kurz neu, der jetzige Zustand wird vorher gesichert.</div></div>`;
    $('#rg-rad', body).onclick = (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      const c = camera(); if (!c) return toast('Karte noch nicht geladen', 'err');
      const r = +b.dataset.r;
      S2.area = { a: { ...c, x: c.x - r, z: c.z - r }, b: { ...c, x: c.x + r, z: c.z + r } };
      renderRegionInfo(); previewArea(); updateHint();
    };
    $('#rg-go', body).onclick = async () => {
      const { a, b } = S2.area; if (!a || !b) return toast('Bitte zuerst ein Gebiet wählen', 'err');
      if (!S2.backups.length) return toast('Kein Backup vorhanden', 'err');
      const r = chunkRect(a, b), n = ((r.x2 - r.x1 + 1) / 16) * ((r.z2 - r.z1 + 1) / 16);
      const bk = $('#rg-backup', body);
      const ok = await confirmBox({ title: 'Gebiet zurücksetzen?', text: `${n} Chunks (${r.x2 - r.x1 + 1} × ${r.z2 - r.z1 + 1} Blöcke) in ${DIM_NAME[a.dim]} werden auf den Stand vom <b>${esc(bk.selectedOptions[0].textContent)}</b> gebracht. Alles, was dort seitdem gebaut wurde, ist dann weg (wird vorher gesichert). Der Server startet kurz neu.<br><br>Zum Bestätigen <b>zurücksetzen</b> eintippen:`, ok: 'Zurücksetzen', danger: true, input: true, placeholder: 'zurücksetzen', requireText: 'zurücksetzen' });
      if (ok && await run(() => post('/api/region/restore', { backup: bk.value, dim: a.dim, x1: r.x1, z1: r.z1, x2: r.x2, z2: r.z2 }), 'Gebiet wird zurückgesetzt – Fortschritt oben')) { S2.area = { a: null, b: null }; clearPreview('wb-area'); setMode('view'); renderRegionInfo(); }
    };
    renderRegionInfo();
  }
  function renderRegionInfo() {
    const el = $('#rg-info', body); if (!el) return;
    const { a, b } = S2.area;
    if (!a) { el.innerHTML = '<span class="muted">Noch kein Gebiet gewählt.</span>'; return; }
    if (!b) { el.innerHTML = `<span class="muted">Ecke 1: <span class="mono">${a.x} / ${a.z}</span> – jetzt die zweite Ecke anklicken.</span>`; return; }
    if (a.dim !== b.dim) { el.innerHTML = '<span style="color:var(--red)">Beide Ecken müssen in derselben Dimension liegen.</span>'; return; }
    const r = chunkRect(a, b), w = r.x2 - r.x1 + 1, h = r.z2 - r.z1 + 1, n = (w / 16) * (h / 16);
    el.innerHTML = `<div class="rg-box"><div><small>Bereich</small><b>${w} × ${h}</b></div><div><small>Chunks</small><b>${n}</b></div><div><small>Welt</small><b>${DIM_NAME[a.dim]}</b></div></div>
      <div class="muted mono" style="font-size:11.5px;margin-top:6px">X ${r.x1} … ${r.x2} · Z ${r.z1} … ${r.z2}</div>${w > 4096 || h > 4096 ? '<div style="color:var(--red);font-size:12.5px">Zu groß – max. 4096 × 4096 Blöcke.</div>' : ''}`;
  }

  showTab(store.get('mapSideTab2', 'status'));
  return {
    status(r) { S2.render = r; renderStatus(); },
    destroy() { clearInterval(hook); },
  };
}
// ── 3D-Skin aus reinem CSS (Skin-Textur 64×64, Rüstung aus der Client-Datei) ──
// pos/size in Skin-Pixeln, base/over = UV-Ursprung im Skin, armor = UV in der Rüstungstextur (64×32)
const SKIN_PARTS = {
  head: { pos: [4, 0], size: [8, 8, 8], base: [0, 0], over: [32, 0], armor: [{ slot: 'head', uv: [0, 0], inf: 1 }] },
  body: { pos: [4, 8], size: [8, 12, 4], base: [16, 16], over: [16, 32], armor: [{ slot: 'legs', uv: [16, 16], inf: 0.5 }, { slot: 'chest', uv: [16, 16], inf: 1 }] },
  rarm: { pos: [0, 8], size: [4, 12, 4], base: [40, 16], over: [40, 32], armor: [{ slot: 'chest', uv: [40, 16], inf: 1 }], sw: 'a' },
  larm: { pos: [12, 8], size: [4, 12, 4], base: [32, 48], over: [48, 48], armor: [{ slot: 'chest', uv: [40, 16], inf: 1, mir: true }], sw: 'b' },
  rleg: { pos: [4, 20], size: [4, 12, 4], base: [0, 16], over: [0, 32], armor: [{ slot: 'legs', uv: [0, 16], inf: 0.5 }, { slot: 'feet', uv: [0, 16], inf: 1 }], sw: 'b' },
  lleg: { pos: [8, 20], size: [4, 12, 4], base: [16, 48], over: [0, 48], armor: [{ slot: 'legs', uv: [0, 16], inf: 0.5, mir: true }, { slot: 'feet', uv: [0, 16], inf: 1, mir: true }], sw: 'a' },
};
function skinCuboid(img, tw, th, [u, v], [w, h, d], S, inf = 0, mir = false) {
  const W = w * S, H = h * S, D = d * S;
  const faces = [
    ['front', u + d, v + d, w, h, `translateZ(${D / 2}px)`],
    ['back', u + 2 * d + w, v + d, w, h, `rotateY(180deg) translateZ(${D / 2}px)`],
    ['right', u, v + d, d, h, `rotateY(-90deg) translateZ(${W / 2}px)`],
    ['left', u + d + w, v + d, d, h, `rotateY(90deg) translateZ(${W / 2}px)`],
    ['top', u + d, v, w, d, `rotateX(90deg) translateZ(${H / 2}px)`],
    ['bottom', u + d + w, v, w, d, `rotateX(-90deg) translateZ(${H / 2}px)`],
  ];
  const sx = (w + 2 * inf) / w, sy = (h + 2 * inf) / h, sz = (d + 2 * inf) / d;
  return `<div class="sk-cub" style="transform:scale3d(${mir ? -sx : sx},${sy},${sz})">${faces.map(([n, fu, fv, fw, fh, tf]) =>
    `<i class="sk-f sk-${n}" style="width:${fw * S}px;height:${fh * S}px;left:${(W - fw * S) / 2}px;top:${(H - fh * S) / 2}px;transform:${tf};background-image:url('${img}');background-size:${tw * S}px ${th * S}px;background-position:-${fu * S}px -${fv * S}px"></i>`).join('')}</div>`;
}
function skin3d(el, uuid, eq = {}, S = 5) {
  const skin = `https://mc-heads.net/skin/${encodeURIComponent(uuid)}`;
  const mat = (it) => { const m = it && it.id && it.id.split(':').pop().match(/^(leather|chainmail|iron|golden|diamond|netherite|copper|turtle)_/); return m ? ({ golden: 'gold', turtle: 'turtle_scute' }[m[1]] || m[1]) : null; };
  const worn = { head: mat(eq.head), chest: mat(eq.chest), legs: mat(eq.legs), feet: mat(eq.feet) };
  let html = '';
  for (const [name, p] of Object.entries(SKIN_PARTS)) {
    let inner = skinCuboid(skin, 64, 64, p.base, p.size, S) + skinCuboid(skin, 64, 64, p.over, p.size, S, 0.5);
    for (const a of p.armor) {
      if (!worn[a.slot]) continue;
      const layer = a.slot === 'legs' ? 'humanoid_leggings' : 'humanoid';
      inner += skinCuboid(`/api/texture?p=entity/equipment/${layer}/${worn[a.slot]}`, 64, 32, a.uv, p.size, S, a.inf, a.mir);
    }
    html += `<div class="sk-part sk-${name}${p.sw ? ' sw-' + p.sw : ''}" style="left:${p.pos[0] * S}px;top:${p.pos[1] * S}px;width:${p.size[0] * S}px;height:${p.size[1] * S}px">${inner}</div>`;
  }
  el.innerHTML = `<div class="sk-stage" title="Ziehen zum Drehen"><div class="sk-model auto" style="width:${16 * S}px;height:${32 * S}px">${html}</div></div><div class="sk-shadow"></div>`;
  const model = $('.sk-model', el), stage = $('.sk-stage', el);
  let drag = null, ry = -28;
  stage.addEventListener('pointerdown', (e) => {
    const m = getComputedStyle(model).transform;  // aktuelle Drehung aus der Animation übernehmen
    if (model.classList.contains('auto') && m && m !== 'none') { const v = new DOMMatrix(m); ry = Math.atan2(-v.m31, v.m33) * 180 / Math.PI; }
    model.classList.remove('auto'); model.style.setProperty('--ry', ry + 'deg');
    drag = { x: e.clientX, ry }; stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; ry = drag.ry + (e.clientX - drag.x) * 0.6; model.style.setProperty('--ry', ry + 'deg'); });
  stage.addEventListener('pointerup', () => { drag = null; });
}

// ── Spieler-Detailseite (Punkt 14) ──
VIEWS.player = (v, uuid) => {
  v.innerHTML = `<a class="btn btn-ghost btn-sm" href="#/players" style="margin-bottom:12px">${ico('chevronLeft')}Alle Spieler</a><div id="pl-body"><div class="card"><div class="skeleton"></div></div></div>`;
  const body = $('#pl-body', v);
  async function load() {
    let d, hist;
    try { [d, hist] = await Promise.all([api('/api/player?uuid=' + encodeURIComponent(uuid)), api('/api/history?days=90').catch(() => null)]); } catch (e) { body.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
    const st = d.stats || {};
    const sessions = hist ? hist.sessions.filter((s) => s[0] === d.name).reverse() : [];
    const p = { uuid: d.uuid, name: d.name };
    const chips = `${d.online ? '<span class="chip chip-green">● online</span>' : ''}${d.op ? '<span class="chip chip-gold">OP</span>' : ''}${d.whitelisted ? '<span class="chip chip-aqua">Whitelist</span>' : ''}${d.ban ? `<span class="chip chip-red">Gebannt${d.tempban ? ' bis ' + fmtUntil(d.tempban.until) : ''}</span>` : ''}`;
    const bars = (obj) => { const e = Object.entries(obj).filter(([, x]) => x > 0.005).sort((a, b) => b[1] - a[1]); const mx = Math.max(...e.map((x) => x[1]), 0.01); return e.length ? e.map(([k, x]) => `<div class="hbar"><span>${esc(k)}</span><div class="bar"><i style="width:${(x / mx) * 100}%"></i></div><b class="mono">${num(x, 1)} km</b></div>`).join('') : '<div class="empty">Noch nichts</div>'; };
    const toplist = (arr, icons) => (arr && arr.length ? arr.map(([id, n]) => `<div class="prow">${icons ? `<span class="slot mini"><img src="/api/itemicon?id=${encodeURIComponent(id)}" alt="" data-fallback="${esc(prettyId(id)[0])}"></span>` : ''}<div class="nm">${esc(prettyId(id))}</div><div class="right mono">${fmtNum(n)}</div></div>`).join('') : '<div class="empty">Noch nichts</div>');
    body.innerHTML = `
      <div class="card player-hero"><div class="sk-wrap" id="pl-skin"></div>
        <div style="min-width:0"><h1 style="margin:0;font-size:26px">${esc(d.name || uuid)}</h1><div class="chips" style="margin-top:6px">${chips}</div>
          <div class="muted mono" style="font-size:11.5px;margin-top:6px">${esc(uuid)}</div></div>
        <div class="row player-actions">
          <button class="btn btn-sm" data-pd="inv">${ico('bag')}Inventar</button>
          <button class="btn btn-sm" data-pd="msg">${ico('chat')}Nachricht</button>
          ${d.online ? `<button class="btn btn-sm" data-pd="kick">${ico('logout')}Kicken</button>` : ''}
          <button class="btn btn-sm" data-pd="${d.op ? 'deop' : 'op'}">${ico('crown')}${d.op ? 'OP entziehen' : 'OP geben'}</button>
          <button class="btn btn-sm" data-pd="${d.whitelisted ? 'whitelist-remove' : 'whitelist-add'}">${ico(d.whitelisted ? 'x' : 'plus')}${d.whitelisted ? 'Von Whitelist' : 'Zur Whitelist'}</button>
          <button class="btn btn-sm btn-danger" data-pd="${d.ban ? 'pardon' : 'ban'}">${ico('ban')}${d.ban ? 'Entbannen' : 'Bannen'}</button>
        </div></div>
      ${d.ban ? `<div class="notice" style="margin-top:16px;border-color:color-mix(in srgb, var(--red) 35%, transparent);background:var(--red-soft)">${ico('ban')}<div><b>Gebannt</b> von ${esc(d.ban.source || '–')} · Grund: ${esc(d.ban.reason || '–')}${d.tempban ? ` · <b>läuft ab ${fmtUntil(d.tempban.until)}</b>` : ' · dauerhaft'}</div></div>` : ''}
      <div class="grid g-4" style="margin-top:16px">
        ${[['Spielzeit', fmtDur(st.playTime), `${sessions.length} Sitzungen (90 T)`], ['Tode', st.deaths ?? '–', st.killedBy && st.killedBy[0] ? 'meist durch ' + prettyId(st.killedBy[0][0]) : ''], ['Mob-Kills', fmtNum(st.mobKills || 0), `${st.playerKills || 0} Spieler`], ['Erfolge', d.advancements.length, d.advancements[0] ? 'zuletzt: ' + d.advancements[0].title : '']]
          .map(([l, val, s]) => `<div class="card metric"><div><div class="lbl">${l}</div><div class="v">${esc(val)}</div><div class="s">${esc(s)}</div></div></div>`).join('')}
      </div>
      <div class="grid g-3" style="margin-top:16px">
        <div class="card"><div class="card-h"><h2>Unterwegs</h2></div>${st.distance ? bars(st.distance) : '<div class="empty">–</div>'}</div>
        <div class="card"><div class="card-h"><h2>Abgebaut</h2><span class="sub">${fmtNum(st.minedTotal || 0)} Blöcke</span></div><div class="plist">${toplist(st.mined, true)}</div></div>
        <div class="card"><div class="card-h"><h2>Besiegt</h2><span class="sub">${fmtNum(st.killedTotal || 0)}</span></div><div class="plist">${toplist(st.killed)}</div>
          <dl class="kv" style="margin-top:12px"><dt>Schaden ausgeteilt</dt><dd>${num(st.damageDealt, 0)} ♥</dd><dt>Schaden erlitten</dt><dd>${num(st.damageTaken, 0)} ♥</dd><dt>Sprünge</dt><dd>${fmtNum(st.jumps || 0)}</dd><dt>Gehandelt</dt><dd>${fmtNum(st.traded || 0)}</dd></dl></div>
      </div>
      <div class="grid g-main" style="margin-top:16px">
        <div class="card"><div class="card-h"><h2>Notizen & Verwarnungen</h2><span class="sub">nur für Admins sichtbar</span></div>
          <form id="pn-form" autocomplete="off"><textarea class="input" name="text" rows="2" maxlength="1000" placeholder="Notiz oder Verwarnung …" style="height:auto;padding:10px 12px" required></textarea>
            <div class="row" style="margin-top:8px"><div class="seg" id="pn-kind"><button type="button" data-k="note" class="on">Notiz</button><button type="button" data-k="warn">⚠ Verwarnung</button></div>
              <label class="row" style="gap:8px;font-size:13px" id="pn-ig" hidden><span class="switch"><input type="checkbox" name="ingame" checked><span></span></span>dem Spieler im Spiel zeigen</label>
              <span class="grow"></span><button class="btn btn-primary btn-sm">Speichern</button></div></form>
          <div class="notes">${d.notes.length ? d.notes.slice().reverse().map((n) => `<div class="note ${n.kind}"><div class="row"><b>${n.kind === 'warn' ? '⚠ Verwarnung' : 'Notiz'}</b><span class="muted" style="font-size:12px">${esc(n.by)} · ${fmtDate(n.t)}</span><span class="grow"></span><button class="icon-btn danger" data-ndel="${esc(n.id)}" title="Löschen">${ico('trash')}</button></div><div>${esc(n.text)}</div></div>`).join('') : '<div class="empty">Keine Einträge</div>'}</div></div>
        <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
          <div class="card"><div class="card-h"><h2>Letzte Sitzungen</h2></div><div class="plist">${sessions.length ? sessions.slice(0, 8).map((s) => `<div class="prow"><div><div class="nm">${fmtDate(s[1])}</div><div class="meta">${s[2] == null ? 'läuft gerade' : 'bis ' + fmtTime(s[2])}</div></div><div class="right mono">${fmtDur((s[2] ?? Date.now() / 1000) - s[1])}</div></div>`).join('') : '<div class="empty">Keine Sitzungen in den Logs</div>'}</div></div>
          <div class="card"><div class="card-h"><h2>Erfolge</h2><span class="sub">${d.advancements.length}</span></div><div class="plist adv-list">${d.advancements.length ? d.advancements.slice(0, 12).map((a) => `<div class="prow"><span style="color:var(--gold)">${ico('trophy')}</span><div class="nm">${esc(a.title)}</div><div class="right muted" style="font-size:12px">${esc((a.date || '').slice(0, 10))}</div></div>`).join('') : '<div class="empty">Noch keine</div>'}</div></div>
        </div></div>`;
    skin3d($('#pl-skin', body), uuid, {});
    api('/api/players/inventory?uuid=' + encodeURIComponent(uuid)).then((inv) => { const el = $('#pl-skin', body); if (el) skin3d(el, uuid, inv.equipment || {}); }).catch(() => {});
    let kind = 'note';
    $('#pn-kind', body).onclick =(e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $$('#pn-kind button', body).forEach((x) => x.classList.toggle('on', x === b)); $('#pn-ig', body).hidden = kind !== 'warn' || !d.online; };
    $('#pn-form', body).onsubmit = async (e) => {
      e.preventDefault();
      if (await run(() => post('/api/player/notes', { uuid, action: 'add', kind, text: e.target.text.value, ingame: e.target.ingame.checked }), kind === 'warn' ? 'Verwarnung gespeichert' : 'Notiz gespeichert')) load();
    };
    body.onclick = async (e) => {
      const nd = e.target.closest('[data-ndel]');
      if (nd && await run(() => post('/api/player/notes', { uuid, action: 'delete', id: nd.dataset.ndel }), 'Gelöscht')) return load();
      const b = e.target.closest('[data-pd]');
      if (!b) return;
      const a = b.dataset.pd;
      if (a === 'inv') return openInventory(p);
      if (a === 'msg') { const r = await confirmBox({ title: `Nachricht an ${d.name}`, ok: 'Senden', input: true, inputLabel: 'Nachricht (erscheint als [Admin] im Chat)' }); if (r && r.value.trim()) run(() => post('/api/chat', { message: r.value, to: d.name }), 'Gesendet'); return; }
      if (await playerAction(a, d.name)) setTimeout(load, 500);
    };
  }
  load();
};

// ── Chat (Punkt 16) ──
VIEWS.chat = (v) => {
  v.innerHTML = `${head('Chat', 'Live-Chat des Servers. Du schreibst als <b>[Admin]</b> – an alle oder privat an einen Spieler.')}
    <div class="card chat-card"><div class="chat-list" id="ch-list"></div>
      <form class="chat-in" id="ch-form" autocomplete="off"><select class="input" name="to" id="ch-to" style="width:auto"></select>
        <input class="input" name="msg" placeholder="Nachricht schreiben …" maxlength="256"><button class="btn btn-primary">${ico('send')}<span class="hide-mobile">Senden</span></button></form></div>`;
  const list = $('#ch-list', v);
  const toSel = $('#ch-to', v);
  const fillTo = () => { const cur = toSel.value; toSel.innerHTML = '<option value="">An alle</option>' + (S.stats.online || []).map((n) => `<option value="${esc(n)}">nur ${esc(n)}</option>`).join(''); toSel.value = (S.stats.online || []).includes(cur) ? cur : ''; };
  const item = ([kind, line]) => {
    if (kind === 'adminchat') { const [u, to, ...m] = line.split('|'); return `<div class="msg me"><div class="bubble"><small>${esc(u)}${to ? ' → ' + esc(to) : ''} · Admin</small>${esc(m.join('|'))}</div></div>`; }
    if (kind !== 'log') return '';
    const mm = line.match(/^\[(\d\d:\d\d):\d\d\] \[[^\]]+\/INFO\]: (.*?)\s*$/);
    if (!mm) return '';
    const [, t, msg] = mm;
    let c = msg.match(/^(?:\[Not Secure\] )?<([A-Za-z0-9_]{1,16})> (.*)$/);
    if (c) return `<div class="msg">${headImg(c[1])}<div class="bubble"><small style="color:${playerColor(c[1])}">${esc(c[1])} · ${t}</small>${esc(c[2])}</div></div>`;
    c = msg.match(/^([A-Za-z0-9_]{1,16})(?: \(formerly known as [A-Za-z0-9_]{1,16}\))? (joined|left) the game$/);
    if (c) return `<div class="sysmsg">${t} · <b>${esc(c[1])}</b> ${c[2] === 'joined' ? 'ist beigetreten' : 'hat das Spiel verlassen'}</div>`;
    c = msg.match(/^([A-Za-z0-9_]{1,16}) has (?:made the advancement|completed the challenge|reached the goal) \[(.+)\]$/);
    if (c) return `<div class="sysmsg">${t} · <b>${esc(c[1])}</b> hat den Erfolg <b style="color:var(--gold)">${esc(c[2])}</b> erzielt</div>`;
    return '';
  };
  const render = () => {
    const html = S.logs.map(item).join('');
    list.innerHTML = html || `<div class="empty">${ico('chat')}Noch keine Chat-Nachrichten seit dem letzten Server-Start.</div>`;
    list.scrollTop = list.scrollHeight;
  };
  render(); fillTo();
  $('#ch-form', v).onsubmit = async (e) => {
    e.preventDefault();
    const inp = e.target.msg; if (!inp.value.trim()) return;
    if (await run(() => post('/api/chat', { message: inp.value, to: toSel.value }))) inp.value = '';
  };
  return sub((ev, data) => {
    if (ev === 'log') { const html = data.map(item).join(''); if (html) { const atB = list.scrollHeight - list.scrollTop - list.clientHeight < 60; const e0 = $('.empty', list); e0 && e0.remove(); list.insertAdjacentHTML('beforeend', html); if (atB) list.scrollTop = list.scrollHeight; } }
    if (ev === 'logs-reset') render();
    if (ev === 'stats') fillTo();
  });
};

// ── Datapacks & Ressourcenpaket (Punkt 21) ──
VIEWS.content = (v) => {
  v.innerHTML = `${head('Datapacks & Pakete', 'Datapacks erweitern die Welt (neue Rezepte, Funktionen, Strukturen). Das Ressourcenpaket ändert Texturen und Sounds bei den Spielern.')}
    <div class="grid g-main"><div class="card card-flush" id="dp-card"><div class="card-h"><h2>Datapacks</h2><span class="sub" id="dp-sub"></span>
      <div class="right"><button class="btn btn-primary btn-sm" id="dp-up">${ico('upload')}.zip hochladen</button><input type="file" id="dp-file" accept=".zip" multiple hidden></div></div><div id="dp-list"></div></div>
    <div class="card" id="rp-card"><div class="skeleton"></div></div></div>`;
  let data = null;
  async function load() {
    try { data = await api('/api/datapacks'); } catch (e) { $('#dp-list', v).innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const en = data.enabled ? new Set(data.enabled) : null;
    $('#dp-sub', v).textContent = data.enabled ? `${data.enabled.length} aktiv` : 'Server offline – Status unbekannt';
    $('#dp-list', v).innerHTML = data.files.length ? `<table class="table"><tbody>${data.files.map((f) => {
      const id = 'file/' + f.name, on = en ? en.has(id) : null;
      return `<tr><td><div class="fname">${ico(f.dir ? 'folder' : 'archive')}<b>${esc(f.name)}</b></div></td><td class="r mono muted hide-mobile">${f.size ? fmtBytes(f.size) : ''}</td>
        <td class="r">${on === null ? '' : `<label class="switch" title="${on ? 'Deaktivieren' : 'Aktivieren'}"><input type="checkbox" data-dp="${esc(id)}" ${on ? 'checked' : ''}><span></span></label>`}
        <button class="icon-btn danger" data-dpdel="${esc(f.name)}" title="Löschen">${ico('trash')}</button></td></tr>`;
    }).join('')}</tbody></table>` : `<div class="empty">${ico('archive')}Keine Datapacks. Lade eine .zip hoch – sie wird sofort aktiviert.</div>`;
    const rp = data.resourcePack;
    $('#rp-card', v).innerHTML = `<div class="card-h"><h2>Ressourcenpaket</h2></div>
      ${rp.url ? `<div class="notice info" style="margin-bottom:14px">${ico('check')}<div style="min-width:0"><b>Aktiv</b>${rp.required ? ' · Pflicht' : ' · optional'}<div class="mono" style="font-size:12px;overflow-wrap:anywhere">${esc(rp.url)}</div><div class="mono muted" style="font-size:11px">SHA-1 ${esc(rp.sha1)}</div></div></div>` : '<p class="muted" style="margin-top:0">Kein Ressourcenpaket eingestellt.</p>'}
      <form id="rp-form" autocomplete="off">
        <label class="field"><span>Download-Link (direkt zur .zip)</span><input class="input mono" name="url" placeholder="https://…/pack.zip" value="${esc(rp.url)}"></label>
        <label class="field"><span>Hinweistext für Spieler (optional)</span><input name="prompt" maxlength="200" value="${esc(rp.prompt)}"></label>
        <label class="row" style="margin-bottom:14px;gap:10px"><span class="switch"><input type="checkbox" name="required" ${rp.required ? 'checked' : ''}><span></span></span>Pflicht – ohne Paket kein Beitritt</label>
        <div class="row"><button class="btn btn-primary btn-sm">${ico('check')}Übernehmen</button><button type="button" class="btn btn-sm" id="rp-up">${ico('upload')}.zip hier hosten</button>
          ${rp.url ? '<button type="button" class="btn btn-sm btn-ghost" id="rp-clear">Entfernen</button>' : ''}<input type="file" id="rp-file" accept=".zip" hidden></div>
        <p class="muted" style="font-size:12px;margin:12px 0 0">Die Prüfsumme berechnet das Panel automatisch. „Hier hosten“ legt die Datei auf den Karten-Webserver (Port ${esc(data.mapPort)}) – damit Freunde von außen sie laden können, muss dieser Port im Router freigegeben sein. Änderungen wirken nach einem Neustart.</p></form>`;
    $('#rp-form', v).onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      if (await run(() => post('/api/resourcepack', { url: f.url.value, prompt: f.prompt.value, required: f.required.checked }), (r) => `Übernommen (${fmtBytes(r.size)}) – Neustart nötig`)) load();
    };
    $('#rp-up', v).onclick = () => $('#rp-file', v).click();
    $('#rp-file', v).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      toast(`Lade ${file.name} hoch …`);
      if (await run(() => api('/api/resourcepack/upload?name=' + encodeURIComponent(file.name), { method: 'PUT', raw: file }), 'Ressourcenpaket gehostet – Neustart nötig')) load();
    };
    const c = $('#rp-clear', v); if (c) c.onclick = async () => { if (await run(() => post('/api/resourcepack', { action: 'clear' }), 'Entfernt – Neustart nötig')) load(); };
  }
  $('#dp-up', v).onclick = () => $('#dp-file', v).click();
  $('#dp-file', v).onchange = async (e) => {
    await uploadFiles([...e.target.files], data ? data.dir : 'world/datapacks'); e.target.value = '';
    await rcon('reload', true); load();
  };
  v.addEventListener('change', async (e) => {
    const s = e.target.closest('[data-dp]');
    if (s && !await run(() => post('/api/datapacks', { action: s.checked ? 'enable' : 'disable', name: s.dataset.dp }), s.checked ? 'Aktiviert' : 'Deaktiviert')) s.checked = !s.checked;
  });
  v.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-dpdel]');
    if (d && await confirmBox({ title: 'Datapack löschen?', text: `<span class="mono">${esc(d.dataset.dpdel)}</span> wird deaktiviert und gelöscht.`, ok: 'Löschen', danger: true }) && await run(() => post('/api/datapacks', { action: 'delete', name: d.dataset.dpdel }), 'Gelöscht')) load();
  });
  load();
};

// ── Serverliste: MOTD-Editor & Icon (Punkt 20) ──
const MC_COLORS = { 0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA', 4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA', 8: '#555555', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };
function motdHtml(s) {
  let out = '', st = { c: '#AAAAAA', b: 0, i: 0, u: 0, m: 0 };
  const parts = String(s).split(/(§[0-9a-fk-or])/i);
  for (const p of parts) {
    const m = p.match(/^§([0-9a-fk-or])$/i);
    if (m) { const k = m[1].toLowerCase(); if (MC_COLORS[k]) st = { c: MC_COLORS[k], b: 0, i: 0, u: 0, m: 0 }; else if (k === 'l') st.b = 1; else if (k === 'o') st.i = 1; else if (k === 'n') st.u = 1; else if (k === 'm') st.m = 1; else if (k === 'r') st = { c: '#AAAAAA', b: 0, i: 0, u: 0, m: 0 }; continue; }
    if (!p) continue;
    out += `<span style="color:${st.c};${st.b ? 'font-weight:700;' : ''}${st.i ? 'font-style:italic;' : ''}${st.u || st.m ? `text-decoration:${st.u ? 'underline ' : ''}${st.m ? 'line-through' : ''};` : ''}">${esc(p).replace(/\n/g, '<br>')}</span>`;
  }
  return out;
}
// ── Server-Icon: Bild laden (alle Browser-Formate, Rest per Server-Umwandlung) und zuschneiden ──
const ICON_ACCEPT = 'image/*,.png,.jpg,.jpeg,.gif,.webp,.avif,.svg,.bmp,.ico,.heic,.heif,.tif,.tiff,.psd,.jxl';
const MAX_SRC = 4096;  // größere Bilder werden beim Laden verkleinert (Speicher)

function imgFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
// Liefert immer ein Canvas in Originalgröße (EXIF-Drehung berücksichtigt, max. 4096 px)
async function decodeImage(blob) {
  let src = null;
  if (window.createImageBitmap) { try { src = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* weiter */ } }
  if (!src) { try { src = await imgFromBlob(blob); } catch { /* weiter */ } }
  if (!src) {  // HEIC, TIFF, PSD, JPEG XL … → Server wandelt in PNG um
    let r;
    try { r = await fetch('/api/image/convert', { method: 'PUT', body: blob, credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF': S.csrf } }); } catch { throw new Error('Panel nicht erreichbar'); }
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* leer */ } throw new Error(j.error || 'Bild konnte nicht gelesen werden'); }
    src = await imgFromBlob(await r.blob());
  }
  let w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  if (!w || !h) { w = h = 512; }  // SVG ohne feste Größe
  const k = Math.min(1, MAX_SRC / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  if (src.close) src.close();
  return c;
}

// Einfaches Nachschärfen (Unsharp-Kernel) für das fertige 64er-Bild – Alpha bleibt unverändert
function sharpen(ctx, w, h, a = 0.22) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data, o = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const n = (dx, dy) => { const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy)); return d[(yy * w + xx) * 4 + ch]; };
        o[i + ch] = d[i + ch] * (1 + 4 * a) - a * (n(-1, 0) + n(1, 0) + n(0, -1) + n(0, 1));
      }
    }
  }
  ctx.putImageData(new ImageData(o, w, h), 0, 0);
}

function iconEditor(source, { motd = '', players = '20' } = {}) {
  const small = Math.max(source.width, source.height) <= 128;  // vermutlich Pixel-Art / vorhandenes Icon
  const st = { rot: 0, flip: false, pixel: small, sharp: !small, bg: 'transparent', color: '#1e1e1e', x: 0, y: 0, s: 1 };
  let R = null, pyramid = [];
  const STAGE = 340;  // CSS-Pixel
  const C = 240, OFF = (STAGE - C) / 2;  // Zuschnitt-Quadrat
  const html = `<h3>Server-Icon zuschneiden</h3><p style="margin-bottom:12px">Bild verschieben (ziehen, Pfeiltasten) und zoomen (Mausrad, Regler, zwei Finger). Ergebnis: 64 × 64 Pixel.</p>
    <div class="ie">
      <div class="ie-left">
        <canvas class="ie-stage" id="ie-stage" tabindex="0" aria-label="Bildausschnitt – mit Pfeiltasten verschieben, Plus/Minus zoomen"></canvas>
        <div class="ie-zoom">${ico('search')}<input type="range" id="ie-zoom" min="0" max="1000" value="0" aria-label="Zoom"><span class="mono muted" id="ie-zv"></span></div>
        <div class="ie-tools">
          <button type="button" class="btn btn-sm" data-ie="cover" title="Quadrat vollständig füllen">Füllen</button>
          <button type="button" class="btn btn-sm" data-ie="fit" title="Ganzes Bild sichtbar">Einpassen</button>
          <button type="button" class="btn btn-sm" data-ie="left" title="90° nach links drehen">${ico('rotl')}</button>
          <button type="button" class="btn btn-sm" data-ie="right" title="90° nach rechts drehen">${ico('rotr')}</button>
          <button type="button" class="btn btn-sm" data-ie="flip" title="Horizontal spiegeln">${ico('flip')}</button>
          <button type="button" class="btn btn-sm btn-ghost" data-ie="reset" title="Alles zurücksetzen">${ico('refresh')}</button>
        </div>
      </div>
      <div class="ie-right">
        <div class="field" style="margin:0 0 6px"><span>Vorschau in der Serverliste</span></div>
        <div class="sl-preview" style="max-width:none"><div class="sl-icon"><canvas id="ie-out" width="64" height="64"></canvas></div>
          <div style="min-width:0;flex:1"><div class="row" style="justify-content:space-between"><b style="color:#fff">Minecraft-Server</b><span style="color:#AAAAAA">0/${esc(players)}</span></div><div class="sl-motd">${motdHtml(motd) || '<span style="color:#AAAAAA">A Minecraft Server</span>'}</div></div></div>
        <div class="ie-zoomview"><canvas id="ie-big" width="64" height="64" aria-label="Vergrößerte Vorschau"></canvas><div class="muted" style="font-size:12px">Vergrößert – so sehen die einzelnen Pixel aus</div></div>
        <div class="field" style="margin:14px 0 6px"><span>Skalierung</span></div>
        <div class="seg" id="ie-mode"><button type="button" data-m="smooth">Weich (Fotos, Logos)</button><button type="button" data-m="pixel">Pixel-Art (scharf)</button></div>
        <label class="row" style="margin-top:10px;gap:10px;font-size:13.5px" id="ie-sharp-row"><span class="switch"><input type="checkbox" id="ie-sharp"><span></span></span>Nachschärfen (gegen Unschärfe beim Verkleinern)</label>
        <div class="field" style="margin:14px 0 6px"><span>Hintergrund (sichtbar bei „Einpassen“ und transparenten Bildern)</span></div>
        <div class="row" style="gap:8px"><div class="seg" id="ie-bg"><button type="button" data-b="transparent">Transparent</button><button type="button" data-b="color">Farbe</button></div><input type="color" id="ie-color" class="ie-color" value="${st.color}" aria-label="Hintergrundfarbe"></div>
      </div>
    </div>
    <div class="btns"><button type="button" class="btn" data-close="cancel">Abbrechen</button><button type="button" class="btn btn-primary" id="ie-save">${ico('check')}Als Server-Icon speichern</button></div>`;

  return modal(html, { wide: true, onOpen: (box, close) => {
    const stage = $('#ie-stage', box), sg = stage.getContext('2d');
    const out = $('#ie-out', box), og = out.getContext('2d');
    const big = $('#ie-big', box), bg2 = big.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    stage.width = stage.height = STAGE * dpr;
    const zoom = $('#ie-zoom', box);
    let checker = null;

    function buildRotated() {
      const sw = source.width, sh = source.height, turn = st.rot % 180 !== 0;
      R = document.createElement('canvas');
      R.width = turn ? sh : sw; R.height = turn ? sw : sh;
      const g = R.getContext('2d');
      g.translate(R.width / 2, R.height / 2);
      g.rotate((st.rot * Math.PI) / 180);
      if (st.flip) g.scale(-1, 1);
      g.drawImage(source, -sw / 2, -sh / 2);
      // Verkleinerungsstufen (je halbe Größe) für sauberes, schnelles Herunterrechnen
      pyramid = [R];
      let cur = R;
      while (cur.width > 96 && cur.height > 96) {
        const n = document.createElement('canvas');
        n.width = Math.max(1, Math.round(cur.width / 2)); n.height = Math.max(1, Math.round(cur.height / 2));
        const ng = n.getContext('2d'); ng.imageSmoothingQuality = 'high'; ng.drawImage(cur, 0, 0, n.width, n.height);
        pyramid.push(n); cur = n;
      }
    }
    const fitS = () => C / Math.max(R.width, R.height);
    const coverS = () => C / Math.min(R.width, R.height);
    const minS = () => fitS() * 0.5;
    const maxS = () => Math.max(coverS() * 6, C / 8);  // höchstens 8 Bildpixel über die ganze Breite
    function clamp() {
      const w = R.width * st.s, h = R.height * st.s;
      st.x = w >= C ? Math.min(0, Math.max(C - w, st.x)) : Math.max(0, Math.min(C - w, st.x));
      st.y = h >= C ? Math.min(0, Math.max(C - h, st.y)) : Math.max(0, Math.min(C - h, st.y));
    }
    function setScale(s, ax = C / 2, ay = C / 2) {
      s = Math.min(maxS(), Math.max(minS(), s));
      st.x = ax - (ax - st.x) * (s / st.s); st.y = ay - (ay - st.y) * (s / st.s); st.s = s;
      clamp(); syncZoom(); draw();
    }
    const center = () => { st.x = (C - R.width * st.s) / 2; st.y = (C - R.height * st.s) / 2; };
    function preset(kind) { st.s = kind === 'fit' ? fitS() : coverS(); center(); clamp(); syncZoom(); draw(); }
    function syncZoom() {
      const a = Math.log(minS()), b = Math.log(maxS());
      zoom.value = String(Math.round(((Math.log(st.s) - a) / (b - a)) * 1000));
      $('#ie-zv', box).textContent = `${Math.round((st.s / coverS()) * 100)} %`;
    }
    // Bild mit passender Verkleinerungsstufe zeichnen
    function blit(g, dx, dy, dw, dh, scale = 1) {
      if (st.pixel) { g.imageSmoothingEnabled = false; g.drawImage(R, dx, dy, dw, dh); return; }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      let lvl = R;
      for (const p of pyramid) if (p.width >= dw * scale * 1.5) lvl = p;  // kleinste Stufe, die noch groß genug ist
      g.drawImage(lvl, dx, dy, dw, dh);
    }
    function render64() {
      og.setTransform(1, 0, 0, 1, 0, 0);
      og.clearRect(0, 0, 64, 64);
      if (st.bg === 'color') { og.fillStyle = st.color; og.fillRect(0, 0, 64, 64); }
      const k = 64 / C;
      blit(og, st.x * k, st.y * k, R.width * st.s * k, R.height * st.s * k);
      if (st.sharp && !st.pixel) sharpen(og, 64, 64);
      bg2.imageSmoothingEnabled = false;
      bg2.clearRect(0, 0, 64, 64); bg2.drawImage(out, 0, 0);
    }
    function draw() {
      sg.setTransform(dpr, 0, 0, dpr, 0, 0);
      sg.clearRect(0, 0, STAGE, STAGE);
      if (!checker) {
        const t = document.createElement('canvas'); t.width = t.height = 16;
        const tg = t.getContext('2d'); tg.fillStyle = '#2a2f2d'; tg.fillRect(0, 0, 16, 16); tg.fillStyle = '#3a403d'; tg.fillRect(0, 0, 8, 8); tg.fillRect(8, 8, 8, 8);
        checker = sg.createPattern(t, 'repeat');
      }
      sg.fillStyle = checker; sg.fillRect(0, 0, STAGE, STAGE);
      if (st.bg === 'color') { sg.fillStyle = st.color; sg.fillRect(OFF, OFF, C, C); }
      blit(sg, OFF + st.x, OFF + st.y, R.width * st.s, R.height * st.s, dpr);
      // Außenbereich abdunkeln, Rahmen + Drittel-Linien
      sg.fillStyle = 'rgba(0,0,0,.6)';
      sg.beginPath(); sg.rect(0, 0, STAGE, STAGE); sg.rect(OFF, OFF, C, C); sg.fill('evenodd');
      sg.strokeStyle = 'rgba(255,255,255,.9)'; sg.lineWidth = 1.5; sg.strokeRect(OFF - 0.75, OFF - 0.75, C + 1.5, C + 1.5);
      sg.strokeStyle = 'rgba(255,255,255,.18)'; sg.lineWidth = 1;
      sg.beginPath();
      for (const f of [1 / 3, 2 / 3]) { sg.moveTo(OFF + C * f, OFF); sg.lineTo(OFF + C * f, OFF + C); sg.moveTo(OFF, OFF + C * f); sg.lineTo(OFF + C, OFF + C * f); }
      sg.stroke();
      render64();
    }
    function syncControls() {
      $$('#ie-mode button', box).forEach((b) => b.classList.toggle('on', (b.dataset.m === 'pixel') === st.pixel));
      $$('#ie-bg button', box).forEach((b) => b.classList.toggle('on', b.dataset.b === st.bg));
      $('#ie-color', box).hidden = st.bg !== 'color';
      $('#ie-sharp', box).checked = st.sharp;
      $('#ie-sharp-row', box).hidden = st.pixel;
    }
    function reset() { Object.assign(st, { rot: 0, flip: false }); buildRotated(); preset(small ? 'fit' : 'cover'); }

    // Ziehen und Pinch-Zoom (Pointer Events: Maus, Stift, Touch)
    const pts = new Map();
    let pinch = null;
    const local = (e) => { const r = stage.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * STAGE - OFF, y: ((e.clientY - r.top) / r.height) * STAGE - OFF }; };
    stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); stage.classList.add('grab'); });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e), prev = pts.get(e.pointerId);
      pts.set(e.pointerId, p);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinch) { st.x += mid.x - pinch.mid.x; st.y += mid.y - pinch.mid.y; setScale(st.s * (dist / pinch.dist), mid.x, mid.y); }
        pinch = { dist, mid };
        return;
      }
      st.x += p.x - prev.x; st.y += p.y - prev.y; clamp(); draw();
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = null; if (!pts.size) stage.classList.remove('grab'); };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const p = local(e); setScale(st.s * Math.exp(-e.deltaY * 0.0015), p.x, p.y); }, { passive: false });
    stage.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (mv) { e.preventDefault(); st.x += mv[0]; st.y += mv[1]; clamp(); draw(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); setScale(st.s * 1.1); }
      else if (e.key === '-') { e.preventDefault(); setScale(st.s / 1.1); }
    });
    zoom.oninput = () => { const a = Math.log(minS()), b = Math.log(maxS()); setScale(Math.exp(a + (b - a) * (zoom.value / 1000))); };
    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-ie]');
      if (t) {
        const a = t.dataset.ie;
        if (a === 'fit' || a === 'cover') preset(a);
        else if (a === 'reset') reset();
        else {
          if (a === 'left') st.rot = (st.rot + 270) % 360;
          if (a === 'right') st.rot = (st.rot + 90) % 360;
          if (a === 'flip') st.flip = !st.flip;
          const rel = st.s / coverS();
          buildRotated(); st.s = coverS() * rel; center(); clamp(); syncZoom(); draw();
        }
        return;
      }
      const m = e.target.closest('[data-m]');
      if (m) { st.pixel = m.dataset.m === 'pixel'; syncControls(); draw(); return; }
      const b = e.target.closest('[data-b]');
      if (b) { st.bg = b.dataset.b; syncControls(); draw(); }
    });
    $('#ie-sharp', box).onchange = (e) => { st.sharp = e.target.checked; draw(); };
    $('#ie-color', box).oninput = (e) => { st.color = e.target.value; draw(); };
    $('#ie-save', box).onclick = () => { render64(); out.toBlob((blob) => close(blob), 'image/png'); };

    buildRotated();
    syncControls();
    preset(small ? 'fit' : 'cover');
    setTimeout(() => stage.focus(), 40);
  } });
}

async function serverListCard(el) {
  let props;
  try { props = (await api('/api/properties')).props; } catch (e) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card" style="margin-bottom:18px"><div class="card-h"><h2>Serverliste</h2><span class="sub">So sehen Spieler deinen Server in Minecraft</span></div>
    <div class="sl-preview"><div class="sl-icon" id="sl-icon"></div>
      <div style="min-width:0;flex:1"><div class="row" style="justify-content:space-between"><b style="color:#fff">Minecraft-Server</b><span style="color:#AAAAAA">0/${esc(props['max-players'] || '20')} ${svg('activity').replace('<svg', '<svg width="14" height="14" style="color:#55FF55;vertical-align:-2px"')}</span></div><div class="sl-motd" id="sl-motd"></div></div></div>
    <div class="grid g-main" style="margin-top:16px;gap:20px">
      <div><div class="field"><span>Beschreibung (MOTD) – 2 Zeilen mit Enter, Farben über die Knöpfe</span><textarea class="input mono" id="sl-text" rows="2" maxlength="180" style="height:auto;padding:10px 12px;resize:none"></textarea></div>
        <div class="mc-colors" id="sl-colors">${Object.entries(MC_COLORS).map(([k, c]) => `<button type="button" data-code="§${k}" title="§${k}" style="background:${c}"></button>`).join('')}
          <button type="button" data-code="§l" title="Fett"><b>F</b></button><button type="button" data-code="§o" title="Kursiv"><i>K</i></button><button type="button" data-code="§n" title="Unterstrichen"><u>U</u></button><button type="button" data-code="§r" title="Zurücksetzen">⟲</button></div>
        <button class="btn btn-primary btn-sm" id="sl-save" style="margin-top:12px">${ico('save')}MOTD speichern</button></div>
      <div id="sl-iconbox" class="sl-drop"><div class="field"><span>Server-Icon – Bild wählen, hierher ziehen oder mit Strg+V einfügen</span></div>
        <div class="row"><button class="btn btn-sm btn-primary" id="sl-up">${ico('upload')}Bild wählen</button><button class="btn btn-sm" id="sl-edit" hidden>${ico('edit')}Bearbeiten</button>
          <button class="btn btn-sm btn-ghost" id="sl-prev" hidden title="Das vorherige Icon wiederherstellen">${ico('history')}Rückgängig</button><a class="btn btn-sm btn-ghost" id="sl-dl" href="/api/server-icon" download="server-icon.png" hidden>${ico('download')}Herunterladen</a><button class="btn btn-sm btn-ghost" id="sl-del" hidden>${ico('trash')}Entfernen</button>
          <input type="file" id="sl-file" accept="${ICON_ACCEPT}" hidden></div>
        <p class="muted" style="font-size:12px;margin:10px 0 0" id="sl-formats">PNG, JPG, GIF, WebP, AVIF, SVG, BMP, ICO</p>
        <p class="muted" style="font-size:12px;margin:4px 0 0">MOTD und Icon werden nach einem Server-Neustart angezeigt.</p></div></div></div>`;
  const ta = $('#sl-text', el);
  ta.value = (props.motd || '').replace(/\\n/g, '\n');
  const prev = () => { $('#sl-motd', el).innerHTML = motdHtml(ta.value) || '<span style="color:#AAAAAA">A Minecraft Server</span>'; };
  ta.oninput = () => { const l = ta.value.split('\n'); if (l.length > 2) ta.value = l.slice(0, 2).join('\n'); prev(); };
  prev();
  $('#sl-colors', el).onclick = (e) => { const b = e.target.closest('[data-code]'); if (!b) return; ta.setRangeText(b.dataset.code, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); prev(); };
  $('#sl-save', el).onclick = () => run(() => post('/api/properties', { changes: { motd: ta.value.replace(/\n/g, '\\n') } }), 'MOTD gespeichert – sichtbar nach Neustart');
  const reloadIcon = async () => {
    const box = $('#sl-icon', el), img = new Image();
    img.alt = ''; img.onerror = () => img.remove(); img.src = `/api/server-icon?${Date.now()}`;
    box.replaceChildren(img);
    let info = {};
    try { info = await api('/api/server-icon/info'); } catch { /* egal */ }
    $('#sl-edit', el).hidden = $('#sl-dl', el).hidden = $('#sl-del', el).hidden = !info.current;
    $('#sl-prev', el).hidden = !info.previous;
    $('#sl-formats', el).innerHTML = 'Unterstützt: PNG, JPG, GIF, WebP, AVIF, SVG, BMP, ICO' + (info.convert ? ', HEIC (iPhone), TIFF, PSD, JPEG XL'
      : ' – für HEIC (iPhone), TIFF, PSD und JPEG XL muss auf dem Server ImageMagick installiert sein');
  };
  reloadIcon();
  const openEditor = async (blob) => {
    if (!blob) return;
    if (blob.size > 40 * 1024 * 1024) { toast('Bild ist zu groß (max. 40 MB)', 'err'); return; }
    if (blob.type && !blob.type.startsWith('image/') && !/\.(heic|heif|avif|jxl|psd|tiff?|ico|bmp|svg)$/i.test(blob.name || '')) { toast('Das ist keine Bilddatei', 'err'); return; }
    toast('Bild wird geöffnet …');
    let src;
    try { src = await decodeImage(blob); } catch (e) { toast(e.message === 'decode' ? 'Bild konnte nicht gelesen werden' : e.message, 'err'); return; }
    const out = await iconEditor(src, { motd: ta.value, players: props['max-players'] || '20' });
    if (!(out instanceof Blob)) return;
    if (await run(() => api('/api/server-icon', { method: 'PUT', raw: out }), 'Icon gespeichert – sichtbar nach Neustart')) reloadIcon();
  };
  $('#sl-up', el).onclick = () => $('#sl-file', el).click();
  $('#sl-file', el).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; openEditor(f); };
  $('#sl-edit', el).onclick = async () => {
    try { const r = await fetch(`/api/server-icon?${Date.now()}`, { credentials: 'same-origin' }); if (!r.ok) throw new Error(); openEditor(await r.blob()); } catch { toast('Icon konnte nicht geladen werden', 'err'); }
  };
  dropZone($('#sl-iconbox', el), (files) => openEditor(files.find((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|jxl|psd|tiff?|ico|bmp|svg)$/i.test(f.name)) || files[0]));
  const onPaste = (e) => {
    if (!el.isConnected) { window.removeEventListener('paste', onPaste); return; }
    if (!$('#modal').hidden || (e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (item) { e.preventDefault(); openEditor(item.getAsFile()); }
  };
  window.addEventListener('paste', onPaste);
  $('#sl-prev', el).onclick = async () => { if (await run(() => post('/api/server-icon', { action: 'previous' }), 'Vorheriges Icon wiederhergestellt – sichtbar nach Neustart')) reloadIcon(); };
  $('#sl-del', el).onclick = async () => {
    if (!await confirmBox({ title: 'Server-Icon entfernen?', text: 'Spieler sehen dann wieder das Standard-Icon. Über „Rückgängig“ kommt es zurück.', ok: 'Entfernen', danger: true })) return;
    if (await run(() => post('/api/server-icon', { action: 'delete' }), 'Icon entfernt')) reloadIcon();
  };
}

// ── Empfohlene Mods (Punkt 22) ──
async function recommendedMods(pane) {
  pane.innerHTML = '<div class="mods">' + '<div class="card"><div class="skeleton" style="width:50%"></div><div class="skeleton" style="margin-top:12px"></div></div>'.repeat(3) + '</div>';
  let r;
  try { r = await api('/api/modrinth/recommended'); } catch (e) { pane.innerHTML = `<div class="card"><div class="empty">${esc(e.message)}</div></div>`; return; }
  const have = new Set(r.installed);
  const plug = r.kind === 'plugin';
  pane.innerHTML = `<div class="notice info">${ico('sparkle')}<div>Eine kleine Auswahl an ${plug ? 'Plugins' : 'Mods'}, die zu deinem ${esc(r.loaderName)}-Server passt. Alle laufen serverseitig; wo Spieler etwas installieren müssen, steht es dabei.</div></div><div class="mods">${r.mods.length ? '' : `<div class="card"><div class="empty">${ico('sparkle')}Für ${esc(r.loaderName)} gibt es hier keine Empfehlungen.</div></div>`}${r.mods.map((m) => `
    <div class="card mod"><div class="mod-top">${m.icon_url ? `<img class="mod-ico" src="${esc(m.icon_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(m.title[0])}">` : `<span class="mod-ico">${esc(m.title[0])}</span>`}
      <div style="min-width:0"><div class="nm">${esc(m.title)}</div><div class="ver">${fmtNum(m.downloads)} Downloads</div></div></div>
      <p style="-webkit-line-clamp:4">${esc(m.description)}</p>
      <div class="chips">${m.client_side === 'required' ? `<span class="chip chip-gold">${plug ? 'Spieler brauchen einen Client-Mod' : 'Spieler brauchen ihn auch'}</span>` : '<span class="chip chip-aqua">nur Server</span>'}${m.available ? '' : `<span class="chip chip-red">noch nicht für ${esc(r.mc)}</span>`}</div>
      <div class="mod-foot"><a class="btn btn-ghost btn-sm" href="https://modrinth.com/${plug ? 'plugin' : 'mod'}/${esc(m.slug)}" target="_blank" rel="noopener noreferrer">${ico('external')}Details</a><span class="grow"></span>
        ${have.has(m.project_id) ? `<span class="chip chip-green">${ico('check')} installiert</span>` : `<button class="btn btn-primary btn-sm" data-inst="${esc(m.project_id)}" data-title="${esc(m.title)}" data-client="${m.client_side === 'required' ? 1 : ''}" ${m.available ? '' : 'disabled'}>${ico('download')}Installieren</button>`}</div></div>`).join('')}</div>`;
}

// ── Wartungsmodus (Punkt 17) ──
S.maint = null;
async function loadMaint() {
  try { S.maint = (await api('/api/maintenance')).maintenance; } catch { return; }
  const c = $('#maint-chip');
  if (!c) return;
  c.hidden = !S.maint;
  if (S.maint) c.innerHTML = `${ico('lock')}Wartung${S.maint.until ? ' bis ' + fmtTime(S.maint.until) : ''}`;
}
async function toggleMaintenance() {
  await loadMaint();
  if (S.maint) {
    if (await confirmBox({ title: 'Wartung beenden?', text: 'Danach können wieder alle Spieler (Whitelist) beitreten.', ok: 'Wartung beenden' })) { await run(() => post('/api/maintenance', { on: false }), 'Wartung beendet'); loadMaint(); }
    return;
  }
  const r = await modal(`<form autocomplete="off"><h3>Wartungsmodus starten</h3><p>Alle Spieler außer Operatoren werden getrennt, und neue Verbindungen werden sofort wieder gekickt – mit deiner Begründung.</p>
    <label class="field"><span>Grund (sehen die Spieler)</span><input name="reason" maxlength="120" placeholder="z. B. Update auf 26.3"></label>
    <div class="field"><span>Automatisch beenden nach</span><div class="seg" id="mt-dur" style="flex-wrap:wrap">${[[0, 'manuell'], [15, '15 Min'], [30, '30 Min'], [60, '1 Std'], [120, '2 Std'], [360, '6 Std']].map(([m, l], i) => `<button type="button" data-m="${m}" class="${i === 3 ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="btns"><button type="button" class="btn btn-ghost" data-close="x">Abbrechen</button><button class="btn btn-danger">${ico('lock')}Wartung starten</button></div></form>`, {
    onOpen(box, close) {
      $('#mt-dur', box).onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) $$('#mt-dur button', box).forEach((x) => x.classList.toggle('on', x === b)); };
      $('form', box).onsubmit = (e) => { e.preventDefault(); close({ reason: e.target.reason.value, minutes: +$('#mt-dur .on', box).dataset.m }); };
    },
  });
  if (!r) return;
  await run(() => post('/api/maintenance', { on: true, ...r }), (x) => `Wartung aktiv${x.kicked && x.kicked.length ? ' – ' + x.kicked.length + ' Spieler getrennt' : ''}`);
  loadMaint();
}

// ───────────────────────── Befehlspalette ─────────────────────────
const ACTIONS = [
  { label: 'Server starten', icon: 'play', run: () => power('start'), when: () => srvState(S.stats)[0] === 'offline' },
  { label: 'Server neu starten', icon: 'restart', run: () => power('restart'), when: () => S.stats.state === 'active' },
  { label: 'Server stoppen', icon: 'stop', run: () => power('stop'), when: () => S.stats.state === 'active' },
  { label: 'Wartungsmodus an/aus', icon: 'lock', run: () => toggleMaintenance() },
  { label: 'Chat öffnen', icon: 'chat', run: () => { location.hash = '#/chat'; } },
  { label: 'Backup erstellen', icon: 'archive', run: () => run(() => post('/api/backups', { action: 'create' }), 'Backup gestartet') },
  { label: 'Welt speichern', icon: 'save', run: () => worldAction('save') },
  { label: 'Tag machen', icon: 'sun', run: () => worldAction('day') },
  { label: 'Nacht machen', icon: 'moon', run: () => worldAction('night') },
  { label: 'Wetter: klar', icon: 'sun', run: () => worldAction('clear') },
  { label: 'Nachricht an alle …', icon: 'megaphone', run: async () => { const r = await confirmBox({ title: 'Nachricht an alle', ok: 'Senden', input: true, inputLabel: 'Nachricht' }); if (r && r.value.trim()) worldAction('say', { message: r.value }); } },
  { label: 'Spieler zur Whitelist …', icon: 'userplus', run: async () => { const r = await confirmBox({ title: 'Zur Whitelist', ok: 'Hinzufügen', input: true, inputLabel: 'Spielername' }); if (r && r.value.trim()) playerAction('whitelist-add', r.value.trim()); } },
  { label: 'Farbschema wechseln', icon: 'contrast', run: () => { const t = { auto: 'dark', dark: 'light', light: 'nether', nether: 'end', end: 'auto' }[store.get('theme', 'auto')] || 'auto'; store.set('theme', t); applyTheme(t); toast('Farbschema: ' + { auto: 'Automatisch', dark: 'Dunkel', light: 'Hell', nether: 'Nether', end: 'End' }[t]); } },
  { label: 'Abmelden', icon: 'logout', run: () => $('#logout').click() },
];
let palItems = [], palSel = 0;
function openPalette() {
  if (!S.me) return;
  $('#palette').hidden = false;
  const inp = $('#palette-input'); inp.value = ''; renderPalette(); inp.focus();
}
function closePalette() { $('#palette').hidden = true; }
function fuzzy(q, s) {
  s = s.toLowerCase(); if (s.includes(q)) return 2;
  let i = 0; for (const c of s) if (c === q[i]) i++;
  return i === q.length ? 1 : 0;
}
function renderPalette() {
  const q = $('#palette-input').value.trim().toLowerCase();
  const items = [];
  if (q.startsWith('/') && q.length > 1) {
    const cmd = $('#palette-input').value.trim().slice(1);
    items.push({ grp: 'Konsole', label: `/${cmd}`, icon: 'terminal', hint: 'ausführen', run: () => rcon(cmd) });
  }
  const pages = PAGES.map((p) => ({ grp: 'Seiten', label: p.label, icon: p.icon, hint: 'öffnen', run: () => { location.hash = '#/' + p.id; } }));
  const acts = ACTIONS.filter((a) => !a.when || a.when()).map((a) => ({ grp: 'Aktionen', ...a }));
  const players = (S.stats.online || []).map((n) => ({ grp: 'Online-Spieler', label: n, icon: 'users', hint: 'Spieler-Seite', run: () => { store.set('ptab', 'online'); location.hash = '#/players'; } }));
  for (const it of [...acts, ...pages, ...players]) { const sc = q ? fuzzy(q, it.label) : 1; if (sc) items.push({ ...it, sc }); }
  if (q) items.sort((a, b) => (b.sc || 3) - (a.sc || 3));
  if (!q.startsWith('/') && !items.length) items.push({ grp: 'Tipp', label: 'Mit / am Anfang führst du Server-Befehle aus', icon: 'info', run: () => {} });
  palItems = items.slice(0, 14); palSel = 0;
  let grp = '';
  $('#palette-list').innerHTML = palItems.map((it, i) => {
    const g = !q && it.grp !== grp ? `<li class="grp">${esc((grp = it.grp))}</li>` : '';
    return `${g}<li data-i="${i}" class="${i === 0 ? 'on' : ''}" role="option">${ico(it.icon)}<span>${esc(it.label)}</span>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</li>`;
  }).join('');
}
$('#palette-input').addEventListener('input', renderPalette);
$('#palette-input').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); palSel = (palSel + (e.key === 'ArrowDown' ? 1 : palItems.length - 1)) % palItems.length;
    $$('#palette-list li[data-i]').forEach((li) => li.classList.toggle('on', +li.dataset.i === palSel));
    const on = $('#palette-list li.on'); on && on.scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palSel]; closePalette(); it && it.run(); }
  if (e.key === 'Escape') closePalette();
});
$('#palette-list').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) { const it = palItems[+li.dataset.i]; closePalette(); it.run(); } });
$('#palette').addEventListener('click', (e) => { if (e.target.id === 'palette') closePalette(); });
$('#open-palette').onclick = openPalette;
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); }
  else if (e.key === '/' && !e.target.closest('input, textarea, select') && $('#modal').hidden && S.me) { e.preventDefault(); openPalette(); $('#palette-input').value = '/'; renderPalette(); }
});

// ───────────────────────── Los geht's ─────────────────────────
// ═════════════════════════ Einrichtung & Server erstellen ═════════════════════════
const LOGO = '<svg class="cube" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 12 86 32 50 52 14 32z" fill="#7fe0a8"/><path d="M14 32 50 52v40L14 72z" fill="#3bb273"/><path d="M86 32 50 52v40l36-20z" fill="#1f7a4d"/><path d="M26 78.7 38 85.3V63.3L26 56.7z" fill="#ffd27a"/><path d="M60 64.4 74 56.7V44.7L60 52.4z" fill="#ffd27a"/></svg>';

// Erster Start: Willkommen + Admin-Konto (öffentlich, nur solange es keinen Admin gibt)
function showSetup(st) {
  if (S.es) { S.es.close(); S.es = null; }
  $('#app').hidden = true; $('#login').hidden = true;
  const box = $('#setup');
  box.hidden = false;
  hideSplash();
  box.innerHTML = `<form class="login-card setup-card" id="setup-form" autocomplete="off">
    <div class="brand brand-lg">${LOGO}<div><b>Blockhaus</b><small>Version ${esc(st.version)} · ${esc(st.os)}</small></div></div>
    <h2 class="setup-h">Willkommen!</h2>
    <p class="setup-p">In wenigen Schritten läuft dein eigener Minecraft-Server. Lege zuerst dein Admin-Konto an – damit meldest du dich später bei Blockhaus an.</p>
    <label class="field"><span>Sprache</span><select class="input" name="language" id="setup-lang" translate="no">${LANGS.map(([k, n]) => `<option value="${k}" ${k === I18N.lang ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    ${st.needsCode ? `<label class="field"><span>Einrichtungs-Code</span><input class="input mono" name="code" inputmode="numeric" maxlength="6" required placeholder="6 Ziffern" autocomplete="one-time-code">
      <small class="field-hint">Du rufst Blockhaus über das Netzwerk auf. Den Code zeigt Blockhaus im Terminal bzw. im Log an.</small></label>` : ''}
    <label class="field"><span>Benutzername</span><input class="input" name="user" required minlength="2" maxlength="32" autocomplete="username" spellcheck="false" autocapitalize="off"></label>
    <label class="field"><span>Passwort (mind. 8 Zeichen)</span><input class="input" name="password" type="password" required minlength="8" autocomplete="new-password"></label>
    <label class="field"><span>Passwort wiederholen</span><input class="input" name="password2" type="password" required minlength="8" autocomplete="new-password"></label>
    <p class="login-err" id="setup-err" role="alert"></p>
    <button class="btn btn-primary btn-block" type="submit">Weiter</button>
    <p class="login-foot">Blockhaus ist kein offizielles Minecraft-Produkt und nicht mit Mojang oder Microsoft verbunden.</p>
  </form>`;
  const f = $('#setup-form', box);
  $('#setup-lang', f).onchange = (e) => setLanguage(e.target.value);
  setTimeout(() => $('[name=code], [name=user]', f).focus(), 50);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#setup-err', f), btn = $('button[type=submit]', f);
    err.textContent = '';
    if (f.password.value !== f.password2.value) { err.textContent = 'Die Passwörter stimmen nicht überein'; return; }
    btn.disabled = true;
    try {
      await api('/api/setup/admin', { method: 'POST', body: { user: f.user.value.trim(), password: f.password.value, language: f.language.value, code: f.code ? f.code.value : '' } });
      box.hidden = true; box.innerHTML = '';
      location.hash = '#/create';
      await boot();
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  };
}

// Server erstellen (oder vorhandenen übernehmen) – mehrstufiger Assistent
VIEWS.create = (v) => {
  const STEPS = ['Software', 'Version', 'Welt & Spiel', 'Ressourcen', 'Automatik', 'Fertigstellen'];
  const d = {
    mode: 'new', loader: 'paper', mc: '', loaderVersion: '', motd: 'Mein Blockhaus-Server', gamemode: 'survival', difficulty: 'normal', seed: '',
    maxPlayers: 10, pvp: true, whitelist: false, onlineMode: true, port: 25565, serverDir: '', importDir: '', ram: 0, storageOn: false, storageGb: 20,
    autostart: true, autoRestart: true, backupHours: 24, eula: false, start: true,
  };
  let step = 0, info = null, games = [], builds = { builds: [], recommended: null, label: null }, busy = false, done = false;
  v.innerHTML = `${head('Server erstellen', 'Neuen Minecraft-Server einrichten oder einen vorhandenen übernehmen.')}
    <div class="card wiz"><ol class="wiz-steps" id="w-steps" aria-label="Schritte"></ol><div id="w-body" class="wiz-body"><div class="skeleton"></div></div>
    <div class="wiz-foot"><button class="btn" id="w-back" type="button">Zurück</button><span class="grow"></span><span class="muted" id="w-msg" role="status"></span><button class="btn btn-primary" id="w-next" type="button">Weiter</button></div></div>`;
  const body = $('#w-body', v), msg = $('#w-msg', v);
  const gb = (b) => num(b / 1024 ** 3, 1) + ' GB';
  const mb2gb = (m) => num(m / 1024, m % 1024 ? 1 : 0) + ' GB';
  const L = (id) => (info ? info.loaders.find((l) => l.id === id) : null) || {};

  async function loadVersions() {
    games = []; builds = { builds: [], recommended: null, label: null };
    try { games = (await api(`/api/update/versions?loader=${encodeURIComponent(d.loader)}`)).games; } catch (e) { msg.textContent = e.message; }
    if (!games.includes(d.mc)) d.mc = games[0] || '';
    await loadBuilds();
  }
  async function loadBuilds() {
    builds = { builds: [], recommended: null, label: L(d.loader).verLabel };
    if (L(d.loader).verLabel && d.mc) {
      try { builds = await api(`/api/update/builds?loader=${encodeURIComponent(d.loader)}&mc=${encodeURIComponent(d.mc)}`); } catch (e) { msg.textContent = e.message; }
    }
    d.loaderVersion = builds.builds.includes(d.loaderVersion) ? d.loaderVersion : (builds.recommended || builds.builds[0] || '');
  }

  function stepper() {
    $('#w-steps', v).innerHTML = (d.mode === 'import' ? ['Software', 'Ordner', 'Ressourcen', 'Automatik', 'Fertigstellen'] : STEPS)
      .map((s, i) => `<li class="${i === step ? 'on' : i < step ? 'done' : ''}" ${i === step ? 'aria-current="step"' : ''}><span>${i < step ? svg('check') : i + 1}</span>${esc(s)}</li>`).join('');
  }
  const order = () => (d.mode === 'import' ? ['software', 'import', 'resources', 'auto', 'finish'] : ['software', 'version', 'world', 'resources', 'auto', 'finish']);

  function render() {
    stepper();
    msg.textContent = '';
    const k = order()[step];
    $('#w-back', v).hidden = step === 0 || done;
    $('#w-next', v).hidden = done;
    $('#w-next', v).innerHTML = k === 'finish' ? `${ico('rocket')}${d.mode === 'import' ? 'Übernehmen' : 'Server erstellen'}` : 'Weiter';
    if (k === 'software') {
      const KIND = { mod: ['Mods', 'chip-aqua'], plugin: ['Plugins', 'chip-gold'] };
      body.innerHTML = `<h2 class="wiz-h">Welche Server-Software?</h2>
        <p class="wiz-p">Das lässt sich später unter „Updates &amp; Software“ jederzeit ändern. Unsicher? <b>Paper</b> ist schnell, stabil und Spieler brauchen nichts zu installieren.</p>
        <div class="sw-grid">${info.loaders.map((l) => `<button type="button" class="sw-tile ${d.mode === 'new' && l.id === d.loader ? 'on' : ''}" data-sw="${l.id}" aria-pressed="${d.mode === 'new' && l.id === d.loader}">
          <span class="sw-h"><b>${esc(l.name)}</b>${l.id === 'paper' ? '<span class="chip chip-green">empfohlen</span>' : l.kind ? `<span class="chip ${KIND[l.kind][1]}">${KIND[l.kind][0]}</span>` : '<span class="chip">ohne Mods</span>'}</span>
          <p>${esc(l.desc)}</p></button>`).join('')}
          <button type="button" class="sw-tile ${d.mode === 'import' ? 'on' : ''}" data-sw="import" aria-pressed="${d.mode === 'import'}"><span class="sw-h"><b>Vorhandenen Server übernehmen</b></span><p>Du hast schon einen Server-Ordner (z. B. von einem anderen Tool)? Blockhaus übernimmt ihn samt Welt.</p></button></div>`;
    } else if (k === 'version') {
      const lv = L(d.loader).verLabel;
      body.innerHTML = `<h2 class="wiz-h">Welche Version?</h2>
        <p class="wiz-p">Spieler brauchen dieselbe Minecraft-Version. Meist ist die neueste die richtige.</p>
        <div class="row"><label class="field grow"><span>Minecraft</span><select class="input" id="w-mc">${games.map((g) => `<option ${g === d.mc ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
        ${lv ? `<label class="field grow"><span>${esc(lv)}</span><select class="input" id="w-lv">${builds.builds.map((b) => `<option value="${esc(b)}" ${b === d.loaderVersion ? 'selected' : ''}>${esc(b)}${b === builds.recommended ? ' (empfohlen)' : ''}</option>`).join('') || '<option value="">keine passende Version</option>'}</select></label>` : ''}</div>
        <p class="muted" style="font-size:13px;margin:4px 0 0">Java für diese Version lädt Blockhaus automatisch herunter.</p>`;
      $('#w-mc', body).onchange = async (e) => { d.mc = e.target.value; await loadBuilds(); render(); };
      const s = $('#w-lv', body); if (s) s.onchange = (e) => { d.loaderVersion = e.target.value; };
    } else if (k === 'world') {
      body.innerHTML = `<h2 class="wiz-h">Welt &amp; Spiel</h2>
        <div class="wiz-grid">
          <label class="field span-2"><span>Name in der Serverliste (MOTD)</span><input class="input" id="w-motd" maxlength="59" value="${esc(d.motd)}"></label>
          <label class="field"><span>Spielmodus</span><select class="input" id="w-gm">${[['survival', 'Überleben'], ['creative', 'Kreativ'], ['adventure', 'Abenteuer']].map(([a, b]) => `<option value="${a}" ${a === d.gamemode ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <label class="field"><span>Schwierigkeit</span><select class="input" id="w-df">${[['peaceful', 'Friedlich'], ['easy', 'Einfach'], ['normal', 'Normal'], ['hard', 'Schwer']].map(([a, b]) => `<option value="${a}" ${a === d.difficulty ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <label class="field"><span>Max. Spieler</span><input class="input mono" id="w-mp" type="number" min="1" max="1000" value="${d.maxPlayers}"></label>
          <label class="field"><span>Seed (optional)</span><input class="input mono" id="w-seed" maxlength="64" value="${esc(d.seed)}" placeholder="zufällig"></label>
        </div>
        <div class="wiz-toggles">
          <label class="row"><span class="switch"><input type="checkbox" id="w-pvp" ${d.pvp ? 'checked' : ''}><span></span></span>Spieler können sich gegenseitig angreifen (PvP)</label>
          <label class="row"><span class="switch"><input type="checkbox" id="w-wl" ${d.whitelist ? 'checked' : ''}><span></span></span>Nur eingeladene Spieler (Whitelist) – du trägst sie später unter „Spieler“ ein</label>
          <label class="row"><span class="switch"><input type="checkbox" id="w-om" ${d.onlineMode ? 'checked' : ''}><span></span></span>Nur echte Minecraft-Konten (Online-Modus, empfohlen)</label>
        </div>`;
      const sync = () => {
        d.motd = $('#w-motd', body).value; d.gamemode = $('#w-gm', body).value; d.difficulty = $('#w-df', body).value;
        d.maxPlayers = parseInt($('#w-mp', body).value, 10) || 10; d.seed = $('#w-seed', body).value;
        d.pvp = $('#w-pvp', body).checked; d.whitelist = $('#w-wl', body).checked; d.onlineMode = $('#w-om', body).checked;
      };
      body.oninput = sync; body.onchange = sync;
    } else if (k === 'import') {
      body.innerHTML = `<h2 class="wiz-h">Vorhandenen Server übernehmen</h2>
        <p class="wiz-p">Gib den Ordner an, in dem <span class="mono">server.properties</span> und die Welt liegen. Blockhaus erkennt die Software (Vanilla, Fabric, Forge, NeoForge, Paper, Purpur) selbst und richtet RCON ein. Bitte den Server vorher beenden.</p>
        <label class="field"><span>Server-Ordner</span><input class="input mono" id="w-imp" value="${esc(d.importDir)}" placeholder="${info.system.os === 'Windows' ? 'C:\\Users\\Name\\minecraft-server' : '/home/name/minecraft-server'}" spellcheck="false"></label>`;
      $('#w-imp', body).oninput = (e) => { d.importDir = e.target.value.trim(); };
    } else if (k === 'resources') {
      const sys = info.system, max = Math.max(1024, Math.floor(sys.ramTotalMb / 512) * 512);
      if (!d.ram) d.ram = sys.ramRecommendMb;
      const ramNote = () => (d.ram > sys.ramTotalMb - 1536 ? `<span class="warn-t">${ico('alert')}Für das System bleibt sehr wenig übrig – das kann den Rechner ausbremsen.</span>`
        : d.ram < 2048 ? `<span class="warn-t">${ico('alert')}Unter 2 GB wird es mit mehreren Spielern oder Mods eng.</span>` : `<span class="muted">${ico('check')}Passt gut.</span>`);
      body.innerHTML = `<h2 class="wiz-h">Ressourcen</h2>
        <p class="wiz-p">Dein Rechner: ${esc(sys.os)}, ${sys.cpus} Kerne, ${mb2gb(sys.ramTotalMb)} RAM, ${gb(sys.diskFree)} frei.</p>
        <div class="field"><span>Arbeitsspeicher für Minecraft (maximal)</span>
          <div class="ram-row"><input type="range" id="w-ram" min="1024" max="${max}" step="512" value="${d.ram}" aria-label="Arbeitsspeicher in MB"><b class="mono" id="w-ramv">${mb2gb(d.ram)}</b></div>
          <div class="ram-scale"><span>1 GB</span><span>Empfohlen: ${mb2gb(sys.ramRecommendMb)}</span><span>${mb2gb(max)}</span></div>
          <div id="w-ramn" class="ram-note">${ramNote()}</div></div>
        <label class="row" style="margin-top:14px"><span class="switch"><input type="checkbox" id="w-st" ${d.storageOn ? 'checked' : ''}><span></span></span>Speicherplatz begrenzen (Welt + Backups)</label>
        <div class="row" id="w-st-row" style="margin-top:8px" ${d.storageOn ? '' : 'hidden'}><input class="input mono" id="w-stv" type="number" min="1" max="100000" step="1" value="${d.storageGb}" style="width:120px"><span>GB</span><span class="muted" style="font-size:13px">Bei 90 % warnt Blockhaus, alte automatische Backups werden gelöscht; ist das Limit erreicht, entstehen keine neuen Backups.</span></div>
        ${d.mode === 'new' ? `<div class="wiz-grid" style="margin-top:16px">
          <label class="field span-2"><span>Speicherort des Servers</span><input class="input mono" id="w-dir" value="${esc(d.serverDir || info.defaultDir)}" spellcheck="false"></label>
          <label class="field"><span>Port</span><input class="input mono" id="w-port" type="number" min="1024" max="65535" value="${d.port}"></label></div>` : ''}`;
      $('#w-ram', body).oninput = (e) => { d.ram = +e.target.value; $('#w-ramv', body).textContent = mb2gb(d.ram); $('#w-ramn', body).innerHTML = ramNote(); };
      $('#w-st', body).onchange = (e) => { d.storageOn = e.target.checked; $('#w-st-row', body).hidden = !d.storageOn; };
      $('#w-stv', body).oninput = (e) => { d.storageGb = +e.target.value; };
      const dir = $('#w-dir', body); if (dir) dir.oninput = (e) => { d.serverDir = e.target.value.trim(); };
      const port = $('#w-port', body); if (port) port.oninput = (e) => { d.port = parseInt(e.target.value, 10) || 25565; };
    } else if (k === 'auto') {
      body.innerHTML = `<h2 class="wiz-h">Automatik</h2>
        <div class="wiz-toggles">
          <label class="row"><span class="switch"><input type="checkbox" id="w-as" ${d.autostart ? 'checked' : ''}><span></span></span><span>Minecraft-Server automatisch starten, wenn Blockhaus startet<br><small class="muted">Ob Blockhaus selbst beim Hochfahren des Rechners startet, stellst du bei der Installation ein.</small></span></label>
          <label class="row"><span class="switch"><input type="checkbox" id="w-ar" ${d.autoRestart ? 'checked' : ''}><span></span></span>Nach einem Absturz automatisch neu starten</label>
        </div>
        <label class="field" style="max-width:320px;margin-top:16px"><span>Automatische Backups der Welt</span><select class="input" id="w-bk">${[[0, 'aus'], [6, 'alle 6 Stunden'], [12, 'alle 12 Stunden'], [24, 'täglich'], [168, 'wöchentlich']].map(([a, b]) => `<option value="${a}" ${a === d.backupHours ? 'selected' : ''}>${b}</option>`).join('')}</select></label>`;
      $('#w-as', body).onchange = (e) => { d.autostart = e.target.checked; };
      $('#w-ar', body).onchange = (e) => { d.autoRestart = e.target.checked; };
      $('#w-bk', body).onchange = (e) => { d.backupHours = +e.target.value; };
    } else if (k === 'finish') {
      const l = L(d.loader);
      const rows = d.mode === 'import' ? [['Ordner', d.importDir]] : [['Software', `${l.name} ${d.mc}${d.loaderVersion ? ' · ' + d.loaderVersion : ''}`], ['Name', d.motd],
        ['Spiel', `${{ survival: 'Überleben', creative: 'Kreativ', adventure: 'Abenteuer' }[d.gamemode]}, ${{ peaceful: 'Friedlich', easy: 'Einfach', normal: 'Normal', hard: 'Schwer' }[d.difficulty]}, max. ${d.maxPlayers} Spieler`],
        ['Ordner', d.serverDir || info.defaultDir], ['Port', d.port]];
      rows.push(['Arbeitsspeicher', mb2gb(d.ram)], ['Speicherlimit', d.storageOn ? `${d.storageGb} GB` : 'keins'], ['Autostart', d.autostart ? 'an' : 'aus'], ['Backups', d.backupHours ? `alle ${d.backupHours} h` : 'aus']);
      body.innerHTML = `<h2 class="wiz-h">Alles bereit</h2>
        <dl class="kv wiz-sum">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
        <label class="row eula"><input type="checkbox" id="w-eula" ${d.eula ? 'checked' : ''}><span>Ich stimme der <a href="https://aka.ms/MinecraftEULA" target="_blank" rel="noopener noreferrer">Minecraft-Endbenutzer-Lizenzvereinbarung (EULA)</a> zu. Ohne Zustimmung startet kein Minecraft-Server.</span></label>
        ${d.mode === 'new' ? `<label class="row" style="margin-top:10px"><input type="checkbox" id="w-start" ${d.start ? 'checked' : ''}><span>Server direkt nach der Installation starten</span></label>` : ''}`;
      $('#w-eula', body).onchange = (e) => { d.eula = e.target.checked; };
      const s = $('#w-start', body); if (s) s.onchange = (e) => { d.start = e.target.checked; };
    }
    hydrateIcons(body);
  }

  body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-sw]');
    if (!t) return;
    if (t.dataset.sw === 'import') { d.mode = 'import'; }
    else { d.mode = 'new'; if (d.loader !== t.dataset.sw) { d.loader = t.dataset.sw; d.mc = ''; d.loaderVersion = ''; } }
    render();
  });

  async function next() {
    const k = order()[step];
    msg.textContent = '';
    if (k === 'software' && d.mode === 'new') { busy = true; msg.textContent = 'Lade Versionen …'; await loadVersions(); busy = false; if (!games.length) { msg.textContent = 'Keine Versionen gefunden – Internetverbindung prüfen'; return; } }
    if (k === 'version' && L(d.loader).verLabel && !d.loaderVersion) { msg.textContent = `Für Minecraft ${d.mc} gibt es keine ${L(d.loader).name}-Version`; return; }
    if (k === 'world' && !d.motd.trim()) { msg.textContent = 'Bitte einen Namen angeben'; return; }
    if (k === 'import' && !d.importDir) { msg.textContent = 'Bitte den Ordner angeben'; return; }
    if (k === 'resources' && d.storageOn && !(d.storageGb >= 1)) { msg.textContent = 'Speicherlimit: mindestens 1 GB'; return; }
    if (k === 'finish') return submit();
    step++; render();
  }
  async function submit() {
    if (!d.eula) { msg.textContent = 'Bitte der EULA zustimmen'; return; }
    const settings = { ram_max_mb: d.ram, storage_max_gb: d.storageOn ? d.storageGb : null, autostart: d.autostart, auto_restart: d.autoRestart, auto_backup_hours: d.backupHours };
    const payload = d.mode === 'import' ? { mode: 'import', serverDir: d.importDir, eula: true, settings }
      : { mode: 'new', loader: d.loader, mc: d.mc, loaderVersion: d.loaderVersion, motd: d.motd, gamemode: d.gamemode, difficulty: d.difficulty, seed: d.seed, maxPlayers: d.maxPlayers,
        pvp: d.pvp, whitelist: d.whitelist, onlineMode: d.onlineMode, port: d.port, serverDir: d.serverDir || info.defaultDir, eula: true, start: d.start, settings };
    $('#w-next', v).disabled = true;
    try { await post('/api/server/create', payload); } catch (e) { msg.textContent = e.message; $('#w-next', v).disabled = false; return; }
    if (d.mode === 'import') { await refreshVersion(); S.me.hasServer = true; toast('Server übernommen'); location.hash = '#/overview'; return; }
    done = true; progress();
  }
  function progress() {
    $('#w-steps', v).innerHTML = '';
    $('#w-back', v).hidden = true; $('#w-next', v).hidden = true;
    body.innerHTML = `<div class="wiz-progress"><span class="spinner lg"></span><h2 class="wiz-h" id="w-ptitle">Server wird eingerichtet …</h2><p class="wiz-p" id="w-pmsg">${esc((S.task && S.task.msg) || 'Startet …')}</p>
      <div class="console" id="w-log" style="max-height:200px;min-height:60px;border-radius:9px;text-align:left"></div></div>`;
  }
  const paint = (lines) => {
    const box = $('#w-log', v); if (!box) return;
    lines.filter(([k, l]) => (k === 'sys' || k === 'err') && /^(Einrichtung|Setup|Java)/.test(l)).forEach(([k, l]) => {
      const el = document.createElement('div'); el.className = 'l ' + k; el.textContent = l.replace(/^(Einrichtung|Setup): /, ''); box.append(el);
      if (/^(Einrichtung fehlgeschlagen|Setup failed)/.test(l)) failed(l);
    });
    box.scrollTop = box.scrollHeight;
  };
  async function finished() {
    await refreshVersion();
    if (!S.me.hasServer) return;
    const addr = `${S.me.address || 'localhost'}${d.port !== 25565 ? ':' + d.port : ''}`;
    body.innerHTML = `<div class="wiz-progress"><div class="wiz-ok">${ico('check')}</div><h2 class="wiz-h">Dein Server ist bereit!</h2>
      <p class="wiz-p">${d.start ? 'Er startet gerade und erzeugt die Welt – das dauert beim ersten Mal ein bis zwei Minuten.' : 'Du kannst ihn jetzt oben rechts starten.'}</p>
      <p class="wiz-p">Im Heimnetz verbinden über <b class="mono">${esc(addr)}</b>. Damit Freunde von außerhalb joinen können, muss im Router der Port ${d.port} (TCP) freigegeben sein.</p>
      <a class="btn btn-primary" href="#/overview">${ico('home')}Zur Übersicht</a></div>`;
    hydrateIcons(body);
  }
  function failed(line) {
    const t = $('#w-ptitle', v); if (t) t.textContent = 'Das hat nicht geklappt';
    const p = $('#w-pmsg', v); if (p) p.textContent = line.replace(/^(Einrichtung fehlgeschlagen|Setup failed): /, '');
    const sp = $('.spinner', body); if (sp) sp.remove();
    if (!$('#w-retry', body)) body.insertAdjacentHTML('beforeend', '<button class="btn" id="w-retry" type="button">Zurück zum Assistenten</button>');
    $('#w-retry', body).onclick = () => { done = false; step = order().length - 1; $('#w-next', v).disabled = false; render(); };
  }

  $('#w-next', v).onclick = () => { if (!busy) next(); };
  $('#w-back', v).onclick = () => { if (step > 0) { step--; render(); } };
  (async () => {
    try { info = await api('/api/server/create/info'); } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (info.hasServer && !location.hash.includes('force')) {
      body.innerHTML = `<div class="empty">${ico('check')}Es ist bereits ein Server eingerichtet (<span class="mono">${esc(info.serverDir)}</span>). Software und Version änderst du unter <a href="#/updates">Updates &amp; Software</a>.</div>`;
      $('#w-next', v).hidden = true; $('#w-back', v).hidden = true; hydrateIcons(body); return;
    }
    d.port = info.port;
    d.serverDir = info.defaultDir;
    d.ram = info.system.ramRecommendMb;
    render();
  })();
  return sub((ev, data) => {
    if (!done) return;
    if (ev === 'log') paint(data);
    if (ev === 'task') { const p = $('#w-pmsg', v); if (p && S.task) p.textContent = S.task.msg; if (!S.task) finished(); }
  });
};

// Einstellungen: Start & Ressourcen (oberhalb der server.properties)
async function resourcesCard(el) {
  let r;
  try { r = await api('/api/panel/settings'); } catch (e) { el.innerHTML = ''; return; }
  const st = r.settings, sys = r.system, max = Math.max(1024, Math.floor(sys.ramTotalMb / 512) * 512);
  const gbs = (b) => num(b / 1024 ** 3, 1) + ' GB';
  const mb2gb = (m) => num(m / 1024, m % 1024 ? 1 : 0) + ' GB';
  let ram = st.ram_max_mb || st.ramEffectiveMb;
  el.innerHTML = `<div class="card" style="margin-bottom:18px"><div class="card-h"><h2>Start &amp; Ressourcen</h2><span class="sub">Blockhaus ${esc(S.me.appVersion || '')}</span></div>
    <div class="sys-grid">
      <div>
        <div class="field"><span>Arbeitsspeicher für Minecraft (wirkt nach Neustart)</span>
          <div class="ram-row"><input type="range" id="r-ram" min="1024" max="${max}" step="512" value="${ram}" ${st.control === 'systemd' ? 'disabled' : ''}><b class="mono" id="r-ramv">${mb2gb(ram)}</b></div>
          <div class="ram-scale"><span>1 GB</span><span>Empfohlen: ${mb2gb(sys.ramRecommendMb)}</span><span>${mb2gb(max)}</span></div>
          ${st.control === 'systemd' ? '<small class="muted">Wird über start.sh des systemd-Dienstes festgelegt.</small>' : ''}</div>
        <label class="row" style="margin-top:12px"><span class="switch"><input type="checkbox" id="r-st" ${st.storage_max_gb ? 'checked' : ''}><span></span></span>Speicherplatz begrenzen</label>
        <div class="row" id="r-st-row" style="margin-top:8px" ${st.storage_max_gb ? '' : 'hidden'}><input class="input mono" id="r-stv" type="number" min="1" step="1" value="${st.storage_max_gb || 20}" style="width:110px"><span>GB</span></div>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">Belegt (Welt + Backups): <b>${gbs(r.storage.used)}</b>${r.storage.max ? ` von ${gbs(r.storage.max)}` : ''} · frei auf dem Laufwerk: ${gbs(sys.diskFree)}</p>
      </div>
      <div class="wiz-toggles" style="margin:0">
        <label class="row"><span class="switch"><input type="checkbox" id="r-as" ${st.autostart ? 'checked' : ''} ${st.control === 'systemd' ? 'disabled' : ''}><span></span></span>Server mit Blockhaus automatisch starten</label>
        <label class="row"><span class="switch"><input type="checkbox" id="r-ar" ${st.auto_restart ? 'checked' : ''} ${st.control === 'systemd' ? 'disabled' : ''}><span></span></span>Nach Absturz automatisch neu starten</label>
        <label class="row"><span class="switch"><input type="checkbox" id="r-lan" ${st.listen_host === '0.0.0.0' ? 'checked' : ''}><span></span></span><span>Blockhaus auch von anderen Geräten im Heimnetz erreichbar<br><small class="muted">z. B. vom Handy: http://${esc(sys.lanIp)}:…</small></span></label>
        <label class="field" style="margin-top:6px"><span>Adresse für Spieler (optional, z. B. DynDNS-Name)</span><input class="input mono" id="r-addr" value="${esc(st.public_address || '')}" placeholder="${esc(sys.lanIp)}"></label>
        <label class="field" style="margin:0"><span>Sprache</span><select class="input" id="r-lang" translate="no" style="max-width:200px">${LANGS.map(([k, n]) => `<option value="${k}" ${k === I18N.lang ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <p class="muted" style="font-size:12.5px;margin:0">Java: ${st.java === 'auto' ? `automatisch${r.java.managed.length ? ` (geladen: ${r.java.managed.map((j) => 'Java ' + j).join(', ')})` : ''}` : esc(st.java)}</p>
      </div>
    </div>
    <div class="row" style="margin-top:16px"><button class="btn btn-primary btn-sm" id="r-save">${ico('save')}Speichern</button><span class="muted" id="r-msg" style="font-size:13px"></span><span class="grow"></span>
      <button class="btn btn-ghost btn-sm" id="r-tour">${ico('sparkle')}Rundgang starten</button><button class="btn btn-ghost btn-sm" id="r-ob">Erste Schritte wieder anzeigen</button></div></div>`;
  $('#r-tour', el).onclick = () => { location.hash = '#/overview'; setTimeout(() => startTour(true), 400); };
  $('#r-ob', el).onclick = async () => { if (await run(() => post('/api/onboarding', { flag: 'dismissed', value: false }), 'Erste Schritte stehen wieder auf der Übersicht')) location.hash = '#/overview'; };
  $('#r-lang', el).onchange = (e) => setLanguage(e.target.value);
  $('#r-ram', el).oninput = (e) => { ram = +e.target.value; $('#r-ramv', el).textContent = mb2gb(ram); };
  $('#r-st', el).onchange = (e) => { $('#r-st-row', el).hidden = !e.target.checked; };
  $('#r-save', el).onclick = async () => {
    const body = { storage_max_gb: $('#r-st', el).checked ? +$('#r-stv', el).value : null, listen_host: $('#r-lan', el).checked ? '0.0.0.0' : '127.0.0.1', public_address: $('#r-addr', el).value.trim() };
    if (st.control !== 'systemd') Object.assign(body, { ram_max_mb: ram, autostart: $('#r-as', el).checked, auto_restart: $('#r-ar', el).checked });
    const res = await run(() => post('/api/panel/settings', body), 'Gespeichert');
    if (res && res.restartPanel) {
      $('#r-msg', el).innerHTML = 'Die Netzwerk-Einstellung wirkt nach einem Neustart von Blockhaus. <button class="link-btn" id="r-rs">Jetzt neu starten</button>';
      $('#r-rs', el).onclick = () => run(() => post('/api/panel/restart', {}), 'Blockhaus startet neu …');
    }
  };
  hydrateIcons(el);
}

// ═════════════════════════ Einführung: Erste Schritte, Hilfe zur Portfreigabe, Tour ═════════════════════════
const OB_STEPS = {
  start: ['Server starten', 'Beim ersten Start erzeugt Minecraft die Welt – das dauert ein bis zwei Minuten.'],
  join: ['Mit Minecraft verbinden', 'Im Spiel: Mehrspieler → Server hinzufügen → diese Adresse eintragen.'],
  op: ['Dich zum Operator machen', 'Operatoren dürfen im Spiel alle Befehle nutzen (z. B. /gamemode). Dein Minecraft-Name:'],
  friends: ['Freunde einladen', 'Im selben WLAN können Freunde sofort joinen. Für Freunde von außerhalb braucht es eine Portfreigabe im Router.'],
  backup: ['Automatische Backups', 'Sichert die Welt regelmäßig, damit nichts verloren geht.'],
};

async function onboardingCard(el) {
  let r;
  try { r = await api('/api/onboarding'); } catch { el.innerHTML = ''; return; }
  if (r.dismissed || r.steps.every((x) => x.done)) { el.innerHTML = ''; return; }
  const doneN = r.steps.filter((x) => x.done).length;
  const addr = `${r.address || r.lanIp}${String(r.port) !== '25565' ? ':' + r.port : ''}`;
  const action = (id) => {
    if (id === 'start') return r.running ? '' : `<button class="btn btn-primary btn-sm" data-ob="start">${ico('play')}Server starten</button>`;
    if (id === 'join') return `<span class="ob-addr no-i18n"><b class="mono">${esc(addr)}</b></span><button class="icon-btn" data-ob="copy" title="Adresse kopieren">${ico('copy')}</button>`;
    if (id === 'op') return `<form class="row ob-op" data-ob-form="op"><input class="input" name="name" placeholder="Spielername" maxlength="16" autocomplete="off" spellcheck="false"><button class="btn btn-sm">${ico('crown')}Zum OP machen</button></form>`;
    if (id === 'friends') return `<button class="btn btn-sm" data-ob="ports">${ico('info')}So geht die Portfreigabe</button><button class="btn btn-sm btn-ghost" data-ob="friends">Erledigt</button>`;
    if (id === 'backup') return `<button class="btn btn-sm" data-ob="backup">${ico('archive')}Täglich sichern</button>`;
    return '';
  };
  el.innerHTML = `<div class="card ob-card"><div class="card-h"><h2>Erste Schritte</h2><span class="sub">${doneN} von ${r.steps.length} erledigt</span>
      <div class="right"><button class="btn btn-ghost btn-sm" data-ob="tour">${ico('sparkle')}Rundgang</button><button class="icon-btn" data-ob="hide" title="Ausblenden">${ico('x')}</button></div></div>
    <div class="ob-bar"><span style="width:${(doneN / r.steps.length) * 100}%"></span></div>
    <ol class="ob-list">${r.steps.map((x) => `<li class="${x.done ? 'done' : ''}"><span class="ob-check">${x.done ? svg('check') : ''}</span>
      <div class="ob-text"><b>${esc(OB_STEPS[x.id][0])}</b><small>${esc(OB_STEPS[x.id][1])}</small></div>
      <div class="ob-act">${x.done ? '' : action(x.id)}</div></li>`).join('')}</ol></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-ob]');
    if (!b) return;
    const a = b.dataset.ob;
    if (a === 'start') { await power('start'); setTimeout(() => onboardingCard(el), 1500); }
    else if (a === 'copy') copy(addr);
    else if (a === 'ports') portHelp(r);
    else if (a === 'tour') startTour(true);
    else if (a === 'friends' || a === 'hide') {
      await run(() => post('/api/onboarding', { flag: a === 'hide' ? 'dismissed' : 'friends' }));
      onboardingCard(el);
    } else if (a === 'backup') {
      if (await run(() => post('/api/panel/settings', { auto_backup_hours: 24 }), 'Automatische Backups: täglich')) onboardingCard(el);
    }
  };
  el.onsubmit = async (e) => {
    const f = e.target.closest('[data-ob-form=op]');
    if (!f) return;
    e.preventDefault();
    const name = f.name.value.trim();
    if (!name) return;
    if (await run(() => post('/api/players/action', { action: 'op', name }), `${name} ist jetzt Operator`)) setTimeout(() => onboardingCard(el), 800);
  };
  hydrateIcons(el);
}

function portHelp(r) {
  modal(`<h3>Freunde von außerhalb einladen</h3>
    <p>Damit Freunde über das Internet joinen können, muss dein Router Verbindungen auf dem Minecraft-Port an diesen Rechner weiterleiten.</p>
    <ol class="steps ob-steps">
      <li>Öffne die Oberfläche deines Routers im Browser (die Adresse steht meist auf dem Gerät, z. B. 192.168.0.1 oder 192.168.178.1).</li>
      <li>Suche den Bereich <b>Portfreigabe</b> bzw. <b>Port Forwarding</b> (oft unter „Internet“, „NAT“ oder „Freigaben“).</li>
      <li>Lege eine Regel an: Protokoll <b>TCP</b>, Port <b class="mono no-i18n">${esc(r.port)}</b>, Ziel-Gerät <b class="mono no-i18n">${esc(r.lanIp)}</b>.</li>
      <li>Deine öffentliche Adresse findest du z. B. auf der Router-Startseite. Ändert sie sich ständig, hilft ein DynDNS-Name (bieten viele Router an).</li>
      <li>Trag die Adresse unter <a href="#/settings" data-close="x">Einstellungen → Start &amp; Ressourcen</a> als „Adresse für Spieler“ ein – dann zeigt Blockhaus sie überall an.</li>
    </ol>
    <div class="notice info">${ico('info')}<div>Gib die Adresse nur Leuten, denen du vertraust, und schalte am besten die Whitelist ein (unter „Spieler“). Ohne Portfreigabe geht es auch über ein VPN, in dem alle Mitspieler sind.</div></div>
    <div class="btns"><button class="btn btn-primary" data-close="ok">Verstanden</button></div>`, { wide: false });
}

// ── Geführter Rundgang ──
const TOUR = [
  { title: 'Willkommen bei Blockhaus!', text: 'Ein kurzer Rundgang zeigt dir die wichtigsten Stellen. Du kannst ihn jederzeit beenden und später unter „Einstellungen“ erneut starten.' },
  { sel: '#power', title: 'Starten & Stoppen', text: 'Hier startest, stoppst und startest du den Server neu. Beim Stoppen gibt es auf Wunsch einen Countdown für die Spieler.' },
  { sel: '#status-pill', title: 'Status', text: 'Zeigt immer, ob der Server läuft, wie viele Spieler online sind und wie flüssig er läuft (TPS).' },
  { sel: '[data-page=console]', nav: true, title: 'Konsole', text: 'Das Live-Log des Servers. Hier kannst du auch Befehle direkt eingeben – ohne Schrägstrich.' },
  { sel: '[data-page=players]', nav: true, title: 'Spieler', text: 'Wer online ist, Whitelist, Operatoren, Banns – und für jeden Spieler Inventar, Statistiken und Notizen.' },
  { sel: '[data-page=mods]', nav: true, title: 'Mods & Plugins', text: 'Suche und installiere Erweiterungen mit einem Klick. Blockhaus zeigt nur, was zu deiner Server-Software passt.' },
  { sel: '[data-page=backups]', nav: true, title: 'Backups', text: 'Sicherungen der Welt – automatisch oder per Klick. Wiederherstellen geht für die ganze Welt oder nur für ein Gebiet (unter „Weltkarte 3D“).' },
  { sel: '[data-page=updates]', nav: true, title: 'Updates & Software', text: 'Neue Minecraft-Version einspielen oder zwischen Vanilla, Fabric, Forge, NeoForge, Paper und Purpur wechseln – mit Backup vorher.' },
  { sel: '[data-page=settings]', nav: true, title: 'Einstellungen', text: 'Arbeitsspeicher, Speicherlimit, Autostart, Sprache und alle Server-Einstellungen (server.properties).' },
  { sel: '#open-palette', nav: true, title: 'Schnell finden', text: 'Mit Strg+K (Mac: ⌘K) springst du zu jeder Seite und Aktion. Mit „/“ davor führst du direkt einen Befehl aus.' },
  { title: 'Fertig!', text: 'Auf der Übersicht findest du die „Ersten Schritte“ – damit ist dein Server in wenigen Minuten für dich und deine Freunde bereit. Viel Spaß!' },
];

function startTour(force) {
  if (!force && S.tourShown) return;
  S.tourShown = true;
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  let i = 0;
  const wrap = document.createElement('div');
  wrap.className = 'tour';
  wrap.innerHTML = '<div class="tour-hole"></div><div class="tour-bubble" role="dialog" aria-modal="true" aria-live="polite"></div>';
  document.body.append(wrap);
  const hole = $('.tour-hole', wrap), bub = $('.tour-bubble', wrap);
  const finish = async () => {
    wrap.remove();
    window.removeEventListener('resize', place); document.removeEventListener('keydown', key, true);
    $('#rail').classList.remove('open');
    try { await post('/api/onboarding', { flag: 'tour' }); } catch { /* egal */ }
  };
  function target() {
    const s = TOUR[i];
    if (!s.sel) return null;
    if (s.nav && mobile) $('#rail').classList.add('open');
    const el = $(s.sel);
    return el && el.getClientRects().length ? el : null;
  }
  function place() {
    const el = target(), pad = 6;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      Object.assign(hole.style, { display: 'block', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      const bw = Math.min(340, window.innerWidth - 32), bh = bub.offsetHeight || 180;
      let left = r.right + 16, top = r.top;
      if (left + bw > window.innerWidth - 16) { left = Math.max(16, Math.min(r.left, window.innerWidth - bw - 16)); top = r.bottom + 14; }
      if (top + bh > window.innerHeight - 16) top = Math.max(16, r.top - bh - 14);
      Object.assign(bub.style, { left: `${left}px`, top: `${top}px`, width: `${bw}px`, transform: 'none' });
    } else {
      Object.assign(hole.style, { display: 'block', left: '50%', top: '50%', width: '0px', height: '0px' });
      Object.assign(bub.style, { left: '50%', top: '50%', width: `${Math.min(380, window.innerWidth - 32)}px`, transform: 'translate(-50%, -50%)' });
    }
  }
  function show() {
    const s = TOUR[i];
    bub.innerHTML = `<div class="tour-n">${i + 1} / ${TOUR.length}</div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
      <div class="tour-btns"><button class="btn btn-ghost btn-sm" data-t="end">${i === TOUR.length - 1 ? 'Schließen' : 'Rundgang beenden'}</button><span class="grow"></span>
      ${i > 0 ? '<button class="btn btn-sm" data-t="back">Zurück</button>' : ''}<button class="btn btn-primary btn-sm" data-t="next">${i === TOUR.length - 1 ? 'Los geht’s' : 'Weiter'}</button></div>`;
    if (!TOUR[i].nav || !mobile) $('#rail').classList.remove('open');
    requestAnimationFrame(place);
    setTimeout(() => $('[data-t=next]', bub).focus(), 30);
  }
  const key = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); finish(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); i--; show(); }
  };
  const next = () => { if (i >= TOUR.length - 1) finish(); else { i++; show(); } };
  bub.onclick = (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'end') finish(); else if (b.dataset.t === 'back') { i--; show(); } else next();
  };
  window.addEventListener('resize', place);
  document.addEventListener('keydown', key, true);
  show();
}

// Rundgang beim ersten Besuch nach der Einrichtung automatisch anbieten
async function maybeTour() {
  if (!S.me || !S.me.hasServer || S.tourShown) return;
  try { const r = await api('/api/onboarding'); if (!r.tourDone) setTimeout(() => startTour(false), 600); } catch { /* egal */ }
}

// Einstellungen: Programm (Version, Updates, Start mit dem Rechner, Beenden, Deinstallieren)
async function systemCard(el) {
  let r;
  try { r = await api('/api/system'); } catch (e) { el.innerHTML = ''; return; }
  const inst = r.install;
  el.innerHTML = `<div class="card" style="margin-bottom:18px"><div class="card-h"><h2>Blockhaus</h2><span class="sub no-i18n">Version ${esc(r.version)}</span></div>
    <div class="sys-grid">
      <section>
        <div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn btn-sm" id="y-check">${ico('refresh')}Nach Updates suchen</button><span id="y-upd" class="muted" style="font-size:13px"></span></div>
        <div id="y-upd-box"></div>
        ${inst.installed ? '' : '<p class="muted" style="font-size:12.5px;margin:10px 0 0">Aus dem Quellcode gestartet – Updates kommen hier über git.</p>'}
        <label class="sys-toggle"><span class="switch"><input type="checkbox" id="y-auto" ${r.autostart ? 'checked' : ''}><span></span></span><span>Blockhaus beim Start des Rechners im Hintergrund starten<br><small class="muted">${esc({ Windows: 'beim Anmelden bei Windows', macOS: 'beim Anmelden am Mac', Linux: 'beim Hochfahren (systemd-Benutzerdienst)' }[r.os] || '')}</small></span></label>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">Zusammen mit „Server mit Blockhaus automatisch starten“ läuft dein Minecraft-Server dann immer, wenn der Rechner an ist.</p>
        <label class="sys-toggle"><span class="switch"><input type="checkbox" id="y-notify" ${r.notify ? 'checked' : ''}><span></span></span><span>Mitteilung des Systems, wenn Spieler joinen oder gehen<br><small class="muted">Erscheint auch, wenn das Blockhaus-Fenster geschlossen ist oder du gerade spielst.</small></span></label>
        <button class="btn btn-sm btn-ghost" id="y-notify-test" style="margin:8px 0 0 52px">${ico('chat')}Test-Mitteilung</button>
      </section>
      <section>
        <div class="sys-paths"><div><small>${tr('Daten')}</small><code class="no-i18n">${esc(r.dataDir)}</code></div>${inst.home ? `<div><small>${tr('Programm')}</small><code class="no-i18n">${esc(inst.home)}</code></div>` : ''}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-sm" id="y-quit">${ico('logout')}Blockhaus beenden</button><button class="btn btn-sm btn-danger" id="y-uninst">${ico('trash')}Deinstallieren</button></div>
      </section>
    </div></div>`;
  hydrateIcons(el);
  const showUpd = (u) => {
    const box = $('#y-upd-box', el), lab = $('#y-upd', el);
    if (!u) return;
    if (!u.available) { lab.innerHTML = `${ico('check')}${tr('Blockhaus ist aktuell')}`; box.innerHTML = ''; hydrateIcons(el); return; }
    lab.innerHTML = `<b style="color:var(--gold)">${tr('Version {0} verfügbar', { 0: esc(u.version) })}</b>`;
    box.innerHTML = `<div class="notice info" style="margin:10px 0 0">${ico('rocket')}<div><div class="no-i18n" style="white-space:pre-wrap;font-size:13px;max-height:140px;overflow:auto">${esc(u.notes || '').slice(0, 1500)}</div>
      ${r.canUpdate ? `<button class="btn btn-primary btn-sm" id="y-install" style="margin-top:10px">${ico('download')}${tr('Jetzt installieren')}</button><small class="muted" style="display:block;margin-top:6px">${tr('Blockhaus startet dafür kurz neu. Der Minecraft-Server läuft weiter.')}</small>`
        : `<a class="btn btn-sm" href="${esc(u.url)}" target="_blank" rel="noopener noreferrer" style="margin-top:10px">${ico('external')}${tr('Release ansehen')}</a>`}</div></div>`;
    hydrateIcons(box);
    const b = $('#y-install', box);
    if (b) b.onclick = async () => { b.disabled = true; if (!await run(() => post('/api/system/update', {}), 'Update wird installiert – Blockhaus startet gleich neu')) b.disabled = false; };
  };
  $('#y-check', el).onclick = async () => { $('#y-upd', el).textContent = tr('Suche …'); try { showUpd(await api('/api/system/update?force=1')); } catch (e) { $('#y-upd', el).textContent = e.message; } };
  if (r.update) showUpd(r.update); else api('/api/system/update').then(showUpd).catch(() => {});
  $('#y-notify', el).onchange = async (e) => {
    if (!await run(() => post('/api/panel/settings', { notify_system: e.target.checked }), e.target.checked ? 'Mitteilungen an' : 'Mitteilungen aus')) e.target.checked = !e.target.checked;
  };
  $('#y-notify-test', el).onclick = async () => {
    mcToast('join', S.me.user, tr('Spieler beigetreten'), tr('So sehen die Meldungen im Fenster aus'));
    const x = await run(() => post('/api/system/notify-test', {}));
    if (x && !x.ok) toast(tr('Auf diesem System gibt es keine Systemmitteilungen (unter Linux: notify-send fehlt)'), 'err');
  };
  $('#y-auto', el).onchange = async (e) => {
    const x = await run(() => post('/api/system/autostart', { on: e.target.checked }), e.target.checked ? 'Startet ab jetzt mit dem Rechner' : 'Startet nicht mehr mit dem Rechner');
    e.target.checked = x ? x.autostart : !e.target.checked;
  };
  $('#y-quit', el).onclick = async () => {
    const res = await modal(`<h3>Blockhaus beenden?</h3><p>Das Panel ist dann nicht mehr erreichbar, bis du Blockhaus wieder startest.</p>
      <label class="row" style="gap:10px"><input type="checkbox" name="stopServer" checked><span>Minecraft-Server ebenfalls stoppen</span></label>
      <div class="btns"><button class="btn" data-close="x">Abbrechen</button><button class="btn btn-primary" data-close="ok">Beenden</button></div>`);
    if (!res) return;
    await run(() => post('/api/panel/quit', { stopServer: !!res.stopServer }));
    document.body.innerHTML = `<div class="login"><div class="login-card"><h2>${tr('Blockhaus wurde beendet')}</h2><p class="muted">${tr('Du kannst dieses Fenster schließen.')}</p></div></div>`;
  };
  $('#y-uninst', el).onclick = async () => {
    const res = await modal(`<h3>Blockhaus deinstallieren?</h3>
      <p>Entfernt werden: Autostart, Einstellungen, Admin-Konten, das heruntergeladene Java${inst.installed ? ' und das Programm selbst' : ''}.</p>
      <label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" name="keepWorlds" checked style="margin-top:3px"><span>Server mit Welt und Backups behalten<br><small class="muted">Sie werden in deinen Benutzerordner verschoben (Blockhaus-Sicherung-…). Ohne Haken wird alles endgültig gelöscht.</small></span></label>
      <label class="field" style="margin-top:12px"><span>Zum Bestätigen „deinstallieren“ eintippen</span><input class="input" name="confirm" autocomplete="off"></label>
      <div class="btns"><button class="btn" data-close="x">Abbrechen</button><button class="btn btn-danger" data-close="ok">Deinstallieren</button></div>`);
    if (!res) return;
    if (!await run(() => post('/api/system/uninstall', { keepWorlds: !!res.keepWorlds, confirm: res.confirm }))) return;
    document.body.innerHTML = `<div class="login"><div class="login-card"><h2>${tr('Blockhaus wurde deinstalliert')}</h2><p class="muted">${res.keepWorlds ? tr('Deine Welt und die Backups liegen im Ordner „Blockhaus-Sicherung-…“ in deinem Benutzerordner.') : tr('Alle Daten wurden gelöscht.')}</p></div></div>`;
  };
}

// Hinweis auf eine neue Blockhaus-Version (beim Öffnen; „Später“ gilt bis zum nächsten Start)
async function updateNotice(delay = 1500) {
  await new Promise((r) => setTimeout(r, delay));
  let u;
  try { u = await api('/api/system/update'); } catch { return; }
  if (!u || !u.available || $('#upd-pop')) return;
  try { if (sessionStorage.getItem('bh.updLater') === u.version) return; } catch { /* egal */ }
  const first = String(u.notes || '').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean)[0] || '';
  const el = document.createElement('div');
  el.id = 'upd-pop'; el.className = 'upd-pop'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="upd-pop-h">${ico('rocket')}<b>${esc(tr('Blockhaus {0} ist verfügbar', { 0: u.version }))}</b>
      <button class="icon-btn" data-u="later" aria-label="Später">${ico('x')}</button></div>
    ${first ? `<p class="no-i18n">${esc(first)}</p>` : ''}
    <div class="upd-pop-b">${u.canUpdate ? `<button class="btn btn-primary btn-sm" data-u="install">${ico('download')}Jetzt installieren</button>` : ''}
      <a class="btn btn-sm" href="#/settings" data-u="details">Details</a><button class="btn btn-ghost btn-sm" data-u="later">Später</button></div>`;
  document.body.append(el);
  hydrateIcons(el);
  el.onclick = async (e) => {
    const b = e.target.closest('[data-u]');
    if (!b) return;
    if (b.dataset.u === 'later') { try { sessionStorage.setItem('bh.updLater', u.version); } catch { /* egal */ } el.remove(); }
    else if (b.dataset.u === 'details') el.remove();
    else if (b.dataset.u === 'install') {
      b.disabled = true;
      if (await run(() => post('/api/system/update', {}), 'Update wird installiert – Blockhaus startet gleich neu')) el.remove(); else b.disabled = false;
    }
  };
}

// Startanimation ausblenden, sobald die erste Ansicht steht – frühestens nach einem Durchlauf (~2,6 s)
function hideSplash() {
  const sp = document.getElementById('splash');
  if (!sp || sp.dataset.closing) return;
  sp.dataset.closing = '1';
  setTimeout(() => { sp.classList.add('done'); setTimeout(() => sp.remove(), 450); }, Math.max(0, 2600 - performance.now()));
}
setTimeout(hideSplash, 8000);  // spätestens dann, auch wenn etwas hängt
i18nInit().then(boot);

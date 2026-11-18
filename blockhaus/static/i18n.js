/* Blockhaus – Übersetzung.
 * Deutsch ist die Quellsprache im Code. i18n/<sprache>.json bildet deutsche Texte auf die Zielsprache ab;
 * Platzhalter {0}, {1} … stehen für eingesetzte Werte. Fehlt ein Eintrag, bleibt der deutsche Text stehen.
 * Übersetzt wird automatisch alles, was in die Seite gelangt (Textknoten, placeholder/title/aria-label).
 * Bereiche mit Inhalten von Spielern oder vom Server (Konsole, Chat, Dateinamen …) bleiben unverändert. */
const I18N = { lang: 'de', locale: 'de-DE', dec: ',', dict: null, first: new Map(), generic: [], obs: null };
const LANGS = [['de', 'Deutsch'], ['en', 'English']];
const I18N_SKIP = 'script,style,textarea,code,pre,kbd,.console,.mono,.chat-list,.sl-motd,.hero-motd,.no-i18n,[translate="no"]';

function i18nPreferred() {
  let l = null;
  try { l = localStorage.getItem('bh.lang'); } catch { /* privat */ }
  if (!l) l = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  return LANGS.some(([k]) => k === l) ? l : 'de';
}

function i18nCompile(dict) {
  I18N.first = new Map(); I18N.generic = [];
  for (const [de, en] of Object.entries(dict)) {
    if (!/\{\d\}/.test(de)) continue;
    const re = new RegExp('^' + de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d)\\\}/g, '(.+?)') + '$');
    const order = [...de.matchAll(/\{(\d)\}/g)].map((m) => +m[1]);
    const p = { re, en, order };
    const w = de.match(/^([^\s{]+)/);
    if (w) { if (!I18N.first.has(w[1])) I18N.first.set(w[1], []); I18N.first.get(w[1]).push(p); } else I18N.generic.push(p);
  }
}

// Text übersetzen (für Strings, die nicht im DOM landen – z. B. Canvas-Beschriftungen)
function tr(s, vars) {
  let out = s;
  if (I18N.dict && typeof s === 'string') {
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2].replace(/\s+/g, ' ');
    if (core && /[A-Za-zÄÖÜäöüß]/.test(core)) {
      let hit = I18N.dict[core];
      if (hit === undefined) hit = trPattern(core);
      if (hit !== undefined) out = m[1] + hit + m[3];
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (a, k) => (k in vars ? vars[k] : a));
  return out;
}

function trPattern(core) {
  const w = core.match(/^([^\s]+)/);
  const lists = [w && I18N.first.get(w[1]), I18N.generic];
  for (const list of lists) {
    if (!list) continue;
    for (const p of list) {
      const mm = p.re.exec(core);
      if (!mm) continue;
      const vals = {};
      p.order.forEach((idx, i) => { const v = mm[i + 1]; vals[idx] = I18N.dict[v] !== undefined ? I18N.dict[v] : v; });
      return p.en.replace(/\{(\d)\}/g, (a, k) => (k in vals ? vals[k] : a));
    }
  }
  return undefined;
}

const I18N_ATTRS = ['placeholder', 'title', 'aria-label'];

function i18nApply(root) {
  if (!I18N.dict || !root) return;
  if (root.nodeType === 3) {
    const pe = root.parentElement;
    if (pe && !pe.closest(I18N_SKIP)) { const t = tr(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; }
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9) return;
  if (root.nodeType === 1 && root.closest(I18N_SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && n.matches(I18N_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = root.nodeType === 1 ? root : walker.nextNode();
  while (n) {
    if (n.nodeType === 3) {
      const t = tr(n.nodeValue);
      if (t !== n.nodeValue) n.nodeValue = t;
    } else {
      for (const a of I18N_ATTRS) {
        const v = n.getAttribute(a);
        if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); }
      }
    }
    n = walker.nextNode();
  }
}

async function i18nInit(lang = i18nPreferred()) {
  I18N.lang = lang;
  I18N.locale = lang === 'de' ? 'de-DE' : 'en-GB';
  I18N.dec = lang === 'de' ? ',' : '.';
  document.documentElement.lang = lang;
  if (lang === 'de') { I18N.dict = null; return; }
  try {
    const r = await fetch(`/i18n/${lang}.json`, { cache: 'no-cache' });
    I18N.dict = await r.json();
  } catch { I18N.dict = null; return; }
  i18nCompile(I18N.dict);
  i18nApply(document.documentElement);
  I18N.obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') i18nApply(m.target);
      else if (m.type === 'attributes') {
        const v = m.target.getAttribute(m.attributeName);
        if (v && !m.target.closest(I18N_SKIP)) { const t = tr(v); if (t !== v) m.target.setAttribute(m.attributeName, t); }
      } else m.addedNodes.forEach((x) => i18nApply(x));
    }
  });
  I18N.obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}

// Sprache wechseln: merken, beim Server speichern (falls angemeldet) und neu laden
async function setLanguage(lang) {
  try { localStorage.setItem('bh.lang', lang); } catch { /* privat */ }
  try {
    if (typeof S !== 'undefined' && S.me) await fetch('/api/me/language', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': S.csrf }, body: JSON.stringify({ lang }) });
  } catch { /* egal */ }
  location.reload();
}

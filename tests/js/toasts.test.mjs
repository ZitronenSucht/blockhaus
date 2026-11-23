// Lädt die echte Blockhaus-Oberfläche in jsdom, schickt Live-Logzeilen wie der Server und prüft die Meldungen
// oben rechts (Spieler joinen/gehen, Erfolge). Ausgabe hilft bei der Fehlersuche.
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import assert from 'node:assert/strict';

const root = new URL('../../blockhaus/static/', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(String(e && (e.stack || e.message) || e)));
vc.on('error', (...a) => errors.push(a.join(' ')));
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/#/admins', virtualConsole: vc, pretendToBeVisual: true });
const w = dom.window;

const ME = { user: 'admin', csrf: 'x', address: '127.0.0.1', port: '25565', motd: 'Test', hasServer: true, language: 'de', appVersion: '0.0.0',
  version: { mc: '26.3', loader: 'paper', loaderName: 'Paper', loaderVersion: '258', kind: 'plugin', dir: 'plugins' } };
w.fetch = async (url) => {
  const u = String(url);
  const body = u.startsWith('/api/me') ? ME : u.startsWith('/api/setup/status') ? { needed: false } : {};
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
};
class FakeES {
  constructor() { FakeES.last = this; this.l = {}; this.readyState = 1; }
  addEventListener(ev, fn) { (this.l[ev] ||= []).push(fn); }
  emit(ev, data) { (this.l[ev] || []).forEach((fn) => fn({ data: JSON.stringify(data) })); }
  close() {}
}
w.EventSource = FakeES;
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.HTMLCanvasElement.prototype.getContext = () => null;

w.eval(readFileSync(new URL('i18n.js', root), 'utf8'));
w.eval(readFileSync(new URL('app.js', root), 'utf8'));
await new Promise((r) => setTimeout(r, 300));
assert.ok(FakeES.last, 'Live-Verbindung wurde nicht aufgebaut. Fehler: ' + errors.slice(0, 3).join(' | '));

const es = FakeES.last;
es.emit('init', { logs: [], stats: { state: 'active', ready: true, online: ['Steve'], players: 1 }, history: [], task: null, version: '0.0.0' });
const t = '12:00:00';
es.emit('log', [['log', `[${t}] [Server thread/INFO]: Steve joined the game`]]);
es.emit('log', [['log', `[${t}] [Server thread/INFO]: Steve has made the advancement [Stone Age]`]]);
es.emit('log', [['log', `[${t}] [Server thread/INFO]: Steve left the game`]]);
await new Promise((r) => setTimeout(r, 50));
const box = w.document.getElementById('mctoasts');
const toasts = [...box.children].map((x) => x.textContent.trim().replace(/\s+/g, ' '));
console.log('Meldungen oben rechts:', toasts);
if (errors.length) console.log('Fehler im Browser:\n' + errors.slice(0, 5).join('\n'));
assert.equal(toasts.length, 3, 'erwartet: 3 Meldungen');
assert.match(toasts[0], /Steve/);
console.log('Meldungen: ok');

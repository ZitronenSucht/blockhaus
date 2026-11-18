// Prüft die Übersetzung im Browser-Kontext (jsdom): Wörterbuch, Platzhalter, DOM, ausgenommene Bereiche.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';

const root = new URL('../../blockhaus/static/', import.meta.url);
const dict = JSON.parse(readFileSync(new URL('i18n/en.json', root), 'utf8'));
const dom = new JSDOM('<!doctype html><html><head><title>Übersicht · Blockhaus</title></head><body></body></html>', { runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window;
w.fetch = async () => ({ json: async () => dict });
w.localStorage.setItem('bh.lang', 'en');
w.eval(readFileSync(new URL('i18n.js', root), 'utf8') + '\nwindow.__api = { I18N, tr, i18nInit, i18nApply };');
const { I18N, tr, i18nInit } = w.__api;
await i18nInit('en');

let n = 0;
const eq = (a, b) => { assert.equal(a, b); n++; };
eq(I18N.lang, 'en');
eq(I18N.dec, '.');
eq(tr('Server starten'), 'Start server');
eq(tr('  Speichern  '), '  Save  ');
eq(tr('12 Spieler online.'), '12 players online.');
eq(tr('3 Updates verfügbar'), '3 Updates available');
eq(tr('Für Minecraft 26.2 gibt es keine Paper-Version'), 'There is no Paper version for Minecraft 26.2');
eq(tr('Nicht im Wörterbuch'), 'Nicht im Wörterbuch');
eq(tr('{0} von {1}', { 0: 'a', 1: 'b' }), 'a of b');

const b = w.document.body;
b.innerHTML = `<div><h1>Einstellungen</h1><button title="Adresse kopieren">Speichern</button>
  <input placeholder="Spieler suchen …"><div class="console"><span>Speichern</span></div>
  <span translate="no">Speichern</span><p>Server <b>Spieler</b></p></div>`;
await new Promise((r) => setTimeout(r, 0));  // MutationObserver
eq(b.querySelector('h1').textContent, 'Settings');
eq(b.querySelector('button').textContent, 'Save');
eq(b.querySelector('button').title, 'Copy address');
eq(b.querySelector('input').placeholder, 'Search players …');
eq(b.querySelector('.console span').textContent, 'Speichern');
eq(b.querySelector('[translate=no]').textContent, 'Speichern');
eq(b.querySelector('p b').textContent, 'Players');
b.querySelector('h1').textContent = 'Spielregeln';
await new Promise((r) => setTimeout(r, 0));
eq(b.querySelector('h1').textContent, 'Game rules');
console.log(`i18n: ${n} Prüfungen bestanden, ${Object.keys(dict).length} Einträge`);

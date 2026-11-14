// Prüft alle Inhaltsdateien: vollständig zweisprachig, eindeutige ids, gültige Platzhalter
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectText } from '../js/core/placeholders.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const LANGS = ['de', 'en'];

test('Oberflächentexte gibt es in beiden Sprachen mit denselben Schlüsseln', () => {
  const de = json('content/ui.de.json');
  const en = json('content/ui.en.json');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
  for (const [k, v] of Object.entries({ ...de, ...en })) assert.ok(String(v).trim(), `leer: ${k}`);
});

const games = readdirSync(join(root, 'content/games'));

for (const id of games) {
  test(`Spielbeschreibung ${id} ist vollständig`, () => {
    const meta = json(`content/games/${id}/game.json`);
    for (const field of ['name', 'tagline']) for (const l of LANGS) assert.ok(meta[field]?.[l], `${field}.${l}`);
    assert.match(meta.color, /^#[0-9a-f]{6}$/i);
    assert.match(meta.color2, /^#[0-9a-f]{6}$/i);
    for (const c of meta.categories || []) for (const l of LANGS) assert.ok(c.name[l] && c.desc[l], `${c.id}.${l}`);
  });
}

function checkCards(file, cards, categories) {
  const ids = new Set();
  for (const card of cards) {
    assert.ok(card.id, `${file}: Karte ohne id`);
    assert.ok(!ids.has(card.id), `${file}: doppelte id ${card.id}`);
    ids.add(card.id);
    assert.ok(categories.includes(card.cat), `${card.id}: unbekannte Kategorie ${card.cat}`);
    for (const l of LANGS) {
      assert.ok(typeof card[l] === 'string' && card[l].trim(), `${card.id}: Text ${l} fehlt`);
      const info = inspectText(card[l]);
      assert.deepEqual(info.errors, [], `${card.id} (${l}): ${info.errors.join(', ')}`);
      assert.ok(info.maxPlayer <= (card.players || 0), `${card.id} (${l}): braucht {p${info.maxPlayer}}, aber players = ${card.players || 0}`);
    }
    if (card.slots) assert.ok(card.slots.length <= (card.players || 0), `${card.id}: mehr slots als players`);
  }
  return ids;
}

test('„Ich hab noch nie“: genug Aussagen pro Kategorie, alles zweisprachig', () => {
  const cards = json('content/games/never/cards.json').cards;
  checkCards('cards.json', cards, ['mild', 'party', 'spicy']);
  for (const cat of ['mild', 'party', 'spicy']) {
    const n = cards.filter((c) => c.cat === cat).length;
    assert.ok(n >= 40, `${cat}: nur ${n} Karten`);
  }
});

test('„Ich hab noch nie“: genug Sonderkarten, Spicy-Karten mit zwei Personen', () => {
  const specials = json('content/games/never/specials.json').cards;
  const ids = checkCards('specials.json', specials, ['general', 'spicy']);
  assert.equal(ids.size, specials.length);
  const general = specials.filter((c) => c.cat === 'general');
  const spicy = specials.filter((c) => c.cat === 'spicy');
  assert.ok(general.length >= 20, `nur ${general.length} allgemeine Sonderkarten`);
  assert.ok(spicy.length >= 20, `nur ${spicy.length} Spicy-Sonderkarten`);
  assert.ok(spicy.every((c) => c.players === 2), 'Spicy-Sonderkarten brauchen zwei Personen');
});

test('Service Worker: Cache-Name passt zu APP_VERSION und alle App-Dateien sind eingetragen', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const version = readFileSync(join(root, 'js/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  assert.ok(sw.includes(`const CACHE = 'drinkinggames-v${version}'`), 'Cache-Name und APP_VERSION stimmen nicht überein');

  const listed = new Set([...sw.matchAll(/'([^']+\.(?:js|json|css|html|webmanifest|svg|png))'/g)].map((m) => m[1]));
  const walk = (dir) =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );
  const files = [...walk('js'), ...walk('css'), ...walk('content'), ...walk('icons'), 'index.html', 'manifest.webmanifest'];
  for (const f of files) assert.ok(listed.has(f), `fehlt in sw.js: ${f}`);
  for (const f of listed) assert.ok(existsSync(join(root, f)), `in sw.js, aber nicht vorhanden: ${f}`);
});

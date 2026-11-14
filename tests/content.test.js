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
    // Optionen (Einstellungen des Spiels)
    const keys = new Set();
    for (const o of meta.options || []) {
      keys.add(o.key);
      for (const l of LANGS) assert.ok(o.label?.[l], `options.${o.key}.label.${l}`);
      assert.ok(['choice', 'toggle', 'stepper'].includes(o.type), `options.${o.key}: unbekannter Typ`);
      if (o.type === 'choice') {
        assert.ok(o.choices.some((c) => c.value === o.default), `options.${o.key}: default fehlt in choices`);
        for (const c of o.choices) for (const l of LANGS) assert.ok(c.label[l], `options.${o.key}.${c.value}.${l}`);
      }
      if (o.type === 'stepper') assert.ok(o.min <= o.default && o.default <= o.max, `options.${o.key}: default außerhalb`);
      if (o.type === 'toggle') assert.equal(typeof o.default, 'boolean');
    }
    for (const [cond, text] of Object.entries(meta.rulesIf || {})) {
      const [key, value] = cond.split('=');
      assert.ok(keys.has(key), `rulesIf.${cond} ohne passende Option`);
      if (value !== undefined) {
        const o = meta.options.find((x) => x.key === key);
        assert.ok(o.choices?.some((c) => c.value === value), `rulesIf.${cond}: Wert gibt es nicht`);
      }
      for (const l of LANGS) assert.ok(text[l], `rulesIf.${key}.${l}`);
    }
    for (const c of meta.custom || []) for (const l of LANGS) assert.ok(c.label[l] && c.hint[l], `custom.${c.list}.${l}`);
  });
}

function checkCards(file, cards, categories, defaultPlayers = 0) {
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
      const players = card.players || defaultPlayers;
      assert.ok(info.maxPlayer <= players, `${card.id} (${l}): braucht {p${info.maxPlayer}}, aber players = ${players}`);
    }
    if (card.slots) assert.ok(card.slots.length <= (card.players || defaultPlayers), `${card.id}: mehr slots als players`);
    if (card.timer !== undefined) assert.ok(Number.isInteger(card.timer) && card.timer > 0, `${card.id}: ungültiger timer`);
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

test('„Wahrheit oder Pflicht“: je 40 Wahrheiten und Pflichten pro Kategorie, alles zweisprachig', () => {
  const meta = json('content/games/truthordare/game.json');
  for (const key of ['choice', 'forced', 'truth', 'dare', 'done', 'refused', 'drink'])
    for (const l of LANGS) assert.ok(meta.texts[key]?.[l], `texts.${key}.${l}`);
  for (const [key, s] of Object.entries(meta.stats))
    for (const l of LANGS) assert.ok(s.title[l] && s.count[l].one && s.count[l].other, `stats.${key}.${l}`);

  const cats = ['mild', 'party', 'spicy'];
  const truths = json('content/games/truthordare/truths.json').cards;
  const dares = json('content/games/truthordare/dares.json').cards;
  const ids = [...checkCards('truths.json', truths, cats, 1), ...checkCards('dares.json', dares, cats, 1)];
  assert.equal(new Set(ids).size, ids.length, 'doppelte ids zwischen Wahrheiten und Pflichten');
  for (const cat of cats) {
    for (const [name, list] of [['Wahrheiten', truths], ['Pflichten', dares]]) {
      const n = list.filter((c) => c.cat === cat).length;
      assert.ok(n >= 40, `${cat}: nur ${n} ${name}`);
    }
  }
});

test('„Wer würde eher …?“: je 40 Fragen pro Kategorie, alles zweisprachig, ohne Personen-Platzhalter', () => {
  const meta = json('content/games/mostlikely/game.json');
  for (const key of ['duel', 'voting', 'result', 'winner', 'tie', 'drinks'])
    for (const l of LANGS) assert.ok(meta.texts[key]?.[l], `texts.${key}.${l}`);
  const cats = ['mild', 'party', 'spicy'];
  const questions = json('content/games/mostlikely/questions.json').cards;
  checkCards('questions.json', questions, cats, 0);
  for (const cat of cats) {
    const n = questions.filter((c) => c.cat === cat).length;
    assert.ok(n >= 40, `${cat}: nur ${n} Fragen`);
  }
});

test('„Party-Mix“: je 40 Karten pro Kategorie, gültige Typen, Regeln mit Ende-Text', () => {
  const meta = json('content/games/partymix/game.json');
  const types = ['task', 'all', 'rule', 'game', 'duel', 'vote'];
  for (const t of [...types, 'ruleEnd', 'spicy']) for (const l of LANGS) assert.ok(meta.themes[t]?.label?.[l], `themes.${t}.${l}`);
  const cats = ['mild', 'party', 'spicy'];
  const cards = json('content/games/partymix/cards.json').cards;
  checkCards('partymix/cards.json', cards, cats, 0);
  for (const c of cards) {
    assert.ok(types.includes(c.type), `${c.id}: unbekannter Typ ${c.type}`);
    if (c.type === 'rule') {
      for (const l of LANGS) {
        assert.ok(c.end?.[l], `${c.id}: end.${l} fehlt`);
        const info = inspectText(c.end[l]);
        assert.deepEqual(info.errors, [], `${c.id} end (${l})`);
        assert.ok(info.maxPlayer <= (c.players || 0), `${c.id} end (${l}): zu viele Personen`);
      }
    }
    if (c.type === 'duel') assert.equal(c.players, 2, `${c.id}: Duell braucht zwei Personen`);
  }
  for (const cat of cats) {
    const n = cards.filter((c) => c.cat === cat).length;
    assert.ok(n >= 40, `${cat}: nur ${n} Karten`);
  }
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

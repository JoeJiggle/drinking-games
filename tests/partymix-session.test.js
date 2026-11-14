import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../js/games/partymix/game.js';
import { seededRng } from '../js/core/random.js';

const tr = (s) => ({ de: s, en: s });
const meta = { themes: { task: { label: tr('Aufgabe') }, rule: { label: tr('Neue Regel') }, duel: { label: tr('Duell') } } };
const types = ['task', 'task', 'task', 'all', 'rule', 'game', 'duel', 'vote'];
const make = (cat, n) =>
  Array.from({ length: n }, (_, i) => {
    const type = types[i % types.length];
    const card = { id: `${cat}-${i}`, cat, type, de: `${type} ${i}`, en: `${type} ${i}` };
    if (type === 'rule') Object.assign(card, { players: 1, de: '{p1} Regel', en: '{p1} rule', end: tr('{p1} Ende') });
    if (type === 'duel') Object.assign(card, { players: 2, match: 'mixed', de: '{p1} vs {p2}', en: '{p1} vs {p2}' });
    return card;
  });
const content = { cards: [...make('mild', 40), ...make('party', 40), ...make('spicy', 40)] };
const players = [
  { id: 'a', name: 'Anna', gender: 'f' },
  { id: 'b', name: 'Ben', gender: 'm' },
  { id: 'c', name: 'Cem', gender: 'm' },
  { id: 'd', name: 'Dana', gender: 'f' },
];
const session = (options = {}, cats = ['mild', 'party'], seed = 1) =>
  createSession({ content, players, categories: cats, meta, options, rng: seededRng(seed) });
const playAll = (s) => {
  const out = [];
  let c;
  while ((c = s.next())) out.push(c);
  return out;
};

test('Spiellänge begrenzt die Zahl der Karten, keine Karte doppelt', () => {
  for (const [length, n] of [['short', 25], ['normal', 40], ['long', 60]]) {
    const cards = playAll(session({ length })).filter((c) => c.kind === 'card');
    assert.equal(cards.length, n);
    assert.equal(new Set(cards.map((c) => c.id)).size, n);
  }
});

test('Regeln enden mit eigener Karte, höchstens zwei gleichzeitig', () => {
  const all = playAll(session({ length: 'long' }, ['mild', 'party', 'spicy'], 3));
  let open = 0;
  let ends = 0;
  for (const c of all) {
    if (c.type === 'rule') open++;
    if (c.kind === 'ruleEnd') {
      open--;
      ends++;
      assert.match(c.text.de, /Ende$/);
      assert.equal(c.players.length, 1);
    }
    assert.ok(open <= 2, 'mehr als zwei Regeln gleichzeitig');
  }
  assert.ok(ends > 0);
});

test('Regeln ausgeschaltet: keine Regel-Karten', () => {
  const all = playAll(session({ rules: false, length: 'long' }));
  assert.ok(all.every((c) => c.type !== 'rule' && c.kind !== 'ruleEnd'));
});

test('Sondertypen kommen nicht zweimal direkt hintereinander', () => {
  const cards = playAll(session({ length: 'long' }, ['mild', 'party', 'spicy'], 4)).filter((c) => c.kind === 'card');
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].type !== 'task') assert.notEqual(cards[i].type, cards[i - 1].type);
  }
});

test('Spicy-Karten: eigenes Farbthema mit Typ-Beschriftung, Duelle bei „immer gemischt“ gemischt', () => {
  const cards = playAll(session({ pairing: 'always', length: 'long' }, ['spicy'], 5)).filter((c) => c.kind === 'card');
  assert.ok(cards.every((c) => c.theme === 'spicy'));
  const duels = cards.filter((c) => c.type === 'duel');
  assert.ok(duels.length > 0);
  for (const d of duels) {
    assert.deepEqual(d.label, tr('Duell'));
    assert.notEqual(d.players[0].gender, d.players[1].gender);
  }
});

test('Karte aussortieren beendet eine laufende Regel sofort', () => {
  const s = session({ length: 'long' }, ['mild'], 6);
  let card;
  do card = s.next(); while (card.type !== 'rule');
  s.skip();
  let rest;
  while ((rest = s.next())) assert.notEqual(rest.ruleId, card.id, 'Ende einer aussortierten Regel');
});

test('Rückblick: wer stand am häufigsten auf den Karten', () => {
  const s = session();
  playAll(s);
  const [row] = s.summary();
  assert.equal(row.key, 'spotlight');
  assert.ok(row.n > 0 && row.names.length >= 1);
  assert.equal(s.finished(), true);
});

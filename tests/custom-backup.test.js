import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCustom, removeHidden, checkCustomText, toCard } from '../js/core/custom.js';
import { createBackup, parseBackup, applyBackup } from '../js/core/backup.js';

const content = { truths: [{ id: 't1', cat: 'mild', de: 'a', en: 'a' }], dares: [{ id: 'd1', cat: 'party', de: 'b', en: 'b' }] };
const mine = [
  { id: 'c-1', game: 'truthordare', list: 'dares', cat: 'spicy', text: 'Küss {p2}' },
  { id: 'c-2', game: 'truthordare', list: 'truths', cat: 'mild', text: 'Was isst du gern?' },
];

test('eigene Karten landen in der richtigen Liste, ohne das Original zu verändern', () => {
  const merged = mergeCustom(content, mine);
  assert.equal(merged.dares.length, 2);
  assert.equal(merged.truths.length, 2);
  assert.equal(content.dares.length, 1);
  assert.deepEqual(toCard(mine[0]), { id: 'c-1', cat: 'spicy', de: 'Küss {p2}', en: 'Küss {p2}', custom: true, players: 2, match: 'mixed' });
});

test('eigene Karte mit nur {p1} braucht eine Person', () => {
  const card = toCard({ id: 'c-9', game: 'partymix', list: 'cards', cat: 'party', text: '{p1} trinkt {s:2}' });
  assert.equal(card.players, 1);
  assert.equal(card.match, undefined);
  assert.equal(toCard({ id: 'c-8', game: 'never', list: 'cards', cat: 'mild', text: 'Ich hab noch nie …' }).players, undefined);
});

test('aussortierte Karten werden entfernt', () => {
  const out = removeHidden(mergeCustom(content, mine), (id) => id === 'd1' || id === 'c-2');
  assert.deepEqual(out.dares.map((c) => c.id), ['c-1']);
  assert.deepEqual(out.truths.map((c) => c.id), ['t1']);
});

test('Text eigener Karten wird geprüft', () => {
  assert.equal(checkCustomText('  ', 2), 'empty');
  assert.equal(checkCustomText('Ich hab noch nie {p1} geküsst', 0), 'placeholder');
  assert.equal(checkCustomText('Küss {p2}', 2), null);
  assert.equal(checkCustomText('Küss {p3}', 2), 'placeholder');
  assert.equal(checkCustomText('Kaputt {p2', 2), 'placeholder');
});

test('Sicherung: erstellen, einlesen, zusammenführen, ersetzen', () => {
  const backup = createBackup({ customCards: mine, hiddenCards: ['never/mild-01'] }, new Date('2026-11-14T12:00:00Z'));
  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(parsed.customCards.length, 2);

  const current = { customCards: [mine[0], { ...mine[1], id: 'c-3' }], hiddenCards: ['never/party-02'] };
  const merged = applyBackup(current, parsed, 'merge');
  assert.deepEqual(merged.customCards.map((c) => c.id), ['c-1', 'c-3', 'c-2']);
  assert.deepEqual(merged.hiddenCards.sort(), ['never/mild-01', 'never/party-02']);

  const replaced = applyBackup(current, parsed, 'replace');
  assert.deepEqual(replaced.customCards.map((c) => c.id), ['c-1', 'c-2']);
  assert.deepEqual(replaced.hiddenCards, ['never/mild-01']);
});

test('ungültige Sicherungen werden abgelehnt, kaputte Einträge aussortiert', () => {
  assert.throws(() => parseBackup('kein json'));
  assert.throws(() => parseBackup('{"app":"andere"}'));
  assert.throws(() => parseBackup('{"app":"schwips","format":99}'));
  const parsed = parseBackup(JSON.stringify({ app: 'schwips', format: 1, customCards: [mine[0], { id: 5 }], hiddenCards: ['x', 3] }));
  assert.equal(parsed.customCards.length, 1);
  assert.deepEqual(parsed.hiddenCards, ['x']);
});

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
  assert.equal(checkCustomText('x'.repeat(241), 2), 'long');
});

const allowed = {
  never: { cats: ['mild', 'party', 'spicy'], lists: { cards: 0 } },
  truthordare: { cats: ['mild', 'party', 'spicy'], lists: { truths: 2, dares: 2 } },
};
const backupOf = (customCards, hiddenCards = []) => JSON.stringify({ app: 'schwips', format: 1, customCards, hiddenCards });

test('Sicherung: erstellen, einlesen, zusammenführen, ersetzen', () => {
  const backup = createBackup({ customCards: mine, hiddenCards: ['never/mild-01'] }, new Date('2026-11-14T12:00:00Z'));
  const parsed = parseBackup(JSON.stringify(backup), allowed);
  assert.equal(parsed.skipped, 0);
  assert.equal(parsed.customCards.length, 2);

  const current = { customCards: [mine[0], { ...mine[1], id: 'c-3' }], hiddenCards: ['never/party-02'] };
  const merged = applyBackup(current, parsed, 'merge');
  assert.deepEqual(merged.customCards.map((c) => c.id), ['c-1', 'c-3', 'c-2']);
  assert.deepEqual(merged.hiddenCards.sort(), ['never/mild-01', 'never/party-02']);

  const replaced = applyBackup(current, parsed, 'replace');
  assert.deepEqual(replaced.customCards.map((c) => c.id), ['c-1', 'c-2']);
  assert.deepEqual(replaced.hiddenCards, ['never/mild-01']);
});

test('ungültige Sicherungen werden abgelehnt', () => {
  assert.throws(() => parseBackup('kein json', allowed));
  assert.throws(() => parseBackup('{"app":"andere"}', allowed));
  assert.throws(() => parseBackup('{"app":"schwips","format":99}', allowed));
  assert.throws(() => parseBackup('{"app":"schwips","format":0}', allowed));
  assert.throws(() => parseBackup(backupOf([]) + ' '.repeat(1_000_001), allowed), 'zu große Datei');
});

test('Import übernimmt nur gültige Karten mit bekannten Spielen, Listen und Kategorien', () => {
  const card = (patch) => ({ ...mine[1], id: 'c-' + Math.random().toString(36).slice(2, 8), ...patch });
  const parsed = parseBackup(
    backupOf([
      mine[0],
      { id: 5 },
      card({ game: 'unbekannt' }),
      card({ list: 'cards' }), // gibt es bei Wahrheit oder Pflicht nicht
      card({ cat: 'extrem' }),
      card({ text: 'x'.repeat(241) }),
      card({ text: '{p3} macht etwas' }),
      card({ game: 'never', list: 'cards', text: 'Ich hab noch nie {p1} …' }), // keine Namen erlaubt
      card({ id: 'böse<script>' }),
      { ...mine[0] }, // doppelte id
      card({ text: '  Gültig  ', extra: '<img src=x onerror=alert(1)>' }),
    ]),
    allowed,
  );
  assert.deepEqual(parsed.customCards.map((c) => c.id).slice(0, 1), ['c-1']);
  assert.equal(parsed.customCards.length, 2);
  const valid = parsed.customCards[1];
  assert.equal(valid.text, 'Gültig');
  assert.deepEqual(Object.keys(valid).sort(), ['cat', 'game', 'id', 'list', 'text'], 'unbekannte Felder werden verworfen');
  assert.equal(parsed.skipped, 9);
});

test('Import begrenzt die Anzahl und prüft aussortierte Karten', () => {
  const many = Array.from({ length: 2500 }, (_, i) => ({ id: `c-${i}`, game: 'never', list: 'cards', cat: 'mild', text: `Karte ${i}` }));
  assert.equal(parseBackup(backupOf(many), allowed).customCards.length, 2000);
  const parsed = parseBackup(backupOf([], ['never/mild-01', 'never/mild-01', 'x', 3, 'fremd/mild-01', 'never/<b>', 'truthordare/d-party-02']), allowed);
  assert.deepEqual(parsed.hiddenCards, ['never/mild-01', 'truthordare/d-party-02']);
});

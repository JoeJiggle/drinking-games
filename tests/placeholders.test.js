import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderText, renderParts, inspectText, scaleSips } from '../js/core/placeholders.js';

const anna = { name: 'Anna', gender: 'f' };
const ben = { name: 'Ben', gender: 'm' };

test('setzt Namen ein', () => {
  assert.equal(renderText('{p1} trinkt mit {p2}.', [anna, ben]), 'Anna trinkt mit Ben.');
});

test('wählt Wortformen nach Geschlecht', () => {
  const text = '{p1} sucht sich jemanden aus, der mit {p1:ihm|ihr} trinkt.';
  assert.equal(renderText(text, [anna]), 'Anna sucht sich jemanden aus, der mit ihr trinkt.');
  assert.equal(renderText(text, [ben]), 'Ben sucht sich jemanden aus, der mit ihm trinkt.');
});

test('Wortformen dürfen mehrere Wörter und Leerzeichen enthalten', () => {
  assert.equal(renderText('{p1} wird {p1:zum Daumenmeister|zur Daumenmeisterin}.', [anna]), 'Anna wird zur Daumenmeisterin.');
});

test('Namen sind als eigene Teile markiert', () => {
  const parts = renderParts('{p1} küsst {p2:ihn|sie}.', [ben, anna]);
  assert.deepEqual(parts, [
    { type: 'name', value: 'Ben' },
    { type: 'text', value: ' küsst sie.' },
  ]);
});

test('Schlucke werden mit der Trinkstärke umgerechnet', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => scaleSips(n, 'light')), [1, 1, 2, 2]);
  assert.deepEqual([1, 2, 3, 4].map((n) => scaleSips(n, 'normal')), [1, 2, 3, 4]);
  assert.deepEqual([1, 2, 3, 4].map((n) => scaleSips(n, 'strong')), [2, 3, 5, 6]);
});

test('Schluck-Platzhalter mit Einzahl/Mehrzahl', () => {
  const text = '{p1} verteilt {s:2|Schluck|Schlucke} – oder trinkt {s:3}.';
  assert.equal(renderText(text, [{ name: 'Ben', gender: 'm' }]), 'Ben verteilt 2 Schlucke – oder trinkt 3.');
  assert.equal(renderText(text, [{ name: 'Ben', gender: 'm' }], { strength: 'light' }), 'Ben verteilt 1 Schluck – oder trinkt 2.');
  assert.equal(renderText('{s:1|sip|sips}', [], { strength: 'strong' }), '2 sips');
  assert.deepEqual(inspectText('trink {s:2}'), { maxPlayer: 0, errors: [] });
  assert.equal(inspectText('trink {s:zwei}').errors.length, 1);
});

test('erkennt benötigte Personen und Fehler', () => {
  assert.deepEqual(inspectText('{p2} und {p1:er|sie}'), { maxPlayer: 2, errors: [] });
  assert.equal(inspectText('{p1:er/sie} trinkt').errors.length, 1);
  assert.equal(inspectText('{spieler} trinkt').errors.length, 1);
  assert.equal(inspectText('Alle trinken.').maxPlayer, 0);
});

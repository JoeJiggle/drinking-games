import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderText, renderParts, inspectText } from '../js/core/placeholders.js';

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

test('erkennt benötigte Personen und Fehler', () => {
  assert.deepEqual(inspectText('{p2} und {p1:er|sie}'), { maxPlayer: 2, errors: [] });
  assert.equal(inspectText('{p1:er/sie} trinkt').errors.length, 1);
  assert.equal(inspectText('{spieler} trinkt').errors.length, 1);
  assert.equal(inspectText('Alle trinken.').maxPlayer, 0);
});

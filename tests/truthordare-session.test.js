import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../js/games/truthordare/game.js';
import { seededRng } from '../js/core/random.js';

const tr = (o) => ({ de: o, en: o });
const meta = {
  penalty: { truth: 2, dare: 3 },
  texts: {
    choice: tr('{p1}, Wahrheit oder Pflicht?'),
    forced: tr('{p1}, jetzt Pflicht!'),
    truth: tr('Wahrheit'),
    dare: tr('Pflicht'),
    done: tr('Geschafft'),
    refused: tr('Verweigert'),
    drink: { de: 'trink {n}', en: 'drink {n}' },
  },
};
const make = (prefix, cat, n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${cat}-${i}`, cat, de: `${prefix} ${cat} ${i}`, en: `${prefix} ${cat} ${i}`, ...extra }));
const content = {
  truths: [...make('t', 'mild', 10), ...make('t', 'party', 10), ...make('t', 'spicy', 10)],
  dares: [
    ...make('d', 'mild', 10),
    ...make('d', 'party', 5, { players: 2, de: '{p2} hilft', en: '{p2} helps' }),
    ...make('d', 'spicy', 10, { players: 2, match: 'mixed', de: '{p1} und {p2}', en: '{p1} and {p2}' }),
  ],
};
const players = [
  { id: 'a', name: 'Anna', gender: 'f' },
  { id: 'b', name: 'Ben', gender: 'm' },
  { id: 'c', name: 'Cem', gender: 'm' },
];
const start = (cats = ['mild', 'party'], seed = 1) => {
  const s = createSession({ content, players, categories: cats, meta, rng: seededRng(seed) });
  return { s, first: s.next() };
};

test('reihum in der Reihenfolge der Spielerliste', () => {
  const { s, first } = start();
  const order = [first.playerId];
  let card = first;
  for (let i = 0; i < 8; i++) {
    card = s.act(card.kind === 'choice' ? 'dare' : 'done');
    if (card.kind === 'choice') order.push(card.playerId);
  }
  assert.deepEqual(order, ['a', 'b', 'c', 'a', 'b']);
  assert.equal(card.round, 2);
});

test('Wahl führt zur passenden Aufgabe für die Person, die dran ist', () => {
  const { s, first } = start();
  const task = s.act('truth');
  assert.equal(task.kind, 'task');
  assert.equal(task.type, 'truth');
  assert.equal(task.who, 'Anna');
  assert.equal(task.players[0].name, 'Anna');
  assert.ok(['mild', 'party'].includes(task.theme));
  assert.equal(first.outcome, 'truth');
  assert.equal(task.actions[1].sub.de, 'trink {s:2}');
  const next = s.act('refused');
  assert.equal(next.kind, 'choice');
  assert.equal(s.act('dare').actions[1].sub.de, 'trink {s:3}');
});

test('nach zweimal Wahrheit muss dieselbe Person Pflicht nehmen', () => {
  const { s } = start();
  let card;
  for (let i = 0; i < 6; i++) {
    s.act('truth');
    card = s.act('done');
  }
  // dritte Runde, Anna ist wieder dran
  assert.equal(card.playerId, 'a');
  assert.equal(card.actions.find((a) => a.id === 'truth').disabled, true);
  assert.equal(s.act('truth'), null);
  assert.equal(s.act('dare').type, 'dare');
});

test('Aufgaben mit zweiter Person: nie dieselbe Person, Spicy nur mit Spicy', () => {
  const { s } = start(['party'], 3);
  for (let i = 0; i < 30; i++) {
    const task = s.act('dare');
    assert.notEqual(task.theme, 'spicy');
    if (task.players.length === 2) assert.notEqual(task.players[0].name, task.players[1].name);
    s.act('done');
  }
});

test('keine Wiederholung, bis alle Aufgaben einer Art durch sind', () => {
  const { s } = start(['mild'], 4);
  const seen = [];
  for (let i = 0; i < 10; i++) {
    seen.push(s.act('truth').id);
    s.act('done');
    s.act('dare');
    s.act('done');
  }
  // 10 Wahrheiten in mild, jede Person nimmt abwechselnd Wahrheit/Pflicht – erzwungene Pflicht greift nicht
  assert.equal(new Set(seen).size, 10);
});

test('zurückblättern und anders entscheiden ersetzt den weiteren Verlauf', () => {
  const { s, first } = start();
  const truthTask = s.act('truth');
  s.act('done');
  assert.equal(s.prev(), truthTask);
  assert.equal(s.prev(), first);
  // gleiche Entscheidung: vorwärts durch den bestehenden Verlauf
  assert.equal(s.act('truth'), truthTask);
  s.prev();
  const dareTask = s.act('dare');
  assert.equal(dareTask.type, 'dare');
  assert.equal(s.next(), null);
});

test('zufällige Reihenfolge: jede Runde kommt jede Person genau einmal dran', () => {
  const s = createSession({ content, players, categories: ['mild'], meta, options: { order: 'random' }, rng: seededRng(11) });
  let card = s.next();
  const turns = [card.playerId];
  while (turns.length < 12) {
    card = s.act(card.kind === 'choice' ? 'dare' : 'done');
    if (card.kind === 'choice') turns.push(card.playerId);
  }
  for (let r = 0; r < 4; r++) assert.deepEqual(turns.slice(r * 3, r * 3 + 3).sort(), ['a', 'b', 'c']);
  for (let i = 1; i < turns.length; i++) assert.notEqual(turns[i], turns[i - 1]);
  assert.notDeepEqual(turns.slice(0, 9), ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c']);
});

test('Optionen: Pflicht-Regel aus, eigene Schluckzahlen', () => {
  const s = createSession({
    content, players, categories: ['mild'], meta, rng: seededRng(12),
    options: { forceDare: false, penaltyTruth: 4, penaltyDare: 5 },
  });
  let card = s.next();
  for (let i = 0; i < 6; i++) {
    const task = s.act('truth');
    assert.equal(task.actions[1].sub.de, 'trink {s:4}');
    card = s.act('done');
  }
  assert.equal(card.actions.find((a) => a.id === 'truth').disabled, false);
  assert.equal(s.act('dare').actions[1].sub.de, 'trink {s:5}');
});

test('Aufgabe aussortieren ersetzt sie durch eine neue derselben Art', () => {
  const { s } = start(['mild'], 13);
  const task = s.act('dare');
  const replaced = s.skip();
  assert.equal(replaced.kind, 'task');
  assert.equal(replaced.type, 'dare');
  assert.equal(replaced.who, task.who);
  assert.notEqual(replaced.id, task.id);
  for (let i = 0; i < 40; i++) {
    s.act('done');
    assert.notEqual(s.act('dare').id, task.id);
  }
});

test('Rückblick zählt Pflichten, Wahrheiten und Verweigerungen', () => {
  const { s } = start();
  s.act('dare'); s.act('done'); // Anna
  s.act('dare'); s.act('refused'); // Ben
  s.act('truth'); s.act('done'); // Cem
  s.act('dare'); s.act('done'); // Anna
  assert.equal(s.played(), 4);
  const sum = Object.fromEntries(s.summary().map((r) => [r.key, r]));
  assert.deepEqual(sum.dare, { key: 'dare', n: 2, names: ['Anna'] });
  assert.deepEqual(sum.truth, { key: 'truth', n: 1, names: ['Cem'] });
  assert.deepEqual(sum.refused, { key: 'refused', n: 1, names: ['Ben'] });
});

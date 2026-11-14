import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../js/games/mostlikely/game.js';
import { seededRng } from '../js/core/random.js';

const tr = (s) => ({ de: s, en: s });
const meta = {
  texts: {
    duel: tr('Duell'),
    voting: tr('Stimmabgabe'),
    result: tr('Ergebnis'),
    winner: tr('{p1} trinkt {s:{n}}'),
    tie: tr('Gleichstand – alle trinken {s:{n}}'),
    drinks: tr('trinkt {s:{n}}'),
  },
};
const make = (cat, n) => Array.from({ length: n }, (_, i) => ({ id: `${cat}-${i}`, cat, de: `${cat} ${i}`, en: `${cat} ${i}` }));
const content = { questions: [...make('mild', 20), ...make('party', 20), ...make('spicy', 20)] };
const players = [
  { id: 'a', name: 'Anna', gender: 'f' },
  { id: 'b', name: 'Ben', gender: 'm' },
  { id: 'c', name: 'Cem', gender: 'm' },
  { id: 'd', name: 'Dana', gender: 'f' },
];
const session = (options = {}, cats = ['mild', 'party'], seed = 1) =>
  createSession({ content, players, categories: cats, meta, options, rng: seededRng(seed) });

test('Zeigen: jede Frage einmal, Duelle mit genau zwei Personen, Ende nach der letzten Frage', () => {
  const s = session();
  let card = s.next();
  const ids = [];
  let duels = 0;
  while (card) {
    assert.equal(card.kind, 'question');
    ids.push(card.id);
    if (card.who) {
      duels++;
      assert.equal(card.vote.candidates.length, 2);
    } else assert.equal(card.vote.candidates.length, 4);
    assert.equal(s.next(), null, 'ohne Abstimmung geht es nicht weiter');
    card = s.act('vote', [card.vote.candidates[0].id]);
  }
  assert.equal(new Set(ids).size, 40);
  assert.ok(duels >= 4 && duels <= 7, `Duelle: ${duels}`);
  assert.equal(s.finished(), true);
  assert.equal(s.played(), 40);
});

test('Zeigen: Badge mit eingestellten Schlucken, keine Duelle wenn ausgeschaltet', () => {
  const s = session({ duels: false, sips: 4 });
  let card = s.next();
  assert.equal(card.vote.badge.de, 'trinkt {s:4}');
  while (card) {
    assert.equal(card.who, undefined);
    card = s.act('vote', []);
  }
});

test('Geheim: alle stimmen nacheinander ab, dann kommt das Ergebnis', () => {
  const s = session({ vote: 'secret', duels: false, sips: 3 });
  let card = s.next();
  const voters = [];
  const votesFor = ['b', 'b', 'c', 'b'];
  for (const v of votesFor) {
    assert.equal(card.kind, 'vote');
    voters.push(card.who);
    card = s.act(v);
  }
  assert.deepEqual(voters, ['Anna', 'Ben', 'Cem', 'Dana']);
  assert.equal(card.kind, 'result');
  assert.deepEqual(card.winners, ['b']);
  assert.equal(card.players[0].name, 'Ben');
  assert.equal(card.text.de, '{p1} trinkt {s:3}');
  assert.deepEqual(card.chart.map((c) => [c.label, c.value]), [['Ben', 3], ['Cem', 1], ['Anna', 0], ['Dana', 0]]);
  const nextQuestion = s.next();
  assert.equal(nextQuestion.kind, 'vote');
  assert.equal(nextQuestion.who, 'Anna');
  assert.notEqual(nextQuestion.id, card.id);
});

test('Geheim: Gleichstand', () => {
  const s = session({ vote: 'secret', duels: false });
  s.next();
  let card;
  for (const v of ['a', 'b', 'a', 'b']) card = s.act(v);
  assert.deepEqual(card.winners.sort(), ['a', 'b']);
  assert.equal(card.text.de, 'Gleichstand – alle trinken {s:2}');
});

test('Zurückblättern und anders abstimmen ersetzt den weiteren Verlauf', () => {
  const s = session({ vote: 'secret', duels: false });
  const first = s.next();
  const second = s.act('a');
  s.act('a');
  assert.equal(s.prev(), second);
  assert.equal(s.prev(), first);
  assert.equal(s.act('a'), second, 'gleiche Wahl: weiter im bestehenden Verlauf');
  s.prev();
  const changed = s.act('b');
  assert.notEqual(changed, second);
  assert.deepEqual(changed.votes, { a: 'b' });
  assert.equal(s.next(), null);
});

test('Spicy-Duelle sind bei „immer gemischt“ immer gemischt', () => {
  const s = session({ pairing: 'always' }, ['spicy'], 5);
  let card = s.next();
  let duels = 0;
  while (card) {
    if (card.who) {
      duels++;
      const g = card.vote.candidates.map((c) => players.find((p) => p.id === c.id).gender);
      assert.notEqual(g[0], g[1]);
    }
    card = s.act('vote', []);
  }
  assert.ok(duels > 0);
});

test('Frage aussortieren springt zur nächsten', () => {
  const s = session({ vote: 'secret', duels: false });
  const first = s.next();
  s.act('a');
  const skipped = s.skip();
  assert.notEqual(skipped.id, first.id);
  assert.equal(skipped.who, 'Anna');
  assert.equal(s.canGoBack(), false);
});

test('Rückblick: am häufigsten gewählt und Unschuldsengel', () => {
  const s = session({ duels: false });
  s.next();
  s.act('vote', ['a']);
  s.act('vote', ['a', 'b']);
  s.act('vote', ['c']);
  const sum = Object.fromEntries(s.summary().map((r) => [r.key, r]));
  assert.deepEqual(sum.picked, { key: 'picked', n: 2, names: ['Anna'] });
  assert.deepEqual(sum.spared, { key: 'spared', n: 0, names: ['Dana'] });
});

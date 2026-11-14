import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatcher, canFill } from '../js/core/matching.js';
import { seededRng } from '../js/core/random.js';

const group = (spec) => [...spec].map((g, i) => ({ id: `p${i}`, name: `P${i}`, gender: g }));

test('zieht nie dieselbe Person zweimal für eine Karte', () => {
  const m = createMatcher(group('mfmf'), seededRng(1));
  for (let i = 0; i < 200; i++) {
    const [a, b] = m.pick({ count: 2 });
    assert.notEqual(a.id, b.id);
  }
});

test('vermeidet dieselben Personen direkt hintereinander', () => {
  const m = createMatcher(group('mmffm'), seededRng(2));
  let prev = m.pick({ count: 1 });
  for (let i = 0; i < 300; i++) {
    const cur = m.pick({ count: 1 });
    assert.notEqual(cur[0].id, prev[0].id);
    prev = cur;
  }
});

test('verteilt die Auswahl gleichmäßig', () => {
  const players = group('mmmfff');
  const m = createMatcher(players, seededRng(3));
  for (let i = 0; i < 600; i++) m.pick({ count: 1 });
  const counts = [...m.picks.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 2, `ungleich verteilt: ${counts}`);
});

test('bildet gemischte Paare in etwa 80 % der Fälle', () => {
  const m = createMatcher(group('mmmfff'), seededRng(4));
  let mixedPairs = 0;
  const runs = 3000;
  for (let i = 0; i < runs; i++) {
    const [a, b] = m.pick({ count: 2, mixed: true });
    if (a.gender !== b.gender) mixedPairs++;
  }
  const share = mixedPairs / runs;
  assert.ok(share > 0.75 && share < 0.85, `Anteil gemischt: ${share}`);
});

test('kommt mit nur einem Geschlecht zurecht', () => {
  const m = createMatcher(group('fff'), seededRng(5));
  for (let i = 0; i < 50; i++) {
    const pair = m.pick({ count: 2, mixed: true });
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0].id, pair[1].id);
  }
});

test('mit nur einer Frau wird trotzdem passend gemischt', () => {
  const m = createMatcher(group('mmmf'), seededRng(6));
  for (let i = 0; i < 100; i++) {
    const pair = m.pick({ count: 2, mixed: true });
    assert.equal(new Set(pair.map((p) => p.id)).size, 2);
  }
});

test('ohne Mischregel ist das Geschlecht egal', () => {
  const m = createMatcher(group('mmmfff'), seededRng(7));
  let mixedPairs = 0;
  for (let i = 0; i < 2000; i++) {
    const [a, b] = m.pick({ count: 2 });
    if (a.gender !== b.gender) mixedPairs++;
  }
  // zufällig gezogen: 9 von 15 möglichen Paaren sind gemischt (60 %)
  assert.ok(mixedPairs / 2000 > 0.5 && mixedPairs / 2000 < 0.7);
});

test('feste Geschlechter pro Platz werden eingehalten', () => {
  const m = createMatcher(group('mmmf'), seededRng(8));
  for (let i = 0; i < 50; i++) {
    const [a, b] = m.pick({ count: 2, slots: ['any', 'f'] });
    assert.equal(b.gender, 'f');
    assert.notEqual(a.id, b.id);
  }
  assert.equal(m.pick({ count: 2, slots: ['f', 'f'] }), null);
});

test('canFill prüft Personenzahl, Geschlechter und Plätze', () => {
  const players = group('mmf');
  assert.ok(canFill(players, { players: 3 }));
  assert.ok(!canFill(players, { players: 4 }));
  assert.ok(canFill(players, { needs: { m: 1, f: 1 } }));
  assert.ok(!canFill(group('mmm'), { needs: { m: 1, f: 1 } }));
  assert.ok(!canFill(players, { players: 2, slots: ['f', 'f'] }));
});

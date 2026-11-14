import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../js/games/never/game.js';
import { seededRng } from '../js/core/random.js';

const makeCards = (cat, n) =>
  Array.from({ length: n }, (_, i) => ({ id: `${cat}-${i}`, cat, de: `${cat} ${i}`, en: `${cat} ${i}` }));

const content = {
  cards: [...makeCards('mild', 30), ...makeCards('party', 30), ...makeCards('spicy', 30)],
  specials: [
    { id: 'g1', cat: 'general', players: 1, de: '{p1} trinkt.', en: '{p1} drinks.' },
    { id: 'g2', cat: 'general', needs: { m: 1, f: 1 }, de: 'Alle Frauen trinken.', en: 'All women drink.' },
    { id: 's1', cat: 'spicy', players: 2, match: 'mixed', de: '{p1} und {p2}', en: '{p1} and {p2}' },
  ],
};
const players = [
  { id: 'a', name: 'Anna', gender: 'f' },
  { id: 'b', name: 'Ben', gender: 'm' },
  { id: 'c', name: 'Cem', gender: 'm' },
];

function playAll(session) {
  const out = [];
  let card;
  while ((card = session.next())) out.push(card);
  return out;
}

test('spielt jede Aussage der gewählten Kategorien genau einmal', () => {
  const s = createSession({ content, players, categories: ['mild', 'party'], rng: seededRng(1) });
  assert.equal(s.total, 60);
  const statements = playAll(s).filter((c) => c.kind === 'statement');
  assert.equal(statements.length, 60);
  assert.equal(new Set(statements.map((c) => c.id)).size, 60);
  assert.ok(statements.every((c) => c.theme === 'mild' || c.theme === 'party'));
});

test('Sonderkarten kommen etwa jede 8.–10. Karte', () => {
  const s = createSession({ content, players, categories: ['mild', 'party', 'spicy'], rng: seededRng(2) });
  const all = playAll(s);
  let run = 0;
  for (const c of all) {
    if (c.kind === 'special') {
      assert.ok(run >= 7 && run <= 9, `Abstand ${run}`);
      run = 0;
    } else run++;
  }
  assert.ok(all.some((c) => c.kind === 'special'));
});

test('Spicy-Sonderkarten nur mit Spicy-Kategorie', () => {
  const s = createSession({ content, players, categories: ['mild', 'party'], rng: seededRng(3) });
  assert.ok(playAll(s).every((c) => c.id !== 's1'));
  const s2 = createSession({ content, players, categories: ['spicy'], rng: seededRng(3) });
  const spicyCards = playAll(s2).filter((c) => c.id === 's1');
  assert.ok(spicyCards.length > 0);
  assert.ok(spicyCards.every((c) => c.theme === 'spicySpecial' && c.players.length === 2));
});

test('geschlechtsbezogene Karten nur bei passender Runde', () => {
  const men = players.filter((p) => p.gender === 'm');
  const s = createSession({ content, players: men, categories: ['mild', 'party', 'spicy'], rng: seededRng(4) });
  assert.ok(playAll(s).every((c) => c.id !== 'g2'));
});

test('Zurück zeigt dieselbe Karte mit denselben Namen, Weiter danach wieder die nächste', () => {
  const s = createSession({ content, players, categories: ['mild'], rng: seededRng(5) });
  const seen = [];
  for (let i = 0; i < 12; i++) seen.push(s.next());
  assert.equal(s.prev(), seen[10]);
  assert.equal(s.prev(), seen[9]);
  assert.equal(s.next(), seen[10]);
  assert.equal(s.next(), seen[11]);
  assert.notEqual(s.next(), seen[11]);
});

test('am Anfang gibt es kein Zurück', () => {
  const s = createSession({ content, players, categories: ['mild'], rng: seededRng(6) });
  s.next();
  assert.equal(s.canGoBack(), false);
  assert.equal(s.prev(), null);
});

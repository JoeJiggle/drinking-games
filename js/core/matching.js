// Spieler-Matching: wählt Personen für Karten aus.
// - fair: wer oft dran war, wird seltener gezogen
// - nicht direkt hintereinander dieselben Personen, wenn es sich vermeiden lässt
// - Paare auf Wunsch geschlechtergemischt (Standard 80 %), sonst gleichgeschlechtlich
// - feste Geschlechter pro Platz über `slots`, z. B. ["f", "any"]
import { weightedPick } from './random.js';

const other = (g) => (g === 'm' ? 'f' : 'm');

export function genderCounts(players) {
  const counts = { m: 0, f: 0 };
  for (const p of players) counts[p.gender] = (counts[p.gender] || 0) + 1;
  return counts;
}

// Kann diese Karte mit der aktuellen Runde gespielt werden?
export function canFill(players, card) {
  const count = card.players || 0;
  if (players.length < count) return false;
  const have = genderCounts(players);
  for (const [g, n] of Object.entries(card.needs || {})) {
    if ((have[g] || 0) < n) return false;
  }
  const need = { m: 0, f: 0 };
  for (const s of card.slots || []) if (s === 'm' || s === 'f') need[s]++;
  return need.m <= have.m && need.f <= have.f;
}

export function createMatcher(players, rng = Math.random, { mixedShare = 0.8 } = {}) {
  const picks = new Map(players.map((p) => [p.id, 0]));
  let previous = new Set();

  function choose(candidates) {
    const fresh = candidates.filter((p) => !previous.has(p.id));
    const pool = fresh.length ? fresh : candidates;
    const min = Math.min(...pool.map((p) => picks.get(p.id)));
    const weights = pool.map((p) => 1 / (1 + picks.get(p.id) - min) ** 2);
    return weightedPick(pool, weights, rng);
  }

  function pick({ count = 0, slots = [], mixed = false } = {}) {
    if (count === 0) return [];
    if (players.length < count) return null;
    const want = Array.from({ length: count }, (_, i) => slots[i] || 'any');
    const taken = new Set();
    const free = (g) => players.filter((p) => !taken.has(p.id) && (g === 'any' || p.gender === g));
    let chosen;

    if (mixed && count === 2 && want.every((s) => s === 'any')) {
      const a = choose(free('any'));
      taken.add(a.id);
      const preferred = free(rng() < mixedShare ? other(a.gender) : a.gender);
      const b = choose(preferred.length ? preferred : free('any'));
      chosen = [a, b];
    } else {
      // Plätze mit festem Geschlecht zuerst besetzen, die Reihenfolge der Plätze bleibt erhalten
      chosen = new Array(count);
      const order = want.map((_, i) => i).sort((i, j) => (want[i] === 'any') - (want[j] === 'any'));
      for (const i of order) {
        const candidates = free(want[i]);
        if (!candidates.length) return null;
        chosen[i] = choose(candidates);
        taken.add(chosen[i].id);
      }
    }

    for (const p of chosen) picks.set(p.id, picks.get(p.id) + 1);
    previous = new Set(chosen.map((p) => p.id));
    return chosen;
  }

  return { pick, picks };
}

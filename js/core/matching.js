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

  // `fixed`: Personen, die schon feststehen (z. B. wer gerade dran ist) – sie belegen die ersten Plätze
  function pick({ count = 0, slots = [], mixed = false, fixed = [] } = {}) {
    if (count === 0) return [];
    if (players.length < count) return null;
    const want = Array.from({ length: count }, (_, i) => slots[i] || 'any');
    if (fixed.some((p, i) => want[i] !== 'any' && p.gender !== want[i])) return null;
    const chosen = new Array(count);
    const taken = new Set();
    fixed.forEach((p, i) => {
      chosen[i] = p;
      taken.add(p.id);
    });
    const free = (g) => players.filter((p) => !taken.has(p.id) && (g === 'any' || p.gender === g));

    if (mixed && count === 2 && want.every((s) => s === 'any')) {
      if (!chosen[0]) {
        chosen[0] = choose(free('any'));
        taken.add(chosen[0].id);
      }
      if (!chosen[1]) {
        const preferred = free(rng() < mixedShare ? other(chosen[0].gender) : chosen[0].gender);
        chosen[1] = choose(preferred.length ? preferred : free('any'));
      }
    } else {
      // Plätze mit festem Geschlecht zuerst besetzen, die Reihenfolge der Plätze bleibt erhalten
      const open = want
        .map((_, i) => i)
        .filter((i) => !chosen[i])
        .sort((i, j) => (want[i] === 'any') - (want[j] === 'any'));
      for (const i of open) {
        const candidates = free(want[i]);
        if (!candidates.length) return null;
        chosen[i] = choose(candidates);
        taken.add(chosen[i].id);
      }
    }

    for (const p of chosen.slice(fixed.length)) picks.set(p.id, picks.get(p.id) + 1);
    previous = new Set(chosen.map((p) => p.id));
    return chosen;
  }

  return { pick, picks };
}

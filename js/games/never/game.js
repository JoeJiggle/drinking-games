// Spiel „Ich hab noch nie“ – Spiellogik ohne DOM (wird mit Node getestet)
import { shuffle, randInt } from '../../core/random.js';
import { createMatcher, canFill } from '../../core/matching.js';

export async function loadContent(base) {
  const load = async (file) => {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`${file}: ${res.status}`);
    return (await res.json()).cards;
  };
  const [cards, specials] = await Promise.all([load('cards.json'), load('specials.json')]);
  return { cards, specials };
}

// Nach wie vielen Aussagen eine Sonderkarte kommt (sie ist dann etwa jede 8.–10. Karte)
export const specialGap = (rng) => randInt(7, 9, rng);

export function createSession({ content, players, categories, rng = Math.random }) {
  const cats = new Set(categories);
  const spicy = cats.has('spicy');
  const deck = shuffle(content.cards.filter((c) => cats.has(c.cat)), rng);
  const pool = content.specials.filter((s) => (s.cat === 'spicy' ? spicy : true) && canFill(players, s));
  const matcher = createMatcher(players, rng);

  const history = [];
  let pos = -1;
  let shown = 0;
  let untilSpecial = specialGap(rng);
  let specialDeck = [];
  let lastSpecialId = null;

  function drawSpecial() {
    if (!pool.length) return null;
    if (!specialDeck.length) {
      specialDeck = shuffle(pool, rng);
      // Nach dem Neumischen nicht dieselbe Karte direkt nochmal
      if (specialDeck.length > 1 && specialDeck[0].id === lastSpecialId) specialDeck.push(specialDeck.shift());
    }
    const card = specialDeck.shift();
    const chosen = matcher.pick({
      count: card.players || 0,
      slots: card.slots,
      mixed: spicy && card.match === 'mixed',
    });
    if (!chosen) return null;
    lastSpecialId = card.id;
    return {
      kind: 'special',
      id: card.id,
      theme: card.cat === 'spicy' ? 'spicySpecial' : 'special',
      text: { de: card.de, en: card.en },
      players: chosen.map((p) => ({ name: p.name, gender: p.gender })),
      number: shown,
    };
  }

  function next() {
    if (pos < history.length - 1) return history[++pos];
    let card = null;
    if (untilSpecial <= 0 && shown < deck.length) {
      card = drawSpecial();
      untilSpecial = specialGap(rng);
    }
    if (!card) {
      if (shown >= deck.length) return null;
      const c = deck[shown++];
      untilSpecial--;
      card = { kind: 'statement', id: c.id, theme: c.cat, text: { de: c.de, en: c.en }, players: [], number: shown };
    }
    history.push(card);
    pos = history.length - 1;
    return card;
  }

  function prev() {
    return pos > 0 ? history[--pos] : null;
  }

  return {
    next,
    prev,
    total: deck.length,
    canGoBack: () => pos > 0,
    played: () => history.length,
  };
}

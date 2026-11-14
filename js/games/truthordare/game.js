// Spiel „Wahrheit oder Pflicht“ – Spiellogik ohne DOM (wird mit Node getestet)
//
// Ablauf: Wahl-Karte („Anna, Wahrheit oder Pflicht?“) → Aufgaben-Karte → nächste Person (reihum).
// Nach zweimal Wahrheit hintereinander muss dieselbe Person Pflicht nehmen.
import { shuffle } from '../../core/random.js';
import { createMatcher, canFill } from '../../core/matching.js';

export async function loadContent(base) {
  const load = async (file) => {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`${file}: ${res.status}`);
    return (await res.json()).cards;
  };
  const [truths, dares] = await Promise.all([load('truths.json'), load('dares.json')]);
  return { truths, dares };
}

const fillN = (obj, n) => Object.fromEntries(Object.entries(obj).map(([l, s]) => [l, s.replace('{n}', n)]));

export function createSession({ content, players, categories, meta, rng = Math.random }) {
  const cats = new Set(categories);
  const spicy = cats.has('spicy');
  const texts = meta.texts;
  const penalty = { truth: 2, dare: 3, ...meta.penalty };
  const usable = (c) => cats.has(c.cat) && canFill(players, { ...c, players: c.players || 1 });
  const pools = { truth: content.truths.filter(usable), dare: content.dares.filter(usable) };
  const decks = { truth: [], dare: [] };
  const lastId = { truth: null, dare: null };
  const matcher = createMatcher(players, rng);

  const history = [];
  let pos = -1;

  // Nächste Aufgabe ziehen; jede Karte kommt erst wieder, wenn alle durch sind
  function draw(type, active) {
    const pool = pools[type];
    for (let tries = 0; tries < pool.length * 2; tries++) {
      if (!decks[type].length) {
        decks[type] = shuffle(pool, rng);
        if (decks[type].length > 1 && decks[type][0].id === lastId[type]) decks[type].push(decks[type].shift());
      }
      const card = decks[type].shift();
      const chosen = matcher.pick({
        count: card.players || 1,
        slots: card.slots,
        mixed: spicy && card.match === 'mixed',
        fixed: [active],
      });
      if (!chosen) {
        decks[type].push(card); // passt gerade nicht (z. B. Geschlecht), später nochmal
        continue;
      }
      lastId[type] = card.id;
      return { card, chosen };
    }
    return null;
  }

  // Muss diese Person Pflicht nehmen? (ihre letzten beiden Wahlen waren Wahrheit)
  function mustDare(playerId) {
    const own = history.slice(0, pos + 1).filter((c) => c.kind === 'choice' && c.playerId === playerId);
    const last = own.slice(-2).map((c) => c.outcome);
    return last.length === 2 && last.every((o) => o === 'truth');
  }

  function choiceCard() {
    const turn = history.slice(0, pos + 1).filter((c) => c.kind === 'choice').length;
    const active = players[turn % players.length];
    const forced = mustDare(active.id) && pools.dare.length > 0;
    return {
      kind: 'choice',
      theme: 'choice',
      playerId: active.id,
      round: Math.floor(turn / players.length) + 1,
      text: forced ? texts.forced : texts.choice,
      players: [{ name: active.name, gender: active.gender }],
      actions: [
        { id: 'truth', label: texts.truth, style: 'truth', disabled: forced || !pools.truth.length },
        { id: 'dare', label: texts.dare, style: 'dare', disabled: !pools.dare.length },
      ],
      outcome: null,
    };
  }

  function taskCard(choice, type) {
    const active = players.find((p) => p.id === choice.playerId);
    const drawn = draw(type, active);
    if (!drawn) return choiceCard();
    const { card, chosen } = drawn;
    return {
      kind: 'task',
      type,
      id: card.id,
      theme: card.cat,
      label: texts[type],
      who: active.name,
      playerId: active.id,
      round: choice.round,
      timer: card.timer,
      text: { de: card.de, en: card.en },
      players: chosen.map((p) => ({ name: p.name, gender: p.gender })),
      actions: [
        { id: 'done', label: texts.done, style: 'primary' },
        { id: 'refused', label: texts.refused, sub: fillN(texts.drink, penalty[type]), style: 'secondary' },
      ],
      outcome: null,
    };
  }

  function next() {
    if (!history.length) {
      history.push(choiceCard());
      pos = 0;
      return history[0];
    }
    return pos < history.length - 1 ? history[++pos] : null;
  }

  function prev() {
    return pos > 0 ? history[--pos] : null;
  }

  // Eine Aktion auf der aktuellen Karte ausführen. Nach dem Zurückblättern ersetzt
  // eine andere Entscheidung alles, was danach kam.
  function act(id) {
    const card = history[pos];
    if (!card?.actions?.some((a) => a.id === id && !a.disabled)) return null;
    if (card.outcome === id && pos < history.length - 1) return history[++pos];
    history.length = pos + 1;
    card.outcome = id;
    history.push(card.kind === 'choice' ? taskCard(card, id) : choiceCard());
    return history[++pos];
  }

  function summary() {
    const stats = new Map(players.map((p) => [p.id, { name: p.name, truth: 0, dare: 0, refused: 0 }]));
    for (const c of history) {
      if (c.kind !== 'task' || !c.outcome) continue;
      const s = stats.get(c.playerId);
      if (c.outcome === 'refused') s.refused++;
      else s[c.type]++;
    }
    const all = [...stats.values()];
    return ['dare', 'truth', 'refused']
      .map((key) => {
        const n = Math.max(0, ...all.map((s) => s[key]));
        return n ? { key, n, names: all.filter((s) => s[key] === n).map((s) => s.name) } : null;
      })
      .filter(Boolean);
  }

  return {
    next,
    prev,
    act,
    summary,
    total: null,
    canGoBack: () => pos > 0,
    played: () => history.filter((c) => c.kind === 'task' && c.outcome).length,
    finished: () => false,
  };
}

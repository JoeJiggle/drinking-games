// Spiel „Wahrheit oder Pflicht“ – Spiellogik ohne DOM (wird mit Node getestet)
//
// Ablauf: Wahl-Karte („Anna, Wahrheit oder Pflicht?“) → Aufgaben-Karte → nächste Person.
// Optionen (Einstellungen): Reihenfolge reihum/zufällig, Pflicht nach zweimal Wahrheit, Schlucke beim Verweigern.
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

const MIXED_SHARE = { mostly: 0.8, always: 1 };

// {n} in den Beschriftungen wird zum Schluck-Platzhalter, damit die Trinkstärke greift
const withSips = (obj, n) => Object.fromEntries(Object.entries(obj).map(([l, s]) => [l, s.replace('{n}', `{s:${n}}`)]));

export function createSession({ content, players, categories, meta, options = {}, rng = Math.random }) {
  const cats = new Set(categories);
  const spicy = cats.has('spicy');
  const texts = meta.texts;
  const opt = { order: 'turns', forceDare: true, penaltyTruth: 2, penaltyDare: 3, pairing: 'mostly', ...options };
  const penalty = { truth: opt.penaltyTruth, dare: opt.penaltyDare };
  const mixedShare = MIXED_SHARE[opt.pairing];
  const usable = (c) => cats.has(c.cat) && canFill(players, { ...c, players: c.players || 1 });
  const pools = { truth: content.truths.filter(usable), dare: content.dares.filter(usable) };
  const decks = { truth: [], dare: [] };
  const lastId = { truth: null, dare: null };
  const matcher = createMatcher(players, rng, { mixedShare: mixedShare ?? 0 });
  const roundOrders = [];

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
        mixed: spicy && card.match === 'mixed' && mixedShare !== undefined,
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

  // Reihenfolge einer Runde: reihum wie in der Spielerliste oder jede Runde neu gemischt
  function orderOf(round) {
    if (opt.order !== 'random') return players;
    while (roundOrders.length <= round) {
      const order = shuffle(players, rng);
      const prevRound = roundOrders[roundOrders.length - 1];
      // Niemand zweimal direkt hintereinander über die Rundengrenze
      if (prevRound && order.length > 1 && order[0].id === prevRound[prevRound.length - 1].id) order.push(order.shift());
      roundOrders.push(order);
    }
    return roundOrders[round];
  }

  // Muss diese Person Pflicht nehmen? (ihre letzten beiden Wahlen waren Wahrheit)
  function mustDare(playerId) {
    if (!opt.forceDare) return false;
    const own = history.slice(0, pos + 1).filter((c) => c.kind === 'choice' && c.playerId === playerId);
    const last = own.slice(-2).map((c) => c.outcome);
    return last.length === 2 && last.every((o) => o === 'truth');
  }

  function choiceCard() {
    const turn = history.slice(0, pos + 1).filter((c) => c.kind === 'choice').length;
    const round = Math.floor(turn / players.length);
    const active = orderOf(round)[turn % players.length];
    const forced = mustDare(active.id) && pools.dare.length > 0;
    return {
      kind: 'choice',
      theme: 'choice',
      playerId: active.id,
      round: round + 1,
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
        { id: 'refused', label: texts.refused, sub: withSips(texts.drink, penalty[type]), style: 'secondary' },
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

  // Aktuelle Aufgabe aussortieren und durch eine neue derselben Art ersetzen
  function skip() {
    const card = history[pos];
    if (card?.kind !== 'task') return null;
    pools[card.type] = pools[card.type].filter((c) => c.id !== card.id);
    decks[card.type] = decks[card.type].filter((c) => c.id !== card.id);
    history.length = pos;
    pos--;
    history.push(pools[card.type].length ? taskCard(history[pos], card.type) : choiceCard());
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
    skip,
    summary,
    total: null,
    canGoBack: () => pos > 0,
    played: () => history.filter((c) => c.kind === 'task' && c.outcome).length,
    finished: () => false,
  };
}

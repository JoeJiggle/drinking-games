// Spiel „Wer würde eher …?“ – Spiellogik ohne DOM (wird mit Node getestet)
//
// Abstimmung „Zeigen“: Alle zeigen gleichzeitig, dann werden die Gewählten auf der Karte angetippt.
// Abstimmung „Geheim“: Das Handy geht reihum, jede Person tippt geheim einen Namen, danach kommt das Ergebnis.
// Duelle: Ab und zu stehen nur zwei Personen zur Wahl (im Spicy-Preset bevorzugt gemischt).
import { shuffle, randInt } from '../../core/random.js';
import { createMatcher } from '../../core/matching.js';

export async function loadContent(base) {
  const res = await fetch(base + 'questions.json');
  if (!res.ok) throw new Error(`questions.json: ${res.status}`);
  return { questions: (await res.json()).cards };
}

const MIXED_SHARE = { mostly: 0.8, always: 1 };
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function createSession({ content, players, categories, meta, options = {}, rng = Math.random }) {
  const opt = { vote: 'point', sips: 2, duels: true, pairing: 'mostly', ...options };
  const cats = new Set(categories);
  const deck = shuffle(content.questions.filter((c) => cats.has(c.cat)), rng);
  const mixedShare = MIXED_SHARE[opt.pairing];
  const matcher = createMatcher(players, rng, { mixedShare: mixedShare ?? 0 });
  const fill = (obj) => Object.fromEntries(Object.entries(obj).map(([l, s]) => [l, s.replaceAll('{n}', String(opt.sips))]));
  const texts = Object.fromEntries(Object.entries(meta.texts).map(([k, v]) => [k, fill(v)]));

  // Welche Fragen als Duell gespielt werden (etwa jede 6.–8. Frage), Paare werden einmal ausgelost
  const duelAt = new Set();
  if (opt.duels && players.length > 2) {
    for (let q = randInt(4, 6, rng); q < deck.length; q += randInt(5, 7, rng)) duelAt.add(q);
  }
  const duelPairs = new Map();
  function duelPair(q) {
    if (!duelPairs.has(q)) {
      const mixed = deck[q].cat === 'spicy' && mixedShare !== undefined;
      duelPairs.set(q, matcher.pick({ count: 2, mixed }));
    }
    return duelPairs.get(q);
  }

  const history = [];
  let pos = -1;
  let done = false;

  // Erste Karte zu Frage q
  function questionCard(q) {
    if (q >= deck.length) return null;
    const c = deck[q];
    const duel = duelAt.has(q) ? duelPair(q) : null;
    const candidates = (duel || players).map((p) => ({ id: p.id, name: p.name }));
    const base = {
      id: c.id,
      q,
      number: q + 1,
      theme: c.cat,
      text: { de: c.de, en: c.en },
      players: [],
      candidates,
      duel: Boolean(duel),
    };
    if (opt.vote === 'secret') return voteCard(base, 0, {});
    return {
      ...base,
      kind: 'question',
      label: duel ? texts.duel : undefined,
      who: duel ? `${duel[0].name} vs. ${duel[1].name}` : undefined,
      vote: { multi: true, candidates, badge: texts.drinks },
      outcome: null,
    };
  }

  function voteCard(base, voterIndex, votes) {
    return {
      ...base,
      kind: 'vote',
      base,
      voterIndex,
      votes,
      label: base.duel ? texts.duel : texts.voting,
      who: players[voterIndex].name,
      vote: { multi: false, candidates: base.candidates },
      outcome: null,
    };
  }

  function resultCard(base, votes) {
    const tally = base.candidates
      .map((c) => ({ id: c.id, name: c.name, votes: Object.values(votes).filter((v) => v === c.id).length }))
      .sort((a, b) => b.votes - a.votes);
    const max = tally[0].votes;
    const winners = tally.filter((t) => t.votes === max);
    const winner = players.find((p) => p.id === winners[0].id);
    return {
      id: base.id,
      q: base.q,
      number: base.number,
      theme: base.theme,
      kind: 'result',
      label: texts.result,
      text: winners.length === 1 ? texts.winner : texts.tie,
      players: [{ name: winner.name, gender: winner.gender }],
      chart: tally.map((t) => ({ label: t.name, value: t.votes, highlight: t.votes === max })),
      winners: winners.map((w) => w.id),
    };
  }

  function push(card) {
    if (!card) {
      done = true;
      return null;
    }
    history.push(card);
    pos = history.length - 1;
    return card;
  }

  function next() {
    if (!history.length) return push(questionCard(0));
    if (pos < history.length - 1) return history[++pos];
    const current = history[pos];
    // Fragen und Stimmabgaben brauchen erst eine Abstimmung
    return current.kind === 'result' ? push(questionCard(current.q + 1)) : null;
  }

  function prev() {
    return pos > 0 ? history[--pos] : null;
  }

  // Abstimmen. „Zeigen“: act('vote', [ids]). „Geheim“: act(id) für die Person, die gerade abstimmt.
  // Nach dem Zurückblättern ersetzt eine andere Wahl alles, was danach kam.
  function act(id, payload) {
    const card = history[pos];
    if (!card) return null;
    const valid = (x) => card.vote?.candidates.some((c) => c.id === x);

    if (card.kind === 'question' && id === 'vote') {
      const ids = (payload || []).filter(valid);
      if (card.outcome && sameSet(card.outcome, ids) && pos < history.length - 1) return history[++pos];
      history.length = pos + 1;
      card.outcome = ids;
      return push(questionCard(card.q + 1));
    }
    if (card.kind === 'vote' && valid(id)) {
      if (card.outcome === id && pos < history.length - 1) return history[++pos];
      history.length = pos + 1;
      card.outcome = id;
      const votes = { ...card.votes, [players[card.voterIndex].id]: id };
      const last = card.voterIndex + 1 >= players.length;
      return push(last ? resultCard(card.base, votes) : voteCard(card.base, card.voterIndex + 1, votes));
    }
    return null;
  }

  // Aktuelle Frage aussortieren und zur nächsten springen
  function skip() {
    const card = history[pos];
    if (!card?.id) return null;
    const start = history.findIndex((c) => c.q === card.q);
    history.length = start;
    pos = start - 1;
    return push(questionCard(card.q + 1));
  }

  // Wer wurde wie oft gewählt (bei Gleichstand zählen alle mit den meisten Stimmen)
  function picks() {
    const count = new Map(players.map((p) => [p.id, 0]));
    for (const c of history) {
      const chosen = c.kind === 'question' ? c.outcome : c.kind === 'result' ? c.winners : null;
      for (const id of chosen || []) count.set(id, count.get(id) + 1);
    }
    return count;
  }

  function summary() {
    const count = picks();
    const all = players.map((p) => ({ name: p.name, n: count.get(p.id) }));
    const max = Math.max(...all.map((s) => s.n));
    const min = Math.min(...all.map((s) => s.n));
    const rows = [];
    if (max > 0) rows.push({ key: 'picked', n: max, names: all.filter((s) => s.n === max).map((s) => s.name) });
    if (max > min) rows.push({ key: 'spared', n: min, names: all.filter((s) => s.n === min).map((s) => s.name) });
    return rows;
  }

  return {
    next,
    prev,
    act,
    skip,
    summary,
    total: deck.length,
    canGoBack: () => pos > 0,
    played: () => history.filter((c) => (c.kind === 'question' && c.outcome) || c.kind === 'result').length,
    finished: () => done,
  };
}

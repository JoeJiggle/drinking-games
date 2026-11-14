// Spiel „Party-Mix“ – Spiellogik ohne DOM (wird mit Node getestet)
//
// Ein gemischter Stapel aus Kartentypen (type):
//   task  Aufgabe für bestimmte Personen      all   „Alle, die …“
//   rule  Regel, die eine Weile gilt – danach kommt automatisch eine „Regel vorbei“-Karte (Text in "end")
//   game  Mini-Spiel                          duel  Duell zwischen zwei Personen
//   vote  Zeige-Abstimmung
// Die Spiellänge begrenzt die Zahl der Karten; höchstens zwei Regeln gelten gleichzeitig.
import { shuffle, randInt } from '../../core/random.js';
import { createMatcher, canFill } from '../../core/matching.js';

export async function loadContent(base) {
  const res = await fetch(base + 'cards.json');
  if (!res.ok) throw new Error(`cards.json: ${res.status}`);
  return { cards: (await res.json()).cards };
}

export const LENGTHS = { short: 25, normal: 40, long: 60 };
const MAX_RULES = 2;
const MIXED_SHARE = { mostly: 0.8, always: 1 };

export function createSession({ content, players, categories, meta, options = {}, rng = Math.random }) {
  const opt = { length: 'normal', rules: true, pairing: 'mostly', ...options };
  const cats = new Set(categories);
  const spicy = cats.has('spicy');
  const typeOf = (c) => c.type || 'task';
  let pool = shuffle(
    content.cards.filter((c) => cats.has(c.cat) && (opt.rules || typeOf(c) !== 'rule') && canFill(players, c)),
    rng,
  );
  const total = Math.min(LENGTHS[opt.length] || LENGTHS.normal, pool.length);
  const mixedShare = MIXED_SHARE[opt.pairing];
  const matcher = createMatcher(players, rng, { mixedShare: mixedShare ?? 0 });
  const typeLabel = (type) => meta?.themes?.[type]?.label;

  const history = [];
  let pos = -1;
  let drawn = 0;
  let done = false;
  let active = []; // laufende Regeln: { endAt, card, source }

  // Nächste Karte aus dem Stapel: keine dritte gleichzeitige Regel, nicht zweimal derselbe Sondertyp hintereinander
  function draw() {
    const lastType = history.length ? history[history.length - 1].type : null;
    const allowed = (c) => !(typeOf(c) === 'rule' && active.length >= MAX_RULES);
    const varied = (c) => allowed(c) && (typeOf(c) === 'task' || typeOf(c) !== lastType);
    while (pool.length) {
      let i = pool.findIndex(varied);
      if (i < 0) i = pool.findIndex(allowed);
      if (i < 0) return null;
      const [c] = pool.splice(i, 1);
      const chosen = matcher.pick({
        count: c.players || 0,
        slots: c.slots,
        mixed: spicy && c.match === 'mixed' && mixedShare !== undefined,
      });
      if (!chosen) continue;
      drawn++;
      const type = typeOf(c);
      const people = chosen.map((p) => ({ name: p.name, gender: p.gender }));
      const card = {
        kind: 'card',
        id: c.id,
        type,
        theme: c.cat === 'spicy' ? 'spicy' : type,
        label: c.cat === 'spicy' ? typeLabel(type) : undefined,
        number: drawn,
        text: { de: c.de, en: c.en },
        players: people,
      };
      if (type === 'rule' && c.end) {
        active.push({
          endAt: drawn + randInt(6, 10, rng),
          source: card,
          card: { kind: 'ruleEnd', ruleId: c.id, type: 'ruleEnd', theme: 'ruleEnd', text: { de: c.end.de, en: c.end.en }, players: people },
        });
      }
      return card;
    }
    return null;
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
    if (pos < history.length - 1) return history[++pos];
    // Ist eine Regel abgelaufen? Dann zuerst deren Ende ansagen
    const due = active.findIndex((a) => a.endAt <= drawn);
    if (due >= 0 && drawn < total) {
      const [rule] = active.splice(due, 1);
      return push({ ...rule.card, number: drawn });
    }
    if (drawn >= total) return push(null);
    return push(draw());
  }

  function prev() {
    return pos > 0 ? history[--pos] : null;
  }

  // Aktuelle Karte aussortieren (eine Regel endet dann sofort) und weiterblättern
  function skip() {
    const card = history[pos];
    if (card) active = active.filter((a) => a.source !== card);
    return next();
  }

  // Wer stand am häufigsten auf den Karten?
  function summary() {
    const count = new Map(players.map((p) => [p.name, 0]));
    for (const c of history) if (c.kind === 'card') for (const p of c.players) count.set(p.name, (count.get(p.name) || 0) + 1);
    const max = Math.max(0, ...count.values());
    if (!max) return [];
    return [{ key: 'spotlight', n: max, names: [...count].filter(([, n]) => n === max).map(([name]) => name) }];
  }

  return {
    next,
    prev,
    skip,
    summary,
    total,
    canGoBack: () => pos > 0,
    played: () => history.filter((c) => c.kind === 'card').length,
    finished: () => done,
  };
}

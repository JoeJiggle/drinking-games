// Liste aller Spiele. Ein neues Spiel:
//   1. Ordner content/games/<id>/ mit game.json (und Kartendateien)
//   2. bei Bedarf eigene Logik in js/games/<id>/game.js
//   3. hier eintragen (status 'active' oder 'soon') – und neue Dateien in sw.js aufnehmen
//
// Die Beschreibung (Name, Farbe, Regeln, Optionen …) steht in content/games/<id>/game.json.
import { pick } from '../i18n.js';

export const GAMES = [
  { id: 'never', status: 'active', load: () => import('./never/game.js') },
  { id: 'truthordare', status: 'active', load: () => import('./truthordare/game.js') },
  { id: 'mostlikely', status: 'active', load: () => import('./mostlikely/game.js') },
  { id: 'partymix', status: 'active', load: () => import('./partymix/game.js') },
];

const base = (id) => `content/games/${id}/`;

// Regeltext mit den Sätzen, die nur bei bestimmten Optionen gelten (game.json: "rulesIf")
// Schlüssel "duels" = Option eingeschaltet, "vote=secret" = Option hat genau diesen Wert
export function rulesText(game, options = {}) {
  const applies = (cond) => {
    const [key, value] = cond.split('=');
    return value === undefined ? Boolean(options[key]) && options[key] !== 'off' : String(options[key]) === value;
  };
  const extra = Object.entries(game.meta.rulesIf || {})
    .filter(([cond]) => applies(cond))
    .map(([, text]) => pick(text));
  return [pick(game.meta.rules), ...extra].join(' ');
}

export async function loadRegistry() {
  await Promise.all(
    GAMES.map(async (g) => {
      const res = await fetch(base(g.id) + 'game.json');
      g.meta = await res.json();
      // Farben und Beschriftungen für Karten: Kategorien + Sonderkarten
      g.meta.themes = {
        ...Object.fromEntries(
          (g.meta.categories || []).map((c) => [c.id, { color: c.color, color2: c.color2, label: c.name, icon: c.icon }]),
        ),
        ...(g.meta.themes || {}),
      };
    }),
  );
}

export const getGames = () => GAMES;
export const getGame = (id) => GAMES.find((g) => g.id === id);

// Lädt Spiellogik und Karten beim ersten Bedarf (danach aus dem Speicher)
export async function prepareGame(game) {
  game.module ??= await game.load();
  game.content ??= await game.module.loadContent(base(game.id));
  return game;
}

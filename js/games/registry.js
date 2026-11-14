// Liste aller Spiele. Ein neues Spiel:
//   1. Ordner content/games/<id>/ mit game.json (und Kartendateien)
//   2. bei Bedarf eigene Logik in js/games/<id>/game.js
//   3. hier eintragen (status 'active' oder 'soon') – und neue Dateien in sw.js aufnehmen
//
// Die Beschreibung (Name, Farbe, Regeln …) steht in content/games/<id>/game.json.

export const GAMES = [
  { id: 'never', status: 'active', load: () => import('./never/game.js') },
  { id: 'partymix', status: 'soon' },
  { id: 'mostlikely', status: 'soon' },
  { id: 'truthordare', status: 'soon' },
];

const base = (id) => `content/games/${id}/`;

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

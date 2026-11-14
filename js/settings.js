// Einstellungen (auf dem Gerät gespeichert)
import { get, set } from './db.js';

export const DEFAULTS = {
  keepAwake: true,
  hideSpicy: false,
  strength: 'normal', // light | normal | strong
  pairing: 'mostly', // mostly | always | any
  theme: 'auto', // auto | light | dark
  bigText: false,
  reduceMotion: false,
  games: {}, // Spieloptionen pro Spiel, z. B. { never: { specials: 'rare' } }
};

let values = { ...DEFAULTS };

export async function loadSettings() {
  const saved = (await get('settings', null)) || {};
  values = { ...DEFAULTS, ...saved, games: { ...(saved.games || {}) } };
  applyDisplay();
}

export const setting = (key) => values[key];

export function setSetting(key, value) {
  values = { ...values, [key]: value };
  save();
  applyDisplay();
}

// Spieloptionen: Definitionen stehen in game.json unter "options"
export function gameOptions(game) {
  const saved = values.games[game.id] || {};
  return Object.fromEntries((game.meta.options || []).map((o) => [o.key, o.key in saved ? saved[o.key] : o.default]));
}

export function setGameOption(gameId, key, value) {
  values = { ...values, games: { ...values.games, [gameId]: { ...values.games[gameId], [key]: value } } };
  save();
}

function save() {
  set('settings', values).catch(() => {});
}

export function applyDisplay() {
  const root = document.documentElement;
  if (values.theme === 'light' || values.theme === 'dark') root.dataset.theme = values.theme;
  else delete root.dataset.theme;
  root.classList.toggle('big-text', Boolean(values.bigText));
  root.classList.toggle('reduce-motion', Boolean(values.reduceMotion));
}

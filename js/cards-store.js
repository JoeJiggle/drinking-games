// Eigene Karten, aussortierte Karten und Datum der letzten Sicherung (auf dem Gerät gespeichert)
import { get, set } from './db.js';
import { applyBackup } from './core/backup.js';

let custom = [];
let hidden = new Set();
let lastBackup = null;

export async function loadCardStore() {
  const [c, h, b] = await Promise.all([get('customCards', []), get('hiddenCards', []), get('lastBackup', null)]);
  custom = Array.isArray(c) ? c : [];
  hidden = new Set(Array.isArray(h) ? h : []);
  lastBackup = b;
}

const key = (gameId, cardId) => `${gameId}/${cardId}`;
const saveHidden = () => set('hiddenCards', [...hidden]).catch(() => {});
const saveCustom = () => set('customCards', custom).catch(() => {});

export const isHidden = (gameId, cardId) => hidden.has(key(gameId, cardId));
export const hiddenCount = () => hidden.size;

export function hideCard(gameId, cardId) {
  hidden.add(key(gameId, cardId));
  saveHidden();
}

export function unhideCard(gameId, cardId) {
  hidden.delete(key(gameId, cardId));
  saveHidden();
}

export function clearHidden() {
  hidden = new Set();
  saveHidden();
}

export const getCustom = (gameId) => (gameId ? custom.filter((c) => c.game === gameId) : custom);

export function addCustom({ game, list, cat, text }) {
  const card = { id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), game, list, cat, text: text.trim() };
  custom = [...custom, card];
  saveCustom();
  return card;
}

export function removeCustom(id) {
  custom = custom.filter((c) => c.id !== id);
  saveCustom();
}

export const getLastBackup = () => lastBackup;

export function markBackup(date = new Date()) {
  lastBackup = date.toISOString();
  set('lastBackup', lastBackup).catch(() => {});
}

export const backupData = () => ({ customCards: custom, hiddenCards: [...hidden] });

export function restoreBackup(incoming, mode) {
  const next = applyBackup(backupData(), incoming, mode);
  custom = next.customCards;
  hidden = new Set(next.hiddenCards);
  saveCustom();
  saveHidden();
}

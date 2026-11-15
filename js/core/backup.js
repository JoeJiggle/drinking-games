// Sicherung eigener und aussortierter Karten als JSON-Datei (ohne DOM, getestet)
//
// Format 1: { app: "schwips", format: 1, exported, customCards: [...], hiddenCards: [...] }
// Neue Formate bekommen eine höhere Nummer; ältere bleiben über MIGRATIONS importierbar.
//
// Beim Einlesen wird alles streng geprüft: nur bekannte Spiele, Listen und Kategorien,
// gültige Texte (Länge, Platzhalter), begrenzte Anzahl. Ungültiges wird übersprungen.
import { checkCustomText } from './custom.js';

export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 1_000_000;
const MAX_CARDS = 2000;
const MAX_HIDDEN = 5000;
const CUSTOM_ID = /^c-[a-z0-9]{1,30}$/;
const HIDDEN_KEY = /^([a-z0-9]{1,30})\/([A-Za-z0-9-]{1,60})$/;

const MIGRATIONS = {
  // 2: (data) => ({ ...data, format: 2, ... }),
};

export function createBackup({ customCards, hiddenCards }, now = new Date()) {
  return { app: 'schwips', format: BACKUP_FORMAT, exported: now.toISOString(), customCards, hiddenCards };
}

// allowed: { [spielId]: { cats: ['mild', …], lists: { [liste]: maxPersonen } } }
function validCard(c, allowed) {
  if (!c || typeof c !== 'object') return false;
  const { id, game, list, cat, text } = c;
  if (typeof id !== 'string' || !CUSTOM_ID.test(id)) return false;
  const rules = typeof game === 'string' && Object.hasOwn(allowed, game) ? allowed[game] : null;
  if (!rules || typeof list !== 'string' || !Object.hasOwn(rules.lists, list)) return false;
  if (typeof cat !== 'string' || !rules.cats.includes(cat)) return false;
  return typeof text === 'string' && checkCustomText(text, rules.lists[list]) === null;
}

export function parseBackup(text, allowed) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('invalid');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('invalid');
  }
  if (!data || data.app !== 'schwips' || !Number.isInteger(data.format) || data.format < 1 || data.format > BACKUP_FORMAT) {
    throw new Error('invalid');
  }
  for (let v = data.format + 1; v <= BACKUP_FORMAT; v++) data = MIGRATIONS[v](data);

  const rawCards = Array.isArray(data.customCards) ? data.customCards : [];
  const rawHidden = Array.isArray(data.hiddenCards) ? data.hiddenCards : [];
  const ids = new Set();
  const customCards = [];
  for (const c of rawCards) {
    if (customCards.length >= MAX_CARDS) break;
    if (!validCard(c, allowed) || ids.has(c.id)) continue;
    ids.add(c.id);
    // Nur bekannte Felder übernehmen
    customCards.push({ id: c.id, game: c.game, list: c.list, cat: c.cat, text: c.text.trim() });
  }
  const hiddenCards = [
    ...new Set(
      rawHidden.filter((k) => typeof k === 'string' && HIDDEN_KEY.test(k) && Object.hasOwn(allowed, k.split('/')[0])),
    ),
  ].slice(0, MAX_HIDDEN);

  const skipped = rawCards.length - customCards.length + (rawHidden.length - hiddenCards.length);
  return { customCards, hiddenCards, skipped };
}

// mode: 'merge' behält Vorhandenes und ergänzt Neues, 'replace' ersetzt alles
export function applyBackup(current, incoming, mode) {
  if (mode === 'replace') return { customCards: [...incoming.customCards], hiddenCards: [...incoming.hiddenCards] };
  const ids = new Set(current.customCards.map((c) => c.id));
  return {
    customCards: [...current.customCards, ...incoming.customCards.filter((c) => !ids.has(c.id))],
    hiddenCards: [...new Set([...current.hiddenCards, ...incoming.hiddenCards])],
  };
}

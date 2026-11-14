// Spielerliste (wird für alle Spiele genutzt und auf dem Gerät gespeichert)
import { get, set } from './db.js';

const MAX_NAME = 20;
let list = [];

export async function loadPlayers() {
  const saved = await get('players', []);
  list = Array.isArray(saved)
    ? saved.filter((p) => p && typeof p.name === 'string' && (p.gender === 'm' || p.gender === 'f'))
    : [];
}

export const getPlayers = () => list;

const clean = (raw) => String(raw ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
const taken = (name, exceptId) =>
  list.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === name.toLocaleLowerCase());
const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function save() {
  set('players', list).catch(() => {});
}

export function addPlayer(raw, gender) {
  const name = clean(raw);
  if (!name) return { ok: false, error: 'empty' };
  if (taken(name)) return { ok: false, error: 'duplicate' };
  list = [...list, { id: newId(), name, gender }];
  save();
  return { ok: true };
}

export function renamePlayer(id, raw) {
  const name = clean(raw);
  if (!name) return { ok: false, error: 'empty' };
  if (taken(name, id)) return { ok: false, error: 'duplicate' };
  list = list.map((p) => (p.id === id ? { ...p, name } : p));
  save();
  return { ok: true };
}

export function toggleGender(id) {
  list = list.map((p) => (p.id === id ? { ...p, gender: p.gender === 'm' ? 'f' : 'm' } : p));
  save();
}

export function removePlayer(id) {
  const index = list.findIndex((p) => p.id === id);
  if (index < 0) return null;
  const player = list[index];
  list = list.filter((p) => p.id !== id);
  save();
  return { player, index };
}

export function restorePlayer(player, index) {
  if (list.some((p) => p.id === player.id)) return;
  list = [...list.slice(0, index), player, ...list.slice(index)];
  save();
}

export function clearPlayers() {
  list = [];
  save();
}

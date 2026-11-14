// Sicherung eigener und aussortierter Karten als JSON-Datei (ohne DOM, getestet)
//
// Format 1: { app: "schwips", format: 1, exported, customCards: [...], hiddenCards: [...] }
// Neue Formate bekommen eine höhere Nummer; ältere bleiben über MIGRATIONS importierbar.

export const BACKUP_FORMAT = 1;

const MIGRATIONS = {
  // 2: (data) => ({ ...data, format: 2, ... }),
};

export function createBackup({ customCards, hiddenCards }, now = new Date()) {
  return { app: 'schwips', format: BACKUP_FORMAT, exported: now.toISOString(), customCards, hiddenCards };
}

const validCard = (c) =>
  c && typeof c.id === 'string' && typeof c.game === 'string' && typeof c.list === 'string' &&
  typeof c.cat === 'string' && typeof c.text === 'string' && c.text.trim();

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('invalid');
  }
  if (!data || data.app !== 'schwips' || !Number.isInteger(data.format) || data.format > BACKUP_FORMAT) {
    throw new Error('invalid');
  }
  for (let v = data.format + 1; v <= BACKUP_FORMAT; v++) data = MIGRATIONS[v](data);
  return {
    customCards: (Array.isArray(data.customCards) ? data.customCards : []).filter(validCard),
    hiddenCards: (Array.isArray(data.hiddenCards) ? data.hiddenCards : []).filter((k) => typeof k === 'string'),
  };
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

// Kleiner IndexedDB-Wrapper (Schlüssel/Wert-Speicher)
//
// DB_VERSION     – Struktur (Stores, Indizes). Erhöhen, wenn sich Stores ändern, und in onupgradeneeded ergänzen.
// SCHEMA_VERSION – Datenformat. Erhöhen und in MIGRATIONS einen Schritt ergänzen, wenn sich gespeicherte Daten ändern.
// Den Datenbanknamen NIE ändern, sonst sind alle gespeicherten Daten weg.

const DB_NAME = 'drinkinggames';
export const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;
const STORE = 'kv';

// Schrittweise Migration: Schlüssel = Zielversion
const MIGRATIONS = {
  // 2: async () => { const p = await get('players', []); await set('players', p.map(...)); },
};

let dbPromise = null;
let memory = null; // Ersatz, falls IndexedDB nicht verfügbar ist (z. B. privater Modus)

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blockiert'));
  });
}

function tx(mode, fn) {
  return dbPromise.then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function initDb() {
  try {
    dbPromise = open();
    await dbPromise;
  } catch {
    memory = new Map();
    return;
  }
  const current = (await get('schemaVersion', 0)) || 0;
  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    if (MIGRATIONS[v]) await MIGRATIONS[v]();
  }
  if (current !== SCHEMA_VERSION) await set('schemaVersion', SCHEMA_VERSION);
}

export async function get(key, fallback = null) {
  if (memory) return memory.has(key) ? memory.get(key) : fallback;
  try {
    const value = await tx('readonly', (s) => s.get(key));
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

// Löscht alle gespeicherten Daten (Datenbank selbst bleibt bestehen)
export async function clearAll() {
  if (memory) {
    memory.clear();
    return;
  }
  await tx('readwrite', (s) => s.clear());
}

export async function set(key, value) {
  if (memory) {
    memory.set(key, value);
    return;
  }
  await tx('readwrite', (s) => s.put(value, key));
}

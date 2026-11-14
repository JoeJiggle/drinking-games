// Sprache: Oberflächentexte aus content/ui.<sprache>.json, Spielinhalte als { de, en }
import { set } from './db.js';

export const LANGS = ['de', 'en'];
const dicts = {};
let lang = 'de';

export const DEFAULT_LANG = 'en';

export async function initI18n(saved) {
  await Promise.all(
    LANGS.map(async (l) => {
      const res = await fetch(`content/ui.${l}.json`);
      dicts[l] = await res.json();
    }),
  );
  lang = LANGS.includes(saved) ? saved : DEFAULT_LANG;
  document.documentElement.lang = lang;
}

export const getLang = () => lang;

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  document.documentElement.lang = l;
  set('lang', l).catch(() => {});
}

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));

export function t(key, vars) {
  const s = dicts[lang]?.[key] ?? dicts.de?.[key] ?? key;
  return fill(s, vars);
}

// Einzahl/Mehrzahl: schlägt "<key>.one" bzw. "<key>.other" nach
export function tn(key, n, vars = {}) {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}

// Zweisprachige Inhalte aus den Spieldateien
export function pick(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.de ?? '';
}

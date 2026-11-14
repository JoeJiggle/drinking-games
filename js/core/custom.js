// Eigene und aussortierte Karten in die Kartensätze eines Spiels einrechnen (ohne DOM, getestet)
import { inspectText } from './placeholders.js';

// Eigene Karte: { id, game, list, cat, text } – list ist der Name der Kartenliste im Spiel (z. B. "cards", "dares")
export function toCard(custom) {
  const { maxPlayer } = inspectText(custom.text);
  const card = { id: custom.id, cat: custom.cat, de: custom.text, en: custom.text, custom: true };
  if (maxPlayer > 0) card.players = maxPlayer;
  if (maxPlayer >= 2 && custom.cat === 'spicy') card.match = 'mixed';
  return card;
}

export function mergeCustom(content, customCards) {
  const out = Object.fromEntries(Object.entries(content).map(([k, list]) => [k, [...list]]));
  for (const c of customCards) if (out[c.list]) out[c.list].push(toCard(c));
  return out;
}

export function removeHidden(content, isHidden) {
  return Object.fromEntries(Object.entries(content).map(([k, list]) => [k, list.filter((c) => !isHidden(c.id))]));
}

// Prüft den Text einer eigenen Karte. maxPlayers: wie viele Personen-Platzhalter erlaubt sind (0 = keine)
export function checkCustomText(text, maxPlayers) {
  const clean = String(text ?? '').trim();
  if (!clean) return 'empty';
  const { maxPlayer, errors } = inspectText(clean);
  if (errors.length || maxPlayer > maxPlayers) return 'placeholder';
  return null;
}

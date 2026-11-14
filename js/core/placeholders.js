// Platzhalter in Kartentexten
//
//   {p1}                    Name von Person 1 (entsprechend {p2}, {p3} …)
//   {p1:er|sie}             Wortform je nach Geschlecht von Person 1: links männlich, rechts weiblich
//                           z. B. {p2:ihm|ihr}, {p1:sein|ihr}, {p1:der Jüngste|die Jüngste}, {p1:him|her}
//   {s:2}                   Anzahl Schlucke – wird mit der eingestellten Trinkstärke umgerechnet
//   {s:3|Schluck|Schlucke}  Anzahl mit passender Einzahl/Mehrzahl, z. B. „1 Schluck“ / „5 Schlucke“

const PATTERN = /\{(?:p(\d+)(?::([^{}|]*)\|([^{}|]*))?|s:(\d+)(?:\|([^{}|]*)\|([^{}|]*))?)\}/g;

// Trinkstärke: leicht = etwa die Hälfte, hart = etwa das Anderthalbfache (immer mindestens 1)
export function scaleSips(n, strength = 'normal') {
  if (strength === 'light') return Math.max(1, Math.ceil(n / 2));
  if (strength === 'strong') return Math.max(n + 1, Math.round(n * 1.5));
  return n;
}

// Zerlegt den Text in Teile, damit die Oberfläche Namen hervorheben kann.
export function renderParts(text, players = [], { strength = 'normal' } = {}) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[4] !== undefined) {
      const n = scaleSips(Number(m[4]), strength);
      const noun = m[5] === undefined ? '' : ` ${n === 1 ? m[5] : m[6]}`;
      parts.push({ type: 'text', value: `${n}${noun}` });
    } else {
      const player = players[Number(m[1]) - 1];
      if (m[2] === undefined) {
        parts.push({ type: 'name', value: player ? player.name : m[0] });
      } else {
        parts.push({ type: 'text', value: player?.gender === 'f' ? m[3] : m[2] });
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  // Benachbarte Textteile zusammenfassen
  return parts.reduce((out, p) => {
    const prev = out[out.length - 1];
    if (prev && prev.type === 'text' && p.type === 'text') prev.value += p.value;
    else out.push({ ...p });
    return out;
  }, []);
}

export function renderText(text, players = [], options) {
  return renderParts(text, players, options).map((p) => p.value).join('');
}

// Prüft einen Kartentext: welche Personen er braucht und ob es Tippfehler in Platzhaltern gibt.
export function inspectText(text) {
  let maxPlayer = 0;
  for (const m of text.matchAll(PATTERN)) if (m[1]) maxPlayer = Math.max(maxPlayer, Number(m[1]));
  const rest = text.replace(PATTERN, '');
  const errors = [];
  if (/[{}]/.test(rest)) errors.push('Ungültiger Platzhalter (Klammer ohne gültiges Muster)');
  if (/\{p0[:}]/.test(text)) errors.push('Personen werden ab 1 gezählt ({p1})');
  return { maxPlayer, errors };
}

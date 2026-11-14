// Platzhalter in Kartentexten
//
//   {p1}            Name von Person 1 (entsprechend {p2}, {p3} …)
//   {p1:er|sie}     Wortform je nach Geschlecht von Person 1: links männlich, rechts weiblich
//                   z. B. {p2:ihm|ihr}, {p1:sein|ihr}, {p1:der Jüngste|die Jüngste}, {p1:him|her}

const PATTERN = /\{p(\d+)(?::([^{}|]*)\|([^{}|]*))?\}/g;

// Zerlegt den Text in Teile, damit die Oberfläche Namen hervorheben kann.
export function renderParts(text, players = []) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    const player = players[Number(m[1]) - 1];
    if (m[2] === undefined) {
      parts.push({ type: 'name', value: player ? player.name : m[0] });
    } else {
      const value = player?.gender === 'f' ? m[3] : m[2];
      parts.push({ type: 'text', value });
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

export function renderText(text, players = []) {
  return renderParts(text, players).map((p) => p.value).join('');
}

// Prüft einen Kartentext: welche Personen er braucht und ob es Tippfehler in Platzhaltern gibt.
export function inspectText(text) {
  let maxPlayer = 0;
  for (const m of text.matchAll(PATTERN)) maxPlayer = Math.max(maxPlayer, Number(m[1]));
  const rest = text.replace(PATTERN, '');
  const errors = [];
  if (/[{}]/.test(rest)) errors.push('Ungültiger Platzhalter (Klammer ohne gültiges Muster)');
  if (/\{p0[:}]/.test(text)) errors.push('Personen werden ab 1 gezählt ({p1})');
  return { maxPlayer, errors };
}

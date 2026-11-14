// Kleine DOM-Helfer und Symbole

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
  gear: svg(
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.6"/>',
  ),
  pause: svg('<path d="M9 6v12M15 6v12"/>'),
  cards: svg('<rect x="3.5" y="6" width="11" height="15" rx="2.5"/><path d="M9 3.5l9.6 2.6a2.5 2.5 0 0 1 1.8 3l-2.9 10.6"/>'),
  people: svg(
    '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.6 3.1-5.6 6.2-5.6s5.6 2 6.2 5.6"/><circle cx="17" cy="9" r="2.6"/><path d="M16.4 14.5c2.6.2 4.3 1.9 4.8 4.9"/>',
  ),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
};

// Erzwingt ein Layout, damit eine anschließend gesetzte Klasse eine Übergangs-Animation auslöst
// (bewusst ohne requestAnimationFrame, das in ausgeblendeten Tabs nicht läuft)
export function reflow(el) {
  void el.offsetWidth;
}

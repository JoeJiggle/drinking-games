// Auswahl-Dialog von unten (z. B. „Zusammenführen“ / „Ersetzen“ / „Abbrechen“)
// Liefert den value des gewählten Knopfes oder null.
import { esc, reflow } from './dom.js';

export function choose({ title, text, buttons }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        ${text ? `<p class="sheet-rules">${esc(text)}</p>` : ''}
        ${buttons
          .map((b, i) => `<button class="sheet-btn${b.style ? ' ' + b.style : ''}" data-i="${i}">${esc(b.label)}</button>`)
          .join('')}
      </div>`;
    document.body.appendChild(wrap);
    reflow(wrap);
    wrap.classList.add('open');
    const close = (value) => {
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 250);
      resolve(value);
    };
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-i]');
      if (btn) close(buttons[Number(btn.dataset.i)].value ?? null);
      else if (e.target === wrap) close(null);
    });
  });
}

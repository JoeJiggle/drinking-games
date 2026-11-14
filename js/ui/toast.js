// Kurze Hinweise am unteren Rand, optional mit Knopf (z. B. „Rückgängig“)
import { esc, reflow } from './dom.js';

export function showToast({ id, text, action, onAction, duration = 4500, sticky = false }) {
  const root = document.getElementById('toast-root');
  if (id) root.querySelector(`[data-toast="${id}"]`)?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  if (id) el.dataset.toast = id;
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  root.appendChild(el);
  reflow(el);
  el.classList.add('show');

  let timer;
  const close = () => {
    clearTimeout(timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('button')?.addEventListener('click', () => {
    close();
    onAction?.();
  });
  if (!sticky) timer = setTimeout(close, duration);
  return close;
}

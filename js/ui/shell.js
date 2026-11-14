// Gemeinsamer Rahmen für normale Ansichten: Kopfzeile, Inhalt, optional Fußbereich und Tab-Leiste
import { t } from '../i18n.js';
import { go } from '../router.js';
import { esc, icons } from './dom.js';

const TABS = [
  { view: 'hub', key: 'tabs.games', icon: 'cards' },
  { view: 'players', key: 'tabs.players', icon: 'people' },
];

export function shell(root, { title, onBack, gear = true, tab, body, footer = '', accent }) {
  const accentStyle = accent ? ` style="--h1:${accent.color};--h2:${accent.color2}"` : '';
  root.innerHTML = `
    <header class="topbar${onBack ? ' has-back' : ''}"${accentStyle}>
      ${onBack ? `<button class="icon-btn" data-act="back" aria-label="${esc(t('common.back'))}">${icons.back}</button>` : ''}
      <h1>${esc(title)}</h1>
      ${gear ? `<button class="icon-btn" data-act="settings" aria-label="${esc(t('settings.title'))}">${icons.gear}</button>` : ''}
    </header>
    <main class="content${tab ? ' with-tabs' : ''}${footer ? ' with-footer' : ''}">${body}</main>
    ${footer}
    ${
      tab
        ? `<nav class="tabbar">${TABS.map(
            (x) => `<button data-tab="${x.view}"${x.view === tab ? ' aria-current="page"' : ''}>${icons[x.icon]}<span>${esc(t(x.key))}</span></button>`,
          ).join('')}</nav>`
        : ''
    }`;
  root.querySelector('[data-act=back]')?.addEventListener('click', onBack);
  root.querySelector('[data-act=settings]')?.addEventListener('click', () => go('settings'));
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.tab !== tab) go(b.dataset.tab);
    }),
  );
}

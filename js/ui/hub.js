// Startbildschirm: alle Spiele als große Karten
import { t, pick } from '../i18n.js';
import { go } from '../router.js';
import { getGames } from '../games/registry.js';
import { esc, icons } from './dom.js';
import { shell } from './shell.js';
import { showToast } from './toast.js';

export function hubView(root) {
  const cards = getGames()
    .map((g) => {
      const soon = g.status !== 'active';
      const m = g.meta;
      return `
      <button class="game-card${soon ? ' soon' : ''}" data-game="${g.id}" style="--c:${m.color};--c2:${m.color2}">
        <span class="game-icon" aria-hidden="true">${m.icon}</span>
        <span class="game-text">
          <span class="game-name">${esc(pick(m.name))}</span>
          <span class="game-tag">${esc(pick(m.tagline))}</span>
          ${soon ? `<span class="badge">${esc(t('hub.soon'))}</span>` : ''}
        </span>
        ${soon ? '' : `<span class="chev">${icons.next}</span>`}
      </button>`;
    })
    .join('');

  shell(root, {
    title: t('app.title'),
    tab: 'hub',
    body: `<p class="lead">${esc(t('hub.lead'))}</p><div class="game-list">${cards}</div>`,
  });

  root.querySelectorAll('[data-game]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const game = getGames().find((g) => g.id === btn.dataset.game);
      if (game.status === 'active') go('setup', { gameId: game.id });
      else showToast({ id: 'soon', text: t('hub.soonToast'), duration: 2000 });
    }),
  );
}

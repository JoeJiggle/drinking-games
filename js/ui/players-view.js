// Tab „Spieler“
import { t } from '../i18n.js';
import { esc } from './dom.js';
import { shell } from './shell.js';
import { mountPlayers } from './players-editor.js';

export function playersView(root) {
  shell(root, {
    title: t('players.title'),
    tab: 'players',
    body: `<p class="lead">${esc(t('players.lead'))}</p><div id="players-mount"></div>`,
  });
  mountPlayers(document.getElementById('players-mount'), { showClear: true });
}

// Spieler-Setup als wiederverwendbarer Baustein: im Tab „Spieler“ und vor jedem Spiel
import { t, tn } from '../i18n.js';
import { render } from '../router.js';
import { getPlayers, addPlayer, renamePlayer, toggleGender, removePlayer, restorePlayer, clearPlayers } from '../players.js';
import { esc, icons } from './dom.js';
import { showToast } from './toast.js';

const SYMBOL = { m: '♂︎', f: '♀︎' };

export function mountPlayers(el, { onChange = () => {}, showClear = false } = {}) {
  el.innerHTML = `
    <div class="add-box">
      <input id="pname" type="text" maxlength="20" placeholder="${esc(t('players.placeholder'))}"
        autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done">
      <div class="add-btns">
        <button class="add-btn g-m" data-g="m"><span aria-hidden="true">${SYMBOL.m}</span> ${esc(t('players.male'))}</button>
        <button class="add-btn g-f" data-g="f"><span aria-hidden="true">${SYMBOL.f}</span> ${esc(t('players.female'))}</button>
      </div>
      <p class="add-msg" id="pmsg" role="status"></p>
    </div>
    <p class="pcount" id="pcount"></p>
    <ul class="plist" id="plist"></ul>
    ${showClear ? `<button class="link-danger" id="pclear">${esc(t('players.clear'))}</button>` : ''}`;

  const input = el.querySelector('#pname');
  const msg = (text) => {
    const m = document.getElementById('pmsg');
    if (m) m.textContent = text;
  };

  el.querySelectorAll('.add-btn').forEach((btn) => {
    let keepKeyboard = false;
    // Tastatur offen lassen, damit man mehrere Namen hintereinander eintippen kann
    btn.addEventListener('pointerdown', (e) => {
      keepKeyboard = document.activeElement === input;
      if (keepKeyboard) e.preventDefault();
    });
    btn.addEventListener('click', () => {
      const res = addPlayer(input.value, btn.dataset.g);
      if (!res.ok) {
        msg(t(`players.err.${res.error}`));
        input.focus();
        return;
      }
      input.value = '';
      msg('');
      if (keepKeyboard) input.focus();
      update();
    });
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      msg(input.value.trim() ? t('players.pickGender') : t('players.err.empty'));
    }
  });
  el.querySelector('#pclear')?.addEventListener('click', () => {
    if (!getPlayers().length) return;
    if (window.confirm(t('players.clearConfirm'))) {
      clearPlayers();
      update();
    }
  });

  function update() {
    renderList();
    onChange();
  }

  function renderList() {
    const list = document.getElementById('plist');
    if (!list) return;
    const players = getPlayers();
    const count = document.getElementById('pcount');
    if (count) count.textContent = players.length ? tn('players.count', players.length) : '';
    const clear = document.getElementById('pclear');
    if (clear) clear.hidden = !players.length;

    list.innerHTML = players.length
      ? players
          .map(
            (p) => `
        <li class="prow" data-id="${esc(p.id)}">
          <input class="pn" value="${esc(p.name)}" maxlength="20" aria-label="${esc(t('players.placeholder'))}"
            autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done">
          <button class="gtoggle g-${p.gender}" data-act="gender"
            aria-label="${esc(t(p.gender === 'm' ? 'players.genderM' : 'players.genderF'))}">${SYMBOL[p.gender]}</button>
          <button class="del" data-act="del" aria-label="${esc(t('players.remove', { name: p.name }))}">${icons.close}</button>
        </li>`,
          )
          .join('')
      : `<li class="empty">${esc(t('players.empty'))}</li>`;

    list.querySelectorAll('.prow').forEach((row) => {
      const id = row.dataset.id;
      const nameInput = row.querySelector('.pn');
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur();
      });
      nameInput.addEventListener('change', () => {
        const res = renamePlayer(id, nameInput.value);
        if (!res.ok) {
          msg(t(`players.err.${res.error}`));
          nameInput.value = getPlayers().find((p) => p.id === id)?.name ?? '';
        } else msg('');
        onChange();
      });
      row.querySelector('[data-act=gender]').addEventListener('click', () => {
        toggleGender(id);
        update();
      });
      row.querySelector('[data-act=del]').addEventListener('click', () => {
        const removed = removePlayer(id);
        if (!removed) return;
        update();
        showToast({
          id: 'removed',
          text: t('players.removed', { name: removed.player.name }),
          action: t('players.undo'),
          onAction: () => {
            restorePlayer(removed.player, removed.index);
            render();
          },
        });
      });
    });
  }

  renderList();
}

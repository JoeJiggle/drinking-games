// Eigene Karten schreiben, löschen, sichern und wiederherstellen
import { t, tn, pick, getLang } from '../i18n.js';
import { go, render } from '../router.js';
import { getGames, getGame } from '../games/registry.js';
import { getCustom, addCustom, removeCustom, getLastBackup, markBackup, backupData, restoreBackup } from '../cards-store.js';
import { checkCustomText } from '../core/custom.js';
import { createBackup, parseBackup } from '../core/backup.js';
import { esc, icons } from './dom.js';
import { shell } from './shell.js';
import { showToast } from './toast.js';
import { choose } from './dialog.js';
import { visibleCategories } from './setup.js';

const REMIND_DAYS = 30;
const form = { game: null, list: null, cat: null, text: '' }; // bleibt beim Neuzeichnen erhalten

const editableGames = () => getGames().filter((g) => g.status === 'active' && g.meta.custom?.length);
const formatDate = (iso) => new Date(iso).toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-GB');

function seg(name, items, current) {
  return `
    <div class="seg" role="group" style="grid-template-columns:repeat(${items.length > 3 ? 2 : items.length},1fr)">
      ${items.map((i) => `<button data-${name}="${i.value}" aria-pressed="${i.value === current}">${esc(i.label)}</button>`).join('')}
    </div>`;
}

export function customView(root) {
  const games = editableGames();
  if (!games.some((g) => g.id === form.game)) form.game = games[0].id;
  const game = getGame(form.game);
  const lists = game.meta.custom;
  if (!lists.some((l) => l.list === form.list)) form.list = lists[0].list;
  const def = lists.find((l) => l.list === form.list);
  const cats = visibleCategories(game);
  if (!cats.some((c) => c.id === form.cat)) form.cat = cats[0].id;

  const all = getCustom();
  const mine = getCustom(game.id);
  const last = getLastBackup();
  const overdue = all.length > 0 && (!last || Date.now() - new Date(last).getTime() > REMIND_DAYS * 86400000);
  const listLabel = (list) => pick(lists.find((l) => l.list === list)?.label);
  const catOf = (id) => (game.meta.categories || []).find((c) => c.id === id);

  shell(root, {
    title: t('custom.title'),
    gear: false,
    onBack: () => go('settings'),
    body: `
      <p class="lead">${esc(t('custom.lead'))}</p>

      <h2 class="section">${esc(t('custom.new'))}</h2>
      <div class="group form">
        ${games.length > 1 ? `<label class="field-label">${esc(t('custom.game'))}</label>${seg('game', games.map((g) => ({ value: g.id, label: pick(g.meta.name) })), form.game)}` : ''}
        ${lists.length > 1 ? `<label class="field-label">${esc(t('custom.type'))}</label>${seg('list', lists.map((l) => ({ value: l.list, label: pick(l.label) })), form.list)}` : ''}
        <label class="field-label">${esc(t('custom.category'))}</label>
        ${seg('cat', cats.map((c) => ({ value: c.id, label: `${c.icon} ${pick(c.name)}` })), form.cat)}
        <label class="field-label" for="ctext">${esc(t('custom.text'))}</label>
        <textarea id="ctext" rows="3" maxlength="240" placeholder="${esc(t('custom.placeholder'))}">${esc(form.text)}</textarea>
        <p class="hint">${esc(pick(def.hint))}</p>
        <p class="add-msg" id="cmsg" role="status"></p>
        <button class="btn-primary" id="cadd" style="--c:${game.meta.color};--c2:${game.meta.color2}">${esc(t('custom.add'))}</button>
      </div>

      <h2 class="section">${esc(t('custom.list'))} · ${esc(pick(game.meta.name))}</h2>
      <ul class="plist">
        ${
          mine.length
            ? mine
                .map((c) => {
                  const cat = catOf(c.cat);
                  return `
              <li class="prow ccard">
                <div class="ccard-body">
                  <span class="ccard-meta">${esc(listLabel(c.list))} · ${cat ? `${cat.icon} ${esc(pick(cat.name))}` : esc(c.cat)}</span>
                  <span class="ccard-text">${esc(c.text)}</span>
                </div>
                <button class="del" data-del="${esc(c.id)}" aria-label="${esc(t('custom.delete'))}">${icons.close}</button>
              </li>`;
                })
                .join('')
            : `<li class="empty">${esc(t('custom.empty'))}</li>`
        }
      </ul>

      <h2 class="section">${esc(t('backup.title'))}</h2>
      <div class="group">
        <p>${esc(t('backup.text'))}</p>
        <p class="${overdue ? 'warn' : 'muted'}">${esc(last ? t('backup.last', { date: formatDate(last) }) : t('backup.never'))}${
          overdue && last ? ` – ${esc(t('backup.reminder'))}` : ''
        }</p>
        <div class="btn-row">
          <button class="btn-soft" id="bexport">${esc(t('backup.export'))}</button>
          <button class="btn-soft" id="bimport">${esc(t('backup.import'))}</button>
        </div>
        <input type="file" id="bfile" accept=".json,application/json" hidden>
      </div>`,
  });

  const text = document.getElementById('ctext');
  text.addEventListener('input', () => {
    form.text = text.value;
  });
  const pickSeg = (name, key) =>
    root.querySelectorAll(`[data-${name}]`).forEach((b) =>
      b.addEventListener('click', () => {
        form[key] = b.dataset[name];
        render();
      }),
    );
  pickSeg('game', 'game');
  pickSeg('list', 'list');
  pickSeg('cat', 'cat');

  document.getElementById('cadd').addEventListener('click', () => {
    const error = checkCustomText(form.text, def.maxPlayers ?? 0);
    if (error) {
      document.getElementById('cmsg').textContent = t(`custom.err.${error}`);
      return;
    }
    addCustom({ game: game.id, list: form.list, cat: form.cat, text: form.text });
    form.text = '';
    showToast({ id: 'custom', text: t('custom.added'), duration: 2000 });
    render();
  });

  root.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!window.confirm(t('custom.deleteConfirm'))) return;
      removeCustom(b.dataset.del);
      render();
    }),
  );

  document.getElementById('bexport').addEventListener('click', exportBackup);
  const file = document.getElementById('bfile');
  document.getElementById('bimport').addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    if (file.files?.[0]) importBackup(file.files[0]);
  });
}

async function exportBackup() {
  const date = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(createBackup(backupData()), null, 2);
  const name = `schwips-backup-${date}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  try {
    const shareFile = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [shareFile] })) {
      await navigator.share({ files: [shareFile], title: name });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    markBackup();
    showToast({ id: 'backup', text: t('backup.saved'), duration: 2500 });
    render();
  } catch (err) {
    if (err?.name !== 'AbortError') showToast({ id: 'backup', text: t('backup.failed') });
  }
}

async function importBackup(file) {
  let incoming;
  try {
    incoming = parseBackup(await file.text());
  } catch {
    showToast({ id: 'backup', text: t('backup.invalid') });
    return;
  }
  const mode = await choose({
    title: t('backup.importTitle'),
    text: tn('backup.importText', incoming.customCards.length),
    buttons: [
      { label: t('backup.merge'), value: 'merge', style: 'primary' },
      { label: t('backup.replace'), value: 'replace', style: 'danger' },
      { label: t('backup.cancel'), value: null },
    ],
  });
  if (!mode) return;
  restoreBackup(incoming, mode);
  showToast({ id: 'backup', text: t('backup.done'), duration: 2500 });
  render();
}

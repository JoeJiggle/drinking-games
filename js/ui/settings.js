// Einstellungen
import { APP_VERSION } from '../version.js';
import { t, tn, pick, LANGS, getLang, setLang } from '../i18n.js';
import { state, go, render } from '../router.js';
import { getGames } from '../games/registry.js';
import { setting, setSetting, gameOptions, setGameOption } from '../settings.js';
import { hiddenCount, clearHidden, getCustom } from '../cards-store.js';
import { clearAll } from '../db.js';
import { esc, icons } from './dom.js';
import { shell } from './shell.js';
import { showToast } from './toast.js';
import { checkForUpdates } from './update.js';

// ---------- Bausteine ----------
const hint = (text) => (text ? `<span class="row-hint">${esc(text)}</span>` : '');

function toggleRow(attrs, label, checked, hintText) {
  return `
    <label class="row">
      <span class="row-text"><span>${esc(label)}</span>${hint(hintText)}</span>
      <input type="checkbox" class="switch" ${attrs}${checked ? ' checked' : ''}>
    </label>`;
}

function segRow(attrs, label, choices, value, showLabel = true) {
  return `
    <div class="row column">
      ${showLabel ? `<span class="row-text"><span>${esc(label)}</span></span>` : ''}
      <div class="seg" role="group" aria-label="${esc(label)}" style="grid-template-columns:repeat(${choices.length},1fr)">
        ${choices.map((c) => `<button ${attrs} data-value="${c.value}" aria-pressed="${c.value === value}">${esc(c.label)}</button>`).join('')}
      </div>
    </div>`;
}

function stepperRow(attrs, label, value, min, max) {
  return `
    <div class="row">
      <span class="row-text"><span>${esc(label)}</span></span>
      <div class="stepper">
        <button ${attrs} data-step="-1" aria-label="−"${value <= min ? ' disabled' : ''}>−</button>
        <output>${value}</output>
        <button ${attrs} data-step="1" aria-label="+"${value >= max ? ' disabled' : ''}>+</button>
      </div>
    </div>`;
}

function linkRow(id, label, detail) {
  return `
    <button class="row link" id="${id}">
      <span class="row-text"><span>${esc(label)}</span></span>
      ${detail ? `<span class="row-detail">${esc(detail)}</span>` : ''}
      <span class="chev">${icons.next}</span>
    </button>`;
}

const choiceList = (prefix, values) => values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));

// Spieloptionen aus game.json
function gameOptionRows(game) {
  const values = gameOptions(game);
  return (game.meta.options || [])
    .map((o) => {
      const attrs = `data-game="${game.id}" data-opt="${o.key}"`;
      if (o.type === 'toggle') return toggleRow(attrs, pick(o.label), values[o.key]);
      if (o.type === 'stepper') return stepperRow(attrs, pick(o.label), values[o.key], o.min, o.max);
      return segRow(attrs, pick(o.label), o.choices.map((c) => ({ value: c.value, label: pick(c.label) })), values[o.key]);
    })
    .join('');
}

// ---------- Ansicht ----------
export function settingsView(root) {
  const games = getGames().filter((g) => g.status === 'active' && g.meta.options?.length);
  const hidden = hiddenCount();
  const custom = getCustom().length;

  shell(root, {
    title: t('settings.title'),
    gear: false,
    onBack: () => go(state.back || 'hub'),
    body: `
      <h2 class="section">${esc(t('settings.language'))}</h2>
      <div class="group">
        ${segRow('data-set="lang"', t('settings.language'), LANGS.map((l) => ({ value: l, label: t(`lang.${l}`) })), getLang(), false)}
      </div>

      <h2 class="section">${esc(t('settings.game'))}</h2>
      <div class="group">
        ${toggleRow('data-set="keepAwake"', t('settings.keepAwake'), setting('keepAwake'), t('settings.keepAwakeHint'))}
        ${toggleRow('data-set="hideSpicy"', t('settings.hideSpicy'), setting('hideSpicy'), t('settings.hideSpicyHint'))}
        ${segRow('data-set="strength"', t('settings.strength'), choiceList('strength', ['light', 'normal', 'strong']), setting('strength'))}
        ${setting('hideSpicy') ? '' : segRow('data-set="pairing"', t('settings.pairing'), choiceList('pairing', ['mostly', 'always', 'any']), setting('pairing'))}
      </div>

      ${games
        .map(
          (g) => `
        <h2 class="section">${g.meta.icon} ${esc(pick(g.meta.name))}</h2>
        <div class="group">${gameOptionRows(g)}</div>`,
        )
        .join('')}

      <h2 class="section">${esc(t('settings.display'))}</h2>
      <div class="group">
        ${segRow('data-set="theme"', t('settings.theme'), choiceList('theme', ['auto', 'light', 'dark']), setting('theme'))}
        ${toggleRow('data-set="bigText"', t('settings.bigText'), setting('bigText'))}
        ${toggleRow('data-set="reduceMotion"', t('settings.reduceMotion'), setting('reduceMotion'))}
      </div>

      <h2 class="section">${esc(t('settings.cards'))}</h2>
      <div class="group">
        ${linkRow('open-custom', t('settings.custom'), custom ? tn('settings.customCount', custom) : '')}
        <div class="row">
          <span class="row-text"><span>${esc(t('settings.hidden'))}</span>${hint(t('settings.hiddenHint'))}</span>
          <button class="btn-soft small" id="reset-hidden"${hidden ? '' : ' disabled'}>${esc(t('settings.hiddenReset'))} (${hidden})</button>
        </div>
      </div>

      <h2 class="section">${esc(t('settings.app'))}</h2>
      <div class="group">
        <button class="row link" id="check-update"><span class="row-text"><span>${esc(t('settings.checkUpdate'))}</span></span><span class="row-detail">${esc(APP_VERSION)}</span></button>
        <button class="row link danger" id="reset-all"><span class="row-text"><span>${esc(t('settings.reset'))}</span></span></button>
      </div>

      <h2 class="section">${esc(t('settings.about'))}</h2>
      <div class="group">
        <p>${esc(t('about.text'))}</p>
        <p>${esc(t('about.privacy'))}</p>
        <p class="muted">${esc(t('about.version', { v: APP_VERSION }))}</p>
      </div>`,
  });

  // Allgemeine Einstellungen
  root.querySelectorAll('[data-set]').forEach((el) => {
    const key = el.dataset.set;
    if (el.type === 'checkbox') {
      el.addEventListener('change', () => {
        setSetting(key, el.checked);
        render();
      });
    } else {
      el.addEventListener('click', () => {
        if (key === 'lang') setLang(el.dataset.value);
        else setSetting(key, el.dataset.value);
        render();
      });
    }
  });

  // Spieloptionen
  root.querySelectorAll('[data-opt]').forEach((el) => {
    const { game: gameId, opt } = el.dataset;
    const game = getGames().find((g) => g.id === gameId);
    const def = game.meta.options.find((o) => o.key === opt);
    const update = (value) => {
      setGameOption(gameId, opt, value);
      render();
    };
    if (el.type === 'checkbox') el.addEventListener('change', () => update(el.checked));
    else if (el.dataset.step) {
      el.addEventListener('click', () => {
        const current = gameOptions(game)[opt];
        update(Math.min(def.max, Math.max(def.min, current + Number(el.dataset.step))));
      });
    } else el.addEventListener('click', () => update(el.dataset.value));
  });

  document.getElementById('open-custom').addEventListener('click', () => go('custom'));
  document.getElementById('reset-hidden').addEventListener('click', () => {
    if (!window.confirm(t('settings.hiddenConfirm', { n: hiddenCount() }))) return;
    clearHidden();
    render();
  });
  document.getElementById('check-update').addEventListener('click', async () => {
    const result = await checkForUpdates();
    if (result === 'available') return; // Hinweis „Neu laden“ erscheint von selbst
    showToast({ id: 'check', text: t(`update.${result === 'current' ? 'current' : 'offline'}`, { v: APP_VERSION }) });
  });
  document.getElementById('reset-all').addEventListener('click', async () => {
    if (!window.confirm(t('settings.resetConfirm'))) return;
    await clearAll();
    location.reload();
  });
}

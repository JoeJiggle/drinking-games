// Vor dem Spiel: Regel, Kategorien (Mehrfachauswahl) und Spieler
import { t, tn, pick } from '../i18n.js';
import { state, go } from '../router.js';
import { getGame, prepareGame } from '../games/registry.js';
import { getPlayers } from '../players.js';
import { esc, icons } from './dom.js';
import { shell } from './shell.js';
import { mountPlayers } from './players-editor.js';
import { showToast } from './toast.js';

const chosen = {}; // gewählte Kategorien pro Spiel (nur für diese Sitzung)

function selection(game) {
  chosen[game.id] ??= new Set((game.meta.categories || []).filter((c) => c.default).map((c) => c.id));
  return chosen[game.id];
}

export function setupView(root) {
  const game = getGame(state.gameId);
  const m = game.meta;
  const sel = selection(game);
  prepareGame(game).catch(() => {}); // Karten schon im Hintergrund laden

  const cats = (m.categories || [])
    .map(
      (c) => `
      <button class="cat" data-cat="${c.id}" aria-pressed="${sel.has(c.id)}" style="--c:${c.color};--c2:${c.color2}">
        <span class="cat-icon" aria-hidden="true">${c.icon}</span>
        <span class="cat-text"><span class="cat-name">${esc(pick(c.name))}</span><span class="cat-desc">${esc(pick(c.desc))}</span></span>
        <span class="check">${icons.check}</span>
      </button>`,
    )
    .join('');

  shell(root, {
    title: pick(m.name),
    onBack: () => go('hub'),
    accent: m,
    body: `
      <div class="rules-box"><span class="rules-icon" aria-hidden="true">${m.icon}</span><p>${esc(pick(m.rules))}</p></div>
      <h2 class="section">${esc(t('setup.categories'))}</h2>
      <div class="cats">${cats}</div>
      <h2 class="section">${esc(t('setup.players'))}</h2>
      <div id="players-mount"></div>`,
    footer: `
      <div class="footer-cta">
        <p class="cta-hint" id="cta-hint"></p>
        <button class="btn-primary" id="start" style="--c:${m.color};--c2:${m.color2}">${esc(t('setup.start'))}</button>
      </div>`,
  });

  root.querySelectorAll('[data-cat]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.cat;
      if (sel.has(id)) sel.delete(id);
      else sel.add(id);
      btn.setAttribute('aria-pressed', String(sel.has(id)));
      updateCta();
    }),
  );
  mountPlayers(document.getElementById('players-mount'), { onChange: updateCta });
  document.getElementById('start').addEventListener('click', () => startGame());
  updateCta();
}

function updateCta() {
  const btn = document.getElementById('start');
  const hint = document.getElementById('cta-hint');
  if (!btn || !hint) return;
  const game = getGame(state.gameId);
  const missing = Math.max(0, (game.meta.minPlayers || 0) - getPlayers().length);
  let text = '';
  if (missing) text = tn('setup.needPlayers', missing);
  else if (game.meta.categories?.length && !selection(game).size) text = t('setup.needCategory');
  hint.textContent = text;
  btn.disabled = Boolean(text);
}

export async function startGame() {
  const game = getGame(state.gameId);
  try {
    await prepareGame(game);
  } catch {
    showToast({ id: 'load', text: t('setup.loadError') });
    return;
  }
  const session = game.module.createSession({
    content: game.content,
    players: getPlayers().map((p) => ({ ...p })),
    categories: [...selection(game)],
  });
  const first = session.next();
  if (!first) return;
  go('play', { session, current: first });
}

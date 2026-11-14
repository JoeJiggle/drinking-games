// Kartenanzeige (gemeinsam für kartenbasierte Spiele), Pause-Menü und Ende-Bildschirm
import { t, tn, pick } from '../i18n.js';
import { state, go } from '../router.js';
import { getGame } from '../games/registry.js';
import { renderParts } from '../core/placeholders.js';
import { esc, icons, reflow, reduceMotion } from './dom.js';
import { startGame } from './setup.js';

const SWIPE = 70; // ab so vielen Pixeln zählt ein Wisch

function themeOf(card) {
  return getGame(state.gameId).meta.themes[card.theme] || { color: '#5f3dc4', color2: '#3b2a8f', label: '' };
}

function cardHtml(card) {
  const theme = themeOf(card);
  const text = renderParts(pick(card.text), card.players)
    .map((p) => (p.type === 'name' ? `<strong class="pname">${esc(p.value)}</strong>` : esc(p.value)))
    .join('');
  const plain = pick(card.text);
  return {
    style: `--c1:${theme.color};--c2:${theme.color2}`,
    html: `
      <div class="card-label">${theme.icon ? `<span aria-hidden="true">${theme.icon}</span> ` : ''}${esc(pick(theme.label))}</div>
      <p class="card-text${plain.length > 105 ? ' long' : ''}">${text}</p>`,
  };
}

export function playView(root) {
  const game = getGame(state.gameId);
  root.innerHTML = `
    <div class="game" id="game">
      <div class="game-top">
        <button class="icon-btn" data-act="pause" aria-label="${esc(t('game.pause'))}">${icons.pause}</button>
        <div class="progress" id="progress"></div>
        <span class="icon-spacer"></span>
      </div>
      <div class="stage" id="stage"></div>
      <p class="swipe-hint" id="swipe-hint">${esc(t('game.swipeHint'))}</p>
      <div class="game-bottom">
        <button class="btn-back" data-act="prev" aria-label="${esc(t('game.back'))}">${icons.back}</button>
        <button class="btn-next" data-act="next">${esc(t('game.next'))}</button>
      </div>
      <div class="sheet-wrap" id="pause-sheet">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <h2 id="pause-title">${esc(t('game.paused'))}</h2>
          <p class="sheet-rules"><strong>${esc(t('game.rules'))}:</strong> ${esc(pick(game.meta.rules))}</p>
          <button class="sheet-btn primary" data-act="resume">${esc(t('game.resume'))}</button>
          <button class="sheet-btn" data-act="settings">${esc(t('game.settings'))}</button>
          <button class="sheet-btn danger" data-act="quit">${esc(t('game.quit'))}</button>
        </div>
      </div>
    </div>`;

  root.querySelector('[data-act=next]').addEventListener('click', goNext);
  root.querySelector('[data-act=prev]').addEventListener('click', goPrev);
  root.querySelector('[data-act=pause]').addEventListener('click', () => setPaused(true));
  root.querySelector('[data-act=resume]').addEventListener('click', () => setPaused(false));
  root.querySelector('[data-act=settings]').addEventListener('click', () => go('settings'));
  root.querySelector('[data-act=quit]').addEventListener('click', () => go('hub', { session: null, current: null }));
  root.querySelector('#pause-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'pause-sheet') setPaused(false);
  });

  placeCard(state.current, null);
  wireGestures(document.getElementById('stage'));
}

function setPaused(open) {
  const sheet = document.getElementById('pause-sheet');
  if (!sheet) return;
  reflow(sheet);
  sheet.classList.toggle('open', open);
}

function goNext() {
  if (state.view !== 'play') return;
  const card = state.session.next();
  if (!card) {
    go('end');
    return;
  }
  state.current = card;
  placeCard(card, 'next');
}

function goPrev() {
  if (state.view !== 'play') return false;
  const card = state.session.prev();
  if (!card) return false;
  state.current = card;
  placeCard(card, 'prev');
  return true;
}

function placeCard(card, dir) {
  const stage = document.getElementById('stage');
  if (!stage || !card) return;
  const { style, html } = cardHtml(card);
  const el = document.createElement('div');
  el.className = 'card';
  el.setAttribute('style', style);
  el.innerHTML = html;

  const old = stage.querySelector('.card:not(.leaving)');
  if (dir && old && !reduceMotion()) {
    el.classList.add(dir === 'next' ? 'from-right' : 'from-left');
    stage.appendChild(el);
    reflow(el);
    el.classList.remove('from-right', 'from-left');
    old.classList.remove('dragging');
    old.style.transform = '';
    old.classList.add('leaving', dir === 'next' ? 'to-left' : 'to-right');
    setTimeout(() => old.remove(), 380);
  } else {
    stage.querySelectorAll('.card').forEach((c) => c.remove());
    stage.appendChild(el);
  }

  const theme = themeOf(card);
  document.getElementById('game')?.style.setProperty('--glow', theme.color);
  const progress = document.getElementById('progress');
  if (progress) progress.textContent = t('game.progress', { n: Math.max(card.number, 1), total: state.session.total });
  const back = document.querySelector('[data-act=prev]');
  if (back) back.disabled = !state.session.canGoBack();
  const hint = document.getElementById('swipe-hint');
  if (hint) hint.classList.toggle('hidden', state.session.played() > 1);
}

function wireGestures(stage) {
  let id = null;
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dragging = false;
  let card = null;

  stage.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    dx = 0;
    dragging = false;
    card = stage.querySelector('.card:not(.leaving)');
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id || !card) return;
    dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      dragging = true;
      card.classList.add('dragging');
      stage.setPointerCapture?.(id);
    }
    if (dragging) card.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (!card) return;
    if (!dragging) {
      if (e.type === 'pointerup' && Math.abs(e.clientY - sy) < 12) goNext();
      return;
    }
    if (dx < -SWIPE) goNext();
    else if (dx > SWIPE && goPrev()) {
      /* vorherige Karte angezeigt */
    } else {
      card.classList.remove('dragging');
      card.style.transform = '';
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

// Tastatur (für Tests am Computer)
document.addEventListener('keydown', (e) => {
  if (state.view !== 'play' || document.querySelector('.sheet-wrap.open')) return;
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    goNext();
  } else if (e.key === 'ArrowLeft') goPrev();
});

export function endView(root) {
  const game = getGame(state.gameId);
  const m = game.meta;
  const played = state.session?.played() ?? 0;
  root.innerHTML = `
    <div class="game end" style="--glow:${m.color}">
      <div class="end-body">
        <div class="end-emoji" aria-hidden="true">🎉</div>
        <h2>${esc(t('end.title'))}</h2>
        <p>${esc(tn('end.count', played))}</p>
      </div>
      <div class="end-actions">
        <button class="btn-next" data-act="again">${esc(t('end.again'))}</button>
        <button class="sheet-btn" data-act="hub">${esc(t('end.hub'))}</button>
      </div>
    </div>`;
  root.querySelector('[data-act=again]').addEventListener('click', () => startGame());
  root.querySelector('[data-act=hub]').addEventListener('click', () => go('hub', { session: null, current: null }));
}

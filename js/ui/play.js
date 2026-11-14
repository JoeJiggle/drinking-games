// Kartenanzeige (gemeinsam für kartenbasierte Spiele), Pause-Menü und Ende-Bildschirm
//
// Eine Karte ist ein Objekt mit:
//   theme      Schlüssel aus meta.themes (Farbe, Beschriftung, Icon)
//   text       { de, en } mit Platzhaltern
//   players    Personen für die Platzhalter
//   label?     { de, en } ersetzt die Beschriftung des Themas
//   who?       Name der Person, die dran ist (wird neben der Beschriftung gezeigt)
//   number?    für die Anzeige „n / total“, sonst round? für „Runde n“
//   timer?     Sekunden für einen Countdown auf der Karte
//   actions?   Knöpfe statt „Weiter“: [{ id, label, sub?, style?, disabled? }] – ausgelöst über session.act(id)
//   outcome?   gewählte Aktion (wird beim Zurückblättern hervorgehoben)
import { t, tn, pick } from '../i18n.js';
import { state, go } from '../router.js';
import { getGame, rulesText } from '../games/registry.js';
import { renderParts, renderText } from '../core/placeholders.js';
import { setting, gameOptions } from '../settings.js';
import { hideCard, unhideCard } from '../cards-store.js';
import { esc, icons, reflow, reduceMotion } from './dom.js';
import { startGame } from './setup.js';
import { showToast } from './toast.js';

const SWIPE = 70; // ab so vielen Pixeln zählt ein Wisch

function themeOf(card) {
  return getGame(state.gameId).meta.themes[card.theme] || { color: '#5f3dc4', color2: '#3b2a8f', label: '' };
}

function cardHtml(card) {
  const theme = themeOf(card);
  const text = renderParts(pick(card.text), card.players, { strength: setting('strength') })
    .map((p) => (p.type === 'name' ? `<strong class="pname">${esc(p.value)}</strong>` : esc(p.value)))
    .join('');
  const plain = pick(card.text);
  const label = pick(card.label ?? theme.label);
  return {
    style: `--c1:${theme.color};--c2:${theme.color2}`,
    html: `
      <div class="card-label">${theme.icon ? `<span aria-hidden="true">${theme.icon}</span> ` : ''}${esc(label)}${
        card.who ? ` · <span class="card-who">${esc(card.who)}</span>` : ''
      }</div>
      <p class="card-text${plain.length > 105 ? ' long' : ''}">${text}</p>
      ${card.timer ? `<button class="card-timer" data-timer="${card.timer}">⏱ ${esc(t('game.timerStart', { n: card.timer }))}</button>` : ''}`,
  };
}

function controlsHtml(card) {
  const back = `<button class="btn-back" data-act="prev" aria-label="${esc(t('game.back'))}"${
    state.session.canGoBack() ? '' : ' disabled'
  }>${icons.back}</button>`;
  if (!card.actions) return `${back}<button class="btn-next" data-act="next">${esc(t('game.next'))}</button>`;
  return (
    back +
    card.actions
      .map(
        (a) => `
      <button class="btn-action act-${a.style || 'secondary'}" data-action="${a.id}"${a.disabled ? ' disabled' : ''}${
          card.outcome ? ` aria-pressed="${card.outcome === a.id}"` : ''
        }>
        <span>${esc(pick(a.label))}</span>${
          a.sub ? `<small>${esc(renderText(pick(a.sub), [], { strength: setting('strength') }))}</small>` : ''
        }
      </button>`,
      )
      .join('')
  );
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
      <div class="game-bottom" id="controls"></div>
      <div class="sheet-wrap" id="pause-sheet">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <h2 id="pause-title">${esc(t('game.paused'))}</h2>
          <p class="sheet-rules"><strong>${esc(t('game.rules'))}:</strong> ${esc(rulesText(game, gameOptions(game)))}</p>
          <button class="sheet-btn primary" data-act="resume">${esc(t('game.resume'))}</button>
          <button class="sheet-btn" data-act="hide">${esc(t('game.hideCard'))}</button>
          <button class="sheet-btn" data-act="settings">${esc(t('game.settings'))}</button>
          <button class="sheet-btn danger" data-act="quit">${esc(t('game.quit'))}</button>
        </div>
      </div>
    </div>`;

  root.querySelector('#controls').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'next') goNext();
    else if (btn.dataset.act === 'prev') goPrev();
    else if (btn.dataset.action) doAction(btn.dataset.action);
  });
  root.querySelector('[data-act=pause]').addEventListener('click', () => setPaused(true));
  root.querySelector('[data-act=resume]').addEventListener('click', () => setPaused(false));
  root.querySelector('[data-act=hide]').addEventListener('click', hideCurrent);
  root.querySelector('[data-act=settings]').addEventListener('click', () => go('settings'));
  root.querySelector('[data-act=quit]').addEventListener('click', () => go('end'));
  root.querySelector('#pause-sheet').addEventListener('click', (e) => {
    if (e.target.id === 'pause-sheet') setPaused(false);
  });

  const stage = document.getElementById('stage');
  stage.addEventListener('click', (e) => {
    const timer = e.target.closest('.card-timer');
    if (timer) startTimer(timer);
  });
  placeCard(state.current, null);
  wireGestures(stage);
}

function setPaused(open) {
  const sheet = document.getElementById('pause-sheet');
  if (!sheet) return;
  // „Nicht mehr zeigen“ gibt es nur für Karten aus einem Kartensatz (nicht z. B. für die Wahl-Karte)
  const hide = sheet.querySelector('[data-act=hide]');
  if (hide) hide.hidden = !(state.current?.id && state.session.skip);
  reflow(sheet);
  sheet.classList.toggle('open', open);
}

function hideCurrent() {
  const card = state.current;
  if (!card?.id || !state.session.skip) return;
  const gameId = state.gameId;
  hideCard(gameId, card.id);
  setPaused(false);
  showToast({
    id: 'hidden',
    text: t('game.hidden'),
    action: t('players.undo'),
    onAction: () => unhideCard(gameId, card.id),
  });
  const next = state.session.skip();
  if (!next) {
    go('end');
    return;
  }
  state.current = next;
  placeCard(next, 'next');
}

const needsAction = (card) => Boolean(card?.actions && !card.outcome);

function nudge() {
  const card = document.querySelector('#stage .card:not(.leaving)');
  if (!card || reduceMotion()) return;
  card.classList.remove('nudge');
  reflow(card);
  card.classList.add('nudge');
}

function goNext() {
  if (state.view !== 'play') return false;
  const current = state.current;
  if (needsAction(current)) {
    nudge();
    return false;
  }
  const card = state.session.next();
  if (!card) {
    if (!current?.actions) go('end');
    return false;
  }
  state.current = card;
  placeCard(card, 'next');
  return true;
}

function goPrev() {
  if (state.view !== 'play') return false;
  const card = state.session.prev();
  if (!card) return false;
  state.current = card;
  placeCard(card, 'prev');
  return true;
}

function doAction(id) {
  if (state.view !== 'play') return;
  const card = state.session.act?.(id);
  if (!card) return;
  state.current = card;
  placeCard(card, 'next');
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
    old.classList.remove('dragging', 'nudge');
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
  if (progress) {
    progress.textContent = card.round
      ? t('game.round', { n: card.round })
      : t('game.progress', { n: Math.max(card.number || 0, 1), total: state.session.total });
  }
  const controls = document.getElementById('controls');
  if (controls) {
    controls.innerHTML = controlsHtml(card);
    controls.classList.toggle('has-actions', Boolean(card.actions));
  }
  const hint = document.getElementById('swipe-hint');
  if (hint) hint.classList.toggle('hidden', Boolean(card.actions) || state.session.canGoBack());
}

function startTimer(btn) {
  if (btn.dataset.running) return;
  btn.dataset.running = '1';
  btn.classList.add('running');
  let left = Number(btn.dataset.timer);
  const tick = () => {
    if (!btn.isConnected) {
      clearInterval(id);
      return;
    }
    if (left <= 0) {
      clearInterval(id);
      btn.classList.remove('running');
      btn.classList.add('done');
      btn.textContent = t('game.timeUp');
      return;
    }
    btn.textContent = `⏱ ${left}`;
    left--;
  };
  const id = setInterval(tick, 1000);
  tick();
}

function wireGestures(stage) {
  let id = null;
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let dragging = false;
  let card = null;

  stage.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('button')) return;
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
    const moved = (dx < -SWIPE && goNext()) || (dx > SWIPE && goPrev());
    if (!moved) {
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

const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0]);

function statsHtml(meta, summary) {
  const rows = summary
    .map((r) => {
      const s = meta.stats?.[r.key];
      if (!s) return '';
      const forms = pick(s.count);
      const count = (r.n === 1 ? forms.one : forms.other).replace('{n}', r.n);
      return `
        <li>
          <span class="stat-title">${esc(pick(s.title))}</span>
          <span class="stat-names">${esc(joinNames(r.names))}</span>
          <span class="stat-count">${esc(count)}</span>
        </li>`;
    })
    .join('');
  return rows ? `<ul class="stats">${rows}</ul>` : '';
}

export function endView(root) {
  const game = getGame(state.gameId);
  const m = game.meta;
  const session = state.session;
  const done = session?.finished?.() ?? false;
  const played = session?.played() ?? 0;
  root.innerHTML = `
    <div class="game end" style="--glow:${m.color}">
      <div class="end-body">
        <div class="end-emoji" aria-hidden="true">${done ? '🎉' : '🍻'}</div>
        <h2>${esc(t(done ? 'end.title' : 'end.quitTitle'))}</h2>
        <p>${esc(tn('end.count', played))}</p>
        ${statsHtml(m, session?.summary?.() ?? [])}
      </div>
      <div class="end-actions">
        <button class="btn-next" data-act="again">${esc(t('end.again'))}</button>
        <button class="sheet-btn" data-act="hub">${esc(t('end.hub'))}</button>
      </div>
    </div>`;
  root.querySelector('[data-act=again]').addEventListener('click', () => startGame());
  root.querySelector('[data-act=hub]').addEventListener('click', () => go('hub', { session: null, current: null }));
}

// Einstiegspunkt der App
import { initDb, get, set } from './db.js';
import { initI18n } from './i18n.js';
import { loadPlayers } from './players.js';
import { loadRegistry } from './games/registry.js';
import { registerView, render } from './router.js';
import { hubView } from './ui/hub.js';
import { playersView } from './ui/players-view.js';
import { settingsView } from './ui/settings.js';
import { setupView } from './ui/setup.js';
import { playView, endView } from './ui/play.js';
import { initUpdates } from './ui/update.js';

lockZoom();
start().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML =
    '<p class="boot-error">Die App konnte nicht starten. Bitte schließen und neu öffnen.<br>The app could not start. Please close and reopen it.</p>';
});

async function start() {
  await initDb();
  const lang = await get('lang', null);
  await Promise.all([initI18n(lang), loadPlayers(), loadRegistry()]);

  registerView('hub', hubView);
  registerView('players', playersView);
  registerView('settings', settingsView);
  registerView('setup', setupView);
  registerView('play', playView);
  registerView('end', endView);
  render();

  initUpdates();
  requestPersistence();
}

// Beim ersten Start dauerhaften Speicher anfragen
async function requestPersistence() {
  try {
    if (await get('persistAsked', false)) return;
    await set('persistAsked', true);
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* nicht schlimm */
  }
}

// Zoomen verhindern (zusätzlich zu user-scalable=no und touch-action im CSS)
function lockZoom() {
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
}

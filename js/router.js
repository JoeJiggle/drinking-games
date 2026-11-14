// Zentraler App-Zustand und eine einzige render()-Funktion, die die aktuelle Ansicht neu zeichnet.

export const state = {
  view: 'hub', // hub | players | settings | setup | play | end
  back: 'hub', // wohin „Zurück“ aus den Einstellungen führt
  gameId: null,
  session: null,
  current: null, // gerade angezeigte Karte
};

const views = {};
const hooks = [];
const SETTINGS_PAGES = ['settings', 'custom'];

export function registerView(name, fn) {
  views[name] = fn;
}

// Wird nach jedem Neuzeichnen aufgerufen (z. B. Bildschirm wachhalten nur im Spiel)
export function afterRender(fn) {
  hooks.push(fn);
}

export function go(view, patch = {}) {
  // „Eigene Karten“ ist eine Unterseite der Einstellungen und zählt nicht als Rücksprungziel
  if (view === 'settings' && !SETTINGS_PAGES.includes(state.view)) state.back = state.view;
  Object.assign(state, patch, { view });
  render();
  window.scrollTo(0, 0);
}

export function render() {
  const root = document.getElementById('app');
  root.dataset.view = state.view;
  (views[state.view] || views.hub)(root);
  hooks.forEach((fn) => fn(state));
}

// Zentraler App-Zustand und eine einzige render()-Funktion, die die aktuelle Ansicht neu zeichnet.

export const state = {
  view: 'hub', // hub | players | settings | setup | play | end
  back: 'hub', // wohin „Zurück“ aus den Einstellungen führt
  gameId: null,
  session: null,
  current: null, // gerade angezeigte Karte
};

const views = {};

export function registerView(name, fn) {
  views[name] = fn;
}

export function go(view, patch = {}) {
  if (view === 'settings' && state.view !== 'settings') state.back = state.view;
  Object.assign(state, patch, { view });
  render();
  window.scrollTo(0, 0);
}

export function render() {
  const root = document.getElementById('app');
  root.dataset.view = state.view;
  (views[state.view] || views.hub)(root);
}

// Einstellungen: Sprache und Infos
import { APP_VERSION } from '../version.js';
import { t, LANGS, getLang, setLang } from '../i18n.js';
import { state, go, render } from '../router.js';
import { esc } from './dom.js';
import { shell } from './shell.js';

export function settingsView(root) {
  shell(root, {
    title: t('settings.title'),
    gear: false,
    onBack: () => go(state.back || 'hub'),
    body: `
      <h2 class="section">${esc(t('settings.language'))}</h2>
      <div class="seg" role="group" aria-label="${esc(t('settings.language'))}">
        ${LANGS.map((l) => `<button data-lang="${l}" aria-pressed="${getLang() === l}">${esc(t(`lang.${l}`))}</button>`).join('')}
      </div>
      <h2 class="section">${esc(t('settings.about'))}</h2>
      <div class="group">
        <p>${esc(t('about.text'))}</p>
        <p>${esc(t('about.privacy'))}</p>
        <p class="muted">${esc(t('about.version', { v: APP_VERSION }))}</p>
      </div>`,
  });
  root.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      render();
    }),
  );
}

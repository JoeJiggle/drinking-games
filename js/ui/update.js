// Service Worker anmelden und bei neuer Version dezent „Neu laden“ anbieten
import { t } from '../i18n.js';
import { showToast } from './toast.js';

let reloadRequested = false;

export function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  sw.addEventListener('controllerchange', () => {
    if (reloadRequested) {
      reloadRequested = false;
      location.reload();
    }
  });

  sw.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      if (reg.waiting && sw.controller) offer(reg);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && sw.controller) offer(reg);
        });
      });
      // Beim Zurückkehren in die App nach Updates schauen
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}

function offer(reg) {
  showToast({
    id: 'update',
    text: t('update.available'),
    action: t('update.reload'),
    sticky: true,
    onAction: () => {
      if (reg.waiting) {
        reloadRequested = true;
        reg.waiting.postMessage('SKIP_WAITING');
      } else {
        location.reload();
      }
    },
  });
}

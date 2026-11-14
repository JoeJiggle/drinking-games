// Bildschirm während eines Spiels anlassen (Screen Wake Lock). Ohne Unterstützung passiert einfach nichts.
let wanted = false;
let sentinel = null;

export function keepAwake(on) {
  wanted = on;
  if (on) acquire();
  else release();
}

async function acquire() {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

function release() {
  sentinel?.release().catch(() => {});
  sentinel = null;
}

// iOS gibt die Sperre beim Wechsel in den Hintergrund frei – beim Zurückkehren neu anfordern
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquire();
});

// Prüft die App in einem Headless-Edge über das Chrome DevTools Protocol:
// Start, Service Worker, Spielablauf, Sprachwechsel und Offline-Start.
// Aufruf: node scripts/check-pwa.mjs [--out <ordner für Screenshots>] [--url <adresse>]
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const PORT = 8099;
const DEBUG_PORT = 9339;
const remoteUrl = arg('--url');
const url = remoteUrl || `http://localhost:${PORT}/`;
const outDir = arg('--out') || join(tmpdir(), 'drinkinggames-check');
mkdirSync(outDir, { recursive: true });

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!EDGE) throw new Error('Microsoft Edge nicht gefunden');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const log = (msg) => console.log('•', msg);

// ---------- Server und Browser starten ----------
let server = null;
if (!remoteUrl) {
  server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await sleep(100);
  }
}
const profile = mkdtempSync(join(tmpdir(), 'dg-edge-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--lang=de-DE',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let target;
for (let i = 0; i < 100 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
  if (!target) await sleep(150);
}
if (!target) throw new Error('Edge-DevTools nicht erreichbar');

// ---------- CDP-Verbindung ----------
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 1;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    (listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const on = (method, fn) => listeners.set(method, [...(listeners.get(method) || []), fn]);

on('Runtime.exceptionThrown', (p) => problems.push('Fehler: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
on('Runtime.consoleAPICalled', (p) => {
  if (p.type === 'error') problems.push('Konsole: ' + p.args.map((a) => a.value ?? a.description).join(' '));
});
on('Log.entryAdded', (p) => {
  if (p.entry.level === 'error' && !/favicon/.test(p.entry.url || '')) problems.push(`Log: ${p.entry.text} ${p.entry.url || ''}`);
});

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression, label, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await evaluate(expression)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Zeitüberschreitung: ${label}`);
}
async function shot(name) {
  await sleep(450); // Animationen abwarten
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  log(`Screenshot ${file}`);
}
const click = (sel) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('nicht gefunden: ${sel}'); el.click(); return true; })()`);
const text = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim()`);

// ---------- Ablauf ----------
let exitCode = 0;
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: arg('--dark') ? 'dark' : 'light' }] });

  await send('Page.navigate', { url });
  await waitFor('!!document.querySelector(".game-card")', 'Hub erscheint');
  log('Hub geladen');
  await waitFor('!!navigator.serviceWorker.controller', 'Service Worker aktiv', 15000);
  const version = await evaluate(`import('./js/version.js').then(m => m.APP_VERSION)`);
  log(`Service Worker aktiv, APP_VERSION ${version}`);
  if (!remoteUrl && (await evaluate('document.documentElement.lang')) !== 'en') problems.push('Standardsprache ist nicht Englisch');
  await shot('01-hub-en');
  // Flagge im Hub wechselt die Sprache
  await click('[data-act=lang]');
  if ((await evaluate('document.documentElement.lang')) !== 'de') problems.push('Flagge wechselt nicht auf Deutsch');
  await shot('01-hub');

  // Einstellungen: Darstellung und Trinkstärke
  await click('[data-act=settings]');
  await click('[data-set=theme][data-value=dark]');
  await click('[data-set=strength][data-value=light]');
  await evaluate('document.querySelector("[data-set=bigText]").click()');
  const display = await evaluate('[document.documentElement.dataset.theme, document.documentElement.classList.contains("big-text")].join()');
  if (display !== 'dark,true') problems.push(`Darstellung wird nicht übernommen: ${display}`);
  await shot('14-einstellungen');
  await click('[data-set=theme][data-value=auto]');
  // Eigene Karte für Wahrheit oder Pflicht
  await click('#open-custom');
  await click('[data-game=truthordare]');
  await click('[data-list=dares]');
  await evaluate(`(() => { const t = document.getElementById('ctext'); t.value = 'Test-Pflicht mit {p2}'; t.dispatchEvent(new Event('input')); })()`);
  await click('#cadd');
  await evaluate(`(() => { const t = document.getElementById('ctext'); t.value = 'Kaputt {p3}'; t.dispatchEvent(new Event('input')); })()`);
  await click('#cadd');
  if (!(await text('#cmsg'))) problems.push('Kein Hinweis bei ungültigem Platzhalter');
  const customCount = await evaluate('document.querySelectorAll(".ccard").length');
  if (customCount !== 1) problems.push(`Eigene Karten: ${customCount} statt 1`);
  await shot('15-eigene-karten');
  await click('[data-act=back]');
  await click('[data-act=back]');

  // Spieler anlegen
  await click('[data-tab=players]');
  const add = async (name, g) => {
    await evaluate(`document.getElementById('pname').value = ${JSON.stringify(name)}`);
    await click(`.add-btn[data-g=${g}]`);
  };
  await add('Anna', 'f');
  await add('Ben', 'm');
  await add('Clara', 'f');
  await add('David', 'm');
  await add('anna', 'f'); // doppelt → Hinweis
  const players = await evaluate('document.querySelectorAll(".prow").length');
  if (players !== 4) problems.push(`Erwartet 4 Spieler, gefunden ${players}`);
  const dupMsg = await text('#pmsg');
  if (!dupMsg) problems.push('Kein Hinweis bei doppeltem Namen');
  await shot('02-spieler');

  // Spiel vorbereiten
  await click('[data-tab=hub]');
  await click('[data-game=never]');
  await waitFor('!!document.getElementById("start")', 'Setup erscheint');
  await click('[data-cat=spicy]');
  await shot('03-setup');
  await click('#start');
  await waitFor('!!document.querySelector("#stage .card")', 'Karte erscheint');
  await shot('04-karte');

  // Bis zur ersten Sonderkarte spielen
  let special = false;
  for (let i = 0; i < 12 && !special; i++) {
    await click('[data-act=next]');
    await sleep(60);
    special = await evaluate('/Sonderkarte|Spicy-Challenge/.test(document.querySelector("#stage .card:not(.leaving) .card-label")?.textContent)');
  }
  if (!special) problems.push('Keine Sonderkarte innerhalb von 12 Karten');
  await shot('05-sonderkarte');
  log(`Fortschritt: ${await text('#progress')}`);

  // Zurück
  const before = await text('#stage .card:not(.leaving) .card-text');
  await click('[data-act=prev]');
  await sleep(400);
  await click('[data-act=next]');
  await sleep(400);
  const after = await text('#stage .card:not(.leaving) .card-text');
  if (before !== after) problems.push('Zurück + Weiter zeigt nicht dieselbe Karte');

  // Karte aussortieren
  await click('[data-act=pause]');
  await shot('06-pause');
  const hiddenText = await text('#stage .card:not(.leaving) .card-text');
  await click('[data-act=hide]');
  await sleep(400);
  if ((await text('#stage .card:not(.leaving) .card-text')) === hiddenText) problems.push('Aussortierte Karte bleibt stehen');

  // Sprache mitten im Spiel wechseln
  await click('[data-act=pause]');
  await click('[data-act=settings]');
  if (!(await text('#reset-hidden'))?.includes('(1)')) problems.push('Aussortierte Karte wird in den Einstellungen nicht gezählt');
  await click('[data-set=lang][data-value=en]');
  await click('[data-act=back]');
  await waitFor('!!document.querySelector("#stage .card")', 'Spiel nach Sprachwechsel');
  const enText = await text('#stage .card .card-text');
  log(`Karte auf Englisch: ${enText}`);
  if (!/never|drink|sip|\b(he|she|his|her)\b/i.test(enText) && !/[A-Za-z]/.test(enText)) problems.push('Sprachwechsel wirkt nicht auf die Karte');
  if ((await text('[data-act=next]')) !== 'Next') problems.push('Oberfläche nicht auf Englisch');
  await shot('07-englisch');

  // Bis zum Ende spielen
  for (let i = 0; i < 400; i++) {
    if (await evaluate('document.getElementById("app").dataset.view === "end"')) break;
    await evaluate('document.querySelector("[data-act=next]")?.click()');
  }
  if (!(await evaluate('document.getElementById("app").dataset.view === "end"'))) problems.push('Ende-Bildschirm nicht erreicht');
  await shot('08-ende');
  await click('[data-act=hub]');

  // Wahrheit oder Pflicht
  await click('[data-game=truthordare]');
  await waitFor('!!document.getElementById("start")', 'Setup Wahrheit oder Pflicht');
  await click('[data-cat=spicy]');
  await click('#start');
  await waitFor('!!document.querySelector("[data-action=truth]")', 'Wahl-Karte');
  await shot('10-wahl');
  const actions = ['truth', 'done', 'dare', 'refused', 'truth', 'done', 'truth', 'done', 'dare', 'done', 'dare', 'done'];
  for (const a of actions) {
    await click(`[data-action=${a}]`);
    await sleep(80);
    if (a === 'dare') {
      const timer = await evaluate('!!document.querySelector("#stage .card:not(.leaving) .card-timer")');
      if (timer) {
        await click('#stage .card:not(.leaving) .card-timer');
        await sleep(1100);
        await shot('12-timer');
      }
    }
    if (a === 'truth' && !(await evaluate('!!globalThis.__shotTask'))) {
      await evaluate('globalThis.__shotTask = true');
      await shot('11-wahrheit');
    }
  }
  log(`Runde: ${await text('#progress')}`);
  // Anna hatte zweimal Wahrheit? Die Logik ist per Unit-Test abgedeckt; hier nur: Zurück zeigt die gewählte Aktion
  await click('[data-act=prev]');
  await sleep(400);
  const pressed = await evaluate('!!document.querySelector("[data-action][aria-pressed=true]")');
  if (!pressed) problems.push('Zurückgeblätterte Karte zeigt die getroffene Wahl nicht');
  await click('[data-act=pause]');
  await click('[data-act=quit]');
  await waitFor('document.getElementById("app").dataset.view === "end"', 'Ende Wahrheit oder Pflicht');
  const stats = await evaluate('document.querySelectorAll(".stats li").length');
  if (!stats) problems.push('Kein Rückblick am Ende');
  await shot('13-rueckblick');
  await click('[data-act=hub]');

  // Offline: Server stoppen und neu laden
  if (server) {
    server.kill();
    await sleep(300);
    await send('Page.reload', { ignoreCache: true });
    await waitFor('!!document.querySelector(".game-card")', 'Hub offline', 10000);
    const lang = await evaluate('document.documentElement.lang');
    if (lang !== 'en') problems.push('Sprache nach Neustart nicht gespeichert');
    const kept = await evaluate(`(async () => { document.querySelector('[data-tab=players]').click(); return document.querySelectorAll('.prow').length; })()`);
    if (kept !== 4) problems.push(`Spielerliste nach Neustart: ${kept} statt 4`);
    await click('[data-tab=hub]');
    await click('[data-game=never]');
    await click('#start');
    await waitFor('!!document.querySelector("#stage .card")', 'Spiel offline');
    log('Offline-Start und Spiel funktionieren');
    await shot('09-offline');
  }
} catch (err) {
  problems.push(err.message);
} finally {
  ws.close();
  try {
    execSync(`taskkill /pid ${edge.pid} /T /F`, { stdio: 'ignore' });
  } catch {}
  server?.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}

if (problems.length) {
  console.log('\nProbleme:');
  problems.forEach((p) => console.log('  ✖', p));
  exitCode = 1;
} else {
  console.log('\n✔ Alles in Ordnung');
}
process.exit(exitCode);

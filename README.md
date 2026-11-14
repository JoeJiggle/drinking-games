# Schwips

Private Party-PWA mit Trinkspielen für das iPhone (früher „DrinkingGames“; Repository-Name, Adresse sowie die internen Namen von Datenbank und Cache sind absichtlich gleich geblieben). Reines HTML, CSS und JavaScript ohne Build-Schritt: Die Dateien im Repository sind direkt die fertige App. Kein Konto, keine Cloud, kein Tracking, keine externen Abfragen.

Aktuell spielbar:
- **Ich hab noch nie / Never Have I Ever** – Kategorien Harmlos, Party, Spicy, mit Sonderkarten
- **Wahrheit oder Pflicht / Truth or Dare** – reihum, Verweigern kostet 2 bzw. 3 Schlucke, nach zweimal Wahrheit ist Pflicht dran, Countdown bei Aufgaben mit Zeitlimit, Rückblick am Ende
- **Wer würde eher …? / Who's Most Likely To…?** – Abstimmung per Zeigen (Gewählte antippen) oder geheim reihum mit Ergebnis-Diagramm, gelegentliche Duelle zwischen zwei Personen, Rückblick am Ende

Weitere Spiele sind als „Bald verfügbar“ vorbereitet.

Die App startet auf Englisch; die Flagge oben im Hub wechselt die Sprache.

**Einstellungen:** Bildschirm anlassen, Spicy ausblenden, Trinkstärke (rechnet alle Schluckzahlen um), Spicy-Paare, Spieloptionen pro Spiel, Design hell/dunkel/automatisch, große Schrift, Animationen reduzieren, eigene Karten (mit Sicherung als Datei), aussortierte Karten zurücksetzen, nach Updates suchen, alles zurücksetzen.

## Aufbau

```
index.html, manifest.webmanifest, sw.js   App-Hülle, PWA-Beschreibung, Offline-Cache
css/app.css                               gesamte Gestaltung (hell/dunkel automatisch)
js/app.js                                 Start der App
js/version.js                             APP_VERSION
js/router.js                              Zustand + zentrale render()-Funktion
js/db.js                                  IndexedDB-Wrapper (Sprache, Spielerliste)
js/i18n.js                                Sprache Deutsch/Englisch
js/players.js                             Spielerliste
js/core/                                  Logik ohne DOM (mit Node getestet)
  placeholders.js                         Platzhalter in Kartentexten
  matching.js                             faire Auswahl von Personen, gemischte Paare
  random.js                               Mischen und Zufall
js/games/registry.js                      Liste aller Spiele
js/games/never/game.js                    Spiellogik „Ich hab noch nie“
js/games/truthordare/game.js              Spiellogik „Wahrheit oder Pflicht“
js/games/mostlikely/game.js               Spiellogik „Wer würde eher …?“
js/ui/                                    gemeinsame Bausteine der Oberfläche
content/ui.de.json, ui.en.json            alle Oberflächentexte
content/games/<spiel>/game.json           Name, Farbe, Icon, Regel, Kategorien
content/games/never/cards.json            Aussagen
content/games/never/specials.json         Sonderkarten
content/games/truthordare/truths.json     Wahrheits-Fragen
content/games/truthordare/dares.json      Pflicht-Aufgaben
content/games/mostlikely/questions.json   Fragen „Wer würde am ehesten …?“
scripts/                                  Hilfsskripte (Server, Icons, Browser-Test)
tests/                                    automatische Tests
```

## Neue Karten hinzufügen

In `content/games/never/cards.json` eine Zeile nach diesem Muster ergänzen (Komma zwischen den Karten nicht vergessen, die `id` muss eindeutig sein):

```json
{ "id": "party-43", "cat": "party", "de": "Ich hab noch nie …", "en": "Never have I ever …" }
```

Sonderkarten in `specials.json`:

```json
{ "id": "g-23", "cat": "general", "players": 1, "de": "{p1} trinkt mit {p1:seinem|ihrem} Lieblingsmenschen.", "en": "{p1} drinks with {p1:his|her} favourite person." }
```

### Platzhalter

| Schreibweise | Bedeutung |
|---|---|
| `{p1}`, `{p2}` | Name der 1. bzw. 2. Person |
| `{p1:er\|sie}` | Wortform je nach Geschlecht: links männlich, rechts weiblich (z. B. `{p2:ihm\|ihr}`, `{p1:der Jüngste\|die Jüngste}`, `{p1:him\|her}`) |
| `{s:2}` | Anzahl Schlucke – wird mit der Trinkstärke umgerechnet (leicht ≈ halb, hart ≈ anderthalbfach) |
| `{s:3\|Schluck\|Schlucke}` | Anzahl mit passender Einzahl/Mehrzahl, z. B. „1 Schluck“ / „5 Schlucke“ |

Schluckzahlen in Karten daher immer als `{s:…}` schreiben, nicht als feste Zahl.

### Angaben pro Sonderkarte

| Feld | Bedeutung |
|---|---|
| `cat` | `general` (immer) oder `spicy` (nur wenn Spicy gewählt ist) |
| `players` | wie viele Personen die Karte braucht |
| `match: "mixed"` | Paare bevorzugt geschlechtergemischt (ca. 80 %), gilt im Spicy-Preset |
| `needs: {"f": 1, "m": 1}` | Karte nur, wenn so viele Frauen/Männer mitspielen |
| `slots: ["f", "any"]` | Person 1 muss eine Frau sein, Person 2 beliebig |

### Wahrheit oder Pflicht

Wahrheiten in `truths.json`, Pflichten in `dares.json`. Die Aufgabe richtet sich immer an die Person, die dran ist (`{p1}`). Mit `"players": 2` wählt die App eine zweite Person `{p2}` aus, mit `"timer": 30` erscheint ein Countdown-Knopf auf der Karte:

```json
{ "id": "d-party-41", "cat": "party", "players": 2, "timer": 30, "de": "Tanz 30 Sekunden mit {p2}.", "en": "Dance with {p2} for 30 seconds." }
```

Schlucke beim Verweigern, Beschriftungen und der Rückblick stehen in `content/games/truthordare/game.json`.

### Wer würde eher …?

Fragen in `questions.json`, immer als ganze Frage und geschlechtsneutral formuliert (ohne Personen-Platzhalter):

```json
{ "id": "m-party-41", "cat": "party", "de": "Wer würde am ehesten …?", "en": "Who's most likely to…?" }
```

Nach dem Ändern `node --test tests/` ausführen: Der Test meldet fehlende Übersetzungen, doppelte ids und Tippfehler in Platzhaltern.

## Neues Spiel hinzufügen

1. Ordner `content/games/<id>/` mit `game.json` (Name, Tagline, Regel, Farben, Icon – jeweils `de` und `en`) und eigenen Kartendateien.
2. Spiellogik in `js/games/<id>/game.js` mit `loadContent(base)` und `createSession({ content, players, categories })`. Die Sitzung liefert `next()`, `prev()`, `total`, `canGoBack()` und `played()`; jede Karte hat `theme`, `text: { de, en }` und `players`. Dann übernimmt die gemeinsame Kartenanzeige alles Weitere (Wischen, Fortschritt, Pause, Ende-Bildschirm, Sprachwechsel). Optional: Karten mit `actions` (eigene Knöpfe, ausgelöst über `act(id)`), `vote` (Namensauswahl), `chart` (Balkendiagramm), `timer`, `round` und ein `summary()` für den Rückblick – siehe `js/ui/play.js` und das Beispiel „Wahrheit oder Pflicht“.
3. In `js/games/registry.js` eintragen bzw. von `soon` auf `active` stellen.

In `game.json` außerdem möglich (Beispiele in den beiden vorhandenen Spielen):
- `options`: Einstellungen des Spiels (`choice`, `toggle`, `stepper`) – erscheinen automatisch in den Einstellungen und werden als `options` an `createSession` übergeben
- `rulesIf`: Regelsatz, der nur bei eingeschalteter Option (`"duels"`) oder einem bestimmten Wert (`"vote=secret"`) angezeigt wird
- `custom`: welche Kartenlisten man in der App mit eigenen Karten ergänzen kann
- `"adult": true` an einer Kategorie: wird bei „Spicy ausblenden“ versteckt
4. Neue Dateien in `sw.js` eintragen, Versionen erhöhen (siehe unten).

## Bei jeder Änderung

- `APP_VERSION` in `js/version.js` **und** den Cache-Namen in `sw.js` erhöhen (gleiche Nummer).
- Neue Dateien in die Liste in `sw.js` eintragen (der Test prüft das).
- Den Datenbanknamen in `js/db.js` nie ändern.

## Lokal testen

```
node scripts/serve.mjs          → http://localhost:8080/
node --test tests/              → Logik- und Inhaltstests
node scripts/check-pwa.mjs      → Headless-Edge: Service Worker, Spielablauf, Sprachwechsel, Offline-Start
node scripts/make-icons.mjs     → App-Symbole neu erzeugen
```

## Bibliotheken und Datenquellen

Keine. Alle Kartentexte sind eigene Formulierungen. Der Ordner `vendor/` wird nicht benötigt.

## Auf dem iPhone

- **Installieren:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- **Updates:** App ganz schließen, neu öffnen, unten auf „Neu laden“ tippen.
- **Daten:** Gespeichert werden Sprache, Spielerliste, Einstellungen, eigene und aussortierte Karten – nur auf dem Gerät. Wer das Symbol vom Home-Bildschirm löscht, löscht auch diese Daten.
- **Sicherung:** Einstellungen → Eigene Karten → „Sichern“ speichert eigene und aussortierte Karten als Datei (z. B. in iCloud Drive), „Wiederherstellen“ liest sie wieder ein (zusammenführen oder ersetzen). Nach 30 Tagen ohne Sicherung erscheint dort ein Hinweis.

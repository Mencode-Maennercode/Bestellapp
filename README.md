# Bestellsystem v2

Digitales Bestellsystem für Veranstaltungen: Gäste bestellen per QR-Code am Tisch, Kellner und Theke arbeiten
live mit, jede Veranstaltung ist strikt getrennt. Konzept und Fortschritt: [docs/v2-konzept.md](docs/v2-konzept.md).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `shared/` | Fachlogik für App **und** Server: Geld in Cent, Preise, Bestell-Status, Statistik, Zeitfenster, Eingabe-Schemas |
| `functions/` | Firebase Cloud Functions (europe-west1): Sitzungen, Bestellungen, Veranstaltungen, Push |
| `src/` | Web-App (Vite + React), statisch gebaut |
| `tisch/ kellner/ theke/ admin/` | Einstiegsseiten je Rolle |
| `database.rules.json` | Datenbank-Regeln (Standard: alles verboten) |
| `tests/emu/` | Regel- und Ablauf-Tests gegen den Firebase-Emulator |
| `tests/e2e/` | Playwright: Gast/Kellner/Theke gleichzeitig, Screenshots aller Seiten in 6 Breiten |
| `tools/lint/` | ESLint mit eigenem TypeScript 5.9 (typescript-eslint kann TypeScript 7 noch nicht) |

## Links

Gebaut für `www.praesenzwert.de/Buchungssystem/` – reine statische Dateien, kein Node.js auf dem Webserver.

- Gast: `/Buchungssystem/tisch/#<Tisch-Code>`
- Kellner: `/Buchungssystem/kellner/#<Kellner-Link>`
- Theke: `/Buchungssystem/theke/#<Theken-Link>` (eigener Link, sieht keine privaten Schnellbons)
- Verwaltung: `/Buchungssystem/admin/` (Admin-PIN)

Codes stehen hinter `#` und werden nie an den Webserver übertragen.

## Sicherheit in Kürze

- Im Browser liegen keine Geheimnisse. Admin-PIN wird nur als scrypt-Hash gespeichert und serverseitig geprüft.
- Gäste können nichts direkt in die Datenbank schreiben; Bestellungen laufen über Functions, Preise kommen nur aus dem Katalog.
- Tisch-Codes und Personal-Links gelten nur für ihre Veranstaltung und nur im Zeitfenster (±1 h).
- Kellner- und Theken-Link sind getrennt; jeden kann man einzeln erneuern und damit alte Geräte sofort aussperren.
- „Beenden“ löscht beide Links, sperrt die Sitzungen und macht die Veranstaltung endgültig; eine Folge-Veranstaltung bekommt neue Codes und Links.
- Optional eigener Ordner je Veranstaltung (`npm run build:event -- <Ordner> <eventId>`): Ordner löschen = Adressen tot.

## Entwicklung

```bash
npm install && (cd functions && npm install)
npm test            # Unit-Tests (shared/)
npm run test:emu    # Regel- + Ablauf-Tests im Emulator (braucht Java 21)
npm run test:e2e    # Ende-zu-Ende + Responsive-Prüfung (Emulator + Build unter /Buchungssystem/); Screenshots in test-results/screens/
npm run lint        # ESLint (einmalig: cd tools/lint && npm install)
npm run lighthouse -- <Basis-URL>   # Lighthouse mobil, Median aus 3 Läufen je Seite
npm run emu         # Emulatoren starten; dazu in .env.local VITE_USE_EMULATORS=1
npm run dev         # App unter http://localhost:5173/Buchungssystem/
npm run build       # statische Dateien in dist/
node scripts/set-admin-pin.mjs [--emulator]
npm run seed:dev    # Demo-Veranstaltung im Emulator (Admin-PIN 123456, lädt die echten Regeln)
npm run build:event -- <Ordner> <eventId>   # Seite nur für eine Veranstaltung → dist-events/<Ordner>/
node scripts/migrate-v2.ts --in <sicherung.json>   # Altdaten überführen (Trockenlauf; siehe Kopf der Datei)
```

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
| `legacy/` | Alte Next.js-App als Referenz, wird nach dem Umbau gelöscht |

## Links

Gebaut für `www.praesenzwert.de/Buchungssystem/` – reine statische Dateien, kein Node.js auf dem Webserver.

- Gast: `/Buchungssystem/tisch/#<Tisch-Code>`
- Kellner: `/Buchungssystem/kellner/#<Personal-Link>`
- Theke: `/Buchungssystem/theke/#<Personal-Link>`
- Verwaltung: `/Buchungssystem/admin/` (Admin-PIN)

Codes stehen hinter `#` und werden nie an den Webserver übertragen.

## Sicherheit in Kürze

- Im Browser liegen keine Geheimnisse. Admin-PIN wird nur als scrypt-Hash gespeichert und serverseitig geprüft.
- Gäste können nichts direkt in die Datenbank schreiben; Bestellungen laufen über Functions, Preise kommen nur aus dem Katalog.
- Tisch-Codes und Personal-Links gelten nur für ihre Veranstaltung und nur im Zeitfenster (±1 h).
- Personal-Link erneuern sperrt alte Geräte sofort aus.

## Entwicklung

```bash
npm install && (cd functions && npm install)
npm test            # Unit-Tests (shared/)
npm run test:emu    # Regel- + Ablauf-Tests im Emulator (braucht Java 21)
npm run emu         # Emulatoren starten; dazu in .env.local VITE_USE_EMULATORS=1
npm run dev         # App unter http://localhost:5173/Buchungssystem/
npm run build       # statische Dateien in dist/
node scripts/set-admin-pin.mjs [--emulator]
```

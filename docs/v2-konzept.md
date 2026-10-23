# Karneval-Bestellapp v2 — Komplett-Refactor & Redesign

## Context

Die App (Next.js 14.0.4 Pages Router, Firebase Realtime DB, Tailwind, ~17k Zeilen am Git-Stand) funktioniert, ist aber:

- **Unsicher:** `firebase-rules.json` erlaubt jedem Lesen + Schreiben der ganzen DB. Admin-Code (`NEXT_PUBLIC_ADMIN_CODE`), Master-Passwort (`settings.ts` `MASTER_PASSWORD`) und PIN-Hash liegen im Browser. Preise/Summen kommen vom Gast-Handy → fälschbar. Tisch-Codes gelten unbegrenzt (Bestellung von zu Hause bei der nächsten Veranstaltung möglich).
- **Rechnerisch fehlerhaft:** Statistik per „lesen → lokal ändern → komplett überschreiben" (`KellnerPageContent.tsx` handleDismiss/handleHideFromBar/handleCompleteOrder, `BarPageContent.tsx` handleBarHideOrder/RemoveCompletely) → bei gleichzeitigen Abschlüssen gehen Umsätze verloren. Geld als Float. Statistik-Schlüssel = Produktname. Kellner-„Claim" ohne Transaktion → Doppel-Übernahme möglich.
- **UX-Logikfehler:** Dringlichkeit invertiert (neu = rot, lange wartend = grün), nach 6 Min verschwinden Bestellungen **unbearbeitet und ungezählt**. Versteckte Gesten (Klick/Doppelklick/Long-Press). Gast sieht keinen Status.
- **Performance/Datenschutz:** Jedes Gast-Handy lädt *alle* Bestellungen aller Tische, die komplette Statistik und `settings` inkl. Base64-Bilder.
- **Code-Chaos:** Drei Produktquellen (`lib/menu.ts`, `config/menu`, `database/drinks`), Menü-/Glas-/Warenkorb-Logik dreifach kopiert, Komponenten mit 1.200–2.900 Zeilen, `alert()`, Emojis statt Bilder.

**Ziel:** Gleicher Funktionsumfang + neue Workflows, deutlich weniger Code, keine Rechen-/Sicherheitslücken, Oberfläche auf Niveau hochwertiger Branchensoftware, echte markenfreie Getränkefotos (Krea), gehostet als **statische Seiten unter `www.praesenzwert.de/Buchungssystem`**.

**Entscheidungen des Nutzers:** Basis = GitHub-Stand (HEAD `9a1c7b0` = origin/main). Design „Nacht-Event Premium". Kellner ohne Login, Zugang per Link (QR optional). Preise/Admin per PIN. Jede Veranstaltung strikt getrennt. Krea-Bilder ohne Markennamen/Logos. Schnellbon ohne Tisch für Kellner.

---

## Architektur (neu wegen statischem Hosting)

- **Frontend:** Vite + React 19 + TypeScript + Tailwind als **reine statische Dateien** (kein Node auf dem Webserver). Multi-Page-Build, damit jeder Link ohne Server-Rewrites funktioniert:
  `/Buchungssystem/tisch/#<code>` · `/Buchungssystem/kellner/#<token>` · `/Buchungssystem/theke/#<token>` · `/Buchungssystem/admin/`
  Codes/Tokens stehen im **Hash (`#`)** → werden nie an den Webserver geschickt, tauchen nicht in Server-Logs auf.
  Next.js entfällt (bringt ohne Server nichts, spart Code und Build-Komplexität).
- **Backend:** Firebase (bestehendes Projekt): Realtime DB + **Cloud Functions (europe-west1)** für alle Logik mit Geld/Rechten. Es existieren bereits Functions (`functions/src/index.ts`, FCM-Push) → Blaze-Tarif ist vorhanden (in Phase 2 prüfen).
- **Was im Browser liegt, ist öffentlich** (JS-Dateien) — deshalb enthält es **keine Geheimnisse**. Schutz entsteht durch: geheime, ablaufende Tokens im Link + serverseitige Prüfung in Functions + strikte DB-Regeln. Zusätzlich `robots.txt`/`noindex`, damit Google `/Buchungssystem` nicht listet.

## Veranstaltungen strikt getrennt (neu)

```
events/{eventId}  {name, startsAt, endsAt, status: draft|live|closed, mode: tables|noTables, settings{…}}
eventCodes/{guestCode}  {eventId, tableId}      ← 10 Zeichen, zufällig, pro Veranstaltung neu
eventStaff/{eventId}    {tokenHash, expiresAt}   ← Kellner-/Theken-Link pro Veranstaltung neu
```
- Gast-Code und Personal-Link gelten **nur für diese Veranstaltung und nur im Zeitfenster** (`live` und `startsAt−1 h … endsAt+1 h`). Danach: „Diese Veranstaltung ist beendet" — keine Bestellung von zu Hause, auch nicht aus der installierten Home-Screen-App.
- Kellner-/Theken-Sitzung läuft automatisch zum Veranstaltungsende ab. Neue Veranstaltung = neuer Link/QR, alte Geräte sind ausgesperrt.
- Admin legt Veranstaltung an (oder **dupliziert** die letzte inkl. Produkte/Preise/Tische) → neue Codes werden automatisch erzeugt → QR-Bögen drucken / Kellner-Link teilen.
- Alle Daten liegen unter dem Event: `events/{id}/orders`, `/stats`, `/waiters`, `/tables` → Statistik pro Veranstaltung automatisch archiviert, kein Reset-Knopf mehr nötig.

## Rollen ohne Login-Hürde

| Rolle | Zugang | Reibung |
|---|---|---|
| Gast | QR am Tisch (`#code`) | 0 |
| Kellner | **Link** (WhatsApp/SMS, „Teilen"-Knopf im Admin) **oder** QR an der Theke → Name eingeben → fertig | 1 Tipp |
| Theke | eigener Link/QR, bleibt auf dem Gerät angemeldet | 0 |
| Admin | PIN, serverseitig geprüft (scrypt-Hash), Sitzung 12 h, Sperre nach 5 Fehlversuchen | PIN |

Technik: Function `staffSession` prüft Token-Hash + Zeitfenster → gibt Firebase-Custom-Token mit Claims `{role, eventId, exp}` zurück. DB-Regeln prüfen `auth.token.eventId == $eventId`.
- **Personal darf:** Bestellungen sehen/übernehmen/abschließen, für Tische bestellen, Schnellbons, „ausverkauft" schalten.
- **Nur Admin:** Preise, Produkte, Tische/QR, Veranstaltungen, Einstellungen, Notfall-Stopp, Bestellsperre, Broadcast, Personal-Link erneuern.

**Cloud Functions (callable, mit zod-Validierung):** `createOrder` (Preise **serverseitig** aus Katalog, Ausverkauft-/Systemprüfung, Rate-Limit pro Tisch, Kellnerruf-Cooldown, Idempotenz-Schlüssel gegen Doppelbestellung), `setOrderStatus` (Transaktion, Statistik idempotent per `increment()` in Cent), `staffSession`, `adminSession`, `adminAction` (Produkte, Events, Settings), `sendOrderNotification` (bestehend, angepasst). App Check (reCAPTCHA Enterprise) gegen Bots auf `createOrder`.

**DB-Regeln:** Katalog/öffentliche Event-Infos/Systemstatus: lesen für alle, schreiben nie vom Client. `tableStatus/{code}`: Gast liest nur eigenen Tisch. Orders/Stats/Waiters: lesen nur Personal desselben Events. `secrets`: niemand. Getestet mit Emulator.

## Datenmodell je Veranstaltung

```
catalog/categories/{id}  {name, sort, active}                   (global, wird pro Event kopiert/übernommen)
catalog/products/{id}    {name, categoryId, priceCents, size, description, image, soldOut, popular,
                          glassPrompt: beer|wine|sekt|null, tableSection, sort, active}
events/{e}/tables/{id}   {label ("12"/"56a"), guestCode, barId}
events/{e}/orders/{id}   {type: order|call|tab, tableId?, tableLabel?, ownerWaiter?, note?, sendToBar,
                          items[{productId,name,priceCents,qty}], glasses{beer,wine,sekt}, totalCents,
                          source: guest|waiter, status: new|accepted|ready|served, claimedBy,
                          createdAt, readyAt, servedAt, statsRecorded}
events/{e}/tableStatus/{guestCode}/{orderId}  {status, summary, claimedBy, createdAt}
events/{e}/stats         {totalOrders, totalCents, byProduct/{id}{qty,cents}, byTable/{id}{orders,cents}, byWaiter}
events/{e}/waiters/{name} {tables[], fcmToken, lastSeen}
events/{e}/system        {shutdown, ordersPaused, broadcast{…}}
settings/public          {orgName, language, accentColors, logoUrl}
media/tablePlans/{id}    (nur bei Bedarf geladen)
secrets/                 {adminPinHash, staffTokenHashes}
```
`scripts/migrate-v2.ts` überführt bestehende Produkte/Kategorien/Tische/Statistik einmalig (Statistik als abgeschlossene Veranstaltung „Karneval 2026"). Vorher kompletter DB-Export.

---

## Phase 0 — Sicherung & Basis
1. Lokalen veralteten Stand sichern: Branch `backup/lokaler-stand-2026-10-23` (inkl. untracked `src/pages/bar.tsx`, `kellner.tsx`, `produkte.tsx`, `settings.tsx`, `qrcodes.tsx`, `produkte-test.tsx`, `functions/lib/`).
2. Working Tree auf HEAD, Branch `refactor/v2`. Dieses Konzept nach `docs/v2-konzept.md` kopieren (Grundlage für die Folge-Chats).
3. Löschen: `DeveloperStatisticsContent.tsx.backup`, `check_tables.js`, `env.local.txt`, `netlify.toml`, `netlifyfy.toml`, `public/reset-stats.html`, `src/lib/tables.ts`.

## Phase 1 — Fundament
- Vite-Projekt (Multi-Page, `base: '/Buchungssystem/'`), Firebase 11, `zod`, `motion`, `qrcode`; vitest; Functions auf Node 22.
- Struktur:
  ```
  src/domain/    types, money (Integer-Cent, Intl EUR), order-status, urgency, schemas (zod, geteilt mit Functions), i18n (Kölsch/Hochdeutsch)
  src/data/      firebase-client, hooks: useEvent, useCatalog, useOrders(filter), useTableStatus, useSystem
  src/ui/        Design-System: Button, Sheet, Dialog, Toast(+Undo), Stepper, Chip, Badge, ProductCard, ProductImage, OrderCard, AgeTimer, PinPad, NumberGrid, EmptyState, Skeleton
  src/features/  guest/, waiter/, bar/, admin/, shared/menu/ (EIN Menü-+Warenkorb-+Gläser-Flow für Gast UND Kellner)
  src/entries/   tisch.tsx, kellner.tsx, theke.tsx, admin.tsx (+ HTML je Einstieg)
  functions/src/ orders, status, sessions, admin, notifications, shared/
  scripts/       migrate-v2, seed-catalog, set-admin-pin, krea-prompts.md
  ```
- Unit-Tests: Summen, Gläser-Logik, Statistik-Idempotenz, Zeitfenster-Prüfung, Provision 1,5 %.

## Phase 2 — Backend & Sicherheit
Cloud Functions + DB-Regeln + Event-Modell wie oben. Emulator-Tests: Gast kann keine Preise fälschen/nichts löschen; Code nach Event-Ende abgelehnt; Kellner-Token von Event A funktioniert nicht bei Event B; 2 Kellner claimen gleichzeitig → nur einer; 20 parallele Abschlüsse → Statistik exakt.

## Phase 3 — Getränkebilder mit Krea (markenfrei)
- Testlauf Kölsch-Stange in 3 Modellen (`openai/gpt-image-2.5-flare` transparent, `krea/krea-2/large`, `google/nano-banana-pro`) → bestes für Konsistenz. Bevorzugt freigestellt, damit Karten-Licht per CSS je Kategorie getönt wird.
- Prompt-Gerüst: Studio-Produktfoto, ein Gefäß zentriert, 3/4-Ansicht, Kondenstropfen, Kantenlicht, quadratisch, **no text, no logo, no label, no brand**. `sharp` → WebP 512/1024 px.
- Motive über Gefäß & Farbe, nie Marke:
  | Produkt | Motiv |
  |---|---|
  | Kölsch | klassische Kölsch-Stange, goldenes Bier, weiße Krone |
  | Pils | Pils-Tulpe |
  | Radler / 0,0 % | Pils-Glas, hellgelb-trüb, Zitronenscheibe (0,0 % als UI-Badge) |
  | Cola / Zero | Tumbler, dunkle Cola, Eis (Zero als UI-Badge) |
  | Sprite / Fanta | Tumbler klar + Limette / orange + Orangenscheibe |
  | Apfelschorle / Wasser | bernsteinfarben sprudelnd + Apfel / Wasser mit Perlen |
  | Flaschen Wasser/Cola/Sprite/Fanta | unbeschriftete Flasche mit passender Flüssigkeit |
  | Kisten Bier/Kölsch/Gemischt | neutrale farblose Kiste, unbeschriftete Braunglasflaschen |
  | Wein Glas/Flasche (je 3) | Weißweinglas mit Farbton je Sorte / Flasche ohne Etikett |
  | Secco / Sekt / LuftiKuss | Sektflöte / Flasche mit Folienhals ohne Etikett (0 %-Badge) |
  | Bärbelchen / Glitter Pitter / Kiste | Mini-Fläschchen rot / mit Glitzer / Kartonträger |
  | Leere Gläser | leeres Bier-, Wein-, Sektglas |
- Plus: Fallback-Bild je Kategorie, 1–2 dunkle Konfetti-Bokeh-Hintergründe, App-Icon. Admin wählt Produktbild aus Galerie.

## Phase 4 — Design-System „Nacht-Event Premium"
Eigenständig für diesen Kunden hergeleitet (`impeccable` + `design-taste-frontend` als Maßstab): Fast-Schwarz mit Grünstich (`#0A0D0B`), 3 Flächenebenen mit feinen Lichtkanten, Vereinsfarben aus Einstellungen als Akzent (Default `#009640`/`#FFCC00`), Produktfoto schwebt über Lichtkegel je Kategorie (Bier Bernstein, Wein Rosé, Soft Kühlblau, Kurze Magenta), markante Display-Schrift + ruhige Textschrift (selbst gehostet), `tabular-nums`, Feder-Animationen mit `prefers-reduced-motion`, WCAG AA, Touch ≥ 48 px, Safe-Area.

## Phase 5 — Workflows
**Status:** `neu → angenommen → fertig (Theke) → serviert`. Dringlichkeit nach Wartezeit (< 3 Min ruhig, 3–6 Bernstein, > 6 rot pulsierend). Nichts verschwindet unbearbeitet. Jede Abschluss-Aktion 5 s Rückgängig.

**Gast:** Code öffnen → „Tisch 12" + **Bestellen** / **Köbes rufen** (Countdown-Ring) → Fotokarten, Tippen = +1, Stepper auf Karte, „Für den Tisch"-Reihe → Flasche → Sheet „Wie viele Gläser?" 0–8 → Warenkorbleiste → **Jetzt bestellen** → Live-Status „Gesendet → Anna bringt's → Serviert". Banner für pausiert/aus/beendet/Broadcast, PräsenzWert-Banner/Popup neu gestaltet.

**Kellner:** Link öffnen → Name (gemerkt) → Tische per Zahlenraster (inkl. 56a) → Alarm aktivieren → Liste meiner Aufträge (dringendste oben, Mini-Fotos, Summe) → **Übernehmen** / **Serviert** (+ Wischen) → Vollbild-Alarm + Push + Wake-Lock → Tisch-Leiste öffnet dasselbe Menü wie beim Gast.
- **Schnellbon ohne Tisch:** „+ Bon" → Menü → optionaler Merker („Fenster", „rote Jacke") → speichern. Nur für diesen Kellner sichtbar, **kein Push an andere**. Schalter „an Theke senden" (Standard an). Summe zum Kassieren, Wischen = erledigt, zählt in Statistik.
- **Modus „ohne Tische"** pro Veranstaltung: keine Tisch-Einrichtung, keine Gast-QR, Kellner startet direkt mit Schnellbons.

**Theke:** Kachel-Board, älteste zuerst, Kellner sichtbar · **Sammelliste** („12× Kölsch, 4× Cola") · Tipp **Fertig** + Rückgängig · Theken-Tabs statt `/bar1` `/bar2` · „Ausverkauft" ohne PIN · Kellner-Link/QR anzeigen.

**Admin (PIN):** Veranstaltungen (anlegen/duplizieren/live schalten/beenden) · Live-Übersicht · Produkte (Fotos, Preis inline, Drag-Sortierung, Galerie) · Tische & QR-Druck · Personal (Link teilen/erneuern, Zuordnungen) · Nachrichten · Statistik je Veranstaltung (Umsatz, Top-Artikel, Tisch, Kellner, CSV, Provision 1,5 %) · Einstellungen · Notfall-Stopp/Bestellsperre.

**Wiederverwendet:** `AlarmSystem` (KellnerPageContent.tsx:53), `parseTableEntries`, `getContrastTextColor` + `translations` (settings.ts), `QRCodesPrintPanel.tsx`-Layout, `TablePlanCarousel.tsx`, FCM-Code (`firebase.ts`, `functions/src/index.ts`), Wake-Lock/PWA-Install, Impressum/Datenschutz-Texte. Erwartet: ~17.000 → ~7.000 Zeilen.

## Phase 6 — Qualitätssicherung
`tsc`, ESLint, vitest, Emulator-Regeltests (siehe Phase 2), Schnellbon-Privatsphäre-Test, Playwright End-to-End mit 3 Fenstern (Gast/Kellner/Theke), Screenshots 360/390/430/768/1024/1920 px in Kölsch & Hochdeutsch, Lighthouse mobil Perf ≥ 90 / A11y ≥ 95, Test unter Unterpfad `/Buchungssystem/`.

## Phase 7 — Livegang (nach deiner Freigabe)
**Bei dir einmalig:**
1. Firebase Console der App → Authentication aktivieren (nur für Custom Tokens, kein Login-Formular) und Zugang für mich: Service Account `gsc-agent@seo-automation-6398.iam.gserviceaccount.com` im Firebase-Projekt unter IAM als **Firebase Admin** hinzufügen (dann deploye ich Functions/Regeln selbst).
2. Neue Admin-PIN festlegen (ich speichere nur den Hash).
3. Mir sagen, wie praesenzwert.de bereitgestellt wird (FTP/SFTP, GitHub-Repo, Hoster), damit ich den Ordner `dist/` nach `/Buchungssystem` lege.

**Durch mich:** DB-Export als Backup, Regeln + Functions deployen, Migration, erste Veranstaltung anlegen, Upload nach `/Buchungssystem`, PR auf `main`.

## Verifikation
1. `npm test` + `npm run test:rules` grün, `npm run build` ohne Fehler.
2. Lokal Vite + Firebase-Emulator: kompletter Ablauf Gast → Theke → Kellner → serviert → Statistik stimmt auf den Cent.
3. Manipulation aus Browser-Konsole (Preis ändern, Bestellung löschen, Settings schreiben, alten Code nach Event-Ende nutzen) → scheitert.
4. Vorschau unter `praesenzwert.de/Buchungssystem` mit echten Handys vor Livegang.

---

## Arbeitspakete, Chats & Modelle

Die Umsetzung ist zu groß für einen Chat. Jedes Paket in einem **neuen Chat** im Projektordner starten; jedes Paket endet mit Commit auf `refactor/v2` und einem kurzen Stand in `docs/v2-konzept.md`.

| # | Paket | Chat | Modell / Effort |
|---|---|---|---|
| 1 | Phase 0–2: Sicherung, Fundament, Functions, Regeln, Event-Modell, Tests | **dieser Chat** (Kontext ist schon geladen) | Opus 5.5 · high |
| 2 | Phase 3: Krea-Bilder | neu | Sonnet 5.5 · medium |
| 3 | Phase 4 + Gast-Ansicht | neu | Opus 5.5 · high |
| 4 | Kellner + Theke + Schnellbon | neu | Opus 5.5 · high |
| 5 | Admin-Konsole + Migration | neu | Sonnet 5.5 · high |
| 6 | Phase 6: QA, Responsiveness, Sicherheitstests | neu | Opus 5.5 · high |
| 7 | Livegang | neu | Sonnet 5.5 · medium |

Hinweis: Hintergrund-Agenten liefen vorhin ins Wochenlimit (Reset 9 Uhr). Falls Opus blockiert ist, Pakete 3/4/6 mit Sonnet 5.5 · high.

**Texte für die neuen Chats** (jeweils kopieren):
- Paket 2: `Lies docs/v2-konzept.md. Setze Phase 3 um (Krea-Getränkebilder, markenfrei) auf Branch refactor/v2. Erst Testlauf Kölsch-Stange in 3 Modellen zeigen, dann alle Bilder.`
- Paket 3: `Lies docs/v2-konzept.md. Setze Phase 4 (Design-System) und die Gast-Ansicht aus Phase 5 um, Branch refactor/v2. Webdesign Skill.`
- Paket 4: `Lies docs/v2-konzept.md. Setze Kellner-, Theken-Ansicht und Schnellbon aus Phase 5 um, Branch refactor/v2. Webdesign Skill.`
- Paket 5: `Lies docs/v2-konzept.md. Setze die Admin-Konsole aus Phase 5 und scripts/migrate-v2.ts um, Branch refactor/v2.`
- Paket 6: `Lies docs/v2-konzept.md. Führe Phase 6 komplett durch und behebe alle Fehler, Branch refactor/v2. Responsivness testen.`
- Paket 7: `Lies docs/v2-konzept.md. Führe Phase 7 (Livegang nach praesenzwert.de/Buchungssystem) durch.`

---

## Stand der Umsetzung

### Paket 1 — erledigt (23.10.2026, Branch `refactor/v2`)
- Alter Stand gesichert in `backup/lokaler-stand-2026-10-23`; alte App liegt als Referenz in `legacy/` (in Paket 6 löschen).
- `shared/`: Typen, Geld (Cent), Preisberechnung, Status-Übergänge, Statistik-Delta, Zeitfenster, Codes, zod-Schemas, Start-Katalog. 17 Unit-Tests.
- `functions/src/`: `staffSession`, `adminSession`, `changeAdminPin`, `createGuestOrder`, `createWaiterOrder`, `orderAction`, `createEvent`, `setTables`, `regenerateGuestCodes`, `rotateStaffLink`, `notifyWaiters`. Gebündelt per esbuild (`functions/build.mjs`), Node 22.
- `database.rules.json` strikt; 25 Emulator-Tests (`tests/emu/`) für Regeln, Preisfälschung, Doppel-Claim, 20 parallele Abschlüsse, Schnellbon, Link-Rotation, Veranstaltungsende.
- Vite-Gerüst mit 5 statischen Einstiegsseiten (nur Platzhalter-UI), Datenschicht `src/data/` (`firebase`, `api` mit deutschen Fehlermeldungen, `session` = unsichtbare Anmeldung, `live` = Echtzeit-Hooks).
- `scripts/set-admin-pin.mjs`.

### Festgelegte Details (gelten für alle weiteren Pakete)
- **Katalog liegt pro Veranstaltung** unter `events/{e}/catalog` (wird beim Duplizieren kopiert, „ausverkauft" zurückgesetzt). Admin schreibt Katalog/`public`/`system`/`bars` direkt (Regeln validieren), Personal darf nur `soldOut` setzen.
- **Gläser sind Produkte** (Kategorie `glaeser`, Preis 0, `glassFor`). Die Gläser-Abfrage fügt einfach diese Produkte in den Warenkorb — kein Sonderfeld.
- ~~Ein Personal-Link für Kellner und Theke~~ → seit Paket 5 **zwei getrennte Links** (siehe Paket 5).
- **Status wird abgeleitet** aus `claimedBy/readyAt/servedAt/cancelledAt` (`shared/order-lifecycle.ts`). Umsatz zählt, sobald *fertig* oder *serviert*; Rückgängig zieht exakt wieder ab (`countedWaiter`).
- Gast sieht nur `events/{e}/tableStatus/{guestCode}`; Tischname über `events/{e}/tables/{t}/label`.
- Bestell-ID = clientseitige `requestId` (UUID) → Wiederholen erzeugt nie Doppelbestellungen.
- Rate-Limits serverseitig: Bestellung 10 s, Kellnerruf 5 Min pro Tisch; abgelehnte Warenkörbe verbrauchen keinen Slot.

### Offen für spätere Pakete
- App Check (reCAPTCHA Enterprise) für `createGuestOrder` — Paket 7, braucht Schlüssel in der Firebase Console.
- ESLint-Setup — Paket 6.
- Push im Browser: FCM-Token registrieren + Service Worker — Paket 4 (`notifyWaiters` ist fertig; Emulator meldet „region outside database region", in Produktion korrekt, da DB in europe-west1).
- Migration der Altdaten (`scripts/migrate-v2.ts`) — Paket 5.
- Livegang braucht: IAM-Rolle für `gsc-agent@…` im Projekt `karneval-acfff`, „Service Account Token Creator" für das Functions-Dienstkonto (für Custom Tokens), Admin-PIN, Upload-Weg zu praesenzwert.de.

### Paket 2 — erledigt (23.10.2026, Branch `refactor/v2`)
- Modell: **Krea 2 Large** (18 Credits/Bild; Nano Banana Pro und GPT Flare deutlich teurer, Flare-Freistellung funktionierte nicht). ~690 Credits verbraucht, Rest ~4300.
- Alle Bilder auf **reinem Schwarz** im gleichen Studio-Look. Freistellung im UI per `mix-blend-mode: screen` auf dunkler Karte (Glas bleibt durchsichtig). Kein Cutout-PNG nötig.
- `public/img/drinks/{image}-512|1024.webp` (Dateiname = Katalog-Feld `image`), `fallback-{kategorie}`, `public/img/bokeh-dunkel.webp`, `public/icon-192|512.png`. Prompts + Skript: `scripts/krea-prompts.md`, `scripts/process-drink-images.mjs` (`sharp` als devDependency).
- Offen für Paket 3: Admin-Galerie nutzt dieselben Dateien; Flasche-Wein/Sekt-Bilder sind je Sorte identisch (Kopie).

### Paket 3 — erledigt (23.10.2026, Branch `refactor/v2`)
- **Design-System** „Nacht-Event Premium“ in `src/styles/app.css` + `src/ui/` (dokumentiert in `DESIGN.md`, Produktfakten in `PRODUCT.md`). Schriften selbst gehostet: Big Shoulders Display (Zahlen/Überschriften) + Atkinson Hyperlegible Next (Text). Icons: Phosphor.
- **Gemeinsamer Menü-Flow** `src/features/menu/` (Karte, Für-den-Tisch-Kacheln, Gläser-Abfrage, Warenkorb) — Paket 4 nutzt ihn für den Kellner (`CartSheet` hat `extra`-Slot für Merker/„an Theke senden“).
- **Gast-Ansicht** `src/features/guest/`: Tischnummer, Bestellen, Köbes rufen (2 Tipps, 5-Min-Ring), Live-Status, Banner (pausiert/aus/beendet/Durchsage), PräsenzWert-Bewertung (1 h / +1,5 h), „Als App speichern“, Kölsch/Hochdeutsch. Letzter Code wird für die Home-Screen-App gemerkt.
- Neue Seite `rechtliches/` (Impressum + Datenschutz, Texte unverändert übernommen).
- Backend: `tableStatus` hat jetzt `doneAt` (Ausblenden nach `archiveMinutes`); neue Regel `feedback/` (Gäste nur anlegen, Admin lesen) + Test.
- Bilder: Schwarzpunkt korrigiert (`scripts/clean-drink-blacks.mjs`), sonst grauer Kasten ums Glas.
- Lokale Vorschau: `npm run emu`, `npm run seed:dev` (Demo-Veranstaltung, Optionen `--paused --shutdown --broadcast --hochdeutsch`), `npm run dev:emu` → Links werden ausgegeben.
- Offen: Rechtstexte prüfen lassen (nennen noch „TMG“ und „3 Tage Speicherdauer“, passt nicht mehr zum Event-Modell) — vor Livegang. Apfelschorle/Sprite zeigen eine dezente Tischkante im Foto.

### Paket 4 — erledigt (23.10.2026, Branch `refactor/v2`)
- **Kellner** `src/features/waiter/`: Link öffnen → Name → Tische (Raster inkl. 56a, zeigt Kollegen) → Alarm. Liste „Meine Aufträge“ (älteste oben, Wartezeit-Farbe), „Ohne Kellner“ (Tische, die kein anwesender Kellner hat – nichts bleibt ungesehen), „bei Kollegen“ eingeklappt. Übernehmen/Serviert per Knopf oder Wischen, 5 s Rückgängig; ⋮ = Abgeben, Nachbestellen, Stornieren. Vollbild-Alarm mit Ton/Vibration (Web Audio, kein MP3), Wake-Lock, Hinweis-Ton wenn die Theke fertig meldet. Tisch-Leiste öffnet dasselbe Menü wie beim Gast.
- **Schnellbon**: „+ Bon“ → Menü → Merker + Schalter „an die Theke“ → Summe zum Kassieren, Wischen = erledigt. Modus „ohne Tische“ startet direkt mit Schnellbons.
- **Theke** `src/features/bar/`: Kachel-Board (älteste zuerst, Kellner sichtbar), Sammelliste, Abholbereit (mit Zurück), Theken-Tabs bei mehreren Theken (jede Bestellung landet genau bei einer Theke), „Ausverkauft“ ohne PIN, Personal-Link als QR/Kopieren/Teilen. Handy: Tabs Bons/Liste/Abholen.
- Logik rein in `shared/staff-board.ts` (+ 7 Tests, u. a. „fremder Schnellbon nie sichtbar“). Personal-Link verschwindet nach dem Login aus der Adresszeile; ohne `#` wird der zuletzt geöffnete Link genutzt (Push-Tipp).
- Push: `public/push-sw.js` (ohne Firebase-SDK), Token-Registrierung in `src/features/staff/device.ts`. Braucht `VITE_FIREBASE_VAPID_KEY` (Paket 7); im Emulator aus. iPhone bekommt Push nur als installierte Web-App – dort zählt der Alarm bei offener Seite.
- Vorschau: `npm run seed:dev` gibt jetzt auch Kellner-/Theke-Links aus, Demo-Bestellungen, Optionen `--two-bars --no-tables --empty`.
- **Hinweis Privatsphäre:** Schnellbons sind in der Oberfläche nur beim eigenen Kellner sichtbar und lösen keinen Push aus. (In Paket 5 auch auf Datenbank-Ebene gelöst, siehe unten: eigener Theken-Link.)
- Offen: Emulator-Lauf braucht Java im PATH (`C:Program FilesMicrosoftjdk-21…in`). Im Vite-Dev-Server kann ein Hot-Reload kurz „Kein Zugang“ zeigen (Firebase wird neu initialisiert) – „Erneut versuchen“ hilft, im Build tritt es nicht auf.


### Paket 5 — erledigt (23.10.2026, Branch `refactor/v2`)
- **Getrennte Links für Kellner und Theke** (Entscheidung des Nutzers). Claims `role: waiter | bar | admin`; Token je Rolle unter `secrets/eventStaffToken/{e}/{waiter|bar}` (nur Admin; die Theke darf zusätzlich den *Kellner*-Link lesen, um ihn als QR zu zeigen – nie umgekehrt), Lookup `secrets/staffTokens/{sha256}` → `{eventId, role}`. Generationen `events/{e}/gen/{waiter|bar}`: jeden Link einzeln erneuern. Ein Link auf der falschen Seite wird automatisch zur richtigen Seite weitergeleitet.
- **Lesezugriff auf Bestellungen nur per Feed-Abfrage** (`orders` hat kein freies Lesen für Personal): jede offene Bestellung trägt `wFeed` (`all` oder `w:<uid>` bei Schnellbon) und `bFeed` (`bar`, nur wenn an die Theke gesendet); die Regeln erlauben Kellnern nur `wFeed == all` und ihr eigenes `w:<uid>`, der Theke nur `bFeed == bar`. Fremde Schnellbons sind damit auch über die Browser-Konsole nicht lesbar. Geschlossene Bestellungen verlassen beide Feeds. Zusätzlich prüft `applyAction`: fremde Bons nur vom Besitzer, Theke darf nur `ready/unready` und nur Theken-Bestellungen. Admin-Übersicht zeigt Schnellbons nur als Anzahl.
- **Folge-Veranstaltung ohne Altlasten:** `createEvent` erzeugt immer neue Gast-Codes und beide Links (auch beim Duplizieren). `closeEvent` (und stündlich `closeEndedEvents`) beendet endgültig: Status `closed` (nicht wieder öffnbar), beide Link-Tokens gelöscht, Generationen erhöht (laufende Sitzungen sofort tot), `tableStatus` und Limits gelöscht; Gast-Codes bleiben als Hinweis „beendet“ erhalten. `setTables`, `regenerateGuestCodes`, `rotateStaffLink`, `updateEvent` lehnen geschlossene Veranstaltungen ab. Emulator-Tests decken das ab (alte Codes, alte Sitzungen, alte Links in der Folge-Veranstaltung).
- **Eigener Ordner je Veranstaltung** (Idee des Nutzers): optionales `public.slug`. `npm run build:event -- <Ordner> <eventId>` baut nur Gast/Kellner/Theke/Rechtliches nach `dist-events/<Ordner>/` (Basis `/<Ordner>/`, Admin nicht enthalten) und sperrt die Seite per `VITE_EVENT_ID` auf genau diese Veranstaltung. Ordner auf praesenzwert.de löschen = alle Adressen tot; „Beenden“ sperrt zusätzlich in der Datenbank. Links/QR im Admin zeigen automatisch auf `/<slug>/`.
- **Admin-Konsole** `src/features/admin/` (PIN-Pad → Sitzung 12 h): Übersicht (Kennzahlen, offene Aufträge, Checkliste für Entwürfe), Veranstaltungen (anlegen, duplizieren, live/Entwurf, beenden), Karte (Preis inline, Aus/Beliebt/Ausverkauft, Drag-Sortierung + Pfeiltasten, Galerie, Kategorien), Tische & QR (Einzel/Bereich, QR-Bögen A4 6 pro Seite im eigenen Druckfenster, neue Codes), Personal (beide Links als QR/Kopieren/Teilen/Erneuern, Kellner-Zuordnung, Theken), Nachrichten, Statistik (Umsatz, Top-Artikel, Tisch, Kellner, CSV, Provision 1,5 %, Bewertungen), Einstellungen (Zeiten, Sprache, Farben, Ordnername, PIN ändern). Notfall-Stopp/Bestellsperre in der Kopfzeile. Event-Einstellungen laufen über `updateEvent` (Admin schreibt `public` nicht mehr direkt); `eventIndex/{id}` ist die Event-Liste des Admins.
- **`scripts/migrate-v2.ts`**: Sicherung (`--fetch <alte DB-URL>`), Trockenlauf mit Bericht, `--apply --target emulator|<neue DB-URL>`. Altdaten → **eine beendete** Veranstaltung „Karneval 2026“ (Karte mit geänderten Preisen/eigenen Getränken, Tische ohne Codes, Theken, Statistik in Cent mit Produkt-IDs, Bewertungen); `--history` macht ältere Statistik-Resets zu eigenen Archiv-Veranstaltungen. Übernimmt nie Codes, PINs, Push-Tokens oder offene Bestellungen. Die Karte der Archiv-Veranstaltung ist die Vorlage zum Duplizieren.
- Tests: 48 Unit-Tests (u. a. Migration, CSV, Feeds/Rechte), 43 Emulator-Tests. Dev-Emulator: `seed:dev` lädt jetzt die echten Regeln in den Namespace (vorher lief die Vorschau mit offener DB) und gibt auch den Admin-Zugang aus (PIN 123456).
- Offen: Rechtstexte prüfen (Paket 7); Tischplan-Bilder (`plans`) werden migriert, aber noch nirgends angezeigt/hochgeladen; Provision/CSV je Veranstaltung, kein Vergleich über mehrere Veranstaltungen; Live-Test mit echten Handys in Paket 6/7.

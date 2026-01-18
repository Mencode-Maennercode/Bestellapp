# 🎭 Karneval Bestellsystem

Digitales Bestellsystem für Karnevalsveranstaltungen mit 44 Tischen.

## Features

- **Gäste-Seite**: QR-Code scannen → Getränke bestellen oder Kellner rufen
- **Theken-Ansicht**: Alle Bestellungen auf großem Bildschirm, farbcodierte Dringlichkeit
- **Kellner-App**: Nur eigene Tische sehen, mit Vibration bei neuen Bestellungen
- **Notfall-Stopp**: System mit PIN abschalten

## Setup

### 1. Firebase einrichten

1. Gehe zu [Firebase Console](https://console.firebase.google.com)
2. Erstelle ein neues Projekt
3. Aktiviere **Realtime Database**
4. Setze die Datenbank-Regeln auf:

```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true,
      ".validate": "newData.hasChildren(['table', 'items', 'timestamp', 'status']) && newData.child('timestamp').isNumber() && newData.child('status').isString() && newData.child('table').isString() && newData.child('items').isString()"
    },
    "bar": {
      ".read": true,
      ".write": true
    },
    "system": {
      ".read": true,
      ".write": true
    },
    "config": {
      ".read": true,
      ".write": true
    },
    "database": {
      ".read": true,
      ".write": true
    },
    "tables": {
      ".read": true,
      ".write": true
    },
    "statistics": {
      ".read": true,
      ".write": true
    },
    "waiterAssignments": {
      ".read": true,
      ".write": true
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

✅ Sichere Regeln für kommerzielle Nutzung - Gäste können ohne Anmeldung bestellen

5. Kopiere die Firebase-Konfiguration

### 2. Environment Variables

Kopiere `.env.example` zu `.env.local` und fülle die Firebase-Werte ein:

```bash
cp .env.example .env.local
```

### 3. Installation

```bash
npm install
npm run dev
```

### 4. Vercel Deployment

1. Push zu GitHub
2. Verbinde mit Vercel
3. Füge die Environment Variables in Vercel hinzu
4. Deploy!

### 5. QR-Codes drucken

1. Öffne `/qrcodes` auf der deployten Seite
2. Gib deine Vercel-URL ein
3. Klicke "QR-Codes generieren"
4. Drucke alle Codes aus

## Verwendung

### URLs

| Seite | URL | Beschreibung |
|-------|-----|--------------|
| Home | `/` | Hauptmenü |
| Theke | `/bar` | Bildschirm hinter der Bar |
| Kellner | `/kellner` | Kellner-Handy |
| QR-Codes | `/qrcodes` | QR-Codes generieren |
| Tisch | `/tisch/[CODE]` | Gäste-Bestellseite |

### Farbcodierung (Theke & Kellner)

- 🔴 **Rot** (0-1 Min): Neue Bestellung, dringend!
- 🟠 **Orange** (1-3 Min): Wartet noch
- 🟢 **Grün** (3-5 Min): Sollte bald bearbeitet werden
- Nach 5 Min verschwindet die Meldung automatisch

### Notfall-Stopp

1. Auf der Theken-Seite "NOTFALL-STOPP" klicken
2. PIN `1234` eingeben
3. Alle Gäste sehen eine Abschaltungs-Meldung

## Tisch-Codes

Die 44 Tische haben verschlüsselte Codes (z.B. K17A, M23B) statt einfacher Nummern, um Missbrauch zu verhindern.

## Tech Stack

- Next.js 14
- Firebase Realtime Database
- TailwindCSS
- TypeScript

## Lizenz

MIT - Viel Spaß beim Karneval! 🎉

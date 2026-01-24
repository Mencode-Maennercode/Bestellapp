# Firebase Cloud Messaging (FCM) Setup

## Wichtige Schritte für Push Notifications

### 1. Firebase Console Konfiguration

1. Gehe zu [Firebase Console](https://console.firebase.google.com)
2. Wähle dein Projekt: `karneval-bestellsystem`
3. Gehe zu **Project Settings** > **Cloud Messaging**
4. Unter **Web Push certificates** klicke auf **Generate key pair**
5. Kopiere den generierten VAPID Key

### 2. Umgebungsvariablen setzen

Füge in deiner `.env.local` Datei hinzu:

```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=dein-generierter-vapid-key
```

### 3. Firebase Config in Service Worker aktualisieren

Öffne `public/firebase-messaging-sw.js` und ersetze die Platzhalter-Werte (Zeilen 8-16) mit deinen echten Firebase-Werten aus der Firebase Console.

### 4. Firebase Cloud Functions deployen

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### 5. Testen

1. Öffne die Kellner-Seite
2. Erlaube Benachrichtigungen wenn gefragt
3. Erstelle eine Testbestellung von einem Tisch
4. Die Push-Benachrichtigung sollte erscheinen, auch wenn:
   - Das Handy gesperrt ist
   - Die App im Hintergrund ist
   - Der Browser minimiert ist

## Wichtige Hinweise

- **Vibration**: Die Benachrichtigungen haben ein langes Vibrationsmuster (500ms x 5)
- **Sound**: Wird automatisch abgespielt
- **Persistenz**: Benachrichtigungen bleiben bis der Nutzer sie schließt
- **Token-Verwaltung**: FCM-Tokens werden automatisch bei Login/Refresh aktualisiert

## Fehlerbehebung

Wenn Push-Benachrichtigungen nicht funktionieren:

1. Prüfe Browser-Konsole auf Fehler
2. Stelle sicher, dass Benachrichtigungen erlaubt sind
3. Prüfe ob der VAPID Key korrekt ist
4. Stelle sicher, dass die Cloud Function deployed ist
5. Prüfe Firebase Functions Logs: `firebase functions:log`

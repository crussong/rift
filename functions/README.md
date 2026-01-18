# RIFT v2 - Firebase Cloud Functions

## Funktionen

### `cleanupInactiveRooms`
- **Schedule:** Täglich um 03:00 Uhr (Europe/Berlin)
- **Aufgabe:** Löscht Räume die seit 60 Tagen keine Aktivität hatten
- **Logging:** Schreibt Cleanup-Logs nach `/admin/cleanup_logs`

### `cleanupPendingRooms`
- **Schedule:** Stündlich
- **Aufgabe:** Löscht Räume im `pending` Status die älter als 1 Stunde sind
- **Grund:** Host hat Raum-Setup nie abgeschlossen

### `deleteRoom`
- **Typ:** HTTPS Callable Function
- **Aufgabe:** Erlaubt GM/Host einen Raum manuell zu löschen
- **Parameter:** `{ roomCode: string, userId: string }`
- **Berechtigung:** Nur wenn User `isGM: true` oder `isHost: true` hat

### `updateRoomActivity`
- **Typ:** Database Trigger
- **Aufgabe:** Aktualisiert `lastActivity` bei jeder Spieler-Änderung
- **Trigger:** `/rooms/{roomCode}/players/{userId}` onWrite

## Deployment

```bash
# Im Projekt-Root
cd functions
npm install

# Zurück zum Root
cd ..

# Functions deployen
firebase deploy --only functions

# Nur eine spezifische Function deployen
firebase deploy --only functions:cleanupInactiveRooms
```

## Lokales Testen

```bash
cd functions
npm run serve
```

## Logs ansehen

```bash
firebase functions:log
```

## Client-Aufruf für deleteRoom

```javascript
// Im Frontend
const deleteRoom = firebase.functions().httpsCallable('deleteRoom');

try {
    const result = await deleteRoom({
        roomCode: 'XTBGZP',
        userId: currentUser.odule
    });
    console.log(result.data.message); // "Raum wurde gelöscht"
} catch (error) {
    console.error(error.message);
}
```

# RIFT v3.2 - Bugfixes

## Datum: 2026-01-18

## Behobene Probleme

### Top Bar - Profilbild
- **Problem**: Hochgeladenes Profilbild wurde nicht gespeichert
- **Ursache**: JavaScript-Variablen im Modul-Scope waren nicht global verfügbar
- **Fix**: `pendingAvatarData` und `pendingAvatarRemove` auf `window.*` umgestellt für globalen Zugriff
- **Datei**: `assets/js/layout.js`

### Charakterbogen - Löschen
- **Problem**: "Fehler beim Löschen" Toast beim Versuch einen Charakter zu löschen
- **Ursache**: `event` Parameter wurde nicht korrekt an `confirmDelete()` übergeben
- **Fix**: Event-Parameter in onclick-Handler hinzugefügt: `onclick="SheetManager.confirmDelete('${char.id}', '${char.name}', event)"`
- **Datei**: `sheet.html`

### Charakterbogen - Aufrufen/Bearbeiten
- **Problem**: "Charakter nicht gefunden" beim Öffnen existierender Charaktere
- **Ursache**: Character-ID wurde nicht korrekt gespeichert wenn `currentCharId = null`
- **Fix**: 
  - `CharacterStorage.save()` prüft jetzt explizit auf `null`, `undefined` und leeren String
  - `saveToCharacterStorage()` in sheet-5e.html und sheet-5e-de.html aktualisiert URL nach jedem Speichern
- **Dateien**: `assets/js/character-storage.js`, `sheet-5e.html`, `sheet-5e-de.html`

### Seitenleiste - GM-Icon
- **Problem**: Grünes Icon für GM-Optionen (Mission Control) nicht sichtbar
- **Ursache**: `userData.isGM` wurde nicht korrekt aus localStorage geladen
- **Fix**: 
  - Settings-Modal hat jetzt einen "Rolle"-Tab zum Aktivieren des GM-Modus
  - Debug-Helper `window.activateGM()` zum schnellen Aktivieren aus der Konsole
  - Verbesserte Logging in `getUserData()` zur Diagnose
- **Datei**: `assets/js/layout.js`

## Neue Features

### Settings-Modal - Rolle Tab
- Neuer Tab "Rolle" im Einstellungen-Modal
- Toggle-Switch zum Aktivieren/Deaktivieren des GM-Modus
- Spart den Umweg über Ctrl+Shift+A oder Konsole

### Debug-Helper Funktionen
Verfügbar in der Browser-Konsole:
- `activateGM()` - Aktiviert GM-Modus und lädt Seite neu
- `showUserData()` - Zeigt aktuelle Benutzerdaten
- `showCharacters()` - Zeigt alle gespeicherten Charaktere mit IDs

## Testing-Hinweise

Nach dem Deployment:
1. Hard-Refresh (Ctrl+Shift+R) durchführen
2. **Profilbild testen**: Einstellungen öffnen → Profilbild-Tab → Bild hochladen → Speichern → Seite neu laden → Prüfen ob Bild sichtbar
3. **GM-Modus testen**: Einstellungen → Rolle-Tab → GM aktivieren → Speichern → Grünes Icon sollte in Sidebar erscheinen
4. **Charakter erstellen**: Neuen Charakter anlegen → Namen eingeben → Seite verlassen → Charakterbogen erneut öffnen → Charakter sollte in Liste sein
5. **Charakter löschen**: Papierkorb-Icon klicken → Bestätigen → Charakter sollte verschwinden

## Geänderte Dateien

- `assets/js/layout.js` - Avatar-Speicherung, GM-Rolle-Tab, Debug-Helper
- `assets/js/character-storage.js` - Verbesserte ID-Generierung und Logging
- `assets/css/settings.css` - Toggle-Switch Styles für Rolle-Tab
- `sheet.html` - Event-Parameter für confirmDelete
- `sheet-5e.html` - Verbesserte saveToCharacterStorage
- `sheet-5e-de.html` - Verbesserte saveToCharacterStorage

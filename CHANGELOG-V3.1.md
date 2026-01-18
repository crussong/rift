# RIFT v3.1 - Changelog

**Datum:** 17. Januar 2026  
**Version:** 3.1  
**Status:** Bug Fixes & Feature Restoration

---

## Behobene Probleme

### Top Bar (layout.js)
- ✅ **Party-Anzeige** - War hardcoded "4/5", jetzt dynamisch aus localStorage
- ✅ **"Abenteuer starten" Button** - Fehlender onclick Handler hinzugefügt
  - Öffnet die nächste geplante Session, wenn vorhanden
  - Andernfalls navigiert zur Sessions-Übersicht
- ✅ **Profil-Einstellungen** - Neue `openSettings()` Funktion implementiert
  - Name ändern
  - Farbe ändern (15 Farboptionen)
  - Profilbild hochladen/entfernen
  - Alle Änderungen werden in localStorage gespeichert
- ✅ **User Dropdown** - Event-Listener für Öffnen/Schließen hinzugefügt

### HUB / index.html
- ✅ **Aktive Charaktere doppelt gelistet** - Fixed: CharacterStorage speichert als Object, nicht Array
  - Geändert von `JSON.parse(... || '[]')` zu `Object.values(JSON.parse(... || '{}'))`

### SESSIONS / sessions.html
- ✅ **"Neue Session erstellen" Button** - Funktioniert jetzt wieder
- ✅ **"Session planen" Button** - Funktioniert jetzt wieder
- ✅ **Global Exports** - Funktionen sind jetzt global für onclick-Handler verfügbar

### CHARAKTERBOGEN / sheet.html
- ✅ **Stats-Anzeige** - Hardcoded "4" Charaktere entfernt, wird jetzt dynamisch geladen
- ✅ **"Letzte Session" Anzeige** - Zeigt jetzt korrektes relatives Datum (gerade, 2h, 3d, etc.)

### WÜRFEL / dice.html
- ✅ **"Zurück zum Charakterbogen" Button** - Wird nur noch angezeigt wenn ein Charakter aktiv ist
  - Beide Buttons (Header und Result-Popup) werden jetzt korrekt gesteuert

### Transitions (transitions.js)
- ✅ **Full Reload für komplexe Seiten** - Folgende Seiten machen jetzt einen echten Page Reload:
  - `dice.html` - 3D-Würfel benötigen vollständige Initialisierung
  - `sessions.html` - Modal-Handling erfordert frisches DOM
  - `sheet.html` - Charakterladen erfordert volle Initialisierung
  - `gm.html` - Komplexe Interaktionen
  - `session.html` - Echtzeit-Updates

### CSS (settings.css)
- ✅ **Settings Modal Styles** - Neue Styles für:
  - `.settings-content` Tabs mit Animation
  - `.color-picker-grid` Farbauswahl
  - `.avatar-preview` Profilbild-Vorschau
  - `.topbar__dropdown` User-Menü

---

## Neue Features

### Profile Settings Modal
Komplett neues Settings-Modal mit drei Tabs:
1. **Name** - Anzeigename ändern (max. 24 Zeichen)
2. **Farbe** - 15 vordefinierte Profilfarben
3. **Profilbild** - Upload/Entfernen von Avataren (max 2MB)

### Dynamische Party-Anzeige
- Party-Count wird aus `rift_room_data` geladen
- `updatePartyCount(online, total)` Funktion für externe Updates

---

## Bekannte Einschränkungen

Die folgenden Probleme aus v3.0 bleiben bestehen, werden aber durch Full Reload gemildert:

1. **3D-Würfel-Vorschau** (dice.html)
   - Weiße Würfel in den bunten Auswahl-Cards funktionieren nach direktem Aufruf
   - THREE.js Kontext wird bei Full Reload korrekt initialisiert

2. **Admin-Login Modal**
   - Funktioniert mit Ctrl+Shift+A oder 5x Tap auf RIFT Logo
   - CSS `.modal-overlay.active` ist korrekt definiert

---

## Deployment-Hinweise

### Netlify Konfiguration
- **Build Command:** Nicht nötig (statische Dateien)
- **Publish Directory:** Root (wo index.html liegt)
- **_headers Datei:** Vorhanden für Cache-Control

### Nach Deployment
1. Hard Refresh (Ctrl+Shift+R) im Browser
2. localStorage löschen falls alte Daten problematisch sind
3. Testen: Sessions erstellen, Charaktere anlegen, Würfeln

---

## Dateien geändert

| Datei | Änderungen |
|-------|------------|
| `assets/js/layout.js` | Party-Anzeige, Abenteuer-Button, Settings-Modal, User-Dropdown |
| `assets/js/transitions.js` | Full Reload für komplexe Seiten |
| `assets/css/settings.css` | Settings-Modal Styles |
| `index.html` | Character-Loading Fix |
| `sessions.html` | Global Function Exports |
| `sheet.html` | Stats-Anzeige, Last-Played |
| `dice.html` | Back-Button Sichtbarkeit |

---

*Erstellt am 17. Januar 2026*

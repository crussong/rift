# RIFT Layout V2 - Migration Guide

## Übersicht

Das neue Layout V2 System ersetzt die alte Sidebar/Topbar Struktur durch:
- **TopNav** - Obere Navigation mit User/Party/Room Dropdowns
- **MegaNav** - Horizontale Navigation mit Dropdowns (Sessions, Charaktere, Tools, GM Center)
- **Dock** - Mobile Bottom-Navigation (immer sichtbar)
- **Footer V2** - Neuer Footer (optional)

## Bereits migrierte Seiten ✅

- `index.html` - HUB v2 (komplett neu)
- `dice.html` - Würfel
- `chat.html` - Chat
- `sessions.html` - Session-Übersicht
- `session.html` - Aktive Session
- `gm.html` - GM Kontrollzentrum

## Noch zu migrierende Seiten ⏳

- `sheet-worldsapart.html`
- `sheet-5e.html` / `sheet-5e-en.html` / `sheet-5e-de.html`
- `sheet-htbah.html`
- `sheet-cyberpunkred.html`
- `whiteboard.html`
- `map.html`
- `notes.html`
- `user-settings.html`
- Weitere Info-Seiten (about, contact, etc.)

## Migration einer Seite

### Schritt 1: CSS imports ändern

**Vorher:**
```html
<link rel="stylesheet" href="assets/css/sidebar.css">
<link rel="stylesheet" href="assets/css/topbar.css">
<link rel="stylesheet" href="assets/css/footer.css">
```

**Nachher:**
```html
<link rel="stylesheet" href="assets/css/hubv2.css">
```

### Schritt 2: JavaScript Aufruf ändern

**Vorher:**
```javascript
initLayout();
```

**Nachher:**
```javascript
initLayoutV2();
```

### Schritt 3: Optionen

```javascript
// Mit Footer (für Info-Seiten)
initLayoutV2({ includeFooter: true });

// Ohne Footer (für Tool-Seiten - Standard)
initLayoutV2();
```

## Dateien

### Neue Dateien
- `assets/css/hubv2.css` - Alle V2 Styles (3300+ Zeilen)
- `index.html` - Neues HUB Design

### Aktualisierte Dateien
- `assets/js/layout.js` - Enthält jetzt beide Systeme (V1 + V2)

## Technische Details

### CSS Variablen
```css
--topnav-height: 64px;
--meganav-height: 48px;
--dock-height: 72px;
```

### Body-Klasse
Bei `initLayoutV2()` wird automatisch `body.layout-v2` hinzugefügt für:
- `padding-top: calc(topnav + meganav)`
- `padding-bottom: dock-height`

### Funktionen in layout.js

**V1 (alt - weiterhin verfügbar):**
- `createSidebar()`
- `createTopbar()`
- `createFooter()`
- `initLayout()`

**V2 (neu):**
- `createTopNavV2()`
- `createMegaNavV2()`
- `createDockV2()`
- `createFooterV2()`
- `initLayoutV2(options)`
- `LayoutV2` Controller-Objekt

### LayoutV2 Controller

```javascript
LayoutV2.copyRoomCode()      // Raumcode kopieren
LayoutV2.shareRoomLink()     // Raumlink teilen
LayoutV2.leaveRoom()         // Raum verlassen
LayoutV2.signOut()           // Abmelden
LayoutV2.updateRoomUI()      // Party-Anzeige aktualisieren
LayoutV2.initDropdowns()     // Dropdowns initialisieren
LayoutV2.initCharacterDropdown() // Charakter-Dropdown befüllen
```

## Bekannte Einschränkungen

1. **Character Sheets** haben eigenes Navigation-System - müssen separat behandelt werden
2. **GM Popup Mode** (`?gm=true`) überspringt Layout automatisch
3. **Alte CSS-Dateien** (sidebar.css, topbar.css) können entfernt werden nach vollständiger Migration

## Nächste Schritte

1. Restliche Tool-Seiten migrieren (whiteboard, map, notes)
2. Character Sheets migrieren
3. Info-Seiten migrieren
4. Alte CSS-Dateien entfernen
5. Testing auf allen Geräten

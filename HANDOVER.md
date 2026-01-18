# RIFT v3 - Übergabe-Dokument

**Letzte Aktualisierung:** 18. Januar 2026 (Session 9)

## Projekt-Übersicht
RIFT v3 ist eine Web-App für Pen & Paper Rollenspiele. Unterstützte Regelwerke: D&D 5e (2024), Worlds Apart, How To Be A Hero, Cyberpunk Red.

**Live:** https://admirable-kangaroo-19d7d9.netlify.app/

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (kein Framework)
- **Backend:** Firebase Realtime Database + Firestore
- **Auth:** Firebase Google OAuth
- **Storage:** IndexedDB (Bilder), localStorage (Settings)
- **Fonts:** Dharma Gothic (Headlines), System Fonts (Body)
- **Deployment:** Netlify

## Dateistruktur
```
rift-v3/
├── index.html              # Hub/Dashboard
├── sessions.html           # Session-Liste (CRUD, Cover/Thumbnail Upload, Cropper)
├── session.html            # Session-Detail-Ansicht
├── dice.html               # 3D Würfel (Themes, Multiplayer-Sync)
├── sheet.html              # Charakterbogen-Auswahl
├── sheet-worldsapart.html  # Worlds Apart (funktional, Zweite Chance)
├── sheet-5e.html           # D&D 5e Bogen
├── sheet-5e-de.html        # D&D 5e Deutsch
├── sheet-5e-en.html        # D&D 5e English
├── chat.html               # Chat-Modul
├── notes.html              # Notizen
├── map.html                # Karten-Modul
├── whiteboard.html         # Whiteboard (Drawing, Firebase Sync)
├── gm.html                 # GM Dashboard
├── login.html              # Login (Google OAuth)
├── assets/
│   ├── css/
│   │   ├── core.css            # Variablen, Reset
│   │   ├── ui.css              # Komponenten, Toast, Modal
│   │   ├── sidebar.css         # Sidebar
│   │   ├── topbar.css          # Topbar + Dropdowns
│   │   ├── hub.css             # Hub (Continue Cards, Widgets, News)
│   │   ├── sessions.css        # Sessions (Cards, Cropper Modal)
│   │   ├── session.css         # Session-Detail
│   │   ├── dice.css            # Würfel-Modul
│   │   └── sheet-worldsapart.css
│   ├── js/
│   │   ├── layout.js           # Sidebar, Topbar, Footer
│   │   ├── ui.js               # Toast, Modal, Dialogs
│   │   ├── auth.js             # Firebase Auth
│   │   ├── firebase-config.js  # Firebase Setup
│   │   ├── character-storage.js # Charakter localStorage
│   │   ├── room-service.js     # Raum-Management
│   │   └── data-manager.js     # Daten-Sync
│   ├── img/
│   │   ├── news/news_placeholder.svg  # Rotes R-Icon
│   │   ├── rulesets/           # Regelwerk-Icons
│   │   └── rift_chars/         # Placeholder-Charaktere
│   └── libs/dice/              # 3D Dice (Three.js + Cannon.js)
```

## Wichtige Konventionen

### Layout-System
```javascript
initLayout();  // Am Anfang jeder Seite aufrufen
```
**WICHTIG für Charakterbögen:** `createNavigationBar()` und `createFooter()` sind bereits im Hauptscript - NICHT nochmal am Ende hinzufügen!

### CSS-Klassen (BEM)
```css
.component__element
.component__element--modifier
/* Beispiel: .widget__header, .continue-card__badge, .button--primary */
```

### Farben (CSS Variablen)
```css
--accent: #FF4655;              /* RIFT Rot */
--bg: #161616;                  /* Hintergrund */
--bg-card: #1b1b1b;             /* Card */
--bg-elevated: #252525;         /* Erhöht */
--border: rgba(255,255,255,0.08);
```

### Regelwerk-Farben
| Regelwerk | Farbe | Key |
|-----------|-------|-----|
| Worlds Apart | Lila #8b5cf6 | `worldsapart` |
| D&D 5e | Rot #ef4444 | `5e2024` |
| HTBAH | Grün #22c55e | `htbah` |
| Cyberpunk | Gelb #eab308 | `cyberpunk` |

---

## Aktuelle Session (18.01.2026)

### Behobene Probleme

1. **News Placeholder:** Verwendet jetzt echtes `icon_rift_r.svg` (25% opacity)
2. **Hub Navigation Bug:** Mock-Script entfernt das Session-Daten überschrieb
3. **Continue Cards:** Komplett überarbeitet!
   - Session-basiert (1 Card = 1 Session)
   - Fortsetzen → session.html
   - **Integriertes Avatar-System im Glass-Footer:**
     - 64x64px, abgerundet, ragt nach oben aus dem Glass
     - Zeigt Portrait oder Initialen mit Ruleset-Gradient
     - Hover-Animation (lift + scale)
4. **Session-Anzahl:** Nutzt `currentSession/sessionCount` Felder

### Session Cover System (v3.12)

**Zwei separate Bilder:**
| Typ | Aspect Ratio | Max Size | Verwendung |
|-----|--------------|----------|------------|
| Header-Cover | 3:1 | 1200×400px | session.html Detail |
| Thumbnail | 2:3 (hochkant) | 200×300px | sessions.html Liste |

**Storage Keys (IndexedDB):**
- Cover: `sessionId`
- Thumbnail: `'thumb_' + sessionId`
- Metadata: `session.hasCover`, `session.hasThumbnail`

**Cropper.js Integration:**
- Modal: `.rift-crop-modal` (z-index: 999999)
- Aspect Ratios werden automatisch gesetzt

### Session Datenstruktur
```javascript
{
  id: 'uuid',
  name: 'Session Name',
  ruleset: 'worldsapart',  // 5e2024, htbah, cyberpunk
  date: '2026-01-24',
  time: '20:00',
  status: 'planned',       // live, ended
  currentSession: 1,       // Aktuelle Session-Nummer
  sessionCount: 2,         // Geplante Anzahl
  maxPlayers: 6,
  hasCover: true,
  hasThumbnail: true,
  selectedCharacterId: 'char-uuid',  // Ausgewählter Charakter
  ownerId: 'firebase-uid',
  roomCode: 'XXX-XXX'
}
```

---

## Feature-Status

### ✅ Fertig (90%+)
- **Hub:** Continue Cards (Session-basiert), Next Session Countdown, Widgets, News
- **Sessions Liste:** CRUD, Cover/Thumbnail Upload, Cropper, Filter
- **Session Detail:** Header, Charakter-Auswahl, Spieler-Liste, Schnellzugriff
- **Dice:** 3D Würfel, Themes, Multiplayer-Sync, URL-Parameter
- **Worlds Apart Sheet:** Vollständig funktional, Zweite Chance

### ⚠️ Grundgerüst (50-70%)
- **D&D 5e Sheets:** i18n (DE/EN), Basis funktioniert
- **Whiteboard:** Drawing, Firebase Sync
- **GM Tools:** Struktur vorhanden

### ❌ Platzhalter
- **Chat:** UI-Mockup
- **Notes:** Platzhalter
- **Map:** Platzhalter

---

## Bekannte Issues / TODOs

- [ ] Header-Cover wird in session.html noch nicht angezeigt
- [ ] Alte Sessions ohne Thumbnail fallen auf Cover zurück
- [ ] Mobile Polish auf einigen Seiten
- [ ] Charakter-Portrait in Continue Cards nur wenn vorhanden

---

## Workflow-Hinweise

1. **Testen:** Live auf Netlify nach jedem Deploy
2. **ZIP-Versionen:** v3.13c = 13. Major, c = 3. Iteration
3. **Schnell iterieren:** Kleine Fixes, direkt deployen
4. **HANDOVER.md:** Am Ende jeder Session aktualisieren!

---

## Referenz-Dateien

- Hub-Layout: `index.html` + `assets/css/hub.css`
- Session-Cards: `sessions.html` (Zeilen 1276-1403)
- Continue-Cards: `index.html` (loadDashboardData)
- Cropper-Modal: `sessions.html` + `assets/css/sessions.css` (.rift-crop-modal)

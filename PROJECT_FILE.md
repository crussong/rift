# RIFT PnP Companion - Technische Dokumentation

## Version: v77 (Januar 2026)

---

## 1. Projektstruktur

```
pnp_app/
├── index.html              # Hub/Startseite
├── login.html              # Raum erstellen/beitreten
├── charakterbogen.html     # Charakterbogen (HTBAH)
├── wuerfel.html            # Würfelmodul
├── chat.html               # Gruppen-Chat
├── karte.html              # Karten-Modul mit Markern
├── whiteboard.html         # Freihand-Zeichnung
├── notizen.html            # Session-Notizen
├── gm-options.html         # GM-Verwaltung
├── about.html              # Über RIFT
├── branding.html           # Branding Guide
├── contact.html            # Kontaktseite
├── donation.html           # Spendenoptionen
├── 404.html                # Fehlerseite
│
├── pages/
│   └── legal/
│       ├── privacy.html    # Datenschutz
│       ├── impressum.html  # Impressum
│       ├── terms.html      # Nutzungsbestimmungen
│       ├── cookies.html    # Cookie-Hinweis
│       └── disclaimer.html # Haftungsausschluss
│
├── assets/
│   ├── js/
│   │   ├── firebase-sync.js   # Firebase-Logik (~4000 Zeilen)
│   │   ├── lang.js            # Übersetzungen (~620 Keys)
│   │   ├── auth.js            # Authentifizierung
│   │   ├── i18n.js            # Internationalisierung
│   │   ├── nav.js             # Navigation/Footer
│   │   └── quotes.js          # Zufällige Zitate
│   │
│   ├── css/
│   │   └── global.css         # Globale Styles, CSS Variables
│   │
│   ├── images/                # Logos, Karten
│   ├── icons/                 # UI Icons, Marker
│   └── bg/                    # Hintergrundbilder (12 Stück)
│
├── manifest.json              # PWA Manifest
├── sw.js                      # Service Worker (v77)
├── netlify.toml               # Netlify Config
├── .gitignore
├── README.md
├── PROJECT_STATUS.md
└── PROJECT_BRIEF.md
```

---

## 2. Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Backend | Firebase Realtime Database |
| Hosting | Netlify (CDN, Auto-Deploy) |
| PWA | Service Worker, Web App Manifest |
| Fonts | Google Fonts (Roboto) |
| Icons | Custom SVG + PNG |

---

## 3. Firebase-Struktur

```
rooms/
└── {roomCode}/
    ├── meta/
    │   ├── createdAt
    │   ├── expiresAt
    │   └── gmId
    ├── players/
    │   └── {odlayerId}/
    │       ├── username
    │       ├── color
    │       ├── isGM
    │       ├── isOnline
    │       └── joinedAt
    ├── characters/
    │   └── {playerId}/ (Charakterdaten)
    ├── dice/
    │   └── {rollId}/ (Würfelergebnisse)
    ├── chat/
    │   └── {messageId}/ (Chat-Nachrichten)
    ├── whiteboard/
    │   └── {strokeId}/ (Zeichnungen)
    ├── map/
    │   ├── image (Base64)
    │   └── markers/
    │       └── {markerId}/
    ├── notes/
    │   └── {odlayerId}/ (Notizen)
    ├── modules/
    │   ├── karte: true/false
    │   ├── whiteboard: true/false
    │   ├── chat: true/false
    │   └── notizen: true/false
    ├── pause/
    │   ├── active
    │   ├── pausedBy
    │   └── pausedAt
    └── timer/
        ├── endTime
        ├── duration
        └── state
```

---

## 4. Hauptfunktionen

### 4.1 GM Succession System
- GM-Logout zeigt Nachfolger-Dialog
- Spieler können GM-Rolle übernehmen
- 120 Sekunden Grace Period bei Disconnect
- Countdown-Banner für alle Spieler sichtbar
- Auto-Transfer zu ältestem Spieler nach Timeout
- Firebase-Validierung verhindert localStorage-Manipulation

### 4.2 Karten-Modul
- Startet blank mit Grid-Overlay
- GM kann Bild hochladen (PNG/JPG/WebP, max 5MB)
- 10 Marker-Typen (nur Farben):
  - Stadt (blau), Dorf (grün), Route (orange)
  - Gefahrenzone (rot), Interessenspunkt (lila)
  - Quest (gold), NPC (türkis), Unbekannt (grau)
  - Wichtig (magenta), Gegenstand (lime)
- Marker-Name optional
- Touch-Support für Mobile
- Zoom-Anzeige blendet nach 1.5s aus

### 4.3 Pause-System
- GM kann Spiel für alle pausieren
- Overlay blockiert Spieler-Interaktion
- GM kann trotzdem navigieren (Feature in Arbeit)

### 4.4 Module-Toggle
- GM kann Module für alle deaktivieren
- Deaktivierte Module in Sidebar ausgegraut
- Sync über Firebase

---

## 5. CSS Design System

### CSS Variables (global.css)
```css
--md-primary: #BB86FC;
--md-background: #121212;
--md-surface: #1E1E1E;
--md-on-background: #E0E0E0;
--shape-sm/md/lg: Border-Radius
--space-xs/sm/md/lg/xl/2xl: Spacing
--elevation-1/2/3: Box-Shadows
```

### Themes
- `[data-theme="dark"]` - Standard
- `[data-theme="light"]` - Hell

---

## 6. JavaScript-Module

### firebase-sync.js (~4000 Zeilen)
- Room Management (create, join, leave)
- Player Presence (online/offline)
- GM Succession Logic
- Dice Rolling & Sync
- Chat System
- Whiteboard Sync
- Map & Markers
- Timer
- Module States

### lang.js (~620 Keys)
- Deutsche Übersetzungen
- Englische Übersetzungen
- Format: `'key.subkey': 'Text'`

### auth.js
- Login/Logout
- Session Management
- localStorage Handling

### nav.js
- Sidebar Generation
- Footer Generation
- Mobile Menu

### i18n.js
- `t('key')` - Übersetzung abrufen
- `setLanguage('de'|'en')` - Sprache wechseln
- Auto-Apply auf `[data-i18n]` Attribute

---

## 7. Regelwerke (Catalogs)

Hardcoded in index.html & gm-options.html:

| ID | Name | Icon |
|----|------|------|
| basis | Basis/Homebrew | icon_ruleset_basis.svg |
| fantasy-classic | Fantasy Classic | icon_ruleset_fantasy.svg |
| neon-abyss | Neon Abyss | icon_ruleset_neon.svg |
| rum-und-rache | Rum & Rache | icon_ruleset_rumundrache.svg |

---

## 8. Deployment

### Netlify Config (netlify.toml)
```toml
[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
```

### Service Worker (sw.js)
- Version: v77
- Cache-First Strategy
- Offline-Support für statische Assets

---

## 9. Entwicklungs-Workflow

1. **Lokal bearbeiten:** `C:\Users\mikel\Desktop\RIFT_MULTI\pnp_app\`
2. **Testen:** Lokal im Browser öffnen
3. **Commit:** User macht Git-Commits
4. **Push:** User pushed zu GitHub
5. **Deploy:** Netlify deployed automatisch

---

## 10. Offene Features / Roadmap

- [ ] GM-Bypass für Pause-Overlay (orangener Button)
- [ ] Combat Tracker
- [ ] Bestiary / Monster-Datenbank
- [ ] Voice Chat Integration
- [ ] Custom Dice Skins
- [ ] Weitere Sprachen (FR, ES, etc.)

---

## 11. Kontakt & Rechtliches

**Entwickler:** Mike Lusson
**E-Mail:** kontakt@rift-app.com
**Adresse:** Hauptstr. 5, 56479 Hellenhahn-Schellenberg, Deutschland

---

*Zuletzt aktualisiert: Januar 2026*

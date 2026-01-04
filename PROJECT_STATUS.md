# RIFT PnP Companion - Projekt Status

## Aktueller Stand: v77 (sw.js)

## Letzte Änderungen (Phase 42-51):

### GM Succession System ✅
- GM Logout → Nachfolger-Dialog
- 120s Grace Period mit Countdown-Banner
- Auto-Transfer zu ältestem Spieler
- Firebase-Validierung gegen localStorage-Manipulation
- 5s Verzögerung vor Banner (ignoriert Seitenwechsel)

### Karten-Modul Redesign ✅
- Startet blank mit Grid (kein Bild)
- GM kann Karte hochladen (PNG/JPG/WebP, max 5MB)
- "Karte ersetzen" / "Karte löschen" Buttons
- 10 Marker-Typen (nur Farben, keine Emojis):
  - Stadt, Dorf, Route, Gefahrenzone, Interessenspunkt
  - Quest, NPC, Unbekannt, Wichtig, Gegenstand
- Marker ohne Namen möglich
- Zoom-Anzeige blendet nach 1.5s aus
- Top Bar + FABs integriert

### Übersetzungen
- ~620 Keys (DE + EN)
- Alle neuen Map-Features übersetzt

## Projektstruktur
```
/home/claude/pnp_app/
├── assets/js/
│   ├── firebase-sync.js  (GM Succession, ~4000 Zeilen)
│   ├── lang.js           (~620 Translation Keys)
│   ├── auth.js
│   ├── nav.js
│   └── i18n.js
├── karte.html            (Redesigned)
├── charakterbogen.html
├── chat.html
├── wuerfel.html
├── whiteboard.html
├── notizen.html
├── gm-options.html
├── index.html (Hub)
├── login.html
└── sw.js (v77)
```

## Nächste mögliche Aufgaben:
- Combat Tracker
- Bestiary/Monster-Datenbank
- Voice Chat Integration
- Custom Dice Skins
- Weitere Sprachen

## Im neuen Chat sagen:
"Wir arbeiten am RIFT PnP Companion Projekt weiter. 
Bitte lies /home/claude/pnp_app/PROJECT_STATUS.md für den aktuellen Stand."

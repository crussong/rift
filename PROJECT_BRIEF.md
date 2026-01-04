# RIFT PnP Companion - Projekt Brief

## Was ist RIFT?
Web-basierte Companion App für Pen & Paper Rollenspiele. PWA (Progressive Web App) mit Echtzeit-Multiplayer über Firebase.

## Kerndaten
- **Version:** v77
- **Stack:** Vanilla HTML/CSS/JS + Firebase Realtime Database
- **Hosting:** Netlify (Auto-Deploy von GitHub)
- **Repo:** https://github.com/crussong/rift (privat)
- **Sprachen:** Deutsch, Englisch (~620 Translation Keys)

## Module
| Modul | Beschreibung |
|-------|--------------|
| Hub (index.html) | Startseite mit Quotes, Navigation, Quick Actions |
| Login | Raum erstellen/beitreten, Username/Farbe wählen |
| Charakterbogen | HTBAH-Regelwerk, Attribute, Begabungen, Inventar |
| Würfel | D4-D100, Modifikatoren, Echtzeit-Sync |
| Chat | Gruppen-Chat mit Timestamps |
| Karte | GM lädt Bild hoch, 10 Marker-Typen, Zoom/Pan |
| Whiteboard | Freihand-Zeichnen, Farben, Sync |
| Notizen | Persönliche Session-Notizen |
| GM Optionen | Spieler-Verwaltung, Module ein/aus, Timer, Pause |

## Besondere Features
- **GM Succession:** Automatischer GM-Transfer bei Disconnect (120s Grace Period)
- **Pause-System:** GM kann Spiel für alle pausieren
- **Module-Toggle:** GM kann Module für alle Spieler deaktivieren
- **Theme:** Dark/Light Mode
- **Offline:** Service Worker für Offline-Nutzung

## Lokale Entwicklung
```
C:\Users\mikel\Desktop\RIFT_MULTI\pnp_app\
```

## Workflow
1. Claude bearbeitet lokale Dateien
2. User reviewed Änderungen
3. User pushed zu GitHub
4. Netlify deployed automatisch

## Kontakt
Mike Lusson - kontakt@rift-app.com

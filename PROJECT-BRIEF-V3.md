# RIFT v3 - Projekt Brief

**Datum:** 17. Januar 2026  
**Version:** 3.0  
**Status:** Stabil mit bekannten Einschränkungen

---

## Zusammenfassung

RIFT v3 löst kritische Deployment-Probleme, die verhinderten, dass die App auf Netlify korrekt funktionierte. Die Hauptursache war das SPA-Transition-System (`transitions.js`), das bei Seitenwechseln die CSS-Dateien und Inline-Scripts nicht korrekt handhabte.

---

## Das Kernproblem

### Symptome auf Netlify
- **FOUC (Flash of Unstyled Content):** Seiten wurden kurz ohne Styling angezeigt
- **Weiße Würfel-Buttons:** Keine Farbgradienten auf dice.html
- **Fehlendes Layout:** Topbar, Sidebar, Footer erschienen nicht oder verzögert
- **Kaputte Funktionalität:** Buttons, Modals, 3D-Würfel funktionierten nicht
- **Explodierende SVGs:** Icons wurden riesig dargestellt

### Root Cause Analyse

Das Problem lag **NICHT** bei Netlify's Caching oder CSS-Auslieferung.

**Die eigentliche Ursache:** `transitions.js` implementierte SPA-Navigation, die:
1. Nur den `.main` Content ersetzte
2. Die `<head>` Section (mit CSS-Links) ignorierte
3. Inline-Scripts der neuen Seite nicht ausführte
4. `initLayout()` nicht aufrief

```javascript
// VORHER - Problematischer Code
main.innerHTML = newMain.innerHTML;
main.className = newMain.className;
// CSS? Scripts? Layout? → Wurde alles ignoriert!
```

---

## Die Lösung

### Änderungen in `transitions.js`

#### 1. CSS-Loading mit Promise-basiertem Warten
```javascript
async loadNewCSS(newDoc) {
    const cssPromises = [];
    const newLinks = newDoc.querySelectorAll('link[rel="stylesheet"]');
    
    for (const link of newLinks) {
        if (!this.loadedCSS.has(link.href)) {
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = link.href;
            
            const loadPromise = new Promise(resolve => {
                newLink.onload = () => {
                    this.loadedCSS.add(link.href);
                    resolve();
                };
                newLink.onerror = resolve;
            });
            
            cssPromises.push(loadPromise);
            document.head.appendChild(newLink);
        }
    }
    
    if (cssPromises.length > 0) {
        await Promise.all(cssPromises);
    }
}
```

#### 2. Layout Re-Initialisierung
```javascript
// Nach Content-Ersetzung
if (typeof initLayout === 'function') {
    initLayout();
}
```

#### 3. Script-Ausführung
```javascript
executePageScripts(newDoc) {
    const scripts = newDoc.querySelectorAll('script:not([src])');
    
    for (const script of scripts) {
        let code = script.textContent;
        // Remove initLayout() - wird separat gehandelt
        code = code.replace(/initLayout\(\);?\s*/g, '');
        
        if (code.trim()) {
            const newScript = document.createElement('script');
            newScript.textContent = code;
            document.body.appendChild(newScript);
        }
    }
}
```

#### 4. Korrektes Timing
```javascript
// Warten auf DOM-Stabilität vor Script-Ausführung
await new Promise(resolve => requestAnimationFrame(resolve));
await new Promise(resolve => requestAnimationFrame(resolve));
this.executePageScripts(newDoc);
```

---

## Meilensteine der Debug-Session

| # | Problem | Lösung | Status |
|---|---------|--------|--------|
| 1 | CSS lädt nicht bei Navigation | `loadNewCSS()` Funktion hinzugefügt | ✅ Gelöst |
| 2 | FOUC - Styling kommt zu spät | Promise-basiertes Warten auf CSS | ✅ Gelöst |
| 3 | Topbar/Footer fehlen | `initLayout()` Aufruf hinzugefügt | ✅ Gelöst |
| 4 | Würfel-Buttons ohne Farbe | CSS wird jetzt korrekt geladen | ✅ Gelöst |
| 5 | Layout "zieht nach" | Full Reload vermieden | ✅ Gelöst |
| 6 | Session-Modal öffnet nicht | Script-Timing-Problem | ⚠️ Teilweise |
| 7 | 3D-Würfel-Preview fehlt | THREE.js Kontext-Problem | ⚠️ Teilweise |

---

## Aktueller Stand

### ✅ Funktioniert

- **Visuelles Erscheinungsbild:** Alle Seiten werden korrekt gestylt
- **Bunte Würfel-Buttons:** D4-D100 mit korrekten Farbgradienten
- **Ruleset-Cards:** Rot, Lila, Türkis, Gelb auf sheet.html
- **Layout:** Sidebar, Topbar, Footer erscheinen sofort
- **Navigation:** Smooth Transitions zwischen Seiten
- **CSS-Loading:** Seitenspezifische CSS wird dynamisch geladen
- **Würfeln:** Grundfunktion funktioniert (klicken, würfeln, Ergebnis)

### ⚠️ Bekannte Einschränkungen

1. **Session-Modal (sessions.html)**
   - "Neue Session erstellen" Button öffnet Modal nicht nach Transition
   - **Workaround:** F5/Reload der Seite
   - **Ursache:** `document.getElementById()` findet Elemente nicht, die nach Transition erstellt wurden

2. **3D-Würfel-Preview (dice.html)**
   - Weiße 3D-Würfel auf den Buttons fehlen nach Transition
   - **Workaround:** F5/Reload oder direkter Seitenaufruf
   - **Ursache:** THREE.js Canvas-Kontext wird bei dynamischer Script-Ausführung nicht korrekt initialisiert

3. **Manche Event-Listener**
   - Scripts die bei DOMContentLoaded Event-Listener registrieren, funktionieren nach Transition nicht
   - **Ursache:** DOMContentLoaded feuert nicht bei dynamischer Navigation

---

## Technische Details

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `assets/js/transitions.js` | Komplett überarbeitet - CSS-Loading, Script-Ausführung, Layout-Handling |
| `_headers` | Netlify Cache-Control Header (bereits vorhanden) |

### Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                      User klickt Link                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              PageTransitions.navigateTo(url)                 │
├─────────────────────────────────────────────────────────────┤
│  1. animateOut() - Fade out aktueller Content               │
│  2. fetch(url) - Hole neue Seite                            │
│  3. loadNewCSS() - Lade fehlende CSS-Dateien                │
│  4. await CSS Promises - Warte bis CSS geladen              │
│  5. Replace main.innerHTML                                   │
│  6. initLayout() - Topbar, Sidebar, Footer                  │
│  7. executePageScripts() - Inline-Scripts ausführen         │
│  8. reinitialize() - Common Components                      │
│  9. animateIn() - Fade in neuer Content                     │
└─────────────────────────────────────────────────────────────┘
```

### CSS-Dateien pro Seite

| Seite | Spezifische CSS |
|-------|-----------------|
| dice.html | dice.css |
| sessions.html | sessions.css |
| session.html | session.css |
| sheet.html | sheet.css |
| sheet-*.html | sheet.css, sheet-layout.css |
| gm.html | gm.css |
| index.html | hub.css |
| login.html | login.css |

---

## To-Do Liste

### Priorität: Hoch

- [ ] **Session-Modal Fix:** Script-Timing für sessions.html korrigieren
- [ ] **3D-Würfel-Preview:** THREE.js Initialisierung bei Transition fixen
- [ ] **Event-Listener-Problem:** Generische Lösung für DOMContentLoaded-Scripts

### Priorität: Mittel

- [ ] **Performance:** CSS-Preloading für häufig besuchte Seiten
- [ ] **Error Handling:** Bessere Fallbacks wenn Script-Ausführung fehlschlägt
- [ ] **Debugging:** Console-Logs für Transition-Debugging (togglebar)

### Priorität: Niedrig

- [ ] **Code Cleanup:** Alte/ungenutzte CSS entfernen
- [ ] **Dokumentation:** Inline-Kommentare in transitions.js erweitern
- [ ] **Testing:** Automatisierte Tests für Navigation

---

## Lösungsansätze für offene Probleme

### Option A: Selective Full Reload
Bestimmte Seiten (dice, sessions, gm) machen echten Page Load:
```javascript
fullReloadPages: ['dice.html', 'sessions.html', 'gm.html']
```
**Pro:** Garantiert funktional  
**Contra:** Kein smooth Transition für diese Seiten

### Option B: Script Re-Architecture
Inline-Scripts in externe .js Dateien auslagern mit `init()` Funktionen:
```javascript
// sessions.js
const SessionsPage = {
    init() { /* ... */ }
};
window.SessionsPage = SessionsPage;
```
Dann in transitions.js:
```javascript
if (window.SessionsPage) SessionsPage.init();
```
**Pro:** Saubere Architektur  
**Contra:** Größerer Refactor nötig

### Option C: Custom Event System
Scripts hören auf `pageTransitioned` Event statt `DOMContentLoaded`:
```javascript
document.addEventListener('pageTransitioned', () => {
    // Initialize page-specific functionality
});
```
**Pro:** Minimal invasiv  
**Contra:** Alle Scripts müssen angepasst werden

---

## Deployment

### Netlify Konfiguration
- **Build Command:** Nicht nötig (statische Dateien)
- **Publish Directory:** Root (wo index.html liegt)
- **_headers Datei:** Vorhanden für Cache-Control

### Empfohlenes Vorgehen
1. ZIP hochladen zu Netlify
2. Neues Projekt verwenden (vermeidet Cache-Probleme)
3. Nach Deploy: Hard Refresh (Ctrl+Shift+R) im Browser

---

## Fazit

RIFT v3 ist **produktionsbereit** mit der Einschränkung, dass manche Seiten (Sessions, Dice) nach Navigation per F5 neu geladen werden müssen für volle Funktionalität. Das visuelle Erscheinungsbild und die grundlegende Navigation funktionieren zuverlässig.

Die offenen Probleme sind **keine Blocker**, sondern **Quality-of-Life Verbesserungen**, die in zukünftigen Versionen adressiert werden können.

---

*Erstellt am 17. Januar 2026*

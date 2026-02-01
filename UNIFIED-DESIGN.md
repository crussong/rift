# RIFT UNIFIED DESIGN SYSTEM

## HTML Struktur (PFLICHT für alle Seiten)

```html
<body>
    <!-- Unified Layout Placeholders -->
    <div id="topnav-placeholder"></div>
    <div id="meganav-placeholder"></div>
    
    <div class="app">
        <main class="main main--hub">
            <div class="main__content">
                <!-- DEIN CONTENT HIER -->
            </div>
        </main>
    </div>
    
    <!-- Dock Placeholder -->
    <div id="dock-placeholder"></div>
    
    <!-- Footer Placeholder -->
    <div id="footer-placeholder"></div>
</body>
```

## JavaScript

**layout-unified.js** injiziert automatisch:
- TopNav (in `#topnav-placeholder`)
- MegaNav (in `#meganav-placeholder`)
- Dock (in `#dock-placeholder`)
- Footer (in `#footer-placeholder` ODER am Ende von `.main__content`)

**KEINE manuelle Klassen-Manipulation nötig** - das JS macht nichts mit Layout-Klassen.

## CSS Variablen (dock.css)

```css
:root {
    --dock-height: 72px;
    --topnav-height-row1: 66px;
    --topnav-height-row2: 55px;
    --topnav-total-height: 121px;
    --content-max-width: 1500px;    /* Hintergrund + Container */
    --topnav-max-width: 1400px;     /* TopNav + MegaNav */
}
```

## Layout Breiten

| Element | max-width | padding | Effektive Breite |
|---------|-----------|---------|------------------|
| TopNav (.topnav__inner) | 1448px | 0 24px | 1400px |
| MegaNav (.meganav__inner) | 1448px | 0 24px | 1400px |
| Background (::before) | 1500px | - | 1500px |
| Content (.main__content) | 1500px | 0 50px | 1400px |

## Klassen

### PFLICHT
- `<div class="app">` - Hauptcontainer
- `<main class="main main--hub">` - Main mit Hub-Layout
- `<div class="main__content">` - Content Container

### VERBOTEN
- `app--new-layout` - EXISTIERT NICHT MEHR, wurde komplett entfernt

## Farben

| Element | Farbe |
|---------|-------|
| Body Background | #0a0a0a |
| Content Background (::before) | #111111 |
| TopNav Background | #1a1a1a |
| MegaNav Background | #111111 |
| Cards | var(--bg-card) = #2a2a2a |
| Elevated | var(--bg-elevated) = #1e1e1e |
| Border | var(--border) = rgba(255,255,255,0.06) |
| Border Hover | var(--border-hover) = rgba(255,255,255,0.12) |
| Accent | var(--accent) = #FF4655 |

## Checkliste für neue Seiten

- [ ] `<main class="main main--hub">` (NICHT nur `main`)
- [ ] `<div class="app">` (OHNE weitere Klassen)
- [ ] Placeholders: topnav, meganav, dock, footer
- [ ] Page-spezifische CSS hat KEIN eigenes max-width/padding für Container
- [ ] Content nutzt `width: 100%` und erbt Breite vom Parent

## Dateien

- **dock.css** - CSS Variablen, TopNav, MegaNav, Dock, Footer Styles
- **hub.css** - `.main--hub` Layout (Background, Content Container)
- **layout-unified.js** - Injiziert alle Layout-Komponenten
- **core.css** - Basis-Variablen (Farben, Fonts)

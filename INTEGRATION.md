# RIFT D&D 5e Sheet — Full Integration Package

## Overview

This package replaces the old sheet-5e-de.html (680K, single-file) with the new
modular sheet-5e.html (62K HTML + 75K CSS + 57K JS + 197K Wizard JS).

All routes (`/sheet/5e`, `/sheet/5e-de`, `/sheet/5e-en`) now point to the new sheet.

## New Files (drop into repo)

```
pages/sheets/sheet-5e.html          NEW — replaces old sheet-5e-de.html + sheet-5e-en.html + sheet-5e.html
assets/css/sheet-5e.css             NEW — replaces sheet-5e-v2.css (scoped under .s5e)
assets/js/sheet-5e.js               NEW — sheet logic + RiftLink bridge + CharacterStorage
assets/js/wizard-5e.js              NEW — 13-step character creation wizard
```

## Patched Files (drop-in replacements)

All these files have been patched to point `/sheet/5e-de` → `/sheet/5e`:

```
_redirects                          PATCHED — all 5e routes → sheet-5e.html
assets/js/transitions.js            UNCHANGED — already has /sheet/5e in fullReloadPages
assets/js/layout-unified.js         PATCHED — RULESET_INFO.dnd5e.sheet + dock sheetMap
assets/js/layout.js                 PATCHED — URL maps (5e-de, 5e-en → /sheet/5e)
assets/js/rift-context.js           PATCHED — RULESET_INFO.dnd5e.sheet
assets/js/header-controller.js      PATCHED — search result URL
pages/sheets/sheet.html             PATCHED — character picker sheetUrl
pages/hub.html                      PATCHED — sheet URL mappings
pages/gm.html                       PATCHED — GM sheet URL mapping
pages/session.html                  PATCHED — session sheet URL mapping + route format
index.html                          PATCHED — landing page sheet URL mappings
```

## Deprecated Files (can be removed later)

```
pages/sheets/sheet-5e-de.html       OLD — replaced by sheet-5e.html
pages/sheets/sheet-5e-en.html       OLD — replaced by sheet-5e.html
assets/css/sheet-5e-v2.css          OLD — replaced by sheet-5e.css
```

## URL Schema

```
/sheet/5e                    → New sheet (default)
/sheet/5e?new=true           → Force new character + auto-open Wizard
/sheet/5e?id=CHAR_ID         → Load existing character
/sheet/5e?id=CHAR_ID&room=XX → Load + connect RiftLink live sync
/sheet/5e-de                 → Backward compat, same as /sheet/5e
/sheet/5e-en                 → Backward compat, same as /sheet/5e
```

## Architecture

```
sheet-5e.html
  ├── RIFT Shell (topnav, meganav, dock, footer via layout-unified.js)
  ├── Auth guard (hidden until body.auth-ready)
  ├── Wizard Modal (13 steps)
  ├── HP Roll Modal
  └── Sheet content (scoped under .s5e)

sheet-5e.css
  ├── CSS variables (dark royal palette)
  ├── Sheet layout (tabs, grids, cards)
  ├── MD variable bridge (--md-* → .s5e vars for wizard compat)
  └── Wizard + HP Roll CSS

sheet-5e.js
  ├── S state object (single source of truth)
  ├── defaultState() — clean blank character
  ├── migrateState() — adds missing fields from updates
  ├── calc() — derived values (mods, proficiency, spell DC etc.)
  ├── render() — S → DOM
  ├── save() / load() — RiftLink + CharacterStorage + localStorage
  └── initRiftLink() — bidirectional Firebase sync with echo guard

wizard-5e.js (IIFE, no globals except window.openWizard etc.)
  ├── SRD spell database (245 spells, German translations)
  ├── Species / Class / Background data tables
  ├── HP calculation + roll modal
  ├── 13-step UI navigation
  ├── applyWizardData() → writes to S state object
  └── Auto-open on ?new=true
```

## Save/Load Flow

```
User edit → S.field = value → save()
  ├── RiftLink active? → RIFT.state.set('characters.ID', data)
  ├── CharacterStorage.save(id, data)
  └── localStorage cache

Load priority:
  1. URL ?id=XXX → CharacterStorage.getById()
  2. URL ?room=XXX → initRiftLink() → watchChar()
  3. localStorage fallback
  4. defaultState() (blank)
```

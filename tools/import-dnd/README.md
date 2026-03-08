# DnD Firestore Import

## Setup
1. Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Save as `serviceAccountKey.json` in this folder
3. Copy all `dnd-*.json` files from `assets/data/dnd/` into `./data/`

## Run
```bash
npm install firebase-admin
node import-dnd-to-firestore.js
```

## Flags
- Default: MERGE — preserves icon_url and other manual edits
- `--overwrite`: Full overwrite (use only for fresh import)

## Collections created
dnd_spells, dnd_monsters, dnd_magic_items, dnd_weapons, dnd_armor,
dnd_equipment, dnd_conditions, dnd_races, dnd_classes, dnd_backgrounds,
dnd_feats, dnd_invocations, dnd_food_drink, dnd_herbs_alchemy,
dnd_materials, dnd_misc_items

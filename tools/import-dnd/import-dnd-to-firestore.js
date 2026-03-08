/**
 * RIFT — DnD Catalog Bulk Import
 * Uploads all dnd-*.json files to Firestore.
 *
 * Usage:
 *   npm install firebase-admin
 *   node import-dnd-to-firestore.js
 *
 * Requires:
 *   - serviceAccountKey.json in the same folder
 *     (Firebase Console → Project Settings → Service Accounts → Generate new private key)
 *   - All dnd-*.json files in ./data/ subfolder
 *
 * Safe to re-run: uses set() with merge, won't wipe manual edits
 * unless you pass --overwrite flag.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT = require('./serviceAccountKey.json');
const DATA_DIR = path.join(__dirname, 'data');
const OVERWRITE = process.argv.includes('--overwrite');
const BATCH_SIZE = 400; // Firestore max is 500, keep margin

// Collection name → JSON filename
const COLLECTIONS = {
  dnd_spells:        'dnd-spells.json',
  dnd_monsters:      'dnd-monsters.json',
  dnd_magic_items:   'dnd-magic_items.json',
  dnd_weapons:       'dnd-weapons.json',
  dnd_armor:         'dnd-armor.json',
  dnd_equipment:     'dnd-equipment.json',
  dnd_conditions:    'dnd-conditions.json',
  dnd_races:         'dnd-races.json',
  dnd_classes:       'dnd-classes.json',
  dnd_backgrounds:   'dnd-backgrounds.json',
  dnd_feats:         'dnd-feats-2024.json',
  dnd_invocations:   'dnd-invocations-2024.json',
  dnd_food_drink:    'dnd-food_drink.json',
  dnd_herbs_alchemy: 'dnd-herbs_alchemy.json',
  dnd_materials:     'dnd-materials.json',
  dnd_misc_items:    'dnd-misc_items.json',
};
// ────────────────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT),
  databaseURL: 'https://rift-app-de805-default-rtdb.europe-west1.firebasedatabase.app',
});

const db = admin.firestore();

function makeDocId(entry, index) {
  // Prefer existing id field, otherwise slugify name_en or name
  if (entry.id) return String(entry.id);
  const name = entry.name_en || entry.name || '';
  if (name) return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `entry-${index}`;
}

async function importCollection(collectionName, filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  ⚠  ${filename} not found — skipping`);
    return 0;
  }

  const entries = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  console.log(`\n  ${collectionName} (${entries.length} entries)`);

  const colRef = db.collection(collectionName);
  let written = 0;

  // Process in batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (let j = 0; j < chunk.length; j++) {
      const entry = chunk[j];
      const docId = makeDocId(entry, i + j);
      const docRef = colRef.doc(docId);

      // Clean out undefined values (Firestore rejects them)
      const data = JSON.parse(JSON.stringify(entry));

      if (OVERWRITE) {
        batch.set(docRef, data);
      } else {
        // merge: preserves icon_url and other manual edits
        batch.set(docRef, data, { merge: true });
      }
    }

    await batch.commit();
    written += chunk.length;
    process.stdout.write(`    ${written}/${entries.length}...\r`);
  }

  console.log(`    ✓  ${written} docs written`);
  return written;
}

async function main() {
  console.log('RIFT DnD Catalog Import');
  console.log(`Mode: ${OVERWRITE ? 'OVERWRITE (manual edits will be lost!)' : 'MERGE (safe)'}`);
  console.log('─'.repeat(50));

  let total = 0;
  for (const [col, file] of Object.entries(COLLECTIONS)) {
    total += await importCollection(col, file);
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✓ Done — ${total} total docs imported`);
  process.exit(0);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// dnd-data.js  —  Zentrale D&D Datenbank für RIFT
// Lädt alle Collections aus Firestore (Fallback: statische JSON)
// Cached pro Session im Memory — ein Request, alle Seiten profitieren
//
// API:
//   await DndData.get('spells')              → Array aller Spells
//   await DndData.getOne('spells', 'fireball') → einzelner Eintrag by id/name
//   await DndData.getFiltered('spells', e => e.classes.includes('Wizard'))
//   DndData.ready('spells', callback)        → callback sobald geladen
//   DndData.preload(['spells','feats'])       → mehrere parallel vorladen
//
// Überschreibt window.SRD_SPELLS und window.CLASS_FEATS für wizard-5e.js
// ═══════════════════════════════════════════════════════════════════════════

const DndData = (() => {

    const COLLECTIONS = {
        spells:        'dnd_spells',
        monsters:      'dnd_monsters',
        magic_items:   'dnd_magic_items',
        weapons:       'dnd_weapons',
        armor:         'dnd_armor',
        equipment:     'dnd_equipment',
        conditions:    'dnd_conditions',
        races:         'dnd_races',
        classes:       'dnd_classes',
        backgrounds:   'dnd_backgrounds',
        feats:         'dnd_feats',
        invocations:   'dnd_invocations',
        food_drink:    'dnd_food_drink',
        herbs_alchemy: 'dnd_herbs_alchemy',
        materials:     'dnd_materials',
        misc_items:    'dnd_misc_items',
    };

    const JSON_FILES = {
        spells:        'dnd-spells.json',
        monsters:      'dnd-monsters.json',
        magic_items:   'dnd-magic_items.json',
        weapons:       'dnd-weapons.json',
        armor:         'dnd-armor.json',
        equipment:     'dnd-equipment.json',
        conditions:    'dnd-conditions.json',
        races:         'dnd-races.json',
        classes:       'dnd-classes.json',
        backgrounds:   'dnd-backgrounds.json',
        feats:         'dnd-feats-2024.json',
        invocations:   'dnd-invocations-2024.json',
        food_drink:    'dnd-food_drink.json',
        herbs_alchemy: 'dnd-herbs_alchemy.json',
        materials:     'dnd-materials.json',
        misc_items:    'dnd-misc_items.json',
    };

    const JSON_BASE = '/assets/data/dnd/';

    // ── Cache ────────────────────────────────────────────────────────────
    const _cache = {};          // key → Array
    const _pending = {};        // key → Promise (prevents duplicate fetches)
    const _callbacks = {};      // key → [fn, fn, ...]

    // ── Internal loader ──────────────────────────────────────────────────
    async function _load(key) {
        if (_cache[key]) return _cache[key];
        if (_pending[key]) return _pending[key];

        _pending[key] = (async () => {
            // 1. Always load JSON as baseline
            let data = [];
            const file = JSON_FILES[key];
            if (file) {
                try {
                    data = await fetch(JSON_BASE + file).then(r => {
                        if (!r.ok) throw new Error(r.status);
                        return r.json();
                    });
                    console.log('[DndData] JSON: ' + key + ' (' + data.length + ')');
                } catch (e) {
                    console.warn('[DndData] JSON failed for ' + key + ':', e.message);
                    data = [];
                }
            }

            // 2. Merge Firestore on top (icon_url, edits, etc.)
            const col = COLLECTIONS[key];
            if (col && typeof firebase !== 'undefined' && firebase.firestore) {
                try {
                    const snap = await firebase.firestore().collection(col).get();
                    if (!snap.empty) {
                        const fsMap = {};
                        snap.docs.forEach(d => { fsMap[d.id] = d.data(); });
                        // Merge into JSON entries by id
                        data = data.map(e => {
                            const id = e.id || e.name_en || '';
                            const fs = fsMap[id];
                            return fs ? Object.assign({}, e, fs) : e;
                        });
                        console.log('[DndData] Firestore merged: ' + key + ' (' + Object.keys(fsMap).length + ' entries updated)');
                    }
                } catch (e) {
                    console.warn('[DndData] Firestore merge failed for ' + key + ':', e.message);
                }
            }

            _cache[key] = data;
            delete _pending[key];

            // Fire ready callbacks
            if (_callbacks[key]) {
                _callbacks[key].forEach(fn => { try { fn(data); } catch(e) {} });
                delete _callbacks[key];
            }

            // ── Side effects: patch globals for wizard-5e.js ─────────────
            if (key === 'spells') _patchSrdSpells(data);
            if (key === 'feats')  _patchClassFeats(data);

            return data;
        })();

        return _pending[key];
    }

    // ── Public API ───────────────────────────────────────────────────────

    async function get(key) {
        return _load(key);
    }

    async function getOne(key, idOrName) {
        const data = await _load(key);
        const q = idOrName.toLowerCase();
        return data.find(e =>
            (e.id || '').toLowerCase() === q ||
            (e.name_en || '').toLowerCase() === q ||
            (e.name || '').toLowerCase() === q
        ) || null;
    }

    async function getFiltered(key, filterFn) {
        const data = await _load(key);
        return data.filter(filterFn);
    }

    // Register callback when a collection is ready
    function ready(key, fn) {
        if (_cache[key]) { try { fn(_cache[key]); } catch(e) {} return; }
        if (!_callbacks[key]) _callbacks[key] = [];
        _callbacks[key].push(fn);
        _load(key); // kick off load if not started
    }

    // Preload multiple collections in parallel
    function preload(keys) {
        keys.forEach(k => _load(k));
    }

    // Force-invalidate cache (e.g. after admin edit)
    function invalidate(key) {
        delete _cache[key];
        delete _pending[key];
        console.log('[DndData] Cache invalidated: ' + key);
    }

    function invalidateAll() {
        Object.keys(_cache).forEach(k => delete _cache[k]);
        Object.keys(_pending).forEach(k => delete _pending[k]);
        console.log('[DndData] Full cache cleared');
    }

    // ── SRD_SPELLS patch for wizard-5e.js ────────────────────────────────
    // wizard-5e.js uses: SRD_SPELLS.filter(s => s.level === X && s.classes.includes(cls))
    // Our Firestore data uses name_en, classes array, level number — compatible.
    function _patchSrdSpells(data) {
        if (!data || !data.length) return;
        // Normalize to wizard-5e format
        const normalized = data.map(e => ({
            name:    e.name_en || e.name || '',
            level:   typeof e.level === 'number' ? e.level : parseInt(e.level) || 0,
            school:  e.school || '',
            time:    e.casting_time || '',
            range:   e.range || '',
            damage:  e.damage || '—',
            classes: Array.isArray(e.classes) ? e.classes : (e.classes ? e.classes.split(',').map(s => s.trim()) : []),
            conc:    e.concentration === true || e.concentration === 'yes' || e.concentration === 1,
            ritual:  e.ritual === true || e.ritual === 'yes' || e.ritual === 1,
            desc:    e.description || '',
            icon_url: e.icon_url || null,
        }));
        window.SRD_SPELLS = normalized;
        console.log('[DndData] window.SRD_SPELLS patched (' + normalized.length + ' spells)');
    }

    // ── CLASS_FEATS patch for wizard-5e.js ───────────────────────────────
    // wizard-5e.js uses: CLASS_FEATS[cls] → array of feat objects
    function _patchClassFeats(data) {
        if (!data || !data.length) return;
        const byClass = {};
        data.forEach(e => {
            const feat = {
                name:         e.name_en || e.name || '',
                category:     e.category || 'General',
                prerequisite: e.prerequisite || e.prereq || '',
                desc:         e.description || '',
                icon_url:     e.icon_url || null,
            };
            // Feats can belong to multiple classes via category or explicit field
            const classes = Array.isArray(e.classes) ? e.classes :
                            (e.classes ? e.classes.split(',').map(s => s.trim()) : ['General']);
            classes.forEach(cls => {
                if (!byClass[cls]) byClass[cls] = [];
                byClass[cls].push(feat);
            });
            // Also put all feats under 'General' if no class restriction
            if (!e.classes || !e.classes.length) {
                if (!byClass['General']) byClass['General'] = [];
                byClass['General'].push(feat);
            }
        });
        window.CLASS_FEATS = byClass;
        console.log('[DndData] window.CLASS_FEATS patched (' + Object.keys(byClass).length + ' classes)');
    }

    // ── Auto-preload on init ─────────────────────────────────────────────
    // Preload the most-needed collections immediately when script loads.
    // Wizard and character sheet need spells + feats most urgently.
    (function autoPreload() {
        // Wait for Firebase to be ready
        function tryPreload() {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
                preload(['spells', 'feats', 'weapons', 'armor', 'equipment', 'magic_items']);
            } else {
                setTimeout(tryPreload, 200);
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryPreload);
        } else {
            tryPreload();
        }
    })();

    return { get, getOne, getFiltered, ready, preload, invalidate, invalidateAll };

})();

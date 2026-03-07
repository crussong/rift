// ═══════════════════════════════════════════════════════════════
// RIFT DnD Database  —  Zentrale Datenbankschicht
// Zugriff für: Charakterbogen, Whiteboard, GM-Tools
//
// Dateien (assets/data/):
//   rift_db_spells.json   — 1.450 Zaubersprüche
//   rift_db_weapons.json  — 624  Waffen
//   rift_db_armors.json   — 1.159 Rüstungen
//   rift_db_items.json    — 3.235 Items
//
// API:
//   await RiftDB.ready           — Promise, resolved wenn alle Dateien geladen
//   await RiftDB.cat('spell')    — Lädt Kategorie lazy, gibt Einträge zurück
//   RiftDB.get(id)               — Entry by ID
//   RiftDB.find(opts)            — Suche: { q, category, level, school, rarity, class, limit }
//   RiftDB.spells(opts)          — Gefilterte Spells
//   RiftDB.weapons(opts)         — Gefilterte Waffen
//   RiftDB.armor(opts)           — Gefilterte Rüstungen
//   RiftDB.items(opts)           — Gefilterte Items
//   RiftDB.icon(id)              — { url, name, label } für Entry
//   RiftDB.spell(slug)           — Spell by slug
//   RiftDB.bestIcon(name, cat)   — Bestes Icon für Name + Kategorie
//   RiftDB.count                 — Anzahl geladener Einträge
// ═══════════════════════════════════════════════════════════════

const RiftDB = (() => {

  const BASE = '/assets/data/';
  const FILES = {
    spell:  BASE + 'rift_db_spells.json',
    weapon: BASE + 'rift_db_weapons.json',
    armor:  BASE + 'rift_db_armors.json',
    item:   BASE + 'rift_db_items.json',
  };

  const _cats  = { spell: null, weapon: null, armor: null, item: null };
  const _byId  = {};
  let   _all   = null;
  let   _resolve = null;

  const ready = new Promise(res => { _resolve = res; });

  // ── Loader ────────────────────────────────────────────────────────────────

  async function _loadCat(cat) {
    if (_cats[cat]) return _cats[cat];
    try {
      const r = await fetch(FILES[cat]);
      const j = await r.json();
      const entries = j.entries || [];
      _cats[cat] = entries;
      for (const e of entries) _byId[e.id] = e;
      return entries;
    } catch (err) {
      console.error(`[RiftDB] Laden fehlgeschlagen (${cat}):`, err);
      _cats[cat] = [];
      return [];
    }
  }

  async function _loadAll() {
    await Promise.all(Object.keys(FILES).map(_loadCat));
    _all = [
      ...(_cats.spell  || []),
      ...(_cats.weapon || []),
      ...(_cats.armor  || []),
      ...(_cats.item   || []),
    ];
    _resolve(_all);
  }
  _loadAll();

  // ── Interne Helpers ───────────────────────────────────────────────────────

  function _pool()    { return _all || []; }
  function _getCat(c) { return _cats[c] || []; }

  function _normalize(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ß/g, 'ss');
  }

  function _matches(e, opts = {}) {
    if (opts.id       && e.id !== opts.id)                                  return false;
    if (opts.category && e.category !== opts.category)                      return false;
    if (opts.school   && e.school !== opts.school)                          return false;
    if (opts.level    !== undefined && e.level !== opts.level)              return false;
    if (opts.rarity   && e.rarity !== opts.rarity)                         return false;
    if (opts.class) {
      const cls = e.classes || [];
      if (!cls.some(c => c.toLowerCase().includes(opts.class.toLowerCase()))) return false;
    }
    if (opts.q) {
      const q   = _normalize(opts.q);
      const hay = _normalize(
        [e.name_de, e.name_en, e.icon_label, e.desc, e.subcategory_de, e.slug]
          .filter(Boolean).join(' ')
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function _bestMatch(cat, name) {
    if (!name || !_all) return null;
    const pool = cat ? _getCat(cat) : _pool();
    const norm = _normalize(name);
    let hit = pool.find(e => _normalize(e.name_de) === norm || _normalize(e.name_en || '') === norm);
    if (hit) return hit;
    hit = pool.find(e =>
      _normalize(e.name_de).includes(norm) || norm.includes(_normalize(e.name_de))
    );
    if (hit) return hit;
    const words = norm.split(/\s+/).filter(w => w.length > 2).sort((a, b) => b.length - a.length);
    for (const w of words) {
      hit = pool.find(e =>
        _normalize(e.name_de).includes(w) || _normalize(e.name_en || '').includes(w)
      );
      if (hit) return hit;
    }
    return null;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    ready,

    /** Lädt eine Kategorie lazy und gibt ihre Einträge zurück. */
    async cat(cat) {
      return _loadCat(cat);
    },

    /** Entry by ID. Gibt null zurück wenn nicht gefunden. */
    get(id) {
      return _byId[id] || null;
    },

    /** Flexible Suche. opts: { q, category, school, level, rarity, class, limit } */
    find(opts = {}) {
      return _pool().filter(e => _matches(e, opts)).slice(0, opts.limit || 100);
    },

    /** Spells. opts: { q, school, level, class, concentration, ritual, damage_type, limit } */
    spells(opts = {}) {
      let res = _getCat('spell').filter(e => _matches(e, { ...opts, category: 'spell' }));
      if (opts.concentration !== undefined) res = res.filter(e => e.concentration === opts.concentration);
      if (opts.ritual        !== undefined) res = res.filter(e => e.ritual        === opts.ritual);
      if (opts.damage_type)                 res = res.filter(e => e.damage_type   === opts.damage_type);
      return res.slice(0, opts.limit || 500);
    },

    /** Waffen. opts: { q, rarity, weapon_type, limit } */
    weapons(opts = {}) {
      let res = _getCat('weapon').filter(e => _matches(e, { ...opts, category: 'weapon' }));
      if (opts.weapon_type) res = res.filter(e => e.weapon_type === opts.weapon_type);
      return res.slice(0, opts.limit || 500);
    },

    /** Rüstungen. opts: { q, armor_type, armor_slot, rarity, limit } */
    armor(opts = {}) {
      let res = _getCat('armor').filter(e => _matches(e, { ...opts, category: 'armor' }));
      if (opts.armor_type) res = res.filter(e => e.armor_type === opts.armor_type);
      if (opts.armor_slot) res = res.filter(e => e.armor_slot === opts.armor_slot);
      return res.slice(0, opts.limit || 500);
    },

    /** Items. opts: { q, subcategory, rarity, limit } */
    items(opts = {}) {
      let res = _getCat('item').filter(e => _matches(e, { ...opts, category: 'item' }));
      if (opts.subcategory) res = res.filter(e => e.subcategory_de === opts.subcategory);
      return res.slice(0, opts.limit || 500);
    },

    /** Icon-Daten für Entry-ID. Gibt { url, name, label } oder null zurück. */
    icon(id) {
      const e = this.get(id);
      if (!e || !e.icon_url) return null;
      return { url: e.icon_url, name: e.icon_name || '', label: e.icon_label || '' };
    },

    /** Spell by slug (z. B. 'fireball'). */
    spell(slug) {
      return _getCat('spell').find(e => e.slug === slug) || null;
    },

    /** Anzahl geladener Einträge gesamt. */
    get count() { return _all ? _all.length : 0; },

    /** Bestes Icon für Name + optionale Kategorie. Gibt icon_url oder null zurück. */
    bestIcon(name, category) {
      return _bestMatch(category || null, name)?.icon_url || null;
    },
  };
})();

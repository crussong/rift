// ═══════════════════════════════════════════════════════════════
// RIFT DnD Database  —  Zentrale Datenbankschicht
// Zugriff für: Charakterbogen, Whiteboard, GM-Tools
//
// API:
//   RiftDB.ready          — Promise, resolved wenn DB geladen
//   RiftDB.get(id)        — Entry by ID
//   RiftDB.find(query)    — Suche (name, category, school, ...)
//   RiftDB.spells(opts)   — Alle Spells, optional gefiltert
//   RiftDB.weapons(opts)  — Alle Waffen
//   RiftDB.armor(opts)    — Alle Rüstungen
//   RiftDB.items(opts)    — Alle Items
//   RiftDB.icon(id)       — { url, name, label } für Entry
// ═══════════════════════════════════════════════════════════════

const RiftDB = (() => {
  const DB_URL = '/assets/data/rift_dnd_database.json';

  let _entries = null;
  let _byId    = null;
  let _resolve = null;

  const ready = new Promise(res => { _resolve = res; });

  // ── Load
  async function _load() {
    if (_entries) return;
    try {
      const r = await fetch(DB_URL);
      const j = await r.json();
      _entries = j.entries || [];
      _byId    = {};
      for (const e of _entries) _byId[e.id] = e;
      _resolve(_entries);
    } catch(err) {
      console.error('[RiftDB] Laden fehlgeschlagen:', err);
      _entries = [];
      _byId    = {};
      _resolve([]);
    }
  }
  _load();

  // ── Internal helpers
  function _all()       { return _entries || []; }
  function _cat(c)      { return _all().filter(e => e.category === c); }

  function _matches(e, opts = {}) {
    if (opts.id       && e.id !== opts.id)                                   return false;
    if (opts.category && e.category !== opts.category)                       return false;
    if (opts.school   && e.school !== opts.school)                           return false;
    if (opts.level    !== undefined && e.level !== opts.level)               return false;
    if (opts.rarity   && e.rarity !== opts.rarity)                           return false;
    if (opts.class) {
      const classes = e.classes || [];
      if (!classes.some(c => c.toLowerCase().includes(opts.class.toLowerCase()))) return false;
    }
    if (opts.q) {
      const q = opts.q.toLowerCase();
      const searchable = [e.name_de, e.name_en, e.icon_label, e.desc, e.subcategory_de]
        .filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  }

  // ── Public API
  return {
    ready,

    /** Entry by ID. Returns null if not found. */
    get(id) {
      return (_byId && _byId[id]) || null;
    },

    /** Flexible search across all entries.
     *  opts: { q, category, school, level, rarity, class, limit }
     */
    find(opts = {}) {
      const limit = opts.limit || 100;
      return _all().filter(e => _matches(e, opts)).slice(0, limit);
    },

    /** All spells. opts: { q, school, level, class, concentration, ritual, limit } */
    spells(opts = {}) {
      let res = _cat('spell').filter(e => _matches(e, { ...opts, category: 'spell' }));
      if (opts.concentration !== undefined) res = res.filter(e => e.concentration === opts.concentration);
      if (opts.ritual !== undefined)        res = res.filter(e => e.ritual === opts.ritual);
      if (opts.damage_type) res = res.filter(e => e.damage_type === opts.damage_type);
      return res.slice(0, opts.limit || 500);
    },

    /** All weapons. opts: { q, rarity, limit } */
    weapons(opts = {}) {
      return _cat('weapon').filter(e => _matches(e, { ...opts, category: 'weapon' }))
        .slice(0, opts.limit || 500);
    },

    /** All armor. opts: { q, armor_type, armor_slot, rarity, limit } */
    armor(opts = {}) {
      let res = _cat('armor').filter(e => _matches(e, { ...opts, category: 'armor' }));
      if (opts.armor_type) res = res.filter(e => e.armor_type === opts.armor_type);
      if (opts.armor_slot) res = res.filter(e => e.armor_slot === opts.armor_slot);
      return res.slice(0, opts.limit || 500);
    },

    /** All items. opts: { q, subcategory, rarity, limit } */
    items(opts = {}) {
      let res = _cat('item').filter(e => _matches(e, { ...opts, category: 'item' }));
      if (opts.subcategory) res = res.filter(e => e.subcategory === opts.subcategory);
      return res.slice(0, opts.limit || 500);
    },

    /** Icon data for an entry id. Returns { url, name, label } or null. */
    icon(id) {
      const e = this.get(id);
      if (!e || !e.icon_url) return null;
      return { url: e.icon_url, name: e.icon_name || '', label: e.icon_label || '' };
    },

    /** Spell by slug (e.g. 'fireball'). */
    spell(slug) {
      return _all().find(e => e.category === 'spell' && e.slug === slug) || null;
    },

    /** How many entries are loaded. */
    get count() { return _entries ? _entries.length : 0; },
  };
})();

// Auto-load on import
// Usage:
//   await RiftDB.ready;
//   const fireball = RiftDB.spell('fireball');
//   const swords   = RiftDB.weapons({ q: 'schwert' });
//   const fireIcons = RiftDB.spells({ damage_type: 'Feuer', school: 'evocation' });

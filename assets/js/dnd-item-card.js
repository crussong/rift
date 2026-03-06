/**
 * RIFT D&D Item Card
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable item view modal. Displays full stat block for spells, weapons,
 * armor, equipment, and magic items from rift_dnd_database.json
 *
 * Usage:
 *   await RiftItemCard.init('/assets/data/rift_dnd_database.json');
 *   RiftItemCard.show('spells', 'fireball');
 *   RiftItemCard.show('weapons', 'longsword');
 *   RiftItemCard.show('magic_items', 'bag-of-holding');
 *
 * Events dispatched on document:
 *   rift-ic-roll   → { detail: { formula, label } }
 *   rift-ic-add    → { detail: { type, index, entry } }
 * ─────────────────────────────────────────────────────────────────────────────
 */

const RiftItemCard = (() => {
  'use strict';

  let _db = null;
  let _el = null; // backdrop element

  // ── SVG icons (inline, no emojis) ─────────────────────────────────────────
  const SVG = {
    close: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>`,
    dice:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="3"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1" fill="currentColor"/></svg>`,
    plus:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`,
    copy:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="9" height="9" rx="2"/><path d="M11 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v8a1 1 0 001 1h1"/></svg>`,
  };

  // ── Translations ───────────────────────────────────────────────────────────
  const SCHOOL_COLOR = {
    evocation: '#ff8a95', conjuration: '#c4b5fd', illusion: '#818cf8',
    necromancy: '#94a3b8', abjuration: '#7dd3fc', transmutation: '#6ee7b7',
    enchantment: '#f9a8d4', divination: '#fde68a',
  };

  function levelLabel(level) {
    if (level === 0) return 'Zaubertrick';
    return `${level}. Grad`;
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────
  function _build() {
    const el = document.createElement('div');
    el.className = 'rift-ic-backdrop';
    el.innerHTML = `
      <div class="rift-ic-card" role="dialog" aria-modal="true">
        <div class="rift-ic-header">
          <div class="rift-ic-icon-wrap">
            <img class="rift-ic-icon-img" src="" alt="" loading="lazy"/>
          </div>
          <div class="rift-ic-title-block">
            <p class="rift-ic-name"></p>
            <p class="rift-ic-name-de"></p>
            <div class="rift-ic-meta"></div>
          </div>
          <button class="rift-ic-close" aria-label="Schließen">${SVG.close}</button>
        </div>
        <div class="rift-ic-stats"></div>
        <div class="rift-ic-body">
          <p class="rift-ic-desc"></p>
          <div class="rift-ic-higher-level" style="display:none">
            <div class="rift-ic-higher-level__label">Auf höheren Graden</div>
            <div class="rift-ic-higher-level__text"></div>
          </div>
        </div>
        <div class="rift-ic-footer"></div>
      </div>
    `;

    // Close handlers
    el.querySelector('.rift-ic-close').addEventListener('click', hide);
    el.addEventListener('click', e => { if (e.target === el) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });

    document.body.appendChild(el);
    return el;
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function _tag(text, cls, extra = '') {
    return `<span class="rift-ic-tag rift-ic-tag--${cls}" ${extra}>${text}</span>`;
  }

  function _stat(label, value, cls = '') {
    if (!value && value !== 0) return '';
    return `
      <div class="rift-ic-stat">
        <span class="rift-ic-stat__label">${label}</span>
        <span class="rift-ic-stat__value ${cls}">${value}</span>
      </div>`;
  }

  function _statWide(label, value, cls = '') {
    if (!value && value !== 0) return '';
    return `
      <div class="rift-ic-stat rift-ic-stat--wide">
        <span class="rift-ic-stat__label">${label}</span>
        <span class="rift-ic-stat__value ${cls}">${value}</span>
      </div>`;
  }

  function _components(comps, material) {
    if (!comps || !comps.length) return '';
    const pills = comps.map(c => `<span class="rift-ic-comp">${c}</span>`).join('');
    let mat = '';
    if (material && comps.includes('M')) {
      mat = `<span style="font-size:10px;color:rgba(255,255,255,0.3);font-style:italic;margin-left:4px">(${material})</span>`;
    }
    return `
      <div class="rift-ic-stat rift-ic-stat--wide">
        <span class="rift-ic-stat__label">Komponenten</span>
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:3px">
          ${pills}${mat}
        </div>
      </div>`;
  }

  // ── Render by type ─────────────────────────────────────────────────────────
  function _renderSpell(entry) {
    const Q = _el;
    const card = Q.querySelector('.rift-ic-card');
    card.removeAttribute('data-rarity');

    // Header
    Q.querySelector('.rift-ic-name').textContent = entry.name;
    const nameDe = entry.name_de !== entry.name ? entry.name_de : '';
    Q.querySelector('.rift-ic-name-de').textContent = nameDe;

    // Tags
    let tags = levelLabel(entry.level);
    const schoolColor = SCHOOL_COLOR[entry.school_en] || '#a78bfa';
    let metaHtml = _tag(levelLabel(entry.level), 'level')
      + _tag(entry.school, 'school', `style="color:${schoolColor}"`)
    if (entry.damage_type) metaHtml += _tag(entry.damage_type, 'damage');
    if (entry.concentration) metaHtml += _tag('Konz.', 'conc');
    if (entry.ritual) metaHtml += _tag('Ritual', 'ritual');
    Q.querySelector('.rift-ic-meta').innerHTML = metaHtml;

    // Stats
    let dc = '';
    if (entry.dc_attribute) {
      const success = entry.dc_success === 'half' ? '(halber Schaden)' : entry.dc_success === 'none' ? '' : '';
      dc = `${entry.dc_attribute} ${success}`.trim();
    }
    const aoe = entry.aoe && entry.aoe.type
      ? `${entry.aoe.size} Fuß ${_aoeLabel(entry.aoe.type)}`
      : '';

    Q.querySelector('.rift-ic-stats').innerHTML =
      _stat('Wirkzeit',      entry.casting_time) +
      _stat('Reichweite',    entry.range) +
      _stat('Dauer',         entry.duration) +
      (entry.damage ? _stat('Schaden', entry.damage + (entry.damage_type ? ' ' + entry.damage_type : ''), 'rift-ic-stat__value--damage') : '') +
      (dc            ? _stat('Rettungswurf', dc)   : '') +
      (aoe           ? _stat('Wirkungsbereich', aoe) : '') +
      _components(entry.components, entry.material);

    // Description
    Q.querySelector('.rift-ic-desc').textContent = entry.description;
    const hlEl = Q.querySelector('.rift-ic-higher-level');
    if (entry.higher_level) {
      hlEl.style.display = '';
      hlEl.querySelector('.rift-ic-higher-level__text').textContent = entry.higher_level;
    } else {
      hlEl.style.display = 'none';
    }

    // Footer
    const hasRoll = entry.damage && /\d+d\d+/.test(entry.damage);
    const rollLabel = entry.damage ? `${entry.damage}${entry.damage_type ? ' ' + entry.damage_type : ''}` : '';
    Q.querySelector('.rift-ic-footer').innerHTML = `
      ${hasRoll ? `<button class="rift-ic-btn rift-ic-btn--secondary rift-ic-roll-btn" data-formula="${entry.damage}" data-label="${entry.name}">${SVG.dice} Würfeln</button>` : ''}
      <button class="rift-ic-btn rift-ic-btn--primary rift-ic-add-btn">${SVG.plus} Hinzufügen</button>
    `;
    _attachFooterListeners('spells', entry);
  }

  function _renderWeapon(entry) {
    const Q = _el;
    Q.querySelector('.rift-ic-card').removeAttribute('data-rarity');
    Q.querySelector('.rift-ic-name').textContent = entry.name;
    Q.querySelector('.rift-ic-name-de').textContent = entry.name_de !== entry.name ? entry.name_de : '';

    const rangeLabel = entry.range === 'melee' ? 'Nahkampf' : 'Fernkampf';
    Q.querySelector('.rift-ic-meta').innerHTML =
      _tag('Waffe', 'cat') +
      _tag(entry.category, 'level') +
      _tag(rangeLabel, 'range');

    let propsHtml = '';
    if (entry.properties && entry.properties.length) {
      propsHtml = _statWide('Eigenschaften', entry.properties.join(', '));
    }
    Q.querySelector('.rift-ic-stats').innerHTML =
      _stat('Schaden',       entry.damage, 'rift-ic-stat__value--damage') +
      (entry.two_handed_damage ? _stat('Zweihand', entry.two_handed_damage, 'rift-ic-stat__value--damage') : '') +
      _stat('Reichweite',    rangeLabel) +
      _stat('Kosten',        entry.cost) +
      _stat('Gewicht',       entry.weight ? `${entry.weight} lb` : '') +
      propsHtml;

    Q.querySelector('.rift-ic-desc').textContent = '';
    Q.querySelector('.rift-ic-higher-level').style.display = 'none';

    const hasRoll = entry.damage && /\d+d\d+/.test(entry.damage);
    Q.querySelector('.rift-ic-footer').innerHTML = `
      ${hasRoll ? `<button class="rift-ic-btn rift-ic-btn--secondary rift-ic-roll-btn" data-formula="${entry.damage.split(' ')[0]}" data-label="${entry.name}">${SVG.dice} Würfeln</button>` : ''}
      <button class="rift-ic-btn rift-ic-btn--primary rift-ic-add-btn">${SVG.plus} Hinzufügen</button>
    `;
    _attachFooterListeners('weapons', entry);
  }

  function _renderArmor(entry) {
    const Q = _el;
    Q.querySelector('.rift-ic-card').removeAttribute('data-rarity');
    Q.querySelector('.rift-ic-name').textContent = entry.name;
    Q.querySelector('.rift-ic-name-de').textContent = entry.name_de !== entry.name ? entry.name_de : '';

    Q.querySelector('.rift-ic-meta').innerHTML =
      _tag('Rüstung', 'cat') +
      _tag(entry.category || '', 'level');

    Q.querySelector('.rift-ic-stats').innerHTML =
      _stat('Rüstungsklasse', entry.ac, 'rift-ic-stat__value--ac') +
      _stat('Kategorie',      entry.category) +
      _stat('Min. STR',       entry.str_minimum || '') +
      _stat('Kosten',         entry.cost) +
      _stat('Gewicht',        entry.weight ? `${entry.weight} lb` : '') +
      (entry.stealth_disadvantage ? _statWide('Schleichen', 'Nachteil') : '');

    Q.querySelector('.rift-ic-desc').textContent = '';
    Q.querySelector('.rift-ic-higher-level').style.display = 'none';
    Q.querySelector('.rift-ic-footer').innerHTML = `
      <button class="rift-ic-btn rift-ic-btn--primary rift-ic-add-btn">${SVG.plus} Hinzufügen</button>
    `;
    _attachFooterListeners('armor', entry);
  }

  function _renderEquipment(entry) {
    const Q = _el;
    Q.querySelector('.rift-ic-card').removeAttribute('data-rarity');
    Q.querySelector('.rift-ic-name').textContent = entry.name;
    Q.querySelector('.rift-ic-name-de').textContent = entry.name_de !== entry.name ? entry.name_de : '';

    Q.querySelector('.rift-ic-meta').innerHTML = _tag(entry.category || 'Ausrüstung', 'cat');

    Q.querySelector('.rift-ic-stats').innerHTML =
      _stat('Kosten',   entry.cost) +
      _stat('Gewicht',  entry.weight ? `${entry.weight} lb` : '');

    Q.querySelector('.rift-ic-desc').textContent = entry.description || '';
    Q.querySelector('.rift-ic-higher-level').style.display = 'none';
    Q.querySelector('.rift-ic-footer').innerHTML = `
      <button class="rift-ic-btn rift-ic-btn--primary rift-ic-add-btn">${SVG.plus} Hinzufügen</button>
    `;
    _attachFooterListeners('equipment', entry);
  }

  function _renderMagicItem(entry) {
    const Q = _el;
    Q.querySelector('.rift-ic-card').setAttribute('data-rarity', entry.rarity || 'common');
    Q.querySelector('.rift-ic-name').textContent = entry.name;
    Q.querySelector('.rift-ic-name-de').textContent = entry.name_de !== entry.name ? entry.name_de : '';

    let metaHtml = _tag(entry.rarity_en || entry.rarity, entry.rarity || 'common');
    if (entry.requires_attunement) metaHtml += _tag('Beschwörung nötig', 'conc');
    if (entry.category) metaHtml += _tag(entry.category, 'cat');
    Q.querySelector('.rift-ic-meta').innerHTML = metaHtml;

    Q.querySelector('.rift-ic-stats').innerHTML = `
      ${entry.rarity_en ? _stat('Seltenheit', entry.rarity_en) : ''}
      ${_stat('Abstimmung', entry.requires_attunement ? 'Ja' : 'Nein')}
    `;

    Q.querySelector('.rift-ic-desc').textContent = entry.description || '';
    Q.querySelector('.rift-ic-higher-level').style.display = 'none';
    Q.querySelector('.rift-ic-footer').innerHTML = `
      <button class="rift-ic-btn rift-ic-btn--secondary rift-ic-copy-btn">${SVG.copy} Kopieren</button>
      <button class="rift-ic-btn rift-ic-btn--primary rift-ic-add-btn">${SVG.plus} Hinzufügen</button>
    `;
    _attachFooterListeners('magic_items', entry);
  }

  function _attachFooterListeners(type, entry) {
    const Q = _el;
    const rollBtn = Q.querySelector('.rift-ic-roll-btn');
    const addBtn  = Q.querySelector('.rift-ic-add-btn');
    const copyBtn = Q.querySelector('.rift-ic-copy-btn');

    if (rollBtn) {
      rollBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('rift-ic-roll', {
          detail: { formula: rollBtn.dataset.formula, label: rollBtn.dataset.label }
        }));
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('rift-ic-add', {
          detail: { type, entry }
        }));
        hide();
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = [entry.name, entry.description].filter(Boolean).join('\n\n');
        navigator.clipboard?.writeText(text);
      });
    }
  }

  // ── Icon ───────────────────────────────────────────────────────────────────
  function _setIcon(entry) {
    const img = _el.querySelector('.rift-ic-icon-img');
    if (entry.icon_url) {
      img.src = entry.icon_url;
      img.alt = entry.icon_name || entry.name;
    } else {
      img.src = '';
      img.alt = '';
    }
    // Level badge for spells
    const existing = _el.querySelector('.rift-ic-level-badge');
    if (existing) existing.remove();
    if (typeof entry.level === 'number') {
      const badge = document.createElement('span');
      badge.className = 'rift-ic-level-badge';
      badge.textContent = entry.level === 0 ? 'C' : `${entry.level}`;
      _el.querySelector('.rift-ic-icon-wrap').appendChild(badge);
    }
  }

  function _aoeLabel(type) {
    const map = { sphere: 'Kugel', cone: 'Kegel', cube: 'Würfel', cylinder: 'Zylinder', line: 'Linie', square: 'Quadrat' };
    return map[type] || type;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async function init(dbUrl) {
    if (_db) return;
    const res = await fetch(dbUrl);
    _db = await res.json();
    _el = _build();
  }

  function setDb(db) {
    _db = db;
    if (!_el) _el = _build();
  }

  function show(type, index) {
    if (!_db) { console.warn('[RiftItemCard] DB not loaded'); return; }
    if (!_el) _el = _build();

    const section = _db[type];
    if (!section) { console.warn('[RiftItemCard] Unknown type:', type); return; }
    const entry = section[index];
    if (!entry) { console.warn('[RiftItemCard] Entry not found:', type, index); return; }

    _setIcon(entry);

    if (type === 'spells')      _renderSpell(entry);
    else if (type === 'weapons') _renderWeapon(entry);
    else if (type === 'armor')   _renderArmor(entry);
    else if (type === 'equipment') _renderEquipment(entry);
    else if (type === 'magic_items') _renderMagicItem(entry);

    _el.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function showEntry(type, entry) {
    if (!_el) _el = _build();
    _setIcon(entry);
    if (type === 'spells')      _renderSpell(entry);
    else if (type === 'weapons') _renderWeapon(entry);
    else if (type === 'armor')   _renderArmor(entry);
    else if (type === 'equipment') _renderEquipment(entry);
    else if (type === 'magic_items') _renderMagicItem(entry);
    _el.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    if (!_el) return;
    _el.classList.remove('visible');
    document.body.style.overflow = '';
  }

  function getDb() { return _db; }

  return { init, setDb, show, showEntry, hide, getDb };
})();

// Expose globally
window.RiftItemCard = RiftItemCard;

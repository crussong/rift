/**
 * ═══════════════════════════════════════════════════════════════
 *  RIFT Inventory — Diablo-Style Spatial Grid
 *
 *  Items occupy gridW × gridH cells. Each item stores placement
 *  {col, row}. A 2D occupancy map tracks collisions.
 *  Items render as absolutely-positioned overlays via CSS grid.
 *
 *  Data model:
 *    item.gridW, item.gridH  — size in cells
 *    item.col, item.row      — top-left placement (null = unplaced)
 *    item.icon                — Cloudinary URL for item image
 *
 *  Init:  RiftInventory.init(getCharFn, saveCharFn, charId)
 *  API:   .render(), .addItem(), .removeItem(), .loadStarterKit()
 * ═══════════════════════════════════════════════════════════════
 */

const RiftInventory = (() => {
    'use strict';

    // ═══════════════════════════════════════
    //  CONSTANTS
    // ═══════════════════════════════════════

    const GRID_COLS = 16;
    const GRID_ROWS = 11;

    const RARITY = {
        common:    { color: '#9a9aaa', bg: 'rgba(154,154,170,0.06)', border: 'rgba(154,154,170,0.22)', label: 'Gewöhnlich' },
        uncommon:  { color: '#2ecc71', bg: 'rgba(46,204,113,0.06)',  border: 'rgba(46,204,113,0.28)',  label: 'Ungewöhnlich' },
        rare:      { color: '#3498db', bg: 'rgba(52,152,219,0.07)',  border: 'rgba(52,152,219,0.32)',  label: 'Selten' },
        epic:      { color: '#9b59b6', bg: 'rgba(155,89,182,0.07)',  border: 'rgba(155,89,182,0.35)',  label: 'Episch' },
        legendary: { color: '#e67e22', bg: 'rgba(230,126,34,0.08)',  border: 'rgba(230,126,34,0.40)',  label: 'Legendär' },
        unique:    { color: '#e74c3c', bg: 'rgba(231,76,60,0.08)',   border: 'rgba(231,76,60,0.40)',   label: 'Einzigartig' }
    };

    const FALLBACK_ICONS = {
        weapon:     'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z',
        sword:      'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z',
        axe:        'M14 4l-5 5 2.5 2.5 5-5M6 12l-3 7 7-3 8.5-8.5L16 5z',
        armor:      'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        armorPiece: 'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        potion:     'M9 3h6v2l-2 4v8a2 2 0 01-2 2 2 2 0 01-2-2V9L7 5V3h2z',
        quest:      'M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z',
        gem:        'M12 2L2 12l10 10 10-10L12 2z',
        misc:       'M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z',
        helmet:     'M12 2C8 2 4 5 4 9v3h2v6h12v-6h2V9c0-4-4-7-8-7z',
        shield:     'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        ring:       'M12 4a8 8 0 100 16 8 8 0 000-16zm0 3a5 5 0 110 10 5 5 0 010-10z',
        boots:      'M4 17h16v3H4zM6 10h4v7H6zM14 10h4v7h-4z',
        gloves:     'M7 2v8l-2 4v6h4v-4l2-2 2 2v4h4v-6l-2-4V2z',
        belt:       'M2 10h20v4H2z',
        amulet:     'M12 2a4 4 0 00-4 4c0 3 4 6 4 6s4-3 4-6a4 4 0 00-4-4z',
        dagger:     'M14.5 3L9 10l2 2L5 18l6-6 2 2z',
        bow:        'M4 20C4 8 12 4 20 4M4 20l3-3M20 4l-3 3',
        staff:      'M12 2v18M8 4h8M10 20h4',
    };

    const SLOT_ACCEPTS = {
        head:      { types: ['armorPiece'], subTypes: ['helmet'] },
        shoulders: { types: ['armorPiece'], subTypes: ['shoulders'] },
        chest:     { types: ['armor'] },
        gloves:    { types: ['armorPiece'], subTypes: ['gloves'] },
        belt:      { types: ['armorPiece'], subTypes: ['belt'] },
        legs:      { types: ['armorPiece'], subTypes: ['legs'] },
        boots:     { types: ['armorPiece'], subTypes: ['boots'] },
        cape:      { types: ['armorPiece'], subTypes: ['cape', 'back'] },
        mainhand:  { types: ['weapon'] },
        offhand:   { types: ['weapon', 'armorPiece'], subTypes: ['shield', 'dagger', 'wand'] },
        ring1:     { types: ['armorPiece', 'misc'], subTypes: ['ring'] },
        ring2:     { types: ['armorPiece', 'misc'], subTypes: ['ring'] },
        amulet:    { types: ['armorPiece', 'misc'], subTypes: ['amulet', 'necklace'] },
        talisman:  { types: ['armorPiece', 'misc'], subTypes: ['talisman'] },
        ammo:      { types: ['misc'], subTypes: ['ammo', 'arrow', 'bolt'] }
    };

    const TYPE_LABELS = {
        weapon: 'Waffe', armor: 'Rüstung', armorPiece: 'Rüstungsteil',
        potion: 'Trank', quest: 'Quest', gem: 'Edelstein', misc: 'Sonstiges',
        sword: 'Schwert', greatsword: 'Großschwert', axe: 'Axt', mace: 'Keule',
        bow: 'Bogen', staff: 'Stab', dagger: 'Dolch', spear: 'Speer',
        shield: 'Schild', helmet: 'Helm', gloves: 'Handschuhe', boots: 'Stiefel',
        belt: 'Gürtel', health: 'Heiltrank', resource: 'Ressourcentrank',
        key: 'Schlüssel', ring: 'Ring', amulet: 'Amulett'
    };

    // ═══════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════

    let _getChar = null;
    let _saveChar = null;
    let _charId = null;
    let _filter = { rarity: 'all', type: 'all' };
    let _tooltipEl = null;
    let _ctxEl = null;
    let _dragItem = null;
    let _dragSource = null;

    // ═══════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════

    function init(getCharFn, saveCharFn, currentCharId) {
        _getChar = getCharFn;
        _saveChar = saveCharFn;
        _charId = currentCharId;
        _ensureTooltip();
        _ensureContextMenu();
        _bindEvents();
        _bindFilterUI();
        _bindSortButton();
        render();
        console.log('[Inventory] Spatial grid init — ' + GRID_COLS + 'x' + GRID_ROWS);
    }

    // ═══════════════════════════════════════
    //  OCCUPANCY MAP
    // ═══════════════════════════════════════

    function _buildOccMap(items, excludeId) {
        const map = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
        for (const it of items) {
            if (it.instanceId === excludeId) continue;
            if (it.col == null || it.row == null) continue;
            const w = it.gridW || 1, h = it.gridH || 1;
            for (let r = it.row; r < it.row + h && r < GRID_ROWS; r++)
                for (let c = it.col; c < it.col + w && c < GRID_COLS; c++)
                    map[r][c] = it.instanceId;
        }
        return map;
    }

    function _canPlace(map, col, row, w, h) {
        if (col < 0 || row < 0 || col + w > GRID_COLS || row + h > GRID_ROWS) return false;
        for (let r = row; r < row + h; r++)
            for (let c = col; c < col + w; c++)
                if (map[r][c]) return false;
        return true;
    }

    function _findFreeSpot(map, w, h) {
        for (let r = 0; r <= GRID_ROWS - h; r++)
            for (let c = 0; c <= GRID_COLS - w; c++)
                if (_canPlace(map, c, r, w, h)) return { col: c, row: r };
        return null;
    }

    // ═══════════════════════════════════════
    //  RENDER — Main
    // ═══════════════════════════════════════

    function render() {
        const ch = _getChar();
        if (!ch) return;
        _renderGrid(ch);
        _renderEquipment(ch);
        _renderQuickbar(ch);
        _renderWeight(ch);
    }

    // ═══════════════════════════════════════
    //  RENDER — Spatial Grid
    // ═══════════════════════════════════════

    function _renderGrid(ch) {
        const grid = document.getElementById('inventoryGrid');
        if (!grid) return;

        const items = ch.inventory?.items || [];
        _ensurePlacements(ch);

        // Remove old overlays
        grid.querySelectorAll('.inv-item').forEach(el => el.remove());
        // Reset cell states
        grid.querySelectorAll('.inv-cell').forEach(c => {
            c.classList.remove('occupied', 'drag-valid', 'drag-invalid');
        });

        // Mark occupied
        const map = _buildOccMap(items);
        for (let r = 0; r < GRID_ROWS; r++)
            for (let c = 0; c < GRID_COLS; c++)
                if (map[r][c]) {
                    const cell = grid.querySelector(`.inv-cell[data-row="${r}"][data-col="${c}"]`);
                    if (cell) cell.classList.add('occupied');
                }

        // Render filtered items as overlays
        for (const item of items) {
            if (item.col == null || item.row == null) continue;
            if (!_passesFilter(item)) continue;
            const w = item.gridW || 1, h = item.gridH || 1;
            const rar = RARITY[item.rarity] || RARITY.common;

            const el = document.createElement('div');
            el.className = 'inv-item';
            el.dataset.instanceId = item.instanceId;
            el.dataset.area = 'inventory';
            el.draggable = true;

            // CSS grid placement
            el.style.gridColumn = `${item.col + 1} / span ${w}`;
            el.style.gridRow = `${item.row + 1} / span ${h}`;
            el.style.setProperty('--rc', rar.color);
            el.style.setProperty('--rb', rar.border);
            el.style.setProperty('--rbg', rar.bg);

            // Inner HTML
            let inner = '';
            if (item.icon) {
                inner += `<img src="${_esc(item.icon)}" class="inv-item__img" draggable="false" alt="">`;
            } else {
                const d = FALLBACK_ICONS[item.subType] || FALLBACK_ICONS[item.type] || FALLBACK_ICONS.misc;
                inner += `<svg viewBox="0 0 24 24" fill="currentColor" class="inv-item__svg"><path d="${d}"/></svg>`;
            }
            // Name — show if item is big enough
            if (w >= 2 || h >= 3) {
                inner += `<span class="inv-item__name">${_esc(item.displayName || item.name)}</span>`;
            }
            // Quantity badge
            if (item.quantity > 1) {
                inner += `<span class="inv-item__qty">${item.quantity}</span>`;
            }

            el.innerHTML = inner;
            grid.appendChild(el);
        }
    }

    function _ensurePlacements(ch) {
        const items = ch.inventory?.items || [];
        let dirty = false;
        const placed = items.filter(i => i.col != null && i.row != null);
        const map = _buildOccMap(placed);

        for (const item of items) {
            if (item.col != null && item.row != null) continue;
            const w = item.gridW || 1, h = item.gridH || 1;
            const spot = _findFreeSpot(map, w, h);
            if (spot) {
                item.col = spot.col;
                item.row = spot.row;
                for (let r = spot.row; r < spot.row + h; r++)
                    for (let c = spot.col; c < spot.col + w; c++)
                        map[r][c] = item.instanceId;
                dirty = true;
            }
        }
        if (dirty) _saveChar(ch);
    }

    // ═══════════════════════════════════════
    //  RENDER — Equipment / Quickbar / Weight
    // ═══════════════════════════════════════

    function _renderEquipment(ch) {
        const eq = ch.equipment || {};
        document.querySelectorAll('.equip-slot').forEach(slot => {
            const sn = slot.dataset.slot;
            const item = eq[sn];
            const old = slot.querySelector('.equipped-item');
            if (old) old.remove();
            const lab = slot.querySelector('.slot-label');
            const xic = slot.querySelector('.empty-slot-icon');
            if (lab) lab.style.display = item ? 'none' : '';
            if (xic) xic.style.display = item ? 'none' : '';
            if (!item) return;

            const r = RARITY[item.rarity] || RARITY.common;
            const el = document.createElement('div');
            el.className = 'equipped-item';
            el.draggable = true;
            el.dataset.instanceId = item.instanceId;
            el.dataset.area = 'equipment';
            el.dataset.slot = sn;
            el.style.cssText = `background:${r.bg};color:${r.color};border:1px solid ${r.border};border-radius:3px;`;

            if (item.icon) {
                el.innerHTML = `<img src="${_esc(item.icon)}" style="width:90%;height:90%;object-fit:contain" draggable="false">`;
            } else {
                const d = FALLBACK_ICONS[item.subType] || FALLBACK_ICONS[item.type] || FALLBACK_ICONS.misc;
                el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:50%;height:50%;opacity:0.8"><path d="${d}"/></svg>`;
            }
            slot.appendChild(el);
        });
    }

    function _renderQuickbar(ch) {
        const qb = ch.quickbar || [];
        document.querySelectorAll('.potion-slot').forEach((slot, idx) => {
            const old = slot.querySelector('.potion-item');
            if (old) old.remove();
            const item = qb[idx];
            if (!item) return;

            const r = RARITY[item.rarity] || RARITY.common;
            const el = document.createElement('div');
            el.className = 'potion-item';
            el.draggable = true;
            el.dataset.instanceId = item.instanceId;
            el.dataset.area = 'quickbar';
            el.dataset.qbIndex = idx;
            el.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:${r.bg};color:${r.color};border-radius:3px;z-index:1;cursor:grab;`;
            if (item.icon) {
                el.innerHTML = `<img src="${_esc(item.icon)}" style="width:80%;height:80%;object-fit:contain" draggable="false">`;
            } else {
                const d = FALLBACK_ICONS[item.subType] || FALLBACK_ICONS[item.type] || FALLBACK_ICONS.misc;
                el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:50%;height:50%;opacity:0.8"><path d="${d}"/></svg>`;
            }
            if (item.quantity > 1) el.innerHTML += `<span class="inv-item__qty">${item.quantity}</span>`;
            slot.appendChild(el);
        });
    }

    function _renderWeight(ch) {
        const el = document.getElementById('inv-weight');
        if (!el) return;
        let t = 0;
        (ch.inventory?.items || []).forEach(i => t += (i.weight || 0) * (i.quantity || 1));
        Object.values(ch.equipment || {}).forEach(i => { if (i) t += (i.weight || 0); });
        el.textContent = t.toFixed(1);
    }

    // ═══════════════════════════════════════
    //  TOOLTIP
    // ═══════════════════════════════════════

    function _ensureTooltip() {
        if (document.getElementById('riftTooltip')) { _tooltipEl = document.getElementById('riftTooltip'); return; }
        _tooltipEl = document.createElement('div');
        _tooltipEl.id = 'riftTooltip';
        _tooltipEl.className = 'tooltip';
        document.body.appendChild(_tooltipEl);
    }

    function _showTooltip(item, x, y) {
        if (!_tooltipEl || !item) return;
        const r = RARITY[item.rarity] || RARITY.common;
        const tl = TYPE_LABELS[item.subType] || TYPE_LABELS[item.type] || item.type || '';
        const s = item.finalStats || item.stats || {};

        let sh = '';
        if (s.damage) sh += `<div class="tt-stat"><span class="label">Schaden:</span> ${s.damage}</div>`;
        if (s.armor)  sh += `<div class="tt-stat"><span class="label">Rüstung:</span> ${s.armor}</div>`;
        if (s.speed)  sh += `<div class="tt-stat"><span class="label">Tempo:</span> ${s.speed}s</div>`;
        if (s.critChance && s.critChance !== 5) sh += `<div class="tt-stat"><span class="label">Krit:</span> ${s.critChance}%</div>`;
        if (s.critDamage && s.critDamage !== 150) sh += `<div class="tt-stat"><span class="label">Krit-DMG:</span> ${s.critDamage}%</div>`;
        for (const [k, v] of Object.entries(s)) {
            if (['damage','armor','speed','critChance','critDamage','heal','restore'].includes(k)) continue;
            if (v) sh += `<div class="tt-stat" style="color:${r.color}"><span class="label">${k}:</span> +${v}</div>`;
        }

        const rq = [];
        if (item.requirements?.level) rq.push('Lvl ' + item.requirements.level);
        if (item.requirements?.kraft) rq.push('Kraft ' + item.requirements.kraft);
        if (item.requirements?.geschick) rq.push('Geschick ' + item.requirements.geschick);

        const fl = [];
        if (item.flags?.questItem) fl.push('<span style="color:#e67e22">Quest</span>');
        if (item.flags?.soulbound) fl.push('<span style="color:#e74c3c">Seelengebunden</span>');
        if (item.flags?.unique) fl.push('<span style="color:#e74c3c">Einzigartig</span>');

        _tooltipEl.innerHTML = `
            <div class="tt-name" style="color:${r.color}">${_esc(item.displayName || item.name)}</div>
            <div class="tt-type">${_esc(tl)}${item.slot ? ' \u00B7 ' + _esc(item.slot) : ''}</div>
            <div class="tt-rarity" style="color:${r.color}">${r.label}</div>
            ${sh ? '<div class="tt-divider"></div><div class="tt-stats">' + sh + '</div>' : ''}
            ${rq.length ? '<div class="tt-divider"></div><div style="font-size:10px;color:#999">Ben\u00F6tigt: ' + rq.join(' \u00B7 ') + '</div>' : ''}
            ${fl.length ? '<div style="font-size:10px;margin-top:4px">' + fl.join(' \u00B7 ') + '</div>' : ''}
            ${item.description ? '<div class="tt-divider"></div><div class="tt-desc">' + _esc(item.description) + '</div>' : ''}
            ${item.flavorText ? '<div class="tt-flavor">\u201E' + _esc(item.flavorText) + '\u201C</div>' : ''}
            <div class="tt-divider"></div>
            <div class="tt-footer">
                <span class="tt-value">${item.finalValue ?? item.value ?? 0} Gold</span>
                <span>${item.weight ?? 0} kg</span>
                <span style="opacity:0.5">${item.gridW || 1}\u00D7${item.gridH || 1}</span>
            </div>`;
        _tooltipEl.classList.add('visible');

        const pad = 12;
        requestAnimationFrame(() => {
            const rc = _tooltipEl.getBoundingClientRect();
            let l = x + pad, t = y + pad;
            if (l + rc.width > window.innerWidth - pad) l = x - rc.width - pad;
            if (t + rc.height > window.innerHeight - pad) t = y - rc.height - pad;
            _tooltipEl.style.left = Math.max(pad, l) + 'px';
            _tooltipEl.style.top = Math.max(pad, t) + 'px';
        });
    }

    function _hideTooltip() { if (_tooltipEl) _tooltipEl.classList.remove('visible'); }

    // ═══════════════════════════════════════
    //  CONTEXT MENU
    // ═══════════════════════════════════════

    function _ensureContextMenu() {
        if (document.getElementById('riftCtxMenu')) { _ctxEl = document.getElementById('riftCtxMenu'); return; }
        _ctxEl = document.createElement('div');
        _ctxEl.id = 'riftCtxMenu';
        _ctxEl.className = 'inv-ctx';
        _ctxEl.style.display = 'none';
        document.body.appendChild(_ctxEl);
        document.addEventListener('click', () => { _ctxEl.style.display = 'none'; });
    }

    function _showCtx(item, area, key, x, y) {
        if (!_ctxEl || !item) return;
        _hideTooltip();
        const acts = [];

        if (area === 'inventory') {
            if (_findEquipSlot(item)) acts.push({ l: 'Ausrüsten', i: FALLBACK_ICONS.shield, fn: () => equipItem(item.instanceId) });
            if (item.flags?.consumable) acts.push({ l: 'Benutzen', i: FALLBACK_ICONS.potion, fn: () => useItem(item.instanceId) });
            acts.push({ l: 'Schnellzugriff', i: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', fn: () => addToQuickbar(item.instanceId) });
            if (item.quantity > 1) acts.push({ l: 'Teilen', i: 'M16 3h5v5M4 20L21 3M21 16v5h-5M3 4l18 17', fn: () => splitStack(item.instanceId) });
            if (!item.flags?.questItem) acts.push({ l: 'Ablegen', i: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2', fn: () => dropItem(item.instanceId), d: true });
        } else if (area === 'equipment') {
            acts.push({ l: 'Ablegen', i: 'M3 6h18M8 6V4h8v2', fn: () => unequipSlot(key) });
        } else if (area === 'quickbar') {
            acts.push({ l: 'Entfernen', i: 'M18 6L6 18M6 6l12 12', fn: () => removeFromQuickbar(parseInt(key)) });
            if (item.flags?.consumable) acts.push({ l: 'Benutzen', i: FALLBACK_ICONS.potion, fn: () => useItem(item.instanceId) });
        }
        if (!acts.length) return;

        _ctxEl.innerHTML = acts.map((a, idx) => `
            <div class="inv-ctx__item${a.d ? ' inv-ctx__item--danger' : ''}" data-i="${idx}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${a.i}"/></svg>
                ${a.l}
            </div>`).join('');

        _ctxEl.querySelectorAll('.inv-ctx__item').forEach((el, idx) => {
            el.addEventListener('click', e => { e.stopPropagation(); acts[idx].fn(); _ctxEl.style.display = 'none'; });
        });

        _ctxEl.style.display = 'block';
        requestAnimationFrame(() => {
            const rc = _ctxEl.getBoundingClientRect();
            _ctxEl.style.left = Math.min(x, window.innerWidth - rc.width - 8) + 'px';
            _ctxEl.style.top = Math.min(y, window.innerHeight - rc.height - 8) + 'px';
        });
    }

    // ═══════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════

    function _bindEvents() {
        const root = document.getElementById('sec-inventar');
        if (!root) return;

        // Tooltip
        root.addEventListener('mousemove', e => {
            const el = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (!el) { _hideTooltip(); return; }
            const it = _findById(el.dataset.instanceId);
            if (it) _showTooltip(it, e.clientX, e.clientY);
        });
        root.addEventListener('mouseleave', _hideTooltip);

        // Context
        root.addEventListener('contextmenu', e => {
            const el = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (!el) return;
            e.preventDefault();
            const it = _findById(el.dataset.instanceId);
            if (!it) return;
            const area = el.dataset.area || (el.classList.contains('equipped-item') ? 'equipment' : 'inventory');
            _showCtx(it, area, el.dataset.slot || el.dataset.qbIndex || '', e.clientX, e.clientY);
        });

        // Dblclick equip / unequip
        root.addEventListener('dblclick', e => {
            const inv = e.target.closest('.inv-item[data-area="inventory"]');
            if (inv) {
                const it = _findById(inv.dataset.instanceId);
                if (!it) return;
                if (it.flags?.consumable) { useItem(it.instanceId); return; }
                if (_findEquipSlot(it)) equipItem(it.instanceId);
                return;
            }
            const eq = e.target.closest('.equipped-item');
            if (eq) unequipSlot(eq.dataset.slot);
        });

        // ── Drag & Drop ──
        root.addEventListener('dragstart', e => {
            const el = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (!el) return;
            _dragItem = _findById(el.dataset.instanceId);
            _dragSource = {
                area: el.dataset.area || (el.classList.contains('equipped-item') ? 'equipment' : 'quickbar'),
                slot: el.dataset.slot || '',
                index: el.dataset.qbIndex || ''
            };
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', _dragItem?.instanceId || '');
            el.style.opacity = '0.25';

            // Highlight valid equip slots
            if (_dragItem) {
                document.querySelectorAll('.equip-slot').forEach(s => {
                    if (_canEquipInSlot(_dragItem, s.dataset.slot)) s.classList.add('valid-target');
                });
            }
        });

        root.addEventListener('dragend', e => {
            const el = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (el) el.style.opacity = '1';
            document.querySelectorAll('.valid-target, .drag-over, .drag-valid, .drag-invalid').forEach(
                x => x.classList.remove('valid-target', 'drag-over', 'drag-valid', 'drag-invalid')
            );
            _dragItem = null;
            _dragSource = null;
        });

        // Dragover on grid cells — highlight placement validity
        root.addEventListener('dragover', e => {
            const t = e.target.closest('.inv-cell, .equip-slot, .potion-slot');
            if (!t || !_dragItem) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Show ghost overlay for grid cells
            if (t.classList.contains('inv-cell')) {
                _highlightGridDrop(parseInt(t.dataset.col), parseInt(t.dataset.row));
            }
        });

        root.addEventListener('drop', e => {
            e.preventDefault();
            if (!_dragItem) return;
            const t = e.target.closest('.inv-cell, .equip-slot, .potion-slot');
            if (!t) return;

            if (t.classList.contains('equip-slot')) _dropEquip(t.dataset.slot);
            else if (t.classList.contains('potion-slot')) _dropQuickbar(Array.from(t.parentElement.children).indexOf(t));
            else if (t.classList.contains('inv-cell')) _dropInventory(parseInt(t.dataset.col), parseInt(t.dataset.row));

            document.querySelectorAll('.valid-target, .drag-over, .drag-valid, .drag-invalid').forEach(
                x => x.classList.remove('valid-target', 'drag-over', 'drag-valid', 'drag-invalid')
            );
            _dragItem = null;
            _dragSource = null;
        });
    }

    function _highlightGridDrop(col, row) {
        const grid = document.getElementById('inventoryGrid');
        if (!grid || !_dragItem) return;
        const w = _dragItem.gridW || 1, h = _dragItem.gridH || 1;
        const ch = _getChar();
        const map = _buildOccMap(ch.inventory?.items || [], _dragItem.instanceId);
        const valid = _canPlace(map, col, row, w, h);

        // Clear previous highlights
        grid.querySelectorAll('.drag-valid, .drag-invalid').forEach(c => c.classList.remove('drag-valid', 'drag-invalid'));

        for (let r = row; r < row + h && r < GRID_ROWS; r++) {
            for (let c = col; c < col + w && c < GRID_COLS; c++) {
                const cell = grid.querySelector(`.inv-cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) cell.classList.add(valid ? 'drag-valid' : 'drag-invalid');
            }
        }
    }

    // ═══════════════════════════════════════
    //  DROP HANDLERS
    // ═══════════════════════════════════════

    function _dropInventory(col, row) {
        const ch = _getChar();
        const item = _dragItem;
        const src = _dragSource;
        const w = item.gridW || 1, h = item.gridH || 1;

        if (!ch.inventory) ch.inventory = { cols: GRID_COLS, rows: GRID_ROWS, items: [] };
        if (!ch.inventory.items) ch.inventory.items = [];

        // Temporarily nullify old placement if moving within inventory
        if (src.area === 'inventory') {
            const ex = ch.inventory.items.find(i => i.instanceId === item.instanceId);
            if (ex) { ex.col = null; ex.row = null; }
        }

        const map = _buildOccMap(ch.inventory.items, item.instanceId);
        if (!_canPlace(map, col, row, w, h)) {
            // Restore old placement
            if (src.area === 'inventory') {
                const ex = ch.inventory.items.find(i => i.instanceId === item.instanceId);
                if (ex) _ensurePlacements(ch);
            }
            return;
        }

        _removeFromSource(item, src, ch);
        item.col = col;
        item.row = row;

        if (!ch.inventory.items.find(i => i.instanceId === item.instanceId)) {
            ch.inventory.items.push(item);
        }
        _save(ch);
    }

    function _dropEquip(slotName) {
        if (!_canEquipInSlot(_dragItem, slotName)) return;
        const ch = _getChar();
        if (!ch.equipment) ch.equipment = {};

        const existing = ch.equipment[slotName];
        if (existing) {
            if (!ch.inventory) ch.inventory = { cols: GRID_COLS, rows: GRID_ROWS, items: [] };
            if (!ch.inventory.items) ch.inventory.items = [];
            existing.col = null; existing.row = null;
            ch.inventory.items.push(existing);
        }
        _removeFromSource(_dragItem, _dragSource, ch);
        ch.equipment[slotName] = _dragItem;
        _save(ch);
    }

    function _dropQuickbar(idx) {
        const ch = _getChar();
        if (!ch.quickbar) ch.quickbar = Array(8).fill(null);

        const existing = ch.quickbar[idx];
        if (existing && _dragSource.area === 'quickbar') {
            ch.quickbar[parseInt(_dragSource.index)] = existing;
        } else if (existing) {
            if (!ch.inventory) ch.inventory = { cols: GRID_COLS, rows: GRID_ROWS, items: [] };
            if (!ch.inventory.items) ch.inventory.items = [];
            existing.col = null; existing.row = null;
            ch.inventory.items.push(existing);
        }
        if (_dragSource.area !== 'quickbar') _removeFromSource(_dragItem, _dragSource, ch);
        else ch.quickbar[parseInt(_dragSource.index)] = null;

        ch.quickbar[idx] = { ..._dragItem };
        _save(ch);
    }

    function _removeFromSource(item, src, ch) {
        if (src.area === 'inventory')
            ch.inventory.items = (ch.inventory.items || []).filter(i => i.instanceId !== item.instanceId);
        else if (src.area === 'equipment' && ch.equipment?.[src.slot])
            ch.equipment[src.slot] = null;
        else if (src.area === 'quickbar' && ch.quickbar)
            ch.quickbar[parseInt(src.index)] = null;
    }

    // ═══════════════════════════════════════
    //  ITEM ACTIONS
    // ═══════════════════════════════════════

    function equipItem(id) {
        const ch = _getChar();
        const items = ch.inventory?.items || [];
        const idx = items.findIndex(i => i.instanceId === id);
        if (idx === -1) return;
        const item = items[idx];
        const sn = _findEquipSlot(item);
        if (!sn) return;
        if (!ch.equipment) ch.equipment = {};
        const old = ch.equipment[sn];
        if (old) { old.col = null; old.row = null; items.push(old); }
        items.splice(idx, 1);
        ch.equipment[sn] = item;
        _save(ch);
    }

    function unequipSlot(sn) {
        const ch = _getChar();
        if (!ch.equipment?.[sn]) return;
        const item = ch.equipment[sn];
        ch.equipment[sn] = null;
        if (!ch.inventory) ch.inventory = { cols: GRID_COLS, rows: GRID_ROWS, items: [] };
        if (!ch.inventory.items) ch.inventory.items = [];
        item.col = null; item.row = null;
        ch.inventory.items.push(item);
        _save(ch);
    }

    function useItem(id) {
        const ch = _getChar();
        const item = _findInChar(ch, id);
        if (!item || !item.flags?.consumable) return;
        if (item.type === 'potion' || item.subType === 'health') {
            const heal = parseInt(item.stats?.heal || item.stats?.damage || '25');
            if (ch.hp && typeof ch.hp === 'object')
                ch.hp.current = Math.min((ch.hp.current || 0) + heal, ch.hp.max || 100);
            _notify(`${item.displayName || item.name}: +${heal} LP`);
        } else {
            _notify(`${item.displayName || item.name} benutzt`);
        }
        if (item.quantity > 1) item.quantity--;
        else _removeFromChar(ch, id);
        _save(ch);
    }

    function dropItem(id) {
        if (!confirm('Item ablegen?')) return;
        const ch = _getChar();
        _removeFromChar(ch, id);
        _save(ch);
    }

    function addToQuickbar(id) {
        const ch = _getChar();
        if (!ch.quickbar) ch.quickbar = Array(8).fill(null);
        const item = _findInChar(ch, id);
        if (!item) return;
        const slot = ch.quickbar.findIndex(s => !s);
        if (slot === -1) { _notify('Schnellzugriff voll'); return; }
        ch.quickbar[slot] = { ...item };
        _save(ch);
    }

    function removeFromQuickbar(idx) {
        const ch = _getChar();
        if (!ch.quickbar) return;
        ch.quickbar[idx] = null;
        _save(ch);
    }

    function splitStack(id) {
        const ch = _getChar();
        const items = ch.inventory?.items || [];
        const item = items.find(i => i.instanceId === id);
        if (!item || item.quantity <= 1) return;
        const half = Math.floor(item.quantity / 2);
        item.quantity -= half;
        items.push({ ...item, instanceId: 'inst_' + _uid(8), quantity: half, col: null, row: null });
        _save(ch);
    }

    function addItem(inst) {
        const ch = _getChar();
        if (!ch.inventory) ch.inventory = { cols: GRID_COLS, rows: GRID_ROWS, items: [] };
        if (!ch.inventory.items) ch.inventory.items = [];
        if (inst.stackable || inst.flags?.consumable) {
            const ex = ch.inventory.items.find(i => i.baseItemId === inst.baseItemId);
            if (ex) { ex.quantity = (ex.quantity || 1) + (inst.quantity || 1); _save(ch); return; }
        }
        if (!inst.instanceId) inst.instanceId = 'inst_' + _uid(8);
        inst.col = null; inst.row = null;
        ch.inventory.items.push(inst);
        _save(ch);
    }

    function removeItem(id) {
        const ch = _getChar();
        _removeFromChar(ch, id);
        _save(ch);
    }

    // ═══════════════════════════════════════
    //  SORT (bin-packing: biggest first)
    // ═══════════════════════════════════════

    function _bindSortButton() {
        const btn = document.getElementById('sortBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const ch = _getChar();
            if (!ch.inventory?.items?.length) return;
            const ro = { unique: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
            const items = ch.inventory.items.slice().sort((a, b) => {
                const area = (b.gridW || 1) * (b.gridH || 1) - (a.gridW || 1) * (a.gridH || 1);
                if (area !== 0) return area;
                return (ro[a.rarity] ?? 9) - (ro[b.rarity] ?? 9);
            });
            items.forEach(i => { i.col = null; i.row = null; });
            const map = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
            for (const item of items) {
                const w = item.gridW || 1, h = item.gridH || 1;
                const spot = _findFreeSpot(map, w, h);
                if (spot) {
                    item.col = spot.col; item.row = spot.row;
                    for (let r = spot.row; r < spot.row + h; r++)
                        for (let c = spot.col; c < spot.col + w; c++) map[r][c] = item.instanceId;
                }
            }
            ch.inventory.items = items;
            _save(ch);
        });
    }

    // ═══════════════════════════════════════
    //  FILTER
    // ═══════════════════════════════════════

    function _bindFilterUI() {
        const filterBtn = document.getElementById('filterBtn');
        const dd = document.getElementById('filterDropdown');
        if (!filterBtn || !dd) return;
        filterBtn.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
        document.addEventListener('click', () => dd.classList.remove('open'));
        dd.addEventListener('click', e => e.stopPropagation());

        dd.querySelectorAll('#filterRarity .filter-chip').forEach(c => c.addEventListener('click', () => {
            dd.querySelectorAll('#filterRarity .filter-chip').forEach(x => x.classList.remove('active'));
            c.classList.add('active'); _filter.rarity = c.dataset.val; render();
        }));
        dd.querySelectorAll('#filterType .filter-chip').forEach(c => c.addEventListener('click', () => {
            dd.querySelectorAll('#filterType .filter-chip').forEach(x => x.classList.remove('active'));
            c.classList.add('active'); _filter.type = c.dataset.val; render();
        }));
    }

    function _passesFilter(item) {
        if (_filter.rarity !== 'all' && item.rarity !== _filter.rarity) return false;
        if (_filter.type !== 'all') {
            const f = _filter.type;
            if (f === 'armor' && item.type !== 'armor' && item.type !== 'armorPiece') return false;
            if (f === 'weapon' && item.type !== 'weapon') return false;
            if (f === 'jewelry' && !['ring','amulet','talisman','necklace'].includes(item.subType)) return false;
            if (f === 'consumable' && !item.flags?.consumable && item.type !== 'potion') return false;
            if (f === 'quest' && item.type !== 'quest' && !item.flags?.questItem) return false;
            if (f === 'other' && ['weapon','armor','armorPiece','potion','quest'].includes(item.type)) return false;
        }
        return true;
    }

    // ═══════════════════════════════════════
    //  STARTER KIT (Demo)
    // ═══════════════════════════════════════

    function loadStarterKit() {
        const ch = _getChar();
        if (!ch) return;
        if (!ch.inventory) ch.inventory = { cols: GRID_COLS, rows: GRID_ROWS, items: [] };
        if (!ch.inventory.items) ch.inventory.items = [];

        const demo = [
            { instanceId:'demo_01', baseItemId:'eisenklinge', displayName:'Eisenklinge', name:'Eisenklinge', type:'weapon', subType:'sword', slot:'mainHand', rarity:'common', gridW:2, gridH:4, quantity:1, weight:3.5, value:50, stats:{damage:'2d6+2',speed:1.2}, flags:{tradeable:true} },
            { instanceId:'demo_02', baseItemId:'klingenstahl', displayName:'Klingenstahl', name:'Klingenstahl', type:'weapon', subType:'sword', slot:'mainHand', rarity:'uncommon', gridW:2, gridH:4, quantity:1, weight:4, value:180, stats:{damage:'2d8+3',speed:1.1,critChance:8}, flags:{tradeable:true} },
            { instanceId:'demo_03', baseItemId:'nachtklinge', displayName:'Nachtklinge', name:'Nachtklinge', type:'weapon', subType:'sword', slot:'mainHand', rarity:'common', gridW:2, gridH:4, quantity:1, weight:3, value:60, stats:{damage:'2d6+1',speed:1.3}, flags:{tradeable:true} },
            { instanceId:'demo_04', baseItemId:'seelenfresser', displayName:'Seelenfresser', name:'Seelenfresser', type:'weapon', subType:'greatsword', slot:'mainHand', rarity:'rare', gridW:2, gridH:4, quantity:1, weight:6, value:420, stats:{damage:'3d6+4',speed:1.6,critDamage:200}, flags:{tradeable:true}, flavorText:'Flüstert in der Dunkelheit.' },
            { instanceId:'demo_05', baseItemId:'schuppenruestung', displayName:'Schuppenrüstung', name:'Schuppenrüstung', type:'armor', subType:'plate', slot:'chest', rarity:'common', gridW:2, gridH:3, quantity:1, weight:18, value:200, stats:{armor:10}, flags:{tradeable:true} },
            { instanceId:'demo_06', baseItemId:'wollwams', displayName:'Wollwams', name:'Wollwams', type:'armor', subType:'cloth', slot:'chest', rarity:'common', gridW:2, gridH:3, quantity:1, weight:3, value:45, stats:{armor:3}, flags:{tradeable:true} },
            { instanceId:'demo_07', baseItemId:'fellkappe', displayName:'Fellkappe', name:'Fellkappe', type:'armorPiece', subType:'helmet', slot:'head', rarity:'common', gridW:2, gridH:2, quantity:1, weight:1.5, value:35, stats:{armor:4}, flags:{tradeable:true} },
            { instanceId:'demo_08', baseItemId:'kampfhandschuhe', displayName:'Kampfhandschuhe', name:'Kampfhandschuhe', type:'armorPiece', subType:'gloves', slot:'hands', rarity:'common', gridW:2, gridH:2, quantity:1, weight:1, value:28, stats:{armor:2}, flags:{tradeable:true} },
            { instanceId:'demo_09', baseItemId:'wanderstiefel', displayName:'Wanderstiefel', name:'Wanderstiefel', type:'armorPiece', subType:'boots', slot:'feet', rarity:'common', gridW:2, gridH:2, quantity:1, weight:1.5, value:35, stats:{armor:3}, flags:{tradeable:true} },
            { instanceId:'demo_10', baseItemId:'kettenhose', displayName:'Kettenhose', name:'Kettenhose', type:'armorPiece', subType:'legs', slot:'legs', rarity:'common', gridW:2, gridH:3, quantity:1, weight:5, value:80, stats:{armor:6}, flags:{tradeable:true} },
            { instanceId:'demo_11', baseItemId:'lederguertel', displayName:'Ledergürtel', name:'Ledergürtel', type:'armorPiece', subType:'belt', slot:'belt', rarity:'common', gridW:2, gridH:1, quantity:1, weight:0.5, value:15, stats:{armor:1}, flags:{tradeable:true} },
            { instanceId:'demo_12', baseItemId:'eisenring', displayName:'Eisenring', name:'Eisenring', type:'armorPiece', subType:'ring', slot:'ring', rarity:'common', gridW:1, gridH:1, quantity:1, weight:0.05, value:30, stats:{}, flags:{tradeable:true} },
            { instanceId:'demo_13', baseItemId:'blutring', displayName:'Blutring', name:'Blutring', type:'armorPiece', subType:'ring', slot:'ring', rarity:'rare', gridW:1, gridH:1, quantity:1, weight:0.05, value:350, stats:{kraft:3,critChance:5}, flags:{tradeable:true} },
            { instanceId:'demo_14', baseItemId:'smaragdamulett', displayName:'Smaragdamulett', name:'Smaragdamulett', type:'armorPiece', subType:'amulet', slot:'amulet', rarity:'uncommon', gridW:1, gridH:2, quantity:1, weight:0.1, value:180, stats:{intellekt:2}, flags:{tradeable:true} },
            { instanceId:'demo_15', baseItemId:'kl_heiltrank', displayName:'Kl. Heiltrank', name:'Kl. Heiltrank', type:'potion', subType:'health', rarity:'common', gridW:1, gridH:2, quantity:3, weight:0.3, value:25, stackable:true, stats:{heal:'25'}, flags:{consumable:true,tradeable:true} },
            { instanceId:'demo_16', baseItemId:'heiltrank', displayName:'Heiltrank', name:'Heiltrank', type:'potion', subType:'health', rarity:'uncommon', gridW:1, gridH:2, quantity:2, weight:0.3, value:50, stackable:true, stats:{heal:'50'}, flags:{consumable:true,tradeable:true} },
            { instanceId:'demo_17', baseItemId:'kl_manatrank', displayName:'Kl. Manatrank', name:'Kl. Manatrank', type:'potion', subType:'resource', rarity:'common', gridW:1, gridH:2, quantity:2, weight:0.3, value:30, stackable:true, stats:{restore:'30'}, flags:{consumable:true,tradeable:true} },
            { instanceId:'demo_18', baseItemId:'gr_manatrank', displayName:'Gr. Manatrank', name:'Gr. Manatrank', type:'potion', subType:'resource', rarity:'uncommon', gridW:1, gridH:2, quantity:1, weight:0.3, value:65, stackable:true, stats:{restore:'60'}, flags:{consumable:true,tradeable:true} },
            { instanceId:'demo_19', baseItemId:'drachenzahn', displayName:'Drachenzahn', name:'Drachenzahn', type:'weapon', subType:'greatsword', slot:'mainHand', rarity:'legendary', gridW:2, gridH:4, quantity:1, weight:8, value:3200, stats:{damage:'4d6+6',speed:1.8,critChance:12,critDamage:220}, flags:{unique:true}, flavorText:'Aus einem Drachenzahn geschmiedet.' },
            { instanceId:'demo_20', baseItemId:'schattenschnitt', displayName:'Schattenschnitt', name:'Schattenschnitt', type:'weapon', subType:'sword', slot:'mainHand', rarity:'rare', gridW:2, gridH:4, quantity:1, weight:3.5, value:680, stats:{damage:'2d10+4',speed:1.0,critChance:15}, flags:{tradeable:true} },
        ];

        const existing = new Set(ch.inventory.items.map(i => i.instanceId));
        let added = 0;
        for (const d of demo) {
            if (!existing.has(d.instanceId)) { d.col = null; d.row = null; ch.inventory.items.push(d); added++; }
        }
        if (added) { _save(ch); _notify(added + ' Demo-Items hinzugefügt'); }
        else _notify('Demo-Items bereits vorhanden');
    }

    // ═══════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════

    function _findById(id) {
        if (!id) return null;
        const ch = _getChar(); if (!ch) return null;
        let it = (ch.inventory?.items || []).find(i => i.instanceId === id);
        if (it) return it;
        for (const v of Object.values(ch.equipment || {})) if (v?.instanceId === id) return v;
        for (const v of (ch.quickbar || [])) if (v?.instanceId === id) return v;
        return null;
    }

    function _findInChar(ch, id) {
        let it = (ch.inventory?.items || []).find(i => i.instanceId === id);
        if (it) return it;
        for (const v of Object.values(ch.equipment || {})) if (v?.instanceId === id) return v;
        for (const v of (ch.quickbar || [])) if (v?.instanceId === id) return v;
        return null;
    }

    function _removeFromChar(ch, id) {
        if (ch.inventory?.items) ch.inventory.items = ch.inventory.items.filter(i => i.instanceId !== id);
        if (ch.equipment) for (const [k, v] of Object.entries(ch.equipment)) if (v?.instanceId === id) ch.equipment[k] = null;
        if (ch.quickbar) ch.quickbar = ch.quickbar.map(i => i?.instanceId === id ? null : i);
    }

    function _canEquipInSlot(item, sn) {
        const a = SLOT_ACCEPTS[sn];
        if (!a) return false;
        if (a.types && !a.types.includes(item.type)) return false;
        if (a.subTypes && !a.subTypes.includes(item.subType)) return false;
        return true;
    }

    function _findEquipSlot(item) {
        const m = { mainHand:'mainhand',offHand:'offhand',head:'head',chest:'chest',legs:'legs',
            feet:'boots',hands:'gloves',shoulders:'shoulders',belt:'belt',back:'cape',
            ring:'ring1',amulet:'amulet',boots:'boots',gloves:'gloves',cape:'cape',
            talisman:'talisman',mainhand:'mainhand',offhand:'offhand' };
        if (item.slot) {
            const mapped = m[item.slot] || item.slot;
            if (SLOT_ACCEPTS[mapped] && _canEquipInSlot(item, mapped)) return mapped;
        }
        const ch = _getChar();
        for (const s of Object.keys(SLOT_ACCEPTS)) if (_canEquipInSlot(item, s) && !ch.equipment?.[s]) return s;
        for (const s of Object.keys(SLOT_ACCEPTS)) if (_canEquipInSlot(item, s)) return s;
        return null;
    }

    function _save(ch) { _saveChar(ch); render(); }
    function _notify(msg) { if (window.RIFTToast?.show) RIFTToast.show(msg, 'info'); else console.log('[Inv]', msg); }
    function _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function _uid(n) { const c = 'abcdefghijklmnopqrstuvwxyz0123456789'; let r = ''; for (let i = 0; i < n; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }

    // ═══════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════

    return {
        init, render, addItem, removeItem, equipItem, unequipSlot,
        useItem, dropItem, addToQuickbar, removeFromQuickbar, splitStack,
        loadStarterKit,
        RARITY, FALLBACK_ICONS, TYPE_LABELS, GRID_COLS, GRID_ROWS
    };

})();

window.RiftInventory = RiftInventory;

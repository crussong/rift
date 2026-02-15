/**
 * ═══════════════════════════════════════════════════════════════
 *  RIFT Inventory System — Worlds Apart Character Sheet
 *
 *  Handles: Inventory grid rendering, equipment slots, quickbar,
 *           drag & drop, tooltips, sort/filter, context menus.
 *
 *  Data model:
 *    charData.inventory.items[]      — Item instances in bag
 *    charData.equipment              — { slotName: itemInstance }
 *    charData.quickbar               — [ itemInstance | null ] x8
 *    charData.currency               — { gold, silver, copper }
 *
 *  Init:  RiftInventory.init(getCharData, setCharData)
 *  API:   RiftInventory.render()
 *         RiftInventory.addItem(itemInstance)
 *         RiftInventory.removeItem(instanceId)
 *         RiftInventory.equipItem(instanceId)
 *         RiftInventory.unequipSlot(slotName)
 * ═══════════════════════════════════════════════════════════════
 */

const RiftInventory = (() => {
    'use strict';

    // ════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════

    const RARITY_COLORS = {
        common:    { color: '#9a9aaa', bg: 'rgba(154,154,170,0.08)', border: 'rgba(154,154,170,0.25)', label: 'Gewöhnlich' },
        uncommon:  { color: '#2ecc71', bg: 'rgba(46,204,113,0.08)',  border: 'rgba(46,204,113,0.30)',  label: 'Ungewöhnlich' },
        rare:      { color: '#3498db', bg: 'rgba(52,152,219,0.08)',  border: 'rgba(52,152,219,0.35)',  label: 'Selten' },
        epic:      { color: '#9b59b6', bg: 'rgba(155,89,182,0.08)',  border: 'rgba(155,89,182,0.40)',  label: 'Episch' },
        legendary: { color: '#e67e22', bg: 'rgba(230,126,34,0.10)',  border: 'rgba(230,126,34,0.45)',  label: 'Legendär' },
        unique:    { color: '#e74c3c', bg: 'rgba(231,76,60,0.10)',   border: 'rgba(231,76,60,0.45)',   label: 'Einzigartig' }
    };

    // Icon SVG paths by item type (simple silhouettes)
    const TYPE_ICONS = {
        weapon:     'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z',
        sword:      'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z',
        greatsword: 'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z',
        axe:        'M10 2v6H6l4 4 4-4h-4V2h-0zM6 14l-4 8h20l-4-8H6z',
        mace:       'M12 2v8M8 10h8M9 4h6v6H9zM10 18l2-8 2 8H10z',
        bow:        'M4 4c4 4 4 12 0 16M8 4l8 8-8 8M20 12H8',
        crossbow:   'M4 4c4 4 4 12 0 16M8 4l8 8-8 8M20 12H8',
        staff:      'M12 2v18M8 2h8M10 20h4',
        dagger:     'M12 2l-3 9 3 3 3-3-3-9zM10 18l2-4 2 4H10z',
        spear:      'M12 2l-3 6h6l-3-6zM11 8h2v14h-2z',
        wand:       'M6 2l2 6 8 8 2 6-6-2-8-8L6 2z',
        hammer:     'M8 2h8v6H8V2zM11 8h2v12h-2z',
        armor:      'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        armorPiece: 'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        helmet:     'M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8H4zM6 12v4h12v-4',
        shield:     'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        boots:      'M6 8v8c0 2 1 4 3 4h6c2 0 3-2 3-4V8H6z',
        gloves:     'M6 4v12c0 2 2 4 4 4h4c2 0 4-2 4-4V4H6z',
        potion:     'M9 3h6v2l-2 4v8a2 2 0 01-2 2 2 2 0 01-2-2V9L7 5V3h2z',
        health:     'M9 3h6v2l-2 4v8a2 2 0 01-2 2 2 2 0 01-2-2V9L7 5V3h2z',
        quest:      'M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z',
        gem:        'M12 2L2 12l10 10 10-10L12 2z',
        diamond:    'M12 2L2 12l10 10 10-10L12 2z',
        ruby:       'M12 2L2 12l10 10 10-10L12 2z',
        misc:       'M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4z',
        food:       'M18 8h-1V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H8c-1.1 0-2 .9-2 2v10h16V10c0-1.1-.9-2-2-2z',
        book:       'M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 014 4.5v15z',
        scroll:     'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM7 7h10M7 12h10M7 17h4',
        key:        'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
        ring:       'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2a10 10 0 100 20 10 10 0 000-20z',
        material:   'M12 2l-5.5 9h11L12 2zM17.5 11H6.5L2 20h20l-4.5-9z',
        default:    'M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z'
    };

    // Slot → allowed item types/subTypes mapping
    const SLOT_ACCEPTS = {
        head:      { types: ['armorPiece'], subTypes: ['helmet'] },
        shoulders: { types: ['armorPiece'], subTypes: ['shoulders'] },
        chest:     { types: ['armor'] },
        gloves:    { types: ['armorPiece'], subTypes: ['gloves'] },
        belt:      { types: ['armorPiece'], subTypes: ['belt'] },
        legs:      { types: ['armorPiece'], subTypes: ['legs'] },
        boots:     { types: ['armorPiece'], subTypes: ['boots'] },
        cape:      { types: ['armorPiece'], subTypes: ['cape','back'] },
        mainhand:  { types: ['weapon'] },
        offhand:   { types: ['weapon','armorPiece'], subTypes: ['shield','dagger','wand'] },
        ring1:     { types: ['armorPiece','misc'], subTypes: ['ring'] },
        ring2:     { types: ['armorPiece','misc'], subTypes: ['ring'] },
        amulet:    { types: ['armorPiece','misc'], subTypes: ['amulet','necklace'] },
        talisman:  { types: ['armorPiece','misc'], subTypes: ['talisman'] },
        ammo:      { types: ['misc'], subTypes: ['ammo','ammunition','arrow','bolt'] }
    };

    // German type labels
    const TYPE_LABELS = {
        weapon: 'Waffe', armor: 'Rüstung', armorPiece: 'Rüstungsteil',
        potion: 'Trank', quest: 'Quest-Item', gem: 'Edelstein', misc: 'Sonstiges',
        sword: 'Schwert', greatsword: 'Großschwert', axe: 'Axt', mace: 'Keule',
        bow: 'Bogen', crossbow: 'Armbrust', staff: 'Stab', dagger: 'Dolch',
        spear: 'Speer', wand: 'Zauberstab', hammer: 'Hammer', flail: 'Flegel',
        plate: 'Platte', leather: 'Leder', cloth: 'Stoff', chain: 'Kette',
        helmet: 'Helm', gloves: 'Handschuhe', boots: 'Stiefel', shoulders: 'Schulterstücke',
        shield: 'Schild', belt: 'Gürtel', health: 'Heiltrank', resource: 'Ressourcentrank',
        buff: 'Stärkungstrank', resist: 'Widerstandstrank', key: 'Schlüssel',
        letter: 'Brief', artifact: 'Artefakt', fragment: 'Fragment',
        diamond: 'Diamant', ruby: 'Rubin', emerald: 'Smaragd', sapphire: 'Saphir',
        material: 'Material', junk: 'Schrott', food: 'Nahrung', tool: 'Werkzeug',
        book: 'Buch', scroll: 'Schriftrolle', trophy: 'Trophäe'
    };

    // ════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════

    let _getChar = null;   // () => charData
    let _saveChar = null;  // (charData) => void (calls _stateSet)
    let _charId = null;
    let _filter = { rarity: 'all', type: 'all' };
    let _dragItem = null;
    let _dragSource = null; // { area: 'inventory'|'equipment'|'quickbar', index/slot }
    let _tooltipEl = null;
    let _ctxEl = null;

    // ════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════

    function init(getCharFn, saveCharFn, currentCharId) {
        _getChar = getCharFn;
        _saveChar = saveCharFn;
        _charId = currentCharId;

        _ensureTooltip();
        _ensureContextMenu();
        _bindEventDelegation();
        _bindFilterUI();
        _bindSortButton();
        _bindDragDrop();

        render();
        console.log('[Inventory] Initialized');
    }

    // ════════════════════════════════════════
    //  RENDER — Main
    // ════════════════════════════════════════

    function render() {
        const char = _getChar();
        if (!char) return;

        renderInventoryGrid(char);
        renderEquipment(char);
        renderQuickbar(char);
        renderWeight(char);
    }

    // ════════════════════════════════════════
    //  RENDER — Inventory Grid
    // ════════════════════════════════════════

    function renderInventoryGrid(char) {
        const grid = document.getElementById('inventoryGrid');
        if (!grid) return;

        const items = char.inventory?.items || [];

        // Clear existing item overlays (keep cells)
        grid.querySelectorAll('.inv-item').forEach(el => el.remove());

        // Clear cell occupied markers
        grid.querySelectorAll('.inv-cell').forEach(c => {
            c.classList.remove('occupied', 'filtered-out');
            c.dataset.instanceId = '';
        });

        // Apply filter
        const filtered = items.filter(item => _passesFilter(item));
        const hiddenIds = new Set(items.filter(item => !_passesFilter(item)).map(i => i.instanceId));

        // Place items in cells (simple: 1 item per cell, left-to-right top-to-bottom)
        const cols = char.inventory?.cols || 16;
        const cells = grid.querySelectorAll('.inv-cell');

        filtered.forEach((item, idx) => {
            if (idx >= cells.length) return;

            const cell = cells[idx];
            cell.classList.add('occupied');
            cell.dataset.instanceId = item.instanceId;

            const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const iconPath = _getIconPath(item);

            const el = document.createElement('div');
            el.className = 'inv-item';
            el.draggable = true;
            el.dataset.instanceId = item.instanceId;
            el.dataset.area = 'inventory';
            el.style.background = rarity.bg;
            el.style.borderColor = rarity.border;
            el.style.color = rarity.color;
            el.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="${iconPath}"/></svg>
                ${item.quantity > 1 ? `<span class="item-qty">${item.quantity}</span>` : ''}
            `;

            cell.appendChild(el);
        });
    }

    // ════════════════════════════════════════
    //  RENDER — Equipment Slots
    // ════════════════════════════════════════

    function renderEquipment(char) {
        const equipment = char.equipment || {};

        document.querySelectorAll('.equip-slot').forEach(slot => {
            const slotName = slot.dataset.slot;
            const item = equipment[slotName];

            // Remove old item rendering
            const old = slot.querySelector('.equipped-item');
            if (old) old.remove();

            // Restore label and X-icon visibility
            const label = slot.querySelector('.slot-label');
            const xIcon = slot.querySelector('.empty-slot-icon');
            if (label) label.style.display = item ? 'none' : '';
            if (xIcon) xIcon.style.display = item ? 'none' : '';

            if (!item) return;

            const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const iconPath = _getIconPath(item);

            const el = document.createElement('div');
            el.className = 'equipped-item';
            el.draggable = true;
            el.dataset.instanceId = item.instanceId;
            el.dataset.area = 'equipment';
            el.dataset.slot = slotName;
            el.style.cssText = `background:${rarity.bg};color:${rarity.color};border:1px solid ${rarity.border};border-radius:3px;`;

            el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:50%;height:50%;opacity:0.8"><path d="${iconPath}"/></svg>`;

            slot.appendChild(el);
        });
    }

    // ════════════════════════════════════════
    //  RENDER — Quickbar
    // ════════════════════════════════════════

    function renderQuickbar(char) {
        const quickbar = char.quickbar || [];

        document.querySelectorAll('.potion-slot').forEach((slot, idx) => {
            const item = quickbar[idx];

            // Remove old
            const old = slot.querySelector('.potion-item');
            if (old) old.remove();

            if (!item) return;

            const rarity = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
            const iconPath = _getIconPath(item);

            const el = document.createElement('div');
            el.className = 'potion-item';
            el.draggable = true;
            el.dataset.instanceId = item.instanceId;
            el.dataset.area = 'quickbar';
            el.dataset.qbIndex = idx;
            el.style.cssText = `
                position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
                background:${rarity.bg};color:${rarity.color};border-radius:3px;z-index:1;cursor:grab;
            `;
            el.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:50%;height:50%;opacity:0.8"><path d="${iconPath}"/></svg>
                ${item.quantity > 1 ? `<span class="item-qty">${item.quantity}</span>` : ''}
            `;

            slot.appendChild(el);
        });
    }

    // ════════════════════════════════════════
    //  RENDER — Weight
    // ════════════════════════════════════════

    function renderWeight(char) {
        const el = document.getElementById('inv-weight');
        if (!el) return;

        const items = char.inventory?.items || [];
        const equipment = char.equipment || {};

        let total = 0;
        items.forEach(i => total += (i.weight || 0) * (i.quantity || 1));
        Object.values(equipment).forEach(i => { if (i) total += (i.weight || 0); });

        el.textContent = total.toFixed(1);
    }

    // ════════════════════════════════════════
    //  TOOLTIP
    // ════════════════════════════════════════

    function _ensureTooltip() {
        if (document.getElementById('riftTooltip')) {
            _tooltipEl = document.getElementById('riftTooltip');
            return;
        }
        _tooltipEl = document.createElement('div');
        _tooltipEl.id = 'riftTooltip';
        _tooltipEl.className = 'tooltip';
        document.body.appendChild(_tooltipEl);
    }

    function showTooltip(item, x, y) {
        if (!_tooltipEl || !item) return;

        const r = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
        const typeLabel = TYPE_LABELS[item.subType] || TYPE_LABELS[item.type] || item.type || '';
        const stats = item.finalStats || item.stats || {};

        let statsHtml = '';
        if (stats.damage) statsHtml += `<div class="tt-stat"><span class="label">Schaden:</span> ${stats.damage}</div>`;
        if (stats.armor)  statsHtml += `<div class="tt-stat"><span class="label">Rüstung:</span> ${stats.armor}</div>`;
        if (stats.speed)  statsHtml += `<div class="tt-stat"><span class="label">Tempo:</span> ${stats.speed}s</div>`;
        if (stats.critChance && stats.critChance !== 5) statsHtml += `<div class="tt-stat"><span class="label">Krit:</span> ${stats.critChance}%</div>`;
        if (stats.critDamage && stats.critDamage !== 150) statsHtml += `<div class="tt-stat"><span class="label">Krit-DMG:</span> ${stats.critDamage}%</div>`;

        // Stat bonuses from affixes
        for (const [key, val] of Object.entries(stats)) {
            if (['damage','armor','speed','critChance','critDamage'].includes(key)) continue;
            if (val) statsHtml += `<div class="tt-stat" style="color:${r.color}"><span class="label">${key}:</span> +${val}</div>`;
        }

        const affixHtml = (item.affixes || []).length
            ? `<div class="tt-affixes">${item.affixes.map(a => `<div class="tt-affix">${a}</div>`).join('')}</div><div class="tt-divider"></div>`
            : '';

        const reqHtml = _renderRequirements(item);
        const flagsHtml = _renderFlags(item);

        _tooltipEl.innerHTML = `
            <div class="tt-name" style="color:${r.color}">${_esc(item.displayName || item.name || 'Unbekannt')}</div>
            <div class="tt-type">${_esc(typeLabel)} ${item.slot ? '&middot; ' + _esc(item.slot) : ''}</div>
            <div class="tt-divider"></div>
            ${statsHtml ? `<div class="tt-stats">${statsHtml}</div><div class="tt-divider"></div>` : ''}
            ${affixHtml}
            ${reqHtml}
            ${flagsHtml}
            ${item.description ? `<div class="tt-flavor" style="font-style:normal;color:var(--text-mid)">${_esc(item.description)}</div>` : ''}
            ${item.flavorText ? `<div class="tt-flavor">"${_esc(item.flavorText)}"</div>` : ''}
            <div class="tt-footer">
                <span class="tt-value">${item.finalValue ?? item.value ?? 0} Gold</span>
                <span>${item.weight ?? 0} kg</span>
                ${item.durability ? `<span>${item.durability.current ?? item.durability}/${item.durability.max ?? item.durability}</span>` : ''}
            </div>
        `;

        _tooltipEl.classList.add('visible');
        _positionTooltip(x, y);
    }

    function _renderRequirements(item) {
        const req = item.requirements;
        if (!req) return '';
        const parts = [];
        if (req.level) parts.push(`Lvl ${req.level}`);
        if (req.kraft) parts.push(`Kraft ${req.kraft}`);
        if (req.geschick) parts.push(`Geschick ${req.geschick}`);
        if (req.class?.length) parts.push(req.class.join(', '));
        if (!parts.length) return '';
        return `<div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">Benötigt: ${parts.join(' &middot; ')}</div>`;
    }

    function _renderFlags(item) {
        const flags = item.flags;
        if (!flags) return '';
        const parts = [];
        if (flags.questItem) parts.push('<span style="color:var(--rarity-legendary)">Quest-Item</span>');
        if (flags.soulbound) parts.push('<span style="color:#e74c3c">Seelengebunden</span>');
        if (flags.unique) parts.push('<span style="color:#e74c3c">Einzigartig</span>');
        if (flags.consumable) parts.push('<span style="color:var(--rarity-uncommon)">Verbrauchbar</span>');
        if (!parts.length) return '';
        return `<div style="font-size:10px;margin-bottom:4px">${parts.join(' &middot; ')}</div>`;
    }

    function hideTooltip() {
        if (_tooltipEl) _tooltipEl.classList.remove('visible');
    }

    function _positionTooltip(x, y) {
        const tt = _tooltipEl;
        const pad = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        tt.style.left = '0';
        tt.style.top = '0';
        const rect = tt.getBoundingClientRect();

        let left = x + pad;
        let top = y + pad;
        if (left + rect.width > vw - pad) left = x - rect.width - pad;
        if (top + rect.height > vh - pad) top = y - rect.height - pad;
        if (left < pad) left = pad;
        if (top < pad) top = pad;

        tt.style.left = left + 'px';
        tt.style.top = top + 'px';
    }

    // ════════════════════════════════════════
    //  CONTEXT MENU
    // ════════════════════════════════════════

    function _ensureContextMenu() {
        if (document.getElementById('riftCtxMenu')) {
            _ctxEl = document.getElementById('riftCtxMenu');
            return;
        }
        _ctxEl = document.createElement('div');
        _ctxEl.id = 'riftCtxMenu';
        _ctxEl.className = 'inv-ctx';
        _ctxEl.style.display = 'none';
        document.body.appendChild(_ctxEl);

        document.addEventListener('click', () => _closeCtx());
        document.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('.inv-item, .equipped-item, .potion-item')) _closeCtx();
        });
    }

    function _showCtx(item, sourceArea, sourceKey, x, y) {
        if (!_ctxEl || !item) return;
        hideTooltip();

        const actions = [];

        if (sourceArea === 'inventory') {
            // Can equip?
            const slot = _findEquipSlot(item);
            if (slot) actions.push({ label: 'Ausrüsten', icon: 'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z', action: () => equipItem(item.instanceId) });

            // Can use (consumable)?
            if (item.flags?.consumable) actions.push({ label: 'Benutzen', icon: 'M9 3h6v2l-2 4v8a2 2 0 01-2 2 2 2 0 01-2-2V9L7 5V3h2z', action: () => useItem(item.instanceId) });

            // Quickbar
            actions.push({ label: 'Schnellzugriff', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', action: () => addToQuickbar(item.instanceId) });

            // Split stack
            if (item.quantity > 1) actions.push({ label: 'Teilen', icon: 'M16 3h5v5M4 20L21 3M21 16v5h-5M3 4l18 17', action: () => splitStack(item.instanceId) });

            // Drop
            if (!item.flags?.questItem) actions.push({ label: 'Ablegen', icon: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2', action: () => dropItem(item.instanceId), danger: true });

        } else if (sourceArea === 'equipment') {
            actions.push({ label: 'Ablegen', icon: 'M3 6h18M8 6V4h8v2', action: () => unequipSlot(sourceKey) });

        } else if (sourceArea === 'quickbar') {
            actions.push({ label: 'Entfernen', icon: 'M18 6L6 18M6 6l12 12', action: () => removeFromQuickbar(parseInt(sourceKey)) });
            if (item.flags?.consumable) actions.push({ label: 'Benutzen', icon: 'M9 3h6v2l-2 4v8a2 2 0 01-2 2 2 2 0 01-2-2V9L7 5V3h2z', action: () => useItem(item.instanceId) });
        }

        if (!actions.length) return;

        _ctxEl.innerHTML = actions.map(a => `
            <div class="inv-ctx__item${a.danger ? ' inv-ctx__item--danger' : ''}" data-idx="${actions.indexOf(a)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${a.icon}"/></svg>
                ${a.label}
            </div>
        `).join('');

        _ctxEl.querySelectorAll('.inv-ctx__item').forEach((el, i) => {
            el.addEventListener('click', (e) => { e.stopPropagation(); actions[i].action(); _closeCtx(); });
        });

        _ctxEl.style.display = 'block';
        const rect = _ctxEl.getBoundingClientRect();
        let left = x, top = y;
        if (left + rect.width > window.innerWidth - 8) left = x - rect.width;
        if (top + rect.height > window.innerHeight - 8) top = y - rect.height;
        _ctxEl.style.left = Math.max(8, left) + 'px';
        _ctxEl.style.top = Math.max(8, top) + 'px';
    }

    function _closeCtx() {
        if (_ctxEl) _ctxEl.style.display = 'none';
    }

    // ════════════════════════════════════════
    //  EVENT DELEGATION
    // ════════════════════════════════════════

    function _bindEventDelegation() {
        const container = document.getElementById('sec-inventar');
        if (!container) return;

        // Mouseover for tooltips
        container.addEventListener('mousemove', (e) => {
            const itemEl = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (!itemEl) { hideTooltip(); return; }
            const item = _findItemByInstanceId(itemEl.dataset.instanceId);
            if (item) showTooltip(item, e.clientX, e.clientY);
        });

        container.addEventListener('mouseleave', hideTooltip);

        // Right-click for context menu
        container.addEventListener('contextmenu', (e) => {
            const itemEl = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (!itemEl) return;
            e.preventDefault();
            const item = _findItemByInstanceId(itemEl.dataset.instanceId);
            if (!item) return;

            const area = itemEl.dataset.area || (itemEl.classList.contains('equipped-item') ? 'equipment' : 'inventory');
            const key = itemEl.dataset.slot || itemEl.dataset.qbIndex || '';
            _showCtx(item, area, key, e.clientX, e.clientY);
        });

        // Double-click to equip/use
        container.addEventListener('dblclick', (e) => {
            const itemEl = e.target.closest('.inv-item');
            if (!itemEl) {
                // Double-click equipped item → unequip
                const eqEl = e.target.closest('.equipped-item');
                if (eqEl) { unequipSlot(eqEl.dataset.slot); return; }
                return;
            }
            const item = _findItemByInstanceId(itemEl.dataset.instanceId);
            if (!item) return;

            if (item.flags?.consumable) { useItem(item.instanceId); return; }
            const slot = _findEquipSlot(item);
            if (slot) equipItem(item.instanceId);
        });
    }

    // ════════════════════════════════════════
    //  DRAG & DROP
    // ════════════════════════════════════════

    function _bindDragDrop() {
        const container = document.getElementById('sec-inventar');
        if (!container) return;

        container.addEventListener('dragstart', (e) => {
            const itemEl = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (!itemEl) return;

            _dragItem = _findItemByInstanceId(itemEl.dataset.instanceId);
            _dragSource = {
                area: itemEl.dataset.area || (itemEl.classList.contains('equipped-item') ? 'equipment' : (itemEl.classList.contains('potion-item') ? 'quickbar' : 'inventory')),
                slot: itemEl.dataset.slot || '',
                index: itemEl.dataset.qbIndex || ''
            };

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', _dragItem?.instanceId || '');
            itemEl.style.opacity = '0.4';

            // Highlight valid targets
            _highlightValidTargets(_dragItem);
        });

        container.addEventListener('dragend', (e) => {
            const itemEl = e.target.closest('.inv-item, .equipped-item, .potion-item');
            if (itemEl) itemEl.style.opacity = '1';
            _clearHighlights();
            _dragItem = null;
            _dragSource = null;
        });

        container.addEventListener('dragover', (e) => {
            const target = e.target.closest('.inv-cell, .equip-slot, .potion-slot');
            if (!target) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            target.classList.add('drag-over');
        });

        container.addEventListener('dragleave', (e) => {
            const target = e.target.closest('.inv-cell, .equip-slot, .potion-slot');
            if (target) target.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest('.inv-cell, .equip-slot, .potion-slot');
            if (!target || !_dragItem) { _clearHighlights(); return; }
            target.classList.remove('drag-over');

            if (target.classList.contains('equip-slot')) {
                _dropOnEquipSlot(target.dataset.slot, _dragItem, _dragSource);
            } else if (target.classList.contains('potion-slot')) {
                const idx = Array.from(target.parentElement.children).indexOf(target);
                _dropOnQuickbar(idx, _dragItem, _dragSource);
            } else if (target.classList.contains('inv-cell')) {
                _dropOnInventory(_dragItem, _dragSource);
            }

            _clearHighlights();
            _dragItem = null;
            _dragSource = null;
        });
    }

    function _highlightValidTargets(item) {
        if (!item) return;
        document.querySelectorAll('.equip-slot').forEach(slot => {
            if (_canEquipInSlot(item, slot.dataset.slot)) {
                slot.classList.add('valid-target');
            }
        });
    }

    function _clearHighlights() {
        document.querySelectorAll('.valid-target, .drag-over').forEach(el => el.classList.remove('valid-target', 'drag-over'));
    }

    function _dropOnEquipSlot(slotName, item, source) {
        if (!_canEquipInSlot(item, slotName)) return;

        const char = _getChar();
        if (!char.equipment) char.equipment = {};

        // If slot is occupied, swap to inventory
        const existing = char.equipment[slotName];
        if (existing) {
            if (!char.inventory.items) char.inventory.items = [];
            char.inventory.items.push(existing);
        }

        // Remove from source
        _removeFromSource(item, source, char);

        // Place in slot
        char.equipment[slotName] = item;
        _save(char);
    }

    function _dropOnQuickbar(idx, item, source) {
        const char = _getChar();
        if (!char.quickbar) char.quickbar = Array(8).fill(null);

        // Swap existing back if needed
        const existing = char.quickbar[idx];
        if (existing && source.area === 'quickbar') {
            char.quickbar[parseInt(source.index)] = existing;
        } else if (existing) {
            if (!char.inventory.items) char.inventory.items = [];
            char.inventory.items.push(existing);
        }

        if (source.area !== 'quickbar') _removeFromSource(item, source, char);
        else char.quickbar[parseInt(source.index)] = null;

        char.quickbar[idx] = { ...item };
        _save(char);
    }

    function _dropOnInventory(item, source) {
        if (source.area === 'inventory') return; // Same area, no-op for now

        const char = _getChar();
        _removeFromSource(item, source, char);

        if (!char.inventory.items) char.inventory.items = [];
        char.inventory.items.push(item);
        _save(char);
    }

    function _removeFromSource(item, source, char) {
        if (source.area === 'inventory') {
            char.inventory.items = (char.inventory.items || []).filter(i => i.instanceId !== item.instanceId);
        } else if (source.area === 'equipment') {
            if (char.equipment?.[source.slot]) char.equipment[source.slot] = null;
        } else if (source.area === 'quickbar') {
            if (char.quickbar) char.quickbar[parseInt(source.index)] = null;
        }
    }

    // ════════════════════════════════════════
    //  ACTIONS
    // ════════════════════════════════════════

    function equipItem(instanceId) {
        const char = _getChar();
        const items = char.inventory?.items || [];
        const idx = items.findIndex(i => i.instanceId === instanceId);
        if (idx === -1) return;

        const item = items[idx];
        const slotName = _findEquipSlot(item);
        if (!slotName) return;

        if (!char.equipment) char.equipment = {};

        // Swap existing
        const existing = char.equipment[slotName];
        if (existing) items.push(existing);

        items.splice(idx, 1);
        char.equipment[slotName] = item;
        _save(char);
    }

    function unequipSlot(slotName) {
        const char = _getChar();
        if (!char.equipment?.[slotName]) return;

        const item = char.equipment[slotName];
        char.equipment[slotName] = null;
        if (!char.inventory.items) char.inventory.items = [];
        char.inventory.items.push(item);
        _save(char);
    }

    function useItem(instanceId) {
        const char = _getChar();
        const item = _findItemInChar(char, instanceId);
        if (!item || !item.flags?.consumable) return;

        // Apply effects
        if (item.type === 'potion' || item.subType === 'health') {
            // Heal effect
            const healAmount = parseInt(item.stats?.heal || item.stats?.damage || '25');
            char.hp = Math.min((char.hp || 0) + healAmount, char.hpMax || 100);
            _notify(`${item.displayName || item.name}: +${healAmount} LP`);
        } else if (item.subType === 'resource') {
            const amount = parseInt(item.stats?.restore || '25');
            char.resource = Math.min((char.resource || 0) + amount, char.resourceMax || 100);
            _notify(`${item.displayName || item.name}: +${amount} Ressource`);
        } else {
            _notify(`${item.displayName || item.name} benutzt`);
        }

        // Reduce quantity or remove
        if (item.quantity > 1) {
            item.quantity--;
        } else {
            _removeItemFromChar(char, instanceId);
        }

        _save(char);
    }

    function dropItem(instanceId) {
        if (!confirm('Item ablegen?')) return;
        const char = _getChar();
        _removeItemFromChar(char, instanceId);
        _save(char);
    }

    function addToQuickbar(instanceId) {
        const char = _getChar();
        if (!char.quickbar) char.quickbar = Array(8).fill(null);

        const item = _findItemInChar(char, instanceId);
        if (!item) return;

        // Find first empty quickbar slot
        const emptyIdx = char.quickbar.findIndex(s => !s);
        if (emptyIdx === -1) { _notify('Schnellzugriff voll'); return; }

        // Copy reference
        char.quickbar[emptyIdx] = { ...item };
        _save(char);
    }

    function removeFromQuickbar(idx) {
        const char = _getChar();
        if (!char.quickbar) return;
        char.quickbar[idx] = null;
        _save(char);
    }

    function splitStack(instanceId) {
        const char = _getChar();
        const items = char.inventory?.items || [];
        const item = items.find(i => i.instanceId === instanceId);
        if (!item || item.quantity <= 1) return;

        const half = Math.floor(item.quantity / 2);
        item.quantity -= half;

        const clone = { ...item, instanceId: 'inst_' + _uid(8), quantity: half };
        items.push(clone);
        _save(char);
    }

    function addItem(itemInstance) {
        const char = _getChar();
        if (!char.inventory) char.inventory = { cols: 16, rows: 11, items: [] };
        if (!char.inventory.items) char.inventory.items = [];

        // Check if stackable and already exists
        if (itemInstance.stackable || itemInstance.flags?.consumable) {
            const existing = char.inventory.items.find(i => i.baseItemId === itemInstance.baseItemId);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + (itemInstance.quantity || 1);
                _save(char);
                return;
            }
        }

        if (!itemInstance.instanceId) itemInstance.instanceId = 'inst_' + _uid(8);
        char.inventory.items.push(itemInstance);
        _save(char);
    }

    function removeItem(instanceId) {
        const char = _getChar();
        _removeItemFromChar(char, instanceId);
        _save(char);
    }

    // ════════════════════════════════════════
    //  SORT & FILTER
    // ════════════════════════════════════════

    function _bindSortButton() {
        const btn = document.getElementById('sortBtn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const char = _getChar();
            if (!char.inventory?.items) return;

            const rarityOrder = { legendary: 0, unique: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
            char.inventory.items.sort((a, b) => {
                const ra = rarityOrder[a.rarity] ?? 9;
                const rb = rarityOrder[b.rarity] ?? 9;
                if (ra !== rb) return ra - rb;
                const ta = a.type || '';
                const tb = b.type || '';
                if (ta !== tb) return ta.localeCompare(tb);
                return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
            });
            _save(char);
        });
    }

    function _bindFilterUI() {
        const filterBtn = document.getElementById('filterBtn');
        const dropdown = document.getElementById('filterDropdown');
        if (!filterBtn || !dropdown) return;

        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => dropdown.classList.remove('open'));
        dropdown.addEventListener('click', (e) => e.stopPropagation());

        // Rarity chips
        dropdown.querySelectorAll('#filterRarity .filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                dropdown.querySelectorAll('#filterRarity .filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                _filter.rarity = chip.dataset.val;
                render();
            });
        });

        // Type chips
        dropdown.querySelectorAll('#filterType .filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                dropdown.querySelectorAll('#filterType .filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                _filter.type = chip.dataset.val;
                render();
            });
        });
    }

    function _passesFilter(item) {
        if (_filter.rarity !== 'all' && item.rarity !== _filter.rarity) return false;
        if (_filter.type !== 'all') {
            const ft = _filter.type;
            if (ft === 'armor' && item.type !== 'armor' && item.type !== 'armorPiece') return false;
            if (ft === 'weapon' && item.type !== 'weapon') return false;
            if (ft === 'jewelry' && !['ring','amulet','talisman','necklace'].includes(item.subType)) return false;
            if (ft === 'consumable' && !item.flags?.consumable && item.type !== 'potion') return false;
            if (ft === 'quest' && item.type !== 'quest' && !item.flags?.questItem) return false;
            if (ft === 'other' && ['weapon','armor','armorPiece','potion','quest'].includes(item.type) && !['ring','amulet','talisman'].includes(item.subType) && !item.flags?.questItem) return false;
        }
        return true;
    }

    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════

    function _getIconPath(item) {
        return TYPE_ICONS[item.subType] || TYPE_ICONS[item.type] || TYPE_ICONS.default;
    }

    function _findItemByInstanceId(instanceId) {
        if (!instanceId) return null;
        const char = _getChar();
        if (!char) return null;

        // Search inventory
        const invItem = (char.inventory?.items || []).find(i => i.instanceId === instanceId);
        if (invItem) return invItem;

        // Search equipment
        for (const item of Object.values(char.equipment || {})) {
            if (item?.instanceId === instanceId) return item;
        }

        // Search quickbar
        for (const item of (char.quickbar || [])) {
            if (item?.instanceId === instanceId) return item;
        }

        return null;
    }

    function _findItemInChar(char, instanceId) {
        const inv = (char.inventory?.items || []).find(i => i.instanceId === instanceId);
        if (inv) return inv;
        for (const item of Object.values(char.equipment || {})) {
            if (item?.instanceId === instanceId) return item;
        }
        for (const item of (char.quickbar || [])) {
            if (item?.instanceId === instanceId) return item;
        }
        return null;
    }

    function _removeItemFromChar(char, instanceId) {
        if (char.inventory?.items) {
            char.inventory.items = char.inventory.items.filter(i => i.instanceId !== instanceId);
        }
        if (char.equipment) {
            for (const [slot, item] of Object.entries(char.equipment)) {
                if (item?.instanceId === instanceId) char.equipment[slot] = null;
            }
        }
        if (char.quickbar) {
            char.quickbar = char.quickbar.map(i => i?.instanceId === instanceId ? null : i);
        }
    }

    function _canEquipInSlot(item, slotName) {
        const accepts = SLOT_ACCEPTS[slotName];
        if (!accepts) return false;
        if (accepts.types && !accepts.types.includes(item.type)) return false;
        if (accepts.subTypes && !accepts.subTypes.includes(item.subType)) return false;
        return true;
    }

    function _findEquipSlot(item) {
        // Direct slot from item data
        if (item.slot) {
            const mapped = _mapSlotName(item.slot);
            if (mapped) return mapped;
        }
        // Find first matching slot
        for (const [slotName, accepts] of Object.entries(SLOT_ACCEPTS)) {
            if (_canEquipInSlot(item, slotName)) {
                const char = _getChar();
                if (!char.equipment?.[slotName]) return slotName;
            }
        }
        // All matching slots full, return first match anyway
        for (const [slotName] of Object.entries(SLOT_ACCEPTS)) {
            if (_canEquipInSlot(item, slotName)) return slotName;
        }
        return null;
    }

    function _mapSlotName(slot) {
        const map = {
            mainHand: 'mainhand', offHand: 'offhand', head: 'head',
            chest: 'chest', legs: 'legs', feet: 'boots', hands: 'gloves',
            shoulders: 'shoulders', belt: 'belt', back: 'cape',
            ring: 'ring1', amulet: 'amulet', mainhand: 'mainhand', offhand: 'offhand',
            boots: 'boots', gloves: 'gloves', cape: 'cape', talisman: 'talisman'
        };
        return map[slot] || slot;
    }

    function _save(char) {
        _saveChar(char);
        render();
    }

    function _notify(msg) {
        if (window.RIFTToast?.show) RIFTToast.show(msg, 'info');
        else console.log('[Inventory]', msg);
    }

    function _esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function _uid(len) {
        const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let r = '';
        for (let i = 0; i < len; i++) r += c[Math.floor(Math.random() * c.length)];
        return r;
    }

    // ════════════════════════════════════════
    //  STARTER KIT / DEV TOOLS
    // ════════════════════════════════════════

    function loadStarterKit() {
        const char = _getChar();
        if (!char) return;
        if (!char.inventory) char.inventory = { cols: 16, rows: 11, items: [] };
        if (!char.inventory.items) char.inventory.items = [];

        const demoItems = [
            {
                instanceId: 'inst_demo_001', baseItemId: 'iron_sword', displayName: 'Eisenschwert',
                type: 'weapon', subType: 'sword', slot: 'mainHand', rarity: 'common',
                quantity: 1, weight: 3.5, value: 50,
                stats: { damage: '2d6+2', speed: 1.2, critChance: 5, critDamage: 150 },
                flags: { tradeable: true }, description: 'Ein einfaches Schwert aus Eisen.',
                flavorText: 'Geschmiedet in der Schmiede von Kaldur.'
            },
            {
                instanceId: 'inst_demo_002', baseItemId: 'flame_axe', displayName: 'Flammendes Kriegsbeil',
                type: 'weapon', subType: 'axe', slot: 'mainHand', rarity: 'rare',
                affixes: ['flaming'], quantity: 1, weight: 5.0, value: 280, finalValue: 280,
                finalStats: { damage: '2d8+3 + 1d4 Feuer', speed: 1.5, critChance: 8, critDamage: 175 },
                stats: { damage: '2d8+3 + 1d4 Feuer', speed: 1.5, critChance: 8, critDamage: 175 },
                flags: { tradeable: true }, description: 'Eine Axt, durchzogen von Flammenmagie.',
                flavorText: 'Wer sie schwingt, spürt die Hitze der Schmiede der Alten.'
            },
            {
                instanceId: 'inst_demo_003', baseItemId: 'steel_plate', displayName: 'Stahlplattenrüstung',
                type: 'armor', subType: 'plate', slot: 'chest', rarity: 'uncommon',
                quantity: 1, weight: 18.0, value: 320,
                stats: { armor: 12, speed: -0.2 },
                flags: { tradeable: true }, description: 'Schwere Plattenrüstung aus gehärtetem Stahl.'
            },
            {
                instanceId: 'inst_demo_004', baseItemId: 'leather_boots', displayName: 'Laufstiefel des Windes',
                type: 'armorPiece', subType: 'boots', slot: 'feet', rarity: 'rare',
                affixes: ['of_wind'], quantity: 1, weight: 1.5, value: 175, finalValue: 175,
                finalStats: { armor: 3, speed: 0.3, geschick: 2 },
                stats: { armor: 3, speed: 0.3, geschick: 2 },
                flags: { tradeable: true }, description: 'Leichte Stiefel, die den Träger schneller machen.'
            },
            {
                instanceId: 'inst_demo_005', baseItemId: 'hp_potion', displayName: 'Heiltrank',
                type: 'potion', subType: 'health', rarity: 'common',
                quantity: 5, weight: 0.3, value: 25, stackable: true,
                stats: { heal: '35' },
                flags: { consumable: true, tradeable: true }, description: 'Stellt 35 LP wieder her.'
            },
            {
                instanceId: 'inst_demo_006', baseItemId: 'res_potion', displayName: 'Manatrank',
                type: 'potion', subType: 'resource', rarity: 'uncommon',
                quantity: 3, weight: 0.3, value: 45, stackable: true,
                stats: { restore: '40' },
                flags: { consumable: true, tradeable: true }, description: 'Stellt 40 Ressource wieder her.'
            },
            {
                instanceId: 'inst_demo_007', baseItemId: 'ancient_key', displayName: 'Schlüssel der Vergessenen Kammer',
                type: 'quest', subType: 'key', rarity: 'epic',
                quantity: 1, weight: 0.1, value: 0,
                flags: { questItem: true, soulbound: true }, description: 'Öffnet die Kammer unter dem Turm von Eldrath.',
                flavorText: 'Kalt wie der Tod und alt wie die Welt selbst.'
            },
            {
                instanceId: 'inst_demo_008', baseItemId: 'ruby_gem', displayName: 'Makelioser Rubin',
                type: 'gem', subType: 'ruby', rarity: 'epic',
                quantity: 2, weight: 0.1, value: 500, stackable: true,
                flags: { tradeable: true }, description: 'Ein funkelnder Rubin von außergewöhnlicher Reinheit.'
            },
            {
                instanceId: 'inst_demo_009', baseItemId: 'iron_helmet', displayName: 'Eisenhelm',
                type: 'armorPiece', subType: 'helmet', slot: 'head', rarity: 'common',
                quantity: 1, weight: 2.0, value: 35,
                stats: { armor: 4 },
                flags: { tradeable: true }, description: 'Ein einfacher Helm aus Eisen.'
            },
            {
                instanceId: 'inst_demo_010', baseItemId: 'shadow_ring', displayName: 'Schattenring der Dämmerung',
                type: 'armorPiece', subType: 'ring', slot: 'ring', rarity: 'legendary',
                affixes: ['shadow', 'of_dusk'], quantity: 1, weight: 0.05, value: 2500, finalValue: 2500,
                finalStats: { critChance: 12, geschick: 5, kraft: -2 },
                stats: { critChance: 12, geschick: 5, kraft: -2 },
                flags: { unique: true }, description: 'Verleiht dem Träger übernatürliche Reflexe auf Kosten roher Kraft.',
                flavorText: 'Geformt aus dem letzten Schatten eines sterbenden Gottes.'
            },
            {
                instanceId: 'inst_demo_011', baseItemId: 'wolf_pelt', displayName: 'Wolfsfell',
                type: 'misc', subType: 'material', rarity: 'common',
                quantity: 4, weight: 1.0, value: 8, stackable: true,
                flags: { tradeable: true }, description: 'Ein grobes Fell, gut zum Verkaufen oder Verarbeiten.'
            },
            {
                instanceId: 'inst_demo_012', baseItemId: 'dragon_shield', displayName: 'Drachenschuppenschild',
                type: 'armorPiece', subType: 'shield', slot: 'offHand', rarity: 'legendary',
                quantity: 1, weight: 6.0, value: 3200, finalValue: 3200,
                finalStats: { armor: 18, resist_fire: 25 },
                stats: { armor: 18, resist_fire: 25 },
                flags: { tradeable: true }, description: 'Ein mächtiger Schild aus echten Drachenschuppen.',
                flavorText: 'Kein Feuer kann den durchdringen, der Shurak bezwungen hat.'
            }
        ];

        // Only add items that don't already exist
        const existingIds = new Set(char.inventory.items.map(i => i.instanceId));
        let added = 0;
        for (const item of demoItems) {
            if (!existingIds.has(item.instanceId)) {
                char.inventory.items.push(item);
                added++;
            }
        }

        if (added > 0) {
            _save(char);
            _notify(`${added} Demo-Items hinzugefügt`);
        } else {
            _notify('Demo-Items bereits vorhanden');
        }
    }

    // ════════════════════════════════════════
    //  PUBLIC API
    // ════════════════════════════════════════

    return {
        init,
        render,
        addItem,
        removeItem,
        equipItem,
        unequipSlot,
        useItem,
        dropItem,
        addToQuickbar,
        removeFromQuickbar,
        splitStack,
        showTooltip,
        hideTooltip,
        loadStarterKit,
        RARITY_COLORS,
        TYPE_ICONS,
        TYPE_LABELS
    };

})();

window.RiftInventory = RiftInventory;

/**
 * ═══════════════════════════════════════════════════════════════
 *  RIFT Admin: Item-Katalog (Worlds Apart)
 *  
 *  Firestore:  admin/itemCatalog/worldsapart/items/{itemId}
 *              admin/itemCatalog/worldsapart/affixes/{affixId}
 *
 *  Usage:      ItemCatalog.init()  — called from admin.html
 * ═══════════════════════════════════════════════════════════════
 */

const ItemCatalog = (() => {
    'use strict';

    // ════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════

    const COLLECTION = 'admin/itemCatalog/worldsapart';

    const ITEM_TYPES = [
        { id: 'weapon',     label: 'Waffe',         icon: 'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z' },
        { id: 'armor',      label: 'Rüstung',       icon: 'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z' },
        { id: 'armorPiece', label: 'Rüstungsteil',  icon: 'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z' },
        { id: 'potion',     label: 'Trank',          icon: 'M9 3h6v2H9zm0 2l-3 8v6a2 2 0 002 2h8a2 2 0 002-2v-6l-3-8z' },
        { id: 'quest',      label: 'Quest-Item',     icon: 'M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z' },
        { id: 'gem',        label: 'Edelstein',      icon: 'M12 2L2 12l10 10 10-10L12 2z' },
        { id: 'misc',       label: 'Sonstiges',      icon: 'M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4z' }
    ];

    const SUB_TYPES = {
        weapon:     ['sword','greatsword','axe','mace','bow','crossbow','staff','dagger','spear','wand','hammer','flail'],
        armor:      ['plate','leather','cloth','chain'],
        armorPiece: ['helmet','gloves','boots','shoulders','shield','belt'],
        potion:     ['health','resource','buff','resist','antidote'],
        quest:      ['key','letter','artifact','fragment','map','relic'],
        gem:        ['diamond','ruby','emerald','sapphire','amethyst','topaz','onyx'],
        misc:       ['material','junk','food','tool','book','scroll','trophy']
    };

    const SLOTS = {
        weapon:     ['mainHand','offHand'],
        armor:      ['chest'],
        armorPiece: { helmet:'head', gloves:'hands', boots:'feet', shoulders:'shoulders', shield:'offHand', belt:'belt' },
        potion:     [],
        quest:      [],
        gem:        [],
        misc:       []
    };

    const RARITIES = [
        { id: 'common',    label: 'Gewöhnlich',  color: '#9ca3af', affixSlots: 0, valueMul: 1.0 },
        { id: 'uncommon',  label: 'Ungewöhnlich', color: '#22c55e', affixSlots: 1, valueMul: 1.5 },
        { id: 'rare',      label: 'Selten',       color: '#3b82f6', affixSlots: 2, valueMul: 2.5 },
        { id: 'epic',      label: 'Episch',       color: '#a855f7', affixSlots: 2, valueMul: 5.0 },
        { id: 'legendary', label: 'Legendär',     color: '#f59e0b', affixSlots: 3, valueMul: 10.0 },
        { id: 'unique',    label: 'Einzigartig',  color: '#ef4444', affixSlots: 0, valueMul: 1.0 }
    ];

    const AFFIX_TYPES = [
        { id: 'prefix', label: 'Präfix', example: 'Flammendes {Item}' },
        { id: 'suffix', label: 'Suffix', example: '{Item} der Stärke' }
    ];

    // ── German Name Tables for Randomizer ──
    const NAME_PREFIXES = {
        common:    ['Einfach','Schlicht','Alt','Rostig','Abgenutzt','Grob','Gewöhnlich','Stumpf'],
        uncommon:  ['Geschärft','Gehärtet','Fein','Poliert','Verziert','Robust','Solide'],
        rare:      ['Flammend','Eisig','Giftig','Arkanes','Gesegnet','Verfluchtes','Blitz-','Schatten-'],
        epic:      ['Verwüstend','Himmlisch','Infernalisch','Drakonisch','Ätherisch','Abgrundtief'],
        legendary: ['Göttlich','Uraltes','Verderbtes','Seelenfressendes','Weltenbrecher-','Schicksals-']
    };

    const NAME_SUFFIXES = {
        common:    [],
        uncommon:  ['der Ausdauer','des Schutzes','der Hast','des Lichts'],
        rare:      ['der Stärke','der Geschicklichkeit','der Intelligenz','des Feuers','des Eises','der Schatten','der Heilung'],
        epic:      ['der Vernichtung','der Unsterblichkeit','des Drachen','der Leere','des Chaos','der Ewigkeit'],
        legendary: ['der Götter','des Weltenendes','der verlorenen Seelen','des ersten Königs','der Dimensionen']
    };

    // ════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════

    let _db = null;
    let _items = [];
    let _affixes = [];
    let _filter = { type: 'all', rarity: 'all', search: '' };
    let _editingItem = null;

    // ════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════

    async function init() {
        _db = firebase.firestore();
        await loadItems();
        await loadAffixes();
        render();
        console.log('[ItemCatalog] Initialized:', _items.length, 'items,', _affixes.length, 'affixes');
    }

    async function loadItems() {
        try {
            const snap = await _db.collection(COLLECTION + '/items').orderBy('name').get();
            _items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[ItemCatalog] Load items error:', e);
            _items = [];
        }
    }

    async function loadAffixes() {
        try {
            const snap = await _db.collection(COLLECTION + '/affixes').orderBy('name').get();
            _affixes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[ItemCatalog] Load affixes error:', e);
            _affixes = [];
        }
    }

    // ════════════════════════════════════════
    //  RENDER — Item Grid
    // ════════════════════════════════════════

    function render() {
        const container = document.getElementById('itemCatalogGrid');
        if (!container) return;

        const filtered = _items.filter(item => {
            if (_filter.type !== 'all' && item.type !== _filter.type) return false;
            if (_filter.rarity !== 'all' && item.rarity !== _filter.rarity) return false;
            if (_filter.search) {
                const q = _filter.search.toLowerCase();
                if (!item.name?.toLowerCase().includes(q) && !item.subType?.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false;
            }
            return true;
        });

        // Stats
        document.getElementById('icStatTotal').textContent = _items.length;
        document.getElementById('icStatWeapons').textContent = _items.filter(i => i.type === 'weapon').length;
        document.getElementById('icStatArmor').textContent = _items.filter(i => i.type === 'armor' || i.type === 'armorPiece').length;
        document.getElementById('icStatOther').textContent = _items.filter(i => !['weapon','armor','armorPiece'].includes(i.type)).length;

        if (!filtered.length) {
            container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 16px;opacity:0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                <p style="font-size:16px;font-weight:600;margin-bottom:4px">${_items.length ? 'Keine Treffer' : 'Noch keine Items'}</p>
                <p style="font-size:13px;opacity:0.6">${_items.length ? 'Filter anpassen' : 'Erstelle dein erstes Item mit dem + Button'}</p>
            </div>`;
            return;
        }

        container.innerHTML = filtered.map(item => {
            const rarity = RARITIES.find(r => r.id === item.rarity) || RARITIES[0];
            const type = ITEM_TYPES.find(t => t.id === item.type) || ITEM_TYPES[6];
            const statHtml = _renderItemStatPreview(item);

            return `<div class="ic-card" data-id="${item.id}" onclick="ItemCatalog.openEditor('${item.id}')" style="--rarity-color:${rarity.color}">
                <div class="ic-card__rarity" style="background:${rarity.color}">${rarity.label}</div>
                <div class="ic-card__icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="color:${rarity.color}"><path d="${type.icon}"/></svg>
                </div>
                <div class="ic-card__name">${_esc(item.name)}</div>
                <div class="ic-card__sub">${_esc(item.subType || type.label)}</div>
                <div class="ic-card__stats">${statHtml}</div>
                <div class="ic-card__footer">
                    <span class="ic-card__value">${item.value || 0} Gold</span>
                    <span class="ic-card__weight">${item.weight || 0} kg</span>
                </div>
            </div>`;
        }).join('');
    }

    function _renderItemStatPreview(item) {
        const parts = [];
        if (item.stats?.damage) parts.push(`<span class="ic-stat ic-stat--dmg">${item.stats.damage} DMG</span>`);
        if (item.stats?.armor)  parts.push(`<span class="ic-stat ic-stat--def">${item.stats.armor} DEF</span>`);
        if (item.stats?.speed)  parts.push(`<span class="ic-stat ic-stat--spd">${item.stats.speed}s</span>`);
        if (item.stats?.critChance) parts.push(`<span class="ic-stat ic-stat--crit">${item.stats.critChance}% Krit</span>`);
        if (item.flags?.consumable) parts.push(`<span class="ic-stat ic-stat--use">Verbrauchbar</span>`);
        if (item.flags?.questItem)  parts.push(`<span class="ic-stat ic-stat--quest">Quest</span>`);
        return parts.join('') || '<span class="ic-stat">—</span>';
    }

    // ════════════════════════════════════════
    //  RENDER — Affix List
    // ════════════════════════════════════════

    function renderAffixes() {
        const container = document.getElementById('affixList');
        if (!container) return;

        container.innerHTML = _affixes.map(a => {
            const mods = Object.entries(a.statMods || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
            return `<div class="ic-affix-row" data-id="${a.id}">
                <span class="ic-affix-type ic-affix-type--${a.type}">${a.type === 'prefix' ? 'PRE' : 'SUF'}</span>
                <span class="ic-affix-name">${_esc(a.name)}</span>
                <span class="ic-affix-mods">${mods || '—'}</span>
                <span class="ic-affix-rarity" style="color:${(RARITIES.find(r => r.id === a.rarity) || {}).color || '#999'}">${a.rarity}</span>
                <div class="ic-affix-actions">
                    <button class="btn btn--ghost btn--small" onclick="ItemCatalog.editAffix('${a.id}')" title="Bearbeiten">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn--ghost btn--small" onclick="ItemCatalog.deleteAffix('${a.id}')" title="Löschen" style="color:var(--red)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('') || '<div style="text-align:center;padding:30px;color:var(--text-muted)">Noch keine Affixe</div>';
    }

    // ════════════════════════════════════════
    //  EDITOR MODAL — Items
    // ════════════════════════════════════════

    function openEditor(itemId) {
        _editingItem = itemId ? _items.find(i => i.id === itemId) : _blankItem();

        const isNew = !itemId;
        const item = _editingItem;
        const rarity = RARITIES.find(r => r.id === item.rarity) || RARITIES[0];

        const typeOptions = ITEM_TYPES.map(t =>
            `<option value="${t.id}" ${item.type === t.id ? 'selected' : ''}>${t.label}</option>`
        ).join('');

        const subTypeOptions = (SUB_TYPES[item.type] || []).map(s =>
            `<option value="${s}" ${item.subType === s ? 'selected' : ''}>${s}</option>`
        ).join('');

        const rarityOptions = RARITIES.map(r =>
            `<option value="${r.id}" ${item.rarity === r.id ? 'selected' : ''} style="color:${r.color}">${r.label}</option>`
        ).join('');

        const slotOptions = _getSlotsForType(item.type).map(s =>
            `<option value="${s}" ${item.slot === s ? 'selected' : ''}>${s}</option>`
        ).join('');

        const html = `
        <div class="modal active" id="itemEditorModal" onclick="if(event.target===this)ItemCatalog.closeEditor()">
            <div class="modal__card" style="max-width:720px;max-height:90vh;overflow-y:auto">
                <div class="modal__header">
                    <h2>${isNew ? 'Neues Item' : _esc(item.name) + ' bearbeiten'}</h2>
                    <button class="modal__close" onclick="ItemCatalog.closeEditor()">&times;</button>
                </div>
                <div class="modal__body" style="display:flex;flex-direction:column;gap:16px">
                    <!-- Row 1: Basics -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="field">
                            <label class="field__label">Name</label>
                            <input type="text" class="field__input" id="ieditName" value="${_esc(item.name)}" placeholder="Eisenschwert">
                        </div>
                        <div class="field">
                            <label class="field__label">ID <span style="opacity:0.4">(auto)</span></label>
                            <input type="text" class="field__input" id="ieditId" value="${_esc(item.id)}" placeholder="iron_sword_01" ${isNew ? '' : 'readonly style="opacity:0.5"'}>
                        </div>
                    </div>

                    <!-- Row 2: Type, SubType, Rarity, Slot -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
                        <div class="field">
                            <label class="field__label">Typ</label>
                            <select class="field__input" id="ieditType" onchange="ItemCatalog._onTypeChange()">${typeOptions}</select>
                        </div>
                        <div class="field">
                            <label class="field__label">Sub-Typ</label>
                            <select class="field__input" id="ieditSubType">${subTypeOptions}</select>
                        </div>
                        <div class="field">
                            <label class="field__label">Rarität</label>
                            <select class="field__input" id="ieditRarity">${rarityOptions}</select>
                        </div>
                        <div class="field">
                            <label class="field__label">Slot</label>
                            <select class="field__input" id="ieditSlot"><option value="">—</option>${slotOptions}</select>
                        </div>
                    </div>

                    <!-- Row 3: Description -->
                    <div class="field">
                        <label class="field__label">Beschreibung</label>
                        <textarea class="field__input" id="ieditDesc" rows="2" placeholder="Ein einfaches Schwert...">${_esc(item.description || '')}</textarea>
                    </div>
                    <div class="field">
                        <label class="field__label">Flavor-Text <span style="opacity:0.4">(kursiv)</span></label>
                        <input type="text" class="field__input" id="ieditFlavor" value="${_esc(item.flavorText || '')}" placeholder="Geschmiedet in der Schmiede von Kaldur...">
                    </div>

                    <!-- Row 4: Stats -->
                    <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px">Stats</div>
                        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
                            <div class="field"><label class="field__label">Schaden</label><input type="text" class="field__input" id="ieditDamage" value="${_esc(item.stats?.damage || '')}" placeholder="2d6+2"></div>
                            <div class="field"><label class="field__label">Rüstung</label><input type="number" class="field__input" id="ieditArmor" value="${item.stats?.armor || 0}"></div>
                            <div class="field"><label class="field__label">Tempo</label><input type="number" step="0.1" class="field__input" id="ieditSpeed" value="${item.stats?.speed || 0}"></div>
                            <div class="field"><label class="field__label">Krit %</label><input type="number" class="field__input" id="ieditCrit" value="${item.stats?.critChance || 5}"></div>
                            <div class="field"><label class="field__label">Krit-DMG %</label><input type="number" class="field__input" id="ieditCritDmg" value="${item.stats?.critDamage || 150}"></div>
                        </div>
                    </div>

                    <!-- Row 5: Economy -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
                        <div class="field"><label class="field__label">Wert (Gold)</label><input type="number" class="field__input" id="ieditValue" value="${item.value || 0}"></div>
                        <div class="field"><label class="field__label">Gewicht (kg)</label><input type="number" step="0.1" class="field__input" id="ieditWeight" value="${item.weight || 0}"></div>
                        <div class="field"><label class="field__label">Haltbarkeit</label><input type="number" class="field__input" id="ieditDurability" value="${item.durability || 100}" title="0 = unzerstörbar"></div>
                        <div class="field"><label class="field__label">Max Stack</label><input type="number" class="field__input" id="ieditStack" value="${item.maxStack || 1}"></div>
                    </div>

                    <!-- Row 6: Requirements -->
                    <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px">Voraussetzungen</div>
                        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
                            <div class="field"><label class="field__label">Level</label><input type="number" class="field__input" id="ieditReqLevel" value="${item.requirements?.level || 0}"></div>
                            <div class="field"><label class="field__label">Kraft</label><input type="number" class="field__input" id="ieditReqKraft" value="${item.requirements?.kraft || 0}"></div>
                            <div class="field"><label class="field__label">Geschick</label><input type="number" class="field__input" id="ieditReqGes" value="${item.requirements?.geschick || 0}"></div>
                            <div class="field"><label class="field__label">Klassen <span style="opacity:0.4">(kommagetrennt)</span></label><input type="text" class="field__input" id="ieditReqClass" value="${(item.requirements?.class || []).join(', ')}" placeholder="alle"></div>
                        </div>
                    </div>

                    <!-- Row 7: Flags -->
                    <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0">
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                            <input type="checkbox" id="ieditFlagQuest" ${item.flags?.questItem ? 'checked' : ''}> Quest-Item
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                            <input type="checkbox" id="ieditFlagBound" ${item.flags?.soulbound ? 'checked' : ''}> Seelengebunden
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                            <input type="checkbox" id="ieditFlagUnique" ${item.flags?.unique ? 'checked' : ''}> Einzigartig
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                            <input type="checkbox" id="ieditFlagConsume" ${item.flags?.consumable ? 'checked' : ''}> Verbrauchbar
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                            <input type="checkbox" id="ieditFlagTrade" ${item.flags?.tradeable !== false ? 'checked' : ''}> Handelbar
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
                            <input type="checkbox" id="ieditFlagStack" ${item.stackable ? 'checked' : ''}> Stapelbar
                        </label>
                    </div>

                    <!-- Row 8: Tags -->
                    <div class="field">
                        <label class="field__label">Tags <span style="opacity:0.4">(kommagetrennt)</span></label>
                        <input type="text" class="field__input" id="ieditTags" value="${(item.tags || []).join(', ')}" placeholder="melee, iron, starter">
                    </div>
                </div>

                <div class="modal__footer" style="display:flex;gap:8px;justify-content:space-between">
                    <div>
                        ${!isNew ? `<button class="btn btn--danger btn--small" onclick="ItemCatalog.deleteItem('${item.id}')">Löschen</button>` : ''}
                        <button class="btn btn--outline btn--small" onclick="ItemCatalog.duplicateItem()">Duplizieren</button>
                    </div>
                    <div style="display:flex;gap:8px">
                        <button class="btn btn--outline" onclick="ItemCatalog.closeEditor()">Abbrechen</button>
                        <button class="btn btn--primary" onclick="ItemCatalog.saveItem()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            Speichern
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);

        // Auto-generate ID from name
        if (isNew) {
            document.getElementById('ieditName').addEventListener('input', () => {
                const name = document.getElementById('ieditName').value;
                document.getElementById('ieditId').value = _slugify(name);
            });
        }
    }

    function closeEditor() {
        document.getElementById('itemEditorModal')?.remove();
        _editingItem = null;
    }

    // ════════════════════════════════════════
    //  SAVE / DELETE — Items
    // ════════════════════════════════════════

    async function saveItem() {
        const id = document.getElementById('ieditId').value.trim();
        const name = document.getElementById('ieditName').value.trim();
        if (!id || !name) { alert('Name und ID sind Pflichtfelder.'); return; }

        const item = {
            id,
            name,
            type:        document.getElementById('ieditType').value,
            subType:     document.getElementById('ieditSubType').value,
            rarity:      document.getElementById('ieditRarity').value,
            slot:        document.getElementById('ieditSlot').value || '',
            description: document.getElementById('ieditDesc').value.trim(),
            flavorText:  document.getElementById('ieditFlavor').value.trim(),
            stats: {
                damage:    document.getElementById('ieditDamage').value.trim(),
                armor:     parseInt(document.getElementById('ieditArmor').value) || 0,
                speed:     parseFloat(document.getElementById('ieditSpeed').value) || 0,
                critChance: parseInt(document.getElementById('ieditCrit').value) || 5,
                critDamage: parseInt(document.getElementById('ieditCritDmg').value) || 150
            },
            value:       parseInt(document.getElementById('ieditValue').value) || 0,
            weight:      parseFloat(document.getElementById('ieditWeight').value) || 0,
            durability:  parseInt(document.getElementById('ieditDurability').value) || 100,
            stackable:   document.getElementById('ieditFlagStack').checked,
            maxStack:    parseInt(document.getElementById('ieditStack').value) || 1,
            requirements: {
                level:    parseInt(document.getElementById('ieditReqLevel').value) || 0,
                kraft:    parseInt(document.getElementById('ieditReqKraft').value) || 0,
                geschick: parseInt(document.getElementById('ieditReqGes').value) || 0,
                class:    document.getElementById('ieditReqClass').value.split(',').map(s => s.trim()).filter(Boolean)
            },
            flags: {
                questItem:  document.getElementById('ieditFlagQuest').checked,
                soulbound:  document.getElementById('ieditFlagBound').checked,
                unique:     document.getElementById('ieditFlagUnique').checked,
                consumable: document.getElementById('ieditFlagConsume').checked,
                tradeable:  document.getElementById('ieditFlagTrade').checked
            },
            tags:        document.getElementById('ieditTags').value.split(',').map(s => s.trim()).filter(Boolean),
            updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
        };

        // Add createdAt for new items
        const existingIdx = _items.findIndex(i => i.id === id);
        if (existingIdx === -1) {
            item.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        try {
            await _db.collection(COLLECTION + '/items').doc(id).set(item, { merge: true });
            console.log('[ItemCatalog] Saved:', id);

            // Update local cache
            if (existingIdx >= 0) {
                _items[existingIdx] = { ...item, createdAt: _items[existingIdx].createdAt };
            } else {
                _items.push(item);
            }

            closeEditor();
            render();
        } catch (e) {
            console.error('[ItemCatalog] Save error:', e);
            alert('Fehler beim Speichern: ' + e.message);
        }
    }

    async function deleteItem(id) {
        if (!confirm(`Item "${id}" wirklich löschen?`)) return;
        try {
            await _db.collection(COLLECTION + '/items').doc(id).delete();
            _items = _items.filter(i => i.id !== id);
            closeEditor();
            render();
        } catch (e) {
            console.error('[ItemCatalog] Delete error:', e);
            alert('Fehler: ' + e.message);
        }
    }

    function duplicateItem() {
        const nameEl = document.getElementById('ieditName');
        const idEl = document.getElementById('ieditId');
        nameEl.value = nameEl.value + ' (Kopie)';
        idEl.value = _slugify(nameEl.value);
        idEl.readOnly = false;
        idEl.style.opacity = '1';
        _editingItem = null; // Treat as new
    }

    // ════════════════════════════════════════
    //  AFFIX EDITOR
    // ════════════════════════════════════════

    function openAffixEditor(affixId) {
        const affix = affixId ? _affixes.find(a => a.id === affixId) : {
            id: '', name: '', type: 'prefix', rarity: 'uncommon',
            namePattern: '', applicableTo: ['weapon'], statMods: {}, valueMod: 1.0, tier: 1
        };
        const isNew = !affixId;

        const html = `
        <div class="modal active" id="affixEditorModal" onclick="if(event.target===this)ItemCatalog.closeAffixEditor()">
            <div class="modal__card" style="max-width:500px">
                <div class="modal__header">
                    <h2>${isNew ? 'Neuer Affix' : _esc(affix.name)}</h2>
                    <button class="modal__close" onclick="ItemCatalog.closeAffixEditor()">&times;</button>
                </div>
                <div class="modal__body" style="display:flex;flex-direction:column;gap:12px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="field"><label class="field__label">Name</label><input type="text" class="field__input" id="aeditName" value="${_esc(affix.name)}" placeholder="Flammend"></div>
                        <div class="field"><label class="field__label">ID</label><input type="text" class="field__input" id="aeditId" value="${_esc(affix.id)}" ${isNew ? '' : 'readonly style="opacity:0.5"'}></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
                        <div class="field"><label class="field__label">Typ</label><select class="field__input" id="aeditType"><option value="prefix" ${affix.type === 'prefix' ? 'selected' : ''}>Präfix</option><option value="suffix" ${affix.type === 'suffix' ? 'selected' : ''}>Suffix</option></select></div>
                        <div class="field"><label class="field__label">Rarität</label><select class="field__input" id="aeditRarity">${RARITIES.map(r => `<option value="${r.id}" ${affix.rarity === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
                        <div class="field"><label class="field__label">Tier (1-5)</label><input type="number" class="field__input" id="aeditTier" value="${affix.tier || 1}" min="1" max="5"></div>
                    </div>
                    <div class="field"><label class="field__label">Name-Pattern</label><input type="text" class="field__input" id="aeditPattern" value="${_esc(affix.namePattern || '')}" placeholder="Flammendes {item} / {item} der Stärke"></div>
                    <div class="field"><label class="field__label">Anwendbar auf <span style="opacity:0.4">(komma)</span></label><input type="text" class="field__input" id="aeditApplicable" value="${(affix.applicableTo || []).join(', ')}" placeholder="weapon, armor"></div>
                    <div class="field"><label class="field__label">Stat-Mods <span style="opacity:0.4">(JSON)</span></label><textarea class="field__input" id="aeditMods" rows="3" placeholder='{"damage":"+1d4 Feuer","critChance":3}'>${JSON.stringify(affix.statMods || {}, null, 2)}</textarea></div>
                    <div class="field"><label class="field__label">Wert-Multiplikator</label><input type="number" step="0.1" class="field__input" id="aeditValueMod" value="${affix.valueMod || 1.0}"></div>
                </div>
                <div class="modal__footer" style="display:flex;gap:8px;justify-content:flex-end">
                    <button class="btn btn--outline" onclick="ItemCatalog.closeAffixEditor()">Abbrechen</button>
                    <button class="btn btn--primary" onclick="ItemCatalog.saveAffix('${affixId || ''}')">Speichern</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        if (isNew) {
            document.getElementById('aeditName').addEventListener('input', () => {
                document.getElementById('aeditId').value = _slugify(document.getElementById('aeditName').value);
            });
        }
    }

    function closeAffixEditor() { document.getElementById('affixEditorModal')?.remove(); }

    async function saveAffix(existingId) {
        const id = document.getElementById('aeditId').value.trim();
        const name = document.getElementById('aeditName').value.trim();
        if (!id || !name) { alert('Name und ID sind Pflichtfelder.'); return; }

        let statMods = {};
        try { statMods = JSON.parse(document.getElementById('aeditMods').value || '{}'); } catch (e) { alert('Stat-Mods: Ungültiges JSON'); return; }

        const affix = {
            id, name,
            type:         document.getElementById('aeditType').value,
            rarity:       document.getElementById('aeditRarity').value,
            tier:         parseInt(document.getElementById('aeditTier').value) || 1,
            namePattern:  document.getElementById('aeditPattern').value.trim(),
            applicableTo: document.getElementById('aeditApplicable').value.split(',').map(s => s.trim()).filter(Boolean),
            statMods,
            valueMod:     parseFloat(document.getElementById('aeditValueMod').value) || 1.0,
            updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await _db.collection(COLLECTION + '/affixes').doc(id).set(affix, { merge: true });
            const idx = _affixes.findIndex(a => a.id === id);
            if (idx >= 0) _affixes[idx] = affix; else _affixes.push(affix);
            closeAffixEditor();
            renderAffixes();
        } catch (e) {
            console.error('[ItemCatalog] Save affix error:', e);
            alert('Fehler: ' + e.message);
        }
    }

    async function deleteAffix(id) {
        if (!confirm(`Affix "${id}" löschen?`)) return;
        try {
            await _db.collection(COLLECTION + '/affixes').doc(id).delete();
            _affixes = _affixes.filter(a => a.id !== id);
            renderAffixes();
        } catch (e) { alert('Fehler: ' + e.message); }
    }

    // ════════════════════════════════════════
    //  RANDOMIZER
    // ════════════════════════════════════════

    function randomizeItem(baseItemId, targetRarity) {
        const base = baseItemId ? _items.find(i => i.id === baseItemId) : _randomBase();
        if (!base) { console.warn('[ItemCatalog] No base item found'); return null; }

        // Determine rarity
        const rarity = targetRarity || _rollRarity();
        const rarityDef = RARITIES.find(r => r.id === rarity) || RARITIES[0];

        // Select affixes
        const numAffixes = rarityDef.affixSlots;
        const applicableAffixes = _affixes.filter(a => 
            a.applicableTo?.includes(base.type) && 
            RARITIES.findIndex(r => r.id === a.rarity) <= RARITIES.findIndex(r => r.id === rarity)
        );

        const chosenAffixes = [];
        const usedTypes = new Set();
        const pool = [...applicableAffixes];

        for (let i = 0; i < numAffixes && pool.length; i++) {
            // Prefer one prefix + one suffix
            const preferType = i === 0 ? 'prefix' : 'suffix';
            let candidates = pool.filter(a => a.type === preferType);
            if (!candidates.length) candidates = pool;

            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            chosenAffixes.push(pick);
            pool.splice(pool.indexOf(pick), 1);
        }

        // Build display name
        let displayName = base.name;
        const prefix = chosenAffixes.find(a => a.type === 'prefix');
        const suffix = chosenAffixes.find(a => a.type === 'suffix');

        if (prefix?.namePattern) {
            displayName = prefix.namePattern.replace('{item}', displayName);
        } else if (prefix) {
            displayName = prefix.name + ' ' + displayName;
        }
        if (suffix?.namePattern) {
            displayName = suffix.namePattern.replace('{item}', displayName);
        } else if (suffix) {
            displayName = displayName + ' ' + suffix.name;
        }

        // If no affixes but rarity > common, add a random prefix
        if (!chosenAffixes.length && rarity !== 'common' && NAME_PREFIXES[rarity]) {
            const prefixes = NAME_PREFIXES[rarity];
            displayName = prefixes[Math.floor(Math.random() * prefixes.length)] + 'es ' + displayName;
        }

        // Merge stats
        const finalStats = { ...base.stats };
        let valueMul = rarityDef.valueMul;
        for (const affix of chosenAffixes) {
            if (affix.statMods) {
                for (const [key, val] of Object.entries(affix.statMods)) {
                    if (typeof val === 'number' && typeof finalStats[key] === 'number') {
                        finalStats[key] += val;
                    } else {
                        finalStats[key] = (finalStats[key] || '') + (typeof val === 'string' && val.startsWith('+') ? ' ' + val : val);
                    }
                }
            }
            valueMul *= (affix.valueMod || 1.0);
        }

        return {
            instanceId:  'inst_' + _uid(8),
            baseItemId:  base.id,
            displayName,
            rarity,
            affixes:     chosenAffixes.map(a => a.id),
            quantity:     1,
            durability:   base.durability ? { current: base.durability, max: base.durability } : null,
            finalStats,
            finalValue:   Math.round((base.value || 0) * valueMul),
            slot:         base.slot,
            type:         base.type,
            subType:      base.subType,
            flags:        base.flags,
            source:       'generated',
            acquiredAt:   new Date().toISOString()
        };
    }

    function _rollRarity() {
        const roll = Math.random() * 100;
        if (roll < 2)  return 'legendary';
        if (roll < 10) return 'epic';
        if (roll < 25) return 'rare';
        if (roll < 50) return 'uncommon';
        return 'common';
    }

    function _randomBase() {
        if (!_items.length) return null;
        return _items[Math.floor(Math.random() * _items.length)];
    }

    // ── Randomizer UI in Admin ──
    function openRandomizer() {
        const baseOptions = _items.map(i => `<option value="${i.id}">${i.name} (${i.type})</option>`).join('');
        const rarityOptions = RARITIES.map(r => `<option value="${r.id}">${r.label}</option>`).join('');

        const html = `
        <div class="modal active" id="randomizerModal" onclick="if(event.target===this)this.remove()">
            <div class="modal__card" style="max-width:600px">
                <div class="modal__header">
                    <h2>Item Randomizer</h2>
                    <button class="modal__close" onclick="document.getElementById('randomizerModal').remove()">&times;</button>
                </div>
                <div class="modal__body" style="display:flex;flex-direction:column;gap:12px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="field">
                            <label class="field__label">Basis-Item <span style="opacity:0.4">(leer = zufällig)</span></label>
                            <select class="field__input" id="randBase"><option value="">Zufällig</option>${baseOptions}</select>
                        </div>
                        <div class="field">
                            <label class="field__label">Rarität <span style="opacity:0.4">(leer = gewürfelt)</span></label>
                            <select class="field__input" id="randRarity"><option value="">Zufällig</option>${rarityOptions}</select>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px">
                        <button class="btn btn--primary" onclick="ItemCatalog._doRandomize(1)" style="flex:1">1x Generieren</button>
                        <button class="btn btn--outline" onclick="ItemCatalog._doRandomize(5)" style="flex:1">5x Generieren</button>
                        <button class="btn btn--outline" onclick="ItemCatalog._doRandomize(10)" style="flex:1">10x Generieren</button>
                    </div>
                    <div id="randResults" style="max-height:400px;overflow-y:auto;display:flex;flex-direction:column;gap:8px"></div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    function _doRandomize(count) {
        const baseId = document.getElementById('randBase').value || null;
        const rarity = document.getElementById('randRarity').value || null;
        const results = document.getElementById('randResults');
        if (!results) return;

        const items = [];
        for (let i = 0; i < count; i++) {
            const item = randomizeItem(baseId, rarity);
            if (item) items.push(item);
        }

        results.innerHTML = items.map(item => {
            const rarityDef = RARITIES.find(r => r.id === item.rarity) || RARITIES[0];
            const statsStr = Object.entries(item.finalStats || {}).filter(([k, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' | ');
            return `<div style="padding:10px;border:1px solid ${rarityDef.color}33;border-radius:6px;border-left:3px solid ${rarityDef.color}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-weight:700;color:${rarityDef.color}">${_esc(item.displayName)}</span>
                    <span style="font-size:11px;color:var(--text-muted)">${item.finalValue} Gold</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${item.type} / ${item.subType || '—'} | ${statsStr || '—'}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;opacity:0.5">Affixe: ${item.affixes?.join(', ') || 'keine'} | ID: ${item.instanceId}</div>
            </div>`;
        }).join('');
    }

    // ════════════════════════════════════════
    //  FILTERS
    // ════════════════════════════════════════

    function setFilter(key, value) {
        _filter[key] = value;
        render();
    }

    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════

    function _blankItem() {
        return {
            id: '', name: '', type: 'weapon', subType: 'sword', rarity: 'common', slot: 'mainHand',
            description: '', flavorText: '',
            stats: { damage: '', armor: 0, speed: 0, critChance: 5, critDamage: 150 },
            value: 0, weight: 0, durability: 100, stackable: false, maxStack: 1,
            requirements: { level: 0, kraft: 0, geschick: 0, class: [] },
            effects: [],
            flags: { questItem: false, soulbound: false, unique: false, consumable: false, tradeable: true },
            tags: []
        };
    }

    function _getSlotsForType(type) {
        if (type === 'weapon') return ['mainHand', 'offHand'];
        if (type === 'armor') return ['chest'];
        if (type === 'armorPiece') return ['head', 'hands', 'feet', 'shoulders', 'offHand', 'belt'];
        return [];
    }

    function _onTypeChange() {
        const type = document.getElementById('ieditType').value;
        const subEl = document.getElementById('ieditSubType');
        const slotEl = document.getElementById('ieditSlot');

        subEl.innerHTML = (SUB_TYPES[type] || []).map(s => `<option value="${s}">${s}</option>`).join('');
        slotEl.innerHTML = '<option value="">—</option>' + _getSlotsForType(type).map(s => `<option value="${s}">${s}</option>`).join('');
    }

    function _slugify(str) {
        return (str || '').toLowerCase()
            .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    }

    function _esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function _uid(len) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let r = '';
        for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
        return r;
    }

    // ════════════════════════════════════════
    //  PUBLIC API
    // ════════════════════════════════════════

    return {
        init,
        render,
        renderAffixes,
        openEditor,
        closeEditor,
        saveItem,
        deleteItem,
        duplicateItem,
        openAffixEditor: openAffixEditor,
        editAffix: openAffixEditor,
        closeAffixEditor,
        saveAffix,
        deleteAffix,
        openRandomizer,
        randomizeItem,
        setFilter,
        _onTypeChange,
        _doRandomize,

        // Expose for other modules
        getItems: () => _items,
        getAffixes: () => _affixes,
        getItem: (id) => _items.find(i => i.id === id),
        RARITIES,
        ITEM_TYPES,
        SUB_TYPES
    };

})();

// Make globally accessible
window.ItemCatalog = ItemCatalog;

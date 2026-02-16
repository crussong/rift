/**
 * ═══════════════════════════════════════════════════════════════
 *  RIFT Entity & Interaction System
 *  
 *  Manages NPC/Enemy/Container/Merchant inventories on the whiteboard.
 *  Stores entities in Firestore: rooms/{roomCode}/entities/{tokenId}
 *  
 *  Links: token.entityId → entity document
 *  
 *  Usage:
 *    RiftEntities.init(roomCode, isGM)
 *    RiftEntities.openLoot(tokenId, tokenName)
 *    RiftEntities.openContainer(tokenId, tokenName)
 *    RiftEntities.openTrade(tokenId, tokenName)
 *    RiftEntities.openEntityEditor(tokenId, tokenData)
 * ═══════════════════════════════════════════════════════════════
 */

const RiftEntities = (() => {
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

    const TYPE_ICONS = {
        weapon:  'M14.5 2.5L6 11l2.5 2.5L3 19l5.5-5.5L11 16l8.5-8.5z',
        armor:   'M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z',
        potion:  'M9 3h6v2l-2 4v8a2 2 0 01-2 2 2 2 0 01-2-2V9L7 5V3h2z',
        quest:   'M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z',
        gem:     'M12 2L2 12l10 10 10-10L12 2z',
        misc:    'M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z',
        default: 'M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z'
    };

    // ════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════

    let _roomCode = null;
    let _isGM = false;
    let _db = null;
    let _entityCache = {};
    let _itemCatalog = null;
    let _activeModal = null;
    let _listeners = {};

    // ════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════

    function init(roomCode, isGM) {
        _roomCode = roomCode;
        _isGM = isGM;
        _db = firebase.firestore();
        console.log('[Entities] Init:', roomCode, isGM ? '(GM)' : '(Player)');
    }

    // ════════════════════════════════════════
    //  ENTITY CRUD (Firestore)
    // ════════════════════════════════════════

    function _entityRef(tokenId) {
        return _db.collection('rooms').doc(_roomCode).collection('entities').doc(tokenId);
    }

    async function getEntity(tokenId) {
        if (_entityCache[tokenId]) return _entityCache[tokenId];
        try {
            const snap = await _entityRef(tokenId).get();
            if (snap.exists) {
                _entityCache[tokenId] = { id: snap.id, ...snap.data() };
                return _entityCache[tokenId];
            }
        } catch (e) { console.warn('[Entities] Get error:', e); }
        return null;
    }

    async function saveEntity(tokenId, data) {
        try {
            await _entityRef(tokenId).set(data, { merge: true });
            _entityCache[tokenId] = { id: tokenId, ...(_entityCache[tokenId] || {}), ...data };
        } catch (e) {
            console.error('[Entities] Save error:', e);
            throw e;
        }
    }

    async function ensureEntity(tokenId, tokenData) {
        let entity = await getEntity(tokenId);
        if (!entity) {
            const type = _mapTokenType(tokenData?.type);
            entity = {
                id: tokenId,
                type,
                name: tokenData?.name || 'Unbekannt',
                inventory: [],
                gold: 0,
                merchant: type === 'merchant' ? { buyMultiplier: 0.5, sellMultiplier: 1.2 } : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await saveEntity(tokenId, entity);
        }
        return entity;
    }

    function _mapTokenType(tokenType) {
        if (tokenType === 'monster') return 'enemy';
        if (tokenType === 'npc') return 'npc';
        if (tokenType === 'container') return 'container';
        if (tokenType === 'merchant') return 'merchant';
        return 'npc';
    }

    // Listen to entity changes in real-time
    function watchEntity(tokenId, callback) {
        if (_listeners[tokenId]) _listeners[tokenId]();
        _listeners[tokenId] = _entityRef(tokenId).onSnapshot(snap => {
            if (snap.exists) {
                _entityCache[tokenId] = { id: snap.id, ...snap.data() };
                callback(_entityCache[tokenId]);
            }
        });
    }

    function unwatchEntity(tokenId) {
        if (_listeners[tokenId]) { _listeners[tokenId](); delete _listeners[tokenId]; }
    }

    // ════════════════════════════════════════
    //  ITEM CATALOG (lazy load)
    // ════════════════════════════════════════

    async function _getItemCatalog() {
        if (_itemCatalog) return _itemCatalog;
        try {
            const snap = await _db.collection('itemCatalog/worldsapart/items').get();
            _itemCatalog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            _itemCatalog.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (e) { _itemCatalog = []; }
        return _itemCatalog;
    }

    // ════════════════════════════════════════
    //  GM: ENTITY INVENTORY EDITOR
    // ════════════════════════════════════════

    async function openEntityEditor(tokenId, tokenData) {
        if (!_isGM) return;
        const entity = await ensureEntity(tokenId, tokenData);
        const catalog = await _getItemCatalog();

        _closeActiveModal();

        const inv = entity.inventory || [];
        const entityTypes = [
            { id: 'enemy', label: 'Gegner', color: '#ef4444' },
            { id: 'npc', label: 'NPC', color: '#3b82f6' },
            { id: 'container', label: 'Truhe/Schrank', color: '#fbbf24' },
            { id: 'merchant', label: 'Händler', color: '#22c55e' }
        ];

        const html = `
        <div class="rift-modal-backdrop" id="entityEditorModal" onclick="if(event.target===this)RiftEntities.closeModal()">
            <div class="rift-modal" style="max-width:700px">
                <div class="rift-modal__header">
                    <div>
                        <div class="rift-modal__title">Entity: ${_esc(entity.name)}</div>
                        <div class="rift-modal__sub">Inventar & Einstellungen verwalten</div>
                    </div>
                    <button class="rift-modal__close" onclick="RiftEntities.closeModal()">&times;</button>
                </div>
                <div class="rift-modal__body">
                    <!-- Type selector -->
                    <div style="display:flex;gap:6px;margin-bottom:12px">
                        ${entityTypes.map(t => `<button class="rift-chip${entity.type === t.id ? ' active' : ''}" data-etype="${t.id}" onclick="RiftEntities._setEntityType('${tokenId}','${t.id}',this)" style="${entity.type === t.id ? 'border-color:' + t.color + ';color:' + t.color : ''}">${t.label}</button>`).join('')}
                    </div>

                    <!-- Gold -->
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                        <span style="font-size:12px;color:#fbbf24;font-weight:600">Gold:</span>
                        <input type="number" id="entityGold" value="${entity.gold || 0}" min="0" style="width:80px" class="rift-input" onchange="RiftEntities._updateGold('${tokenId}',this.value)">
                        ${entity.type === 'merchant' ? `<span style="font-size:11px;color:#888;margin-left:auto">Kauf: ${((entity.merchant?.buyMultiplier || 0.5) * 100).toFixed(0)}% | Verkauf: ${((entity.merchant?.sellMultiplier || 1.2) * 100).toFixed(0)}%</span>` : ''}
                    </div>

                    <!-- Current Inventory -->
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Inventar (${inv.length} Items)</div>
                    <div id="entityInvList" style="max-height:200px;overflow-y:auto;margin-bottom:12px;border:1px solid rgba(255,255,255,0.06);border-radius:6px">
                        ${inv.length ? inv.map((item, i) => _renderEntityItemRow(item, i, tokenId)).join('') : '<div style="padding:20px;text-align:center;color:#666;font-size:12px">Leer</div>'}
                    </div>

                    <!-- Add from catalog -->
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Aus Katalog hinzufügen</div>
                    <div style="display:flex;gap:6px;margin-bottom:8px">
                        <input type="text" class="rift-input" id="entityCatalogSearch" placeholder="Item suchen..." style="flex:1" oninput="RiftEntities._filterCatalog(this.value)">
                        <input type="number" class="rift-input" id="entityAddQty" value="1" min="1" max="99" style="width:50px;text-align:center">
                    </div>
                    <div id="entityCatalogList" style="max-height:180px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:6px">
                        ${catalog.slice(0, 30).map(item => _renderCatalogRow(item, tokenId)).join('') || '<div style="padding:20px;text-align:center;color:#666;font-size:12px">Keine Items im Katalog</div>'}
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        _activeModal = 'entityEditorModal';
    }

    function _renderEntityItemRow(item, index, tokenId) {
        const r = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px">
            <div style="width:6px;height:6px;border-radius:50%;background:${r.color};flex-shrink:0"></div>
            <span style="color:${r.color};font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(item.displayName || item.name)}</span>
            <span style="color:#888;font-size:11px">&times;${item.quantity || 1}</span>
            <span style="color:#fbbf24;font-size:10px">${item.finalValue ?? item.value ?? 0}g</span>
            <button onclick="RiftEntities._removeEntityItem('${tokenId}',${index})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;padding:2px 4px" title="Entfernen">&times;</button>
        </div>`;
    }

    function _renderCatalogRow(item, tokenId) {
        const r = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
        return `<div class="rift-catalog-row" data-name="${_esc((item.name || '').toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:5px 10px;cursor:pointer;transition:background 0.1s;font-size:12px" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''" onclick="RiftEntities._addCatalogItem('${tokenId}','${item.id}')">
            <div style="width:6px;height:6px;border-radius:50%;background:${r.color};flex-shrink:0"></div>
            <span style="color:${r.color};font-weight:600;flex:1">${_esc(item.name)}</span>
            <span style="color:#888;font-size:10px">${item.type}</span>
            <span style="color:#fbbf24;font-size:10px">${item.value || 0}g</span>
        </div>`;
    }

    async function _addCatalogItem(tokenId, itemId) {
        const catalog = await _getItemCatalog();
        const template = catalog.find(i => i.id === itemId);
        if (!template) return;

        const qty = parseInt(document.getElementById('entityAddQty')?.value) || 1;
        const entity = await getEntity(tokenId);
        if (!entity) return;

        const inv = entity.inventory || [];

        // Stack check
        const existing = inv.find(i => i.baseItemId === itemId && (i.stackable || i.flags?.consumable));
        if (existing) {
            existing.quantity = (existing.quantity || 1) + qty;
        } else {
            inv.push({
                instanceId: 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                baseItemId: template.id,
                displayName: template.name,
                name: template.name,
                type: template.type,
                subType: template.subType || '',
                rarity: template.rarity || 'common',
                quantity: qty,
                weight: template.weight || 0,
                value: template.value || 0,
                finalValue: template.value || 0,
                stats: template.stats || {},
                finalStats: template.stats || {},
                flags: template.flags || {},
                stackable: template.stackable || false,
                description: template.description || '',
                flavorText: template.flavorText || '',
                slot: template.slot || '',
                source: 'entity'
            });
        }

        await saveEntity(tokenId, { inventory: inv });
        _refreshEntityInvList(tokenId);
        _toast(`${qty}x ${template.name} hinzugefügt`);
    }

    async function _removeEntityItem(tokenId, index) {
        const entity = await getEntity(tokenId);
        if (!entity?.inventory) return;
        entity.inventory.splice(index, 1);
        await saveEntity(tokenId, { inventory: entity.inventory });
        _refreshEntityInvList(tokenId);
    }

    async function _refreshEntityInvList(tokenId) {
        const entity = await getEntity(tokenId);
        const list = document.getElementById('entityInvList');
        if (!list || !entity) return;
        const inv = entity.inventory || [];
        list.innerHTML = inv.length
            ? inv.map((item, i) => _renderEntityItemRow(item, i, tokenId)).join('')
            : '<div style="padding:20px;text-align:center;color:#666;font-size:12px">Leer</div>';
    }

    async function _setEntityType(tokenId, type, btn) {
        await saveEntity(tokenId, { type });
        // Update UI
        btn.closest('div').querySelectorAll('.rift-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
    }

    async function _updateGold(tokenId, val) {
        await saveEntity(tokenId, { gold: parseInt(val) || 0 });
    }

    function _filterCatalog(query) {
        const q = query.toLowerCase();
        document.querySelectorAll('#entityCatalogList .rift-catalog-row').forEach(row => {
            row.style.display = row.dataset.name.includes(q) ? '' : 'none';
        });
    }

    // ════════════════════════════════════════
    //  PLAYER: LOOT MODAL
    // ════════════════════════════════════════

    async function openLoot(tokenId, tokenName) {
        const entity = await getEntity(tokenId);
        if (!entity) { _toast('Nichts zu plündern'); return; }

        _closeActiveModal();

        const inv = entity.inventory || [];
        const gold = entity.gold || 0;

        const html = `
        <div class="rift-modal-backdrop" id="lootModal" onclick="if(event.target===this)RiftEntities.closeModal()">
            <div class="rift-modal" style="max-width:480px">
                <div class="rift-modal__header" style="border-bottom-color:rgba(251,191,36,0.2)">
                    <div>
                        <div class="rift-modal__title" style="color:#fbbf24">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;vertical-align:middle;margin-right:6px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/><circle cx="12" cy="14" r="2"/></svg>
                            ${_esc(tokenName || 'Beute')}
                        </div>
                        <div class="rift-modal__sub">${inv.length} Gegenstände${gold ? ' | ' + gold + ' Gold' : ''}</div>
                    </div>
                    <button class="rift-modal__close" onclick="RiftEntities.closeModal()">&times;</button>
                </div>
                <div class="rift-modal__body" style="padding:0">
                    ${gold > 0 ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(251,191,36,0.04)">
                        <span style="color:#fbbf24;font-weight:700;font-size:14px">${gold} Gold</span>
                        <button class="rift-btn rift-btn--gold rift-btn--sm" onclick="RiftEntities._lootGold('${tokenId}')">Aufheben</button>
                    </div>` : ''}
                    <div id="lootItemsList" style="max-height:360px;overflow-y:auto">
                        ${inv.length ? inv.map((item, i) => _renderLootItemRow(item, i, tokenId)).join('') : '<div style="padding:40px;text-align:center;color:#666">Leer</div>'}
                    </div>
                </div>
                <div class="rift-modal__footer">
                    <button class="rift-btn rift-btn--gold" onclick="RiftEntities._lootAll('${tokenId}')">Alles aufheben</button>
                    <button class="rift-btn rift-btn--ghost" onclick="RiftEntities.closeModal()">Schließen</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        _activeModal = 'lootModal';

        // Watch for real-time changes
        watchEntity(tokenId, (updated) => {
            const list = document.getElementById('lootItemsList');
            if (!list) return;
            const newInv = updated.inventory || [];
            list.innerHTML = newInv.length
                ? newInv.map((item, i) => _renderLootItemRow(item, i, tokenId)).join('')
                : '<div style="padding:40px;text-align:center;color:#666">Leer</div>';
        });
    }

    function _renderLootItemRow(item, index, tokenId) {
        const r = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
        const icon = TYPE_ICONS[item.subType] || TYPE_ICONS[item.type] || TYPE_ICONS.default;
        const stats = [];
        const s = item.finalStats || item.stats || {};
        if (s.damage) stats.push(s.damage);
        if (s.armor) stats.push(s.armor + ' DEF');

        return `<div class="rift-loot-row" style="--rc:${r.color}">
            <div class="rift-loot-row__icon" style="color:${r.color}">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="${icon}"/></svg>
            </div>
            <div class="rift-loot-row__info">
                <div class="rift-loot-row__name" style="color:${r.color}">${_esc(item.displayName || item.name)}${item.quantity > 1 ? ` <span style="color:#888">&times;${item.quantity}</span>` : ''}</div>
                <div class="rift-loot-row__stats">${stats.join(' | ') || item.type || ''} ${item.finalValue || item.value ? '&middot; ' + (item.finalValue || item.value) + 'g' : ''}</div>
            </div>
            <button class="rift-btn rift-btn--sm" onclick="RiftEntities._lootItem('${tokenId}',${index})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M12 5v14M5 12h14"/></svg>
            </button>
        </div>`;
    }

    // ════════════════════════════════════════
    //  LOOT ACTIONS
    // ════════════════════════════════════════

    async function _lootItem(tokenId, index) {
        const entity = await getEntity(tokenId);
        if (!entity?.inventory?.[index]) return;

        const item = entity.inventory[index];

        // Add to player inventory via RiftLink
        if (!_addToPlayerInventory(item)) return;

        // Remove from entity
        entity.inventory.splice(index, 1);
        await saveEntity(tokenId, { inventory: entity.inventory });
        _toast(`${item.displayName || item.name} aufgehoben`);
    }

    async function _lootGold(tokenId) {
        const entity = await getEntity(tokenId);
        if (!entity || !entity.gold) return;

        const gold = entity.gold;
        _addGoldToPlayer(gold);
        await saveEntity(tokenId, { gold: 0 });
        _toast(`${gold} Gold aufgehoben`);

        // Update UI
        const goldRow = document.querySelector('#lootModal [onclick*="lootGold"]')?.closest('div');
        if (goldRow) goldRow.remove();
    }

    async function _lootAll(tokenId) {
        const entity = await getEntity(tokenId);
        if (!entity) return;

        const inv = entity.inventory || [];
        let count = 0;
        for (const item of inv) {
            if (_addToPlayerInventory(item)) count++;
        }

        if (entity.gold) {
            _addGoldToPlayer(entity.gold);
        }

        await saveEntity(tokenId, { inventory: [], gold: 0 });
        _toast(`${count} Items${entity.gold ? ' + ' + entity.gold + ' Gold' : ''} aufgehoben`);
        closeModal();
    }

    // ════════════════════════════════════════
    //  PLAYER: TRADE MODAL (NPC Merchant)
    // ════════════════════════════════════════

    async function openTrade(tokenId, tokenName) {
        const entity = await ensureEntity(tokenId, { type: 'merchant', name: tokenName });
        const merchantInv = entity.inventory || [];
        const buyMul = entity.merchant?.buyMultiplier || 0.5;
        const sellMul = entity.merchant?.sellMultiplier || 1.2;

        _closeActiveModal();

        const html = `
        <div class="rift-modal-backdrop" id="tradeModal" onclick="if(event.target===this)RiftEntities.closeModal()">
            <div class="rift-modal" style="max-width:720px">
                <div class="rift-modal__header" style="border-bottom-color:rgba(34,197,94,0.2)">
                    <div>
                        <div class="rift-modal__title" style="color:#22c55e">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;vertical-align:middle;margin-right:6px"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/></svg>
                            Handel: ${_esc(tokenName || 'Händler')}
                        </div>
                        <div class="rift-modal__sub">Kaufen: ${(sellMul * 100).toFixed(0)}% | Verkaufen: ${(buyMul * 100).toFixed(0)}%</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                        <span style="color:#fbbf24;font-weight:700;font-size:14px" id="tradePlayerGold">0</span>
                        <span style="color:#888;font-size:11px">Gold</span>
                    </div>
                    <button class="rift-modal__close" onclick="RiftEntities.closeModal()">&times;</button>
                </div>
                <div class="rift-modal__body" style="padding:0">
                    <div style="display:grid;grid-template-columns:1fr 1fr;min-height:300px">
                        <!-- Merchant side -->
                        <div style="border-right:1px solid rgba(255,255,255,0.06)">
                            <div style="padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#22c55e;border-bottom:1px solid rgba(255,255,255,0.06)">Angebot des Händlers</div>
                            <div id="tradeMerchantList" style="max-height:340px;overflow-y:auto">
                                ${merchantInv.map((item, i) => _renderTradeRow(item, i, tokenId, 'buy', sellMul)).join('') || '<div style="padding:30px;text-align:center;color:#666;font-size:12px">Kein Angebot</div>'}
                            </div>
                        </div>
                        <!-- Player side -->
                        <div>
                            <div style="padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a78bfa;border-bottom:1px solid rgba(255,255,255,0.06)">Dein Inventar</div>
                            <div id="tradePlayerList" style="max-height:340px;overflow-y:auto">
                                <div style="padding:30px;text-align:center;color:#666;font-size:12px">Lade...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        _activeModal = 'tradeModal';

        // Load player inventory
        _refreshTradePlayerSide(tokenId, buyMul);

        // Watch merchant inventory
        watchEntity(tokenId, (updated) => {
            const list = document.getElementById('tradeMerchantList');
            if (!list) return;
            const newInv = updated.inventory || [];
            list.innerHTML = newInv.length
                ? newInv.map((item, i) => _renderTradeRow(item, i, tokenId, 'buy', sellMul)).join('')
                : '<div style="padding:30px;text-align:center;color:#666;font-size:12px">Kein Angebot</div>';
        });
    }

    function _renderTradeRow(item, index, tokenId, mode, multiplier) {
        const r = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
        const price = Math.round((item.finalValue || item.value || 0) * multiplier);
        const action = mode === 'buy'
            ? `RiftEntities._tradeBuy('${tokenId}',${index})`
            : `RiftEntities._tradeSell('${tokenId}','${item.instanceId}')`;
        const btnLabel = mode === 'buy' ? `${price}g` : `${price}g`;
        const btnColor = mode === 'buy' ? '#ef4444' : '#22c55e';

        return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:11px">
            <div style="width:5px;height:5px;border-radius:50%;background:${r.color};flex-shrink:0"></div>
            <span style="color:${r.color};font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(item.displayName || item.name)}${item.quantity > 1 ? ' x' + item.quantity : ''}</span>
            <button onclick="${action}" style="background:${btnColor}22;border:1px solid ${btnColor}44;color:${btnColor};padding:2px 8px;border-radius:4px;font-size:10px;cursor:pointer;font-weight:600">${mode === 'buy' ? 'Kaufen' : 'Verkaufen'} ${btnLabel}</button>
        </div>`;
    }

    function _refreshTradePlayerSide(tokenId, buyMul) {
        const list = document.getElementById('tradePlayerList');
        const goldEl = document.getElementById('tradePlayerGold');
        if (!list) return;

        const charData = _getPlayerCharData();
        if (!charData) { list.innerHTML = '<div style="padding:20px;text-align:center;color:#666;font-size:12px">Kein Charakter geladen</div>'; return; }

        const inv = charData.inventory?.items || [];
        const gold = charData.currency?.gold || 0;
        if (goldEl) goldEl.textContent = gold;

        list.innerHTML = inv.filter(i => i.flags?.tradeable !== false && !i.flags?.questItem && !i.flags?.soulbound).map((item, i) =>
            _renderTradeRow(item, i, tokenId, 'sell', buyMul)
        ).join('') || '<div style="padding:20px;text-align:center;color:#666;font-size:12px">Nichts zum Verkaufen</div>';
    }

    // ════════════════════════════════════════
    //  TRADE ACTIONS
    // ════════════════════════════════════════

    async function _tradeBuy(tokenId, index) {
        const entity = await getEntity(tokenId);
        if (!entity?.inventory?.[index]) return;

        const item = entity.inventory[index];
        const sellMul = entity.merchant?.sellMultiplier || 1.2;
        const price = Math.round((item.finalValue || item.value || 0) * sellMul);

        const charData = _getPlayerCharData();
        if (!charData) return;
        const gold = charData.currency?.gold || 0;

        if (gold < price) { _toast('Nicht genug Gold!'); return; }

        // Clone 1 item
        const bought = { ...item, quantity: 1, instanceId: 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), source: 'trade' };

        // Reduce merchant stock
        if (item.quantity > 1) {
            item.quantity--;
        } else {
            entity.inventory.splice(index, 1);
        }
        entity.gold = (entity.gold || 0) + price;
        await saveEntity(tokenId, { inventory: entity.inventory, gold: entity.gold });

        // Add to player, deduct gold
        _addToPlayerInventory(bought);
        _addGoldToPlayer(-price);
        _toast(`${item.displayName || item.name} gekauft für ${price}g`);
        _refreshTradePlayerSide(tokenId, entity.merchant?.buyMultiplier || 0.5);
    }

    async function _tradeSell(tokenId, instanceId) {
        const entity = await getEntity(tokenId);
        if (!entity) return;
        const buyMul = entity.merchant?.buyMultiplier || 0.5;

        const charData = _getPlayerCharData();
        if (!charData?.inventory?.items) return;

        const itemIdx = charData.inventory.items.findIndex(i => i.instanceId === instanceId);
        if (itemIdx === -1) return;

        const item = charData.inventory.items[itemIdx];
        const price = Math.round((item.finalValue || item.value || 0) * buyMul);

        // Clone for merchant
        const sold = { ...item, quantity: 1, instanceId: 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };

        // Remove from player
        if (item.quantity > 1) {
            item.quantity--;
        } else {
            charData.inventory.items.splice(itemIdx, 1);
        }
        _addGoldToPlayer(price);
        _savePlayerCharData(charData);

        // Add to merchant
        const inv = entity.inventory || [];
        const existing = inv.find(i => i.baseItemId === sold.baseItemId);
        if (existing) { existing.quantity = (existing.quantity || 1) + 1; }
        else { inv.push(sold); }
        entity.gold = Math.max(0, (entity.gold || 0) - price);
        await saveEntity(tokenId, { inventory: inv, gold: entity.gold });

        _toast(`${item.displayName || item.name} verkauft für ${price}g`);
        _refreshTradePlayerSide(tokenId, buyMul);
    }

    // ════════════════════════════════════════
    //  PLAYER INVENTORY BRIDGE
    // ════════════════════════════════════════

    function _getPlayerCharData() {
        // Try RiftLink state
        if (window.RIFT?.state) {
            const chars = RIFT.state.get('characters') || {};
            const assignedId = RIFT.state.get('assignedCharacterId');
            if (assignedId && chars[assignedId]) return chars[assignedId];
            const first = Object.values(chars)[0];
            if (first) return first;
        }
        return null;
    }

    function _getPlayerCharId() {
        if (window.RIFT?.state) {
            return RIFT.state.get('assignedCharacterId') || Object.keys(RIFT.state.get('characters') || {})[0];
        }
        return null;
    }

    function _addToPlayerInventory(item) {
        const charData = _getPlayerCharData();
        if (!charData) { _toast('Kein Charakter geladen!'); return false; }
        if (!charData.inventory) charData.inventory = { cols: 16, rows: 11, items: [] };
        if (!charData.inventory.items) charData.inventory.items = [];

        // Stack
        if (item.stackable || item.flags?.consumable) {
            const existing = charData.inventory.items.find(i => i.baseItemId === item.baseItemId);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
                _savePlayerCharData(charData);
                return true;
            }
        }

        const instance = { ...item };
        if (!instance.instanceId) instance.instanceId = 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        charData.inventory.items.push(instance);
        _savePlayerCharData(charData);
        return true;
    }

    function _addGoldToPlayer(amount) {
        const charData = _getPlayerCharData();
        if (!charData) return;
        if (!charData.currency) charData.currency = { gold: 0, silver: 0, copper: 0 };
        charData.currency.gold = Math.max(0, (charData.currency.gold || 0) + amount);
        _savePlayerCharData(charData);
    }

    function _savePlayerCharData(charData) {
        const charId = _getPlayerCharId();
        if (!charId) return;
        if (window.RIFT?.link?.writeAll) {
            RIFT.link.writeAll(charId, charData);
        } else if (window.RIFT?.state) {
            RIFT.state.set(`characters.${charId}`, charData);
        }
    }

    // ════════════════════════════════════════
    //  MODAL MANAGEMENT
    // ════════════════════════════════════════

    function closeModal() {
        _closeActiveModal();
    }

    function _closeActiveModal() {
        if (_activeModal) {
            document.getElementById(_activeModal)?.remove();
            // Stop watchers
            Object.keys(_listeners).forEach(unwatchEntity);
            _activeModal = null;
        }
    }

    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════

    function _esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function _toast(msg) {
        if (window.WB?.toast) WB.toast(msg);
        else if (window.RIFTToast?.show) RIFTToast.show(msg, 'info');
        else console.log('[Entities]', msg);
    }

    // ════════════════════════════════════════
    //  PUBLIC API
    // ════════════════════════════════════════

    return {
        init,
        getEntity,
        saveEntity,
        ensureEntity,
        openEntityEditor,
        openLoot,
        openContainer: openLoot, // Same UI for containers
        openTrade,
        closeModal,
        watchEntity,
        unwatchEntity,

        // Internal (exposed for inline onclick)
        _addCatalogItem,
        _removeEntityItem,
        _setEntityType,
        _updateGold,
        _filterCatalog,
        _lootItem,
        _lootGold,
        _lootAll,
        _tradeBuy,
        _tradeSell
    };
})();

window.RiftEntities = RiftEntities;

/**
 * ═══════════════════════════════════════════════════════════════
 *  RIFT GM Characters Panel
 *  Real-time character management via RiftLink.
 *
 *  Loads after: rift-state.js, riftlink.js
 *  Used in:     pages/gm.html (Characters tab)
 *
 *  Init:  RIFT.gmChars.init(roomCode)
 *  API:   RIFT.gmChars.modifyStat(charId, path, delta)
 *         RIFT.gmChars.modifyAll(path, delta)
 *         RIFT.gmChars.setStat(charId, path, value)
 * ═══════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    const LOG = '[GMChars]';

    // ════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════

    let _roomCode = null;
    let _chars = {};            // charId → character data
    let _expanded = new Set();  // expanded card IDs
    let _members = [];          // room members (for owner display)
    let _onlineIds = new Set(); // online user IDs
    let _focusRuleset = null;   // filter by ruleset (null = show all)


    // ════════════════════════════════════════
    //  INIT
    // ════════════════════════════════════════

    function init(roomCode, members, onlineChecker) {
        _roomCode = roomCode;
        _members = members || [];
        if (typeof onlineChecker === 'function') {
            _isOnlineFn = onlineChecker;
        }

        // Connect RiftLink in GM mode
        if (window.RIFT && RIFT.link) {
            RIFT.link.watchRoom(roomCode);
        }

        // Listen for character updates from RiftLink
        RIFT.state.on('riftlink:characters', (allChars) => {
            const ids = Object.keys(allChars || {});
            console.log(LOG, 'All chars received:', ids.length, ids.join(', '));
            _chars = allChars || {};
            render();
        });

        RIFT.state.on('riftlink:char:updated', (evt) => {
            if (evt.charId && _chars[evt.charId]) {
                const updated = RIFT.state.get(`characters.${evt.charId}`);
                if (updated) {
                    const invCount = (updated.inventory?.items || []).length;
                    const qbCount = (updated.quickbar || []).filter(Boolean).length;
                    console.log(LOG, '← Remote update:', evt.charId,
                        '| fields:', (evt.fields || []).join(', '),
                        '| inv:', invCount, '| qb:', qbCount);
                    _chars[evt.charId] = updated;
                }
                _updateCard(evt.charId);
            }
        });

        RIFT.state.on('riftlink:char:removed', (evt) => {
            delete _chars[evt.charId];
            render();
        });

        console.log(LOG, 'Initialized for room', roomCode);
    }

    // Allow member/online updates from BC
    function updateMembers(members) { _members = members || []; }
    function updateOnline(onlineIds) { _onlineIds = new Set(onlineIds || []); render(); }

    let _isOnlineFn = (uid) => _onlineIds.has(uid);


    // ════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════

    function render() {
        const grid = document.getElementById('characterGrid');
        const actions = document.getElementById('characterGlobalActions');
        if (!grid) return;

        const allChars = Object.values(_chars).filter(c => c && !c.id?.startsWith('_'));
        const chars = _focusRuleset 
            ? allChars.filter(c => (c.ruleset || 'worldsapart') === _focusRuleset)
            : allChars;

        // Global actions bar
        if (actions) {
            actions.innerHTML = chars.length > 0 ? _renderGlobalActions(chars) : '';
        }

        if (!chars.length) {
            grid.innerHTML = _emptyState();
            return;
        }

        grid.innerHTML = chars.map(c => _renderCard(c)).join('');
        _bindCardEvents(grid);
    }

    function _updateCard(charId) {
        const card = document.querySelector(`.gmc-card[data-id="${charId}"]`);
        if (!card) return render(); // fallback: full re-render

        const c = _chars[charId];
        if (!c) return;

        // Update live values without full re-render
        _updateStatValue(card, 'hp', c);
        _updateStatValue(card, 'resource', c);
        _updateStatValue(card, 'level', c);
        _updateAttributeValues(card, c);

        // If expanded, also refresh inventory section
        _refreshInvSection(charId);

        console.log(LOG, 'Card updated:', charId, '| inv:', (c.inventory?.items || []).length, 'items');
    }

    function _updateStatValue(card, type, c) {
        const el = card.querySelector(`[data-stat="${type}"] .gmc-stat__val`);
        if (!el) return;

        if (type === 'hp') {
            const hp = c.hp || {};
            el.textContent = `${hp.current || 0}/${hp.max || 100}`;
            el.className = 'gmc-stat__val ' + _hpColor(hp.current, hp.max);
        } else if (type === 'resource') {
            const res = c.resource || {};
            el.textContent = `${res.current || 0}/${res.max || 100}`;
        } else if (type === 'level') {
            el.textContent = c.level || 1;
        }

        // Update HP bar
        if (type === 'hp') {
            const bar = card.querySelector('.gmc-hp-fill');
            if (bar) {
                const pct = Math.min(100, ((c.hp?.current || 0) / (c.hp?.max || 100)) * 100);
                bar.style.width = pct + '%';
                bar.className = 'gmc-hp-fill ' + _hpColor(c.hp?.current, c.hp?.max);
            }
        }
    }

    function _updateAttributeValues(card, c) {
        const attrs = c.attributes || {};
        for (const key of ['kraft', 'geschick', 'belastbarkeit', 'intellekt', 'autoritaet']) {
            const el = card.querySelector(`[data-attr="${key}"]`);
            if (el) el.textContent = attrs[key] || 0;
        }
    }


    // ════════════════════════════════════════
    //  CARD RENDERING
    // ════════════════════════════════════════

    function _renderCard(c) {
        const name = _esc(c.profile?.name || c.name || c.characterName || 'Unbenannt');
        const cls = c.class || {};
        const clsName = cls.name || c.class?.name || '';
        const hp = c.hp || { current: 100, max: 100 };
        const res = c.resource || { name: '', current: 100, max: 100 };
        const level = c.level || 1;
        const attrs = c.attributes || {};
        const defense = c.defense || {};
        const offense = c.offense || {};
        const weakness = c.weakness || {};
        const expanded = _expanded.has(c.id);

        const ownerId = c.ownerId || c.owner || c.userId;
        const owner = _members.find(m => m.id === ownerId);
        const ownerName = _esc(owner?.displayName || owner?.name || 'Unbekannt');
        const online = _isOnlineFn(ownerId);

        const hpPct = Math.min(100, (hp.current / (hp.max || 1)) * 100);
        const resPct = Math.min(100, (res.current / (res.max || 1)) * 100);

        // Resource color from class definition
        const resColor = _classColor(cls.id) || '#a78bfa';

        const portrait = c.portrait || c.profile?.portrait || null;
        const portraitHtml = portrait
            ? `<img src="${portrait.startsWith('data:') || portrait.startsWith('http') ? portrait : '/assets/img/portraits/' + portrait + '.png'}" class="gmc-avatar__img" onerror="this.style.display='none'">`
            : `<span class="gmc-avatar__letter">${(name[0] || '?').toUpperCase()}</span>`;

        return `
        <div class="gmc-card${expanded ? ' gmc-card--expanded' : ''}" data-id="${c.id}">
            <!-- Header -->
            <div class="gmc-header">
                <div class="gmc-avatar">${portraitHtml}</div>
                <div class="gmc-info">
                    <div class="gmc-owner">
                        <span class="gmc-dot${online ? ' gmc-dot--on' : ''}"></span>
                        ${ownerName}
                    </div>
                    <div class="gmc-name">${name}</div>
                    <div class="gmc-class">${clsName || '—'} ${clsName ? '·' : ''} Lv. ${level}</div>
                </div>
                <button class="gmc-expand" data-action="toggle" title="Details">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="${expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/>
                    </svg>
                </button>
            </div>

            <!-- HP Bar -->
            <div class="gmc-hp-bar">
                <div class="gmc-hp-fill ${_hpColor(hp.current, hp.max)}" style="width:${hpPct}%"></div>
            </div>

            <!-- Stats Row -->
            <div class="gmc-stats">
                <div class="gmc-stat" data-stat="hp">
                    <div class="gmc-stat__val ${_hpColor(hp.current, hp.max)}">${hp.current}/${hp.max}</div>
                    <div class="gmc-stat__label">LP</div>
                    <div class="gmc-stat__btns">
                        <button class="gmc-btn gmc-btn--red" data-action="mod" data-path="hp.current" data-delta="-1">−</button>
                        <button class="gmc-btn gmc-btn--green" data-action="mod" data-path="hp.current" data-delta="1">+</button>
                    </div>
                </div>
                <div class="gmc-stat" data-stat="resource">
                    <div class="gmc-stat__val" style="color:${resColor}">${res.current}/${res.max}</div>
                    <div class="gmc-stat__label">${res.name || 'Ressource'}</div>
                    <div class="gmc-stat__btns">
                        <button class="gmc-btn gmc-btn--red" data-action="mod" data-path="resource.current" data-delta="-1">−</button>
                        <button class="gmc-btn gmc-btn--green" data-action="mod" data-path="resource.current" data-delta="1">+</button>
                    </div>
                </div>
                <div class="gmc-stat" data-stat="level">
                    <div class="gmc-stat__val gmc-stat__val--gold">${level}</div>
                    <div class="gmc-stat__label">Level</div>
                    <div class="gmc-stat__btns">
                        <button class="gmc-btn" data-action="mod" data-path="level" data-delta="-1">−</button>
                        <button class="gmc-btn" data-action="mod" data-path="level" data-delta="1">+</button>
                    </div>
                </div>
            </div>

            <!-- Expanded Detail Panel -->
            ${expanded ? _renderExpanded(c) : ''}

            <!-- Footer -->
            <div class="gmc-footer">
                <button class="gmc-btn gmc-btn--wide" data-action="sheet" title="Charakterbogen öffnen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Bogen
                </button>
                <button class="gmc-btn gmc-btn--wide gmc-btn--red-ghost" data-action="remove" title="Aus Raum entfernen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Entfernen
                </button>
            </div>
        </div>`;
    }

    function _renderExpanded(c) {
        const attrs = c.attributes || {};
        const def = c.defense || {};
        const off = c.offense || {};
        const res = def.resistances || {};
        const weakness = c.weakness || {};
        const xp = c.xp || { current: 0, max: 1000 };
        const secondChance = c.secondChance?.used || [false, false, false];

        const attrDefs = [
            { key: 'kraft', abbr: 'KRF' },
            { key: 'geschick', abbr: 'GES' },
            { key: 'belastbarkeit', abbr: 'BEL' },
            { key: 'intellekt', abbr: 'INT' },
            { key: 'autoritaet', abbr: 'AUT' }
        ];

        return `
        <div class="gmc-detail">
            <!-- Attributes -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">Attribute</div>
                <div class="gmc-attrs">
                    ${attrDefs.map(a => `
                        <div class="gmc-attr">
                            <div class="gmc-attr__val" data-attr="${a.key}">${attrs[a.key] || 0}</div>
                            <div class="gmc-attr__abbr">${a.abbr}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Defense -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">Verteidigung</div>
                <div class="gmc-detail__grid">
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${def.armor || 0}</span>
                        <span class="gmc-detail__item-lbl">Rüstung</span>
                    </div>
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${def.mitigation || 0}%</span>
                        <span class="gmc-detail__item-lbl">Mitig.</span>
                    </div>
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${def.dodge || 0}%</span>
                        <span class="gmc-detail__item-lbl">Ausw.</span>
                    </div>
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${def.movement || 0}</span>
                        <span class="gmc-detail__item-lbl">Beweg.</span>
                    </div>
                </div>
            </div>

            <!-- Resistances -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">Resistenzen</div>
                <div class="gmc-detail__grid">
                    <div class="gmc-detail__item"><span class="gmc-detail__item-val" style="color:#ef4444">${res.fire || 0}%</span><span class="gmc-detail__item-lbl">Feuer</span></div>
                    <div class="gmc-detail__item"><span class="gmc-detail__item-val" style="color:#3b82f6">${res.cold || 0}%</span><span class="gmc-detail__item-lbl">Kälte</span></div>
                    <div class="gmc-detail__item"><span class="gmc-detail__item-val" style="color:#22c55e">${res.poison || 0}%</span><span class="gmc-detail__item-lbl">Gift</span></div>
                    <div class="gmc-detail__item"><span class="gmc-detail__item-val" style="color:#a855f7">${res.arcane || 0}%</span><span class="gmc-detail__item-lbl">Arkan</span></div>
                </div>
            </div>

            <!-- Offense -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">Kampf</div>
                <div class="gmc-detail__grid">
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${off.initiative || 0}</span>
                        <span class="gmc-detail__item-lbl">Initiative</span>
                    </div>
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${_esc(off.range || '—')}</span>
                        <span class="gmc-detail__item-lbl">Reichw.</span>
                    </div>
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${off.carry || 0}kg</span>
                        <span class="gmc-detail__item-lbl">Tragkr.</span>
                    </div>
                    <div class="gmc-detail__item">
                        <span class="gmc-detail__item-val">${_esc(off.iniFormula || '—')}</span>
                        <span class="gmc-detail__item-lbl">Ini-Formel</span>
                    </div>
                </div>
            </div>

            <!-- Weakness -->
            ${weakness.name ? `
            <div class="gmc-detail__section">
                <div class="gmc-detail__title" style="color:#f87171">Schwäche: ${_esc(weakness.name)}</div>
                <div class="gmc-detail__desc">${_esc(weakness.description || '')}</div>
            </div>
            ` : ''}

            <!-- XP -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">XP</div>
                <div class="gmc-xp-bar">
                    <div class="gmc-xp-fill" style="width:${Math.min(100, (xp.current / (xp.max || 1)) * 100)}%"></div>
                    <span class="gmc-xp-text">${xp.current.toLocaleString('de-DE')} / ${xp.max.toLocaleString('de-DE')}</span>
                </div>
            </div>

            <!-- Second Chance -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">Second Chance</div>
                <div class="gmc-tokens">
                    ${secondChance.map((used, i) => `
                        <div class="gmc-token${used ? ' gmc-token--used' : ''}" data-action="toggle-token" data-index="${i}">
                            <svg viewBox="0 0 24 24" fill="${used ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M12 2L4 7v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V7l-8-5z"/>
                            </svg>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Quick GM Actions -->
            <div class="gmc-detail__section">
                <div class="gmc-detail__title">Schnellaktionen</div>
                <div class="gmc-quick-actions">
                    <button class="gmc-btn gmc-btn--action" data-action="set" data-path="hp.current" data-ref="hp.max" title="HP voll">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" style="color:#22c55e"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        HP voll
                    </button>
                    <button class="gmc-btn gmc-btn--action" data-action="set" data-path="resource.current" data-ref="resource.max" title="Ressource voll">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" style="color:#a78bfa"><path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z"/></svg>
                        Res. voll
                    </button>
                    <button class="gmc-btn gmc-btn--action" data-action="custom-mod" data-path="hp.current" title="LP setzen">
                        LP setzen
                    </button>
                    <button class="gmc-btn gmc-btn--action" data-action="custom-mod" data-path="resource.current" title="Res. setzen">
                        Res. setzen
                    </button>
                </div>
            </div>

            <!-- INVENTORY MANAGEMENT -->
            <div class="gmc-detail__section gmc-inv-section" data-charid="${c.id || ''}">
                <div class="gmc-detail__title" style="display:flex;align-items:center;justify-content:space-between">
                    <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:4px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/></svg>
                        Inventar (${(c.inventory?.items || []).length + (c.quickbar || []).filter(Boolean).length})
                    </span>
                    <span style="font-size:10px;color:#fbbf24;font-weight:400">${c.currency?.gold || 0} Gold</span>
                </div>

                <!-- Search & Add -->
                <div style="display:flex;gap:6px;margin-bottom:8px;margin-top:6px">
                    <div style="flex:1;position:relative">
                        <input type="text" class="gmc-inv-search" placeholder="Item aus Katalog hinzufügen..."
                            style="width:100%;padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;color:white;font-size:11px;outline:none;font-family:inherit"
                            data-charid="${c.id || ''}"
                            oninput="RIFT.gmChars._onInvSearch(this)"
                            onfocus="RIFT.gmChars._onInvSearch(this)">
                        <div class="gmc-inv-results" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:50;background:#14141e;border:1px solid rgba(255,255,255,0.1);border-radius:0 0 6px 6px;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.5)"></div>
                    </div>
                    <input type="number" class="gmc-inv-qty" value="1" min="1" max="99" style="width:42px;padding:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;color:white;font-size:11px;text-align:center;outline:none">
                </div>

                <!-- Item List -->
                <div class="gmc-inv-list" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,0.05);border-radius:6px">
                    ${_renderInvList(c)}
                </div>
            </div>
        </div>`;
    }


    // ════════════════════════════════════════
    //  GLOBAL ACTIONS BAR
    // ════════════════════════════════════════

    function _renderGlobalActions(chars) {
        return `
        <div class="gmc-global">
            <span class="gmc-global__label">${chars.length} Charakter${chars.length !== 1 ? 'e' : ''}</span>
            <div class="gmc-global__btns">
                <button class="gmc-btn gmc-btn--green gmc-btn--sm" onclick="RIFT.gmChars.modifyAll('hp.current', 1)">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    +LP alle
                </button>
                <button class="gmc-btn gmc-btn--red gmc-btn--sm" onclick="RIFT.gmChars.modifyAll('hp.current', -1)">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    −LP alle
                </button>
                <button class="gmc-btn gmc-btn--sm" onclick="RIFT.gmChars.healAll()" title="Alle voll heilen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    Voll heilen
                </button>
                <button class="gmc-btn gmc-btn--sm" onclick="RIFT.gmChars.expandAll()" title="Alle auf-/zuklappen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    Details
                </button>
            </div>
        </div>`;
    }

    function _emptyState() {
        return `
        <div class="gmc-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <div class="gmc-empty__title">Keine Charaktere</div>
            <div class="gmc-empty__desc">Charaktere erscheinen hier sobald Spieler welche erstellen</div>
        </div>`;
    }


    // ════════════════════════════════════════
    //  EVENT BINDING
    // ════════════════════════════════════════

    function _bindCardEvents(grid) {
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const card = btn.closest('.gmc-card');
            const charId = card?.dataset.id;
            const action = btn.dataset.action;

            switch (action) {
                case 'toggle':
                    _toggleExpand(charId);
                    break;

                case 'mod': {
                    const path = btn.dataset.path;
                    const delta = parseInt(btn.dataset.delta, 10);
                    _promptAndModify(charId, path, delta);
                    break;
                }

                case 'set': {
                    const path = btn.dataset.path;
                    const refPath = btn.dataset.ref;
                    if (refPath && charId) {
                        const refVal = _getNestedValue(_chars[charId], refPath);
                        setStat(charId, path, refVal);
                    }
                    break;
                }

                case 'custom-mod': {
                    const path = btn.dataset.path;
                    _promptSetValue(charId, path);
                    break;
                }

                case 'toggle-token': {
                    const idx = parseInt(btn.dataset.index, 10);
                    _toggleSecondChance(charId, idx);
                    break;
                }

                case 'sheet':
                    _openSheet(charId);
                    break;

                case 'remove':
                    _removeCharacter(charId);
                    break;

                case 'grant-item':
                    _openItemGrantModal(charId);
                    break;
            }
        });
    }


    // ════════════════════════════════════════
    //  STAT MODIFICATION (via RiftLink)
    // ════════════════════════════════════════

    function _promptAndModify(charId, path, direction) {
        const labels = {
            'hp.current': 'LP', 'resource.current': 'Ressource',
            'level': 'Level', 'xp.current': 'XP'
        };
        const label = labels[path] || path;
        _showPrompt(`${label}-Änderung:`, '10', (val) => {
            const amount = parseInt(val, 10);
            if (!amount || isNaN(amount)) return;
            modifyStat(charId, path, amount * direction);
        });
    }

    function _promptSetValue(charId, path) {
        const c = _chars[charId];
        if (!c) return;
        const current = _getNestedValue(c, path);
        _showPrompt(`Neuer Wert für ${path}:`, current, (val) => {
            if (val === null) return;
            const num = parseInt(val, 10);
            if (isNaN(num)) return;
            setStat(charId, path, num);
        });
    }

    /** Non-blocking confirm replacement */
    function _showConfirm(message, callback, danger) {
        const old = document.getElementById('gmc-prompt');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'gmc-prompt';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

        const btnColor = danger ? '#ef4444' : '#7c3aed';
        overlay.innerHTML = `
            <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;min-width:280px;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
                <div style="color:#ccc;font-size:13px;margin-bottom:20px;font-family:Inter,sans-serif;line-height:1.5">${message}</div>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button id="gmc-prompt-cancel" style="padding:8px 20px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#999;cursor:pointer;font-size:13px;font-family:Inter,sans-serif">Abbrechen</button>
                    <button id="gmc-prompt-ok" style="padding:8px 20px;border-radius:8px;border:none;background:${btnColor};color:white;cursor:pointer;font-size:13px;font-weight:600;font-family:Inter,sans-serif">Bestätigen</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        document.getElementById('gmc-prompt-ok').addEventListener('click', () => { close(); callback(); });
        document.getElementById('gmc-prompt-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
            if (e.key === 'Enter') { close(); callback(); document.removeEventListener('keydown', handler); }
        });
    }
    function _showPrompt(label, defaultVal, callback) {
        // Remove existing
        const old = document.getElementById('gmc-prompt');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'gmc-prompt';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';

        overlay.innerHTML = `
            <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
                <div style="color:#ccc;font-size:13px;margin-bottom:12px;font-family:Inter,sans-serif">${label}</div>
                <input id="gmc-prompt-input" type="number" value="${defaultVal}" 
                    style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:white;font-size:15px;font-family:Inter,sans-serif;outline:none;box-sizing:border-box"
                    autofocus>
                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
                    <button id="gmc-prompt-cancel" style="padding:8px 20px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#999;cursor:pointer;font-size:13px;font-family:Inter,sans-serif">Abbrechen</button>
                    <button id="gmc-prompt-ok" style="padding:8px 20px;border-radius:8px;border:none;background:#7c3aed;color:white;cursor:pointer;font-size:13px;font-weight:600;font-family:Inter,sans-serif">OK</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const input = document.getElementById('gmc-prompt-input');
        const okBtn = document.getElementById('gmc-prompt-ok');
        const cancelBtn = document.getElementById('gmc-prompt-cancel');

        input.select();

        const close = () => overlay.remove();
        const confirm = () => { const v = input.value; close(); callback(v); };

        okBtn.addEventListener('click', confirm);
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') close();
        });
    }

    /**
     * Modify a stat by delta. Clamps to 0..max where applicable.
     */
    async function modifyStat(charId, path, delta) {
        const c = _chars[charId];
        if (!c) return;

        const current = _getNestedValue(c, path) || 0;
        let newVal = current + delta;

        // Clamp
        if (path === 'hp.current') {
            newVal = Math.max(0, Math.min(c.hp?.max || 100, newVal));
        } else if (path === 'resource.current') {
            newVal = Math.max(0, Math.min(c.resource?.max || 100, newVal));
        } else if (path === 'level') {
            newVal = Math.max(1, newVal);
        }

        await RIFT.link.write(charId, path, newVal);
        _toast(`${_charName(charId)}: ${path.split('.').pop()} ${delta > 0 ? '+' : ''}${delta} → ${newVal}`);
    }

    /**
     * Set a stat to an exact value.
     */
    async function setStat(charId, path, value) {
        await RIFT.link.write(charId, path, value);
        _toast(`${_charName(charId)}: ${path} → ${value}`);
    }

    /**
     * Modify a stat for ALL characters.
     */
    async function modifyAll(path, direction) {
        const labels = { 'hp.current': 'LP', 'resource.current': 'Ressource' };
        const label = labels[path] || path;
        _showPrompt(`${label}-Änderung für ALLE:`, '10', async (val) => {
            const amount = parseInt(val, 10);
            if (!amount || isNaN(amount)) return;

            const delta = amount * direction;
            const maxField = path === 'hp.current' ? 'hp.max' : path === 'resource.current' ? 'resource.max' : null;

            const count = await RIFT.link.writeAll(path, (current, charData) => {
                const max = maxField ? _getNestedValue(charData, maxField) || 100 : Infinity;
                return Math.max(0, Math.min(max, (current || 0) + delta));
            });

            _toast(`${label} für ${count} Charakter(e) geändert (${delta > 0 ? '+' : ''}${delta})`);
        });
    }

    /**
     * Full heal all characters.
     */
    async function healAll() {
        _showConfirm('Alle Charaktere voll heilen (LP + Ressource)?', async () => {
            const chars = Object.values(_chars).filter(c => c && !c.id?.startsWith('_'));
            let count = 0;

            for (const c of chars) {
                await RIFT.link.writeBatch(c.id, {
                    'hp.current': c.hp?.max || 100,
                    'resource.current': c.resource?.max || 100
                });
                count++;
            }

            _toast(`${count} Charakter(e) vollständig geheilt`);
        });
    }


    // ════════════════════════════════════════
    //  OTHER ACTIONS
    // ════════════════════════════════════════

    function _toggleExpand(charId) {
        if (_expanded.has(charId)) _expanded.delete(charId);
        else _expanded.add(charId);
        render();
    }

    function expandAll() {
        const chars = Object.keys(_chars).filter(k => !k.startsWith('_'));
        if (_expanded.size >= chars.length) {
            _expanded.clear();
        } else {
            chars.forEach(id => _expanded.add(id));
        }
        render();
    }

    function _toggleSecondChance(charId, index) {
        const c = _chars[charId];
        if (!c) return;
        const used = [...(c.secondChance?.used || [false, false, false])];
        used[index] = !used[index];
        RIFT.link.write(charId, 'secondChance', { used });
    }

    function _openSheet(charId) {
        const c = _chars[charId];
        if (!c) return;
        const url = `sheet-worldsapart.html?char=${charId}&room=${_roomCode}&embed=true`;

        // Use BC modal if available, otherwise new tab
        if (window.BC?.openCharacterSheet) {
            BC.openCharacterSheet(charId, c.profile?.name || c.name || 'Charakter', url);
        } else {
            window.open('/pages/sheets/' + url, '_blank');
        }
    }

    async function _removeCharacter(charId) {
        const name = _charName(charId);
        _showConfirm(`"${name}" aus dem Raum entfernen?`, async () => {
            try {
                const db = window.RIFT?.firebase?.getFirestore?.();
                if (db && _roomCode) {
                    await db.collection('rooms').doc(_roomCode).collection('characters').doc(charId).delete();
                    _toast(`${name} entfernt`);
                }
            } catch (err) {
                console.error(LOG, 'Remove error:', err);
                _toast('Fehler: ' + err.message, 'error');
            }
        }, true);
    }


    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════

    function _charName(charId) {
        const c = _chars[charId];
        return c?.profile?.name || c?.name || 'Unbekannt';
    }

    function _hpColor(current, max) {
        const pct = (current || 0) / (max || 1) * 100;
        return pct > 50 ? 'gmc--green' : pct > 25 ? 'gmc--yellow' : 'gmc--red';
    }

    const CLASS_COLORS = {
        barbarian: '#ef4444', mage: '#3b82f6', assassin: '#a855f7', paladin: '#d4a844',
        druid: '#22c55e', warlock: '#c084fc', ranger: '#fb923c', cleric: '#e2e8f0',
        // Legacy IDs
        barbar: '#ef4444', magier: '#3b82f6', assassine: '#a855f7',
        druide: '#22c55e', hexenmeister: '#c084fc', waldlaeufer: '#fb923c', kleriker: '#e2e8f0'
    };
    function _classColor(id) { return CLASS_COLORS[id] || null; }

    function _getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    // ════════════════════════════════════════
    //  ITEM GRANTING
    // ════════════════════════════════════════

    let _itemCatalogCache = null;

    async function _loadItemCatalog() {
        if (_itemCatalogCache) return _itemCatalogCache;
        try {
            const db = window.RIFT?.firebase?.getFirestore?.();
            if (!db) throw new Error('No Firestore');
            const snap = await db.collection('itemCatalog/worldsapart/items').get();
            _itemCatalogCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            _itemCatalogCache.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            return _itemCatalogCache;
        } catch (e) {
            console.error(LOG, 'Load item catalog error:', e);
            return [];
        }
    }

    async function _openItemGrantModal(charId) {
        const c = _chars[charId];
        if (!c) return;

        const items = await _loadItemCatalog();

        const RARITY_COLORS = {
            common: '#9a9aaa', uncommon: '#2ecc71', rare: '#3498db',
            epic: '#9b59b6', legendary: '#e67e22', unique: '#e74c3c'
        };

        const html = `
        <div class="modal active" id="grantItemModal" style="display:flex;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">
            <div style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:12px;width:600px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
                <div style="padding:16px 20px;border-bottom:1px solid var(--border,#333);display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:white">Item vergeben</div>
                        <div style="font-size:12px;color:#888;margin-top:2px">an ${_esc(c.profile?.name || charId)}</div>
                    </div>
                    <button onclick="this.closest('.modal').remove()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">&times;</button>
                </div>
                <div style="padding:12px 20px;border-bottom:1px solid var(--border,#333)">
                    <input type="text" id="grantItemSearch" placeholder="Item suchen..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:white;font-size:13px;outline:none" oninput="document.querySelectorAll('.gi-row').forEach(r=>{r.style.display=r.dataset.name.includes(this.value.toLowerCase())?'':'none'})">
                </div>
                <div style="flex:1;overflow-y:auto;padding:8px 12px">
                    ${items.length ? items.map(item => {
                        const rc = RARITY_COLORS[item.rarity] || '#999';
                        const stats = [];
                        if (item.stats?.damage) stats.push(item.stats.damage + ' DMG');
                        if (item.stats?.armor) stats.push(item.stats.armor + ' DEF');
                        return `<div class="gi-row" data-name="${_esc((item.name||'').toLowerCase())}" data-id="${item.id}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;transition:background 0.12s;border:1px solid transparent" onmouseover="this.style.background='rgba(255,255,255,0.04)';this.style.borderColor='rgba(255,255,255,0.08)'" onmouseout="this.style.background='';this.style.borderColor='transparent'" onclick="RIFT.gmChars._grantItem('${charId}','${item.id}')">
                            <div style="width:8px;height:8px;border-radius:50%;background:${rc};flex-shrink:0"></div>
                            <div style="flex:1;min-width:0">
                                <div style="font-size:13px;font-weight:600;color:${rc}">${_esc(item.name)}</div>
                                <div style="font-size:10px;color:#888">${_esc(item.type)} ${item.subType ? '/ ' + item.subType : ''} ${stats.length ? '&middot; ' + stats.join(', ') : ''}</div>
                            </div>
                            <div style="font-size:11px;color:#fbbf24">${item.value || 0}g</div>
                        </div>`;
                    }).join('') : '<div style="text-align:center;padding:40px;color:#888">Keine Items im Katalog. Erstelle Items in der Admin-Seite.</div>'}
                </div>
                <div style="padding:12px 20px;border-top:1px solid var(--border,#333);display:flex;gap:8px">
                    <input type="number" id="grantItemQty" value="1" min="1" max="99" style="width:60px;padding:6px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:white;font-size:12px;text-align:center">
                    <div style="flex:1;font-size:11px;color:#666;display:flex;align-items:center">Anzahl</div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('grantItemSearch')?.focus();
    }

    async function _grantItem(charId, itemId) {
        const items = await _loadItemCatalog();
        const template = items.find(i => i.id === itemId);
        if (!template) { _toast('Item nicht gefunden', 'error'); return; }

        const qty = parseInt(document.getElementById('grantItemQty')?.value) || 1;

        // Create instance from template
        const instance = {
            instanceId: 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            baseItemId: template.id,
            displayName: template.name,
            name: template.name,
            type: template.type,
            subType: template.subType || '',
            slot: template.slot || '',
            rarity: template.rarity || 'common',
            quantity: qty,
            weight: template.weight || 0,
            value: template.value || 0,
            finalValue: template.value || 0,
            stats: template.stats || {},
            finalStats: template.stats || {},
            flags: template.flags || {},
            requirements: template.requirements || {},
            description: template.description || '',
            flavorText: template.flavorText || '',
            stackable: template.stackable || false,
            gridW: template.gridW || 1,
            gridH: template.gridH || 1,
            icon: template.icon || '',
            col: null,
            row: null,
            durability: template.durability ? { current: template.durability, max: template.durability } : null,
            source: 'gm',
            acquiredAt: new Date().toISOString()
        };

        try {
            // Read current inventory
            const c = _chars[charId];
            if (!c) throw new Error('Character not found');

            const inv = c.inventory || { cols: 16, rows: 11, items: [] };
            if (!inv.items) inv.items = [];

            // Stack if possible
            if (instance.stackable || instance.flags?.consumable) {
                const existing = inv.items.find(i => i.baseItemId === instance.baseItemId);
                if (existing) {
                    existing.quantity = (existing.quantity || 1) + qty;
                    await RIFT.link.write(charId, 'inventory', inv);
                    _toast(`${qty}x ${template.name} hinzugefügt (gestapelt)`);
                    document.getElementById('grantItemModal')?.remove();
                    return;
                }
            }

            inv.items.push(instance);
            await RIFT.link.write(charId, 'inventory', inv);
            _toast(`${qty}x ${template.name} an ${c.profile?.name || charId} vergeben`);
            document.getElementById('grantItemModal')?.remove();
        } catch (e) {
            console.error(LOG, 'Grant item error:', e);
            _toast('Fehler: ' + e.message, 'error');
        }
    }


    // ════════════════════════════════════════
    //  GM INVENTORY MANAGEMENT
    // ════════════════════════════════════════

    const RARITY_COLORS = {
        common: '#9a9aaa', uncommon: '#2ecc71', rare: '#3498db',
        epic: '#9b59b6', legendary: '#e67e22', unique: '#e74c3c'
    };

    function _renderInvList(c) {
        const items = c.inventory?.items || [];
        const eq = c.equipment || {};
        const charId = c.id || '';

        if (!items.length && !Object.values(eq).some(Boolean) && !(c.quickbar || []).some(Boolean)) {
            return '<div style="padding:20px;text-align:center;color:#555;font-size:11px">Inventar leer</div>';
        }

        let html = '';

        // Equipment first
        const eqItems = Object.entries(eq).filter(([, v]) => v);
        if (eqItems.length) {
            html += '<div style="padding:4px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;background:rgba(255,255,255,0.02)">Ausgerüstet</div>';
            for (const [slot, item] of eqItems) {
                html += _renderInvRow(item, charId, 'equip', slot);
            }
        }

        // Quickbar
        const qbItems = (c.quickbar || []).filter(Boolean);
        if (qbItems.length) {
            html += '<div style="padding:4px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;background:rgba(255,255,255,0.02)">Schnellzugriff</div>';
            for (let i = 0; i < c.quickbar.length; i++) {
                if (c.quickbar[i]) html += _renderInvRow(c.quickbar[i], charId, 'qb', i);
            }
        }

        // Inventory
        if (items.length) {
            html += '<div style="padding:4px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;background:rgba(255,255,255,0.02)">Inventar</div>';
            for (let i = 0; i < items.length; i++) {
                html += _renderInvRow(items[i], charId, 'inv', i);
            }
        }

        // Footer: clear all button
        html += `<div style="padding:6px 8px;border-top:1px solid rgba(255,255,255,0.04);text-align:right">
            <button onclick="RIFT.gmChars._invClearAll('${charId}')" style="background:none;border:none;color:#ef4444;font-size:10px;cursor:pointer;opacity:0.6;font-family:inherit" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">Inventar leeren</button>
        </div>`;

        return html;
    }

    function _renderInvRow(item, charId, area, key) {
        const rc = RARITY_COLORS[item.rarity] || '#999';
        const stats = [];
        if (item.stats?.damage || item.finalStats?.damage) stats.push((item.finalStats?.damage || item.stats?.damage) + ' DMG');
        if (item.stats?.armor || item.finalStats?.armor) stats.push((item.finalStats?.armor || item.stats?.armor) + ' DEF');
        const size = `${item.gridW || 1}x${item.gridH || 1}`;
        const loc = area === 'equip' ? `[${key}]` : '';

        return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:11px;transition:background 0.1s" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
            ${item.icon
                ? `<img src="${_esc(item.icon)}" style="width:24px;height:24px;object-fit:contain;border-radius:2px;flex-shrink:0;border:1px solid ${rc}30">`
                : `<div style="width:6px;height:6px;border-radius:50%;background:${rc};flex-shrink:0"></div>`
            }
            <div style="flex:1;min-width:0">
                <div style="color:${rc};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(item.displayName || item.name)} ${item.quantity > 1 ? '<span style="color:#888">x' + item.quantity + '</span>' : ''} ${loc ? '<span style="color:#555;font-size:9px">' + loc + '</span>' : ''}</div>
                <div style="font-size:9px;color:#666">${item.type}${stats.length ? ' | ' + stats.join(', ') : ''} | ${size} | ${item.finalValue ?? item.value ?? 0}g</div>
            </div>
            <div style="display:flex;gap:2px;flex-shrink:0">
                ${area === 'inv' && (item.stackable || item.quantity > 1) ? `<button onclick="RIFT.gmChars._invSetQty('${charId}',${key})" title="Menge ändern" style="background:none;border:none;color:#888;cursor:pointer;font-size:11px;padding:2px 4px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>` : ''}
                <button onclick="RIFT.gmChars._invDuplicate('${charId}','${area}','${key}')" title="Duplizieren" style="background:none;border:none;color:#888;cursor:pointer;font-size:11px;padding:2px 4px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                <button onclick="RIFT.gmChars._invRemove('${charId}','${area}','${key}')" title="Entfernen" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;padding:2px 4px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        </div>`;
    }

    // Live search in catalog
    let _searchTimeout = null;
    async function _onInvSearch(input) {
        clearTimeout(_searchTimeout);
        const q = input.value.trim().toLowerCase();
        const results = input.closest('.gmc-inv-section')?.querySelector('.gmc-inv-results');
        const charId = input.dataset.charid;
        if (!results) return;

        if (q.length < 1) { results.style.display = 'none'; return; }

        _searchTimeout = setTimeout(async () => {
            const catalog = await _loadItemCatalog();
            const matches = catalog.filter(i => (i.name || '').toLowerCase().includes(q)).slice(0, 12);

            if (!matches.length) {
                results.innerHTML = '<div style="padding:12px;text-align:center;color:#666;font-size:11px">Keine Ergebnisse</div>';
                results.style.display = 'block';
                return;
            }

            results.innerHTML = matches.map(item => {
                const rc = RARITY_COLORS[item.rarity] || '#999';
                const stats = [];
                if (item.stats?.damage) stats.push(item.stats.damage);
                if (item.stats?.armor) stats.push(item.stats.armor + ' DEF');
                return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;transition:background 0.1s;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.03)" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''" onclick="RIFT.gmChars._invAddFromCatalog('${charId}','${item.id}',this)">
                    ${item.icon ? `<img src="${_esc(item.icon)}" style="width:20px;height:20px;object-fit:contain;border-radius:2px;border:1px solid ${rc}30">` : `<div style="width:6px;height:6px;border-radius:50%;background:${rc};flex-shrink:0"></div>`}
                    <div style="flex:1;min-width:0">
                        <span style="color:${rc};font-weight:600">${_esc(item.name)}</span>
                        <span style="color:#666;font-size:9px;margin-left:4px">${item.type} ${item.gridW||1}x${item.gridH||1}</span>
                    </div>
                    <span style="color:#fbbf24;font-size:10px">${item.value || 0}g</span>
                </div>`;
            }).join('');
            results.style.display = 'block';
        }, 150);
    }

    // Close search results on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.gmc-inv-section')) {
            document.querySelectorAll('.gmc-inv-results').forEach(r => r.style.display = 'none');
        }
    });

    async function _invAddFromCatalog(charId, itemId, clickEl) {
        const catalog = await _loadItemCatalog();
        const template = catalog.find(i => i.id === itemId);
        if (!template) return;

        const section = clickEl?.closest('.gmc-inv-section');
        const qtyInput = section?.querySelector('.gmc-inv-qty');
        const qty = parseInt(qtyInput?.value) || 1;
        const searchInput = section?.querySelector('.gmc-inv-search');

        const c = _chars[charId];
        if (!c) return;
        const inv = c.inventory || { cols: 16, rows: 11, items: [] };
        if (!inv.items) inv.items = [];

        const instance = {
            instanceId: 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            baseItemId: template.id,
            displayName: template.name,
            name: template.name,
            type: template.type,
            subType: template.subType || '',
            slot: template.slot || '',
            rarity: template.rarity || 'common',
            quantity: qty,
            weight: template.weight || 0,
            value: template.value || 0,
            finalValue: template.value || 0,
            stats: template.stats || {},
            finalStats: template.stats || {},
            flags: template.flags || {},
            requirements: template.requirements || {},
            description: template.description || '',
            flavorText: template.flavorText || '',
            stackable: template.stackable || false,
            gridW: template.gridW || 1,
            gridH: template.gridH || 1,
            icon: template.icon || '',
            col: null,
            row: null,
            source: 'gm',
            acquiredAt: new Date().toISOString()
        };

        // Stack check
        if (instance.stackable || instance.flags?.consumable) {
            const existing = inv.items.find(i => i.baseItemId === instance.baseItemId);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + qty;
                try {
                    await RIFT.link.write(charId, 'inventory', inv);
                    _toast(`${qty}x ${template.name} hinzugefügt (gestapelt)`);
                    _refreshInvSection(charId);
                } catch (e) { _toast('Fehler: ' + e.message, 'error'); }
                if (searchInput) { searchInput.value = ''; }
                section?.querySelector('.gmc-inv-results')?.style.setProperty('display', 'none');
                return;
            }
        }

        inv.items.push(instance);
        try {
            await RIFT.link.write(charId, 'inventory', inv);
            _toast(`${qty}x ${template.name} vergeben`);
            _refreshInvSection(charId);
        } catch (e) { _toast('Fehler: ' + e.message, 'error'); }

        if (searchInput) { searchInput.value = ''; }
        section?.querySelector('.gmc-inv-results')?.style.setProperty('display', 'none');
    }

    async function _invRemove(charId, area, key) {
        const c = _chars[charId];
        if (!c) return;

        if (area === 'equip') {
            if (!c.equipment?.[key]) return;
            const name = c.equipment[key].displayName || c.equipment[key].name || '';
            c.equipment[key] = null;
            try { await RIFT.link.write(charId, 'equipment', c.equipment); _toast(`${name} entfernt`); _refreshInvSection(charId); }
            catch (e) { _toast('Fehler', 'error'); }
        } else if (area === 'qb') {
            const idx = parseInt(key);
            if (!c.quickbar?.[idx]) return;
            const name = c.quickbar[idx].displayName || c.quickbar[idx].name || '';
            c.quickbar[idx] = null;
            try { await RIFT.link.write(charId, 'quickbar', c.quickbar); _toast(`${name} entfernt`); _refreshInvSection(charId); }
            catch (e) { _toast('Fehler', 'error'); }
        } else {
            const idx = parseInt(key);
            const items = c.inventory?.items;
            if (!items?.[idx]) return;
            const name = items[idx].displayName || items[idx].name || '';
            items.splice(idx, 1);
            try { await RIFT.link.write(charId, 'inventory', c.inventory); _toast(`${name} entfernt`); _refreshInvSection(charId); }
            catch (e) { _toast('Fehler', 'error'); }
        }
    }

    async function _invDuplicate(charId, area, key) {
        const c = _chars[charId];
        if (!c) return;

        let source;
        if (area === 'equip') source = c.equipment?.[key];
        else if (area === 'qb') source = c.quickbar?.[parseInt(key)];
        else source = c.inventory?.items?.[parseInt(key)];
        if (!source) return;

        const clone = JSON.parse(JSON.stringify(source));
        clone.instanceId = 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        clone.col = null;
        clone.row = null;
        clone.source = 'gm';

        if (!c.inventory) c.inventory = { cols: 16, rows: 11, items: [] };
        if (!c.inventory.items) c.inventory.items = [];
        c.inventory.items.push(clone);

        try { await RIFT.link.write(charId, 'inventory', c.inventory); _toast(`${clone.displayName || clone.name} dupliziert`); _refreshInvSection(charId); }
        catch (e) { _toast('Fehler', 'error'); }
    }

    async function _invSetQty(charId, idx) {
        const c = _chars[charId];
        const item = c?.inventory?.items?.[idx];
        if (!item) return;

        _showPrompt(`Menge für ${item.displayName || item.name}:`, item.quantity || 1, async (val) => {
            if (val === null) return;
            const qty = parseInt(val);
            if (isNaN(qty) || qty < 0) return;

            if (qty === 0) {
                c.inventory.items.splice(idx, 1);
            } else {
                item.quantity = qty;
            }
            try { await RIFT.link.write(charId, 'inventory', c.inventory); _toast('Menge geändert'); _refreshInvSection(charId); }
            catch (e) { _toast('Fehler', 'error'); }
        });
    }

    async function _invClearAll(charId) {
        _showConfirm('Komplettes Inventar leeren?', async () => {
            const c = _chars[charId];
            if (!c) return;

            c.inventory = { cols: 16, rows: 11, items: [] };
            c.equipment = { head:null,shoulders:null,chest:null,gloves:null,belt:null,legs:null,boots:null,cape:null,mainhand:null,offhand:null,ring1:null,ring2:null,amulet:null,talisman:null,ammo:null };
            c.quickbar = Array(8).fill(null);
            try {
                await RIFT.link.writeBatch(charId, { inventory: c.inventory, equipment: c.equipment, quickbar: c.quickbar });
                _toast('Inventar geleert');
                _refreshInvSection(charId);
            } catch (e) { _toast('Fehler', 'error'); }
        }, true);
    }

    function _refreshInvSection(charId) {
        const c = _chars[charId];
        if (!c) return;
        const section = document.querySelector(`.gmc-inv-section[data-charid="${charId}"]`);
        if (!section) return;
        const list = section.querySelector('.gmc-inv-list');
        if (list) list.innerHTML = _renderInvList(c);

        // Update title count
        const title = section.querySelector('.gmc-detail__title span');
        if (title) {
            const count = (c.inventory?.items || []).length + (c.quickbar || []).filter(Boolean).length;
            title.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" width="14" height="14" style="vertical-align:-2px;margin-right:4px"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/></svg> Inventar (${count})`;
        }
    }


    function _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function _toast(msg, type) {
        // Use BC toast if available
        if (window.BC?.toast) { BC.toast(msg, type || 'success'); return; }
        console.log(LOG, msg);
    }


    // ════════════════════════════════════════
    //  EXPOSE
    // ════════════════════════════════════════

    // ════════════════════════════════════════
    //  FOCUS RULESET FILTER
    // ════════════════════════════════════════

    function setFocusRuleset(ruleset) {
        if (_focusRuleset === ruleset) return;
        _focusRuleset = ruleset || null;
        console.log(LOG, 'Focus ruleset:', _focusRuleset || 'all');
        render();
    }

    // Auto-subscribe to room focus changes
    function _initFocusWatcher() {
        if (window.RIFT?.focus?.subscribe) {
            RIFT.focus.subscribe(function(focus) {
                setFocusRuleset(focus?.ruleset || null);
            });
        }
    }
    setTimeout(_initFocusWatcher, 1000);

    window.RIFT = window.RIFT || {};
    window.RIFT.gmChars = {
        init,
        render,
        updateMembers,
        updateOnline,

        // Stat operations
        modifyStat,
        setStat,
        modifyAll,
        setFocusRuleset,
        healAll,

        // UI
        expandAll,

        // Items (old modal)
        _grantItem,

        // Inventory management (inline)
        _onInvSearch,
        _invAddFromCatalog,
        _invRemove,
        _invDuplicate,
        _invSetQty,
        _invClearAll,

        // Access
        get characters() { return _chars; },
    };

    console.log(LOG, 'Ready');

})();

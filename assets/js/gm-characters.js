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
            _chars = allChars || {};
            render();
        });

        RIFT.state.on('riftlink:char:updated', (evt) => {
            if (evt.charId && _chars[evt.charId]) {
                const updated = RIFT.state.get(`characters.${evt.charId}`);
                if (updated) _chars[evt.charId] = updated;
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

        const chars = Object.values(_chars).filter(c => c && !c.id?.startsWith('_'));

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
        const amount = parseInt(prompt(`${label}-Änderung:`, '10'), 10);
        if (!amount || isNaN(amount)) return;

        modifyStat(charId, path, amount * direction);
    }

    function _promptSetValue(charId, path) {
        const c = _chars[charId];
        if (!c) return;
        const current = _getNestedValue(c, path);
        const input = prompt(`Neuer Wert für ${path}:`, current);
        if (input === null) return;
        const val = parseInt(input, 10);
        if (isNaN(val)) return;
        setStat(charId, path, val);
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
        const amount = parseInt(prompt(`${label}-Änderung für ALLE:`, '10'), 10);
        if (!amount || isNaN(amount)) return;

        const delta = amount * direction;
        const maxField = path === 'hp.current' ? 'hp.max' : path === 'resource.current' ? 'resource.max' : null;

        const count = await RIFT.link.writeAll(path, (current, charData) => {
            const max = maxField ? _getNestedValue(charData, maxField) || 100 : Infinity;
            return Math.max(0, Math.min(max, (current || 0) + delta));
        });

        _toast(`${label} für ${count} Charakter(e) geändert (${delta > 0 ? '+' : ''}${delta})`);
    }

    /**
     * Full heal all characters.
     */
    async function healAll() {
        if (!confirm('Alle Charaktere voll heilen (LP + Ressource)?')) return;

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
        const url = `sheet-worldsapart.html?char=${charId}&room=${_roomCode}`;

        // Use BC modal if available, otherwise new tab
        if (window.BC?.openCharacterSheet) {
            BC.openCharacterSheet(charId, c.profile?.name || 'Charakter', url);
        } else {
            window.open('/pages/sheets/' + url, '_blank');
        }
    }

    async function _removeCharacter(charId) {
        const name = _charName(charId);
        if (!confirm(`"${name}" aus dem Raum entfernen?`)) return;

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
        barbar: '#ef4444', magier: '#3b82f6', assassine: '#a855f7', paladin: '#d4a844',
        druide: '#22c55e', hexenmeister: '#c084fc', waldlaeufer: '#fb923c', kleriker: '#e2e8f0'
    };
    function _classColor(id) { return CLASS_COLORS[id] || null; }

    function _getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        return path.split('.').reduce((o, k) => o?.[k], obj);
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
        healAll,

        // UI
        expandAll,

        // Access
        get characters() { return _chars; },
    };

    console.log(LOG, 'Ready');

})();

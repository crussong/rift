/**
 * RIFT Header Controller
 * Handles: Search, Party, Room Code, Notifications, GM Settings, Profile
 */

const HeaderController = {
    // State
    isGM: false,
    roomCode: null,
    partyMembers: [],
    notifications: [],
    searchResults: [],
    
    // Search Data
    searchableItems: [
        // Pages
        { type: 'page', name: 'Würfel', url: 'dice.html', icon: '🎲', keywords: ['dice', 'roll', 'wurf'] },
        { type: 'page', name: 'Whiteboard', url: 'whiteboard.html', icon: '🎨', keywords: ['draw', 'zeichnen', 'board'] },
        { type: 'page', name: 'Maps', url: 'maps.html', icon: '🗺️', keywords: ['karte', 'map', 'vtt', 'battle'] },
        { type: 'page', name: 'Chat', url: 'chat.html', icon: '💬', keywords: ['nachrichten', 'messages'] },
        { type: 'page', name: 'Sessions', url: 'sessions.html', icon: '📅', keywords: ['room', 'raum', 'spiel'] },
        { type: 'page', name: 'Charaktere', url: 'sheet.html', icon: '👤', keywords: ['character', 'held', 'spieler'] },
        { type: 'page', name: 'Einstellungen', url: 'user-settings.html', icon: '⚙️', keywords: ['settings', 'optionen', 'config'] },
        // Regelwerke
        { type: 'ruleset', name: 'D&D 5e (2024)', url: 'sheet-dnd5e.html', icon: '📖', keywords: ['dnd', 'dungeons', 'dragons'] },
        { type: 'ruleset', name: 'Worlds Apart', url: 'sheet-worldsapart.html', icon: '📖', keywords: ['worlds', 'apart', 'wa'] },
        { type: 'ruleset', name: 'Cyberpunk Red', url: 'sheet-cyberpunk.html', icon: '📖', keywords: ['cyber', 'punk', 'red'] },
        { type: 'ruleset', name: 'How To Be A Hero', url: 'sheet-htbah.html', icon: '📖', keywords: ['htbah', 'hero'] },
    ],
    
    // ========================================
    // INITIALIZATION
    // ========================================
    
    init() {
        this.setupSearch();
        this.setupPartyDropdown();
        this.setupRoomCode();
        this.setupNotifications();
        this.setupGMSettings();
        this.setupProfile();
        this.loadState();
        console.log('[Header] Initialized');
    },
    
    loadState() {
        // Get room code from localStorage or URL
        this.roomCode = localStorage.getItem('rift_room_code') || null;
        
        // Check if user is GM
        const sessionData = JSON.parse(localStorage.getItem('rift_current_session') || '{}');
        const userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
        this.isGM = sessionData.gmId === userData.uid;
        
        // Update UI based on GM status
        this.updateGMVisibility();
        
        // Update room code display
        if (this.roomCode) {
            this.updateRoomCodeDisplay();
        }
    },
    
    // ========================================
    // SEARCH
    // ========================================
    
    setupSearch() {
        const searchInput = document.querySelector('.topnav__search input');
        const searchContainer = document.querySelector('.topnav__search');
        
        if (!searchInput || !searchContainer) return;
        
        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'search-dropdown';
        dropdown.innerHTML = '<div class="search-dropdown__content"></div>';
        searchContainer.appendChild(dropdown);
        
        // Input handler
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 150);
        });
        
        // Focus/blur
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.length >= 1) {
                this.handleSearch(searchInput.value);
            }
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!searchContainer.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
        
        // Keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.classList.remove('active');
                searchInput.blur();
            }
            if (e.key === 'Enter') {
                const firstResult = dropdown.querySelector('.search-dropdown__item');
                if (firstResult) {
                    window.location.href = firstResult.href;
                }
            }
        });
    },
    
    handleSearch(query) {
        const dropdown = document.querySelector('.search-dropdown');
        const content = dropdown?.querySelector('.search-dropdown__content');
        if (!dropdown || !content) return;
        
        if (query.length < 1) {
            dropdown.classList.remove('active');
            return;
        }
        
        const q = query.toLowerCase();
        
        // Search static items
        let results = this.searchableItems.filter(item => {
            return item.name.toLowerCase().includes(q) ||
                   item.keywords.some(k => k.includes(q));
        });
        
        // Search characters from localStorage
        const characters = JSON.parse(localStorage.getItem('rift_characters') || '[]');
        if (Array.isArray(characters)) {
            characters.forEach(char => {
                if (char.name?.toLowerCase().includes(q)) {
                    results.push({
                        type: 'character',
                        name: char.name,
                        url: `sheet.html?id=${char.id}`,
                        icon: '🧙',
                        meta: `${char.race || ''} ${char.class || ''}`
                    });
                }
            });
        }
        
        // Search sessions
        const sessions = JSON.parse(localStorage.getItem('rift_sessions') || '[]');
        if (Array.isArray(sessions)) {
            sessions.forEach(session => {
                if (session.name?.toLowerCase().includes(q)) {
                    results.push({
                        type: 'session',
                        name: session.name,
                        url: `session.html?id=${session.id}`,
                        icon: '🎮',
                        meta: session.ruleset || ''
                    });
                }
            });
        }
        
        // Render results
        if (results.length === 0) {
            content.innerHTML = `
                <div class="search-dropdown__empty">
                    <span>Keine Ergebnisse für "${query}"</span>
                </div>
            `;
        } else {
            // Group by type
            const grouped = {};
            results.forEach(r => {
                if (!grouped[r.type]) grouped[r.type] = [];
                grouped[r.type].push(r);
            });
            
            const typeLabels = {
                page: 'Seiten',
                ruleset: 'Regelwerke',
                character: 'Charaktere',
                session: 'Sessions'
            };
            
            let html = '';
            for (const [type, items] of Object.entries(grouped)) {
                html += `<div class="search-dropdown__group">
                    <div class="search-dropdown__label">${typeLabels[type] || type}</div>
                    ${items.slice(0, 5).map(item => `
                        <a href="${item.url}" class="search-dropdown__item">
                            <span class="search-dropdown__icon">${item.icon}</span>
                            <div class="search-dropdown__info">
                                <span class="search-dropdown__name">${item.name}</span>
                                ${item.meta ? `<span class="search-dropdown__meta">${item.meta}</span>` : ''}
                            </div>
                            <span class="search-dropdown__type">${typeLabels[item.type] || ''}</span>
                        </a>
                    `).join('')}
                </div>`;
            }
            content.innerHTML = html;
        }
        
        dropdown.classList.add('active');
    },
    
    // ========================================
    // PARTY DROPDOWN
    // ========================================
    
    setupPartyDropdown() {
        const partyDropdown = document.querySelector('.topnav__dropdown--party');
        if (!partyDropdown) return;
        
        // Invite button
        const inviteBtn = partyDropdown.querySelector('.topnav__dropdown-item');
        if (inviteBtn && inviteBtn.textContent.includes('einladen')) {
            inviteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showInviteModal();
            });
        }
        
        // Manage button
        const manageBtn = partyDropdown.querySelectorAll('.topnav__dropdown-item')[1];
        if (manageBtn && manageBtn.textContent.includes('verwalten')) {
            manageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPartyManageModal();
            });
        }
        
        // Member click for GM actions
        partyDropdown.querySelectorAll('.topnav__dropdown-member').forEach(member => {
            member.style.cursor = 'pointer';
            member.addEventListener('click', (e) => {
                if (this.isGM) {
                    const name = member.querySelector('.topnav__dropdown-member-name')?.textContent;
                    this.showMemberActions(name, member);
                }
            });
        });
    },
    
    showInviteModal() {
        const code = this.roomCode || 'XXX-XXX';
        const link = `${window.location.origin}/join.html?code=${code.replace('-', '')}`;
        
        this.showModal('Spieler einladen', `
            <div class="modal-invite">
                <p>Teile diesen Code oder Link mit deinen Spielern:</p>
                
                <div class="modal-invite__code">
                    <span>${code}</span>
                    <button onclick="HeaderController.copyToClipboard('${code}')" class="btn btn--small">Kopieren</button>
                </div>
                
                <div class="modal-invite__link">
                    <input type="text" value="${link}" readonly>
                    <button onclick="HeaderController.copyToClipboard('${link}')" class="btn btn--small">Kopieren</button>
                </div>
                
                <div class="modal-invite__qr" id="invite-qr"></div>
                
                <div class="modal-invite__share">
                    <button onclick="HeaderController.shareLink('${link}')" class="btn btn--primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        Teilen
                    </button>
                </div>
            </div>
        `);
        
        // Generate QR code if library available
        this.generateQRCode('invite-qr', link);
    },
    
    showPartyManageModal() {
        if (!this.isGM) {
            this.showToast('Nur der GM kann die Party verwalten', 'error');
            return;
        }
        
        this.showModal('Party verwalten', `
            <div class="modal-party">
                <p>Verwalte die Spieler in deiner Session:</p>
                <div class="modal-party__list" id="party-manage-list">
                    <p style="color: var(--text-muted);">Lädt Spieler...</p>
                </div>
            </div>
        `);
        
        // Load party members
        this.loadPartyMembersForManagement();
    },
    
    async loadPartyMembersForManagement() {
        const list = document.getElementById('party-manage-list');
        if (!list) return;
        
        // Get from Firebase or localStorage
        const members = this.partyMembers.length ? this.partyMembers : 
            JSON.parse(localStorage.getItem('rift_party_members') || '[]');
        
        if (members.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">Keine Spieler in der Party</p>';
            return;
        }
        
        list.innerHTML = members.map(m => `
            <div class="modal-party__member">
                <div class="modal-party__avatar" style="background: ${m.color || '#8b5cf6'}">${(m.name || '?').charAt(0)}</div>
                <div class="modal-party__info">
                    <div class="modal-party__name">${m.name || 'Unbekannt'}</div>
                    <div class="modal-party__role">${m.role || 'Spieler'}</div>
                </div>
                <div class="modal-party__actions">
                    ${m.role !== 'GM' ? `
                        <button onclick="HeaderController.kickMember('${m.id}')" class="btn btn--small btn--danger">Kicken</button>
                        <button onclick="HeaderController.banMember('${m.id}')" class="btn btn--small btn--danger">Bannen</button>
                    ` : '<span style="color: var(--text-muted);">Game Master</span>'}
                </div>
            </div>
        `).join('');
    },
    
    showMemberActions(name, element) {
        // Show context menu for member
        const existing = document.querySelector('.member-context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'member-context-menu';
        menu.innerHTML = `
            <button onclick="HeaderController.viewProfile('${name}')">Profil ansehen</button>
            <button onclick="HeaderController.sendMessage('${name}')">Nachricht senden</button>
            ${this.isGM ? `
                <div class="divider"></div>
                <button onclick="HeaderController.kickMember('${name}')" class="danger">Kicken</button>
                <button onclick="HeaderController.banMember('${name}')" class="danger">Bannen</button>
            ` : ''}
        `;
        
        const rect = element.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = rect.bottom + 'px';
        menu.style.left = rect.left + 'px';
        document.body.appendChild(menu);
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', handler);
                }
            });
        }, 10);
    },
    
    kickMember(memberId) {
        if (!confirm(`Spieler wirklich kicken?`)) return;
        // TODO: Firebase integration
        this.showToast('Spieler wurde gekickt', 'success');
        this.closeModal();
    },
    
    banMember(memberId) {
        if (!confirm(`Spieler wirklich bannen? Er kann dieser Session nicht mehr beitreten.`)) return;
        // TODO: Firebase integration
        this.showToast('Spieler wurde gebannt', 'success');
        this.closeModal();
    },
    
    // ========================================
    // ROOM CODE
    // ========================================
    
    setupRoomCode() {
        const roomDropdown = document.querySelector('.topnav__dropdown--room');
        if (!roomDropdown) return;
        
        // Copy button
        const copyBtn = roomDropdown.querySelector('.topnav__dropdown-room-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = this.roomCode || roomDropdown.querySelector('code')?.textContent;
                this.copyToClipboard(code);
            });
        }
        
        // Dropdown items
        roomDropdown.querySelectorAll('.topnav__dropdown-item').forEach(item => {
            const text = item.textContent.trim();
            
            if (text.includes('Link teilen')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const code = this.roomCode || 'RTC-GK9';
                    const link = `${window.location.origin}/join.html?code=${code.replace('-', '')}`;
                    this.shareLink(link);
                });
            }
            
            if (text.includes('QR-Code')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showQRCodeModal();
                });
            }
            
            if (text.includes('verlassen')) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.leaveSession();
                });
            }
        });
        
        // Add "Close Room" for GM
        if (this.isGM) {
            const divider = roomDropdown.querySelector('.topnav__dropdown-divider');
            if (divider) {
                const closeBtn = document.createElement('a');
                closeBtn.href = '#';
                closeBtn.className = 'topnav__dropdown-item topnav__dropdown-item--danger';
                closeBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Session beenden
                `;
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeSession();
                });
                divider.parentNode.appendChild(closeBtn);
            }
        }
    },
    
    updateRoomCodeDisplay() {
        const codeElements = document.querySelectorAll('.topnav__room code, .topnav__dropdown-room-code code');
        const formatted = this.roomCode ? 
            this.roomCode.slice(0, 3) + '-' + this.roomCode.slice(3) : 
            'XXX-XXX';
        codeElements.forEach(el => el.textContent = formatted);
    },
    
    showQRCodeModal() {
        const code = this.roomCode || 'RTCGK9';
        const link = `${window.location.origin}/join.html?code=${code.replace('-', '')}`;
        
        this.showModal('QR-Code', `
            <div class="modal-qr">
                <div class="modal-qr__code" id="room-qr"></div>
                <p>Scanne diesen Code um der Session beizutreten</p>
                <code style="font-size: 24px; display: block; text-align: center; margin-top: 16px;">
                    ${code.slice(0, 3)}-${code.slice(3)}
                </code>
            </div>
        `);
        
        this.generateQRCode('room-qr', link);
    },
    
    leaveSession() {
        if (!confirm('Session wirklich verlassen?')) return;
        
        localStorage.removeItem('rift_room_code');
        localStorage.removeItem('rift_current_session');
        this.showToast('Session verlassen', 'info');
        
        // Redirect to sessions page
        setTimeout(() => {
            window.location.href = 'sessions.html';
        }, 1000);
    },
    
    closeSession() {
        if (!this.isGM) {
            this.showToast('Nur der GM kann die Session beenden', 'error');
            return;
        }
        
        if (!confirm('Session wirklich für alle beenden?')) return;
        
        // TODO: Firebase - mark session as closed, kick all players
        localStorage.removeItem('rift_room_code');
        localStorage.removeItem('rift_current_session');
        this.showToast('Session beendet', 'success');
        
        setTimeout(() => {
            window.location.href = 'sessions.html';
        }, 1000);
    },
    
    // ========================================
    // NOTIFICATIONS
    // ========================================
    
    setupNotifications() {
        const bellBtn = document.getElementById('notifications-btn');
        const wrapper = bellBtn?.closest('.topnav__icon-wrapper');
        if (!bellBtn || !wrapper) return;
        
        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'notifications-dropdown';
        dropdown.innerHTML = `
            <div class="notifications-dropdown__header">
                <span>Benachrichtigungen</span>
                <button onclick="HeaderController.markAllRead()">Alle gelesen</button>
            </div>
            <div class="notifications-dropdown__content" id="notifications-list">
                <div class="notifications-dropdown__empty">Keine neuen Benachrichtigungen</div>
            </div>
        `;
        wrapper.appendChild(dropdown);
        
        // Toggle dropdown
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
            this.loadNotifications();
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== bellBtn) {
                dropdown.classList.remove('active');
            }
        });
        
        // Load initial count
        this.updateNotificationBadge();
    },
    
    loadNotifications() {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        
        // Get from localStorage or use defaults
        const notifications = JSON.parse(localStorage.getItem('rift_notifications') || '[]');
        
        if (notifications.length === 0) {
            list.innerHTML = '<div class="notifications-dropdown__empty">Keine neuen Benachrichtigungen</div>';
            return;
        }
        
        list.innerHTML = notifications.slice(0, 10).map(n => `
            <div class="notifications-dropdown__item ${n.read ? '' : 'unread'}" onclick="HeaderController.handleNotificationClick('${n.id}', '${n.action || ''}')">
                <div class="notifications-dropdown__icon">${n.icon || '🔔'}</div>
                <div class="notifications-dropdown__text">
                    <div class="notifications-dropdown__title">${n.title}</div>
                    <div class="notifications-dropdown__time">${this.formatTime(n.timestamp)}</div>
                </div>
            </div>
        `).join('');
    },
    
    updateNotificationBadge() {
        const badge = document.querySelector('.topnav__icon-btn .badge');
        const notifications = JSON.parse(localStorage.getItem('rift_notifications') || '[]');
        const unread = notifications.filter(n => !n.read).length;
        
        if (badge) {
            badge.textContent = unread > 0 ? unread : '';
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    },
    
    addNotification(title, icon = '🔔', action = '') {
        const notifications = JSON.parse(localStorage.getItem('rift_notifications') || '[]');
        notifications.unshift({
            id: Date.now().toString(),
            title,
            icon,
            action,
            timestamp: new Date().toISOString(),
            read: false
        });
        localStorage.setItem('rift_notifications', JSON.stringify(notifications.slice(0, 50)));
        this.updateNotificationBadge();
    },
    
    handleNotificationClick(id, action) {
        // Mark as read
        const notifications = JSON.parse(localStorage.getItem('rift_notifications') || '[]');
        const notif = notifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            localStorage.setItem('rift_notifications', JSON.stringify(notifications));
            this.updateNotificationBadge();
        }
        
        // Execute action
        if (action) {
            window.location.href = action;
        }
    },
    
    markAllRead() {
        const notifications = JSON.parse(localStorage.getItem('rift_notifications') || '[]');
        notifications.forEach(n => n.read = true);
        localStorage.setItem('rift_notifications', JSON.stringify(notifications));
        this.updateNotificationBadge();
        this.loadNotifications();
    },
    
    // ========================================
    // GM SETTINGS
    // ========================================
    
    setupGMSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        if (!settingsBtn) return;
        
        // Add class for later reference
        settingsBtn.classList.add('gm-settings-btn');
        
        // Click handler
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.isGM) {
                this.showGMPanel();
            } else {
                window.location.href = 'user-settings.html';
            }
        });
    },
    
    updateGMVisibility() {
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            // Update title based on GM status
            settingsBtn.title = this.isGM ? 'GM Optionen' : 'Einstellungen';
            
            // Optional: Add visual indicator for GM
            if (this.isGM) {
                settingsBtn.classList.add('is-gm');
            }
        }
        
        // Admin link in profile
        const adminLink = document.querySelector('.topnav__dropdown-item[href="admin.html"]');
        if (adminLink) {
            const userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
            const isAdmin = ['geBL1RI92jUiPrFK1oJ5u2Z25hM2'].includes(userData.uid);
            adminLink.style.display = isAdmin ? 'flex' : 'none';
        }
    },
    
    showGMPanel() {
        this.showModal('GM Optionen', `
            <div class="modal-gm">
                <div class="modal-gm__section">
                    <h4>Session-Kontrolle</h4>
                    <button onclick="HeaderController.broadcastMessage()" class="btn btn--primary" style="width:100%;margin-bottom:8px;">
                        📢 Nachricht an alle
                    </button>
                    <button onclick="HeaderController.pauseSession()" class="btn" style="width:100%;margin-bottom:8px;">
                        ⏸️ Session pausieren
                    </button>
                    <button onclick="HeaderController.showInitiativeTracker()" class="btn" style="width:100%;">
                        ⚔️ Initiative-Tracker
                    </button>
                </div>
                
                <div class="modal-gm__section">
                    <h4>Schnellaktionen</h4>
                    <div class="modal-gm__grid">
                        <button onclick="window.location.href='dice.html'" class="modal-gm__quick">🎲 Würfeln</button>
                        <button onclick="window.location.href='maps.html'" class="modal-gm__quick">🗺️ Maps</button>
                        <button onclick="window.location.href='whiteboard.html'" class="modal-gm__quick">🎨 Whiteboard</button>
                        <button onclick="window.location.href='chat.html'" class="modal-gm__quick">💬 Chat</button>
                    </div>
                </div>
                
                <div class="modal-gm__section">
                    <h4>Spieler-Übersicht</h4>
                    <div id="gm-player-list">Lädt...</div>
                </div>
            </div>
        `);
        
        // Load player list
        this.loadGMPlayerList();
    },
    
    loadGMPlayerList() {
        const list = document.getElementById('gm-player-list');
        if (!list) return;
        
        const members = this.partyMembers.length ? this.partyMembers : 
            JSON.parse(localStorage.getItem('rift_party_members') || '[]');
        
        if (members.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">Keine Spieler</p>';
            return;
        }
        
        list.innerHTML = members.map(m => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
                <div style="width:32px;height:32px;border-radius:50%;background:${m.color || '#8b5cf6'};display:flex;align-items:center;justify-content:center;font-weight:600;">${(m.name || '?').charAt(0)}</div>
                <div style="flex:1;">
                    <div style="font-weight:500;">${m.name}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${m.character || 'Kein Charakter'}</div>
                </div>
                <div style="width:8px;height:8px;border-radius:50%;background:${m.online ? '#22c55e' : '#666'};"></div>
            </div>
        `).join('');
    },
    
    broadcastMessage() {
        const message = prompt('Nachricht an alle Spieler:');
        if (!message) return;
        
        // TODO: Firebase broadcast
        this.showToast('Nachricht gesendet', 'success');
    },
    
    pauseSession() {
        // TODO: Firebase - set session paused state
        this.showToast('Session pausiert', 'info');
    },
    
    showInitiativeTracker() {
        window.location.href = 'initiative.html';
    },
    
    // ========================================
    // PROFILE
    // ========================================
    
    setupProfile() {
        // Profile dropdown is mostly already set up in HTML
        // Just add dynamic content
        const userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
        
        // Update name/email in dropdown
        const userName = document.querySelector('.topnav__dropdown-user-name');
        const userEmail = document.querySelector('.topnav__dropdown-user-email');
        const headerName = document.querySelector('.topnav__user-name');
        
        if (userName) userName.textContent = userData.displayName || 'Spieler';
        if (userEmail) userEmail.textContent = userData.email || '';
        if (headerName) headerName.textContent = userData.displayName || 'Spieler';
        
        // Update avatar
        const avatars = document.querySelectorAll('.topnav__user-avatar, .topnav__dropdown-user-avatar');
        avatars.forEach(av => {
            if (userData.photoURL) {
                av.style.backgroundImage = `url(${userData.photoURL})`;
                av.style.backgroundSize = 'cover';
            }
        });
    },
    
    // ========================================
    // UTILITIES
    // ========================================
    
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Kopiert!', 'success');
        }).catch(() => {
            // Fallback
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            this.showToast('Kopiert!', 'success');
        });
    },
    
    shareLink(url) {
        if (navigator.share) {
            navigator.share({
                title: 'RIFT Session',
                text: 'Tritt meiner RIFT Session bei!',
                url: url
            });
        } else {
            this.copyToClipboard(url);
        }
    },
    
    generateQRCode(containerId, text) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Simple QR code using API
        container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}" alt="QR Code" style="width:200px;height:200px;">`;
    },
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Gerade eben';
        if (diff < 3600000) return `Vor ${Math.floor(diff / 60000)} Min.`;
        if (diff < 86400000) return `Vor ${Math.floor(diff / 3600000)} Std.`;
        return date.toLocaleDateString('de-DE');
    },
    
    showModal(title, content) {
        // Remove existing modal
        const existing = document.querySelector('.header-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.className = 'header-modal';
        modal.innerHTML = `
            <div class="header-modal__backdrop"></div>
            <div class="header-modal__content">
                <div class="header-modal__header">
                    <h3>${title}</h3>
                    <button onclick="HeaderController.closeModal()" class="header-modal__close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="header-modal__body">${content}</div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close on backdrop click
        modal.querySelector('.header-modal__backdrop').addEventListener('click', () => this.closeModal());
        
        // Animate in
        requestAnimationFrame(() => modal.classList.add('active'));
    },
    
    closeModal() {
        const modal = document.querySelector('.header-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 200);
        }
    },
    
    showToast(message, type = 'info') {
        // Use existing toast system if available
        if (typeof ToastService !== 'undefined') {
            ToastService.show(message, type);
            return;
        }
        
        // Fallback toast
        const toast = document.createElement('div');
        toast.className = `header-toast header-toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('active'));
        
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    HeaderController.init();
});

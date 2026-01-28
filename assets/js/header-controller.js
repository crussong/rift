/**
 * RIFT Header Controller v2 - Simplified
 */

const HeaderController = {
    isGM: false,
    roomCode: 'RTCGK9',
    
    init() {
        this.loadState();
        this.setupSearch();
        this.setupRoomCode();
        this.setupNotifications();
        this.setupSettings();
        this.updatePartyFromFirebase();
        console.log('[Header] Init done, isGM:', this.isGM);
    },
    
    loadState() {
        this.roomCode = localStorage.getItem('rift_room_code') || 'RTCGK9';
        const session = JSON.parse(localStorage.getItem('rift_current_session') || '{}');
        const user = JSON.parse(localStorage.getItem('rift_user') || '{}');
        this.isGM = session.gmId === user.uid;
    },
    
    // ========================================
    // SEARCH
    // ========================================
    
    setupSearch() {
        const container = document.querySelector('.topnav__search');
        const input = container?.querySelector('input');
        if (!container || !input) return;
        
        // Create dropdown
        let dropdown = document.getElementById('search-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'search-dropdown';
            dropdown.id = 'search-dropdown';
            container.appendChild(dropdown);
        }
        
        // Static search items
        this.searchItems = [
            { type: 'Seiten', name: 'Würfel', url: 'dice.html', icon: '🎲' },
            { type: 'Seiten', name: 'Whiteboard', url: 'whiteboard.html', icon: '🎨' },
            { type: 'Seiten', name: 'Maps', url: 'maps.html', icon: '🗺️' },
            { type: 'Seiten', name: 'Chat', url: 'chat.html', icon: '💬' },
            { type: 'Seiten', name: 'Sessions', url: 'sessions.html', icon: '📅' },
            { type: 'Seiten', name: 'Charaktere', url: 'sheet.html', icon: '👤' },
            { type: 'Seiten', name: 'Einstellungen', url: 'user-settings.html', icon: '⚙️' },
            { type: 'Regelwerke', name: 'D&D 5e (2024)', url: 'sheet-dnd5e.html', icon: '📖' },
            { type: 'Regelwerke', name: 'Worlds Apart', url: 'sheet-worldsapart.html', icon: '📖' },
            { type: 'Regelwerke', name: 'Cyberpunk Red', url: 'sheet-cyberpunk.html', icon: '📖' },
            { type: 'Regelwerke', name: 'How To Be A Hero', url: 'sheet-htbah.html', icon: '📖' },
        ];
        
        let timeout;
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this.doSearch(e.target.value), 100);
        });
        
        input.addEventListener('focus', () => {
            if (input.value.length > 0) this.doSearch(input.value);
        });
        
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    },
    
    doSearch(query) {
        const dropdown = document.getElementById('search-dropdown');
        if (!dropdown || !query || query.length < 1) {
            dropdown?.classList.remove('active');
            return;
        }
        
        const q = query.toLowerCase();
        let results = [];
        
        // Static items
        this.searchItems.forEach(item => {
            if (item.name.toLowerCase().includes(q)) results.push(item);
        });
        
        // Characters from localStorage
        try {
            const chars = JSON.parse(localStorage.getItem('rift_characters') || '[]');
            if (Array.isArray(chars)) {
                chars.forEach(c => {
                    if (c.name?.toLowerCase().includes(q)) {
                        results.push({ type: 'Charaktere', name: c.name, url: `sheet.html?id=${c.id}`, icon: '🧙', meta: `${c.race||''} ${c.class||''}` });
                    }
                });
            }
        } catch(e) {}
        
        // Sessions from localStorage
        try {
            const sessions = JSON.parse(localStorage.getItem('rift_sessions') || '[]');
            if (Array.isArray(sessions)) {
                sessions.forEach(s => {
                    if (s.name?.toLowerCase().includes(q)) {
                        results.push({ type: 'Sessions', name: s.name, url: `session.html?id=${s.id}`, icon: '🎮', meta: s.ruleset||'' });
                    }
                });
            }
        } catch(e) {}
        
        // Render
        if (results.length === 0) {
            dropdown.innerHTML = `<div class="search-dropdown__empty">Keine Ergebnisse für "${query}"</div>`;
        } else {
            const groups = {};
            results.forEach(r => { if (!groups[r.type]) groups[r.type] = []; groups[r.type].push(r); });
            
            let html = '';
            for (const [type, items] of Object.entries(groups)) {
                html += `<div class="search-dropdown__group"><div class="search-dropdown__label">${type}</div>`;
                items.slice(0,5).forEach(item => {
                    html += `<a href="${item.url}" class="search-dropdown__item">
                        <span class="search-dropdown__icon">${item.icon}</span>
                        <div class="search-dropdown__info">
                            <div class="search-dropdown__name">${item.name}</div>
                            ${item.meta ? `<div class="search-dropdown__meta">${item.meta}</div>` : ''}
                        </div>
                    </a>`;
                });
                html += '</div>';
            }
            dropdown.innerHTML = html;
        }
        dropdown.classList.add('active');
    },
    
    // ========================================
    // PARTY - Aus Firebase laden
    // ========================================
    
    updatePartyFromFirebase() {
        // Warte auf HubController
        if (typeof HubController !== 'undefined' && HubController.partyMembers?.length > 0) {
            this.renderParty(HubController.partyMembers);
        } else {
            // Retry nach kurzer Zeit
            setTimeout(() => {
                if (typeof HubController !== 'undefined' && HubController.partyMembers?.length > 0) {
                    this.renderParty(HubController.partyMembers);
                }
            }, 2000);
        }
    },
    
    renderParty(members) {
        if (!members || members.length === 0) return;
        
        // Avatars
        const avatars = document.querySelector('.topnav__party-avatars');
        if (avatars) {
            avatars.innerHTML = members.slice(0,3).map(m => 
                `<div class="topnav__party-avatar" style="background:${m.color||'#8b5cf6'}">${(m.name||'?')[0]}</div>`
            ).join('');
        }
        
        // Online count
        const online = members.filter(m => m.online).length;
        const status = document.querySelector('.topnav__party-status');
        if (status) status.textContent = `${online} Online`;
        
        // Dropdown header
        const header = document.querySelector('.topnav__dropdown--party .topnav__dropdown-value');
        if (header) header.textContent = `${online} von ${members.length} online`;
        
        // Dropdown title
        const title = document.querySelector('.topnav__dropdown--party .topnav__dropdown-title');
        if (title && members[0]?.partyName) title.textContent = members[0].partyName;
        
        // Member list
        const body = document.querySelector('.topnav__dropdown--party .topnav__dropdown-body');
        if (body) {
            let html = members.map(m => `
                <div class="topnav__dropdown-member">
                    <div class="topnav__dropdown-member-avatar" style="background:${m.color||'#8b5cf6'}">${(m.name||'?')[0]}</div>
                    <div class="topnav__dropdown-member-info">
                        <div class="topnav__dropdown-member-name">${m.name||'Unbekannt'}</div>
                        <div class="topnav__dropdown-member-role">${m.role||'Spieler'}</div>
                    </div>
                    <div class="topnav__dropdown-member-status${m.online?'':' topnav__dropdown-member-status--offline'}"></div>
                </div>
            `).join('');
            
            html += `<div class="topnav__dropdown-divider"></div>
                <a href="#" class="topnav__dropdown-item" onclick="HeaderController.showInvite();return false;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    Spieler einladen
                </a>
                <a href="#" class="topnav__dropdown-item" onclick="HeaderController.showManage();return false;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Party verwalten
                </a>`;
            body.innerHTML = html;
        }
    },
    
    showInvite() {
        const code = this.roomCode;
        const fmt = code.length === 6 ? `${code.slice(0,3)}-${code.slice(3)}` : code;
        const link = `${location.origin}/join.html?code=${code}`;
        
        this.modal('Spieler einladen', `
            <p style="margin-bottom:16px;color:var(--text-muted)">Teile diesen Code mit deinen Spielern:</p>
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <span style="font-family:monospace;font-size:28px;font-weight:700;letter-spacing:3px;">${fmt}</span>
                <button class="btn btn--primary" onclick="HeaderController.copy('${code}')">Kopieren</button>
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px;">Einladungslink:</label>
                <div style="display:flex;gap:8px;">
                    <input readonly value="${link}" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;">
                    <button class="btn" onclick="HeaderController.copy('${link}')">Kopieren</button>
                </div>
            </div>
            <div style="text-align:center;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}" style="background:#fff;padding:8px;border-radius:8px;">
                <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">QR-Code scannen</p>
            </div>
        `);
    },
    
    showManage() {
        if (!this.isGM) {
            this.toast('Nur der GM kann die Party verwalten', 'error');
            return;
        }
        
        const members = (typeof HubController !== 'undefined') ? HubController.partyMembers : [];
        
        let html = members.length === 0 
            ? '<p style="color:var(--text-muted)">Keine Spieler</p>'
            : members.map(m => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:8px;margin-bottom:8px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:${m.color||'#8b5cf6'};display:flex;align-items:center;justify-content:center;font-weight:600;">${(m.name||'?')[0]}</div>
                    <div style="flex:1;"><div style="font-weight:500;">${m.name}</div><div style="font-size:12px;color:var(--text-muted);">${m.role||'Spieler'}</div></div>
                    ${m.role!=='GM'&&m.role!=='Game Master' ? `<button class="btn btn--small" style="background:#ef4444;" onclick="HeaderController.kick('${m.uid}')">Kick</button>` : '<span style="color:var(--accent);font-size:11px;">GM</span>'}
                </div>
            `).join('');
        
        this.modal('Party verwalten', `<p style="margin-bottom:16px;"><strong>${members.length}</strong> Spieler</p>${html}`);
    },
    
    kick(uid) {
        if (!confirm('Spieler kicken?')) return;
        this.toast('Spieler gekickt', 'success');
        this.closeModal();
    },
    
    // ========================================
    // ROOM CODE
    // ========================================
    
    setupRoomCode() {
        // Copy button
        const copyBtn = document.querySelector('.topnav__dropdown-room-copy');
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                this.copy(this.roomCode);
            };
        }
        
        // Share link
        document.querySelectorAll('.topnav__dropdown--room .topnav__dropdown-item').forEach(item => {
            if (item.textContent.includes('Link teilen')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    const link = `${location.origin}/join.html?code=${this.roomCode}`;
                    if (navigator.share) navigator.share({title:'RIFT Session',url:link});
                    else this.copy(link);
                };
            }
            if (item.textContent.includes('QR-Code')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    const link = `${location.origin}/join.html?code=${this.roomCode}`;
                    const fmt = this.roomCode.length===6 ? `${this.roomCode.slice(0,3)}-${this.roomCode.slice(3)}` : this.roomCode;
                    this.modal('QR-Code', `<div style="text-align:center;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}" style="background:#fff;padding:12px;border-radius:8px;"><p style="margin-top:12px;">Code: <strong>${fmt}</strong></p></div>`);
                };
            }
            if (item.textContent.includes('verlassen')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    if (confirm('Session verlassen?')) {
                        localStorage.removeItem('rift_room_code');
                        localStorage.removeItem('rift_current_session');
                        this.toast('Session verlassen', 'info');
                        setTimeout(() => location.href = 'sessions.html', 1000);
                    }
                };
            }
        });
    },
    
    copy(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.toast('✓ Kopiert!', 'success');
        }).catch(() => {
            const i = document.createElement('input');
            i.value = text;
            document.body.appendChild(i);
            i.select();
            document.execCommand('copy');
            document.body.removeChild(i);
            this.toast('✓ Kopiert!', 'success');
        });
    },
    
    // ========================================
    // NOTIFICATIONS
    // ========================================
    
    setupNotifications() {
        const btn = document.getElementById('notifications-btn');
        const wrapper = btn?.closest('.topnav__icon-wrapper');
        if (!btn || !wrapper) return;
        
        // Remove existing dropdown
        wrapper.querySelector('.notifications-dropdown')?.remove();
        
        const dropdown = document.createElement('div');
        dropdown.className = 'notifications-dropdown';
        dropdown.innerHTML = `
            <div class="notifications-dropdown__header">
                <span>Benachrichtigungen</span>
                <button onclick="HeaderController.clearNotifs()">Löschen</button>
            </div>
            <div class="notifications-dropdown__content">
                <div class="notifications-dropdown__empty">Keine neuen Benachrichtigungen</div>
            </div>
        `;
        wrapper.appendChild(dropdown);
        
        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        };
        
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) dropdown.classList.remove('active');
        });
    },
    
    clearNotifs() {
        localStorage.removeItem('rift_notifications');
        const badge = document.querySelector('#notifications-btn .badge');
        if (badge) badge.style.display = 'none';
        this.toast('Benachrichtigungen gelöscht', 'info');
    },
    
    // ========================================
    // SETTINGS (Zahnrad)
    // ========================================
    
    setupSettings() {
        const btn = document.getElementById('settings-btn');
        if (!btn) return;
        
        if (this.isGM) {
            btn.style.display = 'flex';
            btn.title = 'GM Optionen';
            btn.onclick = () => location.href = 'gm.html';
        } else {
            // Spieler: komplett ausblenden
            btn.style.display = 'none';
        }
    },
    
    // ========================================
    // UTILS
    // ========================================
    
    modal(title, content) {
        document.querySelector('.header-modal')?.remove();
        const m = document.createElement('div');
        m.className = 'header-modal active';
        m.innerHTML = `
            <div class="header-modal__backdrop" onclick="HeaderController.closeModal()"></div>
            <div class="header-modal__content">
                <div class="header-modal__header">
                    <h3>${title}</h3>
                    <button onclick="HeaderController.closeModal()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="header-modal__body">${content}</div>
            </div>
        `;
        document.body.appendChild(m);
    },
    
    closeModal() {
        document.querySelector('.header-modal')?.remove();
    },
    
    toast(msg, type='info') {
        if (typeof ToastService !== 'undefined') {
            ToastService.show(msg, type);
            return;
        }
        document.querySelector('.header-toast')?.remove();
        const t = document.createElement('div');
        t.className = `header-toast header-toast--${type} active`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.classList.remove('active'); setTimeout(() => t.remove(), 200); }, 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => HeaderController.init());

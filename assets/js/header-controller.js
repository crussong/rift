/**
 * RIFT Header Controller v3
 * Einfach, funktional, kein Bullshit
 */

const HeaderController = {
    
    init() {
        console.log('[Header] Init...');
        this.setupSearch();
        this.setupPartyButtons();
        this.setupRoomButtons();
        this.setupNotifications();
        this.setupSettingsButton();
        
        // Warte auf HubController dann update Party
        setTimeout(() => this.updatePartyDisplay(), 1500);
        setTimeout(() => this.updatePartyDisplay(), 3000);
    },
    
    // ========================================
    // SEARCH - Einfach und funktional
    // ========================================
    
    setupSearch() {
        const container = document.querySelector('.topnav__search');
        const input = container?.querySelector('input');
        if (!container || !input) return;
        
        // Dropdown erstellen
        const dropdown = document.createElement('div');
        dropdown.className = 'search-dropdown';
        dropdown.id = 'search-dropdown';
        container.appendChild(dropdown);
        
        // Suchbare Items
        this.searchData = [
            { cat: 'Seiten', name: 'Würfel', url: 'dice.html', icon: '🎲' },
            { cat: 'Seiten', name: 'Whiteboard', url: 'whiteboard.html', icon: '🎨' },
            { cat: 'Seiten', name: 'Maps', url: 'maps.html', icon: '🗺️' },
            { cat: 'Seiten', name: 'Chat', url: 'chat.html', icon: '💬' },
            { cat: 'Seiten', name: 'Sessions', url: 'sessions.html', icon: '📅' },
            { cat: 'Seiten', name: 'Charaktere', url: 'sheet.html', icon: '👤' },
            { cat: 'Seiten', name: 'Einstellungen', url: 'user-settings.html', icon: '⚙️' },
            { cat: 'Regelwerke', name: 'D&D 5e (2024)', url: 'sheet-dnd5e.html', icon: '📕' },
            { cat: 'Regelwerke', name: 'Worlds Apart', url: 'sheet-worldsapart.html', icon: '📗' },
            { cat: 'Regelwerke', name: 'Cyberpunk Red', url: 'sheet-cyberpunk.html', icon: '📘' },
            { cat: 'Regelwerke', name: 'How To Be A Hero', url: 'sheet-htbah.html', icon: '📙' },
        ];
        
        // Input Event
        input.addEventListener('input', (e) => this.doSearch(e.target.value));
        input.addEventListener('focus', (e) => { if(e.target.value) this.doSearch(e.target.value); });
        
        // Außerhalb klicken schließt
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) dropdown.classList.remove('active');
        });
    },
    
    doSearch(q) {
        const dropdown = document.getElementById('search-dropdown');
        if (!dropdown) return;
        
        if (!q || q.length < 1) {
            dropdown.classList.remove('active');
            return;
        }
        
        const query = q.toLowerCase();
        let results = this.searchData.filter(item => item.name.toLowerCase().includes(query));
        
        // Auch Charaktere durchsuchen
        try {
            const chars = JSON.parse(localStorage.getItem('rift_characters') || '[]');
            chars.forEach(c => {
                if (c.name?.toLowerCase().includes(query)) {
                    results.push({ cat: 'Charaktere', name: c.name, url: `sheet.html?id=${c.id}`, icon: '🧙' });
                }
            });
        } catch(e) {}
        
        // Sessions durchsuchen
        try {
            const sessions = JSON.parse(localStorage.getItem('rift_sessions') || '[]');
            sessions.forEach(s => {
                if (s.name?.toLowerCase().includes(query)) {
                    results.push({ cat: 'Sessions', name: s.name, url: `session.html?id=${s.id}`, icon: '🎮' });
                }
            });
        } catch(e) {}
        
        // Rendern
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="search-dropdown__empty">Keine Ergebnisse</div>';
        } else {
            // Gruppieren
            const groups = {};
            results.forEach(r => {
                if (!groups[r.cat]) groups[r.cat] = [];
                groups[r.cat].push(r);
            });
            
            let html = '';
            for (const [cat, items] of Object.entries(groups)) {
                html += `<div class="search-dropdown__group">
                    <div class="search-dropdown__label">${cat}</div>
                    ${items.slice(0,5).map(i => `
                        <a href="${i.url}" class="search-dropdown__item">
                            <span class="search-dropdown__icon">${i.icon}</span>
                            <span class="search-dropdown__name">${i.name}</span>
                        </a>
                    `).join('')}
                </div>`;
            }
            dropdown.innerHTML = html;
        }
        
        dropdown.classList.add('active');
    },
    
    // ========================================
    // PARTY DISPLAY - Aus HubController
    // ========================================
    
    // Wird von HubController aufgerufen
    renderParty(members) {
        this.updatePartyDisplay(members);
    },
    
    updatePartyDisplay(membersArg) {
        // Hole Daten - entweder aus Argument oder aus HubController
        const members = membersArg || 
            ((typeof HubController !== 'undefined' && Array.isArray(HubController.partyMembers)) 
                ? HubController.partyMembers : []);
        
        console.log('[Header] Party members:', members.length);
        
        // Avatars
        const avatarDiv = document.querySelector('.topnav__party-avatars');
        if (avatarDiv) {
            if (members.length > 0) {
                avatarDiv.innerHTML = members.slice(0,3).map(m => 
                    `<div class="topnav__party-avatar" style="background:${m.color||'#8b5cf6'}">${(m.name||'?')[0]}</div>`
                ).join('');
            } else {
                avatarDiv.innerHTML = '<div class="topnav__party-avatar" style="background:#666">?</div>';
            }
        }
        
        // Status Text
        const statusEl = document.querySelector('.topnav__party-status');
        if (statusEl) {
            const online = members.filter(m => m.online !== false).length;
            statusEl.textContent = members.length > 0 ? `${online} Online` : '-';
        }
        
        // Dropdown Header
        const titleEl = document.querySelector('.topnav__dropdown--party .topnav__dropdown-title');
        const valueEl = document.querySelector('.topnav__dropdown--party .topnav__dropdown-value');
        if (titleEl) titleEl.textContent = members.length > 0 ? 'Aktive Party' : 'Party';
        if (valueEl) valueEl.textContent = members.length > 0 ? `${members.length} Spieler` : '-';
        
        // Dropdown Body - Members
        const emptyEl = document.querySelector('.topnav__dropdown--party .topnav__dropdown-empty');
        if (emptyEl) {
            if (members.length > 0) {
                // Ersetze "Keine aktive Session" mit Member-Liste
                let html = members.map(m => `
                    <div class="topnav__dropdown-member">
                        <div class="topnav__dropdown-member-avatar" style="background:${m.color||'#8b5cf6'}">${(m.name||'?')[0]}</div>
                        <div class="topnav__dropdown-member-info">
                            <div class="topnav__dropdown-member-name">${m.name||'Unbekannt'}</div>
                            <div class="topnav__dropdown-member-role">${m.role||'Spieler'}</div>
                        </div>
                        <div class="topnav__dropdown-member-status${m.online===false?' topnav__dropdown-member-status--offline':''}"></div>
                    </div>
                `).join('');
                emptyEl.outerHTML = html;
            }
        }
    },
    
    // ========================================
    // PARTY BUTTONS
    // ========================================
    
    setupPartyButtons() {
        // Einladen Button
        document.querySelectorAll('.topnav__dropdown--party .topnav__dropdown-item').forEach(btn => {
            if (btn.textContent.includes('einladen')) {
                btn.onclick = (e) => { e.preventDefault(); this.showInviteModal(); };
            }
            if (btn.textContent.includes('verwalten')) {
                btn.onclick = (e) => { e.preventDefault(); this.showManageModal(); };
            }
        });
    },
    
    showInviteModal() {
        const code = localStorage.getItem('rift_room_code') || 'XXXXXX';
        const formatted = code.length >= 6 ? code.slice(0,3) + '-' + code.slice(3,6) : code;
        const link = `${location.origin}/join.html?code=${code}`;
        
        this.showModal('Spieler einladen', `
            <p style="color:var(--text-muted);margin-bottom:20px;">Teile diesen Code mit deinen Mitspielern:</p>
            
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
                <div style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:6px;margin-bottom:12px;">${formatted}</div>
                <button onclick="HeaderController.copyText('${code}')" class="btn btn--primary">Code kopieren</button>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:8px;">Einladungslink:</label>
                <div style="display:flex;gap:8px;">
                    <input type="text" value="${link}" readonly style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text);font-size:13px;">
                    <button onclick="HeaderController.copyText('${link}')" class="btn">Kopieren</button>
                </div>
            </div>
            
            <div style="text-align:center;background:var(--bg);padding:20px;border-radius:12px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}" style="border-radius:8px;">
                <p style="font-size:12px;color:var(--text-muted);margin-top:12px;">QR-Code scannen zum Beitreten</p>
            </div>
        `);
    },
    
    showManageModal() {
        const members = (typeof HubController !== 'undefined' && Array.isArray(HubController.partyMembers)) 
            ? HubController.partyMembers : [];
        const isGM = this.checkIfGM();
        
        if (!isGM) {
            this.showToast('Nur der GM kann die Party verwalten', 'error');
            return;
        }
        
        let content = '';
        if (members.length === 0) {
            content = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Keine Spieler in der Party</p>';
        } else {
            content = members.map(m => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:8px;margin-bottom:8px;">
                    <div style="width:40px;height:40px;border-radius:50%;background:${m.color||'#8b5cf6'};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px;">${(m.name||'?')[0]}</div>
                    <div style="flex:1;">
                        <div style="font-weight:500;">${m.name||'Unbekannt'}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${m.role||'Spieler'}</div>
                    </div>
                    ${m.role !== 'GM' && m.role !== 'Game Master' ? 
                        `<button onclick="HeaderController.kickPlayer('${m.uid||m.id}')" class="btn btn--small" style="background:#ef4444;">Kicken</button>` : 
                        '<span style="color:var(--accent);font-size:12px;font-weight:600;">GM</span>'}
                </div>
            `).join('');
        }
        
        this.showModal('Party verwalten', `
            <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
                <span><strong>${members.length}</strong> Spieler in der Party</span>
            </div>
            ${content}
        `);
    },
    
    kickPlayer(uid) {
        if (!confirm('Spieler wirklich aus der Party entfernen?')) return;
        // TODO: Firebase kick implementieren
        this.showToast('Spieler wurde entfernt', 'success');
        this.closeModal();
    },
    
    // ========================================
    // ROOM CODE BUTTONS
    // ========================================
    
    setupRoomButtons() {
        // Copy Button
        const copyBtn = document.querySelector('.topnav__dropdown-room-copy');
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                const code = localStorage.getItem('rift_room_code') || 'RTCGK9';
                this.copyText(code);
            };
        }
        
        // Dropdown Items
        document.querySelectorAll('.topnav__dropdown--room .topnav__dropdown-item').forEach(item => {
            const text = item.textContent;
            
            if (text.includes('Link teilen')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    const code = localStorage.getItem('rift_room_code') || 'RTCGK9';
                    const link = `${location.origin}/join.html?code=${code}`;
                    if (navigator.share) {
                        navigator.share({ title: 'RIFT Session beitreten', url: link });
                    } else {
                        this.copyText(link);
                    }
                };
            }
            
            if (text.includes('QR-Code')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    const code = localStorage.getItem('rift_room_code') || 'RTCGK9';
                    const link = `${location.origin}/join.html?code=${code}`;
                    const formatted = code.length >= 6 ? code.slice(0,3) + '-' + code.slice(3,6) : code;
                    this.showModal('QR-Code', `
                        <div style="text-align:center;">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}" style="border-radius:8px;margin-bottom:16px;">
                            <p style="font-size:14px;">Session-Code: <strong style="font-family:monospace;font-size:18px;">${formatted}</strong></p>
                        </div>
                    `);
                };
            }
            
            if (text.includes('verlassen')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    if (!confirm('Session wirklich verlassen?')) return;
                    localStorage.removeItem('rift_room_code');
                    localStorage.removeItem('rift_current_session');
                    this.showToast('Session verlassen', 'info');
                    setTimeout(() => location.href = 'sessions.html', 1000);
                };
            }
        });
    },
    
    // ========================================
    // NOTIFICATIONS
    // ========================================
    
    setupNotifications() {
        const btn = document.getElementById('notifications-btn');
        const wrapper = btn?.closest('.topnav__icon-wrapper');
        if (!btn || !wrapper) return;
        
        // Altes Dropdown entfernen falls vorhanden
        wrapper.querySelector('.notifications-dropdown')?.remove();
        
        // Neues Dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'notifications-dropdown';
        dropdown.innerHTML = `
            <div class="notifications-dropdown__header">
                <span>Benachrichtigungen</span>
                <button onclick="HeaderController.clearNotifications()">Löschen</button>
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
    
    clearNotifications() {
        this.showToast('Benachrichtigungen gelöscht', 'info');
    },
    
    // ========================================
    // SETTINGS BUTTON (Zahnrad)
    // ========================================
    
    setupSettingsButton() {
        const btn = document.getElementById('settings-btn');
        if (!btn) return;
        
        // Immer anzeigen - führt zu verschiedenen Seiten je nach Status
        btn.style.display = 'flex';
        
        // Nach kurzer Zeit GM-Status prüfen und anpassen
        setTimeout(() => {
            const isGM = this.checkIfGM();
            console.log('[Header] GM check result:', isGM);
            
            if (isGM) {
                btn.title = 'GM Optionen';
                btn.onclick = () => location.href = 'gm.html';
            } else {
                // Für Nicht-GMs: verstecken oder zu Einstellungen
                btn.title = 'Einstellungen';
                btn.onclick = () => location.href = 'user-settings.html';
                // Optional: verstecken für Nicht-GMs
                // btn.style.display = 'none';
            }
        }, 2000);
    },
    
    checkIfGM() {
        let isGM = false;
        
        // Methode 1: Aus localStorage Session
        try {
            const user = JSON.parse(localStorage.getItem('rift_user') || '{}');
            const session = JSON.parse(localStorage.getItem('rift_current_session') || '{}');
            
            console.log('[Header] GM Check - User UID:', user.uid);
            console.log('[Header] GM Check - Session gmId:', session.gmId);
            console.log('[Header] GM Check - Session createdBy:', session.createdBy);
            
            if (user.uid && (session.gmId === user.uid || session.createdBy === user.uid)) {
                isGM = true;
            }
        } catch(e) {
            console.log('[Header] GM Check localStorage error:', e);
        }
        
        // Methode 2: Aus HubController
        if (!isGM && typeof HubController !== 'undefined') {
            try {
                const uid = HubController.userData?.uid;
                const session = JSON.parse(localStorage.getItem('rift_current_session') || '{}');
                
                if (uid && (session.gmId === uid || session.createdBy === uid)) {
                    isGM = true;
                }
                
                // Auch Party Members prüfen
                if (!isGM && Array.isArray(HubController.partyMembers)) {
                    const me = HubController.partyMembers.find(m => m.uid === uid);
                    if (me && (me.role === 'GM' || me.role === 'Game Master' || me.isGM)) {
                        isGM = true;
                    }
                }
            } catch(e) {
                console.log('[Header] GM Check HubController error:', e);
            }
        }
        
        // Methode 3: Wenn roomCode existiert und User es erstellt hat
        if (!isGM) {
            try {
                const roomCode = localStorage.getItem('rift_room_code');
                const roomCreator = localStorage.getItem('rift_room_creator');
                const user = JSON.parse(localStorage.getItem('rift_user') || '{}');
                
                if (roomCode && roomCreator && user.uid === roomCreator) {
                    isGM = true;
                }
            } catch(e) {}
        }
        
        console.log('[Header] Final GM status:', isGM);
        return isGM;
    },
    
    // ========================================
    // UTILITIES
    // ========================================
    
    copyText(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('✓ Kopiert!', 'success');
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showToast('✓ Kopiert!', 'success');
        });
    },
    
    showModal(title, content) {
        this.closeModal();
        
        const modal = document.createElement('div');
        modal.className = 'header-modal';
        modal.innerHTML = `
            <div class="header-modal__backdrop"></div>
            <div class="header-modal__content">
                <div class="header-modal__header">
                    <h3>${title}</h3>
                    <button class="header-modal__close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="header-modal__body">${content}</div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event Listeners
        modal.querySelector('.header-modal__backdrop').onclick = () => this.closeModal();
        modal.querySelector('.header-modal__close').onclick = () => this.closeModal();
        
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
        // Benutze ToastService wenn vorhanden
        if (typeof ToastService !== 'undefined') {
            ToastService.show(message, type);
            return;
        }
        
        // Fallback Toast
        document.querySelector('.header-toast')?.remove();
        
        const toast = document.createElement('div');
        toast.className = `header-toast header-toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.add('active'));
        
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 200);
        }, 2500);
    }
};

// Start wenn DOM ready
document.addEventListener('DOMContentLoaded', () => HeaderController.init());

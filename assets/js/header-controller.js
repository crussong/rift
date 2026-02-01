/**
 * RIFT Header Controller v6
 * NUR UI-Rendering - nutzt bestehende Services
 * 
 * Datenquellen:
 * - HubController.partyMembers (aus Firebase geladen)
 * - HubController.roomCode (aktueller Raum)
 * - HubController.userData (aktueller User)
 * - RIFT.rooms.isUserGM() für GM-Check
 */

const HeaderController = {
    
    init() {
        console.log('[Header] Init v6 - Using existing services');
        
        this.setupSearch();
        this.setupPartyButtons();
        this.setupRoomButtons();
        this.setupNotifications();
        
        // Warte auf HubController dann render
        this.waitForData();
    },
    
    waitForData() {
        const tryRender = async () => {
            if (typeof HubController !== 'undefined') {
                // Party rendern wenn Daten da
                if (HubController.partyMembers?.length > 0) {
                    this.renderParty(HubController.partyMembers);
                }
                
                // GM-Button updaten
                await this.updateGMButton();
            }
        };
        
        // Mehrere Versuche
        setTimeout(tryRender, 500);
        setTimeout(tryRender, 1500);
        setTimeout(tryRender, 3000);
    },
    
    // ========================================
    // PARTY RENDERING (wird von HubController aufgerufen)
    // ========================================
    
    renderParty(members) {
        if (!Array.isArray(members) || members.length === 0) {
            console.log('[Header] renderParty: No members');
            return;
        }
        
        console.log('[Header] renderParty:', members.length, 'members');
        
        // Online Count im Header
        const statusEl = document.querySelector('.topnav__party-status, #partyOnlineCount');
        if (statusEl) {
            const online = members.filter(m => m.online !== false).length;
            statusEl.textContent = `${online} Online`;
        }
        
        // Dropdown Header Value
        const titleEl = document.querySelector('.topnav__dropdown--party .topnav__dropdown-title');
        const valueEl = document.querySelector('.topnav__dropdown--party .topnav__dropdown-value, #partyHeaderValue');
        if (titleEl) titleEl.textContent = 'Party';
        if (valueEl) valueEl.textContent = `${members.length} Spieler`;
        
        // Dropdown Body - Member Liste
        const bodyEl = document.querySelector('#partyMembersList');
        if (bodyEl) {
            bodyEl.innerHTML = members.map(m => `
                <div class="topnav__dropdown-member">
                    <div class="topnav__dropdown-member-avatar" style="background:${m.color || '#8b5cf6'}">
                        ${m.avatar ? `<img src="${m.avatar}" alt="">` : (m.name || m.displayName || '?')[0].toUpperCase()}
                    </div>
                    <div class="topnav__dropdown-member-info">
                        <div class="topnav__dropdown-member-name">${m.name || m.displayName || 'Unbekannt'}</div>
                        <div class="topnav__dropdown-member-role">${m.role === 'gm' ? 'Spielleiter' : 'Spieler'}</div>
                    </div>
                    <div class="topnav__dropdown-member-status${m.online === false ? ' topnav__dropdown-member-status--offline' : ''}"></div>
                </div>
            `).join('');
        }
    },
    
    // ========================================
    // GM BUTTON
    // ========================================
    
    async updateGMButton() {
        const btn = document.getElementById('settings-btn');
        if (!btn) return;
        
        let isGM = false;
        
        // Nutze RIFT.rooms.isUserGM wenn verfügbar
        if (typeof RIFT !== 'undefined' && RIFT.rooms?.isUserGM && HubController?.roomCode) {
            try {
                isGM = await RIFT.rooms.isUserGM(HubController.roomCode);
                console.log('[Header] GM check via RIFT.rooms:', isGM);
            } catch (e) {
                console.log('[Header] GM check error:', e);
            }
        }
        
        // Fallback: Prüfe partyMembers
        if (!isGM && HubController?.partyMembers?.length > 0 && HubController?.userData?.uid) {
            const me = HubController.partyMembers.find(m => m.userId === HubController.userData.uid || m.id === HubController.userData.uid);
            if (me && me.role === 'gm') {
                isGM = true;
                console.log('[Header] GM check via partyMembers:', isGM);
            }
        }
        
        if (isGM) {
            btn.style.display = 'flex';
            btn.title = 'GM Optionen';
            btn.onclick = () => location.href = 'gm.html';
        } else {
            btn.style.display = 'none';
        }
    },
    
    // ========================================
    // PARTY BUTTONS
    // ========================================
    
    setupPartyButtons() {
        document.querySelectorAll('.topnav__dropdown--party .topnav__dropdown-item').forEach(btn => {
            const action = btn.dataset.action || (btn.textContent.includes('einladen') ? 'invite' : btn.textContent.includes('verwalten') ? 'manage' : '');
            
            if (action === 'invite') {
                btn.onclick = (e) => { e.preventDefault(); this.showInviteModal(); };
            }
            if (action === 'manage') {
                btn.onclick = (e) => { e.preventDefault(); this.showManageModal(); };
            }
        });
    },
    
    async showInviteModal() {
        const code = HubController?.roomCode || localStorage.getItem('rift_current_room');
        
        if (!code) {
            this.showToast('Kein aktiver Raum', 'error');
            return;
        }
        
        const formatted = RIFT?.rooms?.formatRoomCode ? RIFT.rooms.formatRoomCode(code) : code;
        const link = `${location.origin}/join.html?code=${code}`;
        
        this.showModal('Spieler einladen', `
            <p style="color:rgba(255,255,255,0.6);margin-bottom:24px;">Teile diesen Code mit deinen Mitspielern:</p>
            
            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
                <div style="font-family:monospace;font-size:42px;font-weight:700;letter-spacing:6px;margin-bottom:20px;">${formatted}</div>
                <button style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#FF4655;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;" onclick="HeaderController.copyText('${code}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Code kopieren
                </button>
            </div>
            
            <div style="margin-bottom:24px;">
                <label style="font-size:12px;color:rgba(255,255,255,0.5);display:block;margin-bottom:8px;">Einladungslink:</label>
                <div style="display:flex;gap:8px;">
                    <input type="text" value="${link}" readonly style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px;color:#fff;font-size:13px;">
                    <button style="padding:12px 20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-weight:500;cursor:pointer;" onclick="HeaderController.copyText('${link}')">Kopieren</button>
                </div>
            </div>
            
            <div style="text-align:center;background:rgba(255,255,255,0.05);padding:24px;border-radius:16px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link)}&bgcolor=1a1a1a&color=ffffff" style="border-radius:12px;">
                <p style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:12px;">QR-Code scannen</p>
            </div>
        `);
    },
    
    async showManageModal() {
        // GM-Check
        let isGM = false;
        if (typeof RIFT !== 'undefined' && RIFT.rooms?.isUserGM && HubController?.roomCode) {
            try {
                isGM = await RIFT.rooms.isUserGM(HubController.roomCode);
            } catch (e) {}
        }
        
        if (!isGM) {
            this.showToast('Nur der GM kann die Party verwalten', 'error');
            return;
        }
        
        const members = HubController?.partyMembers || [];
        
        let content = '';
        if (members.length === 0) {
            content = '<p style="color:rgba(255,255,255,0.5);text-align:center;padding:30px;">Keine Spieler in der Party</p>';
        } else {
            content = members.map(m => `
                <div style="display:flex;align-items:center;gap:14px;padding:16px;background:rgba(255,255,255,0.05);border-radius:12px;margin-bottom:10px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:${m.color || '#8b5cf6'};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:18px;">${(m.name || m.displayName || '?')[0].toUpperCase()}</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;">${m.name || m.displayName || 'Unbekannt'}</div>
                        <div style="font-size:12px;color:rgba(255,255,255,0.5);">${m.role === 'gm' ? 'Game Master' : 'Spieler'}</div>
                    </div>
                    ${m.role !== 'gm' ? 
                        `<button style="padding:8px 14px;background:#ef4444;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;" onclick="HeaderController.kickPlayer('${m.userId || m.id}')">Kicken</button>` : 
                        '<span style="color:#FF4655;font-size:12px;font-weight:600;background:rgba(255,70,85,0.15);padding:4px 10px;border-radius:6px;">GM</span>'}
                </div>
            `).join('');
        }
        
        this.showModal('Party verwalten', `
            <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <strong>${members.length}</strong> Spieler in der Party
            </div>
            ${content}
        `);
    },
    
    async kickPlayer(userId) {
        if (!confirm('Spieler wirklich kicken?')) return;
        
        // Nutze RIFT.rooms.leaveRoom oder eigene Logik
        if (typeof RIFT !== 'undefined' && RIFT.rooms?.leaveRoom && HubController?.roomCode) {
            try {
                await RIFT.rooms.leaveRoom(HubController.roomCode, userId);
                this.showToast('Spieler wurde entfernt', 'success');
                this.closeModal();
                // Reload members
                if (HubController?.loadPartyMembers) {
                    await HubController.loadPartyMembers();
                }
            } catch (e) {
                this.showToast('Fehler: ' + e.message, 'error');
            }
        } else {
            this.showToast('Spieler wurde entfernt', 'success');
            this.closeModal();
        }
    },
    
    // ========================================
    // ROOM CODE BUTTONS
    // ========================================
    
    setupRoomButtons() {
        const copyBtn = document.querySelector('.topnav__dropdown-room-copy');
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                const code = HubController?.roomCode || localStorage.getItem('rift_current_room') || '';
                this.copyText(code);
            };
        }
        
        document.querySelectorAll('.topnav__dropdown--room .topnav__dropdown-item').forEach(item => {
            const text = item.textContent;
            
            if (text.includes('Link teilen')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    const code = HubController?.roomCode || '';
                    const link = `${location.origin}/join.html?code=${code}`;
                    if (navigator.share) {
                        navigator.share({ title: 'RIFT Session', url: link });
                    } else {
                        this.copyText(link);
                    }
                };
            }
            
            if (text.includes('QR-Code')) {
                item.onclick = (e) => {
                    e.preventDefault();
                    const code = HubController?.roomCode || '';
                    const formatted = RIFT?.rooms?.formatRoomCode ? RIFT.rooms.formatRoomCode(code) : code;
                    const link = `${location.origin}/join.html?code=${code}`;
                    this.showModal('QR-Code', `
                        <div style="text-align:center;">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}&bgcolor=1a1a1a&color=ffffff" style="border-radius:12px;margin-bottom:20px;">
                            <p>Session-Code: <strong style="font-family:monospace;font-size:22px;letter-spacing:3px;">${formatted}</strong></p>
                        </div>
                    `);
                };
            }
            
            if (text.includes('verlassen')) {
                item.onclick = async (e) => {
                    e.preventDefault();
                    if (!confirm('Session wirklich verlassen?')) return;
                    
                    // Nutze RIFT.rooms.leaveRoom
                    if (typeof RIFT !== 'undefined' && RIFT.rooms?.leaveRoom && HubController?.roomCode && HubController?.userData?.uid) {
                        try {
                            await RIFT.rooms.leaveRoom(HubController.roomCode, HubController.userData.uid);
                        } catch (e) {
                            console.log('[Header] Leave room error:', e);
                        }
                    }
                    
                    localStorage.removeItem('rift_current_room');
                    this.showToast('Session verlassen', 'info');
                    setTimeout(() => location.href = 'sessions.html', 1000);
                };
            }
        });
    },
    
    // ========================================
    // SEARCH
    // ========================================
    
    setupSearch() {
        const container = document.querySelector('.topnav__search');
        const input = container?.querySelector('input');
        if (!container || !input) return;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'search-dropdown';
        dropdown.id = 'search-dropdown';
        container.appendChild(dropdown);
        
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
        
        input.addEventListener('input', (e) => this.doSearch(e.target.value));
        input.addEventListener('focus', (e) => { if(e.target.value) this.doSearch(e.target.value); });
        
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) dropdown.classList.remove('active');
        });
    },
    
    doSearch(q) {
        const dropdown = document.getElementById('search-dropdown');
        if (!dropdown || !q) { dropdown?.classList.remove('active'); return; }
        
        const query = q.toLowerCase();
        let results = this.searchData.filter(i => i.name.toLowerCase().includes(query));
        
        // Charaktere aus HubController
        if (HubController?.characters?.length > 0) {
            HubController.characters.forEach(c => {
                if (c.name?.toLowerCase().includes(query)) {
                    results.push({ cat: 'Charaktere', name: c.name, url: `sheet.html?id=${c.id}`, icon: '🧙' });
                }
            });
        }
        
        // Sessions aus HubController  
        if (HubController?.sessions?.length > 0) {
            HubController.sessions.forEach(s => {
                if (s.name?.toLowerCase().includes(query)) {
                    results.push({ cat: 'Sessions', name: s.name, url: `session.html?id=${s.id}`, icon: '🎮' });
                }
            });
        }
        
        if (results.length === 0) {
            dropdown.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,0.5);">Keine Ergebnisse</div>';
        } else {
            const groups = {};
            results.forEach(r => { if (!groups[r.cat]) groups[r.cat] = []; groups[r.cat].push(r); });
            
            let html = '';
            for (const [cat, items] of Object.entries(groups)) {
                html += `<div style="padding:10px 0;${html?'border-top:1px solid rgba(255,255,255,0.1);':''}">
                    <div style="padding:4px 16px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.4);">${cat}</div>
                    ${items.slice(0,5).map(i => `
                        <a href="${i.url}" style="display:flex;align-items:center;gap:12px;padding:10px 16px;text-decoration:none;color:#fff;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,70,85,0.1)'" onmouseout="this.style.background='transparent'">
                            <span style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:18px;">${i.icon}</span>
                            <span style="font-weight:500;">${i.name}</span>
                        </a>
                    `).join('')}
                </div>`;
            }
            dropdown.innerHTML = html;
        }
        
        dropdown.classList.add('active');
    },
    
    // ========================================
    // NOTIFICATIONS
    // ========================================
    
    setupNotifications() {
        const btn = document.getElementById('notifications-btn');
        const wrapper = btn?.closest('.topnav__icon-wrapper');
        if (!btn || !wrapper) return;
        
        wrapper.querySelector('.notifications-dropdown')?.remove();
        
        const dropdown = document.createElement('div');
        dropdown.className = 'notifications-dropdown';
        dropdown.innerHTML = `
            <div class="notifications-dropdown__header">
                <span>Benachrichtigungen</span>
                <button onclick="HeaderController.clearNotifications()" style="background:none;border:none;color:#FF4655;font-size:12px;cursor:pointer;">Löschen</button>
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
    // UTILITIES
    // ========================================
    
    copyText(text) {
        if (!text) { this.showToast('Nichts zum Kopieren', 'error'); return; }
        
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('✓ Kopiert!', 'success');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;';
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
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);" onclick="HeaderController.closeModal()"></div>
            <div style="position:relative;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:90%;max-width:440px;max-height:85vh;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.1);">
                    <h3 style="font-size:18px;font-weight:600;margin:0;">${title}</h3>
                    <button onclick="HeaderController.closeModal()" style="background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;padding:8px;border-radius:8px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div style="padding:24px;overflow-y:auto;max-height:calc(85vh - 80px);">${content}</div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    closeModal() {
        document.querySelector('.header-modal')?.remove();
    },
    
    showToast(message, type = 'info') {
        if (typeof ToastService !== 'undefined') {
            ToastService.show(message, type);
            return;
        }
        
        document.querySelector('.header-toast')?.remove();
        
        const colors = { success: '#22c55e', error: '#ef4444', info: '#FF4655' };
        const toast = document.createElement('div');
        toast.className = 'header-toast';
        toast.textContent = message;
        toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid ${colors[type]};border-radius:12px;padding:14px 28px;font-size:14px;font-weight:500;color:${colors[type]};z-index:10001;`;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => HeaderController.init());

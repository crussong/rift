/**
 * RIFT Admin Extended Modules
 * Benutzer, Sessions, Feedback, Ankündigungen, Analytics, Changelog, FAQ, Regelwerke, Assets, Audit Log
 */

// ========================================
// USERS ADMIN MODULE
// ========================================
const UsersAdmin = {
    users: [],
    
    async load() {
        try {
            const snapshot = await db.collection('users').get();
            this.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
            this.updateStats();
            console.log('[Admin] Loaded', this.users.length, 'users');
        } catch (error) {
            console.warn('Users collection not accessible:', error.message);
            this.users = [];
            this.render();
            this.updateStats();
        }
    },
    
    render() {
        const container = document.getElementById('usersTableBody');
        if (!container) return;
        
        if (this.users.length === 0) {
            container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:60px;color:var(--text-muted);">Keine Benutzer gefunden</td></tr>';
            return;
        }
        
        container.innerHTML = this.users.map(user => {
            const createdAt = user.createdAt?.toDate?.() || new Date();
            const lastLogin = user.lastLogin?.toDate?.();
            const role = user.role || 'user';
            const isBanned = user.banned === true;
            const roleColors = { admin: '#8B5CF6', moderator: '#3B82F6', user: '#666', banned: '#EF4444' };
            const roleLabels = { admin: 'Admin', moderator: 'Moderator', user: 'User', banned: 'Gesperrt' };
            const displayRole = isBanned ? 'banned' : role;
            
            return `
                <tr>
                    <td>
                        <div style="width:36px;height:36px;border-radius:50%;background:${user.color||'#8B5CF6'};display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:14px;overflow:hidden;">
                            ${user.avatar ? '<img src="'+user.avatar+'" style="width:100%;height:100%;object-fit:cover;">' : (user.displayName||user.email||'?').charAt(0).toUpperCase()}
                        </div>
                    </td>
                    <td>
                        <div style="font-weight:500;">${user.displayName||'Unbekannt'}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${user.email||user.id}</div>
                    </td>
                    <td><span style="display:inline-flex;padding:4px 10px;background:${roleColors[displayRole]}20;color:${roleColors[displayRole]};border-radius:12px;font-size:12px;font-weight:500;">${roleLabels[displayRole]}</span></td>
                    <td style="color:var(--text-muted);font-size:13px;">${this.formatDate(createdAt)}</td>
                    <td style="color:var(--text-muted);font-size:13px;">${lastLogin ? this.formatDate(lastLogin) : '—'}</td>
                    <td style="text-align:center;">${user.sessionCount||0}</td>
                    <td>
                        <div class="news-table__actions">
                            <button class="btn btn--ghost btn--small" onclick="UsersAdmin.viewDetails('${user.id}')" title="Details">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button class="btn btn--ghost btn--small" onclick="UsersAdmin.editRole('${user.id}')" title="Rolle ändern">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn btn--ghost btn--small" onclick="UsersAdmin.toggleBan('${user.id}',${!isBanned})" title="${isBanned?'Entsperren':'Global Sperren'}" style="color:${isBanned?'var(--green)':'var(--red)'};">
                                ${isBanned ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        document.getElementById('usersCount').textContent = this.users.length + ' Benutzer';
    },
    
    updateStats() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7*24*60*60*1000);
        document.getElementById('statUsersTotal').textContent = this.users.length;
        document.getElementById('statUsersToday').textContent = this.users.filter(u => { const l = u.lastLogin?.toDate?.(); return l && l >= today; }).length;
        document.getElementById('statUsersWeek').textContent = this.users.filter(u => { const l = u.lastLogin?.toDate?.(); return l && l >= weekAgo; }).length;
        document.getElementById('statUsersAdmins').textContent = this.users.filter(u => u.role === 'admin').length;
    },
    
    filter() {
        const search = document.getElementById('userSearch').value.toLowerCase();
        const role = document.getElementById('userRoleFilter').value;
        const rows = document.querySelectorAll('#usersTableBody tr');
        this.users.forEach((user, i) => {
            const row = rows[i]; if (!row) return;
            const matchSearch = !search || (user.displayName||'').toLowerCase().includes(search) || (user.email||'').toLowerCase().includes(search);
            const userRole = user.banned ? 'banned' : (user.role||'user');
            const matchRole = !role || userRole === role;
            row.style.display = matchSearch && matchRole ? '' : 'none';
        });
    },
    
    async editRole(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        const newRole = prompt('Rolle für ' + (user.displayName||user.email) + ':\n\nOptionen: admin, moderator, user', user.role||'user');
        if (!newRole || !['admin','moderator','user'].includes(newRole)) return;
        try {
            await db.collection('users').doc(userId).update({ role: newRole });
            showToast('Rolle aktualisiert');
            this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    async toggleBan(userId, ban) {
        const user = this.users.find(u => u.id === userId);
        if (!user || !confirm((user.displayName||user.email) + ' wirklich ' + (ban?'sperren':'entsperren') + '?')) return;
        try {
            await db.collection('users').doc(userId).update({ banned: ban });
            showToast(ban ? 'Benutzer gesperrt' : 'Benutzer entsperrt');
            this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    async viewDetails(userId) {
        var user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        // Find rooms this user is in
        var userRooms = [];
        try {
            var roomsSnap = await db.collection('rooms').get();
            for (var i = 0; i < roomsSnap.docs.length; i++) {
                var room = roomsSnap.docs[i];
                var memberSnap = await db.collection('rooms').doc(room.id).collection('members').doc(userId).get();
                if (memberSnap.exists) {
                    userRooms.push({ id: room.id, name: room.data().name || room.id, isGM: room.data().gmId === userId });
                }
            }
        } catch (e) { console.warn('Could not load user rooms:', e); }
        
        var roomsHtml = userRooms.length > 0 ? userRooms.map(function(r) {
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg);border-radius:6px;">' +
                '<div><div style="font-weight:500;">' + r.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (r.isGM ? 'GM' : 'Spieler') + '</div></div>' +
                (r.isGM ? '' : '<button class="btn btn--ghost btn--small" onclick="UsersAdmin.kickFromRoom(\'' + userId + '\',\'' + r.id + '\')" style="color:var(--red);">Kicken</button>') +
                '</div>';
        }).join('') : '<div style="color:var(--text-muted);">In keinen Räumen</div>';
        
        var html = '<div class="modal active" id="userDetailModal" onclick="if(event.target===this)this.remove()">' +
            '<div class="modal__content"><div class="modal__header"><h3 class="modal__title">Benutzer Details</h3>' +
            '<button class="btn btn--ghost" onclick="document.getElementById(\'userDetailModal\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            '<div style="display:flex;gap:16px;align-items:center;margin-bottom:24px;">' +
            '<div style="width:64px;height:64px;border-radius:50%;background:' + (user.color||'#8B5CF6') + ';display:flex;align-items:center;justify-content:center;color:white;font-size:24px;font-weight:600;">' + 
            (user.avatar ? '<img src="' + user.avatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' : (user.displayName||'?').charAt(0).toUpperCase()) + '</div>' +
            '<div><div style="font-size:18px;font-weight:600;">' + (user.displayName||'Unbekannt') + '</div>' +
            '<div style="color:var(--text-muted);">' + (user.email||'—') + '</div></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">' +
            '<div style="padding:12px;background:var(--bg);border-radius:8px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">User ID</div><code style="font-size:11px;">' + user.id + '</code></div>' +
            '<div style="padding:12px;background:var(--bg);border-radius:8px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Rolle</div><div>' + (user.role||'user') + '</div></div>' +
            '<div style="padding:12px;background:var(--bg);border-radius:8px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Registriert</div><div>' + this.formatDate(user.createdAt?.toDate?.()) + '</div></div>' +
            '<div style="padding:12px;background:var(--bg);border-radius:8px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Letzter Login</div><div>' + this.formatDate(user.lastLogin?.toDate?.()) + '</div></div>' +
            '</div>' +
            '<h4 style="margin-bottom:12px;">Räume (' + userRooms.length + ')</h4>' +
            '<div style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto;">' + roomsHtml + '</div>' +
            '</div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    async kickFromRoom(userId, roomId) {
        if (!confirm('Benutzer aus diesem Raum entfernen?')) return;
        try {
            await db.collection('rooms').doc(roomId).collection('members').doc(userId).delete();
            showToast('Aus Raum entfernt');
            document.getElementById('userDetailModal')?.remove();
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    },
    
    exportUsers() {
        const data = this.users.map(u => ({ id: u.id, displayName: u.displayName, email: u.email, role: u.role }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rift-users.json'; a.click();
        showToast('Export gestartet');
    },
    
    formatDate(date) {
        if (!date) return '—';
        return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date);
    }
};

// ========================================
// SESSIONS ADMIN MODULE (with Admin Features)
// ========================================
const SessionsAdmin = {
    sessions: [],
    
    async load() {
        try {
            const snapshot = await db.collection('rooms').get();
            this.sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Load member counts
            for (var i = 0; i < this.sessions.length; i++) {
                var s = this.sessions[i];
                try {
                    var membersSnap = await db.collection('rooms').doc(s.id).collection('members').get();
                    s.memberCount = membersSnap.size;
                    s.memberList = membersSnap.docs.map(d => ({ oderId: d.id, ...d.data() }));
                } catch (e) {
                    s.memberCount = 0;
                    s.memberList = [];
                }
            }
            
            this.render();
            this.updateStats();
            this.updateRulesetStats();
            console.log('[Admin] Loaded', this.sessions.length, 'sessions with members');
        } catch (error) {
            console.warn('Sessions collection not accessible:', error.message);
            this.sessions = [];
            this.render();
            this.updateStats();
            this.updateRulesetStats();
        }
    },
    
    render() {
        const container = document.getElementById('sessionsTableBody');
        if (!container) return;
        if (this.sessions.length === 0) {
            container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:60px;color:var(--text-muted);">Keine Sessions</td></tr>';
            return;
        }
        container.innerHTML = this.sessions.map(s => {
            var memberCount = s.memberCount || 0;
            var createdAt = s.createdAt ? this.formatDate(s.createdAt) : '—';
            return '<tr>' +
                '<td><div style="font-weight:500;">' + (s.name||s.id||'Unbenannt') + '</div><div style="font-size:11px;color:var(--text-muted);">' + s.id + '</div></td>' +
                '<td><span style="padding:4px 8px;background:var(--bg-elevated);border-radius:6px;font-size:12px;">' + (s.ruleset||'—') + '</span></td>' +
                '<td style="text-align:center;">' + memberCount + '</td>' +
                '<td style="color:var(--text-muted);font-size:13px;">' + (s.gmName||'—') + '</td>' +
                '<td style="color:var(--text-muted);font-size:13px;">' + createdAt + '</td>' +
                '<td><span style="padding:4px 10px;background:#22C55E20;color:#22C55E;border-radius:12px;font-size:12px;">Aktiv</span></td>' +
                '<td>' +
                '<div class="news-table__actions">' +
                '<button class="btn btn--ghost btn--small" onclick="SessionsAdmin.viewDetails(\'' + s.id + '\')" title="Details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="SessionsAdmin.manageMembers(\'' + s.id + '\')" title="Mitglieder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="SessionsAdmin.changeGM(\'' + s.id + '\')" title="GM ändern"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="SessionsAdmin.deleteRoom(\'' + s.id + '\')" title="Löschen" style="color:var(--red);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                '</div></td>' +
            '</tr>';
        }).join('');
    },
    
    updateStats() {
        var active = this.sessions.length;
        var totalMembers = this.sessions.reduce(function(s, r) { return s + (r.memberCount || 0); }, 0);
        var avgPlayers = active > 0 ? Math.round(totalMembers / active * 10) / 10 : 0;
        document.getElementById('statSessionsActive').textContent = active;
        document.getElementById('statSessionsWeek').textContent = '—';
        document.getElementById('statSessionsTotal').textContent = active;
        document.getElementById('statSessionsAvgPlayers').textContent = avgPlayers;
    },
    
    updateRulesetStats() {
        const container = document.getElementById('rulesetStats');
        if (!container) return;
        const counts = {};
        this.sessions.forEach(s => { const r = s.ruleset||'Unbekannt'; counts[r] = (counts[r]||0)+1; });
        const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,6);
        if (sorted.length === 0) { container.innerHTML = '<div style="text-align:center;color:var(--text-muted);">Keine Daten</div>'; return; }
        const max = sorted[0][1];
        container.innerHTML = sorted.map(function(item) {
            var r = item[0], c = item[1];
            return '<div style="background:var(--bg-elevated);border-radius:8px;padding:16px;">' +
                '<div style="font-weight:500;margin-bottom:8px;">' + r + '</div>' +
                '<div style="display:flex;align-items:center;gap:12px;">' +
                '<div style="flex:1;height:8px;background:var(--bg);border-radius:4px;overflow:hidden;"><div style="width:' + (c/max*100) + '%;height:100%;background:var(--accent);"></div></div>' +
                '<span style="font-weight:600;color:var(--accent);">' + c + '</span>' +
                '</div></div>';
        }).join('');
    },
    
    filter() {
        var search = document.getElementById('sessionSearch').value.toLowerCase();
        var ruleset = document.getElementById('sessionRulesetFilter').value;
        var rows = document.querySelectorAll('#sessionsTableBody tr');
        var self = this;
        this.sessions.forEach(function(s, i) {
            var row = rows[i]; if (!row) return;
            var matchSearch = !search || (s.name||'').toLowerCase().includes(search) || s.id.toLowerCase().includes(search);
            var matchRuleset = !ruleset || s.ruleset === ruleset;
            row.style.display = matchSearch && matchRuleset ? '' : 'none';
        });
    },
    
    viewDetails(id) {
        var s = this.sessions.find(function(x) { return x.id === id; });
        if (!s) return;
        
        var membersHtml = (s.memberList || []).map(function(m) {
            return '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:6px;">' +
                '<div style="width:32px;height:32px;border-radius:50%;background:' + (m.color||'#8B5CF6') + ';display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600;">' + (m.displayName||'?').charAt(0).toUpperCase() + '</div>' +
                '<div><div style="font-weight:500;font-size:13px;">' + (m.displayName||'Unbekannt') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (m.oderId === s.gmId ? 'GM' : 'Spieler') + '</div></div></div>';
        }).join('') || '<div style="color:var(--text-muted);">Keine Mitglieder</div>';
        
        var html = '<div class="modal active" id="sessionDetailModal" onclick="if(event.target===this)this.remove()">' +
            '<div class="modal__content modal__content--wide"><div class="modal__header"><h3 class="modal__title">Session Details</h3>' +
            '<button class="btn btn--ghost" onclick="document.getElementById(\'sessionDetailModal\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">' +
            '<div><h4 style="margin-bottom:12px;">Informationen</h4>' +
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div><span style="color:var(--text-muted);">Name:</span> <strong>' + (s.name||'Unbenannt') + '</strong></div>' +
            '<div><span style="color:var(--text-muted);">ID:</span> <code style="font-size:12px;background:var(--bg);padding:2px 6px;border-radius:4px;">' + s.id + '</code></div>' +
            '<div><span style="color:var(--text-muted);">Regelwerk:</span> ' + (s.ruleset||'—') + '</div>' +
            '<div><span style="color:var(--text-muted);">GM:</span> ' + (s.gmName||'—') + '</div>' +
            '<div><span style="color:var(--text-muted);">Erstellt:</span> ' + this.formatDate(s.createdAt) + '</div>' +
            '</div></div>' +
            '<div><h4 style="margin-bottom:12px;">Mitglieder (' + (s.memberCount||0) + ')</h4>' +
            '<div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">' + membersHtml + '</div></div>' +
            '</div></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    manageMembers(id) {
        var s = this.sessions.find(function(x) { return x.id === id; });
        if (!s) return;
        
        var membersHtml = (s.memberList || []).map(function(m) {
            var isGM = m.oderId === s.gmId;
            return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg);border-radius:8px;">' +
                '<div style="width:40px;height:40px;border-radius:50%;background:' + (m.color||'#8B5CF6') + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:600;">' + (m.displayName||'?').charAt(0).toUpperCase() + '</div>' +
                '<div style="flex:1;"><div style="font-weight:500;">' + (m.displayName||'Unbekannt') + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);">' + m.oderId + '</div></div>' +
                (isGM ? '<span style="padding:4px 8px;background:var(--accent);color:white;border-radius:6px;font-size:11px;">GM</span>' : 
                '<button class="btn btn--ghost btn--small" onclick="SessionsAdmin.kickMember(\'' + id + '\',\'' + m.oderId + '\')" style="color:var(--red);">Kicken</button>') +
                '</div>';
        }).join('') || '<div style="color:var(--text-muted);text-align:center;padding:20px;">Keine Mitglieder</div>';
        
        var html = '<div class="modal active" id="manageMembersModal" onclick="if(event.target===this)this.remove()">' +
            '<div class="modal__content"><div class="modal__header"><h3 class="modal__title">Mitglieder verwalten - ' + (s.name||s.id) + '</h3>' +
            '<button class="btn btn--ghost" onclick="document.getElementById(\'manageMembersModal\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body"><div style="display:flex;flex-direction:column;gap:8px;">' + membersHtml + '</div></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    async kickMember(roomId, oderId) {
        if (!confirm('Spieler wirklich aus dem Raum entfernen?')) return;
        try {
            await db.collection('rooms').doc(roomId).collection('members').doc(oderId).delete();
            showToast('Spieler entfernt');
            document.getElementById('manageMembersModal')?.remove();
            this.load();
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    },
    
    async changeGM(id) {
        var s = this.sessions.find(function(x) { return x.id === id; });
        if (!s || !s.memberList || s.memberList.length === 0) {
            showToast('Keine Mitglieder', 'error');
            return;
        }
        
        var members = s.memberList.filter(function(m) { return m.oderId !== s.gmId; });
        if (members.length === 0) {
            showToast('Keine anderen Mitglieder', 'error');
            return;
        }
        
        var options = members.map(function(m, i) { return (i+1) + '. ' + (m.displayName||'User') + ' (' + m.oderId.substring(0,8) + '...)'; }).join('\n');
        var selection = prompt('Neuen GM wählen:\n\n' + options + '\n\nNummer eingeben:');
        if (!selection) return;
        
        var idx = parseInt(selection) - 1;
        if (isNaN(idx) || idx < 0 || idx >= members.length) {
            showToast('Ungültige Auswahl', 'error');
            return;
        }
        
        var newGM = members[idx];
        try {
            await db.collection('rooms').doc(id).update({
                gmId: newGM.oderId,
                gmName: newGM.displayName || 'GM'
            });
            showToast('GM geändert zu ' + (newGM.displayName || 'User'));
            this.load();
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    },
    
    async deleteRoom(id) {
        var s = this.sessions.find(function(x) { return x.id === id; });
        if (!confirm('Raum "' + (s?.name || id) + '" wirklich LÖSCHEN?\n\n⚠️ Alle Daten werden gelöscht!')) return;
        if (!confirm('WIRKLICH sicher? Das kann nicht rückgängig gemacht werden!')) return;
        
        try {
            // Delete subcollections
            var subcollections = ['members', 'chat', 'characters', 'dice', 'notes', 'whiteboard', 'maps', 'markers', 'broadcasts', 'polls'];
            for (var i = 0; i < subcollections.length; i++) {
                try {
                    var subSnap = await db.collection('rooms').doc(id).collection(subcollections[i]).get();
                    var batch = db.batch();
                    subSnap.docs.forEach(function(doc) { batch.delete(doc.ref); });
                    if (subSnap.docs.length > 0) await batch.commit();
                } catch (e) { /* subcollection might not exist */ }
            }
            
            await db.collection('rooms').doc(id).delete();
            showToast('Raum gelöscht');
            this.load();
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        }
    },
    
    formatDate(ts) {
        if (!ts) return '—';
        var d = ts.toDate ? ts.toDate() : new Date(ts);
        return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }).format(d);
    }
};

// ========================================
// FEEDBACK ADMIN MODULE
// ========================================
const FeedbackAdmin = {
    items: [],
    
    async load() {
        try {
            const snapshot = await db.collection('feedback').orderBy('createdAt', 'desc').get();
            this.items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
            this.updateStats();
            console.log('[Admin] Loaded', this.items.length, 'feedback items');
        } catch (e) {
            console.warn('Feedback collection not accessible:', e.message);
            this.items = [];
            this.render();
            this.updateStats();
        }
    },
    
    render() {
        const container = document.getElementById('feedbackListContainer');
        if (!container) return;
        if (this.items.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Kein Feedback vorhanden</div>';
            return;
        }
        const typeColors = { bug:'#EF4444', feature:'#8B5CF6', feedback:'#3B82F6', question:'#F59E0B' };
        const statusColors = { open:'#F59E0B', progress:'#3B82F6', resolved:'#22C55E', closed:'#666' };
        const statusLabels = { open:'Offen', progress:'In Bearbeitung', resolved:'Gelöst', closed:'Geschlossen' };
        
        container.innerHTML = this.items.map(item => {
            var tc = typeColors[item.type] || '#666';
            var sc = statusColors[item.status||'open'];
            var sl = statusLabels[item.status||'open'];
            return '<div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:flex-start;">' +
                '<div style="width:40px;height:40px;border-radius:10px;background:' + tc + '20;display:flex;align-items:center;justify-content:center;color:' + tc + ';flex-shrink:0;">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><span style="font-weight:600;">' + (item.title||'Kein Titel') + '</span>' +
                '<span style="padding:2px 8px;background:' + sc + '20;color:' + sc + ';border-radius:10px;font-size:11px;">' + sl + '</span></div>' +
                '<p style="color:var(--text-muted);font-size:13px;">' + ((item.description||'').substring(0,150)) + '</p>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">' + (item.userName||'Anonym') + ' • ' + this.formatDate(item.createdAt) + '</div></div>' +
                '<select class="form-select" style="width:auto;font-size:12px;padding:6px 12px;" onchange="FeedbackAdmin.updateStatus(\'' + item.id + '\',this.value)">' +
                '<option value="open"' + (item.status==='open'?' selected':'') + '>Offen</option>' +
                '<option value="progress"' + (item.status==='progress'?' selected':'') + '>In Bearbeitung</option>' +
                '<option value="resolved"' + (item.status==='resolved'?' selected':'') + '>Gelöst</option>' +
                '<option value="closed"' + (item.status==='closed'?' selected':'') + '>Geschlossen</option></select></div>';
        }).join('');
    },
    
    updateStats() {
        document.getElementById('statFeedbackOpen').textContent = this.items.filter(i => !i.status || i.status === 'open').length;
        document.getElementById('statFeedbackProgress').textContent = this.items.filter(i => i.status === 'progress').length;
        document.getElementById('statFeedbackResolved').textContent = this.items.filter(i => i.status === 'resolved').length;
        document.getElementById('statFeedbackBugs').textContent = this.items.filter(i => i.type === 'bug').length;
    },
    
    async updateStatus(id, status) {
        try {
            await db.collection('feedback').doc(id).update({ status: status });
            var item = this.items.find(i => i.id === id); if (item) item.status = status;
            this.updateStats();
            showToast('Status aktualisiert');
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    filter() {},
    formatDate(ts) { if (!ts) return '—'; var d = ts.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }).format(d); }
};

// ========================================
// ANNOUNCEMENTS ADMIN MODULE (Extended)
// ========================================
// Note: AnnouncementsAdmin is already defined in admin.html
// This extended version is skipped to avoid duplicate declaration
/*
const AnnouncementsAdmin = {
    items: [],
    editingId: null,
    
    // Banner-Typen mit Icons und Farben
    levelConfig: {
        info: { color: '#3B82F6', icon: 'ℹ️', label: 'Info' },
        warning: { color: '#F59E0B', icon: '⚠️', label: 'Warnung' },
        critical: { color: '#EF4444', icon: '🚨', label: 'Kritisch' },
        success: { color: '#22C55E', icon: '✅', label: 'Erfolg' },
        maintenance: { color: '#8B5CF6', icon: '🔧', label: 'Wartung' },
        event: { color: '#EC4899', icon: '🎉', label: 'Event' }
    },
    
    // Position-Optionen
    positionConfig: {
        'top-bar': { label: 'Oben (Bar)', desc: 'Schmaler Banner am Seitenanfang' },
        'top-banner': { label: 'Oben (Groß)', desc: 'Großer Banner unter Header' },
        'bottom-bar': { label: 'Unten (Bar)', desc: 'Fixierter Banner am unteren Rand' },
        'modal': { label: 'Modal/Popup', desc: 'Zentriertes Popup-Fenster' },
        'corner': { label: 'Ecke', desc: 'Kleine Benachrichtigung in der Ecke' }
    },
    
    // Seiten-Optionen
    pageOptions: [
        { value: 'all', label: 'Alle Seiten' },
        { value: 'hub', label: 'Nur Hub' },
        { value: 'session', label: 'Nur Session' },
        { value: 'character', label: 'Nur Charakterbogen' },
        { value: 'landing', label: 'Nur Landing Page' }
    ],
    
    // Zielgruppen
    audienceOptions: [
        { value: 'all', label: 'Alle User' },
        { value: 'logged_in', label: 'Nur eingeloggte User' },
        { value: 'logged_out', label: 'Nur nicht eingeloggte User' },
        { value: 'admin', label: 'Nur Admins' },
        { value: 'gm', label: 'Nur GMs' }
    ],
    
    async load() {
        try {
            const snapshot = await db.collection('announcements').orderBy('priority', 'desc').get();
            this.items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
            this.renderStats();
            this.updateActiveBanner();
            console.log('[Admin] Loaded', this.items.length, 'announcements');
        } catch (e) {
            console.warn('Announcements collection not accessible:', e.message);
            this.items = [];
            this.render();
        }
    },
    
    renderStats() {
        const statsContainer = document.getElementById('bannerStats');
        if (!statsContainer) return;
        
        const active = this.items.filter(i => i.active).length;
        const scheduled = this.items.filter(i => {
            if (!i.startDate) return false;
            const start = i.startDate.toDate ? i.startDate.toDate() : new Date(i.startDate);
            return start > new Date() && !i.active;
        }).length;
        const totalViews = this.items.reduce((sum, i) => sum + (i.views || 0), 0);
        const totalDismisses = this.items.reduce((sum, i) => sum + (i.dismisses || 0), 0);
        
        statsContainer.innerHTML = 
            '<div class="stat-card stat-card--small"><div class="stat-card__value" style="color:var(--green);">' + active + '</div><div class="stat-card__label">Aktiv</div></div>' +
            '<div class="stat-card stat-card--small"><div class="stat-card__value" style="color:var(--accent);">' + scheduled + '</div><div class="stat-card__label">Geplant</div></div>' +
            '<div class="stat-card stat-card--small"><div class="stat-card__value">' + totalViews + '</div><div class="stat-card__label">Views</div></div>' +
            '<div class="stat-card stat-card--small"><div class="stat-card__value">' + totalDismisses + '</div><div class="stat-card__label">Dismissed</div></div>';
    },
    
    render() {
        const container = document.getElementById('announcementsList');
        if (!container) return;
        
        if (this.items.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Ankündigungen<br><br><button class="btn btn--primary" onclick="AnnouncementsAdmin.openEditor()">Erste Ankündigung erstellen</button></div>';
            return;
        }
        
        container.innerHTML = this.items.map(item => {
            const config = this.levelConfig[item.level] || this.levelConfig.info;
            const isScheduled = item.startDate && new Date(item.startDate.toDate ? item.startDate.toDate() : item.startDate) > new Date();
            const isExpired = item.endDate && new Date(item.endDate.toDate ? item.endDate.toDate() : item.endDate) < new Date();
            
            let statusBadge = '';
            if (item.active && !isExpired) {
                statusBadge = '<span style="padding:2px 8px;background:var(--green);color:white;border-radius:10px;font-size:10px;margin-left:8px;">LIVE</span>';
            } else if (isScheduled) {
                statusBadge = '<span style="padding:2px 8px;background:var(--accent);color:white;border-radius:10px;font-size:10px;margin-left:8px;">GEPLANT</span>';
            } else if (isExpired) {
                statusBadge = '<span style="padding:2px 8px;background:var(--text-muted);color:white;border-radius:10px;font-size:10px;margin-left:8px;">ABGELAUFEN</span>';
            }
            
            const scheduleInfo = this.formatSchedule(item);
            const viewsInfo = (item.views || 0) + ' Views, ' + (item.dismisses || 0) + ' Dismissed';
            
            return '<div class="slide-item" style="border-left:4px solid ' + config.color + ';">' +
                '<div class="slide-item__info" style="flex:1;">' +
                '<div class="slide-item__title">' +
                '<span style="margin-right:8px;">' + config.icon + '</span>' +
                (item.title || 'Keine Überschrift') + statusBadge +
                '</div>' +
                '<div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--text-muted);">' +
                '<span style="padding:2px 8px;background:' + config.color + '20;color:' + config.color + ';border-radius:6px;">' + config.label + '</span>' +
                '<span>' + (this.positionConfig[item.position]?.label || 'Standard') + '</span>' +
                (scheduleInfo ? '<span>📅 ' + scheduleInfo + '</span>' : '') +
                '<span>👁 ' + viewsInfo + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="slide-item__actions" style="display:flex;gap:8px;align-items:center;">' +
                '<label class="form-checkbox" style="margin-right:8px;"><input type="checkbox" ' + (item.active ? 'checked' : '') + ' onchange="AnnouncementsAdmin.toggleActive(\'' + item.id + '\',this.checked)"><span>Aktiv</span></label>' +
                '<button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.duplicate(\'' + item.id + '\')" title="Duplizieren"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.edit(\'' + item.id + '\')" title="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.showStats(\'' + item.id + '\')" title="Statistiken"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.delete(\'' + item.id + '\')" title="Löschen" style="color:var(--red);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                '</div></div>';
        }).join('');
    },
    
    formatSchedule(item) {
        const parts = [];
        if (item.startDate) {
            const d = item.startDate.toDate ? item.startDate.toDate() : new Date(item.startDate);
            parts.push('Ab ' + d.toLocaleDateString('de-DE'));
        }
        if (item.endDate) {
            const d = item.endDate.toDate ? item.endDate.toDate() : new Date(item.endDate);
            parts.push('Bis ' + d.toLocaleDateString('de-DE'));
        }
        return parts.join(' · ');
    },
    
    updateActiveBanner() {
        const container = document.getElementById('activeBannerPreview');
        if (!container) return;
        
        const active = this.items.find(i => i.active);
        if (!active) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Kein aktiver Banner - Vorschau wird hier angezeigt</p>';
            return;
        }
        
        container.innerHTML = this.generateBannerHTML(active, true);
    },
    
    generateBannerHTML(banner, isPreview = false) {
        const config = this.levelConfig[banner.level] || this.levelConfig.info;
        const position = banner.position || 'top-banner';
        
        // Use custom color if set, otherwise use preset color
        const color = banner.customColor || config.color;
        // Use custom emoji if set, otherwise use preset icon
        const icon = banner.customEmoji || config.icon;
        // Check if emoji should be shown
        const showEmoji = banner.showEmoji !== false;
        
        let style = '';
        let wrapperStyle = 'border-radius:12px;overflow:hidden;';
        
        if (position === 'top-bar') {
            style = 'padding:10px 20px;font-size:14px;';
        } else if (position === 'bottom-bar') {
            style = 'padding:10px 20px;font-size:14px;';
            if (!isPreview) wrapperStyle += 'position:fixed;bottom:0;left:0;right:0;z-index:1000;border-radius:0;';
        } else if (position === 'modal') {
            wrapperStyle = 'background:var(--bg-elevated);border-radius:16px;padding:24px;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
            style = '';
        } else if (position === 'corner') {
            wrapperStyle = 'max-width:320px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
            if (!isPreview) wrapperStyle += 'position:fixed;bottom:20px;right:20px;z-index:1000;';
        } else {
            style = 'padding:16px 20px;';
        }
        
        const hasLink = banner.linkUrl && banner.linkText;
        const hasCountdown = banner.endDate && banner.showCountdown;
        
        let html = '<div style="' + wrapperStyle + '">';
        html += '<div style="background:' + color + '20;border:1px solid ' + color + '40;' + style + '">';
        
        if (position === 'modal') {
            // Modal Layout
            html += '<div style="text-align:center;">';
            if (banner.imageUrl) {
                html += '<img src="' + banner.imageUrl + '" style="max-width:100%;max-height:150px;border-radius:8px;margin-bottom:16px;">';
            }
            if (showEmoji) {
                html += '<div style="font-size:32px;margin-bottom:12px;">' + icon + '</div>';
            }
            html += '<div style="font-size:20px;font-weight:700;color:' + color + ';margin-bottom:8px;">' + banner.title + '</div>';
            if (banner.message) {
                html += '<div style="color:var(--text-muted);margin-bottom:16px;">' + banner.message + '</div>';
            }
            if (hasCountdown) {
                html += '<div id="bannerCountdown" style="font-size:24px;font-weight:700;color:' + color + ';margin-bottom:16px;">--:--:--</div>';
            }
            if (hasLink) {
                html += '<a href="' + banner.linkUrl + '" target="_blank" style="display:inline-block;padding:10px 24px;background:' + color + ';color:white;border-radius:8px;text-decoration:none;font-weight:500;">' + banner.linkText + '</a>';
            }
            html += '</div>';
        } else {
            // Bar/Banner Layout
            html += '<div style="display:flex;align-items:center;gap:16px;">';
            if (showEmoji) {
                html += '<span style="font-size:24px;">' + icon + '</span>';
            }
            html += '<div style="flex:1;">';
            html += '<div style="font-weight:600;color:' + color + ';">' + banner.title + '</div>';
            if (banner.message) {
                html += '<div style="font-size:14px;color:var(--text-muted);">' + banner.message + '</div>';
            }
            html += '</div>';
            if (hasCountdown) {
                html += '<div id="bannerCountdown" style="font-weight:700;color:' + color + ';font-size:18px;">--:--:--</div>';
            }
            if (hasLink) {
                // Button style - nicht unterstrichen, erkennbarer Button
                html += '<a href="' + banner.linkUrl + '" target="_blank" style="padding:8px 16px;background:' + color + ';color:white;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap;">' + banner.linkText + '</a>';
            }
            if (banner.dismissible !== false) {
                html += '<button onclick="dismissBanner(\'' + banner.id + '\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:8px;font-size:18px;">✕</button>';
            }
            html += '</div>';
        }
        
        html += '</div></div>';
        return html;
    },
    
    openEditor(id) {
        this.editingId = id || null;
        const item = id ? this.items.find(i => i.id === id) : null;
        
        // Level Options
        const levelOptions = Object.entries(this.levelConfig).map(([key, cfg]) => 
            '<option value="' + key + '"' + (item?.level === key ? ' selected' : '') + '>' + cfg.icon + ' ' + cfg.label + '</option>'
        ).join('');
        
        // Position Options
        const positionOptions = Object.entries(this.positionConfig).map(([key, cfg]) =>
            '<option value="' + key + '"' + (item?.position === key ? ' selected' : '') + '>' + cfg.label + '</option>'
        ).join('');
        
        // Page Options
        const pageOpts = this.pageOptions.map(p =>
            '<option value="' + p.value + '"' + (item?.pages === p.value ? ' selected' : '') + '>' + p.label + '</option>'
        ).join('');
        
        // Audience Options
        const audienceOpts = this.audienceOptions.map(a =>
            '<option value="' + a.value + '"' + (item?.audience === a.value ? ' selected' : '') + '>' + a.label + '</option>'
        ).join('');
        
        // Common emojis for quick pick
        const emojis = ['ℹ️', '⚠️', '🚨', '✅', '🔧', '🎉', '📢', '🔔', '⭐', '🎮', '🎲', '⚔️', '🛡️', '💡', '🚀', '❤️', '🔥', '✨', '📅', '🎁'];
        const emojiPicker = emojis.map(e => 
            '<button type="button" onclick="AnnouncementsAdmin.selectEmoji(\'' + e + '\')" style="padding:8px;font-size:20px;background:none;border:1px solid transparent;border-radius:6px;cursor:pointer;" onmouseover="this.style.background=\'var(--bg-elevated)\'" onmouseout="this.style.background=\'none\'">' + e + '</button>'
        ).join('');
        
        // Preset colors
        const presetColors = ['#3B82F6', '#F59E0B', '#EF4444', '#22C55E', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
        const colorPicker = presetColors.map(c =>
            '<button type="button" onclick="AnnouncementsAdmin.selectColor(\'' + c + '\')" style="width:32px;height:32px;background:' + c + ';border:2px solid transparent;border-radius:6px;cursor:pointer;" onmouseover="this.style.borderColor=\'white\'" onmouseout="this.style.borderColor=\'transparent\'"></button>'
        ).join('');
        
        const startDate = item?.startDate ? this.toDatetimeLocal(item.startDate) : '';
        const endDate = item?.endDate ? this.toDatetimeLocal(item.endDate) : '';
        const customColor = item?.customColor || '';
        const customEmoji = item?.customEmoji || '';
        const showEmoji = item?.showEmoji !== false;
        
        const html = '<div class="modal active" id="announcementModal" onclick="if(event.target===this)AnnouncementsAdmin.closeEditor()">' +
            '<div class="modal__content modal__content--wide" style="max-width:900px;">' +
            '<div class="modal__header"><h3 class="modal__title">' + (id ? 'Banner bearbeiten' : 'Neuer Banner') + '</h3>' +
            '<button class="btn btn--ghost" onclick="AnnouncementsAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">' +
            
            // Linke Spalte - Inhalt
            '<div>' +
            '<h4 style="margin-bottom:16px;display:flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;background:var(--accent);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;">1</span> Inhalt</h4>' +
            
            '<div class="form-group"><label class="form-label">Titel *</label>' +
            '<input type="text" class="form-input" id="annTitle" value="' + (item?.title || '') + '" placeholder="z.B. Wartungsarbeiten am Samstag" oninput="AnnouncementsAdmin.updatePreview()"></div>' +
            
            '<div class="form-group"><label class="form-label">Nachricht</label>' +
            '<textarea class="form-textarea" id="annMessage" placeholder="Optionale Details..." oninput="AnnouncementsAdmin.updatePreview()">' + (item?.message || '') + '</textarea></div>' +
            
            '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Typ (Preset)</label>' +
            '<select class="form-select" id="annLevel" onchange="AnnouncementsAdmin.updatePreview()">' + levelOptions + '</select></div>' +
            '<div class="form-group"><label class="form-label">Position</label>' +
            '<select class="form-select" id="annPosition" onchange="AnnouncementsAdmin.updatePreview()">' + positionOptions + '</select></div>' +
            '</div>' +
            
            // Emoji Section
            '<div class="form-group">' +
            '<label class="form-label">Emoji</label>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">' +
            '<label class="form-checkbox"><input type="checkbox" id="annShowEmoji"' + (showEmoji ? ' checked' : '') + ' onchange="AnnouncementsAdmin.updatePreview()"><span>Emoji anzeigen</span></label>' +
            '<div id="selectedEmoji" style="font-size:28px;min-width:40px;text-align:center;">' + (customEmoji || this.levelConfig[item?.level || 'info']?.icon || 'ℹ️') + '</div>' +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:8px;background:var(--bg);border-radius:8px;">' + emojiPicker + '</div>' +
            '<input type="hidden" id="annCustomEmoji" value="' + customEmoji + '">' +
            '</div>' +
            
            // Color Section
            '<div class="form-group">' +
            '<label class="form-label">Farbe</label>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">' +
            '<div style="display:flex;gap:6px;">' + colorPicker + '</div>' +
            '<input type="color" id="annCustomColor" value="' + (customColor || '#3B82F6') + '" style="width:40px;height:32px;border:none;border-radius:6px;cursor:pointer;" onchange="AnnouncementsAdmin.updatePreview()">' +
            '<span style="font-size:12px;color:var(--text-muted);">Custom</span>' +
            '</div>' +
            '</div>' +
            
            '<h4 style="margin:24px 0 16px;display:flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;background:var(--accent);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;">2</span> Link / Button</h4>' +
            
            '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Button-Text</label>' +
            '<input type="text" class="form-input" id="annLinkText" value="' + (item?.linkText || '') + '" placeholder="z.B. Mehr erfahren" oninput="AnnouncementsAdmin.updatePreview()"></div>' +
            '<div class="form-group"><label class="form-label">Link-URL</label>' +
            '<input type="text" class="form-input" id="annLinkUrl" value="' + (item?.linkUrl || '') + '" placeholder="https://..." oninput="AnnouncementsAdmin.updatePreview()"></div>' +
            '</div>' +
            
            // Bild Section mit Upload
            '<div class="form-group"><label class="form-label">Bild (optional, nur für Modal)</label>' +
            '<div style="display:flex;gap:8px;">' +
            '<input type="text" class="form-input" id="annImage" value="' + (item?.imageUrl || '') + '" placeholder="URL oder hochladen..." oninput="AnnouncementsAdmin.updatePreview()" style="flex:1;">' +
            '<button type="button" class="btn btn--secondary" onclick="document.getElementById(\'annImageUpload\').click()">Upload</button>' +
            '</div>' +
            '<input type="file" id="annImageUpload" accept="image/*" style="display:none;" onchange="AnnouncementsAdmin.uploadImage(this.files[0])">' +
            '<div id="imagePreview" style="margin-top:8px;"></div>' +
            '</div>' +
            '</div>' +
            
            // Rechte Spalte - Einstellungen
            '<div>' +
            '<h4 style="margin-bottom:16px;display:flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;background:var(--accent);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;">3</span> Zeitplanung</h4>' +
            
            '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Start (optional)</label>' +
            '<input type="datetime-local" class="form-input" id="annStartDate" value="' + startDate + '"></div>' +
            '<div class="form-group"><label class="form-label">Ende (optional)</label>' +
            '<input type="datetime-local" class="form-input" id="annEndDate" value="' + endDate + '"></div>' +
            '</div>' +
            
            '<div class="form-group"><label class="form-checkbox"><input type="checkbox" id="annShowCountdown"' + (item?.showCountdown ? ' checked' : '') + ' onchange="AnnouncementsAdmin.updatePreview()"><span>Countdown bis Ende anzeigen</span></label></div>' +
            
            '<h4 style="margin:24px 0 16px;display:flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;background:var(--accent);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;">4</span> Targeting</h4>' +
            
            '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Seiten</label>' +
            '<select class="form-select" id="annPages">' + pageOpts + '</select></div>' +
            '<div class="form-group"><label class="form-label">Zielgruppe</label>' +
            '<select class="form-select" id="annAudience">' + audienceOpts + '</select></div>' +
            '</div>' +
            
            '<div class="form-group"><label class="form-label">Priorität</label>' +
            '<input type="number" class="form-input" id="annPriority" value="' + (item?.priority || 0) + '" min="0" max="100" placeholder="0-100 (höher = wichtiger)"></div>' +
            
            '<h4 style="margin:24px 0 16px;display:flex;align-items:center;gap:8px;"><span style="width:24px;height:24px;background:var(--accent);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;">5</span> Optionen</h4>' +
            
            '<div class="form-group"><label class="form-checkbox"><input type="checkbox" id="annDismissible"' + (item?.dismissible !== false ? ' checked' : '') + '><span>Kann geschlossen werden</span></label></div>' +
            '<div class="form-group"><label class="form-checkbox"><input type="checkbox" id="annActive"' + (item?.active ? ' checked' : '') + '><span>Sofort aktivieren</span></label></div>' +
            
            '<h4 style="margin:24px 0 16px;">Vorschau</h4>' +
            '<div id="editorPreview" style="background:var(--bg);border-radius:12px;padding:16px;min-height:100px;"></div>' +
            '</div>' +
            
            '</div>' +
            '</div>' +
            '<div class="modal__footer">' +
            '<button class="btn btn--secondary" onclick="AnnouncementsAdmin.closeEditor()">Abbrechen</button>' +
            '<button class="btn btn--primary" onclick="AnnouncementsAdmin.save()">Speichern</button>' +
            '</div></div></div>';
        
        document.body.insertAdjacentHTML('beforeend', html);
        this.updatePreview();
        
        // Show image preview if exists
        if (item?.imageUrl) {
            document.getElementById('imagePreview').innerHTML = '<img src="' + item.imageUrl + '" style="max-width:100%;max-height:100px;border-radius:8px;">';
        }
    },
    
    selectEmoji(emoji) {
        document.getElementById('annCustomEmoji').value = emoji;
        document.getElementById('selectedEmoji').textContent = emoji;
        this.updatePreview();
    },
    
    selectColor(color) {
        document.getElementById('annCustomColor').value = color;
        this.updatePreview();
    },
    
    async uploadImage(file) {
        if (!file) return;
        
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '<span style="color:var(--text-muted);">Uploading...</span>';
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'RIFTapp');
            formData.append('folder', 'rift-banners');
            
            const response = await fetch('https://api.cloudinary.com/v1_1/dza4jgreq/image/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            
            const data = await response.json();
            document.getElementById('annImage').value = data.secure_url;
            preview.innerHTML = '<img src="' + data.secure_url + '" style="max-width:100%;max-height:100px;border-radius:8px;">';
            this.updatePreview();
            showToast('Bild hochgeladen');
        } catch (e) {
            preview.innerHTML = '<span style="color:var(--red);">Upload fehlgeschlagen</span>';
            showToast('Upload fehlgeschlagen', 'error');
        }
    },
    
    updatePreview() {
        const preview = document.getElementById('editorPreview');
        if (!preview) return;
        
        const customColor = document.getElementById('annCustomColor')?.value || '';
        const customEmoji = document.getElementById('annCustomEmoji')?.value || '';
        const showEmoji = document.getElementById('annShowEmoji')?.checked !== false;
        
        const banner = {
            title: document.getElementById('annTitle')?.value || 'Vorschau-Titel',
            message: document.getElementById('annMessage')?.value || '',
            level: document.getElementById('annLevel')?.value || 'info',
            position: document.getElementById('annPosition')?.value || 'top-banner',
            imageUrl: document.getElementById('annImage')?.value || '',
            linkText: document.getElementById('annLinkText')?.value || '',
            linkUrl: document.getElementById('annLinkUrl')?.value || '',
            showCountdown: document.getElementById('annShowCountdown')?.checked || false,
            dismissible: document.getElementById('annDismissible')?.checked !== false,
            customColor: customColor,
            customEmoji: customEmoji,
            showEmoji: showEmoji
        };
        
        preview.innerHTML = this.generateBannerHTML(banner, true);
    },
    
    toDatetimeLocal(timestamp) {
        if (!timestamp) return '';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toISOString().slice(0, 16);
    },
    
    closeEditor() {
        const m = document.getElementById('announcementModal');
        if (m) m.remove();
        this.editingId = null;
    },
    
    async save() {
        const title = document.getElementById('annTitle').value.trim();
        if (!title) {
            showToast('Bitte Titel eingeben', 'error');
            return;
        }
        
        const startDateVal = document.getElementById('annStartDate').value;
        const endDateVal = document.getElementById('annEndDate').value;
        
        const data = {
            title: title,
            message: document.getElementById('annMessage').value.trim(),
            level: document.getElementById('annLevel').value,
            position: document.getElementById('annPosition').value,
            imageUrl: document.getElementById('annImage').value.trim() || null,
            linkText: document.getElementById('annLinkText').value.trim() || null,
            linkUrl: document.getElementById('annLinkUrl').value.trim() || null,
            startDate: startDateVal ? new Date(startDateVal) : null,
            endDate: endDateVal ? new Date(endDateVal) : null,
            showCountdown: document.getElementById('annShowCountdown').checked,
            pages: document.getElementById('annPages').value,
            audience: document.getElementById('annAudience').value,
            priority: parseInt(document.getElementById('annPriority').value) || 0,
            dismissible: document.getElementById('annDismissible').checked,
            active: document.getElementById('annActive').checked,
            // New fields
            customColor: document.getElementById('annCustomColor').value || null,
            customEmoji: document.getElementById('annCustomEmoji').value || null,
            showEmoji: document.getElementById('annShowEmoji').checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            if (this.editingId) {
                await db.collection('announcements').doc(this.editingId).update(data);
                showToast('Banner aktualisiert');
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.views = 0;
                data.dismisses = 0;
                data.clicks = 0;
                await db.collection('announcements').add(data);
                showToast('Banner erstellt');
            }
            this.closeEditor();
            this.load();
        } catch (e) {
            console.error('Save error:', e);
            showToast('Fehler beim Speichern', 'error');
        }
    },
    
    edit(id) {
        this.openEditor(id);
    },
    
    async duplicate(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        
        const newData = { ...item };
        delete newData.id;
        newData.title = item.title + ' (Kopie)';
        newData.active = false;
        newData.views = 0;
        newData.dismisses = 0;
        newData.clicks = 0;
        newData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        newData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        try {
            await db.collection('announcements').add(newData);
            showToast('Banner dupliziert');
            this.load();
        } catch (e) {
            showToast('Fehler', 'error');
        }
    },
    
    async toggleActive(id, active) {
        try {
            await db.collection('announcements').doc(id).update({ active: active });
            const item = this.items.find(i => i.id === id);
            if (item) item.active = active;
            this.updateActiveBanner();
            this.renderStats();
            showToast(active ? 'Banner aktiviert' : 'Banner deaktiviert');
        } catch (e) {
            showToast('Fehler', 'error');
        }
    },
    
    showStats(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        
        const ctr = item.clicks && item.views ? ((item.clicks / item.views) * 100).toFixed(1) : 0;
        const dismissRate = item.dismisses && item.views ? ((item.dismisses / item.views) * 100).toFixed(1) : 0;
        
        const html = '<div class="modal active" onclick="if(event.target===this)this.remove()">' +
            '<div class="modal__content" style="max-width:400px;">' +
            '<div class="modal__header"><h3 class="modal__title">Banner Statistiken</h3>' +
            '<button class="btn btn--ghost" onclick="this.closest(\'.modal\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            '<h4 style="margin-bottom:16px;">' + item.title + '</h4>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
            '<div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:var(--accent);">' + (item.views || 0) + '</div><div style="font-size:12px;color:var(--text-muted);">Aufrufe</div></div>' +
            '<div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:var(--green);">' + (item.clicks || 0) + '</div><div style="font-size:12px;color:var(--text-muted);">Klicks</div></div>' +
            '<div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:var(--text-muted);">' + (item.dismisses || 0) + '</div><div style="font-size:12px;color:var(--text-muted);">Geschlossen</div></div>' +
            '<div style="background:var(--bg);padding:16px;border-radius:8px;text-align:center;"><div style="font-size:28px;font-weight:700;color:' + (ctr > 5 ? 'var(--green)' : 'var(--text-muted)') + ';">' + ctr + '%</div><div style="font-size:12px;color:var(--text-muted);">Click-Rate</div></div>' +
            '</div>' +
            '<div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:8px;">' +
            '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Dismiss-Rate</div>' +
            '<div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="width:' + dismissRate + '%;height:100%;background:var(--accent);"></div></div>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + dismissRate + '% der Nutzer schließen den Banner</div>' +
            '</div>' +
            '</div></div></div>';
        
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    filter() {
        const statusFilter = document.getElementById('bannerFilterStatus')?.value || '';
        const typeFilter = document.getElementById('bannerFilterType')?.value || '';
        
        const now = new Date();
        const filtered = this.items.filter(item => {
            // Status filter
            if (statusFilter) {
                const isScheduled = item.startDate && new Date(item.startDate.toDate ? item.startDate.toDate() : item.startDate) > now;
                const isExpired = item.endDate && new Date(item.endDate.toDate ? item.endDate.toDate() : item.endDate) < now;
                
                if (statusFilter === 'active' && (!item.active || isExpired)) return false;
                if (statusFilter === 'scheduled' && !isScheduled) return false;
                if (statusFilter === 'inactive' && (item.active || isScheduled)) return false;
            }
            
            // Type filter
            if (typeFilter && item.level !== typeFilter) return false;
            
            return true;
        });
        
        // Re-render with filtered items
        const originalItems = this.items;
        this.items = filtered;
        this.render();
        this.items = originalItems;
    },
    
    async delete(id) {
        if (!confirm('Banner wirklich löschen?')) return;
        try {
            await db.collection('announcements').doc(id).delete();
            showToast('Banner gelöscht');
            this.load();
        } catch (e) {
            showToast('Fehler', 'error');
        }
    }
};
*/

// ========================================
// ANALYTICS ADMIN MODULE
// ========================================
const AnalyticsAdmin = {
    data: null,
    
    async load() {
        try {
            const usersSnap = await db.collection('users').get();
            const sessionsSnap = await db.collection('rooms').get();
            this.data = { 
                users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })), 
                sessions: sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) 
            };
            this.updateStats();
            this.renderCharts();
            console.log('[Admin] Analytics loaded');
        } catch (e) { console.error('Analytics error:', e); }
    },
    
    updateStats() {
        if (!this.data) return;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7*24*60*60*1000);
        const monthAgo = new Date(today.getTime() - 30*24*60*60*1000);
        document.getElementById('statAnalyticsDAU').textContent = this.data.users.filter(u => { var l = u.lastLogin?.toDate?.(); return l && l >= today; }).length;
        document.getElementById('statAnalyticsWAU').textContent = this.data.users.filter(u => { var l = u.lastLogin?.toDate?.(); return l && l >= weekAgo; }).length;
        document.getElementById('statAnalyticsMAU').textContent = this.data.users.filter(u => { var l = u.lastLogin?.toDate?.(); return l && l >= monthAgo; }).length;
        document.getElementById('statAnalyticsNewUsers').textContent = this.data.users.filter(u => { var c = u.createdAt?.toDate?.(); return c && c >= monthAgo; }).length;
        document.getElementById('statAnalyticsSessions').textContent = this.data.sessions.length;
    },
    
    renderCharts() {
        // Activity Chart
        const activityContainer = document.getElementById('activityChart');
        if (activityContainer && this.data) {
            const days = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
                const next = new Date(d.getTime() + 24*60*60*1000);
                const count = this.data.users.filter(u => { var l = u.lastLogin?.toDate?.(); return l && l >= d && l < next; }).length;
                days.push({ date: d, count: count });
            }
            const max = Math.max(...days.map(d => d.count), 1);
            activityContainer.innerHTML = days.map(d => 
                '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">' +
                '<div style="width:100%;max-width:20px;height:' + (d.count/max*200) + 'px;min-height:2px;background:var(--accent);border-radius:2px;"></div>' +
                '<span style="font-size:9px;color:var(--text-muted);">' + d.date.getDate() + '</span></div>'
            ).join('');
        }
        
        // Peak Times
        const peakContainer = document.getElementById('peakTimesChart');
        if (peakContainer) {
            const times = [['18-20 Uhr', 35], ['20-22 Uhr', 45], ['22-00 Uhr', 30], ['14-18 Uhr', 20]];
            peakContainer.innerHTML = times.map(t =>
                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
                '<span style="width:80px;font-size:13px;color:var(--text-muted);">' + t[0] + '</span>' +
                '<div style="flex:1;height:20px;background:var(--bg);border-radius:4px;overflow:hidden;">' +
                '<div style="width:' + t[1] + '%;height:100%;background:var(--accent);"></div></div>' +
                '<span style="width:35px;text-align:right;font-weight:600;">' + t[1] + '%</span></div>'
            ).join('');
        }
        
        // Popular Pages
        const pagesContainer = document.getElementById('popularPages');
        if (pagesContainer) {
            const pages = [['Hub', '🏠', 100], ['Charakterbogen', '📜', 75], ['Würfel', '🎲', 60], ['Sessions', '⚔️', 50]];
            pagesContainer.innerHTML = pages.map(p =>
                '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">' +
                '<span style="font-size:18px;">' + p[1] + '</span>' +
                '<div style="flex:1;"><div style="font-weight:500;">' + p[0] + '</div>' +
                '<div style="height:4px;background:var(--bg);border-radius:2px;margin-top:4px;">' +
                '<div style="width:' + p[2] + '%;height:100%;background:var(--accent);"></div></div></div></div>'
            ).join('');
        }
        
        // Device Stats
        const deviceContainer = document.getElementById('deviceStats');
        if (deviceContainer) {
            deviceContainer.innerHTML = '<div style="display:flex;height:24px;border-radius:12px;overflow:hidden;margin-bottom:16px;">' +
                '<div style="width:65%;background:#8B5CF6;"></div>' +
                '<div style="width:28%;background:#3B82F6;"></div>' +
                '<div style="width:7%;background:#22C55E;"></div></div>' +
                '<div style="display:flex;justify-content:center;gap:24px;">' +
                '<div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:#8B5CF6;border-radius:3px;"></div><span>Desktop 65%</span></div>' +
                '<div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:#3B82F6;border-radius:3px;"></div><span>Mobile 28%</span></div>' +
                '<div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:#22C55E;border-radius:3px;"></div><span>Tablet 7%</span></div></div>';
        }
    }
};

// ========================================
// CHANGELOG ADMIN MODULE
// ========================================
const ChangelogAdmin = {
    versions: [],
    editingId: null,
    
    async load() {
        try {
            const snap = await db.collection('changelog').orderBy('date', 'desc').get();
            this.versions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render();
            console.log('[Admin] Loaded', this.versions.length, 'changelog versions');
        } catch (e) { 
            console.warn('Changelog collection not accessible:', e.message);
            this.versions = [];
            this.render();
        }
    },
    
    render() {
        const container = document.getElementById('changelogList');
        if (!container) return;
        if (this.versions.length === 0) { 
            container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Versionen</div>'; 
            return; 
        }
        container.innerHTML = this.versions.map(v => {
            var latestBadge = v.latest ? '<span style="padding:2px 8px;background:var(--green);color:white;border-radius:10px;font-size:11px;margin-left:8px;">LATEST</span>' : '';
            var changesHtml = (v.changes || []).map(c => {
                var color = this.getColor(c.type);
                return '<div style="padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:8px;display:flex;gap:10px;">' +
                    '<span style="padding:2px 6px;background:' + color + '20;color:' + color + ';border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;">' + c.type + '</span>' +
                    '<span style="font-size:14px;">' + c.text + '</span></div>';
            }).join('');
            return '<div style="padding:24px;border-bottom:1px solid var(--border);">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">' +
                '<div><span style="font-size:20px;font-weight:700;color:var(--accent);">v' + v.version + '</span>' + latestBadge +
                '<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">' + this.formatDate(v.date) + '</div></div>' +
                '<div style="display:flex;gap:8px;"><button class="btn btn--ghost btn--small" onclick="ChangelogAdmin.edit(\'' + v.id + '\')">Edit</button>' +
                '<button class="btn btn--ghost btn--small" onclick="ChangelogAdmin.delete(\'' + v.id + '\')" style="color:var(--red);">Delete</button></div></div>' +
                '<div style="font-weight:600;margin-bottom:12px;">' + (v.title||'') + '</div>' + changesHtml + '</div>';
        }).join('');
    },
    
    getColor(type) { 
        var colors = { neu:'#22C55E', new:'#22C55E', fix:'#3B82F6', verbesserung:'#8B5CF6', entfernt:'#EF4444' }; 
        return colors[(type||'').toLowerCase()] || '#666'; 
    },
    
    openEditor(id) {
        this.editingId = id || null;
        const item = id ? this.versions.find(v => v.id === id) : null;
        var changesText = item?.changes ? item.changes.map(c => c.type.toUpperCase() + ': ' + c.text).join('\n') : '';
        var dateVal = item?.date ? new Date(item.date.toDate ? item.date.toDate() : item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const html = '<div class="modal active" id="changelogModal" onclick="if(event.target===this)ChangelogAdmin.closeEditor()">' +
            '<div class="modal__content modal__content--wide"><div class="modal__header"><h3 class="modal__title">' + (id?'Version bearbeiten':'Neue Version') + '</h3>' +
            '<button class="btn btn--ghost" onclick="ChangelogAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body"><div class="form-row"><div class="form-group"><label class="form-label">Version</label>' +
            '<input type="text" class="form-input" id="changelogVersion" value="' + (item?.version||'') + '" placeholder="z.B. 3.1.0"></div>' +
            '<div class="form-group"><label class="form-label">Datum</label><input type="date" class="form-input" id="changelogDate" value="' + dateVal + '"></div></div>' +
            '<div class="form-group"><label class="form-label">Titel</label><input type="text" class="form-input" id="changelogTitle" value="' + (item?.title||'') + '" placeholder="z.B. Performance Update"></div>' +
            '<div class="form-group"><label class="form-label">Änderungen (TYP: Text, eine pro Zeile)</label>' +
            '<textarea class="form-textarea form-textarea--large" id="changelogChanges" placeholder="NEU: Feature X\nFIX: Bug Y">' + changesText + '</textarea></div>' +
            '<div class="form-group"><label class="form-checkbox"><input type="checkbox" id="changelogLatest"' + (item?.latest?' checked':'') + '><span>Als aktuelle Version markieren</span></label></div></div>' +
            '<div class="modal__footer"><button class="btn btn--secondary" onclick="ChangelogAdmin.closeEditor()">Abbrechen</button>' +
            '<button class="btn btn--primary" onclick="ChangelogAdmin.save()">Speichern</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { var m = document.getElementById('changelogModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const version = document.getElementById('changelogVersion').value.trim();
        const date = document.getElementById('changelogDate').value;
        const title = document.getElementById('changelogTitle').value.trim();
        const changesText = document.getElementById('changelogChanges').value.trim();
        const latest = document.getElementById('changelogLatest').checked;
        if (!version) { showToast('Version eingeben', 'error'); return; }
        const changes = changesText.split('\n').filter(l => l.trim()).map(l => { 
            var m = l.match(/^(\w+):\s*(.+)$/); 
            return m ? { type: m[1].toLowerCase(), text: m[2] } : { type: 'neu', text: l }; 
        });
        const data = { version: version, date: new Date(date), title: title, changes: changes, latest: latest, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (latest) { 
                var batch = db.batch(); 
                this.versions.filter(v => v.latest && v.id !== this.editingId).forEach(v => batch.update(db.collection('changelog').doc(v.id), { latest: false })); 
                await batch.commit(); 
            }
            if (this.editingId) { await db.collection('changelog').doc(this.editingId).update(data); } 
            else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('changelog').add(data); }
            showToast('Gespeichert'); this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async delete(id) { if (!confirm('Löschen?')) return; try { await db.collection('changelog').doc(id).delete(); showToast('Gelöscht'); this.load(); } catch(e) { showToast('Fehler','error'); } },
    formatDate(ts) { if (!ts) return '—'; var d = ts.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'long', year:'numeric' }).format(d); }
};

// ========================================
// FAQ ADMIN MODULE
// ========================================
const FAQAdmin = {
    items: [], 
    categories: [], 
    editingId: null,
    
    async load() {
        try {
            const faqSnap = await db.collection('faq').orderBy('order').get();
            this.items = faqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { 
            console.warn('FAQ collection not accessible:', e.message);
            this.items = [];
        }
        try {
            const catSnap = await db.collection('faq_categories').orderBy('order').get();
            this.categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('FAQ categories not accessible:', e.message);
            this.categories = [];
        }
        this.render(); 
        this.renderCategories();
        console.log('[Admin] Loaded', this.items.length, 'FAQs');
    },
    
    renderCategories() {
        const c = document.getElementById('faqCategories'); 
        if (!c) return;
        if (this.categories.length === 0) {
            c.innerHTML = '<span style="color:var(--text-muted);">Keine Kategorien</span>';
            return;
        }
        c.innerHTML = this.categories.map(cat => {
            var count = this.items.filter(i => i.category === cat.id).length;
            return '<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:' + (cat.color||'#666') + '20;color:' + (cat.color||'#666') + ';border-radius:16px;font-size:13px;">' + 
                cat.name + ' <span style="font-weight:600;">' + count + '</span></span>';
        }).join('');
    },
    
    render() {
        const c = document.getElementById('faqList'); 
        if (!c) return;
        if (this.items.length === 0) { 
            c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine FAQs</div>'; 
            return; 
        }
        c.innerHTML = this.items.map(i => {
            var cat = this.categories.find(x => x.id === i.category);
            var catBadge = cat ? '<span style="padding:2px 8px;background:' + (cat.color||'#666') + '20;color:' + (cat.color||'#666') + ';border-radius:10px;font-size:11px;">' + cat.name + '</span>' : '';
            var answerPreview = (i.answer||'').substring(0,150) + (i.answer?.length > 150 ? '...' : '');
            return '<div style="padding:20px 24px;border-bottom:1px solid var(--border);">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;"><div style="flex:1;">' +
                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><span style="font-weight:600;">' + i.question + '</span>' + catBadge + '</div>' +
                '<p style="color:var(--text-muted);font-size:14px;max-width:600px;">' + answerPreview + '</p></div>' +
                '<div style="display:flex;gap:8px;"><button class="btn btn--ghost btn--small" onclick="FAQAdmin.edit(\'' + i.id + '\')">Edit</button>' +
                '<button class="btn btn--ghost btn--small" onclick="FAQAdmin.delete(\'' + i.id + '\')" style="color:var(--red);">Delete</button></div></div></div>';
        }).join('');
    },
    
    openEditor(id) {
        this.editingId = id || null;
        const item = id ? this.items.find(i => i.id === id) : null;
        var catOptions = this.categories.map(c => '<option value="' + c.id + '"' + (item?.category===c.id?' selected':'') + '>' + c.name + '</option>').join('');
        const html = '<div class="modal active" id="faqModal" onclick="if(event.target===this)FAQAdmin.closeEditor()">' +
            '<div class="modal__content"><div class="modal__header"><h3 class="modal__title">' + (id?'FAQ bearbeiten':'Neue FAQ') + '</h3>' +
            '<button class="btn btn--ghost" onclick="FAQAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body"><div class="form-group"><label class="form-label">Frage</label>' +
            '<input type="text" class="form-input" id="faqQuestion" value="' + (item?.question||'') + '" placeholder="Wie kann ich...?"></div>' +
            '<div class="form-group"><label class="form-label">Antwort</label>' +
            '<textarea class="form-textarea form-textarea--large" id="faqAnswer" placeholder="Die Antwort...">' + (item?.answer||'') + '</textarea></div>' +
            '<div class="form-group"><label class="form-label">Kategorie</label>' +
            '<select class="form-select" id="faqCategory"><option value="">Keine</option>' + catOptions + '</select></div></div>' +
            '<div class="modal__footer"><button class="btn btn--secondary" onclick="FAQAdmin.closeEditor()">Abbrechen</button>' +
            '<button class="btn btn--primary" onclick="FAQAdmin.save()">Speichern</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { var m = document.getElementById('faqModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const question = document.getElementById('faqQuestion').value.trim();
        const answer = document.getElementById('faqAnswer').value.trim();
        const category = document.getElementById('faqCategory').value;
        if (!question || !answer) { showToast('Frage und Antwort eingeben', 'error'); return; }
        const data = { question: question, answer: answer, category: category || null, order: this.items.length, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (this.editingId) { await db.collection('faq').doc(this.editingId).update(data); } 
            else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('faq').add(data); }
            showToast('Gespeichert'); this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async delete(id) { if (!confirm('Löschen?')) return; try { await db.collection('faq').doc(id).delete(); showToast('Gelöscht'); this.load(); } catch(e) { showToast('Fehler','error'); } },
    openCategoryEditor() { 
        var name = prompt('Neue Kategorie:'); 
        if (!name) return; 
        var color = prompt('Farbe (Hex):', '#8B5CF6'); 
        db.collection('faq_categories').add({ name: name, color: color||'#8B5CF6', order: this.categories.length, createdAt: firebase.firestore.FieldValue.serverTimestamp() })
            .then(() => { showToast('Erstellt'); this.load(); }); 
    }
};

// ========================================
// RULESETS ADMIN MODULE
// ========================================
const RulesetsAdmin = {
    items: [], 
    editingId: null,
    
    async load() {
        try {
            const snap = await db.collection('rulesets').orderBy('order').get();
            this.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render();
            console.log('[Admin] Loaded', this.items.length, 'rulesets');
        } catch (e) { 
            console.warn('Rulesets collection not accessible:', e.message);
            this.items = [];
            this.render();
        }
    },
    
    render() {
        const c = document.getElementById('rulesetsGrid'); 
        if (!c) return;
        if (this.items.length === 0) { 
            c.innerHTML = '<div style="text-align:center;padding:60px;grid-column:1/-1;color:var(--text-muted);">Keine Regelwerke</div>'; 
            return; 
        }
        c.innerHTML = this.items.map(i => {
            var isActive = i.active !== false;
            var icon = i.icon ? '<img src="' + i.icon + '" style="height:60px;">' : '<span style="font-size:48px;">' + (i.emoji||'📖') + '</span>';
            return '<div class="card" style="overflow:hidden;">' +
                '<div style="height:120px;background:' + (i.color||'#8B5CF6') + '20;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--border);">' + icon + '</div>' +
                '<div style="padding:20px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span style="font-weight:600;font-size:16px;">' + i.name + '</span>' +
                '<span style="width:10px;height:10px;border-radius:50%;background:' + (isActive?'var(--green)':'var(--red)') + ';"></span></div>' +
                '<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;min-height:40px;">' + (i.description||'Keine Beschreibung') + '</p>' +
                '<div style="display:flex;gap:8px;"><button class="btn btn--secondary btn--small" style="flex:1;" onclick="RulesetsAdmin.edit(\'' + i.id + '\')">Bearbeiten</button>' +
                '<button class="btn btn--ghost btn--small" onclick="RulesetsAdmin.toggleActive(\'' + i.id + '\',' + !isActive + ')" style="color:' + (isActive?'var(--red)':'var(--green)') + ';">' + (isActive?'Deaktivieren':'Aktivieren') + '</button></div></div></div>';
        }).join('');
    },
    
    openEditor(id) {
        this.editingId = id || null;
        const item = id ? this.items.find(i => i.id === id) : null;
        const html = '<div class="modal active" id="rulesetModal" onclick="if(event.target===this)RulesetsAdmin.closeEditor()">' +
            '<div class="modal__content"><div class="modal__header"><h3 class="modal__title">' + (id?'Regelwerk bearbeiten':'Neues Regelwerk') + '</h3>' +
            '<button class="btn btn--ghost" onclick="RulesetsAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body"><div class="form-group"><label class="form-label">Name</label>' +
            '<input type="text" class="form-input" id="rulesetName" value="' + (item?.name||'') + '" placeholder="z.B. D&D 5e"></div>' +
            '<div class="form-group"><label class="form-label">Beschreibung</label>' +
            '<textarea class="form-textarea" id="rulesetDescription" placeholder="Kurze Beschreibung...">' + (item?.description||'') + '</textarea></div>' +
            '<div class="form-row"><div class="form-group"><label class="form-label">Emoji</label>' +
            '<input type="text" class="form-input" id="rulesetEmoji" value="' + (item?.emoji||'') + '" placeholder="📖"></div>' +
            '<div class="form-group"><label class="form-label">Farbe</label>' +
            '<input type="color" class="form-input" id="rulesetColor" value="' + (item?.color||'#8B5CF6') + '" style="height:42px;padding:4px;"></div></div>' +
            '<div class="form-group"><label class="form-checkbox"><input type="checkbox" id="rulesetActive"' + (item?.active!==false?' checked':'') + '><span>Aktiv</span></label></div></div>' +
            '<div class="modal__footer"><button class="btn btn--secondary" onclick="RulesetsAdmin.closeEditor()">Abbrechen</button>' +
            '<button class="btn btn--primary" onclick="RulesetsAdmin.save()">Speichern</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { var m = document.getElementById('rulesetModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const name = document.getElementById('rulesetName').value.trim();
        const description = document.getElementById('rulesetDescription').value.trim();
        const emoji = document.getElementById('rulesetEmoji').value.trim();
        const color = document.getElementById('rulesetColor').value;
        const active = document.getElementById('rulesetActive').checked;
        if (!name) { showToast('Name eingeben', 'error'); return; }
        const data = { name: name, description: description, emoji: emoji||'📖', color: color, active: active, order: this.items.length, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (this.editingId) { await db.collection('rulesets').doc(this.editingId).update(data); } 
            else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('rulesets').add(data); }
            showToast('Gespeichert'); this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async toggleActive(id, active) { try { await db.collection('rulesets').doc(id).update({ active: active }); showToast(active?'Aktiviert':'Deaktiviert'); this.load(); } catch(e) { showToast('Fehler','error'); } }
};

// ========================================
// ASSETS ADMIN MODULE (with Cloudinary)
// ========================================
const AssetsAdmin = {
    items: [],
    cloudinaryConfig: {
        cloudName: 'dza4jgreq',
        uploadPreset: 'RIFTapp'
    },
    
    async load() {
        try {
            const snap = await db.collection('assets').orderBy('createdAt', 'desc').get();
            this.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render(); 
            this.updateStats();
            console.log('[Admin] Loaded', this.items.length, 'assets');
        } catch (e) { 
            console.warn('Assets collection not accessible:', e.message);
            this.items = [];
            this.render();
            this.updateStats();
        }
    },
    
    render() {
        const c = document.getElementById('assetsContainer'); 
        if (!c) return;
        if (this.items.length === 0) { 
            c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Assets vorhanden<br><br><button class="btn btn--primary" onclick="AssetsAdmin.openUpload()">Erstes Asset hochladen</button></div>'; 
            return; 
        }
        c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;">' +
            this.items.map(i => {
                var preview = i.url ? '<img src="' + i.url + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy">' : '<span style="font-size:32px;">📁</span>';
                return '<div style="background:var(--bg-elevated);border-radius:8px;overflow:hidden;cursor:pointer;position:relative;" onclick="AssetsAdmin.view(\'' + i.id + '\')">' +
                    '<div style="aspect-ratio:1;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;">' + preview + '</div>' +
                    '<div style="padding:10px;"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (i.name||'Unbenannt') + '</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);">' + (i.type||'image') + '</div></div>' +
                    '<button onclick="event.stopPropagation();AssetsAdmin.delete(\'' + i.id + '\')" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);border:none;color:white;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:12px;">✕</button></div>';
            }).join('') + '</div>';
    },
    
    updateStats() {
        document.getElementById('statAssetsTotal').textContent = this.items.length;
        document.getElementById('statAssetsImages').textContent = this.items.filter(i => i.type === 'image').length;
        document.getElementById('statAssetsPortraits').textContent = this.items.filter(i => (i.type || '').startsWith('portrait-')).length;
        document.getElementById('statAssetsStorage').textContent = this.formatSize(this.items.reduce((s,i) => s + (i.size||0), 0));
    },
    
    filter() {
        var search = document.getElementById('assetSearch').value.toLowerCase();
        var type = document.getElementById('assetTypeFilter').value;
        var filtered = this.items.filter(function(i) {
            var matchSearch = !search || (i.name||'').toLowerCase().includes(search);
            var matchType = !type || i.type === type;
            return matchSearch && matchType;
        });
        var orig = this.items;
        this.items = filtered;
        this.render();
        this.items = orig;
    },
    
    openUpload() {
        var html = '<div class="modal active" id="assetUploadModal" onclick="if(event.target===this)AssetsAdmin.closeUpload()">' +
            '<div class="modal__content"><div class="modal__header"><h3 class="modal__title">Asset hochladen</h3>' +
            '<button class="btn btn--ghost" onclick="AssetsAdmin.closeUpload()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            '<div id="uploadDropzone" style="border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all 0.2s;" onclick="document.getElementById(\'assetFileInput\').click()" ondragover="event.preventDefault();this.style.borderColor=\'var(--accent)\';this.style.background=\'var(--accent-dim)\'" ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'transparent\'" ondrop="event.preventDefault();this.style.borderColor=\'var(--border)\';this.style.background=\'transparent\';AssetsAdmin.handleFiles(event.dataTransfer.files)">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
            '<div style="font-weight:500;margin-bottom:8px;">Dateien hierher ziehen</div>' +
            '<div style="font-size:13px;color:var(--text-muted);">oder klicken zum Auswählen</div>' +
            '<input type="file" id="assetFileInput" style="display:none;" accept="image/*" multiple onchange="AssetsAdmin.handleFiles(this.files)">' +
            '</div>' +
            '<div id="uploadPreview" style="margin-top:16px;display:none;"></div>' +
            '<div class="form-row" style="margin-top:16px;">' +
            '<div class="form-group"><label class="form-label">Typ</label>' +
            '<select class="form-select" id="uploadAssetType">' +
            '<optgroup label="Allgemein">' +
            '<option value="image">Bild</option>' +
            '<option value="token">Token</option>' +
            '<option value="map">Map</option>' +
            '<option value="icon">Icon</option>' +
            '</optgroup>' +
            '<optgroup label="Portraits">' +
            '<option value="portrait">Portrait (Allgemein)</option>' +
            '<option value="portrait-worldsapart">Portrait (Worlds Apart)</option>' +
            '<option value="portrait-dnd5e">Portrait (D&amp;D 5e)</option>' +
            '<option value="portrait-htbah">Portrait (HTBAH)</option>' +
            '<option value="portrait-cyberpunk">Portrait (Cyberpunk)</option>' +
            '</optgroup>' +
            '<optgroup label="Dice Modul">' +
            '<option value="dice-arena">Dice Arena</option>' +
            '<option value="dice-texture">Dice Textures</option>' +
            '</optgroup>' +
            '<optgroup label="RIFT">' +
            '<option value="news-cover">News-Cover</option>' +
            '<option value="carousel-cover">Carousel-Cover</option>' +
            '<option value="feature-asset">Feature-Assets</option>' +
            '</optgroup>' +
            '</select></div>' +
            '</div>' +
            '</div>' +
            '<div class="modal__footer"><button class="btn btn--secondary" onclick="AssetsAdmin.closeUpload()">Abbrechen</button>' +
            '<button class="btn btn--primary" id="uploadBtn" onclick="AssetsAdmin.uploadFiles()" disabled>Hochladen</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        this.pendingFiles = [];
    },
    
    closeUpload() { 
        var m = document.getElementById('assetUploadModal'); 
        if (m) m.remove(); 
        this.pendingFiles = [];
    },
    
    handleFiles(files) {
        this.pendingFiles = Array.from(files);
        var preview = document.getElementById('uploadPreview');
        var btn = document.getElementById('uploadBtn');
        
        if (this.pendingFiles.length === 0) {
            preview.style.display = 'none';
            btn.disabled = true;
            return;
        }
        
        preview.style.display = 'block';
        preview.innerHTML = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">' + this.pendingFiles.length + ' Datei(en) ausgewählt:</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            this.pendingFiles.map(function(f) {
                return '<div style="padding:8px 12px;background:var(--bg);border-radius:6px;font-size:12px;">' + f.name + ' (' + AssetsAdmin.formatSize(f.size) + ')</div>';
            }).join('') + '</div>';
        btn.disabled = false;
    },
    
    async uploadFiles() {
        if (!this.pendingFiles || this.pendingFiles.length === 0) return;
        
        var btn = document.getElementById('uploadBtn');
        btn.disabled = true;
        btn.textContent = 'Lädt...';
        
        var type = document.getElementById('uploadAssetType').value;
        var uploaded = 0;
        var errors = 0;
        
        for (var i = 0; i < this.pendingFiles.length; i++) {
            var file = this.pendingFiles[i];
            try {
                var url = await this.uploadToCloudinary(file);
                
                // Save to Firestore
                await db.collection('assets').add({
                    name: file.name,
                    url: url,
                    type: type,
                    size: file.size,
                    mimeType: file.type,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    uploadedBy: currentUser?.uid || null
                });
                uploaded++;
            } catch (e) {
                console.error('Upload error:', e);
                errors++;
            }
        }
        
        this.closeUpload();
        
        if (uploaded > 0) {
            showToast(uploaded + ' Asset(s) hochgeladen');
            this.load();
        }
        if (errors > 0) {
            showToast(errors + ' Upload(s) fehlgeschlagen', 'error');
        }
    },
    
    async uploadToCloudinary(file) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
        formData.append('folder', 'rift-assets');
        
        var response = await fetch('https://api.cloudinary.com/v1_1/' + this.cloudinaryConfig.cloudName + '/image/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Cloudinary upload failed');
        }
        
        var data = await response.json();
        return data.secure_url;
    },
    
    view(id) { 
        var i = this.items.find(function(x) { return x.id === id; }); 
        if (i && i.url) {
            var typeOptions = [
                { group: 'Allgemein', items: [
                    { value: 'image', label: 'Bild' },
                    { value: 'token', label: 'Token' },
                    { value: 'map', label: 'Map' },
                    { value: 'icon', label: 'Icon' }
                ]},
                { group: 'Portraits', items: [
                    { value: 'portrait', label: 'Portrait (Allgemein)' },
                    { value: 'portrait-worldsapart', label: 'Portrait (Worlds Apart)' },
                    { value: 'portrait-dnd5e', label: 'Portrait (D&D 5e)' },
                    { value: 'portrait-htbah', label: 'Portrait (HTBAH)' },
                    { value: 'portrait-cyberpunk', label: 'Portrait (Cyberpunk)' }
                ]},
                { group: 'Dice Modul', items: [
                    { value: 'dice-arena', label: 'Dice Arena' },
                    { value: 'dice-texture', label: 'Dice Textures' }
                ]},
                { group: 'RIFT', items: [
                    { value: 'news-cover', label: 'News-Cover' },
                    { value: 'carousel-cover', label: 'Carousel-Cover' },
                    { value: 'feature-asset', label: 'Feature-Assets' }
                ]}
            ];
            var selectHtml = typeOptions.map(function(g) {
                return '<optgroup label="' + g.group + '">' + g.items.map(function(opt) {
                    return '<option value="' + opt.value + '"' + (i.type === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
                }).join('') + '</optgroup>';
            }).join('');
            
            var html = '<div class="modal active" id="assetViewModal" onclick="if(event.target===this)this.remove()">' +
                '<div class="modal__content" style="max-width:600px;">' +
                '<div class="modal__header"><h3 class="modal__title">Asset bearbeiten</h3>' +
                '<button class="btn btn--ghost" onclick="document.getElementById(\'assetViewModal\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
                '<div class="modal__body">' +
                '<div style="display:flex;gap:20px;">' +
                '<div class="asset-preview-container" style="width:200px;height:200px;background:var(--bg);border-radius:8px;overflow:hidden;flex-shrink:0;position:relative;cursor:zoom-in;" onmouseenter="AssetsAdmin.showFullPreview(this, \'' + i.url + '\')" onmouseleave="AssetsAdmin.hideFullPreview()">' +
                '<img src="' + i.url + '" style="width:100%;height:100%;object-fit:cover;">' +
                '<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:4px;font-size:10px;color:#fff;pointer-events:none;">Hover für Vollbild</div>' +
                '</div>' +
                '<div style="flex:1;">' +
                '<div class="form-group"><label class="form-label">Name</label>' +
                '<input type="text" class="form-input" id="editAssetName" value="' + (i.name || '').replace(/"/g, '&quot;') + '"></div>' +
                '<div class="form-group"><label class="form-label">Kategorie</label>' +
                '<select class="form-select" id="editAssetType">' + selectHtml + '</select></div>' +
                '<div class="form-group"><label class="form-label">URL</label>' +
                '<div style="display:flex;gap:8px;">' +
                '<input type="text" class="form-input" value="' + i.url + '" readonly style="flex:1;font-size:12px;">' +
                '<button class="btn btn--secondary" onclick="navigator.clipboard.writeText(\'' + i.url + '\');showToast(\'URL kopiert\')">Kopieren</button>' +
                '</div></div>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">Größe: ' + this.formatSize(i.size) + '</div>' +
                '</div></div></div>' +
                '<div class="modal__footer">' +
                '<button class="btn btn--ghost" style="color:var(--red);" onclick="AssetsAdmin.delete(\'' + i.id + '\');document.getElementById(\'assetViewModal\').remove()">Löschen</button>' +
                '<div style="flex:1;"></div>' +
                '<button class="btn btn--secondary" onclick="document.getElementById(\'assetViewModal\').remove()">Abbrechen</button>' +
                '<button class="btn btn--primary" onclick="AssetsAdmin.saveEdit(\'' + i.id + '\')">Speichern</button>' +
                '</div></div></div>';
            document.body.insertAdjacentHTML('beforeend', html);
        }
    },
    
    showFullPreview(element, url) {
        var rect = element.getBoundingClientRect();
        var preview = document.createElement('div');
        preview.id = 'assetFullPreview';
        preview.style.cssText = 'position:fixed;z-index:99999;background:var(--bg-elevated);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;max-width:80vw;max-height:80vh;';
        
        // Position to the right of the thumbnail, or left if not enough space
        var left = rect.right + 20;
        if (left + 400 > window.innerWidth) {
            left = rect.left - 420;
        }
        var top = Math.max(20, rect.top - 100);
        if (top + 400 > window.innerHeight) {
            top = window.innerHeight - 420;
        }
        
        preview.style.left = left + 'px';
        preview.style.top = top + 'px';
        preview.innerHTML = '<img src="' + url + '" style="max-width:400px;max-height:400px;display:block;">';
        document.body.appendChild(preview);
    },
    
    hideFullPreview() {
        var preview = document.getElementById('assetFullPreview');
        if (preview) preview.remove();
    },
    
    async saveEdit(id) {
        var name = document.getElementById('editAssetName').value.trim();
        var type = document.getElementById('editAssetType').value;
        
        if (!name) {
            showToast('Name erforderlich', 'error');
            return;
        }
        
        try {
            await db.collection('assets').doc(id).update({
                name: name,
                type: type,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Asset aktualisiert');
            document.getElementById('assetViewModal').remove();
            this.load();
        } catch (e) {
            console.error('Update error:', e);
            showToast('Fehler beim Speichern', 'error');
        }
    },
    
    async delete(id) {
        if (!confirm('Asset löschen?')) return;
        try {
            await db.collection('assets').doc(id).delete();
            showToast('Gelöscht');
            this.load();
        } catch (e) {
            showToast('Fehler', 'error');
        }
    },
    
    formatSize(b) { 
        if (!b) return '0 B'; 
        var s = ['B','KB','MB','GB']; 
        var i = Math.floor(Math.log(b)/Math.log(1024)); 
        return Math.round(b/Math.pow(1024,i)*100)/100 + ' ' + s[i]; 
    }
};

// ========================================
// AUDIT LOG ADMIN MODULE
// ========================================
const AuditAdmin = {
    logs: [],
    
    async load() {
        try {
            const snap = await db.collection('audit_log').orderBy('timestamp', 'desc').limit(200).get();
            this.logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render();
            console.log('[Admin] Loaded', this.logs.length, 'audit logs');
        } catch (e) { 
            console.warn('Audit log collection not accessible:', e.message);
            this.logs = [];
            this.render();
        }
    },
    
    render() {
        const c = document.getElementById('auditLogContainer'); 
        if (!c) return;
        if (this.logs.length === 0) { 
            c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Einträge</div>'; 
            return; 
        }
        const actionColors = { create:'#22C55E', update:'#3B82F6', delete:'#EF4444', login:'#8B5CF6', settings:'#F59E0B' };
        const actionTexts = { create:'hat erstellt:', update:'hat bearbeitet:', delete:'hat gelöscht:', login:'hat sich angemeldet', settings:'hat Einstellungen geändert:' };
        c.innerHTML = this.logs.map(l => {
            var ac = actionColors[l.action] || '#666';
            var at = actionTexts[l.action] || l.action;
            return '<div style="padding:16px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;">' +
                '<div style="width:36px;height:36px;border-radius:8px;background:' + ac + '20;color:' + ac + ';display:flex;align-items:center;justify-content:center;">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>' +
                '<div style="flex:1;"><div style="font-size:14px;"><span style="font-weight:500;">' + (l.userName||'System') + '</span> <span style="color:var(--text-muted);">' + at + '</span> <span style="font-weight:500;">' + (l.targetType||'') + '</span></div></div>' +
                '<div style="font-size:12px;color:var(--text-muted);">' + this.formatDate(l.timestamp) + '</div></div>';
        }).join('');
    },
    
    filter() {},
    export() {
        var data = this.logs.map(l => ({ timestamp: l.timestamp?.toDate?.()?.toISOString(), action: l.action, user: l.userName, target: (l.targetType||'') + ':' + (l.targetId||'') }));
        var blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rift-audit-log.json'; a.click();
        showToast('Export gestartet');
    },
    formatDate(ts) { if (!ts) return '—'; var d = ts.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(d); }
};

// ========================================
// SWITCH TAB OVERRIDE
// ========================================
(function() {
    var originalSwitchTab = window.switchTab;
    
    window.switchTab = function(tabId) {
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(function(tab) {
            var name = tab.textContent.toLowerCase().trim();
            var isActive = name.includes(tabId) || (tabId === 'announcements' && name.includes('banner'));
            tab.classList.toggle('active', isActive);
        });
        
        // Update pages
        document.querySelectorAll('.admin-page').forEach(function(page) {
            page.classList.toggle('active', page.id === 'page-' + tabId);
        });
        
        // Load data for the tab
        switch(tabId) {
            case 'users': UsersAdmin.load(); break;
            case 'sessions': SessionsAdmin.load(); break;
            case 'feedback': FeedbackAdmin.load(); break;
            case 'announcements': AnnouncementsAdmin.load(); break;
            case 'analytics': AnalyticsAdmin.load(); break;
            case 'changelog': ChangelogAdmin.load(); break;
            case 'faq': FAQAdmin.load(); break;
            case 'rulesets': RulesetsAdmin.load(); break;
            case 'assets': AssetsAdmin.load(); break;
            case 'arenaThemes': ArenaThemesAdmin.load(); break;
            case 'audit': AuditAdmin.load(); break;
            case 'team': TeamAdmin.load(); break;
            case 'carousel': if(typeof CarouselAdmin !== 'undefined') CarouselAdmin.load(); break;
            case 'quotes': if(typeof QuotesAdmin !== 'undefined') QuotesAdmin.load(); break;
            case 'news': if(typeof NewsAdmin !== 'undefined') NewsAdmin.load(); break;
            case 'features': if(typeof FeaturesAdmin !== 'undefined') FeaturesAdmin.load(); break;
        }
    };
})();

// ========================================
// TEAM ADMIN MODULE
// ========================================
const TeamAdmin = {
    admins: [],
    
    async load() {
        try {
            const doc = await db.collection('config').doc('admins').get();
            if (doc.exists && doc.data().list) {
                this.admins = doc.data().list;
            } else {
                // Initialize with current user if no list exists
                this.admins = [{
                    uid: firebase.auth().currentUser.uid,
                    name: firebase.auth().currentUser.displayName || 'Owner',
                    addedAt: new Date(),
                    addedBy: 'system',
                    isOwner: true
                }];
                await this.save();
            }
            this.render();
            console.log('[Admin] Loaded', this.admins.length, 'admins');
        } catch (e) {
            console.warn('[Team] Could not load admins:', e.message);
            this.admins = [];
            this.render();
        }
    },
    
    render() {
        const container = document.getElementById('adminList');
        const countEl = document.getElementById('adminCount');
        if (!container) return;
        
        if (countEl) countEl.textContent = this.admins.length;
        
        if (this.admins.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Admins konfiguriert</div>';
            return;
        }
        
        const currentUid = firebase.auth().currentUser?.uid;
        
        container.innerHTML = this.admins.map((admin, index) => {
            const isOwner = admin.isOwner || index === 0;
            const isSelf = admin.uid === currentUid;
            const addedDate = admin.addedAt?.toDate ? admin.addedAt.toDate() : (admin.addedAt ? new Date(admin.addedAt) : null);
            
            return `
                <div style="display:flex;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);gap:16px;">
                    <div style="width:48px;height:48px;border-radius:12px;background:${isOwner ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'var(--accent)'};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">
                        ${isOwner ? '👑' : (admin.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600;display:flex;align-items:center;gap:8px;">
                            ${admin.name || 'Unbenannt'}
                            ${isOwner ? '<span style="padding:2px 8px;background:#F59E0B20;color:#F59E0B;border-radius:10px;font-size:11px;">Owner</span>' : ''}
                            ${isSelf ? '<span style="padding:2px 8px;background:var(--accent)20;color:var(--accent);border-radius:10px;font-size:11px;">Du</span>' : ''}
                        </div>
                        <div style="font-size:13px;color:var(--text-muted);font-family:monospace;margin-top:2px;">${admin.uid}</div>
                        ${addedDate ? '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Hinzugefügt: ' + addedDate.toLocaleDateString('de-DE') + '</div>' : ''}
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn--ghost btn--small" onclick="navigator.clipboard.writeText('${admin.uid}');showToast('UID kopiert');" title="UID kopieren">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        ${!isOwner && !isSelf ? `
                            <button class="btn btn--ghost btn--small" onclick="TeamAdmin.removeAdmin('${admin.uid}')" title="Entfernen" style="color:var(--red);">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    async addAdmin() {
        const uidInput = document.getElementById('newAdminUid');
        const nameInput = document.getElementById('newAdminName');
        
        const uid = uidInput.value.trim();
        const name = nameInput.value.trim();
        
        if (!uid) {
            showToast('Bitte UID eingeben', 'error');
            return;
        }
        
        if (uid.length < 20) {
            showToast('UID scheint ungültig zu sein', 'error');
            return;
        }
        
        // Check if already exists
        if (this.admins.some(a => a.uid === uid)) {
            showToast('Diese UID ist bereits Admin', 'error');
            return;
        }
        
        // Add to list
        this.admins.push({
            uid: uid,
            name: name || 'Admin',
            addedAt: new Date(),
            addedBy: firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email || 'Unknown'
        });
        
        await this.save();
        
        uidInput.value = '';
        nameInput.value = '';
        
        showToast('Admin hinzugefügt');
        this.render();
    },
    
    async removeAdmin(uid) {
        const admin = this.admins.find(a => a.uid === uid);
        if (!admin) return;
        
        if (!confirm(`"${admin.name || uid}" wirklich als Admin entfernen?`)) return;
        
        this.admins = this.admins.filter(a => a.uid !== uid);
        await this.save();
        
        showToast('Admin entfernt');
        this.render();
    },
    
    async save() {
        try {
            // Save list format for display
            await db.collection('config').doc('admins').set({
                list: this.admins,
                uids: this.admins.map(a => a.uid),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error('[Team] Save error:', e);
            showToast('Fehler beim Speichern', 'error');
        }
    }
};

console.log('[Admin Extended] All modules loaded successfully');

// ========================================
// ARENA THEMES ADMIN MODULE
// ========================================
const ArenaThemesAdmin = {
    themes: [],
    cloudinaryConfig: {
        cloudName: 'dza4jgreq',
        uploadPreset: 'RIFTapp'
    },
    
    async load() {
        try {
            const snap = await db.collection('arenaThemes').orderBy('order', 'asc').get();
            this.themes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render();
            this.updateStats();
            this.populateSetFilter();
            console.log('[Admin] Loaded', this.themes.length, 'arena themes');
        } catch (e) {
            console.warn('Arena themes collection not accessible:', e.message);
            this.themes = [];
            this.render();
            this.updateStats();
        }
    },
    
    render() {
        const c = document.getElementById('arenaThemesContainer');
        if (!c) return;
        
        if (this.themes.length === 0) {
            c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Arena Themes vorhanden<br><br><button class="btn btn--primary" onclick="ArenaThemesAdmin.openEditor()">Erstes Theme erstellen</button></div>';
            return;
        }
        
        const tierColors = { free: '#22C55E', pro: '#bca24d' };
        const tierLabels = { free: 'Free', pro: 'Pro' };
        
        // Group by set
        const grouped = {};
        this.themes.forEach(t => {
            const setName = t.set || 'Ohne Set';
            if (!grouped[setName]) grouped[setName] = [];
            grouped[setName].push(t);
        });
        
        const sortedSets = Object.keys(grouped).sort((a, b) => {
            if (a === 'Ohne Set') return 1;
            if (b === 'Ohne Set') return -1;
            return a.localeCompare(b);
        });
        
        let html = '';
        sortedSets.forEach(setName => {
            const themes = grouped[setName];
            html += '<div style="margin-bottom:24px;">' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);">' +
                '<span style="font-weight:600;font-size:15px;color:var(--text);">' + setName + '</span>' +
                '<span style="font-size:12px;color:var(--text-muted);">' + themes.length + ' Theme' + (themes.length !== 1 ? 's' : '') + '</span>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">';
            
            themes.forEach(t => {
                const rawTier = t.tier || 'free';
                const tier = (rawTier === 'silver' || rawTier === 'gold') ? 'pro' : rawTier;
                html += '<div style="background:var(--bg-elevated);border-radius:12px;overflow:hidden;position:relative;">' +
                    '<div style="aspect-ratio:16/9;background:url(\'' + (t.imageUrl || '') + '\') center/cover;position:relative;">' +
                    '<span style="position:absolute;top:8px;left:8px;background:' + tierColors[tier] + ';color:white;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;">' + tierLabels[tier] + '</span>' +
                    '</div>' +
                    '<div style="padding:12px;">' +
                    '<div style="font-weight:500;font-size:14px;margin-bottom:4px;">' + (t.name || 'Unbenannt') + '</div>' +
                    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">ID: ' + (t.themeId || t.id) + '</div>' +
                    '<div style="display:flex;gap:8px;">' +
                    '<button class="btn btn--ghost btn--small" onclick="ArenaThemesAdmin.openEditor(\'' + t.id + '\')" style="flex:1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
                    '<button class="btn btn--ghost btn--small" onclick="ArenaThemesAdmin.delete(\'' + t.id + '\')" style="color:var(--red);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
                    '</div></div></div>';
            });
            
            html += '</div></div>';
        });
        
        c.innerHTML = html;
    },
    
    updateStats() {
        document.getElementById('statArenaTotal').textContent = this.themes.length;
        document.getElementById('statArenaFree').textContent = this.themes.filter(t => t.tier === 'free').length;
        document.getElementById('statArenaPro').textContent = this.themes.filter(t => t.tier === 'silver' || t.tier === 'gold' || t.tier === 'pro').length;
    },
    
    filter() {
        const search = document.getElementById('arenaThemeSearch').value.toLowerCase();
        const tierFilter = document.getElementById('arenaThemeTierFilter').value;
        const setFilter = document.getElementById('arenaThemeSetFilter')?.value || '';
        const filtered = this.themes.filter(t => {
            const matchSearch = !search || (t.name || '').toLowerCase().includes(search) || (t.themeId || '').toLowerCase().includes(search);
            const rawTier = t.tier || 'free';
            const mappedTier = (rawTier === 'silver' || rawTier === 'gold') ? 'pro' : rawTier;
            const matchTier = !tierFilter || mappedTier === tierFilter;
            const matchSet = !setFilter || (t.set || '') === setFilter;
            return matchSearch && matchTier && matchSet;
        });
        const orig = this.themes;
        this.themes = filtered;
        this.render();
        this.themes = orig;
    },
    
    populateSetFilter() {
        const sel = document.getElementById('arenaThemeSetFilter');
        if (!sel) return;
        const sets = this.getExistingSets();
        sel.innerHTML = '<option value="">Alle Sets</option>' + sets.map(s => '<option value="' + s + '">' + s + '</option>').join('');
    },
    
    openEditor(id = null) {
        const theme = id ? this.themes.find(t => t.id === id) : null;
        const isNew = !theme;
        
        const html = '<div class="modal active" id="arenaThemeModal" onclick="if(event.target===this)this.remove()">' +
            '<div class="modal__content" style="max-width:600px;">' +
            '<div class="modal__header"><h3 class="modal__title">' + (isNew ? 'Neues Arena Theme' : 'Theme bearbeiten') + '</h3>' +
            '<button class="btn btn--ghost" onclick="document.getElementById(\'arenaThemeModal\').remove()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            '<div class="form-group"><label class="form-label">Theme ID (für CSS/JS)</label>' +
            '<input type="text" class="form-input" id="themeId" value="' + (theme?.themeId || '') + '" placeholder="z.B. dragonclaw-red"' + (isNew ? '' : ' readonly style="opacity:0.7;"') + '>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Nur Kleinbuchstaben, Zahlen und Bindestriche</div></div>' +
            '<div class="form-group"><label class="form-label">Name</label>' +
            '<input type="text" class="form-input" id="themeName" value="' + (theme?.name || '') + '" placeholder="z.B. Dragonclaw (Red)"></div>' +
            '<div class="form-row">' +
            '<div class="form-group" style="flex:1;"><label class="form-label">Tier</label>' +
            '<select class="form-select" id="themeTier">' +
            '<option value="free"' + (theme?.tier === 'free' ? ' selected' : '') + '>🟢 Free</option>' +
            '<option value="pro"' + (theme?.tier === 'silver' || theme?.tier === 'gold' || theme?.tier === 'pro' ? ' selected' : '') + '>🟡 Pro</option>' +
            '</select></div>' +
            '<div class="form-group" style="flex:1;"><label class="form-label">Reihenfolge</label>' +
            '<input type="number" class="form-input" id="themeOrder" value="' + (theme?.order || 0) + '" min="0"></div>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Set / Kategorie</label>' +
            '<input type="text" class="form-input" id="themeSet" list="themeSetList" value="' + (theme?.set || '') + '" placeholder="z.B. Dragonscale, Nature, Classic...">' +
            '<datalist id="themeSetList">' + ArenaThemesAdmin.getExistingSets().map(s => '<option value="' + s + '">').join('') + '</datalist>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Manuell eingeben oder vorhandenes Set wählen</div></div>' +
            '<div class="form-group"><label class="form-label">Bild URL</label>' +
            '<div style="display:flex;gap:8px;">' +
            '<input type="text" class="form-input" id="themeImageUrl" value="' + (theme?.imageUrl || '') + '" placeholder="https://..." style="flex:1;">' +
            '<button class="btn btn--secondary" onclick="ArenaThemesAdmin.uploadImage()">Upload</button>' +
            '</div></div>' +
            '<div id="themePreviewContainer" style="margin-top:12px;' + (theme?.imageUrl ? '' : 'display:none;') + '">' +
            '<div style="aspect-ratio:16/9;max-width:300px;background:url(\'' + (theme?.imageUrl || '') + '\') center/cover;border-radius:8px;"></div>' +
            '</div>' +
            '<input type="file" id="themeImageInput" style="display:none;" accept="image/*" onchange="ArenaThemesAdmin.handleImageUpload(this.files[0])">' +
            '</div>' +
            '<div class="modal__footer">' +
            '<button class="btn btn--secondary" onclick="document.getElementById(\'arenaThemeModal\').remove()">Abbrechen</button>' +
            '<button class="btn btn--primary" onclick="ArenaThemesAdmin.save(\'' + (id || '') + '\')">' + (isNew ? 'Erstellen' : 'Speichern') + '</button>' +
            '</div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Live preview update
        document.getElementById('themeImageUrl').addEventListener('input', (e) => {
            const container = document.getElementById('themePreviewContainer');
            if (e.target.value) {
                container.style.display = 'block';
                container.querySelector('div').style.backgroundImage = 'url(' + e.target.value + ')';
            } else {
                container.style.display = 'none';
            }
        });
    },
    
    getExistingSets() {
        const sets = new Set();
        this.themes.forEach(t => { if (t.set) sets.add(t.set); });
        return [...sets].sort();
    },
    
    uploadImage() {
        document.getElementById('themeImageInput').click();
    },
    
    async handleImageUpload(file) {
        if (!file) return;
        
        try {
            showToast('Bild wird hochgeladen...');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            formData.append('folder', 'rift-assets');
            
            const response = await fetch('https://api.cloudinary.com/v1_1/' + this.cloudinaryConfig.cloudName + '/image/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            
            const data = await response.json();
            document.getElementById('themeImageUrl').value = data.secure_url;
            document.getElementById('themeImageUrl').dispatchEvent(new Event('input'));
            showToast('Bild hochgeladen');
        } catch (e) {
            console.error('Upload error:', e);
            showToast('Upload fehlgeschlagen', 'error');
        }
    },
    
    async save(id) {
        const themeId = document.getElementById('themeId').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        const name = document.getElementById('themeName').value.trim();
        const tier = document.getElementById('themeTier').value;
        const order = parseInt(document.getElementById('themeOrder').value) || 0;
        const imageUrl = document.getElementById('themeImageUrl').value.trim();
        const set = document.getElementById('themeSet').value.trim();
        
        if (!themeId) {
            showToast('Theme ID erforderlich', 'error');
            return;
        }
        if (!name) {
            showToast('Name erforderlich', 'error');
            return;
        }
        if (!imageUrl) {
            showToast('Bild URL erforderlich', 'error');
            return;
        }
        
        try {
            const data = {
                themeId: themeId,
                name: name,
                tier: tier,
                set: set || null,
                order: order,
                imageUrl: imageUrl,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (id) {
                await db.collection('arenaThemes').doc(id).update(data);
                showToast('Theme aktualisiert');
            } else {
                // Check if themeId already exists
                const existing = await db.collection('arenaThemes').where('themeId', '==', themeId).get();
                if (!existing.empty) {
                    showToast('Theme ID existiert bereits', 'error');
                    return;
                }
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('arenaThemes').add(data);
                showToast('Theme erstellt');
            }
            
            document.getElementById('arenaThemeModal').remove();
            this.load();
        } catch (e) {
            console.error('Save error:', e);
            showToast('Fehler beim Speichern', 'error');
        }
    },
    
    async delete(id) {
        if (!confirm('Theme wirklich löschen?')) return;
        
        try {
            await db.collection('arenaThemes').doc(id).delete();
            showToast('Theme gelöscht');
            this.load();
        } catch (e) {
            console.error('Delete error:', e);
            showToast('Fehler beim Löschen', 'error');
        }
    },
    
    // Generate CSS for all themes (for export/copy)
    generateCSS() {
        let css = '/* RIFT Arena Themes - Generated */\n\n';
        
        this.themes.forEach(t => {
            css += '/* ' + t.name + ' - ' + (t.tier || 'free').toUpperCase() + ' Tier */\n';
            css += '.dice-arena[data-arena-theme="' + t.themeId + '"] {\n';
            css += '    background: url(\'' + t.imageUrl + '\') center/cover;\n';
            css += '}\n';
            css += '.dice-arena[data-arena-theme="' + t.themeId + '"]::after { background: none !important; }\n';
            css += '.dice-arena-theme-preview--' + t.themeId + ' {\n';
            css += '    background: url(\'' + t.imageUrl + '\') center/cover;\n';
            css += '}\n\n';
        });
        
        return css;
    },
    
    // Generate JS theme names object
    generateThemeNames() {
        const names = {};
        this.themes.forEach(t => {
            names[t.themeId] = t.name;
        });
        return names;
    },
    
    // Import default themes to Firebase
    async importDefaultThemes() {
        if (!confirm('Alle Standard-Arena-Themes importieren? Bestehende Themes werden NICHT überschrieben.')) return;
        
        const defaultThemes = [
            // FREE TIER
            { themeId: 'rift', name: 'THE RIFT', tier: 'free', order: 1, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770181215/rift-assets/cf0ew69drn3yd5max2jr.png' },
            { themeId: 'rift-negative', name: 'THE RIFT (Neg)', tier: 'free', order: 2, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217425/rift-assets/ppyadxq8t37oj5nfytvb.png' },
            { themeId: 'rift-tag', name: 'RIFT Tag', tier: 'free', order: 3, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217429/rift-assets/cqrjsukgmwlpwyezcbdl.png' },
            { themeId: 'rift-tag-negative', name: 'RIFT Tag (Neg)', tier: 'free', order: 4, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217434/rift-assets/ee5vhoakgzxfsez5d5w9.png' },
            { themeId: 'rift-rest-easy', name: 'Rest Easy', tier: 'free', order: 5, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217435/rift-assets/mjim6aws4nagnnxrxlae.png' },
            { themeId: 'rift-rest-easy-negative', name: 'Rest Easy (Neg)', tier: 'free', order: 6, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217436/rift-assets/d3nh07m2gyxer7wdtvzv.png' },
            { themeId: 'rift-punk', name: 'RIFT Punk', tier: 'free', order: 7, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217439/rift-assets/ttxtvwpvcicohknluxi5.png' },
            { themeId: 'rift-punk-alt', name: 'RIFT Punk (Alt)', tier: 'free', order: 8, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217441/rift-assets/tgt9azhgs7sqkxbrdh0d.png' },
            { themeId: 'rift-leather', name: 'RIFT Leather', tier: 'free', order: 9, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217443/rift-assets/mmt55vukt4tbbpek8hlw.png' },
            { themeId: 'rift-leather-negative', name: 'Leather (Neg)', tier: 'free', order: 10, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217445/rift-assets/dlx8hdckjzuw6ijrtrjt.png' },
            { themeId: 'rift-the-dice', name: 'The Dice', tier: 'free', order: 11, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217446/rift-assets/z3nrydaaqqwgbbkcuqa3.png' },
            { themeId: 'rift-the-dice-alt', name: 'The Dice (Alt)', tier: 'free', order: 12, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770217447/rift-assets/tpd35lyqdlliyvqcrq4h.png' },
            // Note: tavern and casino are gradient-based, no image URL - skip for now or add placeholders
            
            // SILVER TIER (gradient-based themes - would need image conversion or skip)
            // These use CSS gradients, not images. For now we skip them or you can create images later.
            
            // PRO TIER
            { themeId: 'dragonclaw-red', name: 'Dragonclaw (Red)', tier: 'pro', order: 100, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770235663/rift-assets/mq1vanad7kzp4tg6vwfn.png' },
            { themeId: 'dragonclaw-green', name: 'Dragonclaw (Green)', tier: 'pro', order: 101, imageUrl: 'https://res.cloudinary.com/dza4jgreq/image/upload/v1770235665/rift-assets/rflk7srpbglks52z43s0.png' },
        ];
        
        let imported = 0;
        let skipped = 0;
        
        showToast('Import läuft...');
        
        for (const theme of defaultThemes) {
            try {
                // Check if already exists
                const existing = await db.collection('arenaThemes').where('themeId', '==', theme.themeId).get();
                if (!existing.empty) {
                    skipped++;
                    continue;
                }
                
                await db.collection('arenaThemes').add({
                    ...theme,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                imported++;
            } catch (e) {
                console.error('Import error for', theme.themeId, e);
            }
        }
        
        showToast(`Import abgeschlossen: ${imported} neu, ${skipped} übersprungen`);
        this.load();
    }
};

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
            console.error('Error loading users:', error);
            document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</td></tr>';
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
                            <button class="btn btn--ghost btn--small" onclick="UsersAdmin.editRole('${user.id}')" title="Rolle ändern">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn btn--ghost btn--small" onclick="UsersAdmin.toggleBan('${user.id}',${!isBanned})" title="${isBanned?'Entsperren':'Sperren'}" style="color:${isBanned?'var(--green)':'var(--red)'};">
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
// SESSIONS ADMIN MODULE
// ========================================
const SessionsAdmin = {
    sessions: [],
    
    async load() {
        try {
            const snapshot = await db.collection('rooms').get();
            this.sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
            this.updateStats();
            this.updateRulesetStats();
            console.log('[Admin] Loaded', this.sessions.length, 'sessions');
        } catch (error) {
            console.error('Error loading sessions:', error);
            document.getElementById('sessionsTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</td></tr>';
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
            const memberCount = s.memberCount || Object.keys(s.members||{}).length || 0;
            return '<tr>' +
                '<td><div style="font-weight:500;">' + (s.name||s.id||'Unbenannt') + '</div></td>' +
                '<td><span style="padding:4px 8px;background:var(--bg-elevated);border-radius:6px;font-size:12px;">' + (s.ruleset||'—') + '</span></td>' +
                '<td style="text-align:center;">' + memberCount + '</td>' +
                '<td style="color:var(--text-muted);font-size:13px;">' + (s.gmName||'—') + '</td>' +
                '<td style="color:var(--text-muted);font-size:13px;">—</td>' +
                '<td><span style="padding:4px 10px;background:#22C55E20;color:#22C55E;border-radius:12px;font-size:12px;">Aktiv</span></td>' +
                '<td><button class="btn btn--ghost btn--small" onclick="SessionsAdmin.view(\'' + s.id + '\')">Details</button></td>' +
            '</tr>';
        }).join('');
    },
    
    updateStats() {
        const active = this.sessions.length;
        const avgPlayers = active > 0 ? Math.round(this.sessions.reduce((s,r) => s + (r.memberCount||Object.keys(r.members||{}).length||0), 0) / active * 10) / 10 : 0;
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
    
    filter() {},
    view(id) { var s = this.sessions.find(function(x) { return x.id === id; }); if (s) alert('Session: ' + (s.name||s.id) + '\nSpieler: ' + (s.memberCount||Object.keys(s.members||{}).length) + '\nRegelwerk: ' + (s.ruleset||'—')); }
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
            console.error('Error loading feedback:', e);
            document.getElementById('feedbackListContainer').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</div>';
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
// ANNOUNCEMENTS ADMIN MODULE
// ========================================
const AnnouncementsAdmin = {
    items: [],
    editingId: null,
    
    async load() {
        try {
            const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
            this.items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.render();
            this.updateActiveBanner();
            console.log('[Admin] Loaded', this.items.length, 'announcements');
        } catch (e) {
            console.error('Error:', e);
            document.getElementById('announcementsList').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</div>';
        }
    },
    
    render() {
        const container = document.getElementById('announcementsList');
        if (!container) return;
        if (this.items.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Ankündigungen</div>';
            return;
        }
        const levelColors = { info:'#3B82F6', warning:'#F59E0B', critical:'#EF4444' };
        container.innerHTML = this.items.map(item => {
            var lc = levelColors[item.level] || '#666';
            var activeIcon = item.active ? '<span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:50%;margin-right:8px;"></span>' : '';
            return '<div class="slide-item" style="border-left:4px solid ' + lc + ';">' +
                '<div class="slide-item__info">' +
                '<div class="slide-item__title">' + activeIcon + (item.title||'Keine Überschrift') + '</div>' +
                '<div class="slide-item__meta"><span style="padding:2px 8px;background:' + lc + '20;color:' + lc + ';border-radius:10px;font-size:11px;">' + (item.level||'info') + '</span></div></div>' +
                '<div class="slide-item__actions">' +
                '<label class="form-checkbox" style="margin-right:16px;"><input type="checkbox" ' + (item.active?'checked':'') + ' onchange="AnnouncementsAdmin.toggleActive(\'' + item.id + '\',this.checked)"><span>Aktiv</span></label>' +
                '<button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.edit(\'' + item.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
                '<button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.delete(\'' + item.id + '\')" style="color:var(--red);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div>';
        }).join('');
    },
    
    updateActiveBanner() {
        const container = document.getElementById('activeBannerPreview');
        if (!container) return;
        const active = this.items.find(i => i.active);
        if (!active) { container.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Kein aktiver Banner</p>'; return; }
        const colors = { info:'#3B82F6', warning:'#F59E0B', critical:'#EF4444' };
        var c = colors[active.level] || '#3B82F6';
        container.innerHTML = '<div style="background:' + c + '20;border:1px solid ' + c + '40;border-radius:8px;padding:16px;display:flex;align-items:center;gap:16px;">' +
            '<div style="width:40px;height:40px;background:' + c + ';border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:20px;height:20px;"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg></div>' +
            '<div><div style="font-weight:600;color:' + c + ';">' + active.title + '</div>' +
            '<div style="font-size:14px;color:var(--text-muted);">' + (active.message||'') + '</div></div></div>';
    },
    
    openEditor(id) {
        this.editingId = id || null;
        const item = id ? this.items.find(i => i.id === id) : null;
        const html = '<div class="modal active" id="announcementModal" onclick="if(event.target===this)AnnouncementsAdmin.closeEditor()">' +
            '<div class="modal__content"><div class="modal__header"><h3 class="modal__title">' + (id?'Bearbeiten':'Neue Ankündigung') + '</h3>' +
            '<button class="btn btn--ghost" onclick="AnnouncementsAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
            '<div class="modal__body">' +
            '<div class="form-group"><label class="form-label">Titel</label><input type="text" class="form-input" id="announcementTitle" value="' + (item?.title||'') + '" placeholder="z.B. Wartungsarbeiten"></div>' +
            '<div class="form-group"><label class="form-label">Nachricht</label><textarea class="form-textarea" id="announcementMessage" placeholder="Details...">' + (item?.message||'') + '</textarea></div>' +
            '<div class="form-group"><label class="form-label">Dringlichkeit</label><select class="form-select" id="announcementLevel">' +
            '<option value="info"' + (item?.level==='info'?' selected':'') + '>Info (Blau)</option>' +
            '<option value="warning"' + (item?.level==='warning'?' selected':'') + '>Warnung (Orange)</option>' +
            '<option value="critical"' + (item?.level==='critical'?' selected':'') + '>Kritisch (Rot)</option></select></div>' +
            '<div class="form-group"><label class="form-checkbox"><input type="checkbox" id="announcementActive"' + (item?.active!==false?' checked':'') + '><span>Sofort aktivieren</span></label></div></div>' +
            '<div class="modal__footer"><button class="btn btn--secondary" onclick="AnnouncementsAdmin.closeEditor()">Abbrechen</button>' +
            '<button class="btn btn--primary" onclick="AnnouncementsAdmin.save()">Speichern</button></div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { var m = document.getElementById('announcementModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const title = document.getElementById('announcementTitle').value.trim();
        const message = document.getElementById('announcementMessage').value.trim();
        const level = document.getElementById('announcementLevel').value;
        const active = document.getElementById('announcementActive').checked;
        if (!title) { showToast('Bitte Titel eingeben', 'error'); return; }
        const data = { title: title, message: message, level: level, active: active, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (this.editingId) { await db.collection('announcements').doc(this.editingId).update(data); showToast('Aktualisiert'); }
            else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('announcements').add(data); showToast('Erstellt'); }
            this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async toggleActive(id, active) { try { await db.collection('announcements').doc(id).update({ active: active }); var i = this.items.find(function(x) { return x.id === id; }); if (i) i.active = active; this.updateActiveBanner(); showToast(active?'Aktiviert':'Deaktiviert'); } catch(e) { showToast('Fehler','error'); } },
    async delete(id) { if (!confirm('Löschen?')) return; try { await db.collection('announcements').doc(id).delete(); showToast('Gelöscht'); this.load(); } catch(e) { showToast('Fehler','error'); } }
};

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
            console.error('Changelog error:', e);
            document.getElementById('changelogList').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</div>';
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
            const catSnap = await db.collection('faq_categories').orderBy('order').get();
            this.items = faqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render(); 
            this.renderCategories();
            console.log('[Admin] Loaded', this.items.length, 'FAQs');
        } catch (e) { 
            console.error('FAQ error:', e);
            document.getElementById('faqList').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</div>';
        }
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
            console.error('Rulesets error:', e);
            document.getElementById('rulesetsGrid').innerHTML = '<div style="text-align:center;padding:60px;grid-column:1/-1;color:var(--text-muted);">Fehler beim Laden</div>';
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
// ASSETS ADMIN MODULE
// ========================================
const AssetsAdmin = {
    items: [],
    
    async load() {
        try {
            const snap = await db.collection('assets').orderBy('createdAt', 'desc').get();
            this.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render(); 
            this.updateStats();
            console.log('[Admin] Loaded', this.items.length, 'assets');
        } catch (e) { 
            console.error('Assets error:', e);
            document.getElementById('assetsContainer').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</div>';
        }
    },
    
    render() {
        const c = document.getElementById('assetsContainer'); 
        if (!c) return;
        if (this.items.length === 0) { 
            c.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Assets</div>'; 
            return; 
        }
        c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;">' +
            this.items.map(i => {
                var preview = i.url ? '<img src="' + i.url + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:32px;">📁</span>';
                return '<div style="background:var(--bg-elevated);border-radius:8px;overflow:hidden;cursor:pointer;" onclick="AssetsAdmin.view(\'' + i.id + '\')">' +
                    '<div style="aspect-ratio:1;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;">' + preview + '</div>' +
                    '<div style="padding:10px;"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (i.name||'Unbenannt') + '</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);">' + (i.type||'image') + '</div></div></div>';
            }).join('') + '</div>';
    },
    
    updateStats() {
        document.getElementById('statAssetsTotal').textContent = this.items.length;
        document.getElementById('statAssetsImages').textContent = this.items.filter(i => i.type === 'image').length;
        document.getElementById('statAssetsTokens').textContent = this.items.filter(i => i.type === 'token').length;
        document.getElementById('statAssetsStorage').textContent = this.formatSize(this.items.reduce((s,i) => s + (i.size||0), 0));
    },
    
    filter() {},
    openUpload() { showToast('Upload benötigt Firebase Storage', 'error'); },
    view(id) { var i = this.items.find(function(x) { return x.id === id; }); if (i && i.url) window.open(i.url, '_blank'); },
    formatSize(b) { if (!b) return '0 B'; var s = ['B','KB','MB','GB']; var i = Math.floor(Math.log(b)/Math.log(1024)); return Math.round(b/Math.pow(1024,i)*100)/100 + ' ' + s[i]; }
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
            console.error('Audit error:', e);
            document.getElementById('auditLogContainer').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Fehler beim Laden</div>';
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
            case 'audit': AuditAdmin.load(); break;
            case 'carousel': if(typeof CarouselAdmin !== 'undefined') CarouselAdmin.load(); break;
            case 'quotes': if(typeof QuotesAdmin !== 'undefined') QuotesAdmin.load(); break;
            case 'news': if(typeof NewsAdmin !== 'undefined') NewsAdmin.load(); break;
            case 'features': if(typeof FeaturesAdmin !== 'undefined') FeaturesAdmin.load(); break;
        }
    };
})();

console.log('[Admin Extended] All modules loaded successfully');

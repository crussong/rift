="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:50%;margin-right:8px;"></span>' : ''}${item.title||'Keine Überschrift'}</div>
                    <div class="slide-item__meta"><span style="padding:2px 8px;background:${levelColors[item.level]}20;color:${levelColors[item.level]};border-radius:10px;font-size:11px;">${item.level||'info'}</span></div>
                </div>
                <div class="slide-item__actions">
                    <label class="form-checkbox" style="margin-right:16px;"><input type="checkbox" ${item.active?'checked':''} onchange="AnnouncementsAdmin.toggleActive('${item.id}',this.checked)"><span>Aktiv</span></label>
                    <button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.edit('${item.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn btn--ghost btn--small" onclick="AnnouncementsAdmin.delete('${item.id}')" style="color:var(--red);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
            </div>
        `).join('');
    },
    
    updateActiveBanner() {
        const container = document.getElementById('activeBannerPreview');
        if (!container) return;
        const active = this.items.find(i => i.active);
        if (!active) { container.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Kein aktiver Banner</p>'; return; }
        const colors = { info:'#3B82F6', warning:'#F59E0B', critical:'#EF4444' };
        container.innerHTML = `<div style="background:${colors[active.level]}20;border:1px solid ${colors[active.level]}40;border-radius:8px;padding:16px;display:flex;align-items:center;gap:16px;"><div style="width:40px;height:40px;background:${colors[active.level]};border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:20px;height:20px;"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg></div><div><div style="font-weight:600;color:${colors[active.level]};">${active.title}</div><div style="font-size:14px;color:var(--text-muted);">${active.message||''}</div></div></div>`;
    },
    
    openEditor(id = null) {
        this.editingId = id;
        const item = id ? this.items.find(i => i.id === id) : null;
        const html = `<div class="modal active" id="announcementModal" onclick="if(event.target===this)AnnouncementsAdmin.closeEditor()"><div class="modal__content"><div class="modal__header"><h3 class="modal__title">${id?'Bearbeiten':'Neue Ankündigung'}</h3><button class="btn btn--ghost" onclick="AnnouncementsAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal__body"><div class="form-group"><label class="form-label">Titel</label><input type="text" class="form-input" id="announcementTitle" value="${item?.title||''}" placeholder="z.B. Wartungsarbeiten"></div><div class="form-group"><label class="form-label">Nachricht</label><textarea class="form-textarea" id="announcementMessage" placeholder="Details...">${item?.message||''}</textarea></div><div class="form-group"><label class="form-label">Dringlichkeit</label><select class="form-select" id="announcementLevel"><option value="info" ${item?.level==='info'?'selected':''}>Info (Blau)</option><option value="warning" ${item?.level==='warning'?'selected':''}>Warnung (Orange)</option><option value="critical" ${item?.level==='critical'?'selected':''}>Kritisch (Rot)</option></select></div><div class="form-group"><label class="form-checkbox"><input type="checkbox" id="announcementActive" ${item?.active!==false?'checked':''}><span>Sofort aktivieren</span></label></div></div><div class="modal__footer"><button class="btn btn--secondary" onclick="AnnouncementsAdmin.closeEditor()">Abbrechen</button><button class="btn btn--primary" onclick="AnnouncementsAdmin.save()">Speichern</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { const m = document.getElementById('announcementModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const title = document.getElementById('announcementTitle').value.trim();
        const message = document.getElementById('announcementMessage').value.trim();
        const level = document.getElementById('announcementLevel').value;
        const active = document.getElementById('announcementActive').checked;
        if (!title) { showToast('Bitte Titel eingeben', 'error'); return; }
        const data = { title, message, level, active, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (this.editingId) { await db.collection('announcements').doc(this.editingId).update(data); showToast('Aktualisiert'); }
            else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('announcements').add(data); showToast('Erstellt'); }
            this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async toggleActive(id, active) { try { await db.collection('announcements').doc(id).update({ active }); const i = this.items.find(x => x.id === id); if (i) i.active = active; this.updateActiveBanner(); showToast(active?'Aktiviert':'Deaktiviert'); } catch(e) { showToast('Fehler','error'); } },
    async delete(id) { if (!confirm('Löschen?')) return; try { await db.collection('announcements').doc(id).delete(); showToast('Gelöscht'); this.load(); } catch(e) { showToast('Fehler','error'); } }
};

// ========================================
// ANALYTICS ADMIN MODULE
// ========================================
const AnalyticsAdmin = {
    data: null,
    
    async load() {
        try {
            const [usersSnap, sessionsSnap] = await Promise.all([db.collection('users').get(), db.collection('rooms').get()]);
            this.data = { users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })), sessions: sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
            this.updateStats();
            this.renderCharts();
        } catch (e) { console.error('Analytics error:', e); }
    },
    
    updateStats() {
        if (!this.data) return;
        const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7*24*60*60*1000), monthAgo = new Date(today.getTime() - 30*24*60*60*1000);
        document.getElementById('statAnalyticsDAU').textContent = this.data.users.filter(u => { const l = u.lastLogin?.toDate?.(); return l && l >= today; }).length;
        document.getElementById('statAnalyticsWAU').textContent = this.data.users.filter(u => { const l = u.lastLogin?.toDate?.(); return l && l >= weekAgo; }).length;
        document.getElementById('statAnalyticsMAU').textContent = this.data.users.filter(u => { const l = u.lastLogin?.toDate?.(); return l && l >= monthAgo; }).length;
        document.getElementById('statAnalyticsNewUsers').textContent = this.data.users.filter(u => { const c = u.createdAt?.toDate?.(); return c && c >= monthAgo; }).length;
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
                const count = this.data.users.filter(u => { const l = u.lastLogin?.toDate?.(); return l && l >= d && l < next; }).length;
                days.push({ date: d, count });
            }
            const max = Math.max(...days.map(d => d.count), 1);
            activityContainer.innerHTML = days.map(d => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:100%;max-width:20px;height:${(d.count/max)*200}px;min-height:2px;background:var(--accent);border-radius:2px;"></div><span style="font-size:9px;color:var(--text-muted);">${d.date.getDate()}</span></div>`).join('');
        }
        
        // Peak Times
        const peakContainer = document.getElementById('peakTimesChart');
        if (peakContainer) {
            peakContainer.innerHTML = ['18-20 Uhr','20-22 Uhr','22-00 Uhr','14-18 Uhr'].map((t,i) => {
                const p = [35,45,30,20][i];
                return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;"><span style="width:80px;font-size:13px;color:var(--text-muted);">${t}</span><div style="flex:1;height:20px;background:var(--bg);border-radius:4px;overflow:hidden;"><div style="width:${p}%;height:100%;background:var(--accent);"></div></div><span style="width:35px;text-align:right;font-weight:600;">${p}%</span></div>`;
            }).join('');
        }
        
        // Popular Pages
        const pagesContainer = document.getElementById('popularPages');
        if (pagesContainer) {
            pagesContainer.innerHTML = [['Hub','🏠',100],['Charakterbogen','📜',75],['Würfel','🎲',60],['Sessions','⚔️',50]].map(([n,i,p]) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:18px;">${i}</span><div style="flex:1;"><div style="font-weight:500;">${n}</div><div style="height:4px;background:var(--bg);border-radius:2px;margin-top:4px;"><div style="width:${p}%;height:100%;background:var(--accent);"></div></div></div></div>`).join('');
        }
        
        // Device Stats
        const deviceContainer = document.getElementById('deviceStats');
        if (deviceContainer) {
            deviceContainer.innerHTML = `<div style="display:flex;height:24px;border-radius:12px;overflow:hidden;margin-bottom:16px;"><div style="width:65%;background:#8B5CF6;"></div><div style="width:28%;background:#3B82F6;"></div><div style="width:7%;background:#22C55E;"></div></div><div style="display:flex;justify-content:center;gap:24px;"><div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:#8B5CF6;border-radius:3px;"></div><span>Desktop 65%</span></div><div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:#3B82F6;border-radius:3px;"></div><span>Mobile 28%</span></div><div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;background:#22C55E;border-radius:3px;"></div><span>Tablet 7%</span></div></div>`;
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
        } catch (e) { console.error('Changelog error:', e); }
    },
    
    render() {
        const container = document.getElementById('changelogList');
        if (!container) return;
        if (this.versions.length === 0) { container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Versionen</div>`; return; }
        container.innerHTML = this.versions.map(v => `
            <div style="padding:24px;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
                    <div><span style="font-size:20px;font-weight:700;color:var(--accent);">v${v.version}</span> ${v.latest?'<span style="padding:2px 8px;background:var(--green);color:white;border-radius:10px;font-size:11px;margin-left:8px;">LATEST</span>':''}<div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${this.formatDate(v.date)}</div></div>
                    <div style="display:flex;gap:8px;"><button class="btn btn--ghost btn--small" onclick="ChangelogAdmin.edit('${v.id}')">Edit</button><button class="btn btn--ghost btn--small" onclick="ChangelogAdmin.delete('${v.id}')" style="color:var(--red);">Delete</button></div>
                </div>
                <div style="font-weight:600;margin-bottom:12px;">${v.title||''}</div>
                ${v.changes?.map(c => `<div style="padding:8px 12px;background:var(--bg);border-radius:6px;margin-bottom:8px;display:flex;gap:10px;"><span style="padding:2px 6px;background:${this.getColor(c.type)}20;color:${this.getColor(c.type)};border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;">${c.type}</span><span style="font-size:14px;">${c.text}</span></div>`).join('')||''}
            </div>
        `).join('');
    },
    
    getColor(type) { return { neu:'#22C55E', new:'#22C55E', fix:'#3B82F6', verbesserung:'#8B5CF6', entfernt:'#EF4444' }[type?.toLowerCase()] || '#666'; },
    
    openEditor(id = null) {
        this.editingId = id;
        const item = id ? this.versions.find(v => v.id === id) : null;
        const html = `<div class="modal active" id="changelogModal" onclick="if(event.target===this)ChangelogAdmin.closeEditor()"><div class="modal__content modal__content--wide"><div class="modal__header"><h3 class="modal__title">${id?'Version bearbeiten':'Neue Version'}</h3><button class="btn btn--ghost" onclick="ChangelogAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal__body"><div class="form-row"><div class="form-group"><label class="form-label">Version</label><input type="text" class="form-input" id="changelogVersion" value="${item?.version||''}" placeholder="z.B. 3.1.0"></div><div class="form-group"><label class="form-label">Datum</label><input type="date" class="form-input" id="changelogDate" value="${item?.date ? new Date(item.date.toDate?.() || item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}"></div></div><div class="form-group"><label class="form-label">Titel</label><input type="text" class="form-input" id="changelogTitle" value="${item?.title||''}" placeholder="z.B. Performance Update"></div><div class="form-group"><label class="form-label">Änderungen (TYP: Text, eine pro Zeile)</label><textarea class="form-textarea form-textarea--large" id="changelogChanges" placeholder="NEU: Feature X\nFIX: Bug Y">${item?.changes?.map(c=>`${c.type.toUpperCase()}: ${c.text}`).join('\n')||''}</textarea></div><div class="form-group"><label class="form-checkbox"><input type="checkbox" id="changelogLatest" ${item?.latest?'checked':''}><span>Als aktuelle Version markieren</span></label></div></div><div class="modal__footer"><button class="btn btn--secondary" onclick="ChangelogAdmin.closeEditor()">Abbrechen</button><button class="btn btn--primary" onclick="ChangelogAdmin.save()">Speichern</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { const m = document.getElementById('changelogModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const version = document.getElementById('changelogVersion').value.trim();
        const date = document.getElementById('changelogDate').value;
        const title = document.getElementById('changelogTitle').value.trim();
        const changesText = document.getElementById('changelogChanges').value.trim();
        const latest = document.getElementById('changelogLatest').checked;
        if (!version) { showToast('Version eingeben', 'error'); return; }
        const changes = changesText.split('\n').filter(l => l.trim()).map(l => { const m = l.match(/^(\w+):\s*(.+)$/); return m ? { type: m[1].toLowerCase(), text: m[2] } : { type: 'neu', text: l }; });
        const data = { version, date: new Date(date), title, changes, latest, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (latest) { const batch = db.batch(); this.versions.filter(v => v.latest && v.id !== this.editingId).forEach(v => batch.update(db.collection('changelog').doc(v.id), { latest: false })); await batch.commit(); }
            if (this.editingId) { await db.collection('changelog').doc(this.editingId).update(data); } else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('changelog').add(data); }
            showToast('Gespeichert'); this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async delete(id) { if (!confirm('Löschen?')) return; try { await db.collection('changelog').doc(id).delete(); showToast('Gelöscht'); this.load(); } catch(e) { showToast('Fehler','error'); } },
    formatDate(ts) { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'long', year:'numeric' }).format(d); }
};

// ========================================
// FAQ ADMIN MODULE
// ========================================
const FAQAdmin = {
    items: [], categories: [], editingId: null,
    
    async load() {
        try {
            const [faqSnap, catSnap] = await Promise.all([db.collection('faq').orderBy('order').get(), db.collection('faq_categories').orderBy('order').get()]);
            this.items = faqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render(); this.renderCategories();
        } catch (e) { console.error('FAQ error:', e); }
    },
    
    renderCategories() {
        const c = document.getElementById('faqCategories'); if (!c) return;
        c.innerHTML = this.categories.length ? this.categories.map(cat => `<span style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:${cat.color||'#666'}20;color:${cat.color||'#666'};border-radius:16px;font-size:13px;">${cat.name} <span style="font-weight:600;">${this.items.filter(i => i.category === cat.id).length}</span></span>`).join('') : '<span style="color:var(--text-muted);">Keine Kategorien</span>';
    },
    
    render() {
        const c = document.getElementById('faqList'); if (!c) return;
        if (!this.items.length) { c.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine FAQs</div>`; return; }
        c.innerHTML = this.items.map(i => {
            const cat = this.categories.find(x => x.id === i.category);
            return `<div style="padding:20px 24px;border-bottom:1px solid var(--border);"><div style="display:flex;align-items:flex-start;justify-content:space-between;"><div style="flex:1;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><span style="font-weight:600;">${i.question}</span>${cat?`<span style="padding:2px 8px;background:${cat.color||'#666'}20;color:${cat.color||'#666'};border-radius:10px;font-size:11px;">${cat.name}</span>`:''}</div><p style="color:var(--text-muted);font-size:14px;max-width:600px;">${(i.answer||'').substring(0,150)}${i.answer?.length>150?'...':''}</p></div><div style="display:flex;gap:8px;"><button class="btn btn--ghost btn--small" onclick="FAQAdmin.edit('${i.id}')">Edit</button><button class="btn btn--ghost btn--small" onclick="FAQAdmin.delete('${i.id}')" style="color:var(--red);">Delete</button></div></div></div>`;
        }).join('');
    },
    
    openEditor(id = null) {
        this.editingId = id;
        const item = id ? this.items.find(i => i.id === id) : null;
        const html = `<div class="modal active" id="faqModal" onclick="if(event.target===this)FAQAdmin.closeEditor()"><div class="modal__content"><div class="modal__header"><h3 class="modal__title">${id?'FAQ bearbeiten':'Neue FAQ'}</h3><button class="btn btn--ghost" onclick="FAQAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal__body"><div class="form-group"><label class="form-label">Frage</label><input type="text" class="form-input" id="faqQuestion" value="${item?.question||''}" placeholder="Wie kann ich...?"></div><div class="form-group"><label class="form-label">Antwort</label><textarea class="form-textarea form-textarea--large" id="faqAnswer" placeholder="Die Antwort...">${item?.answer||''}</textarea></div><div class="form-group"><label class="form-label">Kategorie</label><select class="form-select" id="faqCategory"><option value="">Keine</option>${this.categories.map(c=>`<option value="${c.id}" ${item?.category===c.id?'selected':''}>${c.name}</option>`).join('')}</select></div></div><div class="modal__footer"><button class="btn btn--secondary" onclick="FAQAdmin.closeEditor()">Abbrechen</button><button class="btn btn--primary" onclick="FAQAdmin.save()">Speichern</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { const m = document.getElementById('faqModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const question = document.getElementById('faqQuestion').value.trim();
        const answer = document.getElementById('faqAnswer').value.trim();
        const category = document.getElementById('faqCategory').value;
        if (!question || !answer) { showToast('Frage und Antwort eingeben', 'error'); return; }
        const data = { question, answer, category: category || null, order: this.items.length, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (this.editingId) { await db.collection('faq').doc(this.editingId).update(data); } else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('faq').add(data); }
            showToast('Gespeichert'); this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async delete(id) { if (!confirm('Löschen?')) return; try { await db.collection('faq').doc(id).delete(); showToast('Gelöscht'); this.load(); } catch(e) { showToast('Fehler','error'); } },
    openCategoryEditor() { const name = prompt('Neue Kategorie:'); if (!name) return; const color = prompt('Farbe (Hex):', '#8B5CF6'); db.collection('faq_categories').add({ name, color: color||'#8B5CF6', order: this.categories.length, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { showToast('Erstellt'); this.load(); }); }
};

// ========================================
// RULESETS ADMIN MODULE
// ========================================
const RulesetsAdmin = {
    items: [], editingId: null,
    
    async load() {
        try {
            const snap = await db.collection('rulesets').orderBy('order').get();
            this.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.render();
        } catch (e) { console.error('Rulesets error:', e); }
    },
    
    render() {
        const c = document.getElementById('rulesetsGrid'); if (!c) return;
        if (!this.items.length) { c.innerHTML = `<div style="text-align:center;padding:60px;grid-column:1/-1;color:var(--text-muted);">Keine Regelwerke</div>`; return; }
        c.innerHTML = this.items.map(i => `
            <div class="card" style="overflow:hidden;">
                <div style="height:120px;background:${i.color||'#8B5CF6'}20;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--border);">${i.icon?`<img src="${i.icon}" style="height:60px;">`:`<span style="font-size:48px;">${i.emoji||'📖'}</span>`}</div>
                <div style="padding:20px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><span style="font-weight:600;font-size:16px;">${i.name}</span><span style="width:10px;height:10px;border-radius:50%;background:${i.active!==false?'var(--green)':'var(--red)'};"></span></div>
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;min-height:40px;">${i.description||'Keine Beschreibung'}</p>
                    <div style="display:flex;gap:8px;"><button class="btn btn--secondary btn--small" style="flex:1;" onclick="RulesetsAdmin.edit('${i.id}')">Bearbeiten</button><button class="btn btn--ghost btn--small" onclick="RulesetsAdmin.toggleActive('${i.id}',${i.active===false})" style="color:${i.active!==false?'var(--red)':'var(--green)'};">${i.active!==false?'Deaktivieren':'Aktivieren'}</button></div>
                </div>
            </div>
        `).join('');
    },
    
    openEditor(id = null) {
        this.editingId = id;
        const item = id ? this.items.find(i => i.id === id) : null;
        const html = `<div class="modal active" id="rulesetModal" onclick="if(event.target===this)RulesetsAdmin.closeEditor()"><div class="modal__content"><div class="modal__header"><h3 class="modal__title">${id?'Regelwerk bearbeiten':'Neues Regelwerk'}</h3><button class="btn btn--ghost" onclick="RulesetsAdmin.closeEditor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal__body"><div class="form-group"><label class="form-label">Name</label><input type="text" class="form-input" id="rulesetName" value="${item?.name||''}" placeholder="z.B. D&D 5e"></div><div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="rulesetDescription" placeholder="Kurze Beschreibung...">${item?.description||''}</textarea></div><div class="form-row"><div class="form-group"><label class="form-label">Emoji</label><input type="text" class="form-input" id="rulesetEmoji" value="${item?.emoji||''}" placeholder="📖"></div><div class="form-group"><label class="form-label">Farbe</label><input type="color" class="form-input" id="rulesetColor" value="${item?.color||'#8B5CF6'}" style="height:42px;padding:4px;"></div></div><div class="form-group"><label class="form-checkbox"><input type="checkbox" id="rulesetActive" ${item?.active!==false?'checked':''}><span>Aktiv</span></label></div></div><div class="modal__footer"><button class="btn btn--secondary" onclick="RulesetsAdmin.closeEditor()">Abbrechen</button><button class="btn btn--primary" onclick="RulesetsAdmin.save()">Speichern</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    closeEditor() { const m = document.getElementById('rulesetModal'); if (m) m.remove(); this.editingId = null; },
    
    async save() {
        const name = document.getElementById('rulesetName').value.trim();
        const description = document.getElementById('rulesetDescription').value.trim();
        const emoji = document.getElementById('rulesetEmoji').value.trim();
        const color = document.getElementById('rulesetColor').value;
        const active = document.getElementById('rulesetActive').checked;
        if (!name) { showToast('Name eingeben', 'error'); return; }
        const data = { name, description, emoji: emoji||'📖', color, active, order: this.items.length, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        try {
            if (this.editingId) { await db.collection('rulesets').doc(this.editingId).update(data); } else { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); await db.collection('rulesets').add(data); }
            showToast('Gespeichert'); this.closeEditor(); this.load();
        } catch (e) { showToast('Fehler', 'error'); }
    },
    
    edit(id) { this.openEditor(id); },
    async toggleActive(id, active) { try { await db.collection('rulesets').doc(id).update({ active }); showToast(active?'Aktiviert':'Deaktiviert'); this.load(); } catch(e) { showToast('Fehler','error'); } }
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
            this.render(); this.updateStats();
        } catch (e) { console.error('Assets error:', e); }
    },
    
    render() {
        const c = document.getElementById('assetsContainer'); if (!c) return;
        if (!this.items.length) { c.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Assets</div>`; return; }
        c.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;">${this.items.map(i => `<div style="background:var(--bg-elevated);border-radius:8px;overflow:hidden;cursor:pointer;" onclick="AssetsAdmin.view('${i.id}')"><div style="aspect-ratio:1;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;">${i.url?`<img src="${i.url}" style="width:100%;height:100%;object-fit:cover;">`:'<span style="font-size:32px;">📁</span>'}</div><div style="padding:10px;"><div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.name||'Unbenannt'}</div><div style="font-size:11px;color:var(--text-muted);">${i.type||'image'}</div></div></div>`).join('')}</div>`;
    },
    
    updateStats() {
        document.getElementById('statAssetsTotal').textContent = this.items.length;
        document.getElementById('statAssetsImages').textContent = this.items.filter(i => i.type === 'image').length;
        document.getElementById('statAssetsTokens').textContent = this.items.filter(i => i.type === 'token').length;
        document.getElementById('statAssetsStorage').textContent = this.formatSize(this.items.reduce((s,i) => s + (i.size||0), 0));
    },
    
    filter() { /* TODO */ },
    openUpload() { showToast('Upload benötigt Firebase Storage', 'error'); },
    view(id) { const i = this.items.find(x => x.id === id); if (i?.url) window.open(i.url, '_blank'); },
    formatSize(b) { if (!b) return '0 B'; const s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(1024)); return Math.round(b/Math.pow(1024,i)*100)/100+' '+s[i]; }
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
        } catch (e) { console.error('Audit error:', e); }
    },
    
    render() {
        const c = document.getElementById('auditLogContainer'); if (!c) return;
        if (!this.logs.length) { c.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);">Keine Einträge</div>`; return; }
        const actionColors = { create:'#22C55E', update:'#3B82F6', delete:'#EF4444', login:'#8B5CF6', settings:'#F59E0B' };
        const actionTexts = { create:'hat erstellt:', update:'hat bearbeitet:', delete:'hat gelöscht:', login:'hat sich angemeldet', settings:'hat Einstellungen geändert:' };
        c.innerHTML = this.logs.map(l => `
            <div style="padding:16px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;">
                <div style="width:36px;height:36px;border-radius:8px;background:${actionColors[l.action]||'#666'}20;color:${actionColors[l.action]||'#666'};display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
                <div style="flex:1;"><div style="font-size:14px;"><span style="font-weight:500;">${l.userName||'System'}</span> <span style="color:var(--text-muted);">${actionTexts[l.action]||l.action}</span> <span style="font-weight:500;">${l.targetType||''}</span></div></div>
                <div style="font-size:12px;color:var(--text-muted);">${this.formatDate(l.timestamp)}</div>
            </div>
        `).join('');
    },
    
    filter() { /* TODO */ },
    async log(action, targetType, targetId, details = null) {
        if (typeof db === 'undefined') return;
        try { await db.collection('audit_log').add({ action, targetType, targetId, details, userId: currentUser?.uid||null, userName: currentUser?.displayName||currentUser?.email||'System', timestamp: firebase.firestore.FieldValue.serverTimestamp() }); } catch (e) { console.error('Audit log error:', e); }
    },
    export() {
        const data = this.logs.map(l => ({ timestamp: l.timestamp?.toDate?.()?.toISOString(), action: l.action, user: l.userName, target: `${l.targetType}:${l.targetId}` }));
        const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rift-audit-log.json'; a.click();
        showToast('Export gestartet');
    },
    formatDate(ts) { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(d); }
};

// ========================================
// SWITCH TAB OVERRIDE
// ========================================
window.switchTab = function(tabId) {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        const name = tab.textContent.toLowerCase().trim();
        tab.classList.toggle('active', name.includes(tabId) || (tabId === 'announcements' && name.includes('banner')));
    });
    document.querySelectorAll('.admin-page').forEach(page => {
        page.classList.toggle('active', page.id === `page-${tabId}`);
    });
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
    }
};

console.log('[Admin Extended] All modules loaded');

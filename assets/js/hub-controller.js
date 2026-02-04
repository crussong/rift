/**
 * RIFT Hub Controller v2
 * - Initialisiert Firebase selbst
 * - Lädt echte Daten
 * - Keine Dummy-Inhalte
 */

const HubController = {
    // Firebase Config
    firebaseConfig: {
        apiKey: "AIzaSyCcoId9a62tLIqIRFaFt_ADMTedTUzf3f8",
        authDomain: "rift-app-de805.firebaseapp.com",
        databaseURL: "https://rift-app-de805-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "rift-app-de805",
        storageBucket: "rift-app-de805.firebasestorage.app",
        messagingSenderId: "974596929896",
        appId: "1:974596929896:web:a6542045dae21899d07edd"
    },
    
    // Admin UIDs
    ADMIN_UIDS: ['geBL1RI92jUiPrFK1oJ5u2Z25hM2'],
    
    // State
    db: null,
    auth: null,
    userData: null,
    roomCode: null,
    activeSession: null,
    
    // Data
    sessions: [],
    characters: [],
    partyMembers: [],
    news: [],
    quotes: [],
    slides: [],
    pricing: null,
    
    // ========================================
    // INITIALIZATION
    // ========================================
    
    async init() {
        console.log('[Hub] Starting...');
        const startTime = performance.now();
        
        try {
            // 1. Initialize Firebase
            await this.initFirebase();
            
            // 2. Load local data (instant)
            this.loadLocalData();
            
            // 3. Update UI immediately
            this.updateUserUI();
            this.updateRoomUI();
            
            // 4. Show page
            document.body.classList.add('auth-ready');
            
            // 5. Init carousel
            this.initCarousel();
            
            // 6. Setup events
            this.setupEventListeners();
            
            console.log(`[Hub] Visible in ${Math.round(performance.now() - startTime)}ms`);
            
            // 7. Load dynamic data in background
            this.loadAllData();
            
        } catch (error) {
            console.error('[Hub] Init error:', error);
            document.body.classList.add('auth-ready');
            this.initCarousel();
            this.setupEventListeners();
        }
    },
    
    async initFirebase() {
        // Wait for SDK (max 1.5s)
        let attempts = 0;
        while (typeof firebase === 'undefined' && attempts < 30) {
            await new Promise(r => setTimeout(r, 50));
            attempts++;
        }
        
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }
        
        // Initialize
        if (!firebase.apps.length) {
            firebase.initializeApp(this.firebaseConfig);
        }
        
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        
        console.log('[Hub] Firebase ready');
    },
    
    loadLocalData() {
        // User
        try {
            const stored = localStorage.getItem('rift_user');
            if (stored) this.userData = JSON.parse(stored);
        } catch (e) {}
        
        // Room
        this.roomCode = localStorage.getItem('rift_current_room');
        
        // Sessions
        try {
            const sessions = localStorage.getItem('rift_sessions');
            if (sessions) this.sessions = JSON.parse(sessions);
        } catch (e) {}
        
        // Active session
        try {
            const active = localStorage.getItem('rift_active_session');
            if (active) this.activeSession = JSON.parse(active);
        } catch (e) {}
    },
    
    // ========================================
    // LOAD DYNAMIC DATA
    // ========================================
    
    async loadAllData() {
        await Promise.allSettled([
            this.loadCharacters(),
            this.loadNews(),
            this.loadQuotes(),
            this.loadSlides(),
            this.loadPartyMembers(),
            this.loadSessionsFromFirestore(),
            this.loadPricing()
        ]);
        
        // Update UI
        this.updateHeroCarousel();
        this.updateQuickAccess();
        this.updateNewsSection();
        this.updateDailyQuote();
        this.updateWidgets();
        this.updatePricing();
        this.initFeatureShowcase();
        
        console.log('[Hub] Data loaded');
    },
    
    // ========================================
    // USER UI
    // ========================================
    
    updateUserUI() {
        const user = this.auth?.currentUser;
        
        if (user) {
            this.userData = {
                ...this.userData,
                uid: user.uid,
                name: user.displayName || this.userData?.name || 'Spieler',
                email: user.email,
                avatar: user.photoURL || this.userData?.avatar,
                color: this.userData?.color || '#FF4655',
                isGM: this.userData?.isGM || false
            };
        }
        
        if (!this.userData) {
            this.userData = { name: 'Spieler', color: '#FF4655' };
        }
        
        // TopNav
        const userAvatar = document.querySelector('.topnav__user-avatar');
        const userName = document.querySelector('.topnav__user-name');
        
        if (userAvatar) {
            userAvatar.style.background = this.userData.color;
            userAvatar.innerHTML = this.userData.avatar 
                ? `<img src="${this.userData.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                : (this.userData.name || 'S').charAt(0).toUpperCase();
        }
        if (userName) userName.textContent = this.userData.name;
        
        // Dropdown
        const ddAvatar = document.querySelector('.topnav__dropdown-user-avatar');
        const ddName = document.querySelector('.topnav__dropdown-user-name');
        const ddEmail = document.querySelector('.topnav__dropdown-user-email');
        
        if (ddAvatar) {
            ddAvatar.style.background = this.userData.color;
            ddAvatar.innerHTML = this.userData.avatar 
                ? `<img src="${this.userData.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
                : (this.userData.name || 'S').charAt(0).toUpperCase();
        }
        if (ddName) ddName.textContent = this.userData.name;
        if (ddEmail) ddEmail.textContent = this.userData.email || '';
        
        // Admin link
        const isAdmin = this.ADMIN_UIDS.includes(this.userData?.uid);
        document.querySelectorAll('[href="admin.html"]').forEach(l => l.style.display = isAdmin ? '' : 'none');
        
        // GM Center
        const gmLink = document.querySelector('.meganav__item--gm');
        if (gmLink) gmLink.style.display = (this.userData.isGM || isAdmin) ? '' : 'none';
    },
    
    updateRoomUI() {
        const partyEl = document.querySelector('.topnav__party');
        const roomCodeEl = document.querySelector('.topnav__room-code');
        
        if (!this.roomCode) {
            if (partyEl) partyEl.style.display = 'none';
            if (roomCodeEl) roomCodeEl.style.display = 'none';
            return;
        }
        
        if (partyEl) partyEl.style.display = '';
        if (roomCodeEl) roomCodeEl.style.display = '';
        
        const codeDisplay = document.querySelector('.topnav__room-code code');
        if (codeDisplay) {
            codeDisplay.textContent = this.roomCode.slice(0, 3) + '-' + this.roomCode.slice(3);
        }
    },
    
    // ========================================
    // DATA LOADING
    // ========================================
    
    async loadCharacters() {
        try {
            if (typeof CharacterStorage !== 'undefined') {
                const result = CharacterStorage.getAll();
                // getAll() returns an object, convert to array
                this.characters = result ? Object.values(result) : [];
            } else {
                const stored = localStorage.getItem('rift_characters');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // Could be object or array depending on version
                    this.characters = Array.isArray(parsed) ? parsed : Object.values(parsed);
                }
            }
        } catch (e) {
            this.characters = [];
        }
    },
    
    async loadSessionsFromFirestore() {
        if (!this.db || !this.userData?.uid) return;
        try {
            const snap = await this.db.collection('sessions')
                .where('members', 'array-contains', this.userData.uid)
                .orderBy('lastPlayed', 'desc').limit(10).get();
            if (!snap.empty) {
                this.sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                localStorage.setItem('rift_sessions', JSON.stringify(this.sessions));
            }
        } catch (e) {
            this.sessions = Array.isArray(this.sessions) ? this.sessions : [];
        }
    },
    
    async loadPartyMembers() {
        if (!this.roomCode || !this.db) return;
        try {
            const snap = await this.db.collection('rooms').doc(this.roomCode).collection('members').get();
            this.partyMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Update HeaderController
            if (typeof HeaderController !== 'undefined' && this.partyMembers.length > 0) {
                HeaderController.renderParty(this.partyMembers);
            }
        } catch (e) {}
    },
    
    async loadNews() {
        if (!this.db) return;
        try {
            const snap = await this.db.collection('hub_news')
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc').limit(10).get();
            this.news = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
    },
    
    async loadQuotes() {
        if (!this.db) return;
        try {
            const snap = await this.db.collection('hub_quotes').get();
            this.quotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
    },
    
    async loadSlides() {
        if (!this.db) return;
        try {
            const snap = await this.db.collection('hub_slides')
                .where('active', '==', true).orderBy('order', 'asc').get();
            this.slides = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {}
    },
    
    async loadPricing() {
        if (!this.db) return;
        try {
            const doc = await this.db.collection('hub_settings').doc('pricing').get();
            if (doc.exists) {
                this.pricing = doc.data();
            }
        } catch (e) {}
    },
    
    // ========================================
    // CAROUSEL
    // ========================================
    
    initCarousel() {
        const slides = document.querySelectorAll('.hero-carousel__slide');
        const bgImages = document.querySelectorAll('.hero-carousel__bg-image');
        const navBtns = document.querySelectorAll('.hero-carousel__nav-btn');
        const prevBtn = document.querySelector('.hero-carousel__arrow--prev');
        const nextBtn = document.querySelector('.hero-carousel__arrow--next');
        const progressBar = document.querySelector('.hero-carousel__progress-bar');
        
        if (slides.length === 0) return;
        
        let current = 0, interval;
        const duration = 6000;
        const colors = { accent:'#FF4655', blue:'#3b82f6', amber:'#f59e0b', purple:'#8b5cf6', cyan:'#06b6d4' };
        
        const show = (i) => {
            if (i < 0) i = slides.length - 1;
            if (i >= slides.length) i = 0;
            current = i;
            slides.forEach((s, j) => s.classList.toggle('active', j === i));
            bgImages.forEach((b, j) => b.classList.toggle('active', j === i));
            navBtns.forEach((n, j) => n.classList.toggle('active', j === i));
            if (progressBar && navBtns[i]) {
                progressBar.style.background = colors[navBtns[i].dataset.color] || colors.accent;
            }
        };
        
        const progress = () => {
            if (!progressBar) return;
            progressBar.style.transition = 'none';
            progressBar.style.width = '0%';
            progressBar.offsetWidth;
            progressBar.style.transition = `width ${duration}ms linear`;
            progressBar.style.width = '100%';
        };
        
        const start = () => {
            progress();
            interval = setInterval(() => { show(current + 1); progress(); }, duration);
        };
        
        const restart = () => { clearInterval(interval); start(); };
        
        navBtns.forEach((b, i) => b.addEventListener('click', () => { show(i); restart(); }));
        if (prevBtn) prevBtn.addEventListener('click', () => { show(current - 1); restart(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { show(current + 1); restart(); });
        
        show(0);
        start();
    },
    
    updateHeroCarousel() {
        if (this.slides.length === 0) return;
        
        const carousel = document.querySelector('.hero-carousel');
        if (!carousel) return;
        
        const bg = carousel.querySelector('.hero-carousel__bg');
        const content = carousel.querySelector('.hero-carousel__content');
        const nav = carousel.querySelector('.hero-carousel__nav-tabs');
        if (!bg || !content || !nav) return;
        
        let all = [];
        if (this.activeSession) {
            all.push({
                overline: this.activeSession.ruleset || 'Session',
                badge: 'Weiterspielen',
                title: this.activeSession.name,
                desc: this.activeSession.description || '',
                image: this.activeSession.image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920',
                btnText: 'Session öffnen',
                btnLink: `session.html?id=${this.activeSession.id}`,
                tabName: 'Session',
                color: 'accent'
            });
        }
        all = all.concat(this.slides).slice(0, 4);
        
        bg.innerHTML = all.map((s, i) => `<div class="hero-carousel__bg-image ${i===0?'active':''}" style="background-image:url('${s.image}')"></div>`).join('');
        content.innerHTML = all.map((s, i) => `
            <div class="hero-carousel__slide ${i===0?'active':''}" data-slide="${i}">
                <div class="hero-carousel__overline">${s.overline||''}</div>
                <span class="hero-carousel__badge">${s.badge||''}</span>
                <h1 class="hero-carousel__title">${s.title}</h1>
                <p class="hero-carousel__desc">${s.desc||''}</p>
                <a href="${s.btnLink||'#'}" class="hero-carousel__btn">${s.btnText||'Mehr erfahren'}<svg viewBox="0 0 24 24" fill="currentColor"><path d="m16.172 11-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"/></svg></a>
            </div>
        `).join('');
        nav.innerHTML = all.map((s, i) => `<button class="hero-carousel__nav-btn ${i===0?'active':''}" data-slide="${i}" data-color="${s.color||'accent'}">${s.tabName||s.overline||'Slide'}</button>`).join('');
        
        this.initCarousel();
    },
    
    // ========================================
    // QUICK ACCESS
    // ========================================
    
    updateQuickAccess() {
        this.updateSessionCard();
        this.updateCharacterCard();
    },
    
    updateSessionCard() {
        const card = document.querySelector('.qa-session');
        if (!card) return;
        
        const session = this.activeSession || this.sessions[0];
        if (!session) {
            card.outerHTML = `
                <a href="sessions.html" class="qa-session qa-session--empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.3;margin-bottom:16px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <h3 style="margin-bottom:8px;font-size:18px;">Keine Session</h3>
                    <p style="color:#888;font-size:14px;">Erstelle oder tritt einer Session bei</p>
                </a>
            `;
            return;
        }
        
        const cover = card.querySelector('.qa-session__cover');
        const title = card.querySelector('.qa-session__title');
        const desc = card.querySelector('.qa-session__desc');
        const live = card.querySelector('.qa-session__live');
        
        if (cover) cover.style.backgroundImage = `url('${session.image||'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400'}')`;
        if (title) title.textContent = session.name;
        if (desc) desc.textContent = session.description || '';
        if (live) live.style.display = session.status === 'active' ? '' : 'none';
        card.href = `session.html?id=${session.id}`;
    },
    
    updateCharacterCard() {
        const card = document.querySelector('.qa-character');
        if (!card) return;
        
        const char = this.characters[0];
        if (!char) {
            card.outerHTML = `
                <a href="sheet.html" class="qa-character qa-character--empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.3;margin-bottom:16px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <h3 style="margin-bottom:8px;font-size:18px;">Kein Charakter</h3>
                    <p style="color:#888;font-size:14px;">Erstelle deinen ersten Helden</p>
                </a>
            `;
            return;
        }
        
        const avatar = card.querySelector('.qa-character__avatar');
        const name = card.querySelector('.qa-character__name');
        const cls = card.querySelector('.qa-character__class');
        
        if (avatar) {
            // Portrait can be in multiple locations
            const portraitUrl = char.image || char.portrait || char.portraitUrl || char.data?.portrait;
            // Only use if it's a valid URL (starts with http) or base64 data
            if (portraitUrl && (portraitUrl.startsWith('http') || portraitUrl.startsWith('data:'))) {
                avatar.style.background = 'var(--bg-elevated)';
                avatar.innerHTML = `<img src="${portraitUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
            } else {
                avatar.style.background = char.color || 'linear-gradient(135deg,#667eea,#764ba2)';
                avatar.innerHTML = '';
            }
        }
        if (name) name.textContent = char.name;
        if (cls) cls.textContent = `${char.race||''} · ${char.class||''}`.replace(/^ · | · $/g,'');
        card.href = `sheet.html?id=${char.id}`;
    },
    
    // ========================================
    // NEWS & QUOTE
    // ========================================
    
    updateNewsSection() {
        if (this.news.length === 0) return;
        
        const featured = this.news.find(n => n.featured) || this.news[0];
        const others = this.news.filter(n => n.id !== featured.id).slice(0, 5);
        const cat = { news:'News', update:'Update', regelwerk:'Regelwerk', community:'Community' };
        
        const main = document.querySelector('.news-main');
        if (main && featured) {
            const img = main.querySelector('.news-main__image');
            const badge = main.querySelector('.news-main__badge');
            const title = main.querySelector('.news-main__title');
            const desc = main.querySelector('.news-main__desc');
            if (img) img.style.backgroundImage = `url('${featured.image}')`;
            if (badge) badge.textContent = cat[featured.category] || 'News';
            if (title) title.textContent = featured.title;
            if (desc) desc.textContent = featured.excerpt || '';
            main.style.cursor = 'pointer';
            main.onclick = () => featured.link && (window.location.href = featured.link);
        }
        
        const list = document.querySelector('.news-list');
        if (list && others.length) {
            list.innerHTML = others.map(n => `
                <a href="${n.link||'#'}" class="news-item">
                    <div class="news-item__image" style="background-image:url('${n.image}')"></div>
                    <div class="news-item__content">
                        <span class="news-item__badge">${cat[n.category]||'News'}</span>
                        <h4 class="news-item__title">${n.title}</h4>
                    </div>
                </a>
            `).join('');
        }
    },
    
    updateDailyQuote() {
        if (this.quotes.length === 0) return;
        const day = Math.floor((new Date() - new Date(new Date().getFullYear(),0,0)) / 86400000);
        const q = this.quotes[day % this.quotes.length];
        const el = document.querySelector('.daily-quote__quote');
        const auth = document.querySelector('.daily-quote__author');
        if (el) el.textContent = `„${q.text}"`;
        if (auth) auth.innerHTML = `${q.author}${q.source ? `<span class="daily-quote__source"> — ${q.source}</span>` : ''}`;
    },
    
    // ========================================
    // WIDGETS
    // ========================================
    
    updateWidgets() {
        // Ensure arrays
        if (!Array.isArray(this.sessions)) this.sessions = [];
        if (!Array.isArray(this.characters)) this.characters = [];
        if (!Array.isArray(this.partyMembers)) this.partyMembers = [];
        
        // Sessions
        const sw = document.querySelector('#widget-sessions .widget__list');
        if (sw) {
            if (this.sessions.length === 0) {
                sw.innerHTML = `<div class="widget__empty"><p>Keine Sessions</p><a href="sessions.html" class="btn btn--small">Erstellen</a></div>`;
            } else {
                sw.innerHTML = this.sessions.slice(0,3).map(s => `
                    <a href="session.html?id=${s.id}" class="widget__list-item">
                        <div class="widget__list-icon" style="background:${s.color||'#8b5cf6'}">${s.image?`<img src="${s.image}">`:'🎲'}</div>
                        <div class="widget__list-info">
                            <div class="widget__list-title">${s.name}</div>
                            <div class="widget__list-meta">${s.ruleset||''} · ${s.playerCount||1} Spieler</div>
                        </div>
                    </a>
                `).join('');
            }
        }
        
        // Characters
        const cw = document.querySelector('#widget-characters .widget__list');
        if (cw) {
            if (this.characters.length === 0) {
                cw.innerHTML = `<div class="widget__empty"><p>Keine Charaktere</p><a href="sheet.html" class="btn btn--small">Erstellen</a></div>`;
            } else {
                cw.innerHTML = this.characters.slice(0,3).map(c => `
                    <a href="sheet.html?id=${c.id}" class="widget__list-item">
                        <div class="widget__list-icon" style="background:${c.color||'linear-gradient(135deg,#667eea,#764ba2)'}">${c.image?`<img src="${c.image}">`:(c.name||'C').charAt(0)}</div>
                        <div class="widget__list-info">
                            <div class="widget__list-title">${c.name}</div>
                            <div class="widget__list-meta">${c.race||''} ${c.class||''}</div>
                        </div>
                    </a>
                `).join('');
            }
        }
        
        // Party
        const pw = document.querySelector('#widget-party .widget__content');
        if (pw) {
            if (this.partyMembers.length === 0) {
                pw.innerHTML = `<div class="widget__empty"><p>Keine Party</p><a href="sessions.html" class="btn btn--small">Beitreten</a></div>`;
            } else {
                pw.innerHTML = `<div class="widget__party">${this.partyMembers.slice(0,4).map(m => `
                    <div class="widget__party-member">
                        <div class="widget__party-avatar" style="background:${m.color||'#8b5cf6'}">${(m.name||'?').charAt(0)}${m.online?'<span class="widget__party-status"></span>':''}</div>
                        <span class="widget__party-name">${m.name||'Spieler'}</span>
                    </div>
                `).join('')}</div>`;
            }
        }
    },
    
    // ========================================
    // PRICING
    // ========================================
    
    updatePricing() {
        if (!this.pricing) return;
        
        // Plus tier
        const priceEl = document.getElementById('plus-price');
        const featuresEl = document.getElementById('plus-features');
        
        if (priceEl && this.pricing.plusPrice) {
            priceEl.textContent = this.pricing.plusPrice + '€';
        }
        
        if (featuresEl && this.pricing.plusFeatures && this.pricing.plusFeatures.length) {
            featuresEl.innerHTML = this.pricing.plusFeatures.map(f => `
                <li><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>${f}</li>
            `).join('');
        }
        
        // Free tier
        const freeFeatures = document.querySelector('.rift-plus__tier--free .rift-plus__tier-features');
        if (freeFeatures && this.pricing.freeFeatures && this.pricing.freeFeatures.length) {
            freeFeatures.innerHTML = this.pricing.freeFeatures.map(f => `
                <li><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>${f}</li>
            `).join('');
        }
    },
    
    // ========================================
    // FEATURE SHOWCASE
    // ========================================
    
    initFeatureShowcase() {
        const tabs = document.querySelectorAll('.feature-showcase__tab');
        const panels = document.querySelectorAll('.feature-showcase__panel');
        const infos = document.querySelectorAll('.feature-showcase__info');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                
                // Update tabs
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update panels
                panels.forEach(p => p.classList.remove('active'));
                document.querySelector(`[data-panel="${target}"]`)?.classList.add('active');
                
                // Update info
                infos.forEach(i => i.classList.remove('active'));
                document.querySelector(`[data-info="${target}"]`)?.classList.add('active');
            });
        });
    },
    
    // ========================================
    // EVENTS
    // ========================================
    
    setupEventListeners() {
        // Dropdowns
        document.querySelectorAll('.topnav__dropdown-trigger').forEach(t => {
            t.addEventListener('click', e => {
                e.stopPropagation();
                const open = t.classList.contains('open');
                document.querySelectorAll('.topnav__dropdown-trigger.open').forEach(x => x.classList.remove('open'));
                if (!open) t.classList.add('open');
            });
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('.topnav__dropdown-trigger.open').forEach(x => x.classList.remove('open'));
        });
        
        // News tabs
        document.querySelectorAll('.news-section__tab').forEach(t => {
            t.addEventListener('click', () => {
                document.querySelectorAll('.news-section__tab').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
            });
        });
    },
    
    // Actions
    copyRoomCode() {
        if (!this.roomCode) return;
        navigator.clipboard.writeText(this.roomCode.slice(0,3)+'-'+this.roomCode.slice(3));
        if (typeof showToast === 'function') showToast('Code kopiert!', 'success');
    },
    
    async signOut() {
        try {
            await this.auth?.signOut();
            localStorage.removeItem('rift_user');
            localStorage.removeItem('rift_current_room');
            window.location.href = 'login.html';
        } catch (e) {}
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => HubController.init());
window.HubController = HubController;

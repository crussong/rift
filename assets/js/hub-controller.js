/**
 * RIFT Hub Controller
 * Manages all dynamic content on the Hub page
 * - User data & authentication
 * - Sessions & Characters
 * - News from Firestore
 * - Quotes from Firestore
 * - Hero Slides
 * - Party members
 */

const HubController = {
    // State
    userData: null,
    roomCode: null,
    db: null,
    
    // Admin UIDs (same as in Firestore rules)
    ADMIN_UIDS: ['geBL1RI92jUiPrFK1oJ5u2Z25hM2'],
    
    // Data
    sessions: [],
    characters: [],
    partyMembers: [],
    news: [],
    quotes: [],
    slides: [],
    activeSession: null,
    activeCharacter: null,
    
    // Check if user is admin
    isAdmin(uid) {
        return this.ADMIN_UIDS.includes(uid);
    },
    
    // ========================================
    // INITIALIZATION
    // ========================================
    
    async init() {
        console.log('[Hub] Initializing...');
        
        // Initialize carousel immediately (static content)
        this.initCarousel();
        
        try {
            // Wait for Firebase
            await this.waitForFirebase();
            this.db = firebase.firestore();
            
            // Load user data first
            this.loadUserData();
            
            // Update user UI immediately
            this.updateUserUI();
            this.updateRoomUI();
            
            // Load all data in parallel
            await Promise.allSettled([
                this.loadSessions(),
                this.loadCharacters(),
                this.loadNews(),
                this.loadQuotes(),
                this.loadSlides(),
                this.loadPartyMembers()
            ]);
            
            // Update UI with loaded data
            this.updateHeroCarousel();
            this.updateQuickAccess();
            this.updateNewsSection();
            this.updateDailyQuote();
            this.updateWidgets();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Mark as ready
            document.body.classList.add('auth-ready');
            console.log('[Hub] Ready!');
            
        } catch (error) {
            console.error('[Hub] Init error:', error);
            // Still show the page even if Firebase fails
            document.body.classList.add('auth-ready');
            this.setupEventListeners();
        }
    },
    
    waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const check = () => {
                try {
                    // Check if Firebase is loaded AND initialized
                    if (typeof firebase !== 'undefined' && 
                        firebase.apps && 
                        firebase.apps.length > 0 &&
                        firebase.auth &&
                        firebase.firestore) {
                        resolve();
                    } else if (attempts > 50) {
                        reject(new Error('Firebase timeout'));
                    } else {
                        attempts++;
                        setTimeout(check, 100);
                    }
                } catch (e) {
                    if (attempts > 50) {
                        reject(e);
                    } else {
                        attempts++;
                        setTimeout(check, 100);
                    }
                }
            };
            check();
        });
    },
    
    // ========================================
    // USER DATA
    // ========================================
    
    loadUserData() {
        // From localStorage
        const stored = localStorage.getItem('rift_user');
        if (stored) {
            try {
                this.userData = JSON.parse(stored);
            } catch (e) {}
        }
        
        // From Firebase Auth
        const user = firebase.auth().currentUser;
        if (user) {
            this.userData = {
                ...this.userData,
                uid: user.uid,
                name: user.displayName || this.userData?.name || 'Spieler',
                email: user.email,
                avatar: user.photoURL || this.userData?.avatar,
                color: this.userData?.color || '#FF4655',
                isGM: this.userData?.isGM || false,
                isAdmin: this.userData?.isAdmin || false
            };
        }
        
        // Room code
        this.roomCode = localStorage.getItem('rift_current_room');
        
        console.log('[Hub] User:', this.userData?.name, 'Room:', this.roomCode);
    },
    
    updateUserUI() {
        if (!this.userData) return;
        
        // TopNav User Avatar (small, in trigger)
        const userAvatar = document.querySelector('.topnav__user-avatar');
        if (userAvatar) {
            userAvatar.style.background = this.userData.color || '#FF4655';
            if (this.userData.avatar) {
                userAvatar.innerHTML = `<img src="${this.userData.avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                userAvatar.textContent = (this.userData.name || 'S').charAt(0).toUpperCase();
            }
        }
        
        // TopNav User Name
        const userName = document.querySelector('.topnav__user-name');
        if (userName) {
            userName.textContent = this.userData.name || 'Spieler';
        }
        
        // Dropdown User Avatar (large)
        const dropdownAvatar = document.querySelector('.topnav__dropdown-user-avatar');
        if (dropdownAvatar) {
            dropdownAvatar.style.background = this.userData.color || '#FF4655';
            if (this.userData.avatar) {
                dropdownAvatar.innerHTML = `<img src="${this.userData.avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                dropdownAvatar.textContent = (this.userData.name || 'S').charAt(0).toUpperCase();
            }
        }
        
        // Dropdown User Name & Email
        const dropdownName = document.querySelector('.topnav__dropdown-user-name');
        if (dropdownName) {
            dropdownName.textContent = this.userData.name || 'Spieler';
        }
        
        const dropdownEmail = document.querySelector('.topnav__dropdown-user-email');
        if (dropdownEmail) {
            dropdownEmail.textContent = this.userData.email || '';
        }
        
        // Show/hide admin link based on UID
        const adminLinks = document.querySelectorAll('[href="admin.html"]');
        const isAdmin = this.isAdmin(this.userData?.uid);
        adminLinks.forEach(link => {
            link.style.display = isAdmin ? '' : 'none';
        });
        
        // Show/hide GM Center based on role (GM or Admin)
        const gmLink = document.querySelector('.meganav__item--gm');
        if (gmLink) {
            gmLink.style.display = (this.userData.isGM || isAdmin) ? '' : 'none';
        }
    },
    
    // ========================================
    // ROOM & PARTY
    // ========================================
    
    updateRoomUI() {
        const partyEl = document.querySelector('.topnav__party');
        const roomCodeEl = document.querySelector('.topnav__room-code');
        
        if (!this.roomCode) {
            if (partyEl) partyEl.style.display = 'none';
            if (roomCodeEl) roomCodeEl.style.display = 'none';
            return;
        }
        
        // Show elements
        if (partyEl) partyEl.style.display = '';
        if (roomCodeEl) roomCodeEl.style.display = '';
        
        // Format room code (ABC-DEF)
        const formatted = this.roomCode.length === 6 
            ? this.roomCode.slice(0, 3) + '-' + this.roomCode.slice(3)
            : this.roomCode;
        
        // Update code display
        const codeDisplay = document.querySelector('.topnav__room-code code');
        if (codeDisplay) {
            codeDisplay.textContent = formatted;
        }
    },
    
    async loadPartyMembers() {
        if (!this.roomCode) return;
        
        try {
            // Try RIFT room service
            if (window.RIFT?.rooms?.getRoomMembers) {
                this.partyMembers = await RIFT.rooms.getRoomMembers(this.roomCode);
            } else {
                // Direct Firestore query
                const snapshot = await this.db
                    .collection('rooms')
                    .doc(this.roomCode)
                    .collection('members')
                    .get();
                
                this.partyMembers = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            
            this.updatePartyUI();
        } catch (e) {
            console.warn('[Hub] Failed to load party:', e);
        }
    },
    
    updatePartyUI() {
        const online = this.partyMembers.filter(m => m.online || m.status === 'online');
        
        // Update avatars in topnav
        const avatarsEl = document.querySelector('.topnav__party-avatars');
        if (avatarsEl && online.length > 0) {
            avatarsEl.innerHTML = online.slice(0, 3).map(m => `
                <div class="topnav__party-avatar" style="background: ${m.color || '#8b5cf6'}">
                    ${(m.name || m.displayName || '?').charAt(0).toUpperCase()}
                </div>
            `).join('');
        }
        
        // Update status
        const statusEl = document.querySelector('.topnav__party-status');
        if (statusEl) {
            statusEl.textContent = `${online.length} Online`;
        }
        
        // Update party widget
        const partyWidget = document.querySelector('#widget-party .widget__content');
        if (partyWidget) {
            if (this.partyMembers.length === 0) {
                partyWidget.innerHTML = `
                    <div class="widget__empty">
                        <p>Noch keine Party</p>
                        <button class="btn btn--small" onclick="HubController.inviteToParty()">Spieler einladen</button>
                    </div>
                `;
            } else {
                partyWidget.innerHTML = `
                    <div class="party-avatars">
                        ${this.partyMembers.slice(0, 4).map(m => `
                            <div class="party-avatar ${m.online ? 'online' : ''}" 
                                 style="background: ${m.color || '#8b5cf6'}"
                                 title="${m.name || m.displayName}">
                                ${m.avatar 
                                    ? `<img src="${m.avatar}" alt="">` 
                                    : (m.name || '?').charAt(0).toUpperCase()}
                                ${m.online ? '<span class="online-dot"></span>' : ''}
                            </div>
                        `).join('')}
                        ${this.partyMembers.length > 4 ? `<div class="party-avatar more">+${this.partyMembers.length - 4}</div>` : ''}
                    </div>
                    <button class="widget__link" onclick="HubController.inviteToParty()">Einladen →</button>
                `;
            }
        }
    },
    
    inviteToParty() {
        if (this.roomCode) {
            const formatted = this.roomCode.slice(0, 3) + '-' + this.roomCode.slice(3);
            const url = `${window.location.origin}/session.html?room=${this.roomCode}`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'RIFT Session',
                    text: `Tritt meiner RIFT Session bei! Code: ${formatted}`,
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url);
                this.showToast('Link kopiert!', 'success');
            }
        } else {
            window.location.href = 'sessions.html';
        }
    },
    
    // ========================================
    // SESSIONS
    // ========================================
    
    async loadSessions() {
        try {
            // From localStorage (offline-first)
            const stored = localStorage.getItem('rift_sessions');
            if (stored) {
                this.sessions = JSON.parse(stored);
            }
            
            // Active session
            const activeStored = localStorage.getItem('rift_active_session');
            if (activeStored) {
                this.activeSession = JSON.parse(activeStored);
            }
            
            // Try to load from Firestore if logged in
            if (this.userData?.uid && this.db) {
                const snapshot = await this.db
                    .collection('sessions')
                    .where('members', 'array-contains', this.userData.uid)
                    .orderBy('lastPlayed', 'desc')
                    .limit(10)
                    .get();
                
                if (!snapshot.empty) {
                    this.sessions = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    localStorage.setItem('rift_sessions', JSON.stringify(this.sessions));
                }
            }
            
            console.log('[Hub] Sessions loaded:', this.sessions.length);
        } catch (e) {
            console.warn('[Hub] Failed to load sessions:', e);
        }
    },
    
    // ========================================
    // CHARACTERS
    // ========================================
    
    async loadCharacters() {
        try {
            // Use CharacterStorage if available
            if (typeof CharacterStorage !== 'undefined') {
                this.characters = await CharacterStorage.getAll();
            } else {
                // Fallback to localStorage
                const stored = localStorage.getItem('rift_characters');
                if (stored) {
                    this.characters = JSON.parse(stored);
                }
            }
            
            // Find last active character
            const lastCharId = localStorage.getItem('rift_last_character');
            if (lastCharId) {
                this.activeCharacter = this.characters.find(c => c.id === lastCharId);
            }
            
            // Fallback to first character
            if (!this.activeCharacter && this.characters.length > 0) {
                this.activeCharacter = this.characters[0];
            }
            
            console.log('[Hub] Characters loaded:', this.characters.length);
        } catch (e) {
            console.warn('[Hub] Failed to load characters:', e);
        }
    },
    
    // ========================================
    // NEWS (from Firestore)
    // ========================================
    
    async loadNews() {
        try {
            const snapshot = await this.db
                .collection('hub_news')
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
            
            this.news = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('[Hub] News loaded:', this.news.length);
        } catch (e) {
            console.warn('[Hub] Failed to load news:', e);
            // Fallback news
            this.news = [{
                id: 'welcome',
                title: 'Willkommen bei RIFT',
                excerpt: 'Dein digitaler Begleiter für Pen & Paper Rollenspiele.',
                category: 'news',
                image: 'assets/img/news/news_placeholder.svg',
                featured: true
            }];
        }
    },
    
    updateNewsSection() {
        const newsGrid = document.querySelector('.news-section__grid');
        if (!newsGrid || this.news.length === 0) return;
        
        // Find featured article
        const featured = this.news.find(n => n.featured) || this.news[0];
        const others = this.news.filter(n => n.id !== featured.id).slice(0, 5);
        
        // Category labels
        const categoryLabels = {
            news: 'News',
            update: 'Update',
            regelwerk: 'Regelwerk',
            community: 'Community'
        };
        
        // Update featured card (news-main)
        const newsMain = newsGrid.querySelector('.news-main');
        if (newsMain && featured) {
            const imageEl = newsMain.querySelector('.news-main__image');
            const badgeEl = newsMain.querySelector('.news-main__badge');
            const titleEl = newsMain.querySelector('.news-main__title');
            const descEl = newsMain.querySelector('.news-main__desc');
            
            if (imageEl) imageEl.style.backgroundImage = `url('${featured.image || 'assets/img/news/news_placeholder.svg'}')`;
            if (badgeEl) badgeEl.textContent = categoryLabels[featured.category] || 'News';
            if (titleEl) titleEl.textContent = featured.title;
            if (descEl) descEl.textContent = featured.excerpt || '';
            
            // Make clickable
            newsMain.style.cursor = 'pointer';
            newsMain.onclick = () => {
                if (featured.link) window.location.href = featured.link;
            };
        }
        
        // Update sidebar (news-list)
        const newsList = newsGrid.querySelector('.news-list');
        if (newsList && others.length > 0) {
            newsList.innerHTML = others.map(item => `
                <a href="${item.link || '#'}" class="news-item">
                    <div class="news-item__image" style="background-image: url('${item.image || 'assets/img/news/news_placeholder.svg'}');"></div>
                    <div class="news-item__content">
                        <span class="news-item__badge">${categoryLabels[item.category] || 'News'}</span>
                        <h4 class="news-item__title">${item.title}</h4>
                    </div>
                </a>
            `).join('');
        }
    },
    
    // ========================================
    // QUOTES (from Firestore)
    // ========================================
    
    async loadQuotes() {
        try {
            const snapshot = await this.db
                .collection('hub_quotes')
                .get();
            
            this.quotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('[Hub] Quotes loaded:', this.quotes.length);
        } catch (e) {
            console.warn('[Hub] Failed to load quotes:', e);
            // Fallback quotes
            this.quotes = [
                {
                    text: "Ein wahrer Held ist nicht der, der keine Angst kennt, sondern der, der trotz seiner Angst handelt.",
                    author: "Gandalf der Graue",
                    source: "Der Herr der Ringe"
                },
                {
                    text: "Würfel entscheiden nicht über dein Schicksal. Du entscheidest, wie du mit dem Ergebnis umgehst.",
                    author: "Unbekannter Spielleiter",
                    source: "Alte Weisheit"
                },
                {
                    text: "In der Dunkelheit finden wir das Licht, wenn wir zusammenhalten.",
                    author: "Elara Mondschein",
                    source: "Worlds Apart"
                }
            ];
        }
    },
    
    updateDailyQuote() {
        const quoteSection = document.querySelector('.daily-quote');
        if (!quoteSection || this.quotes.length === 0) return;
        
        // Pick quote based on day (deterministic per day)
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
        const quote = this.quotes[dayOfYear % this.quotes.length];
        
        const quoteEl = quoteSection.querySelector('.daily-quote__quote');
        const authorEl = quoteSection.querySelector('.daily-quote__author');
        
        if (quoteEl) quoteEl.textContent = `„${quote.text}"`;
        if (authorEl) {
            authorEl.innerHTML = `${quote.author}${quote.source ? `<span class="daily-quote__source"> — ${quote.source}</span>` : ''}`;
        }
    },
    
    // ========================================
    // HERO SLIDES (from Firestore)
    // ========================================
    
    async loadSlides() {
        try {
            const snapshot = await this.db
                .collection('hub_slides')
                .where('active', '==', true)
                .orderBy('order', 'asc')
                .get();
            
            this.slides = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('[Hub] Slides loaded:', this.slides.length);
        } catch (e) {
            console.warn('[Hub] Failed to load slides:', e);
        }
    },
    
    updateHeroCarousel() {
        const carousel = document.querySelector('.hero-carousel');
        if (!carousel) return;
        
        const bgContainer = carousel.querySelector('.hero-carousel__bg');
        const contentContainer = carousel.querySelector('.hero-carousel__content');
        const navTabs = carousel.querySelector('.hero-carousel__nav-tabs');
        
        if (!bgContainer || !contentContainer || !navTabs) return;
        
        // Build slides array - Slide 0 is always active session (if exists)
        let allSlides = [];
        
        // Slide 0: Active Session (dynamic)
        if (this.activeSession) {
            allSlides.push({
                id: 'session',
                type: 'session',
                overline: this.activeSession.ruleset || 'Session',
                badge: 'Weiterspielen',
                title: this.activeSession.name || 'Deine Session',
                desc: this.activeSession.description || 'Setze dein Abenteuer fort.',
                image: this.activeSession.image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&h=1080&fit=crop',
                btnText: 'Session öffnen',
                btnLink: `session.html?id=${this.activeSession.id}`,
                tabName: 'Session',
                color: 'accent'
            });
        }
        
        // Add slides from Firestore
        allSlides = allSlides.concat(this.slides);
        
        // If no slides at all, use defaults
        if (allSlides.length === 0) {
            allSlides = [
                {
                    overline: 'Willkommen',
                    badge: 'Neu',
                    title: 'Willkommen bei RIFT',
                    desc: 'Dein digitaler Begleiter für Pen & Paper Rollenspiele.',
                    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&h=1080&fit=crop',
                    btnText: 'Loslegen',
                    btnLink: 'sessions.html',
                    tabName: 'Start',
                    color: 'accent'
                }
            ];
        }
        
        // Limit to 4 slides
        allSlides = allSlides.slice(0, 4);
        
        // Generate HTML
        bgContainer.innerHTML = allSlides.map((slide, i) => `
            <div class="hero-carousel__bg-image ${i === 0 ? 'active' : ''}" 
                 style="background-image: url('${slide.image}');"></div>
        `).join('');
        
        contentContainer.innerHTML = allSlides.map((slide, i) => `
            <div class="hero-carousel__slide ${i === 0 ? 'active' : ''}" data-slide="${i}">
                <div class="hero-carousel__overline">${slide.overline || ''}</div>
                <span class="hero-carousel__badge">${slide.badge || ''}</span>
                <h1 class="hero-carousel__title">${slide.title}</h1>
                <p class="hero-carousel__desc">${slide.desc || ''}</p>
                <a href="${slide.btnLink || '#'}" class="hero-carousel__btn">
                    ${slide.btnText || 'Mehr erfahren'}
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="m16.172 11-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"/></svg>
                </a>
            </div>
        `).join('');
        
        navTabs.innerHTML = allSlides.map((slide, i) => `
            <button class="hero-carousel__nav-btn ${i === 0 ? 'active' : ''}" 
                    data-slide="${i}" 
                    data-color="${slide.color || 'accent'}">
                ${slide.tabName || slide.overline || 'Slide'}
            </button>
        `).join('');
        
        // Reinitialize carousel
        this.initCarousel();
    },
    
    initCarousel() {
        const slides = document.querySelectorAll('.hero-carousel__slide');
        const bgImages = document.querySelectorAll('.hero-carousel__bg-image');
        const navBtns = document.querySelectorAll('.hero-carousel__nav-btn');
        const prevBtn = document.querySelector('.hero-carousel__arrow--prev');
        const nextBtn = document.querySelector('.hero-carousel__arrow--next');
        const progressBar = document.querySelector('.hero-carousel__progress-bar');
        
        if (slides.length === 0) return;
        
        let currentSlide = 0;
        let autoplayInterval;
        const slideDuration = 6000;
        
        const slideColors = {
            'accent': '#FF4655',
            'blue': '#3b82f6',
            'amber': '#f59e0b',
            'red': '#ef4444',
            'purple': '#8b5cf6',
            'cyan': '#06b6d4'
        };
        
        const showSlide = (index) => {
            if (index < 0) index = slides.length - 1;
            if (index >= slides.length) index = 0;
            
            currentSlide = index;
            
            slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
            bgImages.forEach((bg, i) => bg.classList.toggle('active', i === index));
            navBtns.forEach((btn, i) => btn.classList.toggle('active', i === index));
            
            const activeBtn = navBtns[index];
            const colorKey = activeBtn?.dataset.color || 'accent';
            if (progressBar) {
                progressBar.style.background = slideColors[colorKey] || slideColors.accent;
            }
        };
        
        const startProgress = () => {
            if (!progressBar) return;
            progressBar.style.transition = 'none';
            progressBar.style.width = '0%';
            progressBar.offsetWidth; // Force reflow
            progressBar.style.transition = `width ${slideDuration}ms linear`;
            progressBar.style.width = '100%';
        };
        
        const startAutoplay = () => {
            startProgress();
            autoplayInterval = setInterval(() => {
                showSlide(currentSlide + 1);
                startProgress();
            }, slideDuration);
        };
        
        const restartAutoplay = () => {
            clearInterval(autoplayInterval);
            startAutoplay();
        };
        
        // Event listeners
        navBtns.forEach((btn, i) => {
            btn.addEventListener('click', () => {
                showSlide(i);
                restartAutoplay();
            });
        });
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                showSlide(currentSlide - 1);
                restartAutoplay();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                showSlide(currentSlide + 1);
                restartAutoplay();
            });
        }
        
        // Start
        showSlide(0);
        startAutoplay();
    },
    
    // ========================================
    // QUICK ACCESS (Session + Character)
    // ========================================
    
    updateQuickAccess() {
        this.updateQuickAccessSession();
        this.updateQuickAccessCharacter();
    },
    
    updateQuickAccessSession() {
        const sessionCard = document.querySelector('.qa-session');
        if (!sessionCard) return;
        
        if (!this.activeSession && this.sessions.length === 0) {
            // No sessions - show create prompt
            sessionCard.outerHTML = `
                <a href="sessions.html" class="qa-session qa-session--empty">
                    <div class="qa-session__empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </div>
                    <div class="qa-session__content">
                        <span class="qa-session__label">Keine Sessions</span>
                        <h3 class="qa-session__title">Session erstellen</h3>
                        <p class="qa-session__desc">Starte dein erstes Abenteuer oder tritt einer bestehenden Session bei.</p>
                    </div>
                </a>
            `;
            return;
        }
        
        const session = this.activeSession || this.sessions[0];
        const isActive = session.status === 'active' || this.roomCode === session.roomCode;
        
        // Format date
        let dateStr = '';
        if (session.lastPlayed) {
            const date = session.lastPlayed.toDate ? session.lastPlayed.toDate() : new Date(session.lastPlayed);
            dateStr = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        
        // Update card content
        const cover = sessionCard.querySelector('.qa-session__cover');
        const liveIndicator = sessionCard.querySelector('.qa-session__live');
        const title = sessionCard.querySelector('.qa-session__title');
        const desc = sessionCard.querySelector('.qa-session__desc');
        const dateEl = sessionCard.querySelector('.qa-session__meta-item:first-child');
        const playersEl = sessionCard.querySelector('.qa-session__meta-item:last-child');
        
        if (cover) cover.style.backgroundImage = `url('${session.image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=600&fit=crop'}')`;
        if (liveIndicator) liveIndicator.style.display = isActive ? '' : 'none';
        if (title) title.textContent = session.name || 'Session';
        if (desc) desc.textContent = session.description || '';
        if (dateEl) dateEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 2a1 1 0 0 1 1 1v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 1 1 2 0v1h6V3a1 1 0 0 1 1-1zm3 9H5v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8z"/></svg>${dateStr || 'Neu'}`;
        if (playersEl) playersEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1-5 5l.005-.217A5 5 0 0 1 12 2zM4 22a8 8 0 1 1 16 0z"/></svg>${session.playerCount || session.members?.length || 1}/${session.maxPlayers || 4} Spieler`;
        
        // Update link
        sessionCard.href = session.id ? `session.html?id=${session.id}` : 'sessions.html';
        
        // Update tags
        const tagsContainer = sessionCard.querySelector('.qa-session__tags');
        if (tagsContainer && session.tags) {
            tagsContainer.innerHTML = session.tags.slice(0, 3).map(tag => 
                `<span class="qa-session__tag">${tag}</span>`
            ).join('');
        }
    },
    
    updateQuickAccessCharacter() {
        const charCard = document.querySelector('.qa-character');
        if (!charCard) return;
        
        if (!this.activeCharacter && this.characters.length === 0) {
            // No characters - show create prompt
            charCard.outerHTML = `
                <a href="sheet.html" class="qa-character qa-character--empty">
                    <div class="qa-character__empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </div>
                    <div class="qa-character__info">
                        <span class="qa-character__label">Dein Charakter</span>
                        <h3 class="qa-character__name">Charakter erstellen</h3>
                        <p class="qa-character__class">Erstelle deinen ersten Helden</p>
                    </div>
                </a>
            `;
            return;
        }
        
        const char = this.activeCharacter || this.characters[0];
        
        // Get sheet URL based on ruleset
        const sheetUrls = {
            'worldsapart': 'sheet-worldsapart.html',
            'dnd5e': 'sheet-5e.html',
            '5e': 'sheet-5e.html',
            'htbah': 'sheet-htbah.html',
            'cyberpunkred': 'sheet-cyberpunkred.html'
        };
        const sheetUrl = sheetUrls[char.ruleset?.toLowerCase()] || 'sheet.html';
        
        // Update card
        const avatar = charCard.querySelector('.qa-character__avatar');
        const name = charCard.querySelector('.qa-character__name');
        const classEl = charCard.querySelector('.qa-character__class');
        
        if (avatar) {
            avatar.style.background = char.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            if (char.image) {
                avatar.innerHTML = `<img src="${char.image}" alt="${char.name}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
            } else {
                avatar.innerHTML = `<span style="font-size:24px;font-weight:600;">${(char.name || 'C').charAt(0)}</span>`;
            }
        }
        
        if (name) name.textContent = char.name || 'Charakter';
        if (classEl) classEl.textContent = `${char.race || ''} · ${char.class || char.archetype || ''}`.replace(/^ · | · $/g, '');
        
        charCard.href = `${sheetUrl}?id=${char.id}`;
        
        // Update stats bars
        this.updateCharacterStats(charCard, char);
    },
    
    updateCharacterStats(container, char) {
        // HP/LP Bar
        const hpBar = container.querySelector('.qa-character__stat:nth-child(1) .qa-character__stat-fill');
        const hpValue = container.querySelector('.qa-character__stat:nth-child(1) .qa-character__stat-value');
        if (hpBar && hpValue) {
            const hp = char.hp || char.lp || { current: 100, max: 100 };
            const hpPercent = (hp.current / hp.max) * 100;
            hpBar.style.width = `${hpPercent}%`;
            hpValue.textContent = `${hp.current}/${hp.max}`;
        }
        
        // Moral/Mana Bar (if exists)
        const moralBar = container.querySelector('.qa-character__stat:nth-child(2) .qa-character__stat-fill');
        const moralValue = container.querySelector('.qa-character__stat:nth-child(2) .qa-character__stat-value');
        if (moralBar && moralValue) {
            const moral = char.moral || char.mana || { current: 60, max: 100 };
            const moralPercent = (moral.current / moral.max) * 100;
            moralBar.style.width = `${moralPercent}%`;
            moralValue.textContent = `${moral.current}/${moral.max}`;
        }
        
        // Resonanz/Focus Bar (if exists)
        const resBar = container.querySelector('.qa-character__stat:nth-child(3) .qa-character__stat-fill');
        const resValue = container.querySelector('.qa-character__stat:nth-child(3) .qa-character__stat-value');
        if (resBar && resValue) {
            const res = char.resonanz || char.focus || { current: 45, max: 100 };
            const resPercent = (res.current / res.max) * 100;
            resBar.style.width = `${resPercent}%`;
            resValue.textContent = `${res.current}/${res.max}`;
        }
    },
    
    // ========================================
    // WIDGETS
    // ========================================
    
    updateWidgets() {
        this.updateSessionsWidget();
        this.updateCharactersWidget();
        this.updateAchievementsWidget();
        // Party widget is updated in updatePartyUI()
    },
    
    updateSessionsWidget() {
        const widget = document.querySelector('#widget-sessions .widget__list');
        if (!widget) return;
        
        if (this.sessions.length === 0) {
            widget.innerHTML = `
                <div class="widget__empty">
                    <p>Keine Sessions</p>
                    <a href="sessions.html" class="btn btn--small">Session erstellen</a>
                </div>
            `;
            return;
        }
        
        widget.innerHTML = this.sessions.slice(0, 3).map(session => {
            const isActive = session.status === 'active';
            return `
                <a href="session.html?id=${session.id}" class="widget__item">
                    <div class="widget__item-icon" style="background: ${session.color || '#8b5cf6'}">
                        ${session.image ? `<img src="${session.image}" alt="">` : '🎲'}
                    </div>
                    <div class="widget__item-info">
                        <span class="widget__item-name">${session.name}</span>
                        <span class="widget__item-meta">${session.ruleset || 'Session'} · ${session.playerCount || 1} Spieler</span>
                    </div>
                    ${isActive ? '<span class="widget__item-badge active">Aktiv</span>' : ''}
                </a>
            `;
        }).join('');
    },
    
    updateCharactersWidget() {
        const widget = document.querySelector('#widget-characters .widget__list');
        if (!widget) return;
        
        if (this.characters.length === 0) {
            widget.innerHTML = `
                <div class="widget__empty">
                    <p>Keine Charaktere</p>
                    <a href="sheet.html" class="btn btn--small">Charakter erstellen</a>
                </div>
            `;
            return;
        }
        
        widget.innerHTML = this.characters.slice(0, 3).map(char => `
            <a href="sheet.html?id=${char.id}" class="widget__item">
                <div class="widget__item-icon" style="background: ${char.color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}">
                    ${char.image ? `<img src="${char.image}" alt="">` : (char.name || 'C').charAt(0)}
                </div>
                <div class="widget__item-info">
                    <span class="widget__item-name">${char.name}</span>
                    <span class="widget__item-meta">${char.race || ''} ${char.class || char.archetype || ''}</span>
                </div>
                <span class="widget__item-level">Lvl ${char.level || 1}</span>
            </a>
        `).join('');
    },
    
    updateAchievementsWidget() {
        // Achievements are static for now - could be expanded later
        const widget = document.querySelector('#widget-achievements');
        if (!widget) return;
        
        // Just update the counter if we have real data
        const counter = widget.querySelector('.widget__header-count');
        if (counter) {
            // This would come from user data
            const unlocked = this.userData?.achievements?.length || 0;
            counter.textContent = `${unlocked} von 24 freigeschaltet`;
        }
    },
    
    // ========================================
    // EVENT LISTENERS
    // ========================================
    
    setupEventListeners() {
        // Dropdown toggles
        document.querySelectorAll('.topnav__dropdown-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const wasOpen = trigger.classList.contains('open');
                document.querySelectorAll('.topnav__dropdown-trigger.open').forEach(el => el.classList.remove('open'));
                if (!wasOpen) trigger.classList.add('open');
            });
        });
        
        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.topnav__dropdown-trigger.open').forEach(el => el.classList.remove('open'));
        });
        
        // News tabs
        document.querySelectorAll('.news-section__tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.news-section__tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Filter news by category (if needed)
            });
        });
        
        // Copy room code
        const copyBtn = document.querySelector('[onclick*="copyRoomCode"]');
        if (copyBtn) {
            copyBtn.onclick = () => this.copyRoomCode();
        }
        
        // Sign out
        const signOutBtn = document.querySelector('[onclick*="signOut"]');
        if (signOutBtn) {
            signOutBtn.onclick = () => this.signOut();
        }
    },
    
    // ========================================
    // ACTIONS
    // ========================================
    
    copyRoomCode() {
        if (!this.roomCode) return;
        
        const formatted = this.roomCode.slice(0, 3) + '-' + this.roomCode.slice(3);
        navigator.clipboard.writeText(formatted);
        this.showToast('Room-Code kopiert!', 'success');
    },
    
    async signOut() {
        try {
            await firebase.auth().signOut();
            localStorage.removeItem('rift_user');
            localStorage.removeItem('rift_current_room');
            window.location.href = 'login.html';
        } catch (e) {
            console.error('[Hub] Sign out error:', e);
            this.showToast('Fehler beim Abmelden', 'error');
        }
    },
    
    showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`[Toast] ${type}: ${message}`);
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    HubController.init();
});

// Export for global access
window.HubController = HubController;

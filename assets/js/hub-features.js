/**
 * RIFT - Hub Features
 * Hero Carousel, Quote of the Day, Activity Feed, Session Countdown
 */

// ============================================
// 1. HERO CAROUSEL (Firebase-based)
// ============================================

class HeroCarousel {
    constructor(container) {
        this.container = container;
        this.slidesContainer = container.querySelector('#carouselSlides') || container.querySelector('.hero-carousel__slides');
        this.tabsContainer = container.querySelector('#carouselTabs') || container.querySelector('.hero-carousel__tabs');
        this.dotsContainer = container.querySelector('#carouselDots') || container.querySelector('.hero-carousel__dots');
        this.prevBtn = container.querySelector('.hero-carousel__nav--prev');
        this.nextBtn = container.querySelector('.hero-carousel__nav--next');
        
        this.slides = [];
        this.tabs = [];
        this.dots = [];
        this.currentIndex = 0;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 6000;
        this.slidesData = [];
        
        this.init();
    }
    
    async init() {
        // Load from Firebase
        await this.loadFromFirebase();
        
        // Build slides
        if (this.slidesData.length > 0) {
            this.buildSlides();
        }
        
        // Re-query elements after building
        this.slides = this.container.querySelectorAll('.hero-carousel__slide');
        this.tabs = this.container.querySelectorAll('.hero-carousel__tab');
        this.dots = this.container.querySelectorAll('.hero-carousel__dot');
        
        if (this.slides.length === 0) {
            this.container.style.display = 'none';
            return;
        }
        
        // Navigation buttons
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.prev());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.next());
        }
        
        // Tab clicks
        this.tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => this.goTo(index));
        });
        
        // Dot clicks
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goTo(index));
        });
        
        // Keyboard navigation
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });
        
        // Pause on hover
        this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
        this.container.addEventListener('mouseleave', () => this.startAutoPlay());
        
        // Touch swipe
        this.initTouchSwipe();
        
        // Start autoplay
        this.startAutoPlay();
    }
    
    async loadFromFirebase() {
        try {
            // Check if Firebase is available
            if (typeof firebase === 'undefined' || !firebase.firestore) {
                console.warn('[Carousel] Firebase not available');
                return;
            }
            
            const db = firebase.firestore();
            const snapshot = await db.collection('hub_carousel')
                .where('active', '==', true)
                .orderBy('order', 'asc')
                .get();
            
            this.slidesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('[Carousel] Loaded', this.slidesData.length, 'slides from Firebase');
        } catch (error) {
            console.warn('[Carousel] Could not load from Firebase:', error);
            this.slidesData = [];
        }
    }
    
    buildSlides() {
        if (!this.slidesContainer) return;
        
        // Clear existing
        this.slidesContainer.innerHTML = '';
        if (this.tabsContainer) this.tabsContainer.innerHTML = '';
        if (this.dotsContainer) this.dotsContainer.innerHTML = '';
        
        this.slidesData.forEach((slide, index) => {
            // Build slide HTML
            const slideEl = document.createElement('div');
            slideEl.className = `hero-carousel__slide${index === 0 ? ' active' : ''}`;
            slideEl.dataset.slide = slide.id;
            
            const badgeClass = slide.badgeType ? `hero-carousel__badge--${slide.badgeType}` : '';
            const liveIndicator = slide.showLiveIndicator ? 
                `<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>` : '';
            
            slideEl.innerHTML = `
                <div class="hero-carousel__bg" style="background: ${slide.background || '#0d0d0d'};"></div>
                <div class="hero-carousel__overlay"></div>
                <div class="hero-carousel__content">
                    <span class="hero-carousel__badge ${badgeClass}">
                        ${liveIndicator}
                        ${slide.badge || ''}
                    </span>
                    <h2 class="hero-carousel__title">${slide.title || ''}</h2>
                    <p class="hero-carousel__desc">${slide.description || ''}</p>
                    <a href="${slide.ctaLink || '#'}" class="hero-carousel__cta">
                        ${slide.ctaText || 'Mehr erfahren'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                </div>
            `;
            
            this.slidesContainer.appendChild(slideEl);
            
            // Build tab
            if (this.tabsContainer) {
                const tabEl = document.createElement('button');
                tabEl.className = `hero-carousel__tab${index === 0 ? ' active' : ''}`;
                tabEl.dataset.slide = index;
                tabEl.innerHTML = index === 0 && slide.showLiveIndicator ? 
                    `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg> ${slide.tabLabel || ''}` :
                    slide.tabLabel || '';
                this.tabsContainer.appendChild(tabEl);
            }
            
            // Build dot
            if (this.dotsContainer) {
                const dotEl = document.createElement('button');
                dotEl.className = `hero-carousel__dot${index === 0 ? ' active' : ''}`;
                dotEl.dataset.slide = index;
                this.dotsContainer.appendChild(dotEl);
            }
        });
    }
    
    goTo(index) {
        // Update slides
        this.slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
        
        // Update tabs
        this.tabs.forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });
        
        // Update dots
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
        
        this.currentIndex = index;
        
        // Restart autoplay timer
        this.restartAutoPlay();
    }
    
    next() {
        if (this.slides.length === 0) return;
        const nextIndex = (this.currentIndex + 1) % this.slides.length;
        this.goTo(nextIndex);
    }
    
    prev() {
        if (this.slides.length === 0) return;
        const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
        this.goTo(prevIndex);
    }
    
    startAutoPlay() {
        if (this.autoPlayInterval) return;
        this.autoPlayInterval = setInterval(() => this.next(), this.autoPlayDelay);
    }
    
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    restartAutoPlay() {
        this.stopAutoPlay();
        this.startAutoPlay();
    }
    
    initTouchSwipe() {
        let startX = 0;
        let endX = 0;
        
        this.container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });
        
        this.container.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.next();
                } else {
                    this.prev();
                }
            }
        }, { passive: true });
    }
}

// ============================================
// 2. SESSION COUNTDOWN
// ============================================

class SessionCountdown {
    constructor(container, targetDate) {
        this.container = container;
        this.targetDate = new Date(targetDate);
        this.elements = {
            days: container.querySelector('[data-countdown="days"]'),
            hours: container.querySelector('[data-countdown="hours"]'),
            minutes: container.querySelector('[data-countdown="minutes"]'),
            seconds: container.querySelector('[data-countdown="seconds"]')
        };
        
        this.interval = null;
        this.init();
    }
    
    init() {
        this.update();
        this.interval = setInterval(() => this.update(), 1000);
    }
    
    update() {
        const now = new Date();
        const diff = this.targetDate - now;
        
        if (diff <= 0) {
            // Session has started or passed
            this.setValues(0, 0, 0, 0);
            this.container.classList.add('session-countdown--live');
            clearInterval(this.interval);
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        this.setValues(days, hours, minutes, seconds);
    }
    
    setValues(days, hours, minutes, seconds) {
        if (this.elements.days) {
            this.animateValue(this.elements.days, this.padNumber(days));
        }
        if (this.elements.hours) {
            this.animateValue(this.elements.hours, this.padNumber(hours));
        }
        if (this.elements.minutes) {
            this.animateValue(this.elements.minutes, this.padNumber(minutes));
        }
        if (this.elements.seconds) {
            this.animateValue(this.elements.seconds, this.padNumber(seconds));
        }
    }
    
    animateValue(element, newValue) {
        if (element.textContent !== newValue) {
            element.style.transform = 'scale(1.1)';
            element.textContent = newValue;
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 100);
        }
    }
    
    padNumber(num) {
        return num.toString().padStart(2, '0');
    }
    
    destroy() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}

// ============================================
// 3. QUOTE OF THE DAY
// ============================================

const RPG_QUOTES = [
    {
        text: "„Ein wahrer Held ist nicht der, der keine Angst kennt, sondern der, der trotz seiner Angst handelt."",
        author: "Gandalf der Graue",
        source: "Der Herr der Ringe"
    },
    {
        text: "„Es sind nicht unsere Fähigkeiten, die zeigen, wer wir wirklich sind, sondern unsere Entscheidungen."",
        author: "Albus Dumbledore",
        source: "Harry Potter"
    },
    {
        text: "„Die Würfel sind gefallen – aber das Schicksal wird von denen geschrieben, die sie werfen."",
        author: "Unbekannter Spielleiter",
        source: "Pen & Paper Weisheit"
    },
    {
        text: "„Jeder Dungeon beginnt mit einem einzigen Schritt durch die Tür."",
        author: "Alte Abenteurerweisheit",
        source: "D&D Folklore"
    },
    {
        text: "„Die gefährlichsten Waffen eines Abenteurers sind nicht Schwert und Zauber, sondern Neugier und Freundschaft."",
        author: "Elminster",
        source: "Forgotten Realms"
    },
    {
        text: "„Manchmal ist der mutigste Wurf, überhaupt zu würfeln."",
        author: "Erfahrener Spieler",
        source: "Session 0 Philosophie"
    },
    {
        text: "„In einer Welt voller Monster braucht es mehr als Stärke – es braucht Herz."",
        author: "Geralt von Riva",
        source: "The Witcher"
    },
    {
        text: "„Die beste Geschichte ist die, die wir gemeinsam erzählen."",
        author: "Matt Mercer",
        source: "Critical Role"
    }
];

class QuoteOfDay {
    constructor(container) {
        this.container = container;
        this.textEl = container.querySelector('#quoteText') || container.querySelector('.quote-of-day__text');
        this.authorEl = container.querySelector('#quoteAuthor') || container.querySelector('.quote-of-day__name');
        this.sourceEl = container.querySelector('#quoteSource') || container.querySelector('.quote-of-day__source');
        this.refreshBtn = container.querySelector('#quoteRefresh') || container.querySelector('.quote-of-day__btn');
        
        this.init();
    }
    
    init() {
        this.loadQuote();
        
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => this.loadRandomQuote());
        }
    }
    
    loadQuote() {
        // Get quote based on day of year (consistent per day)
        const dayOfYear = this.getDayOfYear();
        const quoteIndex = dayOfYear % RPG_QUOTES.length;
        this.displayQuote(RPG_QUOTES[quoteIndex]);
    }
    
    loadRandomQuote() {
        const randomIndex = Math.floor(Math.random() * RPG_QUOTES.length);
        this.displayQuote(RPG_QUOTES[randomIndex]);
        
        // Add animation
        if (this.textEl) {
            this.textEl.style.opacity = '0';
            this.textEl.style.transform = 'translateY(10px)';
            setTimeout(() => {
                this.textEl.style.opacity = '1';
                this.textEl.style.transform = 'translateY(0)';
            }, 150);
        }
    }
    
    displayQuote(quote) {
        if (this.textEl) this.textEl.textContent = quote.text;
        if (this.authorEl) this.authorEl.textContent = quote.author;
        if (this.sourceEl) this.sourceEl.textContent = quote.source;
    }
    
    getDayOfYear() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }
}

// ============================================
// 4. ACTIVITY FEED
// ============================================

class ActivityFeed {
    constructor(container) {
        this.container = container;
        this.list = container.querySelector('.activity-feed__list');
        this.filterBtns = container.querySelectorAll('.activity-feed__filter-btn');
        
        this.activities = [];
        this.currentFilter = 'all';
        
        this.init();
    }
    
    init() {
        // Filter buttons
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.render();
            });
        });
    }
    
    addActivity(activity) {
        // Add to beginning
        this.activities.unshift({
            ...activity,
            id: Date.now(),
            timestamp: new Date()
        });
        
        // Keep max 50 activities
        if (this.activities.length > 50) {
            this.activities = this.activities.slice(0, 50);
        }
        
        this.render();
    }
    
    render() {
        if (!this.list) return;
        
        const filtered = this.currentFilter === 'all' 
            ? this.activities 
            : this.activities.filter(a => a.type === this.currentFilter);
        
        if (filtered.length === 0) {
            this.list.innerHTML = `
                <div class="activity-feed__empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 12h8M12 8v8"/>
                    </svg>
                    <p>Noch keine Aktivitäten</p>
                </div>
            `;
            return;
        }
        
        this.list.innerHTML = filtered.map(activity => this.renderActivity(activity)).join('');
    }
    
    renderActivity(activity) {
        const typeIcons = {
            dice: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.333 2c1.96 0 3.56 1.537 3.662 3.472l.005 .195v12.666c0 1.96 -1.537 3.56 -3.472 3.662l-.195 .005h-12.666a3.667 3.667 0 0 1 -3.662 -3.472l-.005 -.195v-12.666c0 -1.96 1.537 -3.56 3.472 -3.662l.195 -.005h12.666zm-2.833 12a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0 -3zm-7 0a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0 -3zm3.5 -3.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0 -3zm-3.5 -3.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0 -3zm7 0a1.5 1.5 0 1 0 0 3a1.5 1.5 0 0 0 0 -3z"/></svg>`,
            character: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/></svg>`,
            session: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 2a1 1 0 0 1 1 1v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h1v-1a1 1 0 0 1 2 0v1h6v-1a1 1 0 0 1 1 -1z"/></svg>`,
            achievement: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26l6.91 1.01l-5 4.87l1.18 6.86l-6.18 -3.25l-6.18 3.25l1.18 -6.86l-5 -4.87l6.91 -1.01l3.09 -6.26z"/></svg>`,
            chat: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10 -10 10a9.96 9.96 0 0 1 -4.587 -1.112l-3.826 1.067a1 1 0 0 1 -1.215 -1.215l1.067 -3.826a9.96 9.96 0 0 1 -1.112 -4.587c0 -5.523 4.477 -10 10 -10z"/></svg>`
        };
        
        const timeAgo = this.getTimeAgo(activity.timestamp);
        
        return `
            <div class="activity-feed__item" data-type="${activity.type}">
                <div class="activity-feed__avatar" style="background: ${activity.color || '#4ADE80'}">
                    ${activity.avatar ? `<img src="${activity.avatar}" alt="">` : activity.initial || '?'}
                </div>
                <div class="activity-feed__content">
                    <p class="activity-feed__text">${activity.text}</p>
                    <div class="activity-feed__meta">
                        <span>${timeAgo}</span>
                        ${activity.session ? `<span class="activity-feed__meta-dot"></span><span>${activity.session}</span>` : ''}
                    </div>
                </div>
                <div class="activity-feed__type activity-feed__type--${activity.type}">
                    ${typeIcons[activity.type] || ''}
                </div>
            </div>
        `;
    }
    
    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (minutes < 1) return 'Gerade eben';
        if (minutes < 60) return `vor ${minutes} Min`;
        if (hours < 24) return `vor ${hours} Std`;
        if (days === 1) return 'Gestern';
        return `vor ${days} Tagen`;
    }
}

// ============================================
// DEMO / MOCK DATA
// ============================================

// Sample carousel slides data
const CAROUSEL_SLIDES = [
    {
        id: 1,
        badge: 'Aktive Session',
        badgeType: 'live',
        title: 'Kellerkinder Test-Session',
        description: 'Die Gruppe steht vor dem Eingang der verlassenen Mine. Was erwartet sie im Inneren?',
        image: 'assets/img/carousel/session-1.jpg',
        cta: 'Weiterspielen',
        ctaLink: 'session.html'
    },
    {
        id: 2,
        badge: 'Neu',
        badgeType: 'new',
        title: 'D&D 5e (2024) jetzt verfügbar',
        description: 'Die neueste Edition des beliebtesten Rollenspiels der Welt ist jetzt in RIFT integriert.',
        image: 'assets/img/carousel/dnd-2024.jpg',
        cta: 'Entdecken',
        ctaLink: 'rules-dnd.html'
    },
    {
        id: 3,
        badge: 'Event',
        badgeType: 'event',
        title: 'RIFT Con 2025',
        description: 'Das erste RIFT Community Event! Triff andere Spieler und erlebe exklusive One-Shots.',
        image: 'assets/img/carousel/event.jpg',
        cta: 'Mehr erfahren',
        ctaLink: 'events.html'
    }
];

// Sample activity data
const SAMPLE_ACTIVITIES = [
    {
        type: 'dice',
        text: '<strong>Max</strong> hat eine <span class="highlight--gold">Nat 20</span> gewürfelt!',
        initial: 'M',
        color: '#4ADE80',
        session: 'Kellerkinder'
    },
    {
        type: 'character',
        text: '<strong>Lisa</strong> hat <span class="highlight--purple">Elara die Weise</span> auf Level 5 gebracht',
        initial: 'L',
        color: '#8B5CF6',
        session: 'Forgotten Realms'
    },
    {
        type: 'session',
        text: '<strong>Tim</strong> hat eine neue Session für <span class="highlight">Samstag 20:00</span> geplant',
        initial: 'T',
        color: '#3B82F6'
    },
    {
        type: 'achievement',
        text: '<strong>Sarah</strong> hat das Achievement <span class="highlight--gold">„Erster Nat 1"</span> freigeschaltet',
        initial: 'S',
        color: '#EC4899'
    },
    {
        type: 'dice',
        text: '<strong>Jan</strong> hat <span class="highlight--red">3 Schaden</span> mit einem Feuerball verursacht (Nat 1...)',
        initial: 'J',
        color: '#F59E0B',
        session: 'Curse of Strahd'
    }
];

// ============================================
// INITIALIZATION
// ============================================

function initHubFeatures() {
    // Hero Carousel
    const carouselEl = document.querySelector('#heroCarousel') || document.querySelector('.hero-carousel');
    if (carouselEl) {
        window.heroCarousel = new HeroCarousel(carouselEl);
    }
    
    // Quote of the Day
    const quoteEl = document.querySelector('#quoteOfDay') || document.querySelector('.quote-of-day');
    if (quoteEl) {
        window.quoteOfDay = new QuoteOfDay(quoteEl);
    }
    
    // Session Countdown (if present)
    const countdownEl = document.querySelector('.session-countdown');
    if (countdownEl) {
        // Example: Next session in 2 days at 20:00
        const nextSession = new Date();
        nextSession.setDate(nextSession.getDate() + 2);
        nextSession.setHours(20, 0, 0, 0);
        
        window.sessionCountdown = new SessionCountdown(countdownEl, nextSession);
    }
    
    // Activity Feed (if present)
    const activityEl = document.querySelector('.activity-feed');
    if (activityEl) {
        window.activityFeed = new ActivityFeed(activityEl);
        
        // Load sample data if available
        if (typeof SAMPLE_ACTIVITIES !== 'undefined') {
            SAMPLE_ACTIVITIES.forEach((activity, index) => {
                setTimeout(() => {
                    window.activityFeed.addActivity(activity);
                }, index * 500);
            });
        }
    }
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHubFeatures);
} else {
    initHubFeatures();
}

// Export for use
window.HeroCarousel = HeroCarousel;
window.SessionCountdown = SessionCountdown;
window.QuoteOfDay = QuoteOfDay;
window.ActivityFeed = ActivityFeed;

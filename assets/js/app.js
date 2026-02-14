/**
 * RIFT v2 - App Shell
 * Sidebar, Navigation, Touch Gestures, Session Management
 */

const App = {
    sidebar: null,
    overlay: null,
    swipeHandle: null,
    isOpen: false,
    isMobile: false,
    user: null,
    roomCode: null,
    
    // Touch tracking
    touch: {
        startX: 0,
        startY: 0,
        currentX: 0,
        isDragging: false,
        threshold: 50,
        edgeZone: 30
    },
    
    init() {
        // Disable browser's automatic scroll restoration
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
        
        // Initialize Firebase first
        this.initFirebase().then(() => {
            this.sidebar = document.getElementById('sidebar');
            this.overlay = document.getElementById('sidebarOverlay');
            this.swipeHandle = document.getElementById('swipeHandle');
            
            this.checkMobile();
            this.bindEvents();
            this.setActiveLink();
            this.initTheme();
            this.initScrollToTop();
            this.initBackButton();
            this.initOfflineIndicator();
            this.initPageTransitions();
            this.updateRoomDisplay();
        });
        
        // Check on resize
        window.addEventListener('resize', () => this.checkMobile());
    },
    
    async initFirebase() {
        if (typeof RIFT !== 'undefined' && RIFT.firebase) {
            await RIFT.firebase.init();
            
            // Check auth state
            RIFT.user.initAuthListener(async (user) => {
                if (user) {
                    this.user = user;
                    window.currentUser = user;
                    console.log('[App] User authenticated:', user.displayName || user.name);
                    
                    // Initialize Pro Status
                    if (RIFT.pro) {
                        await RIFT.pro.init(user.uid);
                        window.currentUser.isPro = RIFT.pro.isPro;
                    }
                    
                    // Get current room
                    this.roomCode = RIFT.user.getCurrentRoom();
                    
                    // Load room membership to get actual isGM status
                    if (this.roomCode && RIFT.rooms) {
                        try {
                            const membership = await RIFT.rooms.getCurrentMembership(this.roomCode);
                            if (membership) {
                                // Update isGM from room data (overrides localStorage)
                                window.currentUser.isGM = membership.isGM;
                                window.currentUser.isRoomOwner = membership.isOwner;
                                window.currentUser.roomRole = membership.role;
                                
                                // Also update localStorage
                                const stored = JSON.parse(localStorage.getItem('rift_user') || '{}');
                                stored.isGM = membership.isGM;
                                localStorage.setItem('rift_user', JSON.stringify(stored));
                                
                                console.log('[App] Room membership loaded - isGM:', membership.isGM, 'role:', membership.role);
                            }
                        } catch (e) {
                            console.warn('[App] Could not load room membership:', e);
                        }
                    }
                    
                    this.updateRoomDisplay();
                    
                    // Update user display in layout
                    if (typeof updateUserDisplay === 'function') {
                        updateUserDisplay();
                    }
                } else {
                    // Not logged in – clean up Pro status
                    if (RIFT.pro) RIFT.pro.destroy();
                    
                    // Check if should redirect
                    const currentPage = window.location.pathname.split('/').pop();
                    const publicPages = ['login', '/login', 'about', '/about', 'privacy', '/privacy', 'imprint', '/imprint', 'news', 'roadmap'];
                    if (!publicPages.includes(currentPage)) {
                        console.log('[App] Not authenticated, redirecting to login');
                        window.location.href = '/login';
                    }
                }
            });
            
            // Also check localStorage for room
            this.roomCode = RIFT.user.getCurrentRoom();
        } else {
            // Fallback to localStorage check
            this.checkSession();
        }
    },
    
    updateRoomDisplay() {
        // Update room code display in header/sidebar if present
        const roomDisplay = document.getElementById('currentRoomCode');
        if (roomDisplay && this.roomCode) {
            roomDisplay.textContent = RIFT.rooms?.formatRoomCode(this.roomCode) || this.roomCode;
        }
    },
    
    // ========================================
    // THEME SYSTEM
    // ========================================
    
    initTheme() {
        // Check stored preference or system preference
        const stored = localStorage.getItem('rift_theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Set initial theme
        const theme = stored || (prefersDark ? 'dark' : 'dark'); // Default to dark
        this.setTheme(theme, false);
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('rift_theme')) {
                this.setTheme(e.matches ? 'dark' : 'light', true);
            }
        });
    },
    
    setTheme(theme, animate = true) {
        if (animate) {
            document.documentElement.classList.add('theme-transitioning');
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transitioning');
            }, 300);
        }
        
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('rift_theme', theme);
        // Bridge to RiftState
        if (window.RIFT?.state) RIFT.state.set('theme', theme);
        
        // Update any theme toggle buttons
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.setAttribute('aria-label', theme === 'dark' ? 'Zum Light Mode wechseln' : 'Zum Dark Mode wechseln');
        });
    },
    
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme, true);
        
        if (typeof showToast === 'function') {
            showToast(newTheme === 'dark' ? 'Dark Mode aktiviert' : 'Light Mode aktiviert', 'info', 1500);
        }
    },
    
    // ========================================
    // PAGE TRANSITIONS
    // ========================================
    
    initPageTransitions() {
        // Page transitions are now handled by transitions.js
        // This function is kept for backwards compatibility
        // and only runs entrance animations on first load
        // if transitions.js hasn't already done it
        
        if (window.PageTransitions) {
            // transitions.js is handling it
            return;
        }
        
        // Fallback entrance animations if transitions.js not loaded
        this.runEntranceAnimations();
    },
    
    initFallbackTransitions() {
        // Deprecated - transitions.js handles this now
    },
    
    runEntranceAnimations() {
        // Hero entrance
        const hero = document.querySelector('.hero');
        if (hero) {
            hero.classList.add('animate-hero');
        }
        
        // News cards stagger
        document.querySelectorAll('.hero-news-grid .hero--secondary').forEach((card, index) => {
            card.style.animationDelay = `${0.15 + (index * 0.1)}s`;
            card.classList.add('animate-fade-up');
        });
        
        // Widgets stagger
        document.querySelectorAll('.widgets .widget').forEach((widget, index) => {
            widget.style.animationDelay = `${0.25 + (index * 0.08)}s`;
            widget.classList.add('animate-fade-up');
        });
        
        // Announcement section
        const announcement = document.querySelector('.announcement');
        if (announcement) {
            announcement.style.animationDelay = '0.4s';
            announcement.classList.add('animate-fade-up');
        }
    },
    
    initOfflineIndicator() {
        // Create offline indicator
        const indicator = document.createElement('div');
        indicator.className = 'offline-indicator';
        indicator.textContent = 'Keine Internetverbindung';
        document.body.appendChild(indicator);
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            indicator.classList.remove('visible');
            if (typeof showToast === 'function') {
                showToast('Wieder online', 'success');
            }
        });
        
        window.addEventListener('offline', () => {
            indicator.classList.add('visible');
        });
        
        // Check initial state
        if (!navigator.onLine) {
            indicator.classList.add('visible');
        }
    },
    
    initScrollToTop() {
        // Create scroll-to-top button
        const btn = document.createElement('button');
        btn.className = 'scroll-to-top';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
        btn.setAttribute('aria-label', 'Nach oben scrollen');
        document.body.appendChild(btn);
        
        // Show/hide based on scroll position
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        });
        
        // Scroll to top on click
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    },
    
    initBackButton() {
        // Add back button to article pages
        const articleHeader = document.querySelector('.article__header');
        if (articleHeader && document.referrer.includes(window.location.host)) {
            const backBtn = document.createElement('button');
            backBtn.className = 'back-button';
            backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Zurück';
            backBtn.addEventListener('click', () => history.back());
            articleHeader.insertBefore(backBtn, articleHeader.firstChild);
        }
    },
    
    checkMobile() {
        this.isMobile = window.innerWidth <= 768;
        
        if (!this.isMobile && this.isOpen) {
            this.close();
        }
    },
    
    bindEvents() {
        // Overlay click
        this.overlay?.addEventListener('click', () => this.close());
        
        // Escape key - close sidebar AND any open modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close sidebar if open
                if (this.isOpen) {
                    this.close();
                }
                // Close any open modals
                const openModal = document.querySelector('.modal-overlay[style*="flex"], .modal-overlay.active');
                if (openModal) {
                    openModal.style.display = 'none';
                    openModal.classList.remove('active');
                }
                // Close dropdowns
                document.querySelectorAll('.md-color-dropdown.active, .md-size-dropdown.active').forEach(el => {
                    el.classList.remove('active');
                });
            }
        });
        
        // Touch events for swipe
        document.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
        document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });
        
        // Swipe handle click
        this.swipeHandle?.addEventListener('click', () => this.open());
    },
    
    open() {
        if (!this.isMobile) return;
        
        this.isOpen = true;
        this.sidebar?.classList.add('open');
        this.overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    },
    
    close() {
        this.isOpen = false;
        this.sidebar?.classList.remove('open');
        this.overlay?.classList.remove('active');
        document.body.style.overflow = '';
        
        // Reset any transform from dragging
        if (this.sidebar) {
            this.sidebar.style.transform = '';
        }
    },
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    },
    
    // Touch handling
    onTouchStart(e) {
        if (!this.isMobile) return;
        
        const touch = e.touches[0];
        this.touch.startX = touch.clientX;
        this.touch.startY = touch.clientY;
        this.touch.currentX = touch.clientX;
        
        // Allow drag if sidebar is open or touch started at edge
        const atEdge = touch.clientX < this.touch.edgeZone;
        this.touch.isDragging = this.isOpen || atEdge;
    },
    
    onTouchMove(e) {
        if (!this.isMobile || !this.touch.isDragging) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touch.startX;
        const deltaY = touch.clientY - this.touch.startY;
        
        // If scrolling vertically more than horizontally, cancel drag
        if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && Math.abs(deltaY) > 10) {
            this.touch.isDragging = false;
            return;
        }
        
        this.touch.currentX = touch.clientX;
        
        // Calculate sidebar position
        const sidebarWidth = this.sidebar?.offsetWidth || 280;
        let translateX;
        
        if (this.isOpen) {
            // Dragging to close (from open state)
            translateX = Math.min(0, deltaX);
        } else {
            // Dragging to open (from closed state)
            translateX = Math.min(0, -sidebarWidth + deltaX);
        }
        
        // Apply transform with slight resistance at edges
        if (this.sidebar) {
            this.sidebar.style.transform = `translateX(${translateX}px)`;
            this.sidebar.style.transition = 'none';
        }
        
        // Prevent scroll while dragging sideways
        if (Math.abs(deltaX) > 10) {
            e.preventDefault();
        }
    },
    
    onTouchEnd(e) {
        if (!this.isMobile || !this.touch.isDragging) return;
        
        const deltaX = this.touch.currentX - this.touch.startX;
        
        // Reset transition
        if (this.sidebar) {
            this.sidebar.style.transition = '';
        }
        
        // Determine if we should open or close
        if (this.isOpen) {
            // Was open, check if should close
            if (deltaX < -this.touch.threshold) {
                this.close();
            } else {
                // Snap back open
                this.sidebar?.classList.add('open');
                if (this.sidebar) this.sidebar.style.transform = '';
            }
        } else {
            // Was closed, check if should open
            if (deltaX > this.touch.threshold) {
                this.open();
            } else {
                // Snap back closed
                if (this.sidebar) this.sidebar.style.transform = '';
            }
        }
        
        this.touch.isDragging = false;
    },
    
    // Set active nav link based on current page
    setActiveLink() {
        const pathname = window.location.pathname;
        const currentPage = pathname.split('/').pop().replace('.html', '') || 
                           (pathname === '/' ? 'hub' : pathname.slice(1));
        const links = document.querySelectorAll('.sidebar__link');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            // Check if href matches current page (handle both clean URLs and old .html)
            if (href === pathname || 
                href === `/${currentPage}` || 
                href === currentPage ||
                (pathname === '/' && href === '/hub') ||
                (currentPage === 'index' && href === '/hub')) {
                link.classList.add('active');
            }
        });
    },
    
    // Session Management
    checkSession() {
        const userData = localStorage.getItem('rift_user');
        const roomCode = localStorage.getItem('rift_current_room');
        
        if (userData && roomCode) {
            this.user = JSON.parse(userData);
            this.roomCode = roomCode;
            return true;
        }
        
        // Not logged in - redirect to login (only if not already on login page)
        const currentPage = window.location.pathname.split('/').pop();
        const publicPages = ['login', '/login', 'about', '/about', 'privacy', '/privacy', 'imprint', '/imprint', 'news', 'roadmap'];
        if (!publicPages.includes(currentPage)) {
            window.location.href = '/login';
            return false;
        }
        
        return false;
    },
    
    getUser() {
        return this.user;
    },
    
    getRoomCode() {
        return this.roomCode;
    },
    
    logout() {
        // Sign out from Firebase
        if (RIFT?.firebase?.signOut) {
            RIFT.firebase.signOut();
        }
        
        // Clear localStorage
        if (RIFT?.user?.clearSession) {
            RIFT.user.clearSession();
        } else {
            localStorage.removeItem('rift_user');
            localStorage.removeItem('rift_current_room');
        }
        
        this.user = null;
        this.roomCode = null;
        window.location.href = '/login';
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export for use in other scripts
window.App = App;

// Load Toast Service globally (for dice roll notifications etc.)
(function loadToastService() {
    if (window.RIFTToast || document.querySelector('script[src*="toast-service.js"]')) return;
    const script = document.createElement('script');
    script.src = '/assets/js/toast-service.js';
    document.head.appendChild(script);
})();

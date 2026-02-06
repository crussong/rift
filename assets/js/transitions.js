/**
 * RIFT v2 - Page Transitions
 * Smooth page transitions without full page reloads
 * Handles CSS loading, layout preservation, and script execution
 */

const PageTransitions = {
    
    // Configuration
    config: {
        contentSelector: '.main',
        animationDuration: 350,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        // Pages that need full reload due to complex script initialization
        fullReloadPages: ['dice.html', 'sessions.html', 'sheet.html', 'gm.html', 'session.html', 'index.html', 'roadmap.html', 'broadcast.html', 'chat.html', 'whiteboard.html', 'worldsapart.html', 'dnd5e.html', 'htbah.html', 'cyberpunkred.html', 'pathfinder.html', 'shadowrun.html', 'cthulhu.html', 'sheet-worldsapart.html', 'sheet-5e.html', 'sheet-htbah.html', 'sheet-cyberpunkred.html', 'notes.html', 'map.html', 'user-settings.html']
    },
    
    // State
    isTransitioning: false,
    loadingBar: null,
    loadedCSS: new Set(),
    
    /**
     * Initialize the transition system
     */
    init() {
        // Don't init on login page
        if (window.location.pathname.includes('login.html') || window.location.pathname === '/login') return;
        
        // Track currently loaded CSS
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            this.loadedCSS.add(link.href);
        });
        
        this.createLoadingBar();
        this.bindEvents();
        this.runEntranceAnimation();
        
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state?.url) {
                this.navigateTo(e.state.url, false);
            }
        });
        
        // Set initial state
        history.replaceState({ url: window.location.href }, '', window.location.href);
    },
    
    /**
     * Create loading bar element
     */
    createLoadingBar() {
        this.loadingBar = document.createElement('div');
        this.loadingBar.className = 'page-loading-bar';
        this.loadingBar.innerHTML = '<div class="page-loading-bar__progress"></div>';
        document.body.appendChild(this.loadingBar);
        
        const style = document.createElement('style');
        style.textContent = `
            .page-loading-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .page-loading-bar.active {
                opacity: 1;
            }
            .page-loading-bar__progress {
                height: 100%;
                width: 0%;
                background: var(--accent, #FF4655);
                box-shadow: 0 0 10px var(--accent, #FF4655);
                transition: width 0.3s ease-out;
            }
            .page-loading-bar.active .page-loading-bar__progress {
                animation: loadingProgress 1.5s ease-out forwards;
            }
            @keyframes loadingProgress {
                0% { width: 0%; }
                50% { width: 70%; }
                100% { width: 90%; }
            }
        `;
        document.head.appendChild(style);
    },
    
    showLoading() {
        this.loadingBar?.classList.add('active');
    },
    
    hideLoading() {
        if (this.loadingBar) {
            const progress = this.loadingBar.querySelector('.page-loading-bar__progress');
            if (progress) {
                progress.style.width = '100%';
                progress.style.transition = 'width 0.2s ease-out';
            }
            setTimeout(() => {
                this.loadingBar.classList.remove('active');
                if (progress) {
                    progress.style.width = '0%';
                    progress.style.transition = '';
                }
            }, 200);
        }
    },
    
    /**
     * Bind click events to all internal links
     */
    bindEvents() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            
            // Skip external links and special cases
            if (!href || 
                href.startsWith('http') || 
                href.startsWith('#') || 
                href.startsWith('mailto:') || 
                href.startsWith('tel:') ||
                href.startsWith('javascript:') ||
                link.target === '_blank' ||
                link.hasAttribute('download') ||
                link.hasAttribute('data-no-transition')) {
                return;
            }
            
            e.preventDefault();
            this.navigateTo(href);
        });
    },
    
    /**
     * Load CSS files that aren't already loaded
     */
    async loadNewCSS(newDoc) {
        const cssPromises = [];
        const newLinks = newDoc.querySelectorAll('link[rel="stylesheet"]');
        
        for (const link of newLinks) {
            const href = link.href;
            if (!this.loadedCSS.has(href)) {
                const newLink = document.createElement('link');
                newLink.rel = 'stylesheet';
                newLink.href = href;
                
                const loadPromise = new Promise(resolve => {
                    newLink.onload = () => {
                        this.loadedCSS.add(href);
                        resolve();
                    };
                    newLink.onerror = resolve;
                });
                
                cssPromises.push(loadPromise);
                document.head.appendChild(newLink);
            }
        }
        
        if (cssPromises.length > 0) {
            await Promise.all(cssPromises);
        }
    },
    
    /**
     * Execute inline scripts from the new page
     */
    executePageScripts(newDoc) {
        const scripts = newDoc.querySelectorAll('script:not([src])');
        
        for (const script of scripts) {
            let code = script.textContent;
            if (!code.trim()) continue;
            
            // Remove initLayout() calls - we handle layout separately
            code = code.replace(/^\s*initLayout\(\);?\s*$/gm, '');
            code = code.replace(/initLayout\(\);?\s*/g, '');
            
            if (!code.trim()) continue;
            
            try {
                // Create and execute the script
                const newScript = document.createElement('script');
                newScript.textContent = code;
                document.body.appendChild(newScript);
                // Don't remove - some scripts set up ongoing listeners
            } catch (err) {
                console.warn('[Transitions] Script error:', err);
            }
        }
    },
    
    /**
     * Navigate to a new page with transition
     */
    async navigateTo(url, pushState = true) {
        if (this.isTransitioning) return;
        
        // Check if target page needs full reload
        const targetPage = url.split('/').pop().split('?')[0];
        if (this.config.fullReloadPages.some(page => targetPage === page || targetPage.startsWith(page.replace('.html', '')))) {
            window.location.href = url;
            return;
        }
        
        this.isTransitioning = true;
        
        const main = document.querySelector(this.config.contentSelector);
        if (!main) {
            window.location.href = url;
            return;
        }
        
        this.showLoading();
        
        try {
            // Start exit animation and fetch in parallel
            const [, response] = await Promise.all([
                this.animateOut(main),
                fetch(url)
            ]);
            
            if (!response.ok) throw new Error('Page not found');
            
            const html = await response.text();
            
            // Parse new content
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(html, 'text/html');
            const newMain = newDoc.querySelector(this.config.contentSelector);
            const newTitle = newDoc.querySelector('title')?.textContent;
            
            if (!newMain) throw new Error('Content not found');
            
            // Update URL
            if (pushState) {
                history.pushState({ url }, '', url);
            }
            
            // Update title
            if (newTitle) {
                document.title = newTitle;
            }
            
            // Load any new CSS files and wait for them
            await this.loadNewCSS(newDoc);
            
            // Replace main content
            main.innerHTML = newMain.innerHTML;
            main.className = newMain.className;
            
            // Re-initialize layout components
            if (typeof initUnifiedLayout === 'function') {
                initUnifiedLayout();
            } else if (typeof initLayout === 'function') {
                initLayout();
            }
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'instant' });
            
            // Wait for DOM to be ready, then execute page scripts
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            this.executePageScripts(newDoc);
            
            // Re-initialize common components
            this.reinitialize();
            
            // Entrance animation
            await this.animateIn(main);
            
            this.hideLoading();
            
        } catch (error) {
            console.error('[Transitions] Error:', error);
            this.hideLoading();
            // Fallback to normal navigation
            window.location.href = url;
        }
        
        this.isTransitioning = false;
    },
    
    /**
     * Exit animation
     */
    animateOut(element) {
        return new Promise(resolve => {
            const duration = this.config.animationDuration * 0.5;
            element.style.transition = `opacity ${duration}ms ${this.config.easing}, transform ${duration}ms ${this.config.easing}`;
            element.style.opacity = '0';
            element.style.transform = 'translateX(-20px)';
            
            setTimeout(resolve, duration);
        });
    },
    
    /**
     * Entrance animation
     */
    animateIn(element) {
        return new Promise(resolve => {
            element.style.transition = 'none';
            element.style.opacity = '0';
            element.style.transform = 'translateX(20px)';
            
            element.offsetHeight; // Force reflow
            
            element.style.transition = `opacity ${this.config.animationDuration}ms ${this.config.easing}, transform ${this.config.animationDuration}ms ${this.config.easing}`;
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
            
            setTimeout(() => {
                element.style.transition = '';
                element.style.opacity = '';
                element.style.transform = '';
                resolve();
            }, this.config.animationDuration);
        });
    },
    
    /**
     * Run entrance animation on page load
     */
    runEntranceAnimation() {
        const main = document.querySelector(this.config.contentSelector);
        if (!main) return;
        
        main.style.opacity = '0';
        main.style.transform = 'translateY(15px)';
        
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                main.style.transition = `opacity ${this.config.animationDuration}ms ${this.config.easing}, transform ${this.config.animationDuration}ms ${this.config.easing}`;
                main.style.opacity = '1';
                main.style.transform = 'translateY(0)';
                
                setTimeout(() => {
                    main.style.transition = '';
                    main.style.opacity = '';
                    main.style.transform = '';
                }, this.config.animationDuration);
            });
        });
    },
    
    /**
     * Re-initialize components after content swap
     */
    reinitialize() {
        // Re-init news manager
        if (typeof AnnouncementManager !== 'undefined' && document.querySelector('.announcement')) {
            window.announcementManager = new AnnouncementManager();
        }
        
        // Re-init article manager if on article page
        if (typeof ArticleManager !== 'undefined' && document.querySelector('.article')) {
            const slot = window.location.pathname.includes('news1') ? 'news_1' : 'news_2';
            window.articleManager = new ArticleManager(slot);
        }
        
        // Update active sidebar link
        if (typeof App !== 'undefined' && App.setActiveLink) {
            App.setActiveLink();
        }
        
        // Re-init back button
        if (typeof App !== 'undefined' && App.initBackButton) {
            App.initBackButton();
        }
        
        // Random background for hub
        if (document.querySelector('.main--hub')) {
            const bgNum = String(Math.floor(Math.random() * 12) + 1).padStart(3, '0');
            const existing = document.querySelector('style[data-hub-bg]');
            if (existing) existing.remove();
            const style = document.createElement('style');
            style.setAttribute('data-hub-bg', '');
            style.textContent = `.main--hub::before { background-image: url('assets/bg/bg_${bgNum}.jpg'); }`;
            document.head.appendChild(style);
        }
        
        // Dispatch custom event for other scripts
        document.dispatchEvent(new CustomEvent('pageTransitioned'));
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    PageTransitions.init();
});

// Export
if (typeof window !== 'undefined') {
    window.PageTransitions = PageTransitions;
}

/**
 * SPA Router - Loads module content dynamically
 * Keeps overlays (atmosphere, pause) persistent across navigation
 */

(function() {
    'use strict';

    // Modules that should be loaded via SPA
    const SPA_MODULES = [
        'charakterbogen.html',
        'wuerfel.html',
        'chat.html',
        'karte.html',
        'whiteboard.html',
        'notizen.html',
        'gm-options.html',
        'index.html'
    ];

    // Current loaded module
    let currentModule = null;
    let moduleScripts = [];
    let moduleStyles = [];

    /**
     * Initialize SPA Router
     */
    function initSPARouter() {
        // SPA doesn't work with file:// protocol (security restriction)
        if (window.location.protocol === 'file:') {
            console.log('[SPA Router] Disabled on file:// protocol');
            return;
        }
        
        // Only init if we're in a game session (have room code)
        const roomCode = localStorage.getItem('pnp_companion_room');
        if (!roomCode) {
            console.log('[SPA Router] No room code, SPA disabled');
            return;
        }

        // Intercept all navigation clicks
        document.addEventListener('click', handleLinkClick, true);

        // Handle browser back/forward
        window.addEventListener('popstate', handlePopState);

        // Mark current page
        currentModule = getCurrentModuleName();

        console.log('[SPA Router] Initialized, current module:', currentModule);
    }

    /**
     * Get current module name from URL
     */
    function getCurrentModuleName() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename;
    }

    /**
     * Check if URL is a SPA module
     */
    function isSPAModule(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            const filename = urlObj.pathname.split('/').pop();
            return SPA_MODULES.includes(filename);
        } catch {
            return false;
        }
    }

    /**
     * Handle link clicks
     */
    function handleLinkClick(e) {
        // Find closest anchor tag
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Skip external links, hash links, special protocols
        if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }

        // Skip non-SPA modules
        if (!isSPAModule(href)) {
            return;
        }

        // Prevent default navigation
        e.preventDefault();
        e.stopPropagation();

        // Navigate via SPA
        navigateTo(href);
    }

    /**
     * Handle browser back/forward
     */
    function handlePopState(e) {
        const state = e.state;
        if (state && state.module) {
            loadModule(state.module, false);
        }
    }

    /**
     * Navigate to a module
     */
    function navigateTo(url) {
        const filename = url.split('/').pop().split('?')[0];
        
        // Don't reload same module
        if (filename === currentModule) {
            closeSidebar();
            return;
        }

        // Push to history
        history.pushState({ module: filename }, '', filename);

        // Load the module
        loadModule(filename, true);
    }

    /**
     * Load a module's content
     */
    async function loadModule(filename, isNewNavigation) {
        const contentContainer = document.getElementById('spaContent');
        if (!contentContainer) {
            // Fallback to normal navigation if no SPA container
            window.location.href = filename;
            return;
        }

        // Show loading state
        contentContainer.classList.add('spa-loading');

        try {
            // Fetch the module page
            const response = await fetch(filename);
            if (!response.ok) throw new Error('Failed to load module');

            const html = await response.text();

            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Clean up previous module
            cleanupCurrentModule();

            // Extract and apply styles
            const styles = doc.querySelectorAll('style');
            styles.forEach(style => {
                const newStyle = document.createElement('style');
                newStyle.textContent = style.textContent;
                newStyle.setAttribute('data-spa-module', filename);
                document.head.appendChild(newStyle);
                moduleStyles.push(newStyle);
            });

            // Extract main content - prefer #spaContent, fallback to other selectors
            let content = doc.querySelector('#spaContent');
            
            if (!content) {
                // Fallback for pages that don't have spaContent yet
                content = doc.querySelector('main') || 
                         doc.querySelector('.container') || 
                         doc.querySelector('#gmContainer') ||
                         doc.querySelector('.gm-container') ||
                         doc.querySelector('.layout') ||
                         doc.body;
            }

            // Clone content to avoid modifying original
            content = content.cloneNode(true);

            // Remove nav-placeholder and footer if present
            const navPlaceholder = content.querySelector('#nav-placeholder');
            if (navPlaceholder) navPlaceholder.remove();

            // Get the content HTML
            let contentHTML = content.innerHTML;

            // Update content container
            contentContainer.innerHTML = contentHTML;

            // Skip already loaded external scripts
            const loadedScripts = new Set([
                'firebase-app-compat.js',
                'firebase-database-compat.js',
                'lang.js',
                'i18n.js',
                'quotes.js',
                'auth.js',
                'firebase-sync.js',
                'spa-router.js',
                'nav.js'
            ]);
            
            // Don't load external scripts that are already global
            const extScripts = doc.querySelectorAll('script[src]');
            extScripts.forEach(script => {
                const src = script.getAttribute('src');
                const filename = src.split('/').pop();
                if (!loadedScripts.has(filename)) {
                    // Load this external script
                    const newScript = document.createElement('script');
                    newScript.src = src;
                    newScript.setAttribute('data-spa-module', filename);
                    document.body.appendChild(newScript);
                    moduleScripts.push(newScript);
                }
            });

            // Extract and execute inline scripts
            const scripts = doc.querySelectorAll('script:not([src])');
            scripts.forEach(script => {
                // Skip Firebase config scripts (already loaded globally)
                const content = script.textContent;
                if (content.includes('firebaseConfig') || 
                    content.includes('firebase.initializeApp') ||
                    content.includes('apiKey')) {
                    return;
                }
                
                // Skip DOMContentLoaded wrappers - extract inner code
                let scriptContent = content;
                
                // Check if it's a DOMContentLoaded wrapper
                const domLoadedMatch = content.match(/document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:function\s*\(\s*\)\s*\{|(?:\(\s*\)\s*=>\s*\{))([\s\S]*?)(?:\}\s*\)\s*;?\s*$)/);
                if (domLoadedMatch) {
                    // Execute the inner content directly since DOM is already loaded
                    scriptContent = domLoadedMatch[1];
                }

                try {
                    const newScript = document.createElement('script');
                    newScript.textContent = scriptContent;
                    newScript.setAttribute('data-spa-module', filename);
                    document.body.appendChild(newScript);
                    moduleScripts.push(newScript);
                } catch (err) {
                    console.error('[SPA Router] Script error:', err);
                }
            });

            // Update page title
            const title = doc.querySelector('title');
            if (title) {
                document.title = title.textContent;
            }

            // Update current module
            currentModule = filename;

            // Update active state in sidebar
            updateSidebarActive(filename);

            // Update module name in top bar
            updateTopBarModuleName(filename);

            // Trigger i18n update
            if (typeof applyTranslations === 'function') {
                applyTranslations();
            }

            // Close sidebar on mobile
            if (typeof closeSidebar === 'function') {
                closeSidebar();
            }

            // Scroll to top
            window.scrollTo(0, 0);

            console.log('[SPA Router] Loaded module:', filename);

        } catch (error) {
            console.error('[SPA Router] Error loading module:', error);
            // Fallback to normal navigation
            window.location.href = filename;
        } finally {
            contentContainer.classList.remove('spa-loading');
        }
    }

    /**
     * Cleanup current module's scripts and styles
     */
    function cleanupCurrentModule() {
        // Remove module-specific scripts
        moduleScripts.forEach(script => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        });
        moduleScripts = [];

        // Remove module-specific styles
        moduleStyles.forEach(style => {
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        });
        moduleStyles = [];

        // Clear any module-specific intervals/timeouts
        // (Modules should register these for cleanup)
        if (window.spaCleanupCallbacks) {
            window.spaCleanupCallbacks.forEach(cb => {
                try { cb(); } catch(e) {}
            });
            window.spaCleanupCallbacks = [];
        }
    }

    /**
     * Update sidebar active state
     */
    function updateSidebarActive(filename) {
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href === filename) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /**
     * Update top bar module name
     */
    function updateTopBarModuleName(filename) {
        const moduleNameEl = document.querySelector('.module-name');
        if (!moduleNameEl) return;

        const moduleNames = {
            'index.html': 'Hub',
            'charakterbogen.html': 'Charakter',
            'wuerfel.html': 'Würfel',
            'chat.html': 'Chat',
            'karte.html': 'Karte',
            'whiteboard.html': 'Whiteboard',
            'notizen.html': 'Notizen',
            'gm-options.html': 'GM Optionen'
        };

        const name = moduleNames[filename] || 'RIFT';
        moduleNameEl.textContent = name;

        // Also update with i18n if available
        const i18nKeys = {
            'index.html': 'module.hub',
            'charakterbogen.html': 'module.character',
            'wuerfel.html': 'module.dice',
            'chat.html': 'module.chat',
            'karte.html': 'module.map',
            'whiteboard.html': 'module.whiteboard',
            'notizen.html': 'module.notes',
            'gm-options.html': 'module.gm_options'
        };

        if (typeof t === 'function' && i18nKeys[filename]) {
            const translated = t(i18nKeys[filename]);
            if (translated && !translated.includes('.')) {
                moduleNameEl.textContent = translated;
            }
        }
    }

    /**
     * Register cleanup callback for current module
     */
    window.registerSPACleanup = function(callback) {
        if (!window.spaCleanupCallbacks) {
            window.spaCleanupCallbacks = [];
        }
        window.spaCleanupCallbacks.push(callback);
    };

    /**
     * Programmatic navigation
     */
    window.spaNavigate = function(url) {
        if (isSPAModule(url)) {
            navigateTo(url);
        } else {
            window.location.href = url;
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSPARouter);
    } else {
        initSPARouter();
    }

})();

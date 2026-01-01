/**
 * PNP COMPANION - Navigation Component
 * Version: 3.0
 * 
 * Creates a consistent navigation bar across all modules.
 * Includes slide-in sidebar for mobile navigation.
 */

// ===== SERVICE WORKER REGISTRATION =====
// Nur auf Production (HTTPS), nicht lokal
if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('[SW] Registered'))
        .catch((err) => console.log('[SW] Registration failed:', err));
}

// ===== CONFIGURATION =====
const NAV_CONFIG = {
    HEIGHT_DESKTOP: 60,
    HEIGHT_MOBILE: 56,
    BREAKPOINT_MOBILE: 768,
    BREAKPOINT_SMALL: 480,
    SIDEBAR_WIDTH: 280,
    SWIPE_THRESHOLD: 50
};

// Module definitions for sidebar
const MODULES = [
    { id: 'charakterbogen', title: 'Charakter-Bogen', icon: 'icon_character.png', href: 'charakterbogen.html' },
    { id: 'wuerfel', title: 'Würfel', icon: 'icon_dice.png', href: 'wuerfel.html' },
    { id: 'karte', title: 'Karte', icon: 'icon_map.png', href: 'karte.html' },
    { id: 'notizen', title: 'Notizen', icon: 'icon_notes.png', href: 'notizen.html' },
    { id: 'whiteboard', title: 'Whiteboard', icon: 'icon_whiteboard.png', href: 'whiteboard.html' },
    { id: 'chat', title: 'Chat', icon: 'icon_chat.png', href: 'chat.html' }
];

let sidebarOpen = false;
let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;


// ===== PAGE TRANSITIONS =====

/**
 * Handle page transition on link click
 */
function initPageTransitions() {
    // Prefetch cache to avoid duplicate prefetches
    const prefetched = new Set();
    
    // Prefetch on hover - loads page before click
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (!href || 
            href.startsWith('http') || 
            href.startsWith('#') || 
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') ||
            prefetched.has(href)) {
            return;
        }
        
        // Create prefetch link
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = href;
        document.head.appendChild(prefetchLink);
        prefetched.add(href);
    });
    
    // Add transition to internal links
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Skip external links, anchors, and javascript: links
        if (!href || 
            href.startsWith('http') || 
            href.startsWith('#') || 
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') ||
            link.target === '_blank') {
            return;
        }
        
        // Skip if modifier key pressed
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        
        e.preventDefault();
        
        // Add transition out class
        document.body.classList.add('page-transition-out');
        
        // Navigate after animation (schneller: 100ms)
        setTimeout(() => {
            window.location.href = href;
        }, 100);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initPageTransitions);


// ===== MAIN FUNCTION =====

/**
 * Initialize navigation bar with sidebar
 * @param {string} moduleName - Name of current module to display
 * @param {string} moduleToolsHTML - HTML string for module-specific tool buttons
 */
function initNavigation(moduleName = '', moduleToolsHTML = '') {
    // Get user data safely
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const username = user?.username || 'Gast';
    const userColor = user?.color || '#6750a4';

    // Detect current module from URL
    const currentPage = window.location.pathname.split('/').pop() || '/';

    // Create navbar element
    const navbar = document.createElement('nav');
    navbar.id = 'pnp-navbar';
    navbar.setAttribute('role', 'navigation');
    navbar.setAttribute('aria-label', 'Hauptnavigation');
    
    navbar.innerHTML = `
        <div class="navbar-container">
            <div class="navbar-left">
                <button class="nav-btn hamburger-btn" onclick="toggleSidebar()" title="Menü" aria-label="Menü öffnen">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <h1 class="module-name">${escapeHtml(moduleName)}</h1>
            </div>
            
            <a href="index.html" class="navbar-logo" title="RIFT Home">
                <img src="assets/images/logo_rift_white_400px.png" alt="RIFT" class="logo-white">
                <img src="assets/images/logo_rift_black_400px.png" alt="RIFT" class="logo-black">
            </a>
            
            <div class="navbar-right">
                <div class="module-tools" id="moduleTools">${moduleToolsHTML}</div>
                
                <div class="user-indicator" title="${escapeHtml(username)}">
                    <span class="user-dot" style="background-color: ${userColor}; box-shadow: 0 0 8px ${userColor};"></span>
                    <span class="user-name">${escapeHtml(username)}</span>
                </div>
                
                <button class="nav-btn logout-btn-nav" onclick="handleLogout()" title="Ausloggen" aria-label="Ausloggen">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Create sidebar
    const sidebar = document.createElement('aside');
    sidebar.id = 'pnp-sidebar';
    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', 'Seitennavigation');
    
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <img src="assets/images/logo_rift_white_400px.png" alt="RIFT" class="sidebar-logo logo-white">
            <img src="assets/images/logo_rift_black_400px.png" alt="RIFT" class="sidebar-logo logo-black">
            <button class="sidebar-close" onclick="closeSidebar()" aria-label="Menü schließen">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        
        <!-- Online Players Section -->
        <div class="sidebar-players-section">
            <div class="sidebar-section-title">Im Raum</div>
            <div class="sidebar-players-list" id="sidebarPlayersList">
                <div class="sidebar-players-loading">Lade...</div>
            </div>
        </div>
        
        <nav class="sidebar-nav">
            <div class="sidebar-section-title">Module</div>
            ${MODULES.map(m => `
                <a href="${m.href}" class="sidebar-link${currentPage === m.href ? ' active' : ''}">
                    <img src="assets/icons/${m.icon}" alt="">
                    <span>${m.title}</span>
                </a>
            `).join('')}
        </nav>
        
        <div class="sidebar-footer">
            <a href="index.html" class="sidebar-link">
                <img src="assets/icons/icon_home.png" alt="">
                <span>Zurück zum Hub</span>
            </a>
            <a href="gm-options.html" class="sidebar-link sidebar-gm-options" id="sidebarGmOptions">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                </svg>
                <span>GM Optionen</span>
            </a>
            <button class="sidebar-link sidebar-sound-toggle" id="sidebarSoundToggle" onclick="toggleSoundSetting()">
                <svg id="soundIconOn" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
                <svg id="soundIconOff" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
                <span id="soundToggleText">Sound an</span>
            </button>
            <button class="sidebar-link sidebar-logout" onclick="handleLogout()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Ausloggen</span>
            </button>
            <div class="sidebar-legal">
                <a href="impressum.html">Impressum</a>
                <span>·</span>
                <a href="privacy.html">Datenschutz</a>
            </div>
        </div>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'pnp-sidebar-overlay';
    overlay.onclick = closeSidebar;

    // Insert elements
    document.body.insertBefore(navbar, document.body.firstChild);
    document.body.insertBefore(sidebar, document.body.firstChild);
    document.body.insertBefore(overlay, document.body.firstChild);

    // Inject styles
    injectNavStyles();
    
    // Show GM Options link only for GMs
    try {
        const userData = JSON.parse(localStorage.getItem('pnp_companion_user') || '{}');
        const gmLink = document.getElementById('sidebarGmOptions');
        const isGM = userData && (userData.isGM === true || userData.isGM === 'true');
        console.log('[Nav] GM Check:', { username: userData?.username, isGM: userData?.isGM, result: isGM });
        if (gmLink && isGM) {
            gmLink.classList.add('visible');
            console.log('[Nav] GM Options enabled for:', userData.username);
        }
    } catch (e) {
        console.log('[Nav] Could not check GM status:', e);
    }
    
    // Initialize sound toggle state
    initSoundToggle();
    
    // Add body padding
    document.body.style.paddingTop = `${NAV_CONFIG.HEIGHT_DESKTOP}px`;
    
    // Setup touch events for swipe
    setupTouchEvents();
    
    // Add Fly Buttons based on current page
    addFlyButtons(currentPage);
    
    console.log(`[Nav] Navigation initialized for: ${moduleName}`);
}

/**
 * Add Floating Action Buttons based on current module
 * Rules:
 * - Hub/Index: No buttons
 * - Würfel: Chat + Charakterbogen
 * - Charakterbogen: Chat + Würfel
 * - Chat: Charakterbogen + Würfel
 * - Notizen/Karte/Whiteboard: Chat + Charakterbogen
 */
function addFlyButtons(currentPage) {
    // Normalize currentPage - remove .html and leading slash
    const page = currentPage.replace('.html', '').replace(/^\//, '');
    
    const config = {
        'wuerfel': [
            { href: 'chat.html', icon: 'chat', title: 'Chat' },
            { href: 'charakterbogen.html#fokus', icon: 'character', title: 'Charakterbogen' }
        ],
        'charakterbogen': [
            { href: 'chat.html', icon: 'chat', title: 'Chat' },
            { href: 'wuerfel.html', icon: 'dice', title: 'Würfel' }
        ],
        'chat': [
            { href: 'wuerfel.html', icon: 'dice', title: 'Würfel' },
            { href: 'charakterbogen.html#fokus', icon: 'character', title: 'Charakterbogen' }
        ],
        'notizen': [
            { href: 'chat.html', icon: 'chat', title: 'Chat' },
            { href: 'charakterbogen.html#fokus', icon: 'character', title: 'Charakterbogen' }
        ],
        'karte': [
            { href: 'chat.html', icon: 'chat', title: 'Chat' },
            { href: 'charakterbogen.html#fokus', icon: 'character', title: 'Charakterbogen' }
        ],
        'whiteboard': [
            { href: 'chat.html', icon: 'chat', title: 'Chat' },
            { href: 'charakterbogen.html#fokus', icon: 'character', title: 'Charakterbogen' }
        ]
    };
    
    const buttons = config[page];
    
    if (!buttons) return; // No buttons for index.html or unknown pages
    
    const container = document.createElement('div');
    container.className = 'fly-btn-container';
    
    buttons.forEach((btn, index) => {
        const link = document.createElement('a');
        link.href = btn.href;
        link.className = 'fly-btn' + (index === buttons.length - 1 ? ' primary' : '');
        link.title = btn.title;
        
        if (btn.icon === 'chat') {
            link.id = 'fly-btn-chat';
            link.innerHTML = `
                <img src="assets/icons/icon_chat.png" alt="Chat" style="width: 24px; height: 24px;">
                <span class="fly-btn-badge" id="chatUnreadBadge"></span>
            `;
        } else if (btn.icon === 'dice') {
            link.innerHTML = `<img src="assets/icons/icon_dice.png" alt="Würfel">`;
        } else if (btn.icon === 'character') {
            link.innerHTML = `<img src="assets/icons/icon_character.png" alt="Charakter">`;
        }
        
        container.appendChild(link);
    });
    
    document.body.appendChild(container);
}


/**
 * Update the unread badge on the chat fly button
 * @param {number} count - Number of unread messages
 */
function updateChatUnreadBadge(count) {
    const badge = document.getElementById('chatUnreadBadge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.add('visible');
    } else {
        badge.textContent = '';
        badge.classList.remove('visible');
    }
}


// ===== SIDEBAR FUNCTIONS =====

function toggleSidebar() {
    sidebarOpen ? closeSidebar() : openSidebar();
}

function openSidebar() {
    sidebarOpen = true;
    document.getElementById('pnp-sidebar').classList.add('open');
    document.getElementById('pnp-sidebar-overlay').classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebarOpen = false;
    document.getElementById('pnp-sidebar').classList.remove('open');
    document.getElementById('pnp-sidebar-overlay').classList.remove('visible');
    document.body.style.overflow = '';
}

function setupTouchEvents() {
    // Swipe from left edge to open
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        // Only start swipe if near left edge (within 30px)
        if (touchStartX < 30 && !sidebarOpen) {
            isSwiping = true;
        }
        // Or if sidebar is open, allow swipe to close
        if (sidebarOpen) {
            isSwiping = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        touchCurrentX = e.touches[0].clientX;
        
        const sidebar = document.getElementById('pnp-sidebar');
        const overlay = document.getElementById('pnp-sidebar-overlay');
        
        if (!sidebarOpen) {
            // Opening: translate based on touch position
            const translateX = Math.min(0, touchCurrentX - NAV_CONFIG.SIDEBAR_WIDTH);
            sidebar.style.transform = `translateX(${translateX}px)`;
            sidebar.style.transition = 'none';
            
            // Overlay opacity based on progress
            const progress = Math.min(1, touchCurrentX / NAV_CONFIG.SIDEBAR_WIDTH);
            overlay.style.opacity = progress * 0.5;
            overlay.style.visibility = 'visible';
        } else {
            // Closing: translate based on swipe left
            const deltaX = touchStartX - touchCurrentX;
            if (deltaX > 0) {
                const translateX = Math.max(-NAV_CONFIG.SIDEBAR_WIDTH, -deltaX);
                sidebar.style.transform = `translateX(${translateX}px)`;
                sidebar.style.transition = 'none';
                
                const progress = 1 - (deltaX / NAV_CONFIG.SIDEBAR_WIDTH);
                overlay.style.opacity = progress * 0.5;
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isSwiping) return;
        isSwiping = false;
        
        const sidebar = document.getElementById('pnp-sidebar');
        const overlay = document.getElementById('pnp-sidebar-overlay');
        const deltaX = touchCurrentX - touchStartX;
        
        // Reset inline styles
        sidebar.style.transform = '';
        sidebar.style.transition = '';
        overlay.style.opacity = '';
        overlay.style.visibility = '';
        
        if (!sidebarOpen && deltaX > NAV_CONFIG.SWIPE_THRESHOLD) {
            openSidebar();
        } else if (sidebarOpen && deltaX < -NAV_CONFIG.SWIPE_THRESHOLD) {
            closeSidebar();
        } else if (!sidebarOpen) {
            closeSidebar();
        }
        
        touchStartX = 0;
        touchCurrentX = 0;
    }, { passive: true });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close sidebar
            if (sidebarOpen) {
                closeSidebar();
                return;
            }
            
            // Close any open dropdowns
            document.querySelectorAll('.theme-dropdown.active, .ruleset-dropdown.open, .hub-theme-dropdown.open').forEach(el => {
                el.classList.remove('active', 'open');
            });
            
            // Close any open modals/popups
            document.querySelectorAll('.popup-overlay, .modal-overlay, [class*="modal"].active').forEach(el => {
                el.remove();
            });
            
            // Close image modal if exists
            const imgModal = document.getElementById('imageModal');
            if (imgModal && imgModal.style.display !== 'none') {
                imgModal.style.display = 'none';
            }
        }
    });
}


// ===== NAVIGATION ACTIONS =====

function navigateToHub() {
    window.location.href = 'index.html';
}

// ===== SOUND SETTINGS =====

function toggleSoundSetting() {
    const isMuted = localStorage.getItem('pnp_sound_muted') === 'true';
    const newState = !isMuted;
    localStorage.setItem('pnp_sound_muted', newState);
    updateSoundToggleUI(newState);
}

function updateSoundToggleUI(isMuted) {
    const iconOn = document.getElementById('soundIconOn');
    const iconOff = document.getElementById('soundIconOff');
    const text = document.getElementById('soundToggleText');
    
    if (iconOn && iconOff && text) {
        iconOn.style.display = isMuted ? 'none' : 'block';
        iconOff.style.display = isMuted ? 'block' : 'none';
        text.textContent = isMuted ? 'Sound aus' : 'Sound an';
    }
}

function initSoundToggle() {
    const isMuted = localStorage.getItem('pnp_sound_muted') === 'true';
    updateSoundToggleUI(isMuted);
}

function isSoundMuted() {
    return localStorage.getItem('pnp_sound_muted') === 'true';
}

// Make available globally
window.toggleSoundSetting = toggleSoundSetting;
window.isSoundMuted = isSoundMuted;

function handleLogout() {
    if (confirm('Möchtest du dich wirklich ausloggen?')) {
        if (typeof logout === 'function') {
            logout(true);
        } else {
            localStorage.removeItem('pnp_companion_user');
            window.location.href = 'login.html';
        }
    }
}


// ===== UTILITY FUNCTIONS =====

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateModuleTools(toolsHTML) {
    const toolsContainer = document.getElementById('moduleTools');
    if (toolsContainer) {
        toolsContainer.innerHTML = toolsHTML;
    }
}

function updateModuleName(name) {
    const nameEl = document.querySelector('.module-name');
    if (nameEl) {
        nameEl.textContent = name;
    }
}


// ===== STYLES INJECTION =====

function injectNavStyles() {
    if (document.getElementById('pnp-nav-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'pnp-nav-styles';
    styles.textContent = `
        /* ===== NAVBAR BASE ===== */
        #pnp-navbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: ${NAV_CONFIG.HEIGHT_DESKTOP}px;
            background: var(--md-surface-container, #211f26);
            box-shadow: var(--elevation-2, 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15));
            z-index: 400;
            line-height: 1;
        }

        #pnp-navbar * {
            line-height: normal;
        }

        .navbar-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 100%;
            padding: 0 16px;
            max-width: 100%;
        }

        .navbar-left,
        .navbar-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        /* ===== HAMBURGER BUTTON ===== */
        .hamburger-btn {
            display: flex;
        }

        /* ===== NAVBAR LOGO (Center) ===== */
        .navbar-logo {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            height: 32px;
            display: flex;
            align-items: center;
            text-decoration: none;
            transition: opacity 0.15s ease;
        }

        .navbar-logo:hover {
            opacity: 0.8;
        }

        .navbar-logo img {
            height: 100%;
            width: auto;
        }

        .navbar-logo .logo-white { display: block; }
        .navbar-logo .logo-black { display: none; }
        [data-theme="light"] .navbar-logo .logo-white { display: none; }
        [data-theme="light"] .navbar-logo .logo-black { display: block; }

        /* ===== MODULE NAME ===== */
        .module-name {
            font-size: 18px;
            font-weight: 500;
            color: var(--md-on-surface, #e6e1e5);
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
        }

        /* ===== NAV BUTTONS ===== */
        .nav-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            padding: 0;
            background: transparent;
            border: none;
            border-radius: 50%;
            color: var(--md-on-surface-variant, #cac4d0);
            cursor: pointer;
            transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }

        .nav-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: currentColor;
            opacity: 0;
            transition: opacity 200ms;
        }

        .nav-btn:hover {
            color: var(--md-on-surface, #e6e1e5);
        }

        .nav-btn:hover::before {
            opacity: 0.08;
        }

        .nav-btn:active::before {
            opacity: 0.12;
        }

        .nav-btn svg {
            position: relative;
            z-index: 1;
        }

        /* ===== MODULE TOOLS ===== */
        .module-tools {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .module-tools .icon-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            padding: 0;
            background: transparent;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            transition: all 200ms;
            position: relative;
        }

        .module-tools .icon-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: var(--md-primary, #6750a4);
            opacity: 0;
            transition: opacity 200ms;
        }

        .module-tools .icon-btn:hover::before {
            opacity: 0.08;
        }

        .module-tools .icon-btn img {
            width: 24px;
            height: 24px;
            object-fit: contain;
            position: relative;
            z-index: 1;
        }

        /* ===== USER INDICATOR ===== */
        .user-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: var(--md-surface-container-high, #2b2930);
            border-radius: 20px;
            max-width: 150px;
        }

        .user-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .user-name {
            font-size: 14px;
            font-weight: 500;
            color: var(--md-on-surface, #e6e1e5);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* ===== SIDEBAR ===== */
        #pnp-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: ${NAV_CONFIG.SIDEBAR_WIDTH}px;
            height: 100vh;
            background: var(--md-surface-container, #211f26);
            z-index: 500;
            transform: translateX(-100%);
            transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            box-shadow: var(--elevation-4, 0 8px 16px rgba(0,0,0,0.3));
        }

        #pnp-sidebar.open {
            transform: translateX(0);
        }

        /* ===== SIDEBAR OVERLAY ===== */
        #pnp-sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 450;
            opacity: 0;
            visibility: hidden;
            transition: opacity 300ms ease, visibility 300ms ease;
        }

        #pnp-sidebar-overlay.visible {
            opacity: 1;
            visibility: visible;
        }

        /* ===== SIDEBAR HEADER ===== */
        .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--md-outline-variant, #49454f);
        }

        .sidebar-logo {
            height: 28px;
            width: auto;
        }

        .sidebar-logo.logo-white { display: block; }
        .sidebar-logo.logo-black { display: none; }
        [data-theme="light"] .sidebar-logo.logo-white { display: none; }
        [data-theme="light"] .sidebar-logo.logo-black { display: block; }

        .sidebar-close {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: transparent;
            border: none;
            border-radius: 50%;
            color: var(--md-on-surface-variant, #cac4d0);
            cursor: pointer;
            transition: all 200ms ease;
        }

        .sidebar-close:hover {
            background: var(--md-surface-container-highest, #36343b);
            color: var(--md-on-surface, #e6e1e5);
        }

        /* ===== SIDEBAR USER ===== */
        .sidebar-user {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 20px;
            border-bottom: 1px solid var(--md-outline-variant, #49454f);
        }

        .sidebar-user-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .sidebar-user-name {
            font-size: 16px;
            font-weight: 500;
            color: var(--md-on-surface, #e6e1e5);
        }

        /* ===== SIDEBAR PLAYERS ===== */
        .sidebar-players-section {
            padding: 0 0 8px 0;
            border-bottom: 1px solid var(--md-outline-variant, #49454f);
        }

        .sidebar-players-list {
            padding: 0 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .sidebar-players-loading {
            font-size: 12px;
            color: var(--md-on-surface-variant, #cac4d0);
            padding: 8px;
            text-align: center;
        }

        .sidebar-player-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-radius: 8px;
            background: var(--md-surface-container, #211f26);
        }

        .sidebar-player-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .sidebar-player-name {
            font-size: 13px;
            color: var(--md-on-surface, #e6e1e5);
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .sidebar-player-badge {
            font-size: 9px;
            font-weight: 600;
            background: var(--md-primary, #6750a4);
            color: var(--md-on-primary, #fff);
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
        }

        .sidebar-player-badge.gm {
            background: #f44336;
        }

        /* ===== SIDEBAR NAV ===== */
        .sidebar-nav {
            flex: 1;
            overflow-y: auto;
            padding: 12px 0;
        }

        .sidebar-section-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--md-on-surface-variant, #cac4d0);
            padding: 12px 20px 8px;
        }

        .sidebar-link {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 14px 20px;
            color: var(--md-on-surface, #e6e1e5);
            text-decoration: none;
            font-size: 15px;
            font-weight: 500;
            transition: all 200ms ease;
            border: none;
            background: none;
            width: 100%;
            cursor: pointer;
            text-align: left;
        }

        .sidebar-link:hover {
            background: var(--md-surface-container-high, #2b2930);
        }

        .sidebar-link.active {
            background: color-mix(in srgb, var(--md-primary, #6750a4) 15%, transparent);
            color: var(--md-primary, #6750a4);
        }

        .sidebar-link.active img {
            filter: none;
        }

        .sidebar-link img,
        .sidebar-link svg {
            width: 24px;
            height: 24px;
            opacity: 0.8;
        }

        .sidebar-link:hover img,
        .sidebar-link:hover svg {
            opacity: 1;
        }

        /* ===== SIDEBAR FOOTER ===== */
        .sidebar-footer {
            border-top: 1px solid var(--md-outline-variant, #49454f);
            padding: 12px 0;
            margin-top: auto;
            flex-shrink: 0;
            background: var(--md-surface-container, #211f26);
        }

        .sidebar-logout {
            color: var(--md-error, #f2b8b5);
        }

        .sidebar-logout:hover {
            background: color-mix(in srgb, var(--md-error, #f2b8b5) 10%, transparent);
        }

        .sidebar-gm-options {
            color: #4CAF50;
            display: none;
        }

        .sidebar-gm-options.visible {
            display: flex;
        }

        .sidebar-gm-options:hover {
            background: color-mix(in srgb, #4CAF50 15%, transparent);
        }

        .sidebar-gm-options svg {
            color: #4CAF50;
        }

        .sidebar-legal {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            padding: 16px 12px 8px;
            border-top: 1px solid var(--md-outline-variant, #49454f);
            margin-top: 8px;
        }

        .sidebar-legal a {
            color: var(--md-on-surface-variant, #cac4d0);
            text-decoration: none;
            font-size: 12px;
            opacity: 0.7;
            transition: opacity 200ms ease;
        }

        .sidebar-legal a:hover {
            opacity: 1;
            color: var(--md-primary, #6750a4);
        }

        .sidebar-legal span {
            color: var(--md-on-surface-variant, #cac4d0);
            opacity: 0.5;
            font-size: 12px;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: ${NAV_CONFIG.BREAKPOINT_MOBILE}px) {
            #pnp-sidebar {
                height: 100%;
                height: 100dvh;
            }
            
            #pnp-navbar {
                height: ${NAV_CONFIG.HEIGHT_MOBILE}px;
            }

            .navbar-container {
                padding: 0 12px;
                gap: 8px;
            }

            .module-name {
                font-size: 16px;
                max-width: 120px;
            }

            .navbar-logo {
                height: 28px;
            }

            .user-name {
                display: none;
            }

            .user-indicator {
                padding: 8px;
            }

            .logout-btn-nav {
                display: none;
            }
        }

        @media (max-width: ${NAV_CONFIG.BREAKPOINT_SMALL}px) {
            .module-name {
                display: none;
            }

            .navbar-logo {
                height: 24px;
            }

            .navbar-left,
            .navbar-right {
                gap: 8px;
            }

            .module-tools {
                gap: 2px;
            }

            #pnp-sidebar {
                width: 260px;
            }
        }

        /* GM Player Management Popup */
        .player-manage-popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .player-manage-popup {
            background: var(--md-surface-container-high, #2b2930);
            border-radius: 16px;
            padding: 24px;
            min-width: 300px;
            max-width: 90vw;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }

        .player-manage-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--md-outline-variant, #49454f);
        }

        .player-manage-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
        }

        .player-manage-name {
            font-size: 18px;
            font-weight: 600;
            color: var(--md-on-surface, #e6e1e5);
        }

        .player-manage-badge {
            font-size: 10px;
            font-weight: 600;
            background: #f44336;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
        }

        .player-manage-section {
            margin-bottom: 16px;
        }

        .player-manage-section label {
            display: block;
            font-size: 12px;
            color: var(--md-on-surface-variant, #cac4d0);
            margin-bottom: 8px;
        }

        .player-manage-row {
            display: flex;
            gap: 8px;
        }

        .player-manage-input {
            flex: 1;
            padding: 10px 12px;
            background: var(--md-surface-container, #1d1b20);
            border: 1px solid var(--md-outline-variant, #49454f);
            border-radius: 8px;
            color: var(--md-on-surface, #e6e1e5);
            font-size: 14px;
        }

        .player-manage-color {
            width: 50px;
            height: 40px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
        }

        .player-manage-btn {
            padding: 10px 16px;
            background: var(--md-primary, #6750a4);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
        }

        .player-manage-btn:hover {
            opacity: 0.9;
        }

        .player-manage-divider {
            height: 1px;
            background: var(--md-outline-variant, #49454f);
            margin: 16px 0;
        }

        .player-manage-action-btn {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: var(--md-surface-container, #1d1b20);
            border: 1px solid var(--md-outline-variant, #49454f);
            border-radius: 8px;
            color: var(--md-on-surface, #e6e1e5);
            font-size: 14px;
            cursor: pointer;
            margin-bottom: 8px;
            transition: all 0.2s;
        }

        .player-manage-action-btn svg {
            width: 18px;
            height: 18px;
        }

        .player-manage-action-btn.gm-action {
            border-color: var(--md-primary, #6750a4);
            color: var(--md-primary, #6750a4);
        }

        .player-manage-action-btn.gm-action:hover {
            background: color-mix(in srgb, var(--md-primary, #6750a4) 15%, transparent);
        }

        .player-manage-action-btn.warning-action {
            border-color: #ff9800;
            color: #ff9800;
        }

        .player-manage-action-btn.warning-action:hover {
            background: rgba(255, 152, 0, 0.15);
        }

        .player-manage-action-btn.danger-action {
            border-color: #f44336;
            color: #f44336;
        }

        .player-manage-action-btn.danger-action:hover {
            background: rgba(244, 67, 54, 0.15);
        }

        .player-manage-close {
            width: 100%;
            padding: 12px;
            background: transparent;
            border: 1px solid var(--md-outline-variant, #49454f);
            border-radius: 8px;
            color: var(--md-on-surface-variant, #cac4d0);
            font-size: 14px;
            cursor: pointer;
            margin-top: 8px;
        }

        .player-manage-close:hover {
            background: var(--md-surface-container, #1d1b20);
        }

        .sidebar-player-item.gm-clickable {
            cursor: pointer;
        }

        .sidebar-player-item.gm-clickable:hover {
            background: var(--md-surface-container-high, #2b2930);
        }

        /* ===== FLY BUTTONS ===== */
        .fly-btn-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 1000;
        }

        .fly-btn,
        .fly-btn:link,
        .fly-btn:visited,
        .fly-btn:focus,
        .fly-btn:focus-visible,
        .fly-btn:active {
            width: 52px;
            height: 52px;
            background: var(--md-surface-container-high, #2b2930);
            border: none !important;
            outline: none !important;
            outline-offset: 0 !important;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
            text-decoration: none;
            animation: fabSlideIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
        }

        .fly-btn:nth-child(1) { animation-delay: 100ms; }
        .fly-btn:nth-child(2) { animation-delay: 200ms; }
        .fly-btn:nth-child(3) { animation-delay: 300ms; }

        @keyframes fabSlideIn {
            from {
                opacity: 0;
                transform: translateY(20px) scale(0.8);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .fly-btn:hover {
            background: var(--md-primary, #6750a4);
            transform: scale(1.08);
            box-shadow: 0 6px 16px rgba(103, 80, 164, 0.4);
        }

        .fly-btn.primary {
            background: var(--md-primary, #6750a4);
        }

        .fly-btn.primary:hover {
            filter: brightness(1.1);
        }

        .fly-btn img {
            width: 24px;
            height: 24px;
            filter: brightness(0) invert(1);
            opacity: 0.9;
        }

        .fly-btn:hover img {
            opacity: 1;
        }

        .fly-btn svg {
            width: 24px;
            height: 24px;
            color: var(--md-on-surface, #e6e1e5);
        }

        .fly-btn:hover svg {
            color: var(--md-on-primary, #fff);
        }

        .fly-btn.primary svg {
            color: var(--md-on-primary, #fff);
        }

        /* Unread Badge for Chat Button */
        .fly-btn {
            position: relative;
        }

        .fly-btn-badge {
            position: absolute;
            top: -4px;
            right: -4px;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            background: #f44336;
            color: white;
            font-size: 11px;
            font-weight: 600;
            border-radius: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transform: scale(0.5);
            transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            box-shadow: 0 2px 6px rgba(244, 67, 54, 0.4);
        }

        .fly-btn-badge.visible {
            opacity: 1;
            transform: scale(1);
        }

        @media (max-width: 600px) {
            .fly-btn-container {
                bottom: 16px;
                right: 16px;
                gap: 10px;
            }

            .fly-btn {
                width: 48px;
                height: 48px;
            }

            .fly-btn img,
            .fly-btn svg {
                width: 22px;
                height: 22px;
            }
        }
    `;
    
    document.head.appendChild(styles);
}


// ===== RESPONSIVE HANDLING =====

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const isMobile = window.innerWidth <= NAV_CONFIG.BREAKPOINT_MOBILE;
        document.body.style.paddingTop = `${isMobile ? NAV_CONFIG.HEIGHT_MOBILE : NAV_CONFIG.HEIGHT_DESKTOP}px`;
    }, 100);
});


// ===== LEGACY COMPATIBILITY =====
const createNavigationBar = initNavigation;


// ===== SIDEBAR PLAYERS LIST =====

/**
 * Update sidebar players list
 * Called by modules that have Firebase connected
 */
function updateSidebarPlayers(players) {
    const list = document.getElementById('sidebarPlayersList');
    if (!list) return;
    
    if (!players || Object.keys(players).length === 0) {
        list.innerHTML = '<div class="sidebar-players-loading">Keine Spieler online</div>';
        return;
    }
    
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const isCurrentUserGM = currentUser?.isGM || false;
    const isRoomCreator = currentUser?.isRoomCreator || false;
    
    // Sort: GM first, then alphabetically by name
    const sortedPlayers = Object.values(players).sort((a, b) => {
        if (a.isGM && !b.isGM) return -1;
        if (!a.isGM && b.isGM) return 1;
        return (a.username || '').localeCompare(b.username || '', 'de');
    });
    
    list.innerHTML = sortedPlayers.map(player => {
        const isMe = player.username === currentUser?.username;
        const isGM = player.isGM;
        const clickable = isCurrentUserGM && !isMe;
        
        return `
            <div class="sidebar-player-item ${clickable ? 'gm-clickable' : ''}" 
                 ${clickable ? `onclick="openPlayerManagePopup('${player.username}', '${player.color}', ${isGM}, ${player.isRoomCreator || false})"` : ''}>
                <span class="sidebar-player-dot" style="background: ${player.color}; box-shadow: 0 0 6px ${player.color};"></span>
                <span class="sidebar-player-name">${player.username}${isMe ? ' (Du)' : ''}</span>
                ${isGM ? '<span class="sidebar-player-badge gm">GM</span>' : ''}
            </div>
        `;
    }).join('');
}

// GM Player Management Popup
function openPlayerManagePopup(username, color, isGM, isRoomCreator) {
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser?.isGM) return;
    
    const canRemoveGM = currentUser.isRoomCreator && isGM && !isRoomCreator;
    const canMakeGM = !isGM;
    
    // Remove existing popup
    const existing = document.getElementById('playerManagePopup');
    if (existing) existing.remove();
    
    const popup = document.createElement('div');
    popup.id = 'playerManagePopup';
    popup.className = 'player-manage-popup-overlay';
    popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
    
    popup.innerHTML = `
        <div class="player-manage-popup">
            <div class="player-manage-header">
                <span class="player-manage-dot" style="background: ${color};"></span>
                <span class="player-manage-name">${username}</span>
                ${isGM ? '<span class="player-manage-badge">GM</span>' : ''}
            </div>
            
            <div class="player-manage-actions">
                <div class="player-manage-section">
                    <label>Name ändern</label>
                    <div class="player-manage-row">
                        <input type="text" id="pmNewName" value="${username}" maxlength="20" class="player-manage-input">
                        <button onclick="gmRenamePlayer('${username}')" class="player-manage-btn">Ändern</button>
                    </div>
                </div>
                
                <div class="player-manage-section">
                    <label>Farbe ändern</label>
                    <div class="player-manage-row">
                        <input type="color" id="pmNewColor" value="${color}" class="player-manage-color">
                        <button onclick="gmChangePlayerColor('${username}')" class="player-manage-btn">Ändern</button>
                    </div>
                </div>
                
                <div class="player-manage-divider"></div>
                
                ${canMakeGM ? `
                    <button onclick="gmMakePlayerGM('${username}')" class="player-manage-action-btn gm-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        Zu GM machen
                    </button>
                ` : ''}
                
                ${canRemoveGM ? `
                    <button onclick="gmRemovePlayerGM('${username}')" class="player-manage-action-btn warning-action">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        GM-Rechte entziehen
                    </button>
                ` : ''}
                
                <button onclick="gmKickPlayer('${username}')" class="player-manage-action-btn danger-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    Kick
                </button>
            </div>
            
            <button onclick="this.closest('.player-manage-popup-overlay').remove()" class="player-manage-close">Schließen</button>
        </div>
    `;
    
    document.body.appendChild(popup);
}

// GM Actions
async function gmRenamePlayer(oldUsername) {
    const newName = document.getElementById('pmNewName')?.value?.trim();
    if (!newName || newName === oldUsername) return;
    
    if (typeof gmUpdatePlayer === 'function') {
        await gmUpdatePlayer(oldUsername, { username: newName });
        document.getElementById('playerManagePopup')?.remove();
    }
}

async function gmChangePlayerColor(username) {
    const newColor = document.getElementById('pmNewColor')?.value;
    if (!newColor) return;
    
    if (typeof gmUpdatePlayer === 'function') {
        await gmUpdatePlayer(username, { color: newColor });
        document.getElementById('playerManagePopup')?.remove();
    }
}

async function gmMakePlayerGM(username) {
    if (confirm(`${username} zum GM machen?`)) {
        if (typeof gmUpdatePlayer === 'function') {
            await gmUpdatePlayer(username, { isGM: true });
            document.getElementById('playerManagePopup')?.remove();
        }
    }
}

async function gmRemovePlayerGM(username) {
    if (confirm(`GM-Rechte von ${username} entziehen?`)) {
        if (typeof gmUpdatePlayer === 'function') {
            await gmUpdatePlayer(username, { isGM: false });
            document.getElementById('playerManagePopup')?.remove();
        }
    }
}

async function gmKickPlayer(username) {
    if (confirm(`${username} wirklich kicken?`)) {
        if (typeof gmKickPlayerFromSession === 'function') {
            await gmKickPlayerFromSession(username);
            document.getElementById('playerManagePopup')?.remove();
        }
    }
}

/**
 * Initialize sidebar players listener
 * Call this after Firebase is initialized
 */
function initSidebarPlayersListener() {
    // Wait for onPlayersChange to be available
    if (typeof onPlayersChange !== 'function') {
        console.log('[Nav] Waiting for Firebase...');
        setTimeout(initSidebarPlayersListener, 500);
        return;
    }
    
    console.log('[Nav] Starting players listener for sidebar');
    onPlayersChange(updateSidebarPlayers);
}


// ===== FOOTER COMPONENT =====

/**
 * Create and inject the site footer
 * @param {string} containerId - Optional ID of container to append footer to (defaults to body)
 */
function createFooter(containerId = null) {
    function _createFooter() {
        const footer = document.createElement('footer');
        footer.className = 'site-footer';
        
        // Auf Login-Seite: fixed am unteren Rand (wegen fixed screens)
        const isLoginPage = window.location.pathname.includes('login');
        if (isLoginPage) {
            footer.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; background: transparent; opacity: 0; transition: opacity 0.5s ease;';
            // Footer nach Splash einblenden (2.5s Splash + 0.5s buffer)
            setTimeout(() => {
                footer.style.opacity = '1';
            }, 3000);
        }
        
        footer.innerHTML = `
            <div class="footer-divider"></div>
            <div class="footer-content">
                <nav class="footer-primary">
                    <a href="about.html">Über RIFT</a>
                    <span class="footer-dot">·</span>
                    <a href="branding.html">Branding Guide</a>
                    <span class="footer-dot">·</span>
                    <a href="contact.html">Kontakt</a>
                </nav>
                <nav class="footer-secondary">
                    <a href="privacy.html">Datenschutz</a>
                    <span class="footer-dot">·</span>
                    <a href="impressum.html">Impressum</a>
                </nav>
                <div class="footer-tertiary">
                    <a href="donation.html">Spenden</a>
                </div>
                <p class="footer-copyright">© 2025 RIFT – Tabletop Companion</p>
            </div>
        `;
        
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.appendChild(footer);
            } else {
                document.body.appendChild(footer);
            }
        } else {
            document.body.appendChild(footer);
        }
        
        return footer;
    }
    
    // Wait for DOM if not ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _createFooter);
    } else {
        return _createFooter();
    }
}

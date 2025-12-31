/**
 * PNP COMPANION - Authentication & Session Management
 * Version: 2.2
 * 
 * Handles user authentication, room/session management, and storage helpers.
 * Prepared for future multiplayer support.
 * 
 * Storage Key Convention:
 * - Individual: pnp_{module}_{username}
 * - Shared:     pnp_{roomId}_{module}
 */

// ===== CONSTANTS =====
const AUTH_CONFIG = {
    STORAGE_KEY: 'pnp_companion_user',
    ROOM_STORAGE_KEY: 'pnp_companion_room',
    DEFAULT_ROOM_ID: 'local',
    DEFAULT_ROOM_NAME: 'Lokale Session',
    SESSION_TIMEOUT: 72 * 60 * 60 * 1000, // 72 hours (3 days)
    MIN_USERNAME_LENGTH: 2,
    MAX_USERNAME_LENGTH: 20
};

// Player color palette (Red excluded - GM only)
const PLAYER_COLORS = Object.freeze([
    { name: 'Purple', hex: '#6750a4' },
    { name: 'Green', hex: '#4caf50' },
    { name: 'Blue', hex: '#2196f3' },
    { name: 'Orange', hex: '#ff9800' },
    { name: 'Pink', hex: '#e91e63' },
    { name: 'Cyan', hex: '#00bcd4' },
    { name: 'Yellow', hex: '#ffeb3b' },
    { name: 'Turquoise', hex: '#03fc90' },
    { name: 'Deep Purple', hex: '#9c27b0' },
    { name: 'Brown', hex: '#795548' }
]);


// ===== STORAGE HELPERS =====

/**
 * Safely get item from localStorage with JSON parsing
 * @param {string} key - Storage key
 * @returns {any|null} - Parsed value or null
 */
function safeGetItem(key) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return null;
        return JSON.parse(item);
    } catch (error) {
        console.error(`[Storage] Error reading ${key}:`, error);
        try { localStorage.removeItem(key); } catch (e) {}
        return null;
    }
}

/**
 * Safely set item in localStorage with JSON stringifying
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {boolean} - Success status
 */
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`[Storage] Error writing ${key}:`, error);
        return false;
    }
}

/**
 * Safely remove item from localStorage
 * @param {string} key - Storage key
 */
function safeRemoveItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`[Storage] Error removing ${key}:`, error);
    }
}


// ===== STORAGE KEY GENERATORS =====

/**
 * Generate storage key for individual (per-user) data
 * @param {string} module - Module name (e.g., 'notes', 'character')
 * @param {string} [username] - Username (defaults to current user)
 * @returns {string} - Storage key
 */
function getIndividualKey(module, username = null) {
    const user = username || getCurrentUsername() || 'guest';
    return `pnp_${module}_${user}`;
}

/**
 * Generate storage key for shared (per-room) data
 * @param {string} module - Module name (e.g., 'dice', 'map', 'whiteboard')
 * @returns {string} - Storage key
 */
function getSharedKey(module) {
    const roomId = getCurrentRoomId();
    return `pnp_${roomId}_${module}`;
}


// ===== ROOM/SESSION MANAGEMENT =====

/**
 * Get current room data
 * @returns {Object} - Room object with id and name
 */
function getCurrentRoom() {
    const room = safeGetItem(AUTH_CONFIG.ROOM_STORAGE_KEY);
    if (room && room.id) {
        return room;
    }
    // Return default room
    return {
        id: AUTH_CONFIG.DEFAULT_ROOM_ID,
        name: AUTH_CONFIG.DEFAULT_ROOM_NAME
    };
}

/**
 * Get current room ID
 * @returns {string}
 */
function getCurrentRoomId() {
    return getCurrentRoom().id;
}

/**
 * Get current room name
 * @returns {string}
 */
function getCurrentRoomName() {
    return getCurrentRoom().name;
}

/**
 * Set/Join a room
 * @param {string} roomId - Room identifier
 * @param {string} [roomName] - Display name for the room
 * @returns {boolean} - Success
 */
function setRoom(roomId, roomName = null) {
    if (!roomId || typeof roomId !== 'string') {
        console.error('[Auth] Invalid room ID');
        return false;
    }
    
    const room = {
        id: roomId.trim().toUpperCase(),
        name: roomName || roomId,
        joinedAt: Date.now()
    };
    
    const saved = safeSetItem(AUTH_CONFIG.ROOM_STORAGE_KEY, room);
    if (saved) {
        console.log(`[Auth] Joined room: ${room.name} (${room.id})`);
    }
    return saved;
}

/**
 * Get current room
 * @returns {Object|null} - Room object with id, name, joinedAt
 */
function getRoom() {
    return safeGetItem(AUTH_CONFIG.ROOM_STORAGE_KEY);
}

/**
 * Leave current room (reset to default)
 */
function leaveRoom() {
    safeRemoveItem(AUTH_CONFIG.ROOM_STORAGE_KEY);
    console.log('[Auth] Left room, reset to default');
}


// ===== AUTHENTICATION FUNCTIONS =====

/**
 * Check if user is currently authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    const user = getCurrentUser();
    if (!user) return false;
    
    // Check session timeout
    const now = Date.now();
    if (user.loginTime && (now - user.loginTime > AUTH_CONFIG.SESSION_TIMEOUT)) {
        console.log('[Auth] Session expired');
        logout(false);
        return false;
    }
    
    return true;
}

/**
 * Get current logged-in user data
 * @returns {Object|null} - User object or null
 */
function getCurrentUser() {
    const userData = safeGetItem(AUTH_CONFIG.STORAGE_KEY);
    
    if (userData && typeof userData === 'object' && userData.username && userData.color) {
        return userData;
    }
    
    return null;
}

/**
 * Get just the username of current user
 * @returns {string|null}
 */
function getCurrentUsername() {
    const user = getCurrentUser();
    return user ? user.username : null;
}

/**
 * Get the color of current user
 * @returns {string|null} - Hex color or null
 */
function getCurrentUserColor() {
    const user = getCurrentUser();
    return user ? user.color : null;
}

/**
 * Validate username
 * @param {string} username 
 * @returns {{valid: boolean, error?: string}}
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username ist erforderlich' };
    }
    
    const trimmed = username.trim();
    
    if (trimmed.length < AUTH_CONFIG.MIN_USERNAME_LENGTH) {
        return { valid: false, error: `Username muss mindestens ${AUTH_CONFIG.MIN_USERNAME_LENGTH} Zeichen haben` };
    }
    
    if (trimmed.length > AUTH_CONFIG.MAX_USERNAME_LENGTH) {
        return { valid: false, error: `Username darf maximal ${AUTH_CONFIG.MAX_USERNAME_LENGTH} Zeichen haben` };
    }
    
    if (!/^[\w\s\-äöüÄÖÜß]+$/i.test(trimmed)) {
        return { valid: false, error: 'Username enthält ungültige Zeichen' };
    }
    
    return { valid: true };
}

/**
 * Validate color hex
 * @param {string} colorHex 
 * @returns {boolean}
 */
function isValidColor(colorHex) {
    if (!colorHex || typeof colorHex !== 'string') return false;
    return /^#[0-9A-Fa-f]{6}$/.test(colorHex);
}

/**
 * Login user with username and color
 * @param {string} username - Player name
 * @param {string} colorHex - Hex color code
 * @param {boolean} isGM - Is Game Master
 * @param {boolean} isRoomCreator - Is the original room creator
 * @returns {{success: boolean, error?: string}}
 */
function login(username, colorHex, isGM = false, isRoomCreator = false) {
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
        return { success: false, error: usernameValidation.error };
    }
    
    if (!isValidColor(colorHex)) {
        return { success: false, error: 'Ungültige Farbe ausgewählt' };
    }
    
    const user = {
        username: username.trim(),
        color: colorHex,
        isGM: isGM,
        isRoomCreator: isRoomCreator || isGM, // First GM is room creator
        loginTime: Date.now()
    };
    
    const saved = safeSetItem(AUTH_CONFIG.STORAGE_KEY, user);
    
    if (!saved) {
        return { success: false, error: 'Konnte nicht speichern. Ist der Speicher voll?' };
    }
    
    console.log(`[Auth] User logged in: ${user.username}${isGM ? ' (GM)' : ''}`);
    return { success: true };
}

/**
 * Check if current user is GM
 * @returns {boolean}
 */
function isCurrentUserGM() {
    const user = getCurrentUser();
    return user ? user.isGM === true : false;
}

/**
 * Logout current user
 * @param {boolean} redirect - Whether to redirect to login page
 */
function logout(redirect = true) {
    const user = getCurrentUser();
    if (user) {
        console.log(`[Auth] User logged out: ${user.username}`);
    }
    
    safeRemoveItem(AUTH_CONFIG.STORAGE_KEY);
    
    if (redirect) {
        window.location.href = 'login.html';
    }
}

/**
 * Require authentication - redirects to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        console.log('[Auth] Authentication required, redirecting to login');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Redirect to hub if already authenticated
 */
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        console.log('[Auth] Already authenticated, redirecting to hub');
        window.location.href = 'index.html';
        return true;
    }
    return false;
}

/**
 * Update user session timestamp (keep alive)
 */
function refreshSession() {
    const user = getCurrentUser();
    if (user) {
        user.loginTime = Date.now();
        safeSetItem(AUTH_CONFIG.STORAGE_KEY, user);
    }
}


// ===== UTILITY FUNCTIONS =====

/**
 * Get available player colors
 * @returns {Array<{name: string, hex: string}>}
 */
function getColors() {
    return [...PLAYER_COLORS];
}

/**
 * Get color name by hex
 * @param {string} hex 
 * @returns {string|null}
 */
function getColorName(hex) {
    const color = PLAYER_COLORS.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    return color ? color.name : null;
}

/**
 * Check if localStorage is available
 * @returns {boolean}
 */
function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}


// ===== DATA HELPERS FOR MODULES =====

/**
 * Load individual data for current user
 * @param {string} module - Module name
 * @param {any} defaultValue - Default if not found
 * @returns {any}
 */
function loadIndividualData(module, defaultValue = null) {
    const key = getIndividualKey(module);
    const data = safeGetItem(key);
    return data !== null ? data : defaultValue;
}

/**
 * Save individual data for current user
 * @param {string} module - Module name
 * @param {any} data - Data to save
 * @returns {boolean}
 */
function saveIndividualData(module, data) {
    const key = getIndividualKey(module);
    return safeSetItem(key, data);
}

/**
 * Load shared data for current room
 * @param {string} module - Module name
 * @param {any} defaultValue - Default if not found
 * @returns {any}
 */
function loadSharedData(module, defaultValue = null) {
    const key = getSharedKey(module);
    const data = safeGetItem(key);
    return data !== null ? data : defaultValue;
}

/**
 * Save shared data for current room
 * @param {string} module - Module name
 * @param {any} data - Data to save
 * @returns {boolean}
 */
function saveSharedData(module, data) {
    const key = getSharedKey(module);
    return safeSetItem(key, data);
}

/**
 * Clear individual data for current user
 * @param {string} module - Module name
 */
function clearIndividualData(module) {
    const key = getIndividualKey(module);
    safeRemoveItem(key);
}

/**
 * Clear shared data for current room
 * @param {string} module - Module name
 */
function clearSharedData(module) {
    const key = getSharedKey(module);
    safeRemoveItem(key);
}


// ===== THEME MANAGEMENT =====

const AVAILABLE_THEMES = Object.freeze([
    { id: 'dark', name: 'RIFT', icon: '◆' },
    { id: 'cyberpunk', name: 'Neon City', icon: '🌆' },
    { id: 'souls', name: 'Ashen', icon: '🔥' },
    { id: 'greenterm', name: 'Field Terminal', icon: '💻' },
    { id: 'redemption', name: 'Redemption', icon: '🤠' },
    { id: 'rivia', name: 'Cold Iron', icon: '🐺' },
    { id: 'hylian', name: 'Everdawn', icon: '🗡️' }
]);

/**
 * Get available themes
 * @returns {Array<{id: string, name: string, icon: string}>}
 */
function getThemes() {
    return [...AVAILABLE_THEMES];
}

/**
 * Get current theme
 * @returns {string} - Theme ID
 */
function getCurrentTheme() {
    // Theme wird global gespeichert (nicht per user)
    return safeGetItem('pnp_theme') || 'dark';
}

/**
 * Set theme
 * @param {string} themeId - Theme ID
 * @returns {boolean} - Success
 */
function setTheme(themeId) {
    const validTheme = AVAILABLE_THEMES.find(t => t.id === themeId);
    if (!validTheme) {
        console.error(`[Theme] Invalid theme: ${themeId}`);
        return false;
    }
    
    document.documentElement.setAttribute('data-theme', themeId);
    // Theme wird global gespeichert (nicht per user)
    safeSetItem('pnp_theme', themeId);
    console.log(`[Theme] Set to: ${validTheme.name}`);
    return true;
}

/**
 * Apply saved theme on page load
 */
function applyTheme() {
    let theme = getCurrentTheme();
    // Falls Theme nicht mehr existiert (z.B. light wurde entfernt), auf dark zurücksetzen
    const validTheme = AVAILABLE_THEMES.find(t => t.id === theme);
    if (!validTheme) {
        theme = 'dark';
        safeSetItem('pnp_theme', theme);
    }
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Toggle between light and dark themes
 */
function toggleLightDark() {
    const current = getCurrentTheme();
    const newTheme = (current === 'light') ? 'dark' : 'light';
    setTheme(newTheme);
}


// ===== BACKGROUND IMAGE =====

const BG_IMAGE_COUNT = 12;

/**
 * Apply random background image
 * Random per page load, fades to theme color at bottom
 */
function applyRandomBackground() {
    // Generate random index 1-12 (new each page load)
    const bgIndex = Math.floor(Math.random() * BG_IMAGE_COUNT) + 1;
    
    // Format: bg_001.jpg, bg_002.jpg, etc.
    const bgNumber = String(bgIndex).padStart(3, '0');
    const bgPath = `assets/bg/bg_${bgNumber}.jpg`;
    
    // Create background element if not exists
    let bgEl = document.getElementById('pnp-background');
    if (!bgEl) {
        bgEl = document.createElement('div');
        bgEl.id = 'pnp-background';
        bgEl.style.cssText = `
            position: fixed;
            inset: 0;
            background-size: cover;
            background-position: center top;
            background-repeat: no-repeat;
            opacity: 0.05;
            filter: grayscale(100%);
            pointer-events: none;
            z-index: -1;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 20%, transparent 40%);
            mask-image: linear-gradient(to bottom, black 0%, black 20%, transparent 40%);
        `;
        document.body.insertBefore(bgEl, document.body.firstChild);
    }
    
    bgEl.style.backgroundImage = `url('${bgPath}')`;
    console.log(`[BG] Applied background: ${bgPath}`);
}


// ===== INITIALIZATION =====

if (!isStorageAvailable()) {
    console.error('[Auth] localStorage is not available. App functionality will be limited.');
}

// Apply theme immediately
applyTheme();

// Apply random background
applyRandomBackground();

// Log current session info
(function() {
    const user = getCurrentUser();
    const room = getCurrentRoom();
    if (user) {
        console.log(`[Auth] Session: ${user.username} in room "${room.name}" (${room.id})`);
    }
    console.log(`[Theme] Current: ${getCurrentTheme()}`);
})();

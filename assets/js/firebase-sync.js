/**
 * RIFT - Firebase Integration
 * Version: 1.0
 * 
 * Handles real-time synchronization for:
 * - Chat messages
 * - Dice rolls
 * - Whiteboard content
 * - Player online status
 */

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyCcoId9a62tLIqIRFaFt_ADMTedTUzf3f8",
    authDomain: "rift-app-de805.firebaseapp.com",
    databaseURL: "https://rift-app-de805-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rift-app-de805",
    storageBucket: "rift-app-de805.firebasestorage.app",
    messagingSenderId: "974596929896",
    appId: "1:974596929896:web:a6542045dae21899d07edd"
};

// ===== STATE =====
let firebaseApp = null;
let database = null;
let isOnline = false;
let currentSessionId = 'default';
let onlineStatusRef = null;
let connectedRef = null;

// Room cleanup config
const ROOM_INACTIVITY_TIMEOUT = 168 * 60 * 60 * 1000; // 168 hours (7 days)

// Callbacks for modules
const listeners = {
    chat: [],
    whiteboard: [],
    dice: [],
    players: []
};

// ===== INITIALIZATION =====

/**
 * Initialize Firebase
 * @returns {Promise<boolean>} Success status
 */
async function initFirebase() {
    try {
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.error('[Firebase] SDK not loaded');
            return false;
        }

        // Initialize app if not already done
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.apps[0];
        }

        database = firebase.database();
        
        // CRITICAL: Auto-set session ID from room FIRST
        if (typeof getRoom === 'function') {
            const room = getRoom();
            if (room && room.id) {
                currentSessionId = room.id;
                console.log(`[Firebase] Session from room: ${currentSessionId}`);
            } else {
                console.warn('[Firebase] No room found, using default session');
                currentSessionId = 'default';
            }
        } else {
            console.warn('[Firebase] getRoom not available, using default session');
            currentSessionId = 'default';
        }
        
        // Setup connection monitoring
        setupConnectionMonitoring();
        
        // Check if room is expired and cleanup if necessary
        await checkAndCleanupRoom();
        
        // Auto-join session for player presence
        joinSession();
        
        // Init sidebar players list
        if (typeof initSidebarPlayersListener === 'function') {
            initSidebarPlayersListener();
        }
        
        // Init popup listeners only if user is logged in (not on login page)
        const isLoginPage = window.location.pathname.includes('login');
        const hasUser = typeof getCurrentUser === 'function' && getCurrentUser() !== null;
        
        if (!isLoginPage && hasUser) {
            initDicePopupListener();
            initChatPopupListener();
            initWhiteboardPopupListener();
            initTypingListener();
            initChatUnreadCounter();
            initGlobalDiceClearListener();
            initGlobalTimerListener();
            initPauseListener();
            initAtmosphereListener();
            initPlayerToastListener();
            initAutoModuleAccessCheck();
            
            // Create GM Options FAB for GMs
            createGMOptionsFAB();
            
            // Initialize GM succession system
            initGMSuccession();
        } else {
            console.log('[Firebase] Skipping popup listeners (login page or no user)');
        }
        
        console.log('[Firebase] Initialized successfully for session:', currentSessionId);
        isOnline = true;
        return true;
    } catch (error) {
        console.error('[Firebase] Initialization failed:', error);
        isOnline = false;
        return false;
    }
}

/**
 * Create GM Options FAB for GMs (called after Firebase init to ensure user data is available)
 */
function createGMOptionsFAB() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const isGmOptionsPage = window.location.pathname.includes('gm-options');
    const isLoginPage = window.location.pathname.includes('login');
    const isIndexPage = window.location.pathname.endsWith('/') || window.location.pathname.includes('index');
    
    if (!user?.isGM || isGmOptionsPage || isLoginPage || isIndexPage) {
        return;
    }
    
    if (document.querySelector('.gm-options-fab')) {
        return;
    }
    
    const isMobile = window.innerWidth <= 600;
    const hasOtherFabs = !!document.querySelector('.fly-btn-container');
    
    const gmFab = document.createElement('a');
    gmFab.href = 'gm-options.html';
    gmFab.className = 'gm-options-fab';
    gmFab.title = 'GM Optionen';
    
    // INLINE STYLES - cannot be overridden
    gmFab.style.cssText = `
        position: fixed !important;
        bottom: ${isMobile ? '16px' : '24px'} !important;
        right: ${hasOtherFabs ? (isMobile ? '74px' : '88px') : (isMobile ? '16px' : '24px')} !important;
        width: ${isMobile ? '48px' : '52px'} !important;
        height: ${isMobile ? '48px' : '52px'} !important;
        background: #4CAF50 !important;
        border-radius: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        cursor: pointer !important;
        text-decoration: none !important;
        z-index: 1000 !important;
        visibility: visible !important;
        opacity: 1 !important;
    `;
    
    gmFab.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: ${isMobile ? '22px' : '26px'}; height: ${isMobile ? '22px' : '26px'};">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="12.01"/>
        </svg>
    `;
    
    document.body.appendChild(gmFab);
}

/**
 * Setup connection state monitoring
 */
function setupConnectionMonitoring() {
    connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snapshot) => {
        isOnline = snapshot.val() === true;
        console.log(`[Firebase] Connection: ${isOnline ? 'Online' : 'Offline'}`);
        
        // Update online status when connected
        if (isOnline && onlineStatusRef) {
            onlineStatusRef.onDisconnect().remove();
            onlineStatusRef.set(getPlayerData());
        }
        
        // Notify listeners
        document.dispatchEvent(new CustomEvent('firebase-connection', { 
            detail: { online: isOnline } 
        }));
    });
}

/**
 * Get current player data for online status
 */
function getPlayerData() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return null;
    
    return {
        username: user.username,
        color: user.color,
        isGM: user.isGM || false,
        isRoomCreator: user.isRoomCreator || false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
}

/**
 * Set the current session/room ID
 * @param {string} sessionId 
 */
function setSessionId(sessionId) {
    const oldSessionId = currentSessionId;
    currentSessionId = sessionId || 'default';
    
    // If session changed, we need to reinitialize listeners
    if (oldSessionId !== currentSessionId && oldSessionId !== 'default') {
        console.log(`[Firebase] Session changed from ${oldSessionId} to ${currentSessionId}`);
        // Listeners will be reattached when modules reinitialize
    }
    
    console.log(`[Firebase] Session: ${currentSessionId}`);
}

/**
 * Get database reference for current session
 * @param {string} path 
 * @returns {firebase.database.Reference}
 */
function getRef(path) {
    return database.ref(`sessions/${currentSessionId}/${path}`);
}


// ===== ROOM ACTIVITY & CLEANUP =====

/**
 * Update room's last activity timestamp
 * Called automatically on important actions
 */
function updateRoomActivity() {
    if (!database || currentSessionId === 'default') return;
    
    database.ref(`sessions/${currentSessionId}/meta/lastActivity`).set(
        firebase.database.ServerValue.TIMESTAMP
    );
}

/**
 * Check if room is expired and clean up if necessary
 * @returns {Promise<boolean>} True if room was cleaned/is fresh, false on error
 */
async function checkAndCleanupRoom() {
    if (!database || currentSessionId === 'default') return true;
    
    try {
        const metaRef = database.ref(`sessions/${currentSessionId}/meta`);
        const snapshot = await metaRef.once('value');
        const meta = snapshot.val();
        
        // If no meta or no lastActivity, this is a new room
        if (!meta || !meta.lastActivity) {
            console.log('[Firebase] New room, setting initial activity');
            await metaRef.set({
                lastActivity: firebase.database.ServerValue.TIMESTAMP,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            return true;
        }
        
        // Check if room is expired
        const now = Date.now();
        const lastActivity = meta.lastActivity;
        const timeSinceActivity = now - lastActivity;
        
        if (timeSinceActivity > ROOM_INACTIVITY_TIMEOUT) {
            console.log(`[Firebase] Room expired (inactive for ${Math.round(timeSinceActivity / (1000 * 60 * 60))}h), cleaning up...`);
            
            // Delete all room data
            await database.ref(`sessions/${currentSessionId}`).remove();
            
            // Create fresh room
            await metaRef.set({
                lastActivity: firebase.database.ServerValue.TIMESTAMP,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('[Firebase] Room recycled successfully');
            return true;
        }
        
        // Room is still active, update activity
        console.log(`[Firebase] Room still active (last activity ${Math.round(timeSinceActivity / (1000 * 60 * 60))}h ago)`);
        updateRoomActivity();
        return true;
        
    } catch (error) {
        console.error('[Firebase] Room cleanup check failed:', error);
        return false;
    }
}


// ===== PLAYER ONLINE STATUS =====

/**
 * Join session and mark player as online
 */
function joinSession() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user || !database) return;
    
    onlineStatusRef = getRef(`players/${sanitizeKey(user.username)}`);
    
    // Check if player already exists (to preserve joinedAt)
    onlineStatusRef.once('value').then(snapshot => {
        const existingData = snapshot.val();
        const playerData = getPlayerData();
        
        // Preserve original joinedAt or set new one
        playerData.joinedAt = existingData?.joinedAt || firebase.database.ServerValue.TIMESTAMP;
        
        // Set player data
        onlineStatusRef.set(playerData);
        
        // Remove on disconnect
        onlineStatusRef.onDisconnect().remove();
        
        // Listen for changes to own player data (GM can change color, GM status, or kick)
        listenForOwnPlayerChanges(user.username);
        
        console.log(`[Firebase] Player joined: ${user.username}`);
    });
}

/**
 * Listen for changes to own player data made by GM
 * Listens for color, GM status changes, and kick flag
 */
function listenForOwnPlayerChanges(username) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user || !database) return;
    
    const playerRef = getRef(`players/${sanitizeKey(username)}`);
    let loadCount = 0;
    
    console.log('[Firebase] Starting player change listener for:', username);
    
    playerRef.on('value', (snapshot) => {
        const playerData = snapshot.val();
        loadCount++;
        
        console.log('[Firebase] Player data received (load #' + loadCount + '):', playerData ? 'exists' : 'null');
        
        // Skip first 2 loads to avoid race conditions
        if (loadCount <= 2) {
            console.log('[Firebase] Initial load #' + loadCount + ', skipping');
            return;
        }
        
        // Check if we've been kicked (kicked flag set)
        if (playerData && playerData.kicked === true) {
            console.log('[Firebase] Player was kicked from room!');
            alert(t('room.kicked'));
            localStorage.removeItem('pnp_companion_user');
            localStorage.removeItem('pnp_companion_room');
            window.location.href = 'login.html';
            return;
        }
        
        // Ignore null - player data might be temporarily unavailable
        if (playerData === null) {
            console.log('[Firebase] Player data is null, ignoring');
            return;
        }
        
        // Check if GM changed our data
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser) return;
        
        console.log('[Firebase] Comparing - Firebase:', playerData.color, playerData.isGM, 'Local:', currentUser.color, currentUser.isGM);
        
        let needsUpdate = false;
        const updates = {};
        
        // Check color change
        if (playerData.color && playerData.color !== currentUser.color) {
            console.log('[Firebase] Color changed by GM:', playerData.color);
            updates.color = playerData.color;
            needsUpdate = true;
        }
        
        // Check GM status change
        const currentIsGM = currentUser.isGM === true || currentUser.isGM === 'true';
        const newIsGM = playerData.isGM === true || playerData.isGM === 'true';
        if (newIsGM !== currentIsGM) {
            console.log('[Firebase] GM status changed by GM:', playerData.isGM);
            updates.isGM = playerData.isGM;
            needsUpdate = true;
        }
        
        // Apply updates to localStorage
        if (needsUpdate) {
            const updatedUser = { ...currentUser, ...updates };
            localStorage.setItem('pnp_companion_user', JSON.stringify(updatedUser));
            console.log('[Firebase] Updated local user data:', updates);
            
            // Reload page to apply changes
            window.location.reload();
        }
    });
}

/**
 * Leave session and mark player as offline
 */
function leaveSession() {
    if (onlineStatusRef) {
        onlineStatusRef.remove();
        onlineStatusRef = null;
    }
}

/**
 * Listen for player changes
 * @param {Function} callback - Called with players object
 * @returns {Function} Unsubscribe function
 */
function onPlayersChange(callback) {
    if (!database) return () => {};
    
    const ref = getRef('players');
    const handler = ref.on('value', (snapshot) => {
        const players = snapshot.val() || {};
        callback(players);
    });
    
    return () => ref.off('value', handler);
}


// ===== CHAT =====

/**
 * Send a chat message
 * @param {Object} message - Message object
 * @returns {Promise<string>} Message ID
 */
async function sendChatMessage(message) {
    if (!database) {
        console.warn('[Firebase] Not connected, message not sent');
        return null;
    }
    
    const ref = getRef('chat').push();
    const messageData = {
        ...message,
        id: ref.key,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    await ref.set(messageData);
    updateRoomActivity();
    return ref.key;
}

/**
 * Listen for new chat messages
 * @param {Function} callback - Called with message object
 * @param {number} limit - Max messages to fetch initially
 * @returns {Function} Unsubscribe function
 */
function onChatMessage(callback, limit = 50) {
    if (!database) return () => {};
    
    const ref = getRef('chat').orderByChild('timestamp').limitToLast(limit);
    
    // Listen for new messages
    const handler = ref.on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (message) {
            callback(message);
        }
    });
    
    return () => ref.off('child_added', handler);
}

/**
 * Clear all chat messages
 */
async function clearChatMessages() {
    if (!database) return;
    await getRef('chat').remove();
}

/**
 * Edit a chat message
 * @param {string} messageId - Message ID
 * @param {string} newText - New message text
 */
async function editChatMessage(messageId, newText) {
    if (!database || !messageId) return;
    
    await getRef(`chat/${messageId}`).update({
        text: newText,
        edited: true,
        editedAt: firebase.database.ServerValue.TIMESTAMP
    });
}

/**
 * Delete a chat message
 * @param {string} messageId - Message ID
 */
async function deleteChatMessage(messageId) {
    if (!database || !messageId) return;
    
    await getRef(`chat/${messageId}`).remove();
}


// ===== DICE ROLLS =====

/**
 * Send a dice roll
 * @param {Object} roll - Roll data
 * @returns {Promise<string>} Roll ID
 */
async function sendDiceRoll(roll) {
    if (!database) return null;
    
    const ref = getRef('dice').push();
    const rollData = {
        ...roll,
        id: ref.key,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    await ref.set(rollData);
    updateRoomActivity();
    
    // Auto-cleanup old rolls (keep last 20)
    const snapshot = await getRef('dice').orderByChild('timestamp').once('value');
    const rolls = [];
    snapshot.forEach(child => rolls.push(child.key));
    if (rolls.length > 20) {
        const toDelete = rolls.slice(0, rolls.length - 20);
        toDelete.forEach(key => getRef(`dice/${key}`).remove());
    }
    
    return ref.key;
}

/**
 * Listen for dice rolls
 * @param {Function} callback - Called with roll object
 * @returns {Function} Unsubscribe function
 */
function onDiceRoll(callback) {
    if (!database) return () => {};
    
    const ref = getRef('dice').orderByChild('timestamp').limitToLast(10);
    
    const handler = ref.on('child_added', (snapshot) => {
        const roll = snapshot.val();
        if (roll) {
            callback(roll);
        }
    });
    
    return () => ref.off('child_added', handler);
}


// ===== WHITEBOARD =====

/**
 * Save whiteboard state
 * @param {Object} state - Whiteboard state
 */
async function saveWhiteboardState(state) {
    if (!database) return;
    
    await getRef('whiteboard').set({
        ...state,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
    updateRoomActivity();
}

/**
 * Listen for whiteboard changes
 * @param {Function} callback - Called with whiteboard state
 * @returns {Function} Unsubscribe function
 */
function onWhiteboardChange(callback) {
    if (!database) return () => {};
    
    const ref = getRef('whiteboard');
    
    const handler = ref.on('value', (snapshot) => {
        const state = snapshot.val();
        if (state) {
            callback(state);
        }
    });
    
    return () => ref.off('value', handler);
}


// ===== MAP MARKERS =====

/**
 * Listen for marker changes
 * @param {Function} callback - Called with markers array
 * @returns {Function} Unsubscribe function
 */
function onMarkersChange(callback) {
    if (!database) return () => {};
    
    const ref = getRef('map/markers');
    
    const handler = ref.on('value', (snapshot) => {
        const markers = snapshot.val();
        if (markers) {
            // Convert object to array if needed
            const markersArray = Array.isArray(markers) ? markers : Object.values(markers);
            callback(markersArray);
        }
    });
    
    return () => ref.off('value', handler);
}

/**
 * Sync markers to Firebase
 * @param {Array} markers - Array of marker objects
 */
function syncMapMarkers(markers) {
    if (!database) return;
    
    const ref = getRef('map/markers');
    ref.set(markers);
}


// ===== UTILITIES =====

/**
 * Sanitize string for use as Firebase key
 * @param {string} str 
 * @returns {string}
 */
function sanitizeKey(str) {
    return str.replace(/[.#$\/\[\]]/g, '_');
}

/**
 * Check if Firebase is connected
 * @returns {boolean}
 */
function isFirebaseOnline() {
    return isOnline;
}

/**
 * Get current session ID
 * @returns {string}
 */
function getCurrentSessionId() {
    return currentSessionId;
}


// ===== CLEANUP =====

// Leave session on page unload
window.addEventListener('beforeunload', () => {
    leaveSession();
});


// ===== DICE ROLL POPUP FOR OTHER MODULES =====

let dicePopupEnabled = true;
let processedPopupRolls = new Set();

/**
 * Initialize dice roll popup listener for non-dice modules
 * Call this on modules that should show dice popups
 */
let dicePopupListenerInitialized = false;

function initDicePopupListener() {
    // Don't show popups on dice module itself
    if (window.location.pathname.includes('wuerfel')) {
        dicePopupEnabled = false;
        return;
    }
    
    // Wait for database to be ready
    if (!database) {
        console.log('[Firebase] Waiting for database to init dice popup listener...');
        setTimeout(initDicePopupListener, 500);
        return;
    }
    
    console.log('[Firebase] Dice popup listener started');
    dicePopupListenerInitialized = false;
    
    const ref = getRef('dice').orderByChild('timestamp').limitToLast(1);
    
    ref.on('child_added', (snapshot) => {
        const roll = snapshot.val();
        const rollId = snapshot.key;
        if (!roll) return;
        
        // Skip already processed
        if (processedPopupRolls.has(rollId)) return;
        processedPopupRolls.add(rollId);
        
        // On first load, skip showing popup (just mark as seen)
        if (!dicePopupListenerInitialized) {
            dicePopupListenerInitialized = true;
            return;
        }
        
        // Skip old rolls (more than 5 seconds ago)
        if (roll.timestamp && Date.now() - roll.timestamp > 5000) return;
        
        // Skip own rolls
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        
        // Skip if user is not logged in (e.g., on login page after being kicked)
        if (!user) {
            console.log('[Firebase] Skipping dice popup - no user logged in');
            return;
        }
        
        if (roll.player === user?.username) return;
        
        console.log('[Firebase] Showing dice popup for:', roll.player);
        showDicePopup(roll);
    });
}

/**
 * Global listener for dice being cleared by GM
 * Clears localStorage on all pages, not just wuerfel.html
 */
function initGlobalDiceClearListener() {
    if (!database) return;
    
    getRef('dice').on('value', (snapshot) => {
        const dice = snapshot.val();
        // If dice node is null/empty, clear local history too
        if (dice === null) {
            const hadHistory = localStorage.getItem('rumRacheHistory');
            if (hadHistory) {
                console.log('[Firebase] Dice cleared by GM, clearing local history');
                localStorage.removeItem('rumRacheHistory');
            }
        }
    });
}

/**
 * Initialize global timer listener
 * Shows timer display above FABs on all pages
 */
let globalTimerInterval = null;
let lastExpiredTimerId = null; // Track which timer we already played sound for

function initGlobalTimerListener() {
    if (!database) return;
    
    // Don't show on GM Options (they have their own display)
    if (window.location.pathname.includes('gm-options')) return;
    
    console.log('[Firebase] Global timer listener started');
    
    getRef('timer').on('value', (snapshot) => {
        const timer = snapshot.val();
        updateGlobalTimerDisplay(timer);
    });
}

function updateGlobalTimerDisplay(timer) {
    // Clear existing interval
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
        globalTimerInterval = null;
    }
    
    let timerBox = document.getElementById('globalTimerBox');
    
    // No active timer - hide box and reset tracking
    if (!timer || !timer.active) {
        if (timerBox) {
            timerBox.style.display = 'none';
        }
        lastExpiredTimerId = null;
        return;
    }
    
    // Create unique ID for this timer instance
    const timerId = timer.startedAt || timer.endTime;
    
    // Create timer box if not exists
    if (!timerBox) {
        timerBox = createGlobalTimerBox();
    }
    
    const valueEl = timerBox.querySelector('.global-timer-value');
    
    // Timer is paused
    if (timer.paused) {
        timerBox.style.display = 'flex';
        timerBox.classList.remove('running', 'expired');
        timerBox.classList.add('paused');
        valueEl.textContent = formatTimerTime(timer.remainingMs || 0);
        return;
    }
    
    // Check if timer already expired (e.g., page reload after expiry)
    const now = Date.now();
    const remaining = timer.endTime - now;
    
    if (remaining <= 0) {
        // Timer already expired - just hide it, don't play sound
        console.log('[Timer] Already expired on load, hiding without sound');
        timerBox.style.display = 'none';
        timerBox.classList.remove('running', 'paused', 'expired');
        // Clean up Firebase silently
        if (typeof getRef === 'function') {
            getRef('timer').remove();
        }
        return;
    }
    
    // Timer is running - show it
    timerBox.style.display = 'flex';
    timerBox.classList.remove('paused', 'expired');
    timerBox.classList.add('running');
    
    const updateCountdown = () => {
        const now = Date.now();
        const remaining = timer.endTime - now;
        
        if (remaining <= 0) {
            clearInterval(globalTimerInterval);
            globalTimerInterval = null;
            valueEl.textContent = '00:00';
            timerBox.classList.remove('running');
            timerBox.classList.add('expired');
            
            // Only play sound and effect if we haven't already for this timer
            if (lastExpiredTimerId !== timerId) {
                lastExpiredTimerId = timerId;
                playTimerEndSound();
                createTimerExpiredEffect();
            }
            
            // Remove timer from Firebase after expiry
            if (typeof getRef === 'function') {
                setTimeout(() => {
                    getRef('timer').remove();
                    console.log('[Timer] Removed from Firebase after expiry');
                }, 100);
            }
            
            // Hide after 5 seconds
            setTimeout(() => {
                if (timerBox && timerBox.classList.contains('expired')) {
                    timerBox.style.display = 'none';
                    timerBox.classList.remove('expired');
                }
            }, 5000);
            return;
        }
        
        valueEl.textContent = formatTimerTime(remaining);
    };
    
    updateCountdown();
    globalTimerInterval = setInterval(updateCountdown, 100);
}

function formatTimerTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createGlobalTimerBox() {
    const box = document.createElement('div');
    box.id = 'globalTimerBox';
    box.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="global-timer-value">00:00</span>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.id = 'globalTimerStyles';
    
    // Check if we're on chat page (needs more space for input)
    const isChat = window.location.pathname.includes('chat');
    
    style.textContent = `
        #globalTimerBox {
            position: fixed;
            bottom: ${isChat ? '152px' : '140px'};
            right: 24px;
            z-index: 999;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 4px;
            font-family: 'Roboto Mono', 'Roboto', sans-serif;
        }
        
        #globalTimerBox svg {
            width: 14px;
            height: 14px;
            color: var(--md-primary, #6750a4);
            margin-bottom: 2px;
            filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
        }
        
        .global-timer-value {
            font-size: 11px;
            font-weight: 600;
            color: var(--md-on-surface, #e6e1e5);
            text-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        
        #globalTimerBox.running svg {
            color: #4CAF50;
        }
        
        #globalTimerBox.running .global-timer-value {
            color: #4CAF50;
        }
        
        #globalTimerBox.paused svg {
            color: #FF9800;
        }
        
        #globalTimerBox.paused .global-timer-value {
            color: #FF9800;
        }
        
        #globalTimerBox.expired {
            animation: timerExpiredBlink 0.5s ease infinite;
        }
        
        #globalTimerBox.expired svg {
            color: #f44336;
        }
        
        #globalTimerBox.expired .global-timer-value {
            color: #f44336;
        }
        
        @keyframes timerExpiredBlink {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.02); }
        }
        
        @media (max-width: 600px) {
            #globalTimerBox {
                bottom: ${isChat ? '180px' : '122px'};
                right: 16px;
            }
            
            #globalTimerBox svg {
                width: 12px;
                height: 12px;
            }
            
            .global-timer-value {
                font-size: 10px;
            }
        }
    `;
    
    // Remove old styles and add new ones (to handle dynamic chat detection)
    const oldStyle = document.getElementById('globalTimerStyles');
    if (oldStyle) {
        oldStyle.remove();
    }
    document.head.appendChild(style);
    
    document.body.appendChild(box);
    return box;
}

function playTimerEndSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Play a sequence of beeps
        const playBeep = (time, freq) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + time);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime + time);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime + time + 0.15);
            
            osc.start(audioCtx.currentTime + time);
            osc.stop(audioCtx.currentTime + time + 0.15);
        };
        
        // Play 3 rounds of beeps (3 beeps each round)
        for (let round = 0; round < 3; round++) {
            const offset = round * 0.8; // 0.8 seconds between rounds
            playBeep(offset + 0, 880);
            playBeep(offset + 0.2, 880);
            playBeep(offset + 0.4, 1100);
        }
        
    } catch (e) {
        console.log('[Timer] Could not play sound:', e);
    }
}

/**
 * Create dramatic timer expired effect
 */
function createTimerExpiredEffect() {
    // Inject styles if needed
    if (!document.getElementById('timerExpiredStyles')) {
        const style = document.createElement('style');
        style.id = 'timerExpiredStyles';
        style.textContent = `
            .timer-expired-overlay {
                position: fixed;
                inset: 0;
                background: radial-gradient(circle at center, rgba(244, 67, 54, 0.3) 0%, transparent 70%);
                z-index: 9998;
                pointer-events: none;
                animation: timerExpiredFlash 2s ease-out forwards;
            }
            
            @keyframes timerExpiredFlash {
                0% { opacity: 0; }
                10% { opacity: 1; }
                20% { opacity: 0.5; }
                30% { opacity: 1; }
                40% { opacity: 0.5; }
                50% { opacity: 0.8; }
                100% { opacity: 0; }
            }
            
            .timer-expired-ring {
                position: fixed;
                top: 50%;
                left: 50%;
                width: 100px;
                height: 100px;
                border: 4px solid #f44336;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                z-index: 9999;
                pointer-events: none;
                animation: timerExpiredRing 1.5s ease-out forwards;
            }
            
            @keyframes timerExpiredRing {
                0% {
                    transform: translate(-50%, -50%) scale(0.5);
                    opacity: 1;
                    border-width: 8px;
                }
                100% {
                    transform: translate(-50%, -50%) scale(4);
                    opacity: 0;
                    border-width: 1px;
                }
            }
            
            .timer-expired-text {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.5);
                font-size: 48px;
                font-weight: 700;
                color: #f44336;
                text-shadow: 0 0 20px rgba(244, 67, 54, 0.8);
                z-index: 10000;
                pointer-events: none;
                animation: timerExpiredText 2s ease-out forwards;
            }
            
            @keyframes timerExpiredText {
                0% {
                    transform: translate(-50%, -50%) scale(0.5);
                    opacity: 0;
                }
                20% {
                    transform: translate(-50%, -50%) scale(1.2);
                    opacity: 1;
                }
                40% {
                    transform: translate(-50%, -50%) scale(1);
                }
                100% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 0;
                }
            }
            
            @media (max-width: 600px) {
                .timer-expired-text {
                    font-size: 32px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Create overlay flash
    const overlay = document.createElement('div');
    overlay.className = 'timer-expired-overlay';
    document.body.appendChild(overlay);
    
    // Create expanding ring
    const ring = document.createElement('div');
    ring.className = 'timer-expired-ring';
    document.body.appendChild(ring);
    
    // Create "ENDE!" text
    const text = document.createElement('div');
    text.className = 'timer-expired-text';
    text.textContent = 'ENDE!';
    document.body.appendChild(text);
    
    // Remove elements after animation
    setTimeout(() => {
        overlay.remove();
        ring.remove();
        text.remove();
    }, 2500);
}


// ===== PAUSE SCREEN FEATURE =====

/**
 * Initialize global pause listener
 * Shows pause overlay on all devices when GM activates pause
 */
function initPauseListener() {
    if (!database) return;
    
    console.log('[Firebase] Pause listener started');
    
    getRef('pause').on('value', (snapshot) => {
        const pause = snapshot.val();
        updatePauseOverlay(pause);
    });
}

/**
 * Update pause overlay based on Firebase state
 */
function updatePauseOverlay(pause) {
    let overlay = document.getElementById('pauseOverlay');
    
    // Not paused - remove overlay
    if (!pause || !pause.active) {
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
        return;
    }
    
    // GM Bypass active - don't show overlay for GM
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const gmBypassActive = localStorage.getItem('gmPauseBypass') === 'true';
    
    if (user?.isGM && gmBypassActive) {
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
        return;
    }
    
    // Paused - create overlay if not exists
    if (!overlay) {
        overlay = createPauseOverlay();
    }
    
    // Update GM controls visibility
    const gmControls = overlay.querySelector('.pause-gm-controls');
    if (gmControls) {
        gmControls.style.display = user?.isGM ? 'flex' : 'none';
    }
    
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });
}

/**
 * Create pause overlay element
 */
function createPauseOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'pauseOverlay';
    
    overlay.innerHTML = `
        <div class="pause-particles" id="pauseParticles"></div>
        <div class="pause-content">
            <div class="pause-logo-container">
                <div class="pause-ripple"></div>
                <div class="pause-ripple delay-1"></div>
                <div class="pause-ripple delay-2"></div>
                <img src="assets/images/logo_rift_emblem_white.png" alt="RIFT" class="pause-logo">
            </div>
            <div class="pause-text">${t('pause.message')}</div>
            <div class="pause-gm-controls">
                <button class="pause-resume-btn" onclick="resumeGame()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    ${t('pause.resume')}
                </button>
                <button class="pause-bypass-btn" onclick="bypassPause()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    ${t('gm.bypass_pause')}
                </button>
            </div>
        </div>
    `;
    
    // Inject styles
    if (!document.getElementById('pauseOverlayStyles')) {
        const style = document.createElement('style');
        style.id = 'pauseOverlayStyles';
        style.textContent = `
            #pauseOverlay {
                position: fixed;
                inset: 0;
                background: rgba(19, 18, 21, 0.92);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 300ms ease;
                overflow: hidden;
            }
            
            .pause-particles {
                position: absolute;
                inset: 0;
                pointer-events: none;
                overflow: hidden;
            }
            
            .pause-particle {
                position: absolute;
                background: #6750a4;
                border-radius: 50%;
                opacity: 0;
                animation: pauseFloat linear infinite;
                box-shadow: 0 0 6px #6750a4;
            }
            
            @keyframes pauseFloat {
                0% {
                    opacity: 0;
                    transform: translateY(100vh) scale(0.5);
                }
                15% {
                    opacity: 0.6;
                }
                85% {
                    opacity: 0.6;
                }
                100% {
                    opacity: 0;
                    transform: translateY(-100px) scale(1);
                }
            }
            
            .pause-content {
                text-align: center;
                color: white;
                position: relative;
                z-index: 1;
            }
            
            .pause-logo-container {
                position: relative;
                width: 200px;
                height: 200px;
                margin: 0 auto 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .pause-logo {
                width: 100px;
                height: 100px;
                object-fit: contain;
                filter: brightness(0) saturate(100%) invert(36%) sepia(60%) saturate(1352%) hue-rotate(224deg) brightness(87%) contrast(91%);
                animation: pausePulse 2s ease-in-out infinite;
                position: relative;
                z-index: 2;
            }
            
            @keyframes pausePulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.08); opacity: 0.85; }
            }
            
            .pause-ripple {
                position: absolute;
                width: 100px;
                height: 100px;
                border: 2px solid #6750a4;
                border-radius: 50%;
                animation: pauseRipple 4s ease-out infinite;
            }
            
            .pause-ripple.delay-1 {
                animation-delay: 1.3s;
            }
            
            .pause-ripple.delay-2 {
                animation-delay: 2.6s;
            }
            
            @keyframes pauseRipple {
                0% {
                    transform: scale(1);
                    opacity: 0.5;
                }
                100% {
                    transform: scale(3);
                    opacity: 0;
                }
            }
            
            .pause-text {
                font-size: 22px;
                font-weight: 500;
                letter-spacing: 2px;
                opacity: 0.9;
                margin-bottom: 40px;
            }
            
            .pause-gm-controls {
                display: none;
                flex-direction: column;
                align-items: center;
            }
            
            .pause-resume-btn {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 14px 32px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 200ms ease;
            }
            
            .pause-resume-btn:hover {
                background: #43A047;
                transform: scale(1.05);
            }
            
            .pause-resume-btn svg {
                width: 24px;
                height: 24px;
            }
            
            .pause-bypass-btn {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 14px 32px;
                margin-top: 12px;
                background: #FF9800;
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: all 200ms ease;
            }
            
            .pause-bypass-btn:hover {
                background: #F57C00;
                transform: scale(1.05);
            }
            
            .pause-bypass-btn svg {
                width: 24px;
                height: 24px;
            }
            
            @media (max-width: 600px) {
                .pause-logo-container {
                    width: 160px;
                    height: 160px;
                    margin-bottom: 24px;
                }
                
                .pause-logo {
                    width: 80px;
                    height: 80px;
                }
                
                .pause-ripple {
                    width: 80px;
                    height: 80px;
                }
                
                .pause-text {
                    font-size: 18px;
                    letter-spacing: 1px;
                }
                
                .pause-resume-btn {
                    padding: 12px 24px;
                    font-size: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(overlay);
    
    // Create particles
    createPauseParticles();
    
    return overlay;
}

/**
 * Create floating particles for pause overlay
 */
function createPauseParticles() {
    const container = document.getElementById('pauseParticles');
    if (!container) return;
    
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'pause-particle';
        
        particle.style.left = Math.random() * 100 + '%';
        
        const size = 2 + Math.random() * 4;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        const duration = 15 + Math.random() * 20;
        const delay = Math.random() * 15;
        particle.style.animationDuration = duration + 's';
        particle.style.animationDelay = delay + 's';
        
        container.appendChild(particle);
    }
}

/**
 * Resume game (GM only) - called from overlay button
 */
window.resumeGame = async function() {
    if (!database) return;
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user?.isGM) return;
    
    await getRef('pause').remove();
    localStorage.removeItem('gmPauseBypass');
    console.log('[Pause] Game resumed by GM');
};

/**
 * Bypass pause overlay (GM only) - keeps pause active but allows GM to navigate
 */
window.bypassPause = function() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user?.isGM) return;
    
    localStorage.setItem('gmPauseBypass', 'true');
    
    // Remove overlay
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
    
    console.log('[Pause] GM bypass activated - can navigate while paused');
};

/**
 * Pause game (GM only) - called from GM Options
 */
window.pauseGame = async function() {
    if (!database) return;
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user?.isGM) return;
    
    await getRef('pause').set({
        active: true,
        pausedBy: user.username,
        pausedAt: firebase.database.ServerValue.TIMESTAMP
    });
    console.log('[Pause] Game paused by GM');
};


// ===== ATMOSPHERE SYSTEM =====

let currentAtmosphere = 'off';
let atmosphereParticleInterval = null;
let atmosphereStartTime = 0;
let atmosphereListenerInitialized = false;

const ATMOSPHERE_CONFIG = {
    off: null,
    danger: {
        color: '#f44336',
        colorAlt: '#ff1744',
        particles: 'embers',
        particleCount: 15
    },
    creepy: {
        color: '#9c27b0',
        colorAlt: '#7b1fa2',
        particles: 'fog',
        particleCount: 12
    },
    safe: {
        color: '#4CAF50',
        colorAlt: '#66BB6A',
        particles: 'embers',
        particleCount: 15
    },
    rest: {
        color: '#FFB300',
        colorAlt: '#FFA000',
        particles: 'sparks',
        particleCount: 25
    },
    cold: {
        color: '#00BCD4',
        colorAlt: '#0288D1',
        particles: 'snow',
        particleCount: 25
    },
    mystic: {
        color: '#7C4DFF',
        colorAlt: '#536DFE',
        particles: 'runes',
        particleCount: 10
    },
    holy: {
        color: '#FFF8E1',
        colorAlt: '#FFD54F',
        particles: 'light',
        particleCount: 18
    },
    heat: {
        color: '#FF5722',
        colorAlt: '#FF9800',
        particles: 'heat',
        particleCount: 18
    }
};

/**
 * Initialize atmosphere listener
 */
function initAtmosphereListener() {
    if (!database) return;
    
    // Prevent double initialization (important for SPA)
    if (atmosphereListenerInitialized) {
        console.log('[Atmosphere] Listener already initialized, skipping');
        return;
    }
    atmosphereListenerInitialized = true;
    
    getRef('atmosphere').on('value', (snapshot) => {
        const data = snapshot.val();
        let atmo = 'off';
        let startTime = Date.now();
        
        if (typeof data === 'object' && data !== null) {
            atmo = data.type || 'off';
            startTime = data.startedAt || Date.now();
        } else if (typeof data === 'string') {
            atmo = data;
        }
        
        const previousAtmo = currentAtmosphere;
        currentAtmosphere = atmo;
        atmosphereStartTime = startTime;
        updateAtmosphereOverlay(atmo, previousAtmo, startTime);
    });
}

/**
 * Update atmosphere overlay
 */
function updateAtmosphereOverlay(atmo, previousAtmo, startTime) {
    let overlay = document.getElementById('atmosphereOverlay');
    const config = ATMOSPHERE_CONFIG[atmo];
    
    // Clear existing particles
    if (atmosphereParticleInterval) {
        clearInterval(atmosphereParticleInterval);
        atmosphereParticleInterval = null;
    }
    
    // Remove if off
    if (!config) {
        if (overlay) {
            overlay.classList.add('fading-out');
            setTimeout(() => overlay.remove(), 150);
        }
        return;
    }
    
    // Create if doesn't exist
    if (!overlay) {
        overlay = createAtmosphereOverlay();
    }
    
    // Clear previous classes and particles
    overlay.className = 'atmosphere-overlay';
    const particleContainer = overlay.querySelector('.atmo-particles');
    if (particleContainer) particleContainer.innerHTML = '';
    
    // Calculate animation offset for sync across page loads
    const elapsed = (Date.now() - startTime) / 1000;
    const animOffset = `-${elapsed}s`;
    
    // Apply new atmosphere
    requestAnimationFrame(() => {
        overlay.classList.add(`atmo-${atmo}`);
        overlay.style.setProperty('--atmo-color', config.color);
        overlay.style.setProperty('--atmo-color-alt', config.colorAlt);
        overlay.style.setProperty('--atmo-offset', animOffset);
        
        // Start particles
        startAtmosphereParticles(atmo, config);
    });
}

/**
 * Create atmosphere overlay element
 */
function createAtmosphereOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'atmosphereOverlay';
    overlay.className = 'atmosphere-overlay';
    
    overlay.innerHTML = `
        <div class="atmo-vignette"></div>
        <div class="atmo-frost"></div>
        <div class="atmo-fog-layer"></div>
        <div class="atmo-shimmer"></div>
        <div class="atmo-particles"></div>
        <div class="atmo-breath"></div>
    `;
    
    // Inject styles
    if (!document.getElementById('atmosphereStyles')) {
        const style = document.createElement('style');
        style.id = 'atmosphereStyles';
        style.textContent = `
            /* ===== BASE OVERLAY ===== */
            .atmosphere-overlay {
                position: fixed;
                inset: 0;
                z-index: 99990;
                pointer-events: none;
                transition: opacity 150ms ease;
            }
            
            .atmosphere-overlay * {
                pointer-events: none;
            }
            
            .atmosphere-overlay.fading-out {
                opacity: 0;
            }
            
            /* ===== VIGNETTE ===== */
            .atmo-vignette {
                position: absolute;
                inset: 0;
                background: radial-gradient(ellipse at center, transparent 40%, var(--atmo-color) 150%);
                opacity: 0;
                transition: opacity 600ms ease;
            }
            
            /* ===== FROST EFFECT (Cold) ===== */
            .atmo-frost {
                position: absolute;
                inset: 0;
                opacity: 0;
                display: none;
                background: 
                    linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%),
                    linear-gradient(225deg, rgba(255,255,255,0.1) 0%, transparent 50%),
                    linear-gradient(45deg, rgba(255,255,255,0.05) 0%, transparent 30%),
                    linear-gradient(315deg, rgba(255,255,255,0.05) 0%, transparent 30%);
                mask-image: linear-gradient(to bottom, black 0%, transparent 15%, transparent 85%, black 100%),
                            linear-gradient(to right, black 0%, transparent 10%, transparent 90%, black 100%);
                mask-composite: intersect;
                -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 15%, transparent 85%, black 100%),
                                    linear-gradient(to right, black 0%, transparent 10%, transparent 90%, black 100%);
                -webkit-mask-composite: source-in;
            }
            
            /* ===== FOG LAYER (Creepy) ===== */
            .atmo-fog-layer {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 40%;
                opacity: 0;
                display: none;
                background: linear-gradient(to top, var(--atmo-color), transparent);
            }
            
            /* ===== PARTICLES CONTAINER ===== */
            .atmo-particles {
                position: absolute;
                inset: 0;
                overflow: hidden;
            }
            
            /* ===== BREATH EFFECT (Cold) ===== */
            .atmo-breath {
                position: absolute;
                bottom: 20%;
                left: 50%;
                transform: translateX(-50%);
                width: 100px;
                height: 60px;
                background: radial-gradient(ellipse, rgba(255,255,255,0.3) 0%, transparent 70%);
                opacity: 0;
                display: none;
                filter: blur(8px);
            }
            
            /* ========================================
               DANGER ATMOSPHERE
            ======================================== */
            .atmo-danger .atmo-vignette {
                opacity: 0.2;
                animation: dangerVignette 0.8s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-danger .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(244, 67, 54, 0.15), transparent);
                animation: ambientFog 10s ease-in-out infinite;
            }
            
            @keyframes dangerVignette {
                0%, 100% { opacity: 0.15; }
                50% { opacity: 0.25; }
            }
            
            /* Ember particles */
            .particle-ember {
                position: absolute;
                width: 4px;
                height: 4px;
                background: var(--atmo-color);
                border-radius: 50%;
                box-shadow: 0 0 6px var(--atmo-color), 0 0 10px var(--atmo-color-alt);
                animation: emberFloat linear forwards;
            }
            
            @keyframes emberFloat {
                0% { opacity: 0; transform: translateY(0) translateX(0) scale(1); }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { opacity: 0; transform: translateY(-100vh) translateX(var(--drift)) scale(0.5); }
            }
            
            /* ========================================
               CREEPY ATMOSPHERE
            ======================================== */
            .atmo-creepy .atmo-vignette {
                opacity: 0.15;
                animation: creepyVignette 4s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-creepy .atmo-fog-layer {
                display: block;
                animation: creepyFog 8s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            @keyframes creepyVignette {
                0%, 100% { opacity: 0.12; transform: scale(1); }
                30% { opacity: 0.2; transform: scale(1.03); }
                70% { opacity: 0.15; transform: scale(0.97); }
            }
            
            @keyframes creepyFog {
                0%, 100% { opacity: 0.2; transform: translateY(0); }
                50% { opacity: 0.35; transform: translateY(-10px); }
            }
            
            /* Ambient fog for all atmospheres */
            @keyframes ambientFog {
                0%, 100% { opacity: 0.12; transform: translateY(0); }
                50% { opacity: 0.2; transform: translateY(-5px); }
            }
            
            /* Fog particles */
            .particle-fog {
                position: absolute;
                bottom: 0;
                width: 250px;
                height: 120px;
                background: radial-gradient(ellipse, var(--atmo-color) 0%, transparent 70%);
                opacity: 0;
                filter: blur(25px);
                animation: fogDrift linear forwards;
            }
            
            @keyframes fogDrift {
                0% { opacity: 0; transform: translateX(-50px) translateY(20px); }
                20% { opacity: 0.4; }
                80% { opacity: 0.4; }
                100% { opacity: 0; transform: translateX(50px) translateY(-40px); }
            }
            
            /* ========================================
               SAFE ATMOSPHERE
            ======================================== */
            .atmo-safe .atmo-vignette {
                opacity: 0.1;
                animation: safeVignette 5s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-safe .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(76, 175, 80, 0.12), transparent);
                animation: ambientFog 12s ease-in-out infinite;
            }
            
            @keyframes safeVignette {
                0%, 100% { opacity: 0.08; }
                50% { opacity: 0.12; }
            }
            
            /* Safe ember particles (slower than danger) */
            .particle-safe-ember {
                position: absolute;
                width: 4px;
                height: 4px;
                background: var(--atmo-color);
                border-radius: 50%;
                box-shadow: 0 0 6px var(--atmo-color), 0 0 12px var(--atmo-color);
                animation: safeEmberFloat linear forwards;
            }
            
            @keyframes safeEmberFloat {
                0% { opacity: 0; transform: translateY(0) translateX(0) scale(1); }
                10% { opacity: 0.8; }
                90% { opacity: 0.6; }
                100% { opacity: 0; transform: translateY(-100vh) translateX(var(--drift)) scale(0.3); }
            }
            
            /* ========================================
               REST ATMOSPHERE
            ======================================== */
            .atmo-rest .atmo-vignette {
                opacity: 0.1;
                background: radial-gradient(ellipse at bottom center, var(--atmo-color) 0%, transparent 60%);
            }
            
            .atmo-rest .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(255, 179, 0, 0.1), transparent);
                animation: ambientFog 8s ease-in-out infinite;
            }
            
            .atmo-rest .atmo-shimmer {
                display: block;
                background: linear-gradient(to top, rgba(255, 179, 0, 0.06), transparent);
                height: 35%;
                animation: shimmerWave 0.15s linear infinite;
            }
            
            /* Spark particles */
            .particle-spark {
                position: absolute;
                bottom: 0;
                width: 3px;
                height: 3px;
                background: var(--atmo-color);
                border-radius: 50%;
                box-shadow: 0 0 4px var(--atmo-color), 0 0 8px var(--atmo-color-alt);
                animation: sparkRise linear forwards;
            }
            
            @keyframes sparkRise {
                0% { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
                60% { opacity: 0.8; }
                100% { opacity: 0; transform: translateY(var(--rise-height)) translateX(var(--drift)) scale(0.3); }
            }
            
            /* ========================================
               COLD ATMOSPHERE
            ======================================== */
            .atmo-cold .atmo-vignette {
                opacity: 0.18;
                background: radial-gradient(ellipse at center, transparent 30%, var(--atmo-color) 150%);
                animation: coldVignette 4s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-cold .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(0, 188, 212, 0.12), transparent);
                animation: ambientFog 10s ease-in-out infinite;
            }
            
            .atmo-cold .atmo-frost {
                display: block;
                animation: frostPulse 6s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-cold .atmo-breath {
                display: block;
                animation: breathCloud 4s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            @keyframes coldVignette {
                0%, 100% { opacity: 0.15; }
                50% { opacity: 0.22; }
            }
            
            @keyframes frostPulse {
                0%, 100% { opacity: 0.15; }
                50% { opacity: 0.25; }
            }
            
            @keyframes breathCloud {
                0%, 100% { opacity: 0; transform: translateX(-50%) scale(0.5); }
                15% { opacity: 0.4; transform: translateX(-50%) scale(1); }
                40% { opacity: 0.2; transform: translateX(-50%) translateY(-20px) scale(1.3); }
                60%, 100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(1.5); }
            }
            
            /* Snow particles */
            .particle-snow {
                position: absolute;
                top: -10px;
                background: white;
                border-radius: 50%;
                opacity: 0.8;
                box-shadow: 0 0 3px rgba(255,255,255,0.8);
                animation: snowFall linear forwards;
            }
            
            @keyframes snowFall {
                0% { transform: translateY(0) translateX(0) rotate(0deg); }
                100% { transform: translateY(calc(100vh + 20px)) translateX(var(--drift)) rotate(360deg); }
            }
            
            /* ========================================
               MYSTIC ATMOSPHERE
            ======================================== */
            .atmo-mystic .atmo-vignette {
                opacity: 0.15;
                background: radial-gradient(ellipse at center, transparent 20%, var(--atmo-color) 150%);
                animation: mysticVignette 4s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-mystic .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(124, 77, 255, 0.15), transparent);
                animation: ambientFog 12s ease-in-out infinite;
            }
            
            @keyframes mysticVignette {
                0%, 100% { opacity: 0.12; }
                50% { opacity: 0.2; }
            }
            
            /* Rune particles - base style */
            .particle-rune {
                position: absolute;
                width: 20px;
                height: 20px;
                opacity: 0;
                box-shadow: 0 0 10px var(--atmo-color), 0 0 20px var(--atmo-color-alt);
                animation: runeFloat ease-in-out infinite, runeGlow 2s ease-in-out infinite;
            }
            
            /* Rune variant 1: Diamond with cross */
            .particle-rune.rune-diamond {
                border: 2px solid var(--atmo-color);
                border-radius: 2px;
                transform: rotate(45deg);
            }
            .particle-rune.rune-diamond::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 60%;
                height: 2px;
                background: var(--atmo-color);
                transform: translate(-50%, -50%);
                box-shadow: 0 0 5px var(--atmo-color);
            }
            .particle-rune.rune-diamond::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 2px;
                height: 60%;
                background: var(--atmo-color);
                transform: translate(-50%, -50%);
                box-shadow: 0 0 5px var(--atmo-color);
            }
            
            /* Rune variant 2: Circle with dot */
            .particle-rune.rune-circle {
                border: 2px solid var(--atmo-color);
                border-radius: 50%;
            }
            .particle-rune.rune-circle::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 6px;
                height: 6px;
                background: var(--atmo-color);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                box-shadow: 0 0 8px var(--atmo-color);
            }
            
            /* Rune variant 3: Triangle */
            .particle-rune.rune-triangle {
                width: 0;
                height: 0;
                border-left: 10px solid transparent;
                border-right: 10px solid transparent;
                border-bottom: 18px solid var(--atmo-color);
                background: transparent;
                box-shadow: none;
                filter: drop-shadow(0 0 8px var(--atmo-color));
            }
            
            /* Rune variant 4: Star (asterisk) */
            .particle-rune.rune-star {
                border: none;
                background: transparent;
            }
            .particle-rune.rune-star::before {
                content: '✦';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 20px;
                color: var(--atmo-color);
                text-shadow: 0 0 10px var(--atmo-color);
            }
            
            /* Rune variant 5: Eye */
            .particle-rune.rune-eye {
                border: 2px solid var(--atmo-color);
                border-radius: 50% 10%;
                transform: rotate(0deg);
            }
            .particle-rune.rune-eye::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 8px;
                height: 8px;
                background: var(--atmo-color);
                border-radius: 50%;
                transform: translate(-50%, -50%);
            }
            
            /* Rune variant 6: Crescent */
            .particle-rune.rune-crescent {
                border: 3px solid var(--atmo-color);
                border-radius: 50%;
                border-right-color: transparent;
                border-bottom-color: transparent;
                background: transparent;
                transform: rotate(-45deg);
            }
            
            @keyframes runeFloat {
                0%, 100% { transform: translateY(0) translateX(0); }
                25% { transform: translateY(var(--drift-y)) translateX(calc(var(--drift-x) * 0.5)); }
                50% { transform: translateY(calc(var(--drift-y) * 0.5)) translateX(var(--drift-x)); }
                75% { transform: translateY(calc(var(--drift-y) * 0.7)) translateX(calc(var(--drift-x) * 0.3)); }
            }
            
            @keyframes runeGlow {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 0.7; }
            }
            
            /* ========================================
               HOLY ATMOSPHERE
            ======================================== */
            .atmo-holy .atmo-vignette {
                opacity: 0.1;
                background: radial-gradient(ellipse at top center, var(--atmo-color-alt) 0%, transparent 60%);
                animation: holyVignette 3s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-holy .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(255, 248, 225, 0.1), transparent);
                animation: ambientFog 10s ease-in-out infinite;
            }
            
            @keyframes holyVignette {
                0%, 100% { opacity: 0.08; }
                50% { opacity: 0.15; }
            }
            
            /* Light particles */
            .particle-light {
                position: absolute;
                top: -20px;
                width: 4px;
                height: 15px;
                background: linear-gradient(to bottom, var(--atmo-color), transparent);
                border-radius: 2px;
                opacity: 0;
                box-shadow: 0 0 10px var(--atmo-color), 0 0 20px var(--atmo-color-alt);
                animation: lightFall linear forwards;
            }
            
            @keyframes lightFall {
                0% { opacity: 0; transform: translateY(0) translateX(0); }
                10% { opacity: 0.9; }
                70% { opacity: 0.7; }
                100% { opacity: 0; transform: translateY(calc(100vh + 50px)) translateX(var(--drift)); }
            }
            
            /* ========================================
               HEAT ATMOSPHERE
            ======================================== */
            .atmo-heat .atmo-vignette {
                opacity: 0.12;
                background: radial-gradient(ellipse at bottom center, var(--atmo-color) 0%, transparent 50%);
                animation: heatVignette 2s ease-in-out infinite;
                animation-delay: var(--atmo-offset, 0s);
            }
            
            .atmo-heat .atmo-fog-layer {
                display: block;
                background: linear-gradient(to top, rgba(255, 87, 34, 0.12), transparent);
                animation: ambientFog 6s ease-in-out infinite;
            }
            
            @keyframes heatVignette {
                0%, 100% { opacity: 0.1; }
                50% { opacity: 0.18; }
            }
            
            /* Heat spark particles */
            .particle-heat {
                position: absolute;
                bottom: 0;
                width: 3px;
                height: 3px;
                background: var(--atmo-color);
                border-radius: 50%;
                box-shadow: 0 0 4px var(--atmo-color), 0 0 8px var(--atmo-color-alt);
                animation: heatRise linear forwards;
            }
            
            @keyframes heatRise {
                0% { opacity: 1; transform: translateY(0) translateX(0) scale(1); }
                60% { opacity: 0.7; }
                100% { opacity: 0; transform: translateY(var(--rise-height)) translateX(var(--drift)) scale(0.3); }
            }
            
            /* Heat shimmer effect */
            .atmo-heat .atmo-shimmer {
                display: block;
            }
            
            .atmo-shimmer {
                display: none;
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 40%;
                background: linear-gradient(to top, rgba(255,87,34,0.08), transparent);
                animation: shimmerWave 0.15s linear infinite;
                pointer-events: none;
            }
            
            @keyframes shimmerWave {
                0%, 100% { transform: translateX(0) scaleY(1); }
                25% { transform: translateX(2px) scaleY(1.01); }
                50% { transform: translateX(-1px) scaleY(0.99); }
                75% { transform: translateX(1px) scaleY(1.02); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Start atmosphere particles
 */
function startAtmosphereParticles(atmo, config) {
    const overlay = document.getElementById('atmosphereOverlay');
    if (!overlay) return;
    
    const container = overlay.querySelector('.atmo-particles');
    if (!container) return;
    
    // Create initial batch immediately (no stagger)
    for (let i = 0; i < config.particleCount; i++) {
        createParticle(atmo, container);
    }
    
    // Continue creating particles
    const interval = getParticleInterval(atmo);
    atmosphereParticleInterval = setInterval(() => {
        createParticle(atmo, container);
    }, interval);
    
    // Creepy: Add random flicker
    if (atmo === 'creepy') {
        startCreepyFlicker(overlay);
    }
}

/**
 * Get particle spawn interval based on atmosphere
 */
function getParticleInterval(atmo) {
    switch(atmo) {
        case 'danger': return 400;
        case 'creepy': return 1500;    // Mehr Nebel
        case 'safe': return 600;
        case 'rest': return 250;
        case 'cold': return 300;
        case 'mystic': return 2500;
        case 'holy': return 250;
        case 'heat': return 300;
        default: return 500;
    }
}

/**
 * Create a single particle based on atmosphere type
 */
function createParticle(atmo, container) {
    const particle = document.createElement('div');
    
    switch(atmo) {
        case 'danger':
            createEmberParticle(particle);
            break;
        case 'creepy':
            createFogParticle(particle);
            break;
        case 'safe':
            createSafeEmberParticle(particle);
            break;
        case 'rest':
            createSparkParticle(particle);
            break;
        case 'cold':
            createSnowParticle(particle);
            break;
        case 'mystic':
            createRuneParticle(particle);
            break;
        case 'holy':
            createLightParticle(particle);
            break;
        case 'heat':
            createHeatParticle(particle);
            break;
    }
    
    container.appendChild(particle);
    
    // Remove after animation
    let duration;
    if (atmo === 'mystic') {
        duration = 20000 + Math.random() * 10000; // 20-30 seconds for runes
    } else if (atmo === 'safe') {
        duration = 8000 + Math.random() * 4000; // 8-12 seconds for slow embers
    } else {
        duration = parseFloat(particle.style.animationDuration) * 1000 || 5000;
    }
    setTimeout(() => particle.remove(), duration);
}

/**
 * Create ember particle (Danger)
 */
function createEmberParticle(particle) {
    particle.className = 'particle-ember';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.bottom = '0';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 100 + 'px');
    particle.style.animationDuration = (3 + Math.random() * 2) + 's';
    particle.style.width = (3 + Math.random() * 3) + 'px';
    particle.style.height = particle.style.width;
}

/**
 * Create fog particle (Creepy)
 */
function createFogParticle(particle) {
    particle.className = 'particle-fog';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (5 + Math.random() * 4) + 's';
    particle.style.width = (180 + Math.random() * 180) + 'px';
    particle.style.height = (100 + Math.random() * 80) + 'px';
}

/**
 * Create safe ember particle (Safe) - slower rising embers
 */
function createSafeEmberParticle(particle) {
    particle.className = 'particle-safe-ember';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.bottom = '0';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 80 + 'px');
    particle.style.animationDuration = (6 + Math.random() * 4) + 's'; // Langsamer als danger (3-5s)
    const size = 3 + Math.random() * 3;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
}

/**
 * Create spark particle (Rest) - full width, much denser towards center
 */
function createSparkParticle(particle) {
    particle.className = 'particle-spark';
    
    // Strong center bias using multiple random values (Box-Muller-like)
    // More randoms = stronger bell curve towards center
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const r4 = Math.random();
    const centerBias = (r1 + r2 + r3 + r4) / 4; // Strong bias towards 0.5
    
    // Map to 10-90% range so particles stay visible, heavily centered
    const leftPos = 10 + centerBias * 80;
    
    particle.style.left = leftPos + '%';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 60 + 'px');
    particle.style.setProperty('--rise-height', -(200 + Math.random() * 400) + 'px'); // 200-600px hoch
    particle.style.animationDuration = (2 + Math.random() * 2.5) + 's';
    const size = 2 + Math.random() * 3;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
}

/**
 * Create snow particle (Cold)
 */
function createSnowParticle(particle) {
    particle.className = 'particle-snow';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 100 + 'px');
    particle.style.animationDuration = (5 + Math.random() * 5) + 's';
    const size = 2 + Math.random() * 4;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.opacity = 0.4 + Math.random() * 0.4;
}

/**
 * Create rune particle (Mystic) - various rune symbols
 */
function createRuneParticle(particle) {
    // Random rune variant
    const runeTypes = ['rune-diamond', 'rune-circle', 'rune-triangle', 'rune-star', 'rune-eye', 'rune-crescent'];
    const runeType = runeTypes[Math.floor(Math.random() * runeTypes.length)];
    
    particle.className = 'particle-rune ' + runeType;
    particle.style.left = 10 + Math.random() * 80 + '%';
    particle.style.top = 10 + Math.random() * 70 + '%';
    particle.style.setProperty('--drift-x', (Math.random() - 0.5) * 60 + 'px');
    particle.style.setProperty('--drift-y', (Math.random() - 0.5) * 60 + 'px');
    particle.style.animationDuration = (8 + Math.random() * 4) + 's, ' + (2 + Math.random() * 2) + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';
    const size = 15 + Math.random() * 15;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
}

/**
 * Create light particle (Holy)
 */
function createLightParticle(particle) {
    particle.className = 'particle-light';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 30 + 'px');
    particle.style.animationDuration = (2 + Math.random() * 2) + 's';
    const width = 2 + Math.random() * 4;
    const height = 10 + Math.random() * 20;
    particle.style.width = width + 'px';
    particle.style.height = height + 'px';
}

/**
 * Create heat particle (Heat) - similar to rest sparks
 */
function createHeatParticle(particle) {
    particle.className = 'particle-heat';
    
    // Gaussian-like distribution: more particles towards center
    const r1 = Math.random();
    const r2 = Math.random();
    const centerBias = (r1 + r2) / 2;
    const leftPos = centerBias * 100;
    
    particle.style.left = leftPos + '%';
    particle.style.setProperty('--drift', (Math.random() - 0.5) * 100 + 'px');
    particle.style.setProperty('--rise-height', -(150 + Math.random() * 300) + 'px');
    particle.style.animationDuration = (2 + Math.random() * 2) + 's';
    const size = 2 + Math.random() * 3;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
}

/**
 * Start creepy flicker effect
 */
function startCreepyFlicker(overlay) {
    const flicker = () => {
        if (currentAtmosphere !== 'creepy') return;
        
        const vignette = overlay.querySelector('.atmo-vignette');
        
        if (vignette) {
            // Quick flicker
            vignette.style.opacity = '0.3';
            
            setTimeout(() => {
                vignette.style.opacity = '';
            }, 100);
        }
        
        // Schedule next flicker (random 3-8 seconds)
        setTimeout(flicker, 3000 + Math.random() * 5000);
    };
    
    // Start after delay
    setTimeout(flicker, 2000 + Math.random() * 3000);
}

// Export for use
window.setAtmosphere = async function(atmo) {
    if (!database) return;
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user?.isGM) return;
    
    if (atmo === 'off') {
        await getRef('atmosphere').remove();
    } else {
        await getRef('atmosphere').set({
            type: atmo,
            startedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }
    console.log('[Atmosphere] Set to:', atmo);
};


// ===== PLAYER JOIN/LEAVE TOASTS =====

let knownPlayersForToast = new Set();
let playerToastInitialized = false;
let pendingLeaveToasts = new Map(); // Track pending leave toasts for debounce

/**
 * Initialize player join/leave toast notifications
 */
function initPlayerToastListener() {
    if (!database) return;
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    console.log('[Toast] Player toast listener started');
    
    // Inject toast styles
    injectPlayerToastStyles();
    
    getRef('players').on('value', (snapshot) => {
        const players = snapshot.val() || {};
        const currentPlayers = new Set(Object.keys(players));
        
        // First load - just populate known players
        if (!playerToastInitialized) {
            knownPlayersForToast = currentPlayers;
            playerToastInitialized = true;
            console.log('[Toast] Initial players:', [...currentPlayers]);
            return;
        }
        
        // Check for new players (joined)
        currentPlayers.forEach(playerKey => {
            if (!knownPlayersForToast.has(playerKey)) {
                const playerData = players[playerKey];
                if (playerData && playerData.username !== user.username) {
                    // Check if this player had a pending leave toast (module switch)
                    if (pendingLeaveToasts.has(playerKey)) {
                        // Cancel the leave toast - player just switched modules
                        clearTimeout(pendingLeaveToasts.get(playerKey));
                        pendingLeaveToasts.delete(playerKey);
                        console.log('[Toast] Cancelled leave toast for', playerKey, '- module switch detected');
                    } else {
                        // Genuine join
                        showPlayerToast(playerData.username, playerData.color, 'join');
                    }
                }
            }
        });
        
        // Check for removed players (left) - with delay to detect module switches
        knownPlayersForToast.forEach(playerKey => {
            if (!currentPlayers.has(playerKey)) {
                const playerName = playerKey.replace(/_/g, ' ');
                if (playerName !== user.username) {
                    // Set a delayed leave toast - will be cancelled if player rejoins quickly
                    const timeoutId = setTimeout(() => {
                        pendingLeaveToasts.delete(playerKey);
                        showPlayerToast(playerName, '#666', 'leave');
                    }, 3000); // 3 second delay
                    
                    pendingLeaveToasts.set(playerKey, timeoutId);
                }
            }
        });
        
        // Update known players
        knownPlayersForToast = currentPlayers;
    });
}

/**
 * Show player join/leave toast notification
 */
function showPlayerToast(username, color, type) {
    const isJoin = type === 'join';
    
    const toast = document.createElement('div');
    toast.className = `player-toast ${type}`;
    
    toast.innerHTML = `
        <div class="player-toast-avatar" style="background-color: ${color || '#6750a4'}">
            ${username.charAt(0).toUpperCase()}
        </div>
        <div class="player-toast-content">
            <span class="player-toast-name">${username}</span>
            <span class="player-toast-action">${isJoin ? t('toast.joined') : t('toast.left')}</span>
        </div>
        <div class="player-toast-icon">
            ${isJoin ? 
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' :
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>'
            }
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

/**
 * Inject player toast styles
 */
function injectPlayerToastStyles() {
    if (document.getElementById('playerToastStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'playerToastStyles';
    style.textContent = `
        .player-toast {
            position: fixed;
            top: 70px;
            left: 50%;
            transform: translateX(-50%) translateY(-100px);
            background: var(--md-surface-container-high, #2b2930);
            border-radius: 50px;
            padding: 8px 16px 8px 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            z-index: 10000;
            opacity: 0;
            transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .player-toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        
        .player-toast.join {
            border: 1px solid rgba(76, 175, 80, 0.3);
        }
        
        .player-toast.leave {
            border: 1px solid rgba(244, 67, 54, 0.3);
        }
        
        .player-toast-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
            color: white;
        }
        
        .player-toast-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .player-toast-name {
            font-weight: 600;
            font-size: 14px;
            color: var(--md-on-surface, #e6e1e5);
        }
        
        .player-toast-action {
            font-size: 12px;
            color: var(--md-on-surface-variant, #cac4d0);
        }
        
        .player-toast.join .player-toast-action {
            color: #4CAF50;
        }
        
        .player-toast.leave .player-toast-action {
            color: #f44336;
        }
        
        .player-toast-icon {
            width: 20px;
            height: 20px;
        }
        
        .player-toast.join .player-toast-icon {
            color: #4CAF50;
        }
        
        .player-toast.leave .player-toast-icon {
            color: #f44336;
        }
        
        .player-toast-icon svg {
            width: 100%;
            height: 100%;
        }
        
        @media (max-width: 600px) {
            .player-toast {
                top: 60px;
                padding: 6px 12px 6px 6px;
                gap: 8px;
            }
            
            .player-toast-avatar {
                width: 28px;
                height: 28px;
                font-size: 12px;
            }
            
            .player-toast-name {
                font-size: 13px;
            }
            
            .player-toast-action {
                font-size: 11px;
            }
        }
    `;
    document.head.appendChild(style);
}


/**
 * Show dice roll popup
 */
function showDicePopup(roll) {
    // Don't show popups if user is not logged in (e.g., was kicked)
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    // Create popup container if not exists
    let container = document.getElementById('dicePopupContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'dicePopupContainer';
        container.style.cssText = `
            position: fixed;
            bottom: ${window.innerWidth <= 768 ? '140px' : '80px'};
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'dice-popup';
    popup.style.cursor = 'pointer';
    popup.onclick = () => window.location.href = 'wuerfel.html';
    
    const critClass = roll.critSuccess ? 'crit-success' : roll.critFail ? 'crit-fail' : '';
    
    popup.innerHTML = `
        <div class="dice-popup-avatar" style="background-color: ${roll.color}">${roll.player.charAt(0).toUpperCase()}</div>
        <div class="dice-popup-content">
            <div class="dice-popup-name">${roll.player}</div>
            <div class="dice-popup-result">
                <span class="dice-popup-type">W${roll.dice}</span>
                <span class="dice-popup-arrow">→</span>
                <span class="dice-popup-value ${critClass}">${roll.total}</span>
            </div>
        </div>
    `;
    
    // Add styles if not exists
    if (!document.getElementById('popupStyles')) {
        const style = document.createElement('style');
        style.id = 'popupStyles';
        style.textContent = `
            /* Dice Popup */
            .dice-popup {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--md-surface-container-high, #2d2d30);
                border: 1px solid var(--md-outline-variant, #444);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 2.2s forwards;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            
            .dice-popup:hover {
                transform: scale(1.02);
                box-shadow: 0 6px 24px rgba(0,0,0,0.4);
            }
            
            @keyframes popupSlideIn {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            
            @keyframes popupFadeOut {
                to { opacity: 0; transform: translateX(50px); }
            }
            
            .dice-popup-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 14px;
                color: white;
                flex-shrink: 0;
            }
            
            .dice-popup-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .dice-popup-name {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
            }
            
            .dice-popup-result {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .dice-popup-type {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
            }
            
            .dice-popup-arrow {
                color: var(--md-on-surface-variant, #aaa);
            }
            
            .dice-popup-value {
                font-size: 20px;
                font-weight: 700;
                color: var(--md-primary, #6750a4);
            }
            
            .dice-popup-value.crit-success {
                color: var(--md-success, #4caf50);
            }
            
            .dice-popup-value.crit-fail {
                color: var(--md-error, #f44336);
            }
            
            /* Chat Popup */
            .chat-popup {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--md-surface-container-high, #2d2d30);
                border: 1px solid var(--md-outline-variant, #444);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 2.2s forwards;
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            
            .chat-popup:hover {
                transform: scale(1.02);
                box-shadow: 0 6px 24px rgba(0,0,0,0.4);
            }
            
            .chat-popup-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                flex-shrink: 0;
            }
            
            .chat-popup-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            
            .chat-popup-name {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
            }
            
            .chat-popup-message {
                font-size: 16px;
                font-weight: 600;
                color: var(--md-on-surface, #e6e1e5);
                max-width: 180px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* Whiteboard Popup */
            .whiteboard-popup {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--md-surface-container-high, #2d2d30);
                border: 1px solid var(--md-primary, #6750a4);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(103, 80, 164, 0.3);
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 2.2s forwards;
                cursor: pointer;
                transition: transform 0.15s ease;
            }
            
            .whiteboard-popup:hover {
                transform: scale(1.02);
            }
            
            .whiteboard-popup-icon {
                width: 36px;
                height: 36px;
                background: var(--md-primary, #6750a4);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .whiteboard-popup-icon svg {
                width: 20px;
                height: 20px;
                color: white;
            }
            
            .whiteboard-popup-content {
                flex: 1;
            }
            
            .whiteboard-popup-title {
                font-size: 14px;
                font-weight: 500;
                color: var(--md-on-surface, #e6e1e5);
            }
            
            .whiteboard-popup-subtitle {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
            }
            
            /* Typing Indicator */
            .typing-indicator {
                position: fixed;
                bottom: 80px;
                left: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                background: var(--md-surface-container-high, #2d2d30);
                border-radius: 20px;
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 9998;
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .typing-indicator-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: var(--md-primary, #6750a4);
                animation: typingBounce 1.4s infinite;
            }
            
            .typing-indicator-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator-dot:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typingBounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-4px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    container.appendChild(popup);
    
    // Play sound
    playPopupNotificationSound();
    
    // Show crit effects for all players
    if (roll.critSuccess) {
        showGlobalCritSuccessEffect();
    } else if (roll.critFail) {
        showGlobalCritFailEffect();
    }
    
    // Remove after animation
    setTimeout(() => {
        popup.remove();
    }, 2500);
}

/**
 * Show global crit success effect (confetti) for all players
 */
function showGlobalCritSuccessEffect() {
    // Add flash
    if (!document.getElementById('globalCritStyles')) {
        const style = document.createElement('style');
        style.id = 'globalCritStyles';
        style.textContent = `
            @keyframes globalCritFlash {
                0% { opacity: 0; }
                20% { opacity: 1; }
                100% { opacity: 0; }
            }
            @keyframes confettiFall {
                0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            .global-crit-flash {
                position: fixed;
                inset: 0;
                background: radial-gradient(circle at center, rgba(255,215,0,0.4) 0%, rgba(255,165,0,0.2) 50%, transparent 70%);
                pointer-events: none;
                z-index: 9998;
                animation: globalCritFlash 0.8s ease-out forwards;
            }
            .global-confetti-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 9999;
                overflow: hidden;
            }
            .global-confetti {
                position: absolute;
                top: -10px;
                width: 10px;
                height: 10px;
                animation: confettiFall linear forwards;
            }
            .global-confetti.gold { background: #FFD700; }
            .global-confetti.yellow { background: #FFC107; }
            .global-confetti.orange { background: #FF9800; }
            .global-confetti.white { background: #FFFFFF; }
        `;
        document.head.appendChild(style);
    }
    
    // Flash
    const flash = document.createElement('div');
    flash.className = 'global-crit-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);
    
    // Confetti
    const container = document.createElement('div');
    container.className = 'global-confetti-container';
    document.body.appendChild(container);
    
    const colors = ['gold', 'yellow', 'orange', 'white'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = `global-confetti ${colors[Math.floor(Math.random() * colors.length)]}`;
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        if (confetti.style.borderRadius === '2px') {
            confetti.style.width = '8px';
            confetti.style.height = '14px';
        }
        container.appendChild(confetti);
    }
    
    setTimeout(() => container.remove(), 4000);
}

/**
 * Show global crit fail effect (red flash) for all players
 */
function showGlobalCritFailEffect() {
    if (!document.getElementById('globalCritFailStyles')) {
        const style = document.createElement('style');
        style.id = 'globalCritFailStyles';
        style.textContent = `
            @keyframes globalFailFlash {
                0%, 100% { opacity: 0; }
                25%, 75% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .global-fail-flash {
                position: fixed;
                inset: 0;
                background: radial-gradient(circle at center, rgba(244,67,54,0.3) 0%, rgba(183,28,28,0.15) 50%, transparent 70%);
                pointer-events: none;
                z-index: 9998;
                animation: globalFailFlash 0.6s ease-out forwards;
            }
        `;
        document.head.appendChild(style);
    }
    
    const flash = document.createElement('div');
    flash.className = 'global-fail-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
}

/**
 * Show chat message popup (call from chat module or other pages)
 */
function showChatPopup(message) {
    // Don't show on chat page
    if (window.location.pathname.includes('chat')) return;
    
    // Don't show popups if user is not logged in (e.g., was kicked)
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    // Add styles if not present
    if (!document.getElementById('chatPopupStyles')) {
        const style = document.createElement('style');
        style.id = 'chatPopupStyles';
        style.textContent = `
            @keyframes popupSlideIn {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes popupFadeOut {
                to { opacity: 0; transform: translateX(50px); }
            }
            .chat-popup {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--md-surface-container-high, #2d2d30);
                border: 1px solid var(--md-outline-variant, #444);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 2.2s forwards;
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .chat-popup:hover {
                transform: scale(1.02);
                box-shadow: 0 6px 24px rgba(0,0,0,0.4);
            }
            .chat-popup-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                flex-shrink: 0;
            }
            .chat-popup-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .chat-popup-name {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
            }
            .chat-popup-message {
                font-size: 16px;
                font-weight: 600;
                color: var(--md-on-surface, #e6e1e5);
                max-width: 180px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
        document.head.appendChild(style);
    }
    
    let container = document.getElementById('dicePopupContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'dicePopupContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }
    
    // Support both 'sender' and 'author' field names
    const senderName = message.sender || message.author || 'Spieler';
    const senderColor = message.color || '#6750a4';
    
    // Determine message text based on type
    let displayMsg = '';
    let displayIcon = '';
    if (message.type === 'image' || message.type === 'gallery') {
        displayMsg = 'Bild geteilt';
        displayIcon = '<img src="assets/icons/icon_image.png" alt="" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">';
    } else if (message.type === 'file') {
        displayMsg = 'Datei geteilt';
        displayIcon = '<img src="assets/icons/icon_file.png" alt="" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;">';
    } else {
        const msgText = message.text || '';
        displayMsg = msgText.length > 25 ? msgText.substring(0, 25) + '...' : msgText;
    }
    
    const popup = document.createElement('div');
    popup.className = 'chat-popup';
    popup.onclick = () => window.location.href = 'chat.html';
    
    popup.innerHTML = `
        <div class="chat-popup-avatar" style="background-color: ${senderColor}">
            <img src="assets/icons/icon_chat.png" alt="Chat" style="width: 20px; height: 20px;">
        </div>
        <div class="chat-popup-content">
            <div class="chat-popup-name">${senderName}</div>
            <div class="chat-popup-message">${displayIcon}${displayMsg}</div>
        </div>
    `;
    
    container.appendChild(popup);
    playPopupNotificationSound();
    
    setTimeout(() => popup.remove(), 2500);
}

/**
 * Show whiteboard update popup
 */
function showWhiteboardPopup() {
    // Don't show on whiteboard page
    if (window.location.pathname.includes('whiteboard')) return;
    
    // Don't show popups if user is not logged in (e.g., was kicked)
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    // Add styles if not present
    if (!document.getElementById('whiteboardPopupStyles')) {
        const style = document.createElement('style');
        style.id = 'whiteboardPopupStyles';
        style.textContent = `
            .whiteboard-popup {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--md-surface-container-high, #2d2d30);
                border: 1px solid var(--md-primary, #6750a4);
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(103, 80, 164, 0.3);
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 2.2s forwards;
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .whiteboard-popup:hover {
                transform: scale(1.02);
                box-shadow: 0 6px 24px rgba(103, 80, 164, 0.4);
            }
            .whiteboard-popup-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: var(--md-primary, #6750a4);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .whiteboard-popup-content {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .whiteboard-popup-name {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
            }
            .whiteboard-popup-message {
                font-size: 16px;
                font-weight: 600;
                color: var(--md-on-surface, #e6e1e5);
            }
            @keyframes popupSlideIn {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes popupFadeOut {
                to { opacity: 0; transform: translateX(50px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    let container = document.getElementById('dicePopupContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'dicePopupContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }
    
    const popup = document.createElement('div');
    popup.className = 'whiteboard-popup';
    popup.onclick = () => window.location.href = 'whiteboard.html';
    
    popup.innerHTML = `
        <div class="whiteboard-popup-avatar">
            <img src="assets/icons/icon_whiteboard.png" alt="Whiteboard" style="width: 20px; height: 20px;">
        </div>
        <div class="whiteboard-popup-content">
            <div class="whiteboard-popup-name">Whiteboard</div>
            <div class="whiteboard-popup-message">Neues Element</div>
        </div>
    `;
    
    container.appendChild(popup);
    playPopupNotificationSound();
    
    setTimeout(() => popup.remove(), 2500);
}

/**
 * Initialize chat popup listener
 */
let chatPopupInitialized = false;
let lastChatTimestamp = 0;
let processedChatIds = new Set();

function initChatPopupListener() {
    if (chatPopupInitialized) return;
    if (!database) {
        setTimeout(initChatPopupListener, 500);
        return;
    }
    if (window.location.pathname.includes('chat')) return;
    
    chatPopupInitialized = true;
    lastChatTimestamp = Date.now();
    
    console.log('[Firebase] Chat popup listener started');
    
    const ref = getRef('chat').orderByChild('timestamp').limitToLast(1);
    
    ref.on('child_added', (snapshot) => {
        const message = snapshot.val();
        const messageId = snapshot.key;
        if (!message) return;
        
        // Skip already processed
        if (processedChatIds.has(messageId)) return;
        processedChatIds.add(messageId);
        
        // Skip old messages (more than 5 seconds ago)
        if (message.timestamp && Date.now() - message.timestamp > 5000) return;
        
        // Skip own messages (check both sender and author)
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        
        // Skip if user is not logged in
        if (!user) {
            console.log('[Firebase] Skipping chat popup - no user logged in');
            return;
        }
        
        const msgSender = message.sender || message.author;
        if (msgSender === user?.username) return;
        
        console.log('[Firebase] Showing chat popup from:', msgSender);
        showChatPopup(message);
    });
}


// ===== CHAT UNREAD COUNTER =====

let chatUnreadInitialized = false;
let chatUnreadCount = 0;
const CHAT_LAST_READ_KEY = 'rift_chat_last_read';

/**
 * Get the last read timestamp from localStorage
 */
function getChatLastReadTimestamp() {
    const stored = localStorage.getItem(CHAT_LAST_READ_KEY);
    return stored ? parseInt(stored, 10) : 0;
}

/**
 * Set the last read timestamp
 */
function setChatLastReadTimestamp(timestamp = Date.now()) {
    localStorage.setItem(CHAT_LAST_READ_KEY, timestamp.toString());
}

/**
 * Initialize the unread message counter for the chat fly button
 */
function initChatUnreadCounter() {
    if (chatUnreadInitialized) return;
    if (!database) {
        setTimeout(initChatUnreadCounter, 500);
        return;
    }
    
    // Skip if not logged in
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    const isOnChatPage = window.location.pathname.includes('chat');
    
    // If on chat page, mark as read and exit
    if (isOnChatPage) {
        setChatLastReadTimestamp();
        chatUnreadCount = 0;
        return;
    }
    
    chatUnreadInitialized = true;
    const lastRead = getChatLastReadTimestamp();
    
    console.log('[Firebase] Unread counter started, last read:', new Date(lastRead).toLocaleTimeString());
    
    // First, count existing unread messages
    getRef('chat').orderByChild('timestamp').startAt(lastRead + 1).once('value', (snapshot) => {
        const messages = snapshot.val();
        if (messages) {
            Object.values(messages).forEach(msg => {
                const msgSender = msg.sender || msg.author;
                if (msgSender !== user?.username) {
                    chatUnreadCount++;
                }
            });
            
            if (typeof updateChatUnreadBadge === 'function') {
                updateChatUnreadBadge(chatUnreadCount);
            }
            console.log('[Firebase] Initial unread count:', chatUnreadCount);
        }
    });
    
    // Then listen for new messages
    const ref = getRef('chat').orderByChild('timestamp').startAt(Date.now());
    
    ref.on('child_added', (snapshot) => {
        const message = snapshot.val();
        if (!message) return;
        
        // Skip own messages
        const msgSender = message.sender || message.author;
        if (msgSender === user?.username) return;
        
        chatUnreadCount++;
        
        if (typeof updateChatUnreadBadge === 'function') {
            updateChatUnreadBadge(chatUnreadCount);
        }
        
        console.log('[Firebase] New unread message, count:', chatUnreadCount);
    });
}

/**
 * Reset the unread counter (call when entering chat page)
 */
function resetChatUnreadCounter() {
    chatUnreadCount = 0;
    setChatLastReadTimestamp();
    
    if (typeof updateChatUnreadBadge === 'function') {
        updateChatUnreadBadge(0);
    }
}

/**
 * Initialize whiteboard popup listener
 */
let whiteboardPopupInitialized = false;
let lastWhiteboardUpdate = 0;

function initWhiteboardPopupListener() {
    if (whiteboardPopupInitialized) return;
    if (!database) {
        setTimeout(initWhiteboardPopupListener, 500);
        return;
    }
    if (window.location.pathname.includes('whiteboard')) return;
    
    // Only for non-GM players who are logged in
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return; // Skip if not logged in
    if (user?.isGM) return;
    
    whiteboardPopupInitialized = true;
    
    const ref = getRef('whiteboard');
    let lastElementCount = -1; // -1 = not initialized
    
    ref.on('value', (snapshot) => {
        // Check again if user is still logged in
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser) return;
        
        const data = snapshot.val();
        if (!data) return;
        
        // Count elements
        const elements = data.elements || [];
        const currentElementCount = elements.length;
        
        // First load - just remember state
        if (lastElementCount === -1) {
            lastElementCount = currentElementCount;
            return;
        }
        
        // Only show popup if new elements were added
        if (currentElementCount > lastElementCount) {
            showWhiteboardPopup();
        }
        
        // Update tracking
        lastElementCount = currentElementCount;
    });
}

/**
 * Show typing indicator
 */
let typingIndicatorEl = null;
let typingUsers = {};
let typingTimeout = null;

function showTypingIndicator(username) {
    // Don't show on non-chat pages or for own typing
    if (!window.location.pathname.includes('chat')) return;
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (username === user?.username) return;
    
    typingUsers[username] = Date.now();
    updateTypingIndicator();
}

function hideTypingIndicator(username) {
    delete typingUsers[username];
    updateTypingIndicator();
}

function updateTypingIndicator() {
    const activeTypers = Object.keys(typingUsers).filter(u => 
        Date.now() - typingUsers[u] < 3000
    );
    
    if (activeTypers.length === 0) {
        if (typingIndicatorEl) {
            typingIndicatorEl.remove();
            typingIndicatorEl = null;
        }
        return;
    }
    
    if (!typingIndicatorEl) {
        typingIndicatorEl = document.createElement('div');
        typingIndicatorEl.className = 'typing-indicator';
        document.body.appendChild(typingIndicatorEl);
    }
    
    const names = activeTypers.length > 2 
        ? `${activeTypers.slice(0, 2).join(', ')} und andere`
        : activeTypers.join(' und ');
    
    typingIndicatorEl.innerHTML = `
        <span>${names} ${activeTypers.length > 1 ? 'schreiben' : 'schreibt'}...</span>
        <div class="typing-indicator-dot"></div>
        <div class="typing-indicator-dot"></div>
        <div class="typing-indicator-dot"></div>
    `;
}

/**
 * Broadcast typing status
 */
function broadcastTyping() {
    if (!isFirebaseOnline()) return;
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    
    getRef(`typing/${user.username}`).set({
        username: user.username,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Clear after 2 seconds
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        getRef(`typing/${user.username}`).remove();
    }, 2000);
}

/**
 * Listen for typing indicators
 */
function initTypingListener() {
    if (!database) return;
    if (!window.location.pathname.includes('chat')) return;
    
    const ref = getRef('typing');
    
    ref.on('child_added', (snapshot) => {
        const data = snapshot.val();
        if (data && data.username) {
            showTypingIndicator(data.username);
        }
    });
    
    ref.on('child_removed', (snapshot) => {
        const data = snapshot.val();
        if (data && data.username) {
            hideTypingIndicator(data.username);
        }
    });
    
    // Clean up old typing indicators periodically
    setInterval(() => {
        Object.keys(typingUsers).forEach(u => {
            if (Date.now() - typingUsers[u] > 3000) {
                delete typingUsers[u];
            }
        });
        updateTypingIndicator();
    }, 1000);
}

/**
 * Play popup notification sound
 */
function playPopupNotificationSound() {
    // Check if sound is muted
    if (typeof isSoundMuted === 'function' && isSoundMuted()) return;
    if (localStorage.getItem('pnp_sound_muted') === 'true') return;
    
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        // Audio not available
    }
}


// ===== GM PLAYER MANAGEMENT =====

/**
 * Update player data (GM only)
 * @param {string} username - Target player's username
 * @param {Object} updates - Fields to update (username, color, isGM)
 */
async function gmUpdatePlayer(username, updates) {
    if (!database) return false;
    
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser?.isGM) {
        console.warn('[Firebase] Not authorized - GM only');
        return false;
    }
    
    try {
        const playersRef = getRef('players');
        const snapshot = await playersRef.once('value');
        const players = snapshot.val();
        
        if (!players) return false;
        
        // Find player by username
        let playerKey = null;
        Object.entries(players).forEach(([key, player]) => {
            if (player.username === username) {
                playerKey = key;
            }
        });
        
        if (!playerKey) {
            console.warn('[Firebase] Player not found:', username);
            return false;
        }
        
        // If renaming, check if new name is taken
        if (updates.username && updates.username !== username) {
            const nameTaken = Object.values(players).some(p => 
                p.username === updates.username && p.username !== username
            );
            if (nameTaken) {
                alert('Dieser Name ist bereits vergeben!');
                return false;
            }
            
            // Also update localStorage for that player (they'll need to refresh)
            // This is handled on their side when they detect the change
        }
        
        // Apply updates
        await playersRef.child(playerKey).update(updates);
        console.log('[Firebase] Player updated:', username, updates);
        return true;
    } catch (e) {
        console.error('[Firebase] Update player failed:', e);
        return false;
    }
}

/**
 * Kick player from session (GM only)
 * @param {string} username - Player to kick
 */
async function gmKickPlayerFromSession(username) {
    if (!database) return false;
    
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser?.isGM) {
        console.warn('[Firebase] Not authorized - GM only');
        return false;
    }
    
    try {
        const playersRef = getRef('players');
        const snapshot = await playersRef.once('value');
        const players = snapshot.val();
        
        if (!players) return false;
        
        // Find player by username
        let playerKey = null;
        Object.entries(players).forEach(([key, player]) => {
            if (player.username === username) {
                playerKey = key;
            }
        });
        
        if (!playerKey) return false;
        
        // Mark player as kicked (they'll detect this and be logged out)
        await playersRef.child(playerKey).update({ kicked: true });
        
        // Remove from players list after short delay
        setTimeout(async () => {
            await playersRef.child(playerKey).remove();
        }, 1000);
        
        console.log('[Firebase] Player kicked:', username);
        return true;
    } catch (e) {
        console.error('[Firebase] Kick player failed:', e);
        return false;
    }
}

/**
 * Listen for kick events (call on every page)
 */
function initKickListener() {
    if (!database) {
        setTimeout(initKickListener, 500);
        return;
    }
    
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser) return;
    
    const playersRef = getRef('players');
    
    playersRef.on('value', snapshot => {
        const players = snapshot.val();
        if (!players) return;
        
        // Find current user's entry
        Object.values(players).forEach(player => {
            if (player.username === currentUser.username && player.kicked) {
                // User has been kicked!
                alert(t('room.kicked_by_gm'));
                if (typeof logout === 'function') {
                    logout(true);
                } else {
                    localStorage.removeItem('pnpUser');
                    window.location.href = 'login.html';
                }
            }
        });
    });
}

// Initialize kick listener on page load
setTimeout(initKickListener, 1000);


// ===== GM PLAYER MANAGEMENT POPUP =====

/**
 * Open player management popup (GM only)
 */
function openPlayerManagePopup(username, color, isGM, isRoomCreator) {
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser?.isGM) return;
    
    const canRemoveGM = currentUser.isRoomCreator && isGM && !isRoomCreator;
    const canMakeGM = !isGM;
    
    // Remove existing popup
    const existing = document.getElementById('playerManagePopup');
    if (existing) existing.remove();
    
    // Inject styles if not present
    if (!document.getElementById('gmPopupStyles')) {
        const style = document.createElement('style');
        style.id = 'gmPopupStyles';
        style.textContent = `
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
            .player-manage-btn:hover { opacity: 0.9; }
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
                background: rgba(103, 80, 164, 0.15);
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
        `;
        document.head.appendChild(style);
    }
    
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

// GM Actions for Popup
async function gmRenamePlayer(oldUsername) {
    const newName = document.getElementById('pmNewName')?.value?.trim();
    if (!newName || newName === oldUsername) return;
    
    await gmUpdatePlayer(oldUsername, { username: newName });
    document.getElementById('playerManagePopup')?.remove();
}

async function gmChangePlayerColor(username) {
    const newColor = document.getElementById('pmNewColor')?.value;
    if (!newColor) return;
    
    await gmUpdatePlayer(username, { color: newColor });
    document.getElementById('playerManagePopup')?.remove();
}

async function gmMakePlayerGM(username) {
    if (confirm(t('gm.transfer_confirm', { name: username }))) {
        // Send GM request to player via Firebase
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser) return;
        
        await getRef('gmRequests').push({
            from: currentUser.username,
            to: username,
            timestamp: Date.now()
        });
        
        alert(t('gm.transfer_sent', { name: username }));
        document.getElementById('playerManagePopup')?.remove();
    }
}

async function gmRemovePlayerGM(username) {
    if (confirm(t('gm.remove_gm_confirm', { name: username }))) {
        await gmUpdatePlayer(username, { isGM: false, isRoomCreator: false });
        document.getElementById('playerManagePopup')?.remove();
    }
}

async function gmKickPlayer(username) {
    if (confirm(t('gm.kick_confirm', { name: username }))) {
        await gmKickPlayerFromSession(username);
        document.getElementById('playerManagePopup')?.remove();
    }
}

// Listen for GM requests
function initGMRequestListener() {
    if (!database) {
        setTimeout(initGMRequestListener, 500);
        return;
    }
    
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser || currentUser.isGM) return;
    
    getRef('gmRequests').orderByChild('to').equalTo(currentUser.username).on('child_added', async (snapshot) => {
        const request = snapshot.val();
        if (!request || Date.now() - request.timestamp > 60000) {
            // Expired request
            snapshot.ref.remove();
            return;
        }
        
        if (confirm(t('gm.transfer_request', { name: request.from }))) {
            // Accept - update player to GM
            currentUser.isGM = true;
            localStorage.setItem('pnpUser', JSON.stringify(currentUser));
            
            // Update in Firebase
            await gmUpdatePlayer(currentUser.username, { isGM: true });
            
            alert(t('gm.transfer_accepted'));
            window.location.reload();
        }
        
        // Remove request
        snapshot.ref.remove();
    });
}

// Initialize GM listeners
setTimeout(() => {
    initGMRequestListener();
}, 2000);


// ===== MODULE ACCESS CHECK =====

/**
 * Auto-detect current page and set up module access listener
 */
function initAutoModuleAccessCheck() {
    const path = window.location.pathname;
    let moduleId = null;
    
    if (path.includes('karte')) moduleId = 'karte';
    else if (path.includes('whiteboard')) moduleId = 'whiteboard';
    else if (path.includes('notizen')) moduleId = 'notizen';
    else if (path.includes('chat')) moduleId = 'chat';
    
    if (moduleId) {
        initModuleAccessListener(moduleId);
    }
}

/**
 * Check if a module is enabled
 * @param {string} moduleId - Module ID (karte, whiteboard, notizen, chat)
 * @returns {Promise<boolean>} Whether the module is enabled
 */
async function checkModuleAccess(moduleId) {
    if (!database) return true;
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    
    // GM always has access
    if (user?.isGM) return true;
    
    try {
        const snapshot = await getRef(`modules/${moduleId}`).once('value');
        const enabled = snapshot.val();
        return enabled !== false; // default to enabled if not set
    } catch (e) {
        console.log('[Modules] Error checking access:', e);
        return true; // default to enabled on error
    }
}

/**
 * Initialize module access listener - redirects if module is disabled
 * @param {string} moduleId - Module ID to check
 */
function initModuleAccessListener(moduleId) {
    if (!database) return;
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    
    // GM always has access
    if (user?.isGM) return;
    
    getRef(`modules/${moduleId}`).on('value', (snapshot) => {
        const enabled = snapshot.val();
        
        if (enabled === false) {
            // Module was disabled - redirect to hub
            alert('Dieses Modul wurde vom GM deaktiviert.');
            window.location.href = 'index.html';
        }
    });
}

// Make functions globally available
window.checkModuleAccess = checkModuleAccess;
window.initModuleAccessListener = initModuleAccessListener;


// ===== GM SUCCESSION SYSTEM =====

let gmGracePeriodTimer = null;
const GM_GRACE_PERIOD_MS = 120000; // 120 seconds

/**
 * Verify if current user is actually GM according to Firebase
 * This prevents localStorage manipulation attacks
 */
async function verifyIsGM() {
    const user = getCurrentUser();
    if (!user || !isFirebaseOnline()) return false;
    
    try {
        const snapshot = await getRef(`players/${sanitizeKey(user.username)}`).once('value');
        const playerData = snapshot.val();
        
        const isActuallyGM = playerData?.isGM === true;
        console.log('[GM Verify] Firebase says isGM:', isActuallyGM, 'localStorage says:', user.isGM);
        
        return isActuallyGM;
    } catch (error) {
        console.error('[GM Verify] Failed to verify:', error);
        return false;
    }
}

/**
 * Show GM succession dialog when GM tries to logout
 */
async function showGMSuccessionDialog() {
    const currentUser = getCurrentUser();
    
    // Verify against Firebase - don't trust localStorage
    const isActuallyGM = await verifyIsGM();
    if (!isActuallyGM) {
        console.log('[GM Succession] User is not actually GM, direct logout');
        forceLogout(true);
        return;
    }
    
    const snapshot = await getRef('players').once('value');
    const players = snapshot.val() || {};
    const otherPlayers = Object.entries(players)
        .filter(([key, player]) => player.username !== currentUser.username && player.online !== false)
        .map(([key, player]) => ({ key, ...player }));
    
    // Create dialog
    const overlay = document.createElement('div');
    overlay.id = 'gmSuccessionOverlay';
    overlay.className = 'gm-succession-overlay';
    
    let playerListHTML = '';
    if (otherPlayers.length > 0) {
        playerListHTML = `
            <p class="gm-succession-text">${t('gm.succession_choose')}</p>
            <div class="gm-succession-players">
                ${otherPlayers.map(player => `
                    <button class="gm-succession-player" onclick="transferGMAndLogout('${player.username.replace(/'/g, "\\'")}')">
                        <span class="gm-succession-player-color" style="background: ${player.color}"></span>
                        <span class="gm-succession-player-name">${player.username}</span>
                        <span class="gm-succession-player-arrow">→ GM</span>
                    </button>
                `).join('')}
            </div>
            <div class="gm-succession-divider">${t('gm.succession_or')}</div>
        `;
    } else {
        playerListHTML = `<p class="gm-succession-text">${t('gm.succession_no_players')}</p>`;
    }
    
    overlay.innerHTML = `
        <div class="gm-succession-dialog">
            <div class="gm-succession-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
                <h2>${t('gm.succession_title')}</h2>
            </div>
            ${playerListHTML}
            <button class="gm-succession-close-btn" onclick="closeRoomAndLogout()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                ${t('gm.succession_close_room')}
            </button>
            <button class="gm-succession-cancel-btn" onclick="closeGMSuccessionDialog()">
                ${t('cancel')}
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add styles if not already present
    if (!document.getElementById('gmSuccessionStyles')) {
        const style = document.createElement('style');
        style.id = 'gmSuccessionStyles';
        style.textContent = `
            .gm-succession-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 1rem;
            }
            .gm-succession-dialog {
                background: var(--md-surface, #1e1e1e);
                border-radius: 16px;
                padding: 1.5rem;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }
            .gm-succession-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1rem;
            }
            .gm-succession-header svg {
                width: 32px;
                height: 32px;
                color: var(--md-primary, #bb86fc);
            }
            .gm-succession-header h2 {
                margin: 0;
                font-size: 1.25rem;
                color: var(--md-on-surface, #fff);
            }
            .gm-succession-text {
                color: var(--md-on-surface-variant, #ccc);
                margin-bottom: 1rem;
                font-size: 0.9rem;
            }
            .gm-succession-players {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }
            .gm-succession-player {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: var(--md-surface-variant, #2d2d2d);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                color: var(--md-on-surface, #fff);
                font-size: 1rem;
            }
            .gm-succession-player:hover {
                background: var(--md-primary, #bb86fc);
                color: var(--md-on-primary, #000);
            }
            .gm-succession-player-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .gm-succession-player-name {
                flex: 1;
                text-align: left;
            }
            .gm-succession-player-arrow {
                font-size: 0.85rem;
                opacity: 0.7;
            }
            .gm-succession-divider {
                text-align: center;
                color: var(--md-on-surface-variant, #888);
                font-size: 0.85rem;
                margin: 1rem 0;
                position: relative;
            }
            .gm-succession-divider::before,
            .gm-succession-divider::after {
                content: '';
                position: absolute;
                top: 50%;
                width: 35%;
                height: 1px;
                background: var(--md-outline, #444);
            }
            .gm-succession-divider::before { left: 0; }
            .gm-succession-divider::after { right: 0; }
            .gm-succession-close-btn {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                padding: 0.75rem;
                background: var(--md-error, #cf6679);
                color: var(--md-on-error, #000);
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .gm-succession-close-btn:hover {
                opacity: 0.9;
            }
            .gm-succession-close-btn svg {
                width: 20px;
                height: 20px;
            }
            .gm-succession-cancel-btn {
                width: 100%;
                padding: 0.75rem;
                margin-top: 0.5rem;
                background: transparent;
                color: var(--md-on-surface-variant, #888);
                border: 1px solid var(--md-outline, #444);
                border-radius: 8px;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.2s;
            }
            .gm-succession-cancel-btn:hover {
                background: var(--md-surface-variant, #2d2d2d);
                color: var(--md-on-surface, #fff);
            }
            
            /* GM Offline Banner for players */
            .gm-offline-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
                color: #fff;
                padding: 1rem 1.5rem;
                text-align: center;
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                font-weight: 600;
                font-size: 1.1rem;
                box-shadow: 0 4px 20px rgba(211, 47, 47, 0.5);
                animation: gm-offline-pulse 2s ease-in-out infinite;
            }
            .gm-offline-banner svg {
                flex-shrink: 0;
            }
            @keyframes gm-offline-pulse {
                0%, 100% { background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); }
                50% { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); }
            }
            .gm-offline-banner .countdown {
                font-variant-numeric: tabular-nums;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Close the GM succession dialog
 */
function closeGMSuccessionDialog() {
    const overlay = document.getElementById('gmSuccessionOverlay');
    if (overlay) overlay.remove();
}

/**
 * Transfer GM role to another player and logout
 */
async function transferGMAndLogout(newGMUsername) {
    // Verify against Firebase before transfer
    const isActuallyGM = await verifyIsGM();
    if (!isActuallyGM) {
        console.error('[GM Succession] Cannot transfer - not actually GM');
        forceLogout(true);
        return;
    }
    
    const currentUser = getCurrentUser();
    console.log('[GM Succession] Transferring GM to:', newGMUsername);
    
    try {
        // Update new GM in Firebase
        await getRef(`players/${sanitizeKey(newGMUsername)}`).update({
            isGM: true,
            isRoomCreator: true
        });
        
        // Remove GM from current user in Firebase
        await getRef(`players/${sanitizeKey(currentUser.username)}`).update({
            isGM: false,
            isRoomCreator: false
        });
        
        // Clear GM grace period data
        await getRef('gmPresence').remove();
        
        console.log('[GM Succession] Transfer complete');
        
        // Close dialog and logout immediately (no browser popup)
        closeGMSuccessionDialog();
        forceLogout(true);
        
    } catch (error) {
        console.error('[GM Succession] Transfer failed:', error);
        alert(t('gm.succession_error'));
    }
}

/**
 * Close room and kick all players
 */
async function closeRoomAndLogout() {
    // Verify against Firebase before closing
    const isActuallyGM = await verifyIsGM();
    if (!isActuallyGM) {
        console.error('[GM Succession] Cannot close room - not actually GM');
        forceLogout(true);
        return;
    }
    
    console.log('[GM Succession] Closing room');
    
    try {
        // Set room closing flag with message
        await getRef('roomClosing').set({
            timestamp: Date.now(),
            reason: 'gm_left',
            message: t('gm.succession_room_closed_message')
        });
        
        // Clear GM grace period data
        await getRef('gmPresence').remove();
        
        // Close dialog and logout immediately (no browser popup)
        closeGMSuccessionDialog();
        forceLogout(true);
        
    } catch (error) {
        console.error('[GM Succession] Room close failed:', error);
        forceLogout(true);
    }
}

/**
 * Update GM presence (heartbeat)
 * @param {boolean} forceUpdate - Skip isGM check (used when verified via Firebase)
 */
async function updateGMPresence(forceUpdate = false) {
    const currentUser = getCurrentUser();
    if (!currentUser || !isFirebaseOnline()) return;
    
    // Skip localStorage check if forceUpdate is true (already verified via Firebase)
    if (!forceUpdate && !currentUser.isGM) return;
    
    try {
        const presenceRef = getRef('gmPresence');
        
        // Set current presence data
        await presenceRef.set({
            username: currentUser.username,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            online: true
        });
        
        // Set onDisconnect to mark GM as offline with timestamp
        await presenceRef.child('online').onDisconnect().set(false);
        await presenceRef.child('disconnectedAt').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
        
        console.log('[GM Presence] Heartbeat sent for:', currentUser.username);
    } catch (error) {
        console.error('[GM Presence] Failed to update:', error);
    }
}

/**
 * Start GM presence heartbeat
 * @param {boolean} verified - Already verified as GM via Firebase
 */
function startGMPresenceHeartbeat(verified = false) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Skip localStorage check if already verified
    if (!verified && !currentUser.isGM) return;
    
    console.log('[GM Presence] Starting heartbeat for:', currentUser.username);
    
    // Update immediately (with force flag since we're verified)
    updateGMPresence(true);
    
    // Update every 30 seconds
    setInterval(() => updateGMPresence(true), 30000);
    
    // Also update on page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateGMPresence(true);
        }
    });
}

/**
 * Monitor GM presence (for non-GM players)
 * Note: This is only called for verified non-GMs by initGMSuccession
 */
function startGMPresenceMonitor() {
    const currentUser = getCurrentUser();
    if (!currentUser || !isFirebaseOnline()) {
        console.log('[GM Monitor] Cannot start - no user or Firebase offline');
        return;
    }
    
    // Note: We don't check currentUser.isGM here because initGMSuccession already verified via Firebase
    // This function is only called for verified non-GMs
    
    console.log('[GM Monitor] Starting for player:', currentUser.username);
    
    let offlineBanner = null;
    let countdownInterval = null;
    let gracePeriodEnd = null;
    let lastKnownGMOnline = true;
    
    // Helper to create/update the banner
    function showOfflineBanner() {
        // Add CSS if not present
        if (!document.getElementById('gmOfflineBannerStyles')) {
            const style = document.createElement('style');
            style.id = 'gmOfflineBannerStyles';
            style.textContent = `
                .gm-offline-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
                    color: #fff;
                    padding: 1rem 1.5rem;
                    text-align: center;
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    font-weight: 600;
                    font-size: 1.1rem;
                    box-shadow: 0 4px 20px rgba(211, 47, 47, 0.5);
                    animation: gm-offline-pulse 2s ease-in-out infinite;
                }
                .gm-offline-banner svg {
                    flex-shrink: 0;
                }
                @keyframes gm-offline-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.85; }
                }
            `;
            document.head.appendChild(style);
        }
        
        if (!offlineBanner) {
            offlineBanner = document.createElement('div');
            offlineBanner.className = 'gm-offline-banner';
            offlineBanner.id = 'gmOfflineBanner';
            document.body.prepend(offlineBanner);
            
            // Push down page content
            document.body.style.paddingTop = '60px';
        }
        return offlineBanner;
    }
    
    function hideOfflineBanner() {
        if (offlineBanner) {
            offlineBanner.remove();
            offlineBanner = null;
            document.body.style.paddingTop = '';
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (bannerDelayTimeout) {
            clearTimeout(bannerDelayTimeout);
            bannerDelayTimeout = null;
        }
    }
    
    // Delay before showing banner (to ignore page switches)
    const BANNER_DELAY_MS = 5000; // 5 seconds
    let bannerDelayTimeout = null;
    
    // Listen for GM presence changes
    getRef('gmPresence').on('value', async (snapshot) => {
        const presence = snapshot.val();
        
        // First check for room closing (higher priority)
        const closingSnapshot = await getRef('roomClosing').once('value');
        const closing = closingSnapshot.val();
        if (closing) {
            hideOfflineBanner();
            handleRoomClosed(closing.message);
            return;
        }
        
        console.log('[GM Monitor] Presence update:', presence);
        
        // No presence data yet - GM might not have connected
        if (!presence) {
            console.log('[GM Monitor] No gmPresence data');
            return;
        }
        
        // GM explicitly marked as offline
        if (presence.online === false) {
            console.log('[GM Monitor] GM went offline, waiting 5s before showing banner...');
            lastKnownGMOnline = false;
            
            // Calculate grace period end (from disconnect time, not from now)
            const disconnectTime = presence.disconnectedAt || Date.now();
            gracePeriodEnd = disconnectTime + GM_GRACE_PERIOD_MS;
            
            // Clear any existing delay timeout
            if (bannerDelayTimeout) {
                clearTimeout(bannerDelayTimeout);
            }
            
            // Wait 5 seconds before showing banner (to ignore page switches)
            bannerDelayTimeout = setTimeout(() => {
                // Double-check GM is still offline
                getRef('gmPresence/online').once('value').then(onlineSnap => {
                    if (onlineSnap.val() === false) {
                        console.log('[GM Monitor] GM still offline after 5s, showing banner');
                        
                        const banner = showOfflineBanner();
                        
                        // Update countdown every second
                        const updateCountdown = async () => {
                            const remaining = Math.max(0, gracePeriodEnd - Date.now());
                            const seconds = Math.ceil(remaining / 1000);
                            
                            if (seconds <= 0) {
                                // Grace period ended - trigger auto-transfer
                                clearInterval(countdownInterval);
                                countdownInterval = null;
                                banner.innerHTML = `
                                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    ${t('gm.succession_transferring')}
                                `;
                                await triggerAutoGMTransfer();
                            } else {
                                banner.innerHTML = `
                                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <span>${t('gm.succession_gm_offline', { seconds: '<strong style="font-size:1.3em">' + seconds + '</strong>' })}</span>
                                `;
                            }
                        };
                        
                        // Clear any existing interval and start new one
                        if (countdownInterval) clearInterval(countdownInterval);
                        updateCountdown();
                        countdownInterval = setInterval(updateCountdown, 1000);
                    } else {
                        console.log('[GM Monitor] GM came back online within 5s, no banner needed');
                    }
                });
            }, BANNER_DELAY_MS);
            
        } else if (presence.online === true) {
            // GM is online
            console.log('[GM Monitor] GM is online');
            lastKnownGMOnline = true;
            hideOfflineBanner();
        }
    });
    
    console.log('[GM Monitor] Started monitoring GM presence');
}

/**
 * Auto-transfer GM to oldest player after grace period
 */
async function triggerAutoGMTransfer() {
    const currentUser = getCurrentUser();
    if (currentUser?.isGM) return; // GM is back, don't transfer
    
    try {
        const playersSnapshot = await getRef('players').once('value');
        const players = playersSnapshot.val() || {};
        
        // Filter online non-GM players and sort by join time
        const candidates = Object.entries(players)
            .filter(([key, player]) => player.online !== false && !player.isGM)
            .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
        
        if (candidates.length === 0) {
            // No candidates - close room
            handleRoomClosed(t('gm.succession_room_closed_message'));
            return;
        }
        
        const [oldestKey, oldestPlayer] = candidates[0];
        
        // Check if I am the oldest player
        if (oldestPlayer.username === currentUser.username) {
            console.log('[GM Succession] I am the oldest player, becoming GM');
            
            // Update myself as GM
            await getRef(`players/${sanitizeKey(currentUser.username)}`).update({
                isGM: true,
                isRoomCreator: true
            });
            
            // Update local user data
            currentUser.isGM = true;
            currentUser.isRoomCreator = true;
            localStorage.setItem('pnp_companion_user', JSON.stringify(currentUser));
            
            // Clear grace period data
            await getRef('gmPresence').set({
                username: currentUser.username,
                timestamp: Date.now(),
                online: true
            });
            
            // Remove offline banner
            const banner = document.querySelector('.gm-offline-banner');
            if (banner) banner.remove();
            
            // Show notification
            alert(t('gm.succession_you_are_gm'));
            
            // Reload page to get GM UI
            window.location.reload();
        }
        // If not oldest, wait for the oldest player to take over
        
    } catch (error) {
        console.error('[GM Succession] Auto-transfer failed:', error);
    }
}

/**
 * Handle room closed by GM
 */
function handleRoomClosed(message) {
    // Remove any existing banners
    const banner = document.querySelector('.gm-offline-banner');
    if (banner) banner.remove();
    
    alert(message || t('gm.succession_room_closed_message'));
    forceLogout(true);
}

/**
 * Initialize GM succession system
 */
async function initGMSuccession() {
    const currentUser = getCurrentUser();
    if (!isFirebaseOnline()) {
        console.log('[GM Succession] Firebase not online, skipping');
        return;
    }
    
    // Wait a moment for player data to sync to Firebase
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Verify GM status against Firebase (with retry)
    let isActuallyGM = await verifyIsGM();
    
    // Retry once if localStorage says GM but Firebase says no (race condition)
    if (!isActuallyGM && currentUser?.isGM) {
        console.log('[GM Succession] Retrying GM verification...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        isActuallyGM = await verifyIsGM();
    }
    
    console.log('[GM Succession] User:', currentUser?.username, 'isActuallyGM:', isActuallyGM);
    
    if (isActuallyGM) {
        // GM: Start presence heartbeat (pass verified=true to skip localStorage check)
        startGMPresenceHeartbeat(true);
        
        console.log('[GM Succession] GM presence heartbeat started');
    } else {
        // Player: Monitor GM presence
        startGMPresenceMonitor();
        
        // Also listen for room closing
        getRef('roomClosing').on('value', (snapshot) => {
            const closing = snapshot.val();
            if (closing) {
                handleRoomClosed(closing.message);
            }
        });
        
        console.log('[GM Succession] Player monitoring started');
    }
}

// Make GM succession functions globally available
window.showGMSuccessionDialog = showGMSuccessionDialog;
window.closeGMSuccessionDialog = closeGMSuccessionDialog;
window.transferGMAndLogout = transferGMAndLogout;
window.closeRoomAndLogout = closeRoomAndLogout;
window.initGMSuccession = initGMSuccession;
window.verifyIsGM = verifyIsGM;


// ===== EXPORTS =====
// All functions are global for easy access from modules

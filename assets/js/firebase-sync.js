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
        const isLoginPage = window.location.pathname.includes('login.html');
        const hasUser = typeof getCurrentUser === 'function' && getCurrentUser() !== null;
        
        if (!isLoginPage && hasUser) {
            initDicePopupListener();
            initChatPopupListener();
            initWhiteboardPopupListener();
            initTypingListener();
            initChatUnreadCounter();
            initGlobalDiceClearListener();
            initGlobalTimerListener();
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
    
    // Set online status
    onlineStatusRef.set(getPlayerData());
    
    // Remove on disconnect
    onlineStatusRef.onDisconnect().remove();
    
    // Listen for changes to own player data (GM can change color, GM status, or kick)
    listenForOwnPlayerChanges(user.username);
    
    console.log(`[Firebase] Player joined: ${user.username}`);
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
            alert('Du wurdest aus dem Raum entfernt.');
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
            
            // Only play sound if we haven't already for this timer
            if (lastExpiredTimerId !== timerId) {
                lastExpiredTimerId = timerId;
                playTimerEndSound();
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
    style.textContent = `
        #globalTimerBox {
            position: fixed;
            bottom: 152px;
            right: 24px;
            z-index: 999;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 52px;
            height: 52px;
            padding: 4px;
            background: var(--md-surface-container-high, #2b2930);
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Roboto Mono', 'Roboto', sans-serif;
        }
        
        #globalTimerBox svg {
            width: 16px;
            height: 16px;
            color: var(--md-primary, #6750a4);
            margin-bottom: 1px;
        }
        
        .global-timer-value {
            font-size: 11px;
            font-weight: 600;
            color: var(--md-on-surface, #e6e1e5);
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
                bottom: 132px;
                right: 16px;
                width: 48px;
                height: 48px;
            }
            
            #globalTimerBox svg {
                width: 14px;
                height: 14px;
            }
            
            .global-timer-value {
                font-size: 10px;
            }
        }
    `;
    
    if (!document.getElementById('globalTimerStyles')) {
        document.head.appendChild(style);
    }
    
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
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 4.7s forwards;
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
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 4.7s forwards;
                cursor: pointer;
                max-width: 280px;
                transition: transform 0.15s ease;
            }
            
            .chat-popup:hover {
                transform: scale(1.02);
            }
            
            .chat-popup-avatar {
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
            
            .chat-popup-content {
                flex: 1;
                min-width: 0;
            }
            
            .chat-popup-name {
                font-size: 12px;
                color: var(--md-on-surface-variant, #aaa);
                margin-bottom: 2px;
            }
            
            .chat-popup-message {
                font-size: 14px;
                color: var(--md-on-surface, #e6e1e5);
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
                animation: popupSlideIn 0.3s ease, popupFadeOut 0.3s ease 5.7s forwards;
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
    
    // Remove after animation
    setTimeout(() => {
        popup.remove();
    }, 5000);
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
    
    // Add animation styles if not present
    if (!document.getElementById('popupAnimStyles')) {
        const style = document.createElement('style');
        style.id = 'popupAnimStyles';
        style.textContent = `
            @keyframes popupSlideIn {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
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
    const msgText = message.text || '';
    const truncatedMsg = msgText.length > 35 ? msgText.substring(0, 35) + '...' : msgText;
    
    const popup = document.createElement('div');
    popup.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: #2b2930;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        animation: popupSlideIn 0.3s ease;
        min-width: 200px;
        max-width: 300px;
    `;
    popup.onclick = () => window.location.href = 'chat.html';
    
    popup.innerHTML = `
        <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: ${senderColor}; border-radius: 50%; font-weight: 700; font-size: 16px; color: white; flex-shrink: 0;">
            ${senderName.charAt(0).toUpperCase()}
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #e6e1e5;">Neue Nachricht</div>
            <div style="font-size: 12px; color: #cac4d0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${truncatedMsg}</div>
        </div>
    `;
    
    container.appendChild(popup);
    playPopupNotificationSound();
    
    setTimeout(() => popup.remove(), 5000);
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
    popup.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--md-surface-container-high, #2b2930);
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        animation: slideIn 0.3s ease;
        min-width: 200px;
    `;
    popup.onclick = () => window.location.href = 'whiteboard.html';
    
    popup.innerHTML = `
        <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--md-primary, #6750a4); border-radius: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 18px; height: 18px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18"/>
            </svg>
        </div>
        <div>
            <div style="font-weight: 600; font-size: 13px; color: var(--md-on-surface, #e6e1e5);">Whiteboard</div>
            <div style="font-size: 11px; color: var(--md-on-surface-variant, #cac4d0);">Aktualisiert durch GM</div>
        </div>
    `;
    
    container.appendChild(popup);
    playPopupNotificationSound();
    
    setTimeout(() => popup.remove(), 5000);
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
    
    ref.on('value', (snapshot) => {
        // Check again if user is still logged in
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser) return;
        
        const data = snapshot.val();
        if (!data || !data.updatedAt) return;
        
        // Skip if this is the first load or same update
        if (lastWhiteboardUpdate === 0) {
            lastWhiteboardUpdate = data.updatedAt;
            return;
        }
        
        // Skip if not newer
        if (data.updatedAt <= lastWhiteboardUpdate) return;
        
        lastWhiteboardUpdate = data.updatedAt;
        showWhiteboardPopup();
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
                alert('Du wurdest vom GM aus dem Raum entfernt.');
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
    if (confirm(`${username} zum GM machen? Der Spieler muss zustimmen.`)) {
        // Send GM request to player via Firebase
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser) return;
        
        await getRef('gmRequests').push({
            from: currentUser.username,
            to: username,
            timestamp: Date.now()
        });
        
        alert(`GM-Anfrage an ${username} gesendet!`);
        document.getElementById('playerManagePopup')?.remove();
    }
}

async function gmRemovePlayerGM(username) {
    if (confirm(`GM-Rechte von ${username} entziehen?`)) {
        await gmUpdatePlayer(username, { isGM: false, isRoomCreator: false });
        document.getElementById('playerManagePopup')?.remove();
    }
}

async function gmKickPlayer(username) {
    if (confirm(`${username} wirklich kicken?`)) {
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
        
        if (confirm(`${request.from} (GM) möchte dir GM-Rechte übertragen. Annehmen?`)) {
            // Accept - update player to GM
            currentUser.isGM = true;
            localStorage.setItem('pnpUser', JSON.stringify(currentUser));
            
            // Update in Firebase
            await gmUpdatePlayer(currentUser.username, { isGM: true });
            
            alert('Du bist jetzt GM! Seite wird neu geladen.');
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


// ===== EXPORTS =====
// All functions are global for easy access from modules

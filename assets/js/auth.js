/**
 * RIFT v2 - Authentication & Room Management
 */

// ========================================
// USERNAME GENERATOR
// ========================================

const usernameAdjectives = [
    'Mutig', 'Still', 'Wild', 'Edel', 'Kühn', 'Stolz', 'Weise', 'Flink',
    'Dunkel', 'Hell', 'Eisern', 'Golden', 'Silbern', 'Scharf', 'Tapfer',
    'Grimmig', 'Treu', 'Listig', 'Schnell', 'Stark', 'Einsam', 'Furchtlos',
    'Mystisch', 'Schattig', 'Flammend', 'Stürmisch', 'Ruhig', 'Ewiger',
    'Vergessen', 'Wandernd', 'Jagend', 'Schweigend', 'Wachsam', 'Rasend'
];

const usernameNouns = [
    'Wolf', 'Rabe', 'Drache', 'Falke', 'Löwe', 'Bär', 'Adler', 'Fuchs',
    'Schatten', 'Sturm', 'Flamme', 'Frost', 'Donner', 'Blitz', 'Nebel',
    'Klinge', 'Schild', 'Pfeil', 'Jäger', 'Wanderer', 'Wächter', 'Krieger',
    'Magier', 'Seher', 'Schmied', 'Barde', 'Ritter', 'Späher', 'Rächer',
    'Phantom', 'Geist', 'Titan', 'Hexer', 'Druide', 'Berserker', 'Paladin'
];

function generateUsername() {
    const adj = usernameAdjectives[Math.floor(Math.random() * usernameAdjectives.length)];
    const noun = usernameNouns[Math.floor(Math.random() * usernameNouns.length)];
    const tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `${adj}${noun}#${tag}`;
}

// ========================================
// ROOM CODE GENERATOR
// ========================================

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne I, O, 0, 1 für Klarheit
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function formatRoomCode(code) {
    // Format: XXX-XXX
    return code.slice(0, 3) + '-' + code.slice(3);
}

function normalizeRoomCode(input) {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ========================================
// USER COLOR PALETTE
// ========================================

const userColors = [
    { name: 'Rot', value: '#FF4655' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Gelb', value: '#EAB308' },
    { name: 'Lime', value: '#84CC16' },
    { name: 'Grün', value: '#22C55E' },
    { name: 'Smaragd', value: '#10B981' },
    { name: 'Türkis', value: '#14B8A6' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Himmel', value: '#0EA5E9' },
    { name: 'Blau', value: '#3B82F6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Violett', value: '#8B5CF6' },
    { name: 'Lila', value: '#A855F7' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Rose', value: '#F43F5E' }
];

function getRandomColor() {
    return userColors[Math.floor(Math.random() * userColors.length)];
}

// ========================================
// ROOM MANAGEMENT (Firebase)
// ========================================

async function createRoom(hostData) {
    const code = generateRoomCode();
    const roomRef = database.ref(`rooms/${code}`);
    
    const roomData = {
        code: code,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastActivity: firebase.database.ServerValue.TIMESTAMP,
        host: hostData.odule,
        status: 'lobby',
        players: {
            [hostData.odule]: {
                name: hostData.name,
                color: hostData.color,
                isHost: true,
                isGM: true,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                online: true
            }
        }
    };
    
    await roomRef.set(roomData);
    
    // Presence System
    setupPresence(code, hostData.odule);
    
    return code;
}

async function joinRoom(code, playerData) {
    const normalizedCode = normalizeRoomCode(code);
    const roomRef = database.ref(`rooms/${normalizedCode}`);
    
    // Check if room exists
    const snapshot = await roomRef.once('value');
    if (!snapshot.exists()) {
        throw new Error('Raum nicht gefunden');
    }
    
    const room = snapshot.val();
    if (room.status === 'closed') {
        throw new Error('Dieser Raum ist geschlossen');
    }
    
    if (room.status === 'pending') {
        throw new Error('Raum wird vorbereitet - bitte warte einen Moment');
    }
    
    // Update lastActivity
    await roomRef.child('lastActivity').set(firebase.database.ServerValue.TIMESTAMP);
    
    // Add player to room
    const playerRef = roomRef.child(`players/${playerData.odule}`);
    await playerRef.set({
        name: playerData.name,
        color: playerData.color,
        isHost: false,
        isGM: false,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        online: true
    });
    
    // Presence System
    setupPresence(normalizedCode, playerData.odule);
    
    return room;
}

async function checkRoomExists(code) {
    const normalizedCode = normalizeRoomCode(code);
    const snapshot = await database.ref(`rooms/${normalizedCode}`).once('value');
    return snapshot.exists();
}

// ========================================
// ROOM RESERVATION (für Firebase-Aktivierung später)
// ========================================

/**
 * Reserviert einen Raum mit pending-Status
 * Wird aufgerufen wenn "Raum erstellen" geklickt wird
 * Status wird zu 'lobby' wenn Host enterRoom() aufruft
 */
async function reserveRoom() {
    const code = generateRoomCode();
    const roomRef = database.ref(`rooms/${code}`);
    
    // Prüfen ob Code bereits existiert (extrem unwahrscheinlich)
    const snapshot = await roomRef.once('value');
    if (snapshot.exists()) {
        return reserveRoom(); // Rekursiv neu versuchen
    }
    
    await roomRef.set({
        code: code,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastActivity: firebase.database.ServerValue.TIMESTAMP,
        status: 'pending',
        host: null,
        players: {}
    });
    
    return code;
}

/**
 * Aktiviert einen reservierten Raum und fügt Host hinzu
 */
async function activateRoom(code, hostData) {
    const normalizedCode = normalizeRoomCode(code);
    const roomRef = database.ref(`rooms/${normalizedCode}`);
    
    await roomRef.update({
        host: hostData.odule,
        status: 'lobby',
        lastActivity: firebase.database.ServerValue.TIMESTAMP,
        [`players/${hostData.odule}`]: {
            name: hostData.name,
            color: hostData.color,
            isHost: true,
            isGM: true,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            online: true
        }
    });
    
    setupPresence(normalizedCode, hostData.odule);
    return normalizedCode;
}

function setupPresence(roomCode, odule) {
    const playerRef = database.ref(`rooms/${roomCode}/players/${odule}`);
    const connectedRef = database.ref('.info/connected');
    
    connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            playerRef.update({ online: true });
            playerRef.onDisconnect().update({ 
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP 
            });
        }
    });
}

// ========================================
// LOCAL STORAGE (Legacy - use RIFT.user instead)
// ========================================

const AUTH_STORAGE_KEYS = {
    USER: 'rift_user',
    ROOM: 'rift_current_room',
    SETTINGS: 'rift_settings'
};

function saveUserData(data) {
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(data));
}

function getUserData() {
    const data = localStorage.getItem(AUTH_STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
}

function saveCurrentRoom(code) {
    localStorage.setItem(AUTH_STORAGE_KEYS.ROOM, code);
}

function getCurrentRoom() {
    return localStorage.getItem(AUTH_STORAGE_KEYS.ROOM);
}

function clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    localStorage.removeItem(AUTH_STORAGE_KEYS.ROOM);
}

// ========================================
// LOGIN UI CONTROLLER
// ========================================

class LoginController {
    constructor() {
        this.currentStep = 'welcome'; // welcome, join, create, setup
        this.roomCode = null;
        this.isCreating = false;
        this.oauthUser = null; // Stores OAuth user data if signed in via Google/Discord
        this.init();
    }
    
    init() {
        // Initialize Firebase
        if (window.RIFT?.firebase?.init) {
            window.RIFT.firebase.init();
        }
        
        // Check for existing session
        const existingUser = getUserData();
        const existingRoom = getCurrentRoom();
        
        if (existingUser && existingRoom) {
            // Auto-rejoin could go here
            // For now, show welcome screen
        }
        
        this.bindEvents();
        this.generateInitialUsername();
        this.renderColorPalette();
    }
    
    bindEvents() {
        // Welcome Screen Buttons
        document.getElementById('btn-create-room')?.addEventListener('click', () => {
            this.showStep('create');
            this.generateNewRoom();
        });
        
        document.getElementById('btn-join-room')?.addEventListener('click', () => {
            this.showStep('join');
        });
        
        // Join Room
        document.getElementById('btn-check-code')?.addEventListener('click', () => {
            this.checkAndJoinRoom();
        });
        
        document.getElementById('room-code-input')?.addEventListener('input', (e) => {
            this.formatCodeInput(e.target);
        });
        
        document.getElementById('room-code-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.checkAndJoinRoom();
        });
        
        // Create Room - Continue
        document.getElementById('btn-continue-setup')?.addEventListener('click', () => {
            this.showStep('setup');
        });
        
        // Copy Room Code
        document.getElementById('btn-copy-code')?.addEventListener('click', () => {
            this.copyRoomCode();
        });
        
        // Username Generator
        document.getElementById('btn-random-name')?.addEventListener('click', () => {
            this.generateInitialUsername();
        });
        
        // Username Input - update preview on typing
        document.getElementById('username-input')?.addEventListener('input', () => {
            this.updatePreview();
        });
        
        // Final Join
        document.getElementById('btn-enter-room')?.addEventListener('click', () => {
            this.enterRoom();
        });
        
        // Back Buttons
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => this.showStep('welcome'));
        });
        
        document.getElementById('btn-back-to-room')?.addEventListener('click', () => {
            this.showStep(this.isCreating ? 'create' : 'join');
        });
        
        // OAuth Login Buttons
        document.getElementById('btn-google-login')?.addEventListener('click', () => {
            this.signInWithGoogle();
        });
        
        document.getElementById('btn-discord-login')?.addEventListener('click', () => {
            this.signInWithDiscord();
        });
    }
    
    showStep(step) {
        this.currentStep = step;
        
        // Hide all steps
        document.querySelectorAll('.login-step').forEach(el => {
            el.classList.remove('active');
        });
        
        // Show target step
        const targetStep = document.getElementById(`step-${step}`);
        if (targetStep) {
            targetStep.classList.add('active');
        }
        
        // Focus appropriate input and update preview
        setTimeout(() => {
            if (step === 'join') {
                document.getElementById('room-code-input')?.focus();
            } else if (step === 'setup') {
                document.getElementById('username-input')?.focus();
                this.updatePreview();
            }
        }, 300);
    }
    
    generateNewRoom() {
        this.isCreating = true;
        this.roomCode = generateRoomCode();
        
        const codeDisplay = document.getElementById('generated-code');
        if (codeDisplay) {
            codeDisplay.textContent = formatRoomCode(this.roomCode);
        }
    }
    
    formatCodeInput(input) {
        let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        if (value.length > 3) {
            value = value.slice(0, 3) + '-' + value.slice(3, 6);
        }
        
        input.value = value;
        
        // Enable/disable button
        const btn = document.getElementById('btn-check-code');
        if (btn) {
            btn.disabled = value.replace('-', '').length !== 6;
        }
    }
    
    async checkAndJoinRoom() {
        const input = document.getElementById('room-code-input');
        const code = normalizeRoomCode(input?.value || '');
        const errorEl = document.getElementById('join-error');
        const checkBtn = document.getElementById('btn-check-code');
        
        if (code.length !== 6) {
            this.showError(errorEl, 'Bitte gib einen 6-stelligen Code ein');
            return;
        }
        
        // Hide error
        if (errorEl) errorEl.style.display = 'none';
        
        // Show loading
        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<span class="spinner"></span> Prüfe...';
        }
        
        try {
            // Check if room exists in Firebase
            const exists = await RIFT.rooms.roomExists(code);
            
            if (!exists) {
                throw new Error('Raum nicht gefunden');
            }
            
            this.isCreating = false;
            this.roomCode = code;
            this.showStep('setup');
            
        } catch (error) {
            this.showError(errorEl, error.message || 'Raum nicht gefunden');
        } finally {
            if (checkBtn) {
                checkBtn.disabled = false;
                checkBtn.innerHTML = 'Prüfen';
            }
        }
    }
    
    showError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }
    
    generateInitialUsername() {
        const input = document.getElementById('username-input');
        if (input) {
            input.value = generateUsername();
        }
        this.updatePreview();
    }
    
    renderColorPalette() {
        const container = document.getElementById('color-palette');
        if (!container) return;
        
        // Select random color initially
        const randomIndex = Math.floor(Math.random() * userColors.length);
        
        container.innerHTML = userColors.map((color, i) => `
            <button class="color-option ${i === randomIndex ? 'selected' : ''}" 
                    data-color="${color.value}" 
                    style="background: ${color.value}"
                    title="${color.name}">
            </button>
        `).join('');
        
        // Bind color selection
        container.querySelectorAll('.color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.updatePreview();
            });
        });
        
        this.updatePreview();
    }
    
    getSelectedColor() {
        const selected = document.querySelector('.color-option.selected');
        return selected?.dataset.color || userColors[0].value;
    }
    
    updatePreview() {
        const input = document.getElementById('username-input');
        const preview = document.getElementById('avatar-preview');
        const namePreview = document.getElementById('name-preview');
        const color = this.getSelectedColor();
        
        if (preview) {
            const name = input?.value || 'U';
            preview.textContent = name.charAt(0).toUpperCase();
            preview.style.background = color;
        }
        
        if (namePreview && input) {
            namePreview.textContent = input.value;
            namePreview.style.color = color;
        }
    }
    
    copyRoomCode() {
        const code = formatRoomCode(this.roomCode);
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('btn-copy-code');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Kopiert!';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success(`Code ${code} kopiert`, 'Raum-Code');
            }
        });
    }
    
    async signInWithGoogle() {
        const btn = document.getElementById('btn-google-login');
        const originalContent = btn?.innerHTML;
        
        try {
            // Show loading
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner"></div><span>Wird geladen...</span>';
            }
            
            // Sign in with Google
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            
            console.log('[Auth] Google sign-in successful:', user.displayName);
            
            // Fill in the form with Google data
            const usernameInput = document.getElementById('username-input');
            if (usernameInput && user.displayName) {
                // Use display name + random discriminator
                const discriminator = Math.floor(1000 + Math.random() * 9000);
                usernameInput.value = `${user.displayName}#${discriminator}`;
            }
            
            // Store OAuth info for later
            this.oauthUser = {
                provider: 'google',
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL
            };
            
            // Show connected state
            this.showOAuthConnected('google', user.displayName, user.photoURL);
            
            // Update preview
            this.updatePreview();
            
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success(`Angemeldet als ${user.displayName}`, 'Google');
            }
            
        } catch (error) {
            console.error('[Auth] Google sign-in error:', error);
            
            // Restore button
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
            
            if (error.code !== 'auth/popup-closed-by-user') {
                if (window.RIFT?.ui?.Toast) {
                    RIFT.ui.Toast.error(error.message || 'Google-Anmeldung fehlgeschlagen', 'Fehler');
                }
            }
        }
    }
    
    async signInWithDiscord() {
        const btn = document.getElementById('btn-discord-login');
        
        // Discord requires a backend for OAuth token exchange
        // For now, show a message that it's coming soon
        if (window.RIFT?.ui?.Toast) {
            RIFT.ui.Toast.info('Discord-Anmeldung kommt bald!', 'In Entwicklung');
        }
        
        // TODO: Implement Discord OAuth with Cloud Functions
        // 1. Redirect to Discord OAuth
        // 2. Cloud Function handles callback and creates Firebase custom token
        // 3. Sign in with custom token
    }
    
    showOAuthConnected(provider, name, photoURL) {
        const oauthSection = document.querySelector('.oauth-section');
        if (!oauthSection) return;
        
        const providerNames = {
            google: 'Google',
            discord: 'Discord'
        };
        
        oauthSection.innerHTML = `
            <div class="oauth-connected">
                <img src="${photoURL || 'assets/img/default-avatar.png'}" alt="" class="oauth-connected__avatar" onerror="this.style.display='none'">
                <div class="oauth-connected__info">
                    <div class="oauth-connected__name">${name}</div>
                    <div class="oauth-connected__provider">Angemeldet mit ${providerNames[provider]}</div>
                </div>
                <div class="oauth-connected__check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
            </div>
        `;
        
        // Hide divider
        const divider = document.querySelector('.oauth-divider');
        if (divider) divider.style.display = 'none';
    }
    
    async enterRoom() {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput?.value?.trim();
        const color = this.getSelectedColor();
        const enterBtn = document.querySelector('.login-actions .btn--primary');
        
        if (!username || username.length < 3) {
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.error('Bitte gib einen Namen mit mindestens 3 Zeichen ein', 'Ungültiger Name');
            }
            return;
        }
        
        // Show loading
        if (enterBtn && window.RIFT?.ui?.Button) {
            RIFT.ui.Button.setLoading(enterBtn, true);
        }
        
        try {
            let firebaseUser;
            
            // Check if already signed in via OAuth
            const currentUser = firebase.auth().currentUser;
            if (currentUser && this.oauthUser) {
                // Use existing OAuth user
                firebaseUser = currentUser;
                console.log('[Auth] Using existing OAuth user:', firebaseUser.uid);
            } else {
                // Sign in anonymously
                firebaseUser = await RIFT.firebase.signInAnonymously();
                console.log('[Auth] Signed in anonymously:', firebaseUser.uid);
            }
            
            // 2. Create user profile in Firestore
            const profileData = {
                displayName: username,
                color: color
            };
            
            // Add OAuth data if available
            if (this.oauthUser) {
                profileData.provider = this.oauthUser.provider;
                profileData.email = this.oauthUser.email;
                profileData.photoURL = this.oauthUser.photoURL;
            }
            
            const profile = await RIFT.user.createOrUpdateProfile(firebaseUser, profileData);
            
            const userData = {
                uid: firebaseUser.uid,
                name: username,
                color: color,
                initial: username.charAt(0).toUpperCase(),
                isGM: this.isCreating,
                provider: this.oauthUser?.provider || 'anonymous',
                avatar: this.oauthUser?.photoURL || null
            };
            
            // 3. Create or join room in Firestore
            if (this.isCreating) {
                // Create new room
                const room = await RIFT.rooms.createRoom({
                    name: `${username}'s Kampagne`,
                    ruleset: 'worldsapart', // Default, kann später geändert werden
                    gm: userData
                });
                this.roomCode = room.code;
                console.log('[Auth] Created room:', room.code);
                
                // Add room to user's room list
                await RIFT.user.addRoomToUser(firebaseUser.uid, room.code, 'gm');
                
            } else {
                // Join existing room
                await RIFT.rooms.joinRoom(this.roomCode, userData);
                console.log('[Auth] Joined room:', this.roomCode);
                
                // Add room to user's room list
                await RIFT.user.addRoomToUser(firebaseUser.uid, this.roomCode, 'player');
            }
            
            // 4. Setup presence tracking
            RIFT.rooms.setupPresence(this.roomCode, firebaseUser.uid);
            
            // 5. Save to localStorage (backup)
            RIFT.user.saveUserToStorage(userData);
            RIFT.user.saveCurrentRoom(this.roomCode);
            RIFT.user.saveLastSession({
                roomCode: formatRoomCode(this.roomCode),
                playerName: username
            });
            
            // Success toast
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success(this.isCreating ? 'Raum erstellt!' : 'Raum beigetreten!');
            }
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
            
        } catch (error) {
            console.error('[Auth] Error:', error);
            if (enterBtn && window.RIFT?.ui?.Button) {
                RIFT.ui.Button.setLoading(enterBtn, false);
            }
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.error(error.message || 'Ein Fehler ist aufgetreten', 'Fehler');
            }
        }
    }
}

// ========================================
// EXPORT
// ========================================

if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.auth = {
        LoginController,
        generateUsername,
        generateRoomCode,
        formatRoomCode,
        userColors,
        getUserData,
        getCurrentRoom,
        clearSession,
        // Für Firebase-Aktivierung später:
        reserveRoom,
        activateRoom,
        checkRoomExists
    };
}

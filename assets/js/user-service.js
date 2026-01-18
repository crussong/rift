/**
 * RIFT v2 - User Service
 * Handles user profile and authentication state
 */

// ========================================
// LOCAL USER STATE
// ========================================

let currentUser = null;
let authUnsubscribe = null;

// ========================================
// USER PROFILE OPERATIONS
// ========================================

/**
 * Create or update user profile in Firestore
 */
async function createOrUpdateProfile(user, additionalData = {}) {
    const db = RIFT.firebase.getFirestore();
    if (!db || !user) return null;
    
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
        // New user - create profile
        const profileData = {
            oderId: user.uid,
            displayName: additionalData.displayName || user.displayName || generateDisplayName(),
            name: additionalData.displayName || user.displayName || generateDisplayName(),
            email: user.email || null,
            photoURL: user.photoURL || null,
            color: additionalData.color || getRandomColor(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await userRef.set(profileData);
        console.log('[UserService] Created new profile:', user.uid);
        return { ...profileData, uid: user.uid };
        
    } else {
        // Existing user - update lastSeen and any new data
        const existingData = userDoc.data();
        
        // Also get localStorage data for avatar that might not be in Firestore yet
        const localStored = getUserFromStorage();
        
        const updates = {
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Only update if new data provided
        if (additionalData.displayName) {
            updates.displayName = additionalData.displayName;
            updates.name = additionalData.displayName;
        }
        if (additionalData.color) {
            updates.color = additionalData.color;
        }
        
        await userRef.update(updates);
        console.log('[UserService] Updated profile:', user.uid);
        
        // Return existing data merged with updates AND localStorage avatar
        return {
            uid: user.uid,
            displayName: updates.displayName || existingData.displayName || existingData.name,
            name: updates.name || existingData.name || existingData.displayName,
            color: updates.color || existingData.color,
            email: existingData.email,
            // Prioritize localStorage avatar over Firestore photoURL
            avatar: localStored?.avatar || existingData.avatar || existingData.photoURL || null,
            photoURL: localStored?.avatar || existingData.avatar || existingData.photoURL || null,
            isGM: localStored?.isGM !== undefined ? localStored.isGM : (existingData.isGM || false)
        };
    }
}

/**
 * Get user profile from Firestore
 */
async function getProfile(oderId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return null;
    
    const userDoc = await db.collection('users').doc(oderId).get();
    
    if (!userDoc.exists) {
        return null;
    }
    
    return { id: userDoc.id, ...userDoc.data() };
}

/**
 * Update user profile
 */
async function updateProfile(oderId, updates) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    await db.collection('users').doc(oderId).update({
        ...updates,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('[UserService] Profile updated:', oderId);
}

/**
 * Get user's rooms (where they are a member)
 */
async function getUserRooms(oderId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return [];
    
    // Query all rooms where user is a member
    // Note: This requires a collection group query or denormalized data
    // For now, we'll store room memberships on the user document
    
    const userDoc = await db.collection('users').doc(oderId).get();
    if (!userDoc.exists) return [];
    
    const userData = userDoc.data();
    return userData.rooms || [];
}

/**
 * Add room to user's room list
 */
async function addRoomToUser(oderId, roomCode, role = 'player') {
    const db = RIFT.firebase.getFirestore();
    if (!db) return;
    
    await db.collection('users').doc(oderId).update({
        rooms: firebase.firestore.FieldValue.arrayUnion({
            code: roomCode,
            role: role,
            joinedAt: new Date().toISOString()
        })
    });
}

/**
 * Remove room from user's room list
 */
async function removeRoomFromUser(oderId, roomCode) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return;
    
    const userDoc = await db.collection('users').doc(oderId).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    const updatedRooms = (userData.rooms || []).filter(r => r.code !== roomCode);
    
    await db.collection('users').doc(oderId).update({
        rooms: updatedRooms
    });
}

// ========================================
// AUTH HELPERS
// ========================================

/**
 * Generate a random display name
 */
function generateDisplayName() {
    const adjectives = [
        'Mutig', 'Still', 'Wild', 'Edel', 'Kühn', 'Stolz', 'Weise', 'Flink',
        'Dunkel', 'Hell', 'Eisern', 'Golden', 'Silbern', 'Tapfer', 'Furchtlos',
        'Mystisch', 'Flammend', 'Stürmisch', 'Ewiger', 'Wandernd', 'Wachsam'
    ];
    
    const nouns = [
        'Wolf', 'Rabe', 'Drache', 'Falke', 'Löwe', 'Bär', 'Adler', 'Fuchs',
        'Schatten', 'Sturm', 'Flamme', 'Frost', 'Donner', 'Blitz', 'Nebel',
        'Jäger', 'Wanderer', 'Wächter', 'Krieger', 'Magier', 'Ritter', 'Hexer'
    ];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const tag = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    
    return `${adj}${noun}#${tag}`;
}

/**
 * Get a random color from the palette
 */
function getRandomColor() {
    const colors = [
        '#FF4655', '#F97316', '#F59E0B', '#EAB308',
        '#84CC16', '#22C55E', '#10B981', '#14B8A6',
        '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
        '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Initialize auth state listener
 */
function initAuthListener(callback) {
    if (authUnsubscribe) {
        authUnsubscribe();
    }
    
    authUnsubscribe = RIFT.firebase.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            try {
                const profile = await createOrUpdateProfile(user);
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    isAnonymous: user.isAnonymous,
                    ...profile
                };
                
                // Also update localStorage with latest data
                saveUserToStorage(currentUser);
                
            } catch (error) {
                console.warn('[UserService] Could not load profile from Firestore, using localStorage:', error.message);
                // Fallback to localStorage
                const stored = getUserFromStorage();
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    isAnonymous: user.isAnonymous,
                    displayName: stored?.name || stored?.displayName || generateDisplayName(),
                    name: stored?.name || stored?.displayName || 'Spieler',
                    color: stored?.color || getRandomColor(),
                    avatar: stored?.avatar || stored?.photoURL || null,
                    photoURL: stored?.avatar || stored?.photoURL || user.photoURL || null,
                    isGM: stored?.isGM || false
                };
            }
            
            // Store in window for global access
            window.currentUser = currentUser;
            
            console.log('[UserService] Auth state: signed in', currentUser.displayName || currentUser.name);
        } else {
            // User is signed out
            currentUser = null;
            window.currentUser = null;
            console.log('[UserService] Auth state: signed out');
        }
        
        if (callback) {
            callback(currentUser);
        }
    });
    
    return authUnsubscribe;
}

/**
 * Get current user
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Sign in as guest (anonymous)
 */
async function signInAsGuest(displayName = null, color = null) {
    const user = await RIFT.firebase.signInAnonymously();
    
    // Create profile with custom name/color if provided
    await createOrUpdateProfile(user, {
        displayName: displayName || generateDisplayName(),
        color: color || getRandomColor()
    });
    
    return user;
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
    const user = await RIFT.firebase.signInWithGoogle();
    
    // Create/update profile
    await createOrUpdateProfile(user);
    
    return user;
}

/**
 * Sign out
 */
async function signOut() {
    await RIFT.firebase.signOut();
    currentUser = null;
    window.currentUser = null;
}

/**
 * Link anonymous account to Google
 */
async function linkToGoogle() {
    const auth = RIFT.firebase.getAuth();
    if (!auth || !auth.currentUser) {
        throw new Error('Kein angemeldeter User');
    }
    
    if (!auth.currentUser.isAnonymous) {
        throw new Error('Account ist bereits verknüpft');
    }
    
    const provider = new firebase.auth.GoogleAuthProvider();
    
    try {
        const result = await auth.currentUser.linkWithPopup(provider);
        console.log('[UserService] Linked to Google:', result.user.email);
        
        // Update profile with Google data
        await updateProfile(result.user.uid, {
            email: result.user.email,
            displayName: result.user.displayName || currentUser.displayName,
            photoURL: result.user.photoURL
        });
        
        return result.user;
    } catch (error) {
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error('Dieses Google-Konto ist bereits mit einem anderen Account verknüpft');
        }
        throw error;
    }
}

// ========================================
// LOCAL STORAGE SYNC
// ========================================

const STORAGE_KEYS = {
    USER: 'rift_user',
    ROOM: 'rift_current_room',
    LAST_SESSION: 'rift_last_session'
};

/**
 * Save user data to localStorage (backup/offline)
 */
function saveUserToStorage(userData) {
    if (!userData) {
        localStorage.removeItem(STORAGE_KEYS.USER);
        return;
    }
    
    const name = userData.displayName || userData.name || 'Spieler';
    
    // IMPORTANT: Preserve existing avatar from localStorage if not in new data
    const existingData = getUserFromStorage();
    const avatar = userData.avatar || userData.photoURL || existingData?.avatar || null;
    
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({
        uid: userData.uid,
        name: name,
        displayName: name,
        initial: name.charAt(0).toUpperCase(),
        color: userData.color || '#FF4655',
        email: userData.email || null,
        avatar: avatar,
        photoURL: avatar,
        isAnonymous: userData.isAnonymous || false,
        isGM: userData.isGM || existingData?.isGM || false
    }));
}

/**
 * Get user data from localStorage
 */
function getUserFromStorage() {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
}

/**
 * Save current room to localStorage
 */
function saveCurrentRoom(code) {
    if (!code) {
        localStorage.removeItem(STORAGE_KEYS.ROOM);
        return;
    }
    localStorage.setItem(STORAGE_KEYS.ROOM, code);
}

/**
 * Get current room from localStorage
 */
function getCurrentRoom() {
    return localStorage.getItem(STORAGE_KEYS.ROOM);
}

/**
 * Save last session info (for "Resume" feature)
 */
function saveLastSession(sessionInfo) {
    localStorage.setItem(STORAGE_KEYS.LAST_SESSION, JSON.stringify({
        ...sessionInfo,
        timestamp: Date.now()
    }));
}

/**
 * Get last session info
 */
function getLastSession() {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_SESSION);
    return data ? JSON.parse(data) : null;
}

/**
 * Clear all session data
 */
function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ROOM);
    localStorage.removeItem(STORAGE_KEYS.LAST_SESSION);
}

// ========================================
// EXPORT
// ========================================

if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.user = {
        // Auth
        initAuthListener,
        getCurrentUser,
        signInAsGuest,
        signInWithGoogle,
        signOut,
        linkToGoogle,
        
        // Profile
        getProfile,
        updateProfile,
        createOrUpdateProfile,
        
        // Rooms
        getUserRooms,
        addRoomToUser,
        removeRoomFromUser,
        
        // Helpers
        generateDisplayName,
        getRandomColor,
        
        // Storage
        saveUserToStorage,
        getUserFromStorage,
        saveCurrentRoom,
        getCurrentRoom,
        saveLastSession,
        getLastSession,
        clearSession
    };
}

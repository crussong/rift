/**
 * RIFT v2 - Room Service
 * Handles all room/campaign operations with Firestore
 * 
 * Firestore Structure:
 * 
 * /rooms/{roomCode}
 *   - code: string
 *   - name: string
 *   - ruleset: string (5e2024, worldsapart, htbah, cyberpunk)
 *   - createdAt: timestamp
 *   - gmId: string (user uid)
 *   - gmName: string
 *   - settings: { maxPlayers, visibility, etc. }
 *   - status: 'active' | 'archived'
 * 
 * /rooms/{roomCode}/members/{oderId}
 *   - oderId: string
 *   - name: string
 *   - color: string
 *   - joinedAt: timestamp
 *   - role: 'gm' | 'player'
 *   - online: boolean
 *   - assignedCharacterId: string | null
 * 
 * /rooms/{roomCode}/characters/{charId}
 *   - id: string
 *   - ownerId: string (user who owns this copy)
 *   - templateId: string (original character id, if copied)
 *   - name: string
 *   - ruleset: string
 *   - data: { ...full character data }
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 * 
 * /rooms/{roomCode}/sessions/{sessionId}
 *   - id: string
 *   - name: string
 *   - date: timestamp
 *   - status: 'planned' | 'live' | 'paused' | 'ended'
 *   - ...session data
 * 
 * /users/{oderId}
 *   - oderId: string
 *   - displayName: string
 *   - email: string (if google auth)
 *   - color: string
 *   - createdAt: timestamp
 *   - lastSeen: timestamp
 * 
 * /users/{oderId}/characterTemplates/{charId}
 *   - User's global character templates (can be copied to rooms)
 */

// ========================================
// ROOM CODE GENERATOR
// ========================================

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne I, O, 0, 1

function generateRoomCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    }
    return code;
}

function formatRoomCode(code) {
    if (!code) return '';
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.slice(0, 3) + '-' + clean.slice(3, 6);
}

function normalizeRoomCode(input) {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

// ========================================
// ROOM OPERATIONS
// ========================================

/**
 * Create a new room
 */
async function createRoom({ name, ruleset, gm }) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    // Generate unique code
    let code = generateRoomCode();
    let attempts = 0;
    
    // Ensure unique code
    while (attempts < 10) {
        const existing = await db.collection('rooms').doc(code).get();
        if (!existing.exists) break;
        code = generateRoomCode();
        attempts++;
    }
    
    if (attempts >= 10) {
        throw new Error('Konnte keinen eindeutigen Raum-Code generieren');
    }
    
    const roomData = {
        code,
        name: name || `${gm.name}'s Kampagne`,
        ruleset: ruleset || 'worldsapart',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        gmId: gm.uid,
        gmName: gm.name,
        status: 'active',
        settings: {
            maxPlayers: 6,
            visibility: 'private'
        }
    };
    
    // Create room document
    await db.collection('rooms').doc(code).set(roomData);
    
    // Add GM as first member
    await db.collection('rooms').doc(code).collection('members').doc(gm.uid).set({
        userId: gm.uid,
        name: gm.name || gm.displayName,
        displayName: gm.displayName || gm.name,
        color: gm.color || '#8B5CF6',
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        role: 'gm',
        online: true,
        assignedCharacterId: null
    });
    
    console.log('[RoomService] Created room:', code);
    return { code, ...roomData };
}

/**
 * Join an existing room
 */
async function joinRoom(code, user) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    const roomRef = db.collection('rooms').doc(normalizedCode);
    const roomDoc = await roomRef.get();
    
    if (!roomDoc.exists) {
        throw new Error('Raum nicht gefunden');
    }
    
    const roomData = roomDoc.data();
    
    if (roomData.status === 'archived') {
        throw new Error('Dieser Raum wurde archiviert');
    }
    
    // Check if already member
    const memberRef = roomRef.collection('members').doc(user.uid);
    const memberDoc = await memberRef.get();
    
    if (memberDoc.exists) {
        // Already a member, just update online status
        await memberRef.update({
            online: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        // Add as new member
        await memberRef.set({
            userId: user.uid,
            name: user.name || user.displayName,
            displayName: user.displayName || user.name,
            color: user.color || '#8B5CF6',
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            role: 'player',
            online: true,
            assignedCharacterId: null
        });
    }
    
    console.log('[RoomService] Joined room:', normalizedCode);
    return { code: normalizedCode, ...roomData };
}

/**
 * Get room data
 */
async function getRoom(code) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    const roomDoc = await db.collection('rooms').doc(normalizedCode).get();
    
    if (!roomDoc.exists) {
        return null;
    }
    
    return { id: roomDoc.id, ...roomDoc.data() };
}

/**
 * Check if room exists
 */
async function roomExists(code) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return false;
    
    const normalizedCode = normalizeRoomCode(code);
    const roomDoc = await db.collection('rooms').doc(normalizedCode).get();
    return roomDoc.exists;
}

/**
 * Get current user's role in a room
 * @returns {Promise<'gm'|'player'|null>} Role or null if not a member
 */
async function getUserRole(code, userId) {
    const db = RIFT.firebase.getFirestore();
    if (!db || !code || !userId) return null;
    
    try {
        const normalizedCode = normalizeRoomCode(code);
        const memberDoc = await db.collection('rooms').doc(normalizedCode)
            .collection('members').doc(userId).get();
        
        if (!memberDoc.exists) return null;
        return memberDoc.data().role || 'player';
    } catch (e) {
        console.warn('[RoomService] getUserRole error:', e);
        return null;
    }
}

/**
 * Check if user is GM of a room
 * @param {string} code - Room code
 * @param {string} [userId] - User ID (defaults to current user)
 */
async function isUserGM(code, userId) {
    // Default to current user
    if (!userId) {
        userId = firebase?.auth()?.currentUser?.uid;
    }
    if (!userId) return false;
    
    try {
        // First check room's gmId (faster)
        const room = await getRoom(code);
        if (room && room.gmId === userId) return true;
        
        // Fallback to member role check
        const role = await getUserRole(code, userId);
        return role === 'gm';
    } catch (e) {
        console.error('[RoomService] isUserGM error:', e);
        return false;
    }
}

/**
 * Get current user's membership info for a room
 */
async function getCurrentMembership(code) {
    const db = RIFT.firebase.getFirestore();
    const currentUser = firebase.auth().currentUser;
    if (!db || !code || !currentUser) return null;
    
    try {
        const normalizedCode = normalizeRoomCode(code);
        
        // Get room data
        const roomDoc = await db.collection('rooms').doc(normalizedCode).get();
        if (!roomDoc.exists) return null;
        const roomData = roomDoc.data();
        
        // Get member data
        const memberDoc = await db.collection('rooms').doc(normalizedCode)
            .collection('members').doc(currentUser.uid).get();
        
        if (!memberDoc.exists) return null;
        const memberData = memberDoc.data();
        
        return {
            oderId: currentUser.uid,
            roomCode: normalizedCode,
            role: memberData.role || 'player',
            isGM: roomData.gmId === currentUser.uid || memberData.role === 'gm',
            isOwner: roomData.gmId === currentUser.uid,
            joinedAt: memberData.joinedAt,
            roomName: roomData.name,
            ruleset: roomData.ruleset
        };
    } catch (e) {
        console.warn('[RoomService] getCurrentMembership error:', e);
        return null;
    }
}

/**
 * Get room members
 */
async function getRoomMembers(code) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    const membersSnap = await db.collection('rooms').doc(normalizedCode)
        .collection('members').get();
    
    return membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Listen to room changes (realtime)
 */
function subscribeToRoom(code, callback) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return () => {};
    
    const normalizedCode = normalizeRoomCode(code);
    return db.collection('rooms').doc(normalizedCode)
        .onSnapshot(doc => {
            if (doc.exists) {
                callback({ id: doc.id, ...doc.data() });
            } else {
                callback(null);
            }
        });
}

/**
 * Listen to room members (realtime)
 */
function subscribeToMembers(code, callback) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return () => {};
    
    const normalizedCode = normalizeRoomCode(code);
    return db.collection('rooms').doc(normalizedCode)
        .collection('members')
        .onSnapshot(snapshot => {
            const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(members);
        });
}

/**
 * Leave room
 */
async function leaveRoom(code, oderId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    await db.collection('rooms').doc(normalizedCode)
        .collection('members').doc(oderId).delete();
    
    console.log('[RoomService] Left room:', normalizedCode);
}

/**
 * Update member status (online/offline)
 */
async function updateMemberStatus(code, oderId, online) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return;
    
    const normalizedCode = normalizeRoomCode(code);
    await db.collection('rooms').doc(normalizedCode)
        .collection('members').doc(oderId)
        .update({
            online,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
}

// ========================================
// CHARACTER OPERATIONS (in Room context)
// ========================================

/**
 * Add character to room (copy from template or create new)
 */
async function addCharacterToRoom(code, character, ownerId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    const charId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const charData = {
        id: charId,
        ownerId,
        templateId: character.templateId || null,
        name: character.name,
        ruleset: character.ruleset,
        data: character.data || character,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('rooms').doc(normalizedCode)
        .collection('characters').doc(charId).set(charData);
    
    console.log('[RoomService] Added character to room:', charId);
    return { id: charId, ...charData };
}

/**
 * Get all characters in room
 */
async function getRoomCharacters(code) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    const charsSnap = await db.collection('rooms').doc(normalizedCode)
        .collection('characters').get();
    
    return charsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get characters for a specific player in room
 */
async function getPlayerCharacters(code, ownerId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    const charsSnap = await db.collection('rooms').doc(normalizedCode)
        .collection('characters')
        .where('ownerId', '==', ownerId)
        .get();
    
    return charsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update character in room
 */
async function updateRoomCharacter(code, charId, updates) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    await db.collection('rooms').doc(normalizedCode)
        .collection('characters').doc(charId)
        .update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    
    console.log('[RoomService] Updated character:', charId);
}

/**
 * Assign character to member
 */
async function assignCharacterToMember(code, oderId, charId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(code);
    await db.collection('rooms').doc(normalizedCode)
        .collection('members').doc(oderId)
        .update({ assignedCharacterId: charId });
    
    console.log('[RoomService] Assigned character', charId, 'to member', oderId);
}

/**
 * Listen to room characters (realtime)
 */
function subscribeToCharacters(code, callback) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return () => {};
    
    const normalizedCode = normalizeRoomCode(code);
    return db.collection('rooms').doc(normalizedCode)
        .collection('characters')
        .onSnapshot(snapshot => {
            const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(characters);
        });
}

// ========================================
// USER CHARACTER TEMPLATES
// ========================================

/**
 * Save character as user template (global)
 */
async function saveCharacterTemplate(oderId, character) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const templateId = character.id || `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const templateData = {
        id: templateId,
        name: character.name,
        ruleset: character.ruleset,
        data: character.data || character,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(oderId)
        .collection('characterTemplates').doc(templateId).set(templateData);
    
    console.log('[RoomService] Saved character template:', templateId);
    return { id: templateId, ...templateData };
}

/**
 * Get user's character templates
 */
async function getCharacterTemplates(oderId, ruleset = null) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    let query = db.collection('users').doc(oderId).collection('characterTemplates');
    
    if (ruleset) {
        query = query.where('ruleset', '==', ruleset);
    }
    
    const templatesSnap = await query.get();
    return templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Copy template to room
 */
async function copyTemplateToRoom(code, templateId, ownerId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    // Get template
    const templateDoc = await db.collection('users').doc(ownerId)
        .collection('characterTemplates').doc(templateId).get();
    
    if (!templateDoc.exists) {
        throw new Error('Vorlage nicht gefunden');
    }
    
    const template = templateDoc.data();
    
    // Create copy in room
    return addCharacterToRoom(code, {
        ...template,
        templateId: templateId
    }, ownerId);
}

// ========================================
// PRESENCE SYSTEM (Realtime Database)
// ========================================

/**
 * Setup presence tracking for a user in a room
 */
function setupPresence(code, oderId) {
    const rtdb = RIFT.firebase.getDatabase();
    const db = RIFT.firebase.getFirestore();
    if (!rtdb || !db) return () => {};
    
    const normalizedCode = normalizeRoomCode(code);
    const presenceRef = rtdb.ref(`presence/${normalizedCode}/${oderId}`);
    const connectedRef = rtdb.ref('.info/connected');
    
    const unsubscribe = connectedRef.on('value', (snapshot) => {
        if (snapshot.val() === true) {
            // User is online
            presenceRef.set({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            
            // When disconnected, update status
            presenceRef.onDisconnect().set({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Also update Firestore
            updateMemberStatus(code, oderId, true);
        }
    });
    
    // Return cleanup function
    return () => {
        connectedRef.off('value', unsubscribe);
        presenceRef.set({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
        updateMemberStatus(code, oderId, false);
    };
}

// ========================================
// SESSION OPERATIONS
// ========================================

/**
 * Create a new session in a room
 */
async function createSession(roomCode, sessionData) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(roomCode);
    const sessionId = sessionData.id || `session_${Date.now()}`;
    
    const data = {
        ...sessionData,
        id: sessionId,
        roomCode: normalizedCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('rooms').doc(normalizedCode)
        .collection('sessions').doc(sessionId).set(data);
    
    console.log('[RoomService] Created session:', sessionId);
    return { id: sessionId, ...data };
}

/**
 * Get all sessions in a room
 */
async function getSessions(roomCode) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return [];
    
    const normalizedCode = normalizeRoomCode(roomCode);
    const snapshot = await db.collection('rooms').doc(normalizedCode)
        .collection('sessions')
        .orderBy('date', 'asc')
        .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get a single session
 */
async function getSession(roomCode, sessionId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return null;
    
    const normalizedCode = normalizeRoomCode(roomCode);
    const doc = await db.collection('rooms').doc(normalizedCode)
        .collection('sessions').doc(sessionId).get();
    
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * Update a session
 */
async function updateSession(roomCode, sessionId, updates) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(roomCode);
    await db.collection('rooms').doc(normalizedCode)
        .collection('sessions').doc(sessionId).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    
    console.log('[RoomService] Updated session:', sessionId);
}

/**
 * Delete a session
 */
async function deleteSession(roomCode, sessionId) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firebase nicht initialisiert');
    
    const normalizedCode = normalizeRoomCode(roomCode);
    await db.collection('rooms').doc(normalizedCode)
        .collection('sessions').doc(sessionId).delete();
    
    console.log('[RoomService] Deleted session:', sessionId);
}

/**
 * Subscribe to sessions (realtime)
 */
function subscribeToSessions(roomCode, callback) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return () => {};
    
    const normalizedCode = normalizeRoomCode(roomCode);
    return db.collection('rooms').doc(normalizedCode)
        .collection('sessions')
        .orderBy('date', 'asc')
        .onSnapshot(snapshot => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(sessions);
        }, error => {
            console.error('[RoomService] Sessions subscription error:', error);
            callback([]);
        });
}

/**
 * Get next upcoming session
 */
async function getNextSession(roomCode) {
    const db = RIFT.firebase.getFirestore();
    if (!db) return null;
    
    const normalizedCode = normalizeRoomCode(roomCode);
    const today = new Date().toISOString().split('T')[0];
    
    const snapshot = await db.collection('rooms').doc(normalizedCode)
        .collection('sessions')
        .where('date', '>=', today)
        .where('status', 'in', ['planned', 'live'])
        .orderBy('date', 'asc')
        .limit(1)
        .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
}

// ========================================
// EXPORT
// ========================================

if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.rooms = {
        // Code helpers
        generateRoomCode,
        formatRoomCode,
        normalizeRoomCode,
        
        // Room operations
        createRoom,
        joinRoom,
        getRoom,
        roomExists,
        leaveRoom,
        getRoomMembers,
        updateMemberStatus,
        
        // Role/Membership
        getUserRole,
        isUserGM,
        getCurrentMembership,
        
        // Subscriptions
        subscribeToRoom,
        subscribeToMembers,
        subscribeToCharacters,
        subscribeToSessions,
        
        // Sessions
        createSession,
        getSessions,
        getSession,
        updateSession,
        deleteSession,
        getNextSession,
        
        // Characters in room
        addCharacterToRoom,
        getRoomCharacters,
        getPlayerCharacters,
        updateRoomCharacter,
        assignCharacterToMember,
        
        // User templates
        saveCharacterTemplate,
        getCharacterTemplates,
        copyTemplateToRoom,
        
        // Presence
        setupPresence
    };
}

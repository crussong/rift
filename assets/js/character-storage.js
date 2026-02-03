/**
 * RIFT Character Storage Manager
 * Handles saving, loading, and deleting character data
 * Uses Firebase Firestore with localStorage as cache/fallback
 */

const CharacterStorage = {
    // Storage key prefix for localStorage cache
    STORAGE_KEY: 'rift_characters',
    
    // Main character storage key
    MAIN_CHAR_KEY: 'rift_main_characters',
    
    // Firebase collection name
    COLLECTION: 'characters',
    
    // Maximum characters per ruleset
    MAX_PER_RULESET: 3,
    
    // Get Firestore instance
    getFirestore() {
        // Try RIFT wrapper first
        const riftDb = window.RIFT?.firebase?.getFirestore?.();
        if (riftDb) return riftDb;
        
        // Try direct Firebase access
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            try {
                return firebase.firestore();
            } catch (e) {
                console.warn('[CharacterStorage] Direct firebase.firestore() failed:', e);
            }
        }
        
        return null;
    },
    
    // Get current user ID
    getUserId() {
        // Try RIFT wrapper
        const user = window.RIFT?.firebase?.getCurrentUser?.();
        if (user?.uid) return user.uid;
        
        // Try direct Firebase access
        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                const directUser = firebase.auth().currentUser;
                if (directUser?.uid) return directUser.uid;
            } catch (e) {
                // Ignore
            }
        }
        
        // Fallback to localStorage
        return localStorage.getItem('rift_user_uid') || null;
    },
    
    // Check if Firebase is available and user is authenticated
    isOnline() {
        const db = this.getFirestore();
        const userId = this.getUserId();
        return !!(db && userId);
    },
    
    // Generate unique ID
    generateId() {
        return 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // ========================================
    // LOCAL STORAGE OPERATIONS (Cache/Fallback)
    // ========================================
    
    getLocalAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            let parsed = data ? JSON.parse(data) : {};
            
            // Auto-repair: Check if keys are numeric (broken storage)
            const keys = Object.keys(parsed);
            if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k)))) {
                console.warn('[CharacterStorage] Detected broken storage with numeric keys, repairing...');
                const fixed = {};
                Object.values(parsed).forEach(char => {
                    if (char && char.id) {
                        fixed[char.id] = char;
                    }
                });
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(fixed));
                console.log('[CharacterStorage] Repaired! New keys:', Object.keys(fixed));
                parsed = fixed;
            }
            
            return parsed;
        } catch (e) {
            console.error('[CharacterStorage] Error loading from localStorage:', e);
            return {};
        }
    },
    
    saveLocal(character) {
        try {
            const all = this.getLocalAll();
            all[character.id] = character;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            return true;
        } catch (e) {
            console.error('[CharacterStorage] Error saving to localStorage:', e);
            return false;
        }
    },
    
    deleteLocal(charId) {
        try {
            const all = this.getLocalAll();
            if (all[charId]) {
                delete all[charId];
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
                return true;
            }
            return false;
        } catch (e) {
            console.error('[CharacterStorage] Error deleting from localStorage:', e);
            return false;
        }
    },
    
    // ========================================
    // FIREBASE OPERATIONS
    // ========================================
    
    async firebaseSave(character) {
        const db = this.getFirestore();
        const userId = this.getUserId();
        
        if (!db || !userId) {
            console.log('[CharacterStorage] Firebase not available, using localStorage only');
            return null;
        }
        
        try {
            const docRef = db.collection('users').doc(userId)
                            .collection(this.COLLECTION).doc(character.id);
            
            await docRef.set({
                ...character,
                ownerId: userId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('[CharacterStorage] Saved to Firebase:', character.id);
            return character;
        } catch (e) {
            console.error('[CharacterStorage] Firebase save error:', e);
            return null;
        }
    },
    
    async firebaseDelete(charId) {
        const db = this.getFirestore();
        const userId = this.getUserId();
        
        if (!db || !userId) {
            console.log('[CharacterStorage] Firebase not available');
            return false;
        }
        
        try {
            const docRef = db.collection('users').doc(userId)
                            .collection(this.COLLECTION).doc(charId);
            
            await docRef.delete();
            console.log('[CharacterStorage] Deleted from Firebase:', charId);
            return true;
        } catch (e) {
            console.error('[CharacterStorage] Firebase delete error:', e);
            return false;
        }
    },
    
    async firebaseGetAll() {
        const db = this.getFirestore();
        const userId = this.getUserId();
        
        if (!db || !userId) {
            console.log('[CharacterStorage] Firebase not available');
            return null;
        }
        
        try {
            const snapshot = await db.collection('users').doc(userId)
                                    .collection(this.COLLECTION).get();
            
            const characters = {};
            snapshot.forEach(doc => {
                characters[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            console.log('[CharacterStorage] Loaded', Object.keys(characters).length, 'characters from Firebase');
            return characters;
        } catch (e) {
            console.error('[CharacterStorage] Firebase getAll error:', e);
            return null;
        }
    },
    
    // ========================================
    // MAIN API (Hybrid: Firebase + localStorage)
    // ========================================
    
    // Get all characters (sync - from cache)
    getAll() {
        const localData = this.getLocalAll();
        console.log('[CharacterStorage] getAll:', Object.keys(localData).length, 'characters (from cache)');
        return localData;
    },
    
    // Async version that syncs with Firebase
    async getAllAsync() {
        if (this.isOnline()) {
            const firebaseData = await this.firebaseGetAll();
            if (firebaseData) {
                // Update local cache
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(firebaseData));
                console.log('[CharacterStorage] Cache updated from Firebase');
                return firebaseData;
            }
        }
        return this.getLocalAll();
    },
    
    // Get characters by ruleset
    getByRuleset(rulesetId) {
        const all = this.getAll();
        const filtered = Object.values(all).filter(char => char.ruleset === rulesetId);
        console.log('[CharacterStorage] getByRuleset', rulesetId, ':', filtered.length, 'characters');
        return filtered;
    },
    
    // Get single character by ID
    getById(charId) {
        const all = this.getAll();
        const char = all[charId] || null;
        console.log('[CharacterStorage] getById', charId, ':', char ? 'found' : 'NOT FOUND');
        if (!char) {
            console.log('[CharacterStorage] Available IDs:', Object.keys(all));
        }
        return char;
    },
    
    // Save character (create or update)
    save(character) {
        try {
            // Ensure ID exists
            const isNewCharacter = !character.id || character.id === null || character.id === '';
            
            if (isNewCharacter) {
                character.id = this.generateId();
                console.log('[CharacterStorage] Generated new ID:', character.id);
                
                // Check limit for new characters
                if (character.ruleset) {
                    const existing = this.getByRuleset(character.ruleset);
                    if (existing.length >= this.MAX_PER_RULESET) {
                        console.warn('[CharacterStorage] Limit reached for ruleset:', character.ruleset);
                        throw new Error(`Maximale Anzahl von ${this.MAX_PER_RULESET} Charakteren für dieses Regelwerk erreicht!`);
                    }
                }
            }
            
            // Add timestamps
            if (!character.createdAt) {
                character.createdAt = new Date().toISOString();
            }
            character.updatedAt = new Date().toISOString();
            
            // Save to localStorage (always, synchronous)
            const all = this.getLocalAll();
            all[character.id] = character;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            
            console.log('[CharacterStorage] Saved to localStorage:', character.id, character.name);
            
            // Also save to Firebase (async, don't wait)
            if (this.isOnline()) {
                this.firebaseSave(character).catch(e => {
                    console.warn('[CharacterStorage] Firebase sync failed:', e);
                });
                
                // Also sync to room if user is in a room
                this.syncToRoom(character);
            }
            
            return character;
        } catch (e) {
            console.error('[CharacterStorage] Error saving character:', e);
            return null;
        }
    },
    
    // Sync character to current room (if in one)
    async syncToRoom(character) {
        try {
            const roomCode = localStorage.getItem('rift_current_room');
            if (!roomCode) {
                console.log('[CharacterStorage] Not in a room, skipping room sync');
                return;
            }
            
            const userId = this.getUserId();
            if (!userId) {
                console.log('[CharacterStorage] No user ID, skipping room sync');
                return;
            }
            
            // Ensure Firebase is initialized
            let db = this.getFirestore();
            if (!db) {
                // Try to initialize Firebase if RIFT.firebase.init exists
                if (window.RIFT?.firebase?.init) {
                    console.log('[CharacterStorage] Initializing Firebase for room sync...');
                    await window.RIFT.firebase.init();
                    db = this.getFirestore();
                }
                
                if (!db) {
                    console.log('[CharacterStorage] Firebase not available, skipping room sync');
                    return;
                }
            }
            
            // Check if firebase.firestore.FieldValue is available
            if (typeof firebase === 'undefined' || !firebase.firestore?.FieldValue) {
                console.log('[CharacterStorage] Firebase SDK not fully loaded, skipping room sync');
                return;
            }
            
            console.log('[CharacterStorage] Syncing character to room:', roomCode, character.id);
            
            const normalizedCode = roomCode.replace(/-/g, '').toUpperCase();
            const charRef = db.collection('rooms').doc(normalizedCode)
                             .collection('characters').doc(character.id);
            
            const charDoc = await charRef.get();
            
            // Get owner name for GM view (Multi-Character Support)
            const currentUser = firebase?.auth?.()?.currentUser;
            const ownerName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Spieler';
            
            const roomCharData = {
                id: character.id,
                ownerId: userId,
                ownerName: ownerName,
                name: character.name || 'Unbenannt',
                ruleset: character.ruleset,
                class: character.class || '',
                race: character.race || '',
                level: character.level || 1,
                portrait: character.portrait || null,
                data: character.data || character,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (charDoc.exists) {
                // Update existing
                await charRef.update(roomCharData);
                console.log('[CharacterStorage] Updated character in room:', character.id);
            } else {
                // Create new
                roomCharData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await charRef.set(roomCharData);
                console.log('[CharacterStorage] Added character to room:', character.id);
            }
        } catch (e) {
            console.warn('[CharacterStorage] Room sync failed:', e.message || e);
            // Don't throw - room sync is optional
        }
    },
    
    // Delete character
    delete(charId) {
        try {
            console.log('[CharacterStorage] Attempting to delete:', charId);
            
            // Validate charId
            if (!charId || charId === 'undefined' || charId === 'null') {
                console.error('[CharacterStorage] Invalid charId:', charId);
                return false;
            }
            
            const all = this.getLocalAll();
            
            if (!all[charId]) {
                console.warn('[CharacterStorage] Character not found in localStorage:', charId);
                console.log('[CharacterStorage] Available IDs:', Object.keys(all));
                return false;
            }
            
            const charName = all[charId].name;
            const charRuleset = all[charId].ruleset;
            delete all[charId];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            
            console.log('[CharacterStorage] Deleted from localStorage:', charId, charName);
            
            // Also clear legacy storage if this was the active character
            // Check worldsapart_character_v5
            try {
                const v5Data = localStorage.getItem('worldsapart_character_v5');
                if (v5Data) {
                    const v5Char = JSON.parse(v5Data);
                    // Match by name or _charId
                    if (v5Char.name === charName || v5Char._charId === charId) {
                        localStorage.removeItem('worldsapart_character_v5');
                        console.log('[CharacterStorage] Also removed worldsapart_character_v5');
                    }
                }
            } catch (e) {
                console.warn('[CharacterStorage] Error checking v5 storage:', e);
            }
            
            // Also delete from Firebase (async, don't wait)
            if (this.isOnline()) {
                this.firebaseDelete(charId).catch(e => {
                    console.warn('[CharacterStorage] Firebase delete failed:', e);
                });
                
                // Also delete from room if in one
                this.deleteFromRoom(charId);
            }
            
            return true;
        } catch (e) {
            console.error('[CharacterStorage] Error deleting character:', e);
            return false;
        }
    },
    
    // Delete character from current room (if in one)
    async deleteFromRoom(charId) {
        try {
            const roomCode = localStorage.getItem('rift_current_room');
            if (!roomCode) return;
            
            // Ensure Firebase is initialized
            let db = this.getFirestore();
            if (!db) {
                if (window.RIFT?.firebase?.init) {
                    await window.RIFT.firebase.init();
                    db = this.getFirestore();
                }
                if (!db) return;
            }
            
            const normalizedCode = roomCode.replace(/-/g, '').toUpperCase();
            const charRef = db.collection('rooms').doc(normalizedCode)
                             .collection('characters').doc(charId);
            
            const charDoc = await charRef.get();
            if (charDoc.exists) {
                await charRef.delete();
                console.log('[CharacterStorage] Deleted character from room:', charId);
            }
        } catch (e) {
            console.warn('[CharacterStorage] Room delete failed:', e.message || e);
        }
    },
    
    // Get character count per ruleset
    getCounts() {
        const all = this.getAll();
        const counts = {
            'dnd5e': 0,
            'worldsapart': 0,
            'htbah': 0,
            'cyberpunkred': 0,
            total: 0
        };
        
        Object.values(all).forEach(char => {
            if (counts.hasOwnProperty(char.ruleset)) {
                counts[char.ruleset]++;
            }
            counts.total++;
        });
        
        return counts;
    },
    
    // Get recent characters (sorted by lastPlayed or updatedAt)
    getRecent(limit = 6) {
        const all = Object.values(this.getAll());
        
        return all
            .sort((a, b) => {
                const dateA = new Date(a.lastPlayed || a.updatedAt);
                const dateB = new Date(b.lastPlayed || b.updatedAt);
                return dateB - dateA;
            })
            .slice(0, limit);
    },
    
    // Update last played timestamp
    updateLastPlayed(charId) {
        const char = this.getById(charId);
        if (char) {
            char.lastPlayed = new Date().toISOString();
            this.save(char);
        }
    },
    
    // Sync local data to Firebase
    async syncToFirebase() {
        if (!this.isOnline()) {
            console.log('[CharacterStorage] Cannot sync - offline or not authenticated');
            return false;
        }
        
        const localData = this.getLocalAll();
        const count = Object.keys(localData).length;
        
        console.log('[CharacterStorage] Syncing', count, 'characters to Firebase...');
        
        for (const char of Object.values(localData)) {
            await this.firebaseSave(char);
        }
        
        console.log('[CharacterStorage] Sync complete');
        return true;
    },
    
    // Pull data from Firebase to local - MERGES, doesn't overwrite!
    async syncFromFirebase() {
        if (!this.isOnline()) {
            console.log('[CharacterStorage] Cannot sync - offline or not authenticated');
            return false;
        }
        
        const firebaseData = await this.firebaseGetAll();
        const localData = this.getLocalAll();
        
        // If Firebase is empty but local has data, push to Firebase instead
        if ((!firebaseData || Object.keys(firebaseData).length === 0) && Object.keys(localData).length > 0) {
            console.log('[CharacterStorage] Firebase empty but local has', Object.keys(localData).length, 'characters - pushing to Firebase');
            await this.syncToFirebase();
            return true;
        }
        
        // If Firebase has data, merge with local (Firebase wins on conflict by updatedAt)
        if (firebaseData && Object.keys(firebaseData).length > 0) {
            const merged = { ...localData };
            
            Object.entries(firebaseData).forEach(([id, fbChar]) => {
                const localChar = merged[id];
                
                if (!localChar) {
                    // New character from Firebase
                    merged[id] = fbChar;
                } else {
                    // Both exist - compare updatedAt, keep newer
                    const fbDate = new Date(fbChar.updatedAt || 0);
                    const localDate = new Date(localChar.updatedAt || 0);
                    
                    if (fbDate > localDate) {
                        merged[id] = fbChar;
                    }
                    // else keep local (it's newer or same)
                }
            });
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
            console.log('[CharacterStorage] Merged:', Object.keys(merged).length, 'characters (Firebase:', Object.keys(firebaseData).length, ', Local:', Object.keys(localData).length, ')');
            return true;
        }
        
        console.log('[CharacterStorage] Nothing to sync from Firebase');
        return false;
    },
    
    // Export all characters as JSON
    exportAll() {
        const all = this.getAll();
        const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rift_characters_' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        
        URL.revokeObjectURL(url);
    },
    
    // Import characters from JSON
    importFromJson(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            const all = this.getLocalAll();
            
            let count = 0;
            Object.values(imported).forEach(char => {
                if (char.id && char.name && char.ruleset) {
                    // Generate new ID to avoid conflicts
                    const newId = this.generateId();
                    char.id = newId;
                    char.importedAt = new Date().toISOString();
                    all[newId] = char;
                    count++;
                    
                    // Sync to Firebase
                    if (this.isOnline()) {
                        this.firebaseSave(char);
                    }
                }
            });
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            console.log('[CharacterStorage] Imported', count, 'characters');
            return count;
        } catch (e) {
            console.error('[CharacterStorage] Import error:', e);
            return 0;
        }
    },
    
    // Create demo characters - disabled
    createDemoCharacters() {
        console.log('[CharacterStorage] Demo characters disabled');
    },
    
    // ========================================
    // MAIN CHARACTER SYSTEM
    // ========================================
    
    // Get all main characters (returns { ruleset: charId })
    getMainCharacters() {
        try {
            const data = localStorage.getItem(this.MAIN_CHAR_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('[CharacterStorage] Error loading main characters:', e);
            return {};
        }
    },
    
    // Get main character for a specific ruleset
    getMainCharacter(ruleset) {
        const mains = this.getMainCharacters();
        const charId = mains[ruleset];
        
        if (!charId) {
            // No main set - return first character of ruleset as default
            const chars = this.getByRuleset(ruleset);
            return chars.length > 0 ? chars[0] : null;
        }
        
        // Get the actual character
        const char = this.getById(charId);
        
        // If main character was deleted, return first available
        if (!char) {
            const chars = this.getByRuleset(ruleset);
            if (chars.length > 0) {
                // Auto-fix: set first as new main
                this.setMainCharacter(chars[0].id, ruleset);
                return chars[0];
            }
            return null;
        }
        
        return char;
    },
    
    // Set a character as main for its ruleset
    setMainCharacter(charId, ruleset = null) {
        try {
            // Get character to verify it exists and get ruleset
            const char = this.getById(charId);
            if (!char) {
                console.error('[CharacterStorage] Cannot set main: character not found:', charId);
                return false;
            }
            
            const targetRuleset = ruleset || char.ruleset;
            if (!targetRuleset) {
                console.error('[CharacterStorage] Cannot set main: no ruleset');
                return false;
            }
            
            // Update main characters
            const mains = this.getMainCharacters();
            mains[targetRuleset] = charId;
            localStorage.setItem(this.MAIN_CHAR_KEY, JSON.stringify(mains));
            
            console.log('[CharacterStorage] Set main character:', charId, 'for ruleset:', targetRuleset);
            
            // Sync to Firebase user profile
            this.syncMainCharacterToFirebase(targetRuleset, charId);
            
            return true;
        } catch (e) {
            console.error('[CharacterStorage] Error setting main character:', e);
            return false;
        }
    },
    
    // Check if a character is the main for its ruleset
    isMainCharacter(charId) {
        const char = this.getById(charId);
        if (!char || !char.ruleset) return false;
        
        const mains = this.getMainCharacters();
        return mains[char.ruleset] === charId;
    },
    
    // Sync main character to Firebase
    async syncMainCharacterToFirebase(ruleset, charId) {
        const db = this.getFirestore();
        const userId = this.getUserId();
        
        if (!db || !userId) return;
        
        try {
            const userRef = db.collection('users').doc(userId);
            await userRef.set({
                mainCharacters: {
                    [ruleset]: charId
                }
            }, { merge: true });
            
            console.log('[CharacterStorage] Synced main character to Firebase');
        } catch (e) {
            console.warn('[CharacterStorage] Failed to sync main character:', e);
        }
    },
    
    // Get count of characters for a ruleset
    getCountForRuleset(ruleset) {
        return this.getByRuleset(ruleset).length;
    },
    
    // Check if user can create more characters for a ruleset
    canCreateCharacter(ruleset) {
        return this.getCountForRuleset(ruleset) < this.MAX_PER_RULESET;
    },
    
    // Clear all data (dangerous!)
    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.MAIN_CHAR_KEY);
        console.log('[CharacterStorage] All local characters deleted');
        // Note: Does NOT delete from Firebase for safety
    }
};

// Make globally available
window.CharacterStorage = CharacterStorage;

// Auto-sync when user logs in
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Try to sync after a short delay to let Firebase initialize
        setTimeout(() => {
            if (CharacterStorage.isOnline()) {
                console.log('[CharacterStorage] Auto-syncing from Firebase...');
                CharacterStorage.syncFromFirebase();
            }
        }, 2000);
    });
}

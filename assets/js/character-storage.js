/**
 * RIFT Character Storage Manager
 * Handles saving, loading, and deleting character data
 * Uses Firebase Firestore with localStorage as cache/fallback
 */

const CharacterStorage = {
    // Storage key prefix for localStorage cache
    STORAGE_KEY: 'rift_characters',
    
    // Firebase collection name
    COLLECTION: 'characters',
    
    // Get Firestore instance
    getFirestore() {
        return window.RIFT?.firebase?.getFirestore?.() || null;
    },
    
    // Get current user ID
    getUserId() {
        const user = window.RIFT?.firebase?.getCurrentUser?.();
        return user?.uid || localStorage.getItem('rift_user_uid') || null;
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
            if (!character.id || character.id === null || character.id === '') {
                character.id = this.generateId();
                console.log('[CharacterStorage] Generated new ID:', character.id);
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
            }
            
            return character;
        } catch (e) {
            console.error('[CharacterStorage] Error saving character:', e);
            return null;
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
            delete all[charId];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
            
            console.log('[CharacterStorage] Deleted from localStorage:', charId, charName);
            
            // Also delete from Firebase (async, don't wait)
            if (this.isOnline()) {
                this.firebaseDelete(charId).catch(e => {
                    console.warn('[CharacterStorage] Firebase delete failed:', e);
                });
            }
            
            return true;
        } catch (e) {
            console.error('[CharacterStorage] Error deleting character:', e);
            return false;
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
    
    // Clear all data (dangerous!)
    clearAll() {
        localStorage.removeItem(this.STORAGE_KEY);
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

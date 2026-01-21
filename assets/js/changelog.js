/**
 * RIFT Activity Log System
 * Loggt ALLE Änderungen für den GM: Charaktere, User, Würfel, etc.
 * 
 * Usage:
 * RIFTChangelog.init();
 * RIFTChangelog.logCharacter('HP', 100, 85, 'Gandalf');
 * RIFTChangelog.logUser('name', 'Max', 'Maximilian');
 * RIFTChangelog.logDice('2d20+5', 23, 'Angriff');
 */

const RIFTChangelog = {
    roomCode: null,
    playerName: null,
    playerId: null,
    playerColor: null,
    initialized: false,
    debounceTimers: {},
    
    /**
     * Initialisiert das Changelog-System
     */
    init() {
        this.roomCode = localStorage.getItem('rift_current_room');
        if (!this.roomCode) {
            console.log('[Changelog] No room, skipping init');
            return false;
        }
        
        this.roomCode = this.roomCode.replace(/-/g, '').toUpperCase();
        
        // Spielerdaten aus localStorage
        const userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
        this.playerName = userData.displayName || userData.name || 'Unbekannt';
        this.playerId = userData.oderId || firebase?.auth()?.currentUser?.uid || null;
        this.playerColor = userData.color || '#8b5cf6';
        
        this.initialized = true;
        console.log('[Changelog] Initialized for room:', this.roomCode);
        return true;
    },
    
    /**
     * Stellt sicher dass Firebase verfügbar ist
     */
    async getDb() {
        // Versuche verschiedene Wege zu Firestore
        let db = null;
        
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            db = firebase.firestore();
        } else if (window.RIFT?.firebase?.getFirestore) {
            db = window.RIFT.firebase.getFirestore();
        }
        
        if (!db && window.RIFT?.firebase?.init) {
            await window.RIFT.firebase.init();
            db = firebase?.firestore?.();
        }
        
        return db;
    },
    
    /**
     * Schreibt einen Log-Eintrag
     */
    async _writeLog(logData) {
        if (!this.initialized) this.init();
        if (!this.roomCode) return;
        
        try {
            const db = await this.getDb();
            if (!db) {
                console.warn('[Changelog] Firebase not available');
                return;
            }
            
            const entry = {
                ...logData,
                playerName: logData.playerName || this.playerName,
                playerId: logData.playerId || this.playerId,
                playerColor: logData.playerColor || this.playerColor,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                clientTimestamp: Date.now()
            };
            
            await db.collection('rooms').doc(this.roomCode).collection('changelog').add(entry);
            console.log('[Changelog]', logData.type, ':', logData.action || logData.field);
            
        } catch (e) {
            console.error('[Changelog] Write failed:', e);
        }
    },
    
    // ========================================
    // CHARACTER CHANGES
    // ========================================
    
    /**
     * Loggt eine Charakteränderung
     * @param {string} field - Feldname (z.B. "HP", "Stärke", "Gold")
     * @param {any} oldValue - Alter Wert
     * @param {any} newValue - Neuer Wert  
     * @param {string} characterName - Name des Charakters
     * @param {string} characterId - ID des Charakters
     */
    logCharacter(field, oldValue, newValue, characterName, characterId = null, debounceMs = 2000) {
        // Keine Änderung
        if (this._valuesEqual(oldValue, newValue)) return;
        
        const key = `char_${characterId || 'unknown'}_${field}`;
        
        // Debounce
        if (this.debounceTimers[key]) {
            clearTimeout(this.debounceTimers[key]);
        }
        
        this.debounceTimers[key] = setTimeout(() => {
            this._writeLog({
                type: 'character',
                action: 'change',
                field: field,
                oldValue: this._formatValue(oldValue),
                newValue: this._formatValue(newValue),
                characterName: characterName,
                characterId: characterId
            });
        }, debounceMs);
    },
    
    /**
     * Loggt Charakteränderung sofort (ohne Debounce)
     */
    logCharacterImmediate(field, oldValue, newValue, characterName, characterId = null) {
        if (this._valuesEqual(oldValue, newValue)) return;
        
        this._writeLog({
            type: 'character',
            action: 'change',
            field: field,
            oldValue: this._formatValue(oldValue),
            newValue: this._formatValue(newValue),
            characterName: characterName,
            characterId: characterId
        });
    },
    
    // ========================================
    // USER CHANGES
    // ========================================
    
    /**
     * Loggt eine User-Profiländerung
     */
    logUser(field, oldValue, newValue) {
        if (this._valuesEqual(oldValue, newValue)) return;
        
        this._writeLog({
            type: 'user',
            action: 'profile_change',
            field: field,
            oldValue: this._formatValue(oldValue),
            newValue: this._formatValue(newValue)
        });
    },
    
    // ========================================
    // DICE ROLLS
    // ========================================
    
    /**
     * Loggt einen Würfelwurf
     */
    logDice(notation, total, results = [], options = {}) {
        this._writeLog({
            type: 'dice',
            action: 'roll',
            notation: notation,
            total: total,
            results: results,
            label: options.label || null,
            critical: options.critical || null,
            secret: options.secret || false,
            diceTheme: options.diceTheme || 'classic'
        });
    },
    
    // ========================================
    // SESSION / ROOM EVENTS
    // ========================================
    
    /**
     * Loggt ein Session-Event
     */
    logSession(action, details = {}) {
        this._writeLog({
            type: 'session',
            action: action,
            ...details
        });
    },
    
    /**
     * Loggt ein Member-Event (join, leave, kick, etc.)
     */
    logMember(action, memberName, memberId = null, details = {}) {
        this._writeLog({
            type: 'member',
            action: action,
            targetName: memberName,
            targetId: memberId,
            ...details
        });
    },
    
    // ========================================
    // HELPERS
    // ========================================
    
    _valuesEqual(a, b) {
        if (a === b) return true;
        if (String(a).trim() === String(b).trim()) return true;
        if (JSON.stringify(a) === JSON.stringify(b)) return true;
        return false;
    },
    
    _formatValue(val) {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'boolean') return val ? 'Ja' : 'Nein';
        if (Array.isArray(val)) {
            if (val.length === 0) return '-';
            if (val.length <= 5) return val.join(', ');
            return `${val.slice(0, 5).join(', ')}... (+${val.length - 5})`;
        }
        if (typeof val === 'object') {
            try {
                const str = JSON.stringify(val);
                return str.length > 50 ? str.substring(0, 50) + '...' : str;
            } catch {
                return '[Objekt]';
            }
        }
        const str = String(val).trim();
        if (str.length > 100) return str.substring(0, 100) + '...';
        return str || '-';
    },
    
    /**
     * Helper: Vergleicht zwei Objekte und loggt Unterschiede
     */
    compareAndLog(type, oldObj, newObj, characterName = null, characterId = null) {
        const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
        
        allKeys.forEach(key => {
            const oldVal = oldObj?.[key];
            const newVal = newObj?.[key];
            
            if (!this._valuesEqual(oldVal, newVal)) {
                if (type === 'character') {
                    this.logCharacter(key, oldVal, newVal, characterName, characterId);
                } else if (type === 'user') {
                    this.logUser(key, oldVal, newVal);
                }
            }
        });
    }
};

// Auto-init wenn DOM ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => RIFTChangelog.init(), 1000);
    });
}

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RIFTChangelog;
}

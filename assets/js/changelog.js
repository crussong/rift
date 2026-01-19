/**
 * RIFT Character Changelog System
 * Loggt alle Änderungen am Charakterbogen für den GM
 * 
 * Usage: Füge dieses Script in jeden Charakterbogen ein und rufe auf:
 * RIFTChangelog.init(characterId, characterName);
 * RIFTChangelog.log(fieldName, oldValue, newValue);
 */

const RIFTChangelog = {
    characterId: null,
    characterName: null,
    playerName: null,
    roomCode: null,
    debounceTimers: {},
    
    /**
     * Initialisiert das Changelog-System
     * @param {string} charId - ID des Charakters
     * @param {string} charName - Name des Charakters
     */
    init(charId, charName) {
        this.characterId = charId;
        this.characterName = charName;
        this.roomCode = localStorage.getItem('rift_current_room');
        
        // Spielername aus localStorage oder Auth
        const userData = JSON.parse(localStorage.getItem('rift_user') || '{}');
        this.playerName = userData.displayName || userData.name || 'Unbekannt';
        
        console.log('[Changelog] Initialized for:', charName);
    },
    
    /**
     * Loggt eine Änderung
     * @param {string} field - Feldname (z.B. "HP", "Stärke", "Gold")
     * @param {any} oldValue - Alter Wert
     * @param {any} newValue - Neuer Wert
     * @param {number} debounceMs - Optional: Debounce in ms (default: 2000)
     */
    log(field, oldValue, newValue, debounceMs = 2000) {
        // Keine Änderung
        if (oldValue === newValue) return;
        if (String(oldValue).trim() === String(newValue).trim()) return;
        
        // Debounce pro Feld
        if (this.debounceTimers[field]) {
            clearTimeout(this.debounceTimers[field]);
        }
        
        this.debounceTimers[field] = setTimeout(() => {
            this._writeLog(field, oldValue, newValue);
        }, debounceMs);
    },
    
    /**
     * Loggt sofort ohne Debounce (für wichtige Änderungen)
     */
    logImmediate(field, oldValue, newValue) {
        if (oldValue === newValue) return;
        this._writeLog(field, oldValue, newValue);
    },
    
    /**
     * Schreibt den Log-Eintrag in Firebase
     */
    async _writeLog(field, oldValue, newValue) {
        if (!this.roomCode || !this.characterId) {
            console.warn('[Changelog] Not initialized');
            return;
        }
        
        try {
            const db = RIFT?.firebase?.getFirestore?.();
            if (!db) {
                console.warn('[Changelog] Firebase not available');
                return;
            }
            
            const code = this.roomCode.replace('-', '').toUpperCase();
            
            await db.collection('rooms').doc(code).collection('changelog').add({
                characterId: this.characterId,
                characterName: this.characterName,
                playerName: this.playerName,
                playerId: firebase?.auth()?.currentUser?.uid || null,
                field: field,
                oldValue: this._formatValue(oldValue),
                newValue: this._formatValue(newValue),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`[Changelog] ${field}: ${oldValue} → ${newValue}`);
        } catch (e) {
            console.error('[Changelog] Failed to write:', e);
        }
    },
    
    /**
     * Formatiert Werte für Anzeige
     */
    _formatValue(val) {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'boolean') return val ? 'Ja' : 'Nein';
        if (typeof val === 'object') return JSON.stringify(val);
        const str = String(val).trim();
        if (str.length > 100) return str.substring(0, 100) + '...';
        return str || '-';
    },
    
    /**
     * Helper: Überwacht ein Input-Feld automatisch
     * @param {HTMLElement} input - Das Input-Element
     * @param {string} fieldName - Name für den Log
     */
    watchInput(input, fieldName) {
        if (!input) return;
        
        let oldValue = input.value;
        
        input.addEventListener('focus', () => {
            oldValue = input.value;
        });
        
        input.addEventListener('blur', () => {
            if (input.value !== oldValue) {
                this.log(fieldName, oldValue, input.value);
            }
        });
        
        // Für checkboxes
        if (input.type === 'checkbox') {
            input.addEventListener('change', () => {
                this.log(fieldName, !input.checked, input.checked);
            });
        }
    },
    
    /**
     * Helper: Überwacht mehrere Inputs per Selector
     * @param {string} selector - CSS Selector
     * @param {Function} nameExtractor - Funktion die den Feldnamen aus dem Element extrahiert
     */
    watchAll(selector, nameExtractor) {
        document.querySelectorAll(selector).forEach(input => {
            const name = nameExtractor ? nameExtractor(input) : (input.name || input.id || 'Unbekannt');
            this.watchInput(input, name);
        });
    }
};

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RIFTChangelog;
}

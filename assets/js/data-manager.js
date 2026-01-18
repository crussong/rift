/**
 * RIFT v2 - Data Management
 * Export, Import, and Backup functionality
 */

const DataManager = {
    
    // ========================================
    // EXPORT FUNCTIONS
    // ========================================
    
    /**
     * Export all RIFT data as JSON
     */
    exportAllData() {
        const data = this.gatherAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, `rift-backup-${this.getDateString()}.json`);
        
        if (typeof showToast === 'function') {
            showToast('Backup erstellt!', 'success');
        }
        
        return data;
    },
    
    /**
     * Export specific data type
     */
    exportData(type) {
        let data = {};
        let filename = '';
        
        switch (type) {
            case 'characters':
                data = this.getCharacterData();
                filename = `rift-charaktere-${this.getDateString()}.json`;
                break;
            case 'sessions':
                data = this.getSessionData();
                filename = `rift-sessions-${this.getDateString()}.json`;
                break;
            case 'notes':
                data = this.getNotesData();
                filename = `rift-notizen-${this.getDateString()}.json`;
                break;
            case 'settings':
                data = this.getSettingsData();
                filename = `rift-einstellungen-${this.getDateString()}.json`;
                break;
            default:
                data = this.gatherAllData();
                filename = `rift-backup-${this.getDateString()}.json`;
        }
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, filename);
        
        return data;
    },
    
    /**
     * Gather all localStorage data with rift_ prefix
     */
    gatherAllData() {
        const data = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            user: this.getUserData(),
            characters: this.getCharacterData(),
            sessions: this.getSessionData(),
            notes: this.getNotesData(),
            news: this.getNewsData(),
            settings: this.getSettingsData(),
            raw: {}
        };
        
        // Also export all raw localStorage entries with rift_ prefix
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('rift_')) {
                try {
                    data.raw[key] = JSON.parse(localStorage.getItem(key));
                } catch {
                    data.raw[key] = localStorage.getItem(key);
                }
            }
        }
        
        return data;
    },
    
    getUserData() {
        try {
            return JSON.parse(localStorage.getItem('rift_user') || '{}');
        } catch {
            return {};
        }
    },
    
    getCharacterData() {
        const characters = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('rift_character_')) {
                try {
                    characters.push({
                        id: key.replace('rift_character_', ''),
                        data: JSON.parse(localStorage.getItem(key))
                    });
                } catch {}
            }
        }
        return characters;
    },
    
    getSessionData() {
        const sessions = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('rift_session_')) {
                try {
                    sessions.push({
                        id: key.replace('rift_session_', ''),
                        data: JSON.parse(localStorage.getItem(key))
                    });
                } catch {}
            }
        }
        return sessions;
    },
    
    getNotesData() {
        const notes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('rift_note_') || key.startsWith('rift_notes'))) {
                try {
                    notes.push({
                        id: key,
                        data: JSON.parse(localStorage.getItem(key))
                    });
                } catch {
                    notes.push({
                        id: key,
                        data: localStorage.getItem(key)
                    });
                }
            }
        }
        return notes;
    },
    
    getNewsData() {
        return {
            news_1: this.safeGet('rift_news_1'),
            news_2: this.safeGet('rift_news_2'),
            article_news_1: this.safeGet('rift_article_news_1'),
            article_news_2: this.safeGet('rift_article_news_2'),
            announcement: localStorage.getItem('rift_announcement')
        };
    },
    
    getSettingsData() {
        return {
            theme: localStorage.getItem('rift_theme'),
            room: localStorage.getItem('rift_current_room'),
            preferences: this.safeGet('rift_preferences')
        };
    },
    
    safeGet(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
            return localStorage.getItem(key);
        }
    },
    
    // ========================================
    // IMPORT FUNCTIONS
    // ========================================
    
    /**
     * Import data from JSON file
     */
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Validate data
                    if (!data.version && !data.raw) {
                        reject(new Error('Ungültiges Backup-Format'));
                        return;
                    }
                    
                    resolve(data);
                } catch (error) {
                    reject(new Error('Datei konnte nicht gelesen werden'));
                }
            };
            
            reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
            reader.readAsText(file);
        });
    },
    
    /**
     * Apply imported data to localStorage
     */
    async applyImport(data, options = { merge: true }) {
        const results = { success: 0, failed: 0, skipped: 0 };
        
        // If not merging, clear existing RIFT data first
        if (!options.merge) {
            this.clearAllData();
        }
        
        // Import raw data (complete localStorage entries)
        if (data.raw) {
            for (const [key, value] of Object.entries(data.raw)) {
                try {
                    if (options.merge && localStorage.getItem(key) && !options.overwrite) {
                        results.skipped++;
                        continue;
                    }
                    
                    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
                    localStorage.setItem(key, stringValue);
                    results.success++;
                } catch {
                    results.failed++;
                }
            }
        }
        
        // Import characters
        if (data.characters && Array.isArray(data.characters)) {
            for (const char of data.characters) {
                try {
                    const key = `rift_character_${char.id}`;
                    localStorage.setItem(key, JSON.stringify(char.data));
                    results.success++;
                } catch {
                    results.failed++;
                }
            }
        }
        
        // Import settings
        if (data.settings) {
            if (data.settings.theme) {
                localStorage.setItem('rift_theme', data.settings.theme);
            }
            if (data.settings.room) {
                localStorage.setItem('rift_current_room', data.settings.room);
            }
        }
        
        return results;
    },
    
    // ========================================
    // BACKUP FUNCTIONS
    // ========================================
    
    /**
     * Auto-backup to localStorage (compressed)
     */
    createAutoBackup() {
        const data = this.gatherAllData();
        const backup = {
            date: new Date().toISOString(),
            data: data
        };
        
        // Keep last 5 auto-backups
        const backups = this.getAutoBackups();
        backups.unshift(backup);
        
        if (backups.length > 5) {
            backups.pop();
        }
        
        try {
            localStorage.setItem('rift_auto_backups', JSON.stringify(backups));
            console.log('[Backup] Auto-backup created');
            return true;
        } catch (e) {
            console.error('[Backup] Failed to create auto-backup:', e);
            return false;
        }
    },
    
    /**
     * Get list of auto-backups
     */
    getAutoBackups() {
        try {
            return JSON.parse(localStorage.getItem('rift_auto_backups') || '[]');
        } catch {
            return [];
        }
    },
    
    /**
     * Restore from auto-backup
     */
    async restoreAutoBackup(index = 0) {
        const backups = this.getAutoBackups();
        
        if (!backups[index]) {
            throw new Error('Backup nicht gefunden');
        }
        
        const backup = backups[index];
        return this.applyImport(backup.data, { merge: false, overwrite: true });
    },
    
    /**
     * Clear all RIFT data from localStorage
     */
    clearAllData() {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('rift_') && key !== 'rift_auto_backups') {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        return keysToRemove.length;
    },
    
    // ========================================
    // HELPER FUNCTIONS
    // ========================================
    
    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    },
    
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Show import dialog
     */
    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const data = await this.importData(file);
                
                // Show confirmation
                const confirmed = typeof showConfirm === 'function'
                    ? await showConfirm(
                        `Backup vom ${new Date(data.exportDate).toLocaleDateString('de-DE')} gefunden. ` +
                        `Möchtest du die Daten importieren? Bestehende Daten werden überschrieben.`,
                        'Importieren',
                        'Abbrechen'
                    )
                    : confirm('Daten importieren?');
                
                if (confirmed) {
                    const results = await this.applyImport(data, { merge: false, overwrite: true });
                    
                    if (typeof showToast === 'function') {
                        showToast(
                            `Import abgeschlossen: ${results.success} erfolgreich, ${results.failed} fehlgeschlagen`,
                            results.failed > 0 ? 'warning' : 'success'
                        );
                    }
                    
                    // Reload page to apply changes
                    setTimeout(() => window.location.reload(), 1500);
                }
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast(error.message, 'error');
                } else {
                    alert(error.message);
                }
            }
        };
        
        input.click();
    },
    
    /**
     * Initialize auto-backup (call on app start)
     */
    initAutoBackup() {
        // Create backup every 30 minutes
        setInterval(() => this.createAutoBackup(), 30 * 60 * 1000);
        
        // Create initial backup after 5 minutes
        setTimeout(() => this.createAutoBackup(), 5 * 60 * 1000);
        
        // Also backup on page unload
        window.addEventListener('beforeunload', () => {
            this.createAutoBackup();
        });
    }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    DataManager.initAutoBackup();
});

// Export globally
if (typeof window !== 'undefined') {
    window.DataManager = DataManager;
}

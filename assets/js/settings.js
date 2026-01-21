/**
 * RIFT v2 - Settings Manager
 * Handles user profile settings: name, color, avatar with cropper
 */

class SettingsManager {
    constructor() {
        this.modal = null;
        this.cropper = null;
        this.currentTab = 'name';
        this.tempAvatar = null;
        this.originalImage = null;
        
        this.init();
    }
    
    init() {
        this.createModal();
        this.bindEvents();
    }
    
    // ========================================
    // MODAL CREATION
    // ========================================
    
    createModal() {
        // Prevent duplicate modals
        if (document.getElementById('settingsModal')) {
            console.log('[Settings] Modal already exists, reusing');
            this.modal = document.getElementById('settingsModal');
            return;
        }
        
        const modalHTML = `
            <div class="modal-overlay" id="settingsModal">
                <div class="modal">
                    <div class="modal__header">
                        <h2 class="modal__title">Einstellungen</h2>
                        <button class="modal__close" id="closeSettings">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal__body">
                        <!-- Tabs -->
                        <div class="settings-tabs">
                            <button class="settings-tab active" data-tab="name">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                Name
                            </button>
                            <button class="settings-tab" data-tab="color">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                                Farbe
                            </button>
                            <button class="settings-tab" data-tab="avatar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                Profilbild
                            </button>
                            <button class="settings-tab" data-tab="data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Daten
                            </button>
                        </div>
                        
                        <!-- Name Panel -->
                        <div class="settings-panel active" data-panel="name">
                            <div class="settings-form-group">
                                <label class="settings-label">Spielername</label>
                                <div class="name-input-group">
                                    <input type="text" 
                                           id="settingsNameInput" 
                                           class="form-input" 
                                           placeholder="Dein Name"
                                           maxlength="32">
                                    <button class="btn btn--secondary btn--icon" id="randomNameBtn" title="Zufälliger Name">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                            <circle cx="12" cy="12" r="2"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="name-preview">
                                <div class="name-preview__avatar" id="namePreviewAvatar">?</div>
                                <div class="name-preview__info">
                                    <span class="name-preview__label">Vorschau</span>
                                    <span class="name-preview__name" id="namePreviewText">Spieler</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Color Panel -->
                        <div class="settings-panel" data-panel="color">
                            <div class="settings-form-group">
                                <label class="settings-label">Wähle deine Farbe</label>
                                <div class="color-grid" id="colorGrid">
                                    <!-- Colors werden per JS eingefügt -->
                                </div>
                            </div>
                            
                            <div class="name-preview">
                                <div class="name-preview__avatar" id="colorPreviewAvatar">?</div>
                                <div class="name-preview__info">
                                    <span class="name-preview__label">Vorschau</span>
                                    <span class="name-preview__name" id="colorPreviewText">Spieler</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Avatar Panel -->
                        <div class="settings-panel" data-panel="avatar">
                            <!-- Normal View -->
                            <div class="avatar-section" id="avatarNormalView">
                                <div class="avatar-preview-large" id="avatarPreviewLarge">
                                    <div class="avatar-fallback" id="avatarFallback">?</div>
                                </div>
                                
                                <div class="avatar-actions">
                                    <button class="btn btn--primary avatar-upload-btn">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="17 8 12 3 7 8"/>
                                            <line x1="12" y1="3" x2="12" y2="15"/>
                                        </svg>
                                        Bild hochladen
                                        <input type="file" id="avatarFileInput" accept="image/*">
                                    </button>
                                    <button class="btn btn--danger btn--sm" id="removeAvatarBtn" style="display: none;">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        </svg>
                                        Entfernen
                                    </button>
                                </div>
                                
                                <p class="form-hint" style="text-align: center; margin-top: var(--space-sm);">
                                    JPG, PNG oder GIF. Max 2MB.
                                </p>
                            </div>
                            
                            <!-- Cropper View -->
                            <div class="avatar-cropper" id="avatarCropperView">
                                <div class="cropper-wrapper" id="cropperWrapper">
                                    <img id="cropperImage" src="" alt="">
                                </div>
                                
                                <div class="cropper-controls">
                                    <button class="cropper-btn" id="rotateLeftBtn" title="Links drehen">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="1 4 1 10 7 10"/>
                                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                                        </svg>
                                    </button>
                                    
                                    <input type="range" class="zoom-slider" id="zoomSlider" min="0.1" max="3" step="0.1" value="1">
                                    
                                    <button class="cropper-btn" id="rotateRightBtn" title="Rechts drehen">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="23 4 23 10 17 10"/>
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                        </svg>
                                    </button>
                                </div>
                                
                                <div class="cropper-actions">
                                    <button class="btn btn--secondary" id="cancelCropBtn">Abbrechen</button>
                                    <button class="btn btn--primary" id="applyCropBtn">Übernehmen</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Data Panel -->
                        <div class="settings-panel" data-panel="data">
                            <div class="settings-form-group">
                                <label class="settings-label">Backup erstellen</label>
                                <p class="form-hint" style="margin-bottom: 12px;">
                                    Speichere alle deine RIFT-Daten als JSON-Datei.
                                </p>
                                <button class="btn btn--primary" onclick="DataManager.exportAllData()">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:8px;">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="7 10 12 15 17 10"/>
                                        <line x1="12" y1="15" x2="12" y2="3"/>
                                    </svg>
                                    Backup herunterladen
                                </button>
                            </div>
                            
                            <div class="settings-divider"></div>
                            
                            <div class="settings-form-group">
                                <label class="settings-label">Daten importieren</label>
                                <p class="form-hint" style="margin-bottom: 12px;">
                                    Stelle deine Daten aus einem früheren Backup wieder her.
                                </p>
                                <button class="btn btn--secondary" onclick="DataManager.showImportDialog()">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:8px;">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    Backup importieren
                                </button>
                            </div>
                            
                            <div class="settings-divider"></div>
                            
                            <div class="settings-form-group">
                                <label class="settings-label">Auto-Backups</label>
                                <p class="form-hint" style="margin-bottom: 12px;">
                                    RIFT erstellt automatisch Backups. Die letzten 5 werden gespeichert.
                                </p>
                                <div class="auto-backup-list" id="autoBackupList">
                                    <!-- Wird per JS gefüllt -->
                                </div>
                            </div>
                            
                            <div class="settings-divider"></div>
                            
                            <div class="settings-form-group">
                                <label class="settings-label" style="color: var(--accent);">Gefahrenzone</label>
                                <p class="form-hint" style="margin-bottom: 12px;">
                                    Lösche alle lokalen RIFT-Daten. Dies kann nicht rückgängig gemacht werden!
                                </p>
                                <button class="btn btn--danger" id="clearAllDataBtn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:8px;">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                    Alle Daten löschen
                                </button>
                            </div>
                        </div>
                        
                        <!-- Role Panel -->
                        <div class="settings-panel" data-panel="role">
                            <div class="settings-form-group">
                                <label class="settings-label">Spielleiter-Modus</label>
                                <div class="settings-toggle-row">
                                    <span class="settings-toggle-label">Ich bin Spielleiter (GM)</span>
                                    <label class="settings-toggle">
                                        <input type="checkbox" id="settingsIsGM">
                                        <span class="settings-toggle-slider"></span>
                                    </label>
                                </div>
                                <p class="form-hint">
                                    Als GM hast du Zugriff auf erweiterte Optionen wie Spielerverwaltung, 
                                    Session-Steuerung und das Mission Control Dashboard.
                                </p>
                            </div>
                            
                            <div class="name-preview" style="margin-top: 24px;">
                                <div class="name-preview__avatar" id="rolePreviewAvatar" style="background: var(--success);">
                                    <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px;">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5"/>
                                    </svg>
                                </div>
                                <div class="name-preview__info">
                                    <span class="name-preview__label">Status</span>
                                    <span class="name-preview__name" id="rolePreviewText">Spieler</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal__footer">
                        <button class="btn btn--secondary" id="cancelSettingsBtn">Abbrechen</button>
                        <button class="btn btn--primary" id="saveSettingsBtn">Speichern</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('settingsModal');
        
        // Render color grid
        this.renderColorGrid();
    }
    
    // ========================================
    // EVENT BINDING
    // ========================================
    
    bindEvents() {
        console.log('[Settings] bindEvents called');
        
        // Close modal
        document.getElementById('closeSettings')?.addEventListener('click', () => this.close());
        document.getElementById('cancelSettingsBtn')?.addEventListener('click', () => this.close());
        
        // Click outside to close
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal?.classList.contains('active')) {
                this.close();
            }
        });
        
        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
        
        // Name input
        document.getElementById('settingsNameInput')?.addEventListener('input', () => this.updatePreviews());
        document.getElementById('randomNameBtn')?.addEventListener('click', () => this.generateRandomName());
        
        // Color selection
        document.getElementById('colorGrid')?.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (swatch) this.selectColor(swatch);
        });
        
        // Avatar upload
        const avatarInput = document.getElementById('avatarFileInput');
        const avatarBtn = document.querySelector('.avatar-upload-btn');
        
        console.log('[Settings] Avatar elements:', { 
            input: !!avatarInput, 
            btn: !!avatarBtn 
        });
        
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                console.log('[Settings] File input change event fired');
                this.handleFileSelect(e);
            });
        }
        
        // Also handle button click to trigger file input (fallback)
        if (avatarBtn) {
            avatarBtn.addEventListener('click', (e) => {
                console.log('[Settings] Avatar button clicked');
                // Only trigger if click wasn't on the input itself
                if (e.target !== avatarInput) {
                    avatarInput?.click();
                }
            });
        }
        
        document.getElementById('removeAvatarBtn')?.addEventListener('click', () => this.removeAvatar());
        
        // Cropper controls
        const applyCropBtn = document.getElementById('applyCropBtn');
        console.log('[Settings] applyCropBtn found:', !!applyCropBtn);
        
        document.getElementById('rotateLeftBtn')?.addEventListener('click', () => this.rotateCrop(-90));
        document.getElementById('rotateRightBtn')?.addEventListener('click', () => this.rotateCrop(90));
        document.getElementById('zoomSlider')?.addEventListener('input', (e) => this.zoomCrop(e.target.value));
        document.getElementById('cancelCropBtn')?.addEventListener('click', () => this.cancelCrop());
        applyCropBtn?.addEventListener('click', () => {
            console.log('[Settings] applyCropBtn clicked');
            this.applyCrop();
        });
        
        // Data Tab
        document.getElementById('clearAllDataBtn')?.addEventListener('click', async () => {
            const confirmed = typeof showConfirm === 'function'
                ? await showConfirm(
                    'Willst du wirklich ALLE lokalen RIFT-Daten löschen? Dies kann nicht rückgängig gemacht werden!',
                    'Alles löschen',
                    'Abbrechen'
                )
                : confirm('Wirklich alle Daten löschen?');
            
            if (confirmed) {
                if (typeof DataManager !== 'undefined') {
                    const count = DataManager.clearAllData();
                    if (typeof showToast === 'function') {
                        showToast(`${count} Einträge gelöscht`, 'success');
                    }
                    setTimeout(() => window.location.reload(), 1500);
                }
            }
        });
        
        // Role Tab - GM Toggle
        const gmToggle = document.getElementById('settingsIsGM');
        if (gmToggle) {
            gmToggle.addEventListener('change', () => {
                this.updateRolePreview();
            });
        }
        
        // Save
        const saveBtn = document.getElementById('saveSettingsBtn');
        console.log('[Settings] saveSettingsBtn found:', !!saveBtn);
        saveBtn?.addEventListener('click', () => {
            console.log('[Settings] Save button clicked, tempAvatar:', this.tempAvatar ? 'set' : 'null');
            this.save();
        });
    }
    
    // ========================================
    // MODAL CONTROLS
    // ========================================
    
    open(tab = 'name') {
        this.loadCurrentSettings();
        this.switchTab(tab);
        this.modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.modal?.classList.remove('active');
        document.body.style.overflow = '';
        this.cancelCrop();
    }
    
    switchTab(tabId) {
        this.currentTab = tabId;
        
        // Update tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        // Update panels
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabId);
        });
        
        // Special handling for data tab
        if (tabId === 'data') {
            this.renderAutoBackupList();
        }
    }
    
    renderAutoBackupList() {
        const container = document.getElementById('autoBackupList');
        if (!container || typeof DataManager === 'undefined') return;
        
        const backups = DataManager.getAutoBackups();
        
        if (backups.length === 0) {
            container.innerHTML = '<div class="auto-backup-empty">Noch keine Auto-Backups vorhanden</div>';
            return;
        }
        
        container.innerHTML = backups.map((backup, index) => {
            const date = new Date(backup.date);
            const dateStr = date.toLocaleDateString('de-DE', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="auto-backup-item">
                    <div class="auto-backup-item__info">
                        <span class="auto-backup-item__date">${dateStr}</span>
                        <span class="auto-backup-item__meta">Auto-Backup #${index + 1}</span>
                    </div>
                    <div class="auto-backup-item__actions">
                        <button class="auto-backup-item__btn" title="Wiederherstellen" onclick="settingsManager.restoreBackup(${index})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="1 4 1 10 7 10"/>
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async restoreBackup(index) {
        if (typeof DataManager === 'undefined') return;
        
        const confirmed = typeof showConfirm === 'function'
            ? await showConfirm(
                'Möchtest du dieses Backup wiederherstellen? Aktuelle Daten werden überschrieben.',
                'Wiederherstellen',
                'Abbrechen'
            )
            : confirm('Backup wiederherstellen?');
        
        if (confirmed) {
            try {
                const results = await DataManager.restoreAutoBackup(index);
                if (typeof showToast === 'function') {
                    showToast('Backup wiederhergestellt!', 'success');
                }
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast(error.message, 'error');
                }
            }
        }
    }
    
    // ========================================
    // LOAD/SAVE SETTINGS
    // ========================================
    
    loadCurrentSettings() {
        const userData = this.getUserData();
        
        // Reset temp avatar when opening
        this.tempAvatar = null;
        
        // Name
        const nameInput = document.getElementById('settingsNameInput');
        if (nameInput) nameInput.value = userData.name || '';
        
        // Color - select current
        const currentColor = userData.color || '#FF4655';
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.classList.toggle('selected', swatch.dataset.color === currentColor);
        });
        
        // Avatar
        this.updateAvatarPreview(userData.avatar, userData.color, userData.initial);
        
        // Show/hide remove button
        const removeBtn = document.getElementById('removeAvatarBtn');
        if (removeBtn) {
            removeBtn.style.display = userData.avatar ? 'inline-flex' : 'none';
        }
        
        // GM Toggle
        const gmToggle = document.getElementById('settingsIsGM');
        if (gmToggle) {
            gmToggle.checked = userData.isGM || false;
        }
        
        // Update previews
        this.updatePreviews();
        this.updateRolePreview();
    }
    
    updateRolePreview() {
        const gmToggle = document.getElementById('settingsIsGM');
        const previewText = document.getElementById('rolePreviewText');
        const previewAvatar = document.getElementById('rolePreviewAvatar');
        
        if (gmToggle && previewText) {
            if (gmToggle.checked) {
                previewText.textContent = 'Spielleiter (GM)';
                if (previewAvatar) previewAvatar.style.background = 'var(--success, #22c55e)';
            } else {
                previewText.textContent = 'Spieler';
                if (previewAvatar) previewAvatar.style.background = 'var(--text-muted, #666)';
            }
        }
    }
    
    save() {
        console.log('[Settings] Save called, tempAvatar:', this.tempAvatar ? 'set (' + this.tempAvatar.length + ' chars)' : 'null');
        
        const saveBtn = document.getElementById('saveSettingsBtn');
        const userData = this.getUserData();
        
        // Get new values
        const newName = document.getElementById('settingsNameInput')?.value?.trim();
        const selectedColor = document.querySelector('.color-swatch.selected');
        const newColor = selectedColor?.dataset.color || userData.color;
        
        if (!newName || newName.length < 2) {
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.error('Bitte gib einen Namen mit mindestens 2 Zeichen ein', 'Ungültiger Name');
            }
            return;
        }
        
        // Show loading state
        if (saveBtn && window.RIFT?.ui?.Button) RIFT.ui.Button.setLoading(saveBtn, true);
        
        // Update user data
        userData.name = newName;
        userData.initial = newName.charAt(0).toUpperCase();
        userData.color = newColor;
        
        // Handle avatar
        if (this.tempAvatar) {
            userData.avatar = this.tempAvatar;
            console.log('[Settings] Avatar will be saved, length:', this.tempAvatar.length);
        } else {
            console.log('[Settings] No new avatar to save, keeping existing:', userData.avatar ? 'yes' : 'no');
        }
        
        // Handle GM status
        const gmToggle = document.getElementById('settingsIsGM');
        if (gmToggle) {
            userData.isGM = gmToggle.checked;
            console.log('[Settings] isGM will be saved:', userData.isGM);
        }
        
        // Save to localStorage
        try {
            const jsonData = JSON.stringify(userData);
            console.log('[Settings] Total data size:', jsonData.length, 'bytes');
            localStorage.setItem('rift_user', jsonData);
            console.log('[Settings] User data saved successfully');
            
            // Verify save
            const verify = JSON.parse(localStorage.getItem('rift_user'));
            console.log('[Settings] Verified avatar in storage:', verify.avatar ? 'yes (' + verify.avatar.length + ')' : 'no');
        } catch (e) {
            console.error('[Settings] Failed to save:', e);
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.error('Speichern fehlgeschlagen - Bild zu groß?', 'Fehler');
            }
            if (saveBtn && window.RIFT?.ui?.Button) RIFT.ui.Button.setLoading(saveBtn, false);
            return;
        }
        
        // Also update Firestore members collection if in a room
        this.updateFirestoreMember(userData);
        
        // Show success and close
        setTimeout(() => {
            if (saveBtn && window.RIFT?.ui?.Button) RIFT.ui.Button.setLoading(saveBtn, false);
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.success('Einstellungen gespeichert');
            }
            this.close();
            
            // Refresh the page to update all UI
            setTimeout(() => window.location.reload(), 500);
        }, 300);
    }
    
    async updateFirestoreMember(userData) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) return;
            
            // 1. Update users collection (for global profile sync)
            try {
                await firebase.firestore()
                    .collection('users')
                    .doc(user.uid)
                    .set({
                        displayName: userData.name,
                        name: userData.name,
                        color: userData.color,
                        avatar: userData.avatar || null,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                console.log('[Settings] Firestore users collection updated');
            } catch (e) {
                console.error('[Settings] Failed to update users collection:', e);
            }
            
            // 2. Update room members collection (if in a room)
            const roomCode = localStorage.getItem('rift_current_room');
            if (!roomCode) return;
            
            const cleanRoomCode = roomCode.replace(/-/g, '').toUpperCase();
            const memberRef = firebase.firestore()
                .collection('rooms')
                .doc(cleanRoomCode)
                .collection('members')
                .doc(user.uid);
            
            await memberRef.update({
                displayName: userData.name,
                name: userData.name,
                color: userData.color,
                avatar: userData.avatar || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('[Settings] Firestore member updated');
        } catch (e) {
            console.error('[Settings] Failed to update Firestore member:', e);
        }
    }
    
    getUserData() {
        const stored = localStorage.getItem('rift_user');
        return stored ? JSON.parse(stored) : {};
    }
    
    // ========================================
    // NAME HANDLING
    // ========================================
    
    generateRandomName() {
        const nameInput = document.getElementById('settingsNameInput');
        if (nameInput && window.RIFT?.auth?.generateUsername) {
            nameInput.value = window.RIFT.auth.generateUsername();
            this.updatePreviews();
        }
    }
    
    // ========================================
    // COLOR HANDLING
    // ========================================
    
    renderColorGrid() {
        const grid = document.getElementById('colorGrid');
        if (!grid) return;
        
        const colors = window.RIFT?.auth?.userColors || [
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
        
        grid.innerHTML = colors.map(c => `
            <button class="color-swatch" data-color="${c.value}" style="background: ${c.value}" title="${c.name}"></button>
        `).join('');
    }
    
    selectColor(swatch) {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        this.updatePreviews();
    }
    
    // ========================================
    // PREVIEW UPDATES
    // ========================================
    
    updatePreviews() {
        const userData = this.getUserData();
        const name = document.getElementById('settingsNameInput')?.value || userData.name || 'Spieler';
        const selectedColor = document.querySelector('.color-swatch.selected');
        const color = selectedColor?.dataset.color || userData.color || '#FF4655';
        const initial = name.charAt(0).toUpperCase();
        const avatar = this.tempAvatar !== null ? this.tempAvatar : userData.avatar;
        
        // Name preview
        const nameAvatar = document.getElementById('namePreviewAvatar');
        const nameText = document.getElementById('namePreviewText');
        if (nameAvatar) {
            nameAvatar.style.background = color;
            if (avatar) {
                nameAvatar.innerHTML = `<img src="${avatar}" alt="">`;
            } else {
                nameAvatar.textContent = initial;
            }
        }
        if (nameText) {
            nameText.textContent = name;
            nameText.style.color = color;
        }
        
        // Color preview
        const colorAvatar = document.getElementById('colorPreviewAvatar');
        const colorText = document.getElementById('colorPreviewText');
        if (colorAvatar) {
            colorAvatar.style.background = color;
            if (avatar) {
                colorAvatar.innerHTML = `<img src="${avatar}" alt="">`;
            } else {
                colorAvatar.textContent = initial;
            }
        }
        if (colorText) {
            colorText.textContent = name;
            colorText.style.color = color;
        }
    }
    
    updateAvatarPreview(avatar, color, initial) {
        const previewLarge = document.getElementById('avatarPreviewLarge');
        const fallback = document.getElementById('avatarFallback');
        const removeBtn = document.getElementById('removeAvatarBtn');
        
        if (avatar) {
            previewLarge.innerHTML = `<img src="${avatar}" alt="">`;
            if (removeBtn) removeBtn.style.display = '';
        } else {
            previewLarge.innerHTML = `<div class="avatar-fallback" style="background: ${color}">${initial || '?'}</div>`;
            if (removeBtn) removeBtn.style.display = 'none';
        }
    }
    
    // ========================================
    // AVATAR/IMAGE HANDLING
    // ========================================
    
    handleFileSelect(e) {
        console.log('[Settings] handleFileSelect called');
        const file = e.target.files[0];
        if (!file) {
            console.log('[Settings] No file selected');
            return;
        }
        
        console.log('[Settings] File selected:', file.name, file.type, file.size);
        
        // Validate file
        if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
            alert('Bitte wähle ein Bild (JPG, PNG, GIF oder WebP)');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
            alert('Das Bild darf maximal 2MB groß sein');
            return;
        }
        
        // Read and show cropper
        const reader = new FileReader();
        reader.onload = (event) => {
            console.log('[Settings] File read complete, length:', event.target.result.length);
            this.originalImage = event.target.result;
            this.showCropper(this.originalImage);
        };
        reader.onerror = (err) => {
            console.error('[Settings] FileReader error:', err);
        };
        reader.readAsDataURL(file);
        
        // Reset input
        e.target.value = '';
    }
    
    showCropper(imageSrc) {
        console.log('[Settings] showCropper called');
        
        const cropperImage = document.getElementById('cropperImage');
        const normalView = document.getElementById('avatarNormalView');
        const cropperView = document.getElementById('avatarCropperView');
        
        if (normalView) normalView.style.display = 'none';
        if (cropperView) cropperView.classList.add('active');
        
        // Destroy existing cropper first
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        
        // Set image source and wait for load
        if (cropperImage) {
            cropperImage.onload = () => {
                console.log('[Settings] Cropper image loaded, initializing cropper');
                this.initCropper();
            };
            cropperImage.onerror = (err) => {
                console.error('[Settings] Failed to load image:', err);
            };
            cropperImage.src = imageSrc;
        }
    }
    
    initCropper() {
        const cropperImage = document.getElementById('cropperImage');
        if (!cropperImage || !cropperImage.src) {
            console.error('[Settings] initCropper: No image element or src');
            return;
        }
        
        console.log('[Settings] initCropper: Cropper available:', typeof Cropper !== 'undefined');
        
        // Check if Cropper.js is available
        if (typeof Cropper !== 'undefined') {
            try {
                this.cropper = new Cropper(cropperImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.9,
                    cropBoxResizable: false,
                    cropBoxMovable: false,
                    guides: false,
                    center: true,
                    highlight: false,
                    background: true,
                    responsive: true,
                    restore: false,
                    checkCrossOrigin: false,
                    checkOrientation: true,
                    modal: true,
                    ready: () => {
                        console.log('[Settings] Cropper ready');
                        const slider = document.getElementById('zoomSlider');
                        if (slider) slider.value = 1;
                    }
                });
                console.log('[Settings] Cropper instance created');
            } catch (err) {
                console.error('[Settings] Failed to create Cropper:', err);
            }
        } else {
            // Fallback: Just use the image as-is
            console.warn('[Settings] Cropper.js not loaded, will use image directly');
        }
    }
    
    rotateCrop(degrees) {
        if (this.cropper) {
            this.cropper.rotate(degrees);
        }
    }
    
    zoomCrop(value) {
        if (this.cropper) {
            this.cropper.zoomTo(parseFloat(value));
        }
    }
    
    cancelCrop() {
        const normalView = document.getElementById('avatarNormalView');
        const cropperView = document.getElementById('avatarCropperView');
        const cropperImage = document.getElementById('cropperImage');
        
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        
        // Reset image
        if (cropperImage) {
            cropperImage.src = '';
            cropperImage.onload = null;
        }
        
        if (normalView) normalView.style.display = '';
        if (cropperView) cropperView.classList.remove('active');
    }
    
    applyCrop() {
        console.log('[Settings] applyCrop called, cropper:', !!this.cropper, 'originalImage:', !!this.originalImage);
        
        let croppedImage = null;
        
        if (this.cropper) {
            try {
                // Get cropped canvas
                const canvas = this.cropper.getCroppedCanvas({
                    width: 256,
                    height: 256,
                    imageSmoothingQuality: 'high'
                });
                
                if (canvas) {
                    croppedImage = canvas.toDataURL('image/jpeg', 0.85);
                    console.log('[Settings] Cropped image created, length:', croppedImage.length);
                } else {
                    console.error('[Settings] Failed to get cropped canvas');
                }
            } catch (err) {
                console.error('[Settings] Cropper error:', err);
            }
        }
        
        // Fallback: use original image if cropper failed
        if (!croppedImage && this.originalImage) {
            croppedImage = this.originalImage;
            console.log('[Settings] Using original image as fallback');
        }
        
        if (!croppedImage) {
            console.error('[Settings] No image available');
            if (window.RIFT?.ui?.Toast) {
                RIFT.ui.Toast.error('Bild konnte nicht verarbeitet werden');
            }
            return;
        }
        
        // Store for saving
        this.tempAvatar = croppedImage;
        console.log('[Settings] tempAvatar set, length:', this.tempAvatar.length);
        
        // Update preview
        const userData = this.getUserData();
        this.updateAvatarPreview(croppedImage, userData.color, userData.initial);
        this.updatePreviews();
        
        // Hide cropper
        this.cancelCrop();
        
        // Show success feedback
        if (window.RIFT?.ui?.Toast) {
            RIFT.ui.Toast.info('Bild übernommen - klicke "Speichern"');
        }
    }
    
    resizeImage(dataUrl, maxSize) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = maxSize;
                canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                
                // Center crop
                const size = Math.min(img.width, img.height);
                const x = (img.width - size) / 2;
                const y = (img.height - size) / 2;
                
                ctx.drawImage(img, x, y, size, size, 0, 0, maxSize, maxSize);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = dataUrl;
        });
    }
    
    removeAvatar() {
        this.tempAvatar = null;
        
        // Update user data
        const userData = this.getUserData();
        userData.avatar = null;
        localStorage.setItem('rift_user', JSON.stringify(userData));
        
        // Update preview
        this.updateAvatarPreview(null, userData.color, userData.initial);
        this.updatePreviews();
    }
}

// ========================================
// GLOBAL INSTANCE & HELPERS
// ========================================

let settingsManager;

document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});

// Open settings from dropdown - MUST be global for onclick handlers
function openSettings(tab = 'name') {
    if (settingsManager) {
        settingsManager.open(tab);
    } else {
        // Fallback: try to create manager if not yet initialized
        settingsManager = new SettingsManager();
        settingsManager.open(tab);
    }
}

// Make absolutely sure it's global
window.openSettings = openSettings;

// Export
if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.settings = {
        open: (tab) => openSettings(tab)
    };
}

/**
 * RIFT v2 - Admin System
 * Secure Firebase Auth-based admin access
 */

class AdminSystem {
    constructor() {
        console.log('[Admin] AdminSystem constructor called');
        this.isAdmin = false;
        this.adminUser = null;
        this.tapCount = 0;
        this.tapTimer = null;
        
        // Admin UIDs - add your Firebase UID here after first login
        // Find your UID in Firebase Console > Authentication > Users
        this.ADMIN_UIDS = [
            'geBL1R192jUiPrFK1oJ5u2Z25hM2'  // Mike's UID from console
        ];
        
        // Admin emails (alternative check)
        this.ADMIN_EMAILS = [
            'mike@rift.app',
            'admin@rift.app',
            'crussong@proton.me',
            'mike1lusson@gmail.com'
        ];
        
        console.log('[Admin] Admin UIDs:', this.ADMIN_UIDS);
        console.log('[Admin] Admin Emails:', this.ADMIN_EMAILS);
        
        this.init();
    }
    
    init() {
        this.checkAuthState();
        this.createLoginModal();
        this.bindEvents();
        
        // Re-check admin status after a delay (in case Firebase Auth is slow)
        setTimeout(() => {
            if (!this.isAdmin && typeof firebase !== 'undefined' && firebase.auth) {
                const user = firebase.auth().currentUser;
                console.log('[Admin] Delayed check - current user:', user ? user.email : 'null');
                if (user && this.isAdminUser(user)) {
                    this.isAdmin = true;
                    this.adminUser = user;
                    console.log('[Admin] ✓ Delayed auth as admin:', user.email);
                    this.updateUI();
                }
            }
        }, 2000);
    }
    
    // ========================================
    // FIREBASE AUTH STATE
    // ========================================
    
    checkAuthState() {
        console.log('[Admin] checkAuthState called');
        
        // Wait for Firebase to be FULLY initialized (not just defined)
        const waitForFirebase = () => {
            console.log('[Admin] Checking Firebase status...');
            
            // Check if Firebase is fully ready
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.apps && firebase.apps.length > 0) {
                console.log('[Admin] Firebase fully initialized, checking auth');
                
                try {
                    // Check current user immediately
                    const currentUser = firebase.auth().currentUser;
                    console.log('[Admin] Current user on init:', currentUser ? currentUser.email : 'null');
                    
                    if (currentUser && this.isAdminUser(currentUser)) {
                        this.isAdmin = true;
                        this.adminUser = currentUser;
                        console.log('[Admin] ✓ Immediately authenticated as admin:', currentUser.email);
                        this.updateUI();
                    }
                    
                    // Also listen for future changes
                    firebase.auth().onAuthStateChanged((user) => {
                        console.log('[Admin] Auth state changed, user:', user ? user.email : 'null');
                        if (user && this.isAdminUser(user)) {
                            this.isAdmin = true;
                            this.adminUser = user;
                            console.log('[Admin] ✓ Authenticated as admin:', user.email);
                        } else {
                            this.isAdmin = false;
                            this.adminUser = null;
                            if (user) {
                                console.log('[Admin] ✗ User logged in but not admin:', user.email);
                            }
                        }
                        this.updateUI();
                    });
                } catch (e) {
                    console.warn('[Admin] Firebase auth error, retrying...', e.message);
                    setTimeout(waitForFirebase, 500);
                }
            } else {
                console.log('[Admin] Firebase not ready yet, waiting...');
                setTimeout(waitForFirebase, 200);
            }
        };
        
        // Start checking after a small delay
        setTimeout(waitForFirebase, 500);
    }
    
    isAdminUser(user) {
        if (!user) return false;
        
        console.log('[Admin] Checking user:', user.email, 'UID:', user.uid);
        console.log('[Admin] Admin emails:', this.ADMIN_EMAILS);
        console.log('[Admin] Admin UIDs:', this.ADMIN_UIDS);
        
        // Check UID
        if (this.ADMIN_UIDS.includes(user.uid)) {
            console.log('[Admin] ✓ Matched by UID');
            return true;
        }
        
        // Check email (case-insensitive)
        const userEmail = user.email?.toLowerCase();
        const adminEmails = this.ADMIN_EMAILS.map(e => e.toLowerCase());
        
        if (userEmail && adminEmails.includes(userEmail)) {
            console.log('[Admin] ✓ Matched by email');
            return true;
        }
        
        console.log('[Admin] ✗ No match found');
        return false;
    }
    
    // ========================================
    // LOGIN MODAL
    // ========================================
    
    createLoginModal() {
        const modalHTML = `
            <div class="modal-overlay" id="adminLoginModal">
                <div class="modal" style="max-width: 400px;">
                    <div class="modal__header">
                        <h2 class="modal__title" style="color: var(--accent);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 8px;">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Admin Login
                        </h2>
                        <button class="modal__close" id="closeAdminLogin">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal__body">
                        <div id="adminLoginForm">
                            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
                                Melde dich mit deinem Admin-Account an.
                            </p>
                            
                            <div class="settings-form-group" style="margin-bottom: 12px;">
                                <label class="settings-label" for="adminEmailInput">E-Mail</label>
                                <input type="email" 
                                       id="adminEmailInput" 
                                       class="form-input" 
                                       placeholder="admin@rift.app"
                                       autocomplete="email">
                            </div>
                            
                            <div class="settings-form-group">
                                <label class="settings-label" for="adminPasswordInput">Passwort</label>
                                <input type="password" 
                                       id="adminPasswordInput" 
                                       class="form-input" 
                                       placeholder="••••••••••"
                                       autocomplete="current-password">
                            </div>
                            
                            <p class="form-hint admin-error" id="adminError" style="color: var(--accent); display: none; margin-top: 8px;">
                                Login fehlgeschlagen
                            </p>
                            
                            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                                <button class="btn btn--secondary" id="adminGoogleLogin" style="width: 100%; justify-content: center;">
                                    <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right: 8px;">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Mit Google anmelden
                                </button>
                            </div>
                        </div>
                        
                        <div id="adminLoggedIn" style="display: none; text-align: center;">
                            <div style="margin-bottom: 16px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="width: 48px; height: 48px;">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                            </div>
                            <p style="color: var(--text); margin-bottom: 4px;">Eingeloggt als <strong>Admin</strong></p>
                            <p id="adminUserEmail" style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;"></p>
                            <p style="color: var(--text-muted); font-size: 13px;">Edit-Buttons sind jetzt sichtbar.</p>
                        </div>
                        
                        <div id="adminNotAuthorized" style="display: none; text-align: center;">
                            <div style="margin-bottom: 16px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="width: 48px; height: 48px;">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            </div>
                            <p style="color: var(--text); margin-bottom: 4px;">Kein Admin-Zugriff</p>
                            <p id="notAdminEmail" style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;"></p>
                            <p style="color: var(--text-muted); font-size: 13px;">Dieser Account hat keine Admin-Rechte.</p>
                        </div>
                    </div>
                    
                    <div class="modal__footer">
                        <button class="btn btn--secondary" id="cancelAdminLogin">Schließen</button>
                        <button class="btn btn--primary" id="submitAdminLogin">Einloggen</button>
                        <button class="btn btn--danger" id="adminLogoutBtn" style="display: none;">Ausloggen</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // ========================================
    // EVENT BINDING
    // ========================================
    
    bindEvents() {
        // Desktop: Ctrl+Shift+A
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.openLoginModal();
            }
        });
        
        // Mobile: 5x tap on logo
        this.bindLogoTap();
        
        // Secret URL parameter: ?admin
        if (window.location.search.includes('admin')) {
            setTimeout(() => this.openLoginModal(), 500);
            // Remove from URL
            const url = new URL(window.location);
            url.searchParams.delete('admin');
            window.history.replaceState({}, '', url);
        }
        
        // Modal events
        document.getElementById('closeAdminLogin')?.addEventListener('click', () => this.closeLoginModal());
        document.getElementById('cancelAdminLogin')?.addEventListener('click', () => this.closeLoginModal());
        document.getElementById('submitAdminLogin')?.addEventListener('click', () => this.attemptLogin());
        document.getElementById('adminLogoutBtn')?.addEventListener('click', () => this.logout());
        document.getElementById('adminGoogleLogin')?.addEventListener('click', () => this.loginWithGoogle());
        
        // Enter key in password field
        document.getElementById('adminPasswordInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.attemptLogin();
            }
        });
        
        // Click outside to close
        document.getElementById('adminLoginModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'adminLoginModal') {
                this.closeLoginModal();
            }
        });
        
        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeLoginModal();
            }
        });
    }
    
    bindLogoTap() {
        const bindTapEvents = () => {
            const logos = document.querySelectorAll('.sidebar__logo, .footer__logo, .login-logo, [data-admin-trigger]');
            
            logos.forEach(logo => {
                if (logo.dataset.adminBound) return;
                logo.dataset.adminBound = 'true';
                
                logo.addEventListener('click', (e) => {
                    this.handleLogoTap(e);
                });
            });
        };
        
        bindTapEvents();
        setTimeout(bindTapEvents, 500);
    }
    
    handleLogoTap(e) {
        this.tapCount++;
        
        clearTimeout(this.tapTimer);
        this.tapTimer = setTimeout(() => {
            this.tapCount = 0;
        }, 2000);
        
        if (this.tapCount >= 5) {
            e.preventDefault();
            this.tapCount = 0;
            clearTimeout(this.tapTimer);
            this.openLoginModal();
        }
    }
    
    // ========================================
    // LOGIN/LOGOUT
    // ========================================
    
    openLoginModal() {
        const modal = document.getElementById('adminLoginModal');
        const loginForm = document.getElementById('adminLoginForm');
        const loggedIn = document.getElementById('adminLoggedIn');
        const notAuthorized = document.getElementById('adminNotAuthorized');
        const submitBtn = document.getElementById('submitAdminLogin');
        const logoutBtn = document.getElementById('adminLogoutBtn');
        const emailInput = document.getElementById('adminEmailInput');
        const passwordInput = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminError');
        
        // Reset
        loginForm.style.display = 'none';
        loggedIn.style.display = 'none';
        notAuthorized.style.display = 'none';
        submitBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
        
        if (this.isAdmin && this.adminUser) {
            // Logged in as admin
            loggedIn.style.display = '';
            document.getElementById('adminUserEmail').textContent = this.adminUser.email;
            logoutBtn.style.display = '';
        } else if (this.adminUser && !this.isAdmin) {
            // Logged in but not admin
            notAuthorized.style.display = '';
            document.getElementById('notAdminEmail').textContent = this.adminUser.email;
            logoutBtn.style.display = '';
        } else {
            // Not logged in
            loginForm.style.display = '';
            submitBtn.style.display = '';
            emailInput.value = '';
            passwordInput.value = '';
            error.style.display = 'none';
        }
        
        modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        if (!this.adminUser) {
            setTimeout(() => emailInput?.focus(), 100);
        }
    }
    
    closeLoginModal() {
        const modal = document.getElementById('adminLoginModal');
        modal?.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    async attemptLogin() {
        const emailInput = document.getElementById('adminEmailInput');
        const passwordInput = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminError');
        const submitBtn = document.getElementById('submitAdminLogin');
        
        const email = emailInput?.value?.trim() || '';
        const password = passwordInput?.value || '';
        
        if (!email || !password) {
            error.textContent = 'Bitte E-Mail und Passwort eingeben';
            error.style.display = '';
            return;
        }
        
        // Show loading
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner"></div>';
        error.style.display = 'none';
        
        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = result.user;
            
            if (this.isAdminUser(user)) {
                this.isAdmin = true;
                this.adminUser = user;
                this.updateUI();
                this.closeLoginModal();
                this.showToast('Admin-Modus aktiviert');
                console.log('[Admin] Login successful:', user.email, 'UID:', user.uid);
            } else {
                // Logged in but not admin
                this.adminUser = user;
                this.isAdmin = false;
                error.textContent = 'Dieser Account hat keine Admin-Rechte';
                error.style.display = '';
                console.log('[Admin] User is not admin:', user.email, 'UID:', user.uid);
            }
        } catch (err) {
            console.error('[Admin] Login error:', err);
            
            let message = 'Login fehlgeschlagen';
            if (err.code === 'auth/user-not-found') {
                message = 'Kein Account mit dieser E-Mail gefunden';
            } else if (err.code === 'auth/wrong-password') {
                message = 'Falsches Passwort';
            } else if (err.code === 'auth/invalid-email') {
                message = 'Ungültige E-Mail-Adresse';
            } else if (err.code === 'auth/too-many-requests') {
                message = 'Zu viele Versuche. Bitte später erneut versuchen.';
            }
            
            error.textContent = message;
            error.style.display = '';
            passwordInput.value = '';
            passwordInput.focus();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
    
    async loginWithGoogle() {
        const error = document.getElementById('adminError');
        const googleBtn = document.getElementById('adminGoogleLogin');
        
        const originalHTML = googleBtn.innerHTML;
        googleBtn.disabled = true;
        googleBtn.innerHTML = '<div class="spinner"></div>';
        error.style.display = 'none';
        
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            
            if (this.isAdminUser(user)) {
                this.isAdmin = true;
                this.adminUser = user;
                this.updateUI();
                this.closeLoginModal();
                this.showToast('Admin-Modus aktiviert');
                console.log('[Admin] Google login successful:', user.email, 'UID:', user.uid);
            } else {
                this.adminUser = user;
                this.isAdmin = false;
                // Update modal to show "not authorized" state
                this.openLoginModal();
                console.log('[Admin] Google user is not admin:', user.email, 'UID:', user.uid);
            }
        } catch (err) {
            console.error('[Admin] Google login error:', err);
            if (err.code !== 'auth/popup-closed-by-user') {
                error.textContent = err.message || 'Google-Anmeldung fehlgeschlagen';
                error.style.display = '';
            }
        } finally {
            googleBtn.disabled = false;
            googleBtn.innerHTML = originalHTML;
        }
    }
    
    async logout() {
        try {
            await firebase.auth().signOut();
            this.isAdmin = false;
            this.adminUser = null;
            this.updateUI();
            this.closeLoginModal();
            this.showToast('Admin-Modus deaktiviert');
        } catch (err) {
            console.error('[Admin] Logout error:', err);
        }
    }
    
    // ========================================
    // UI UPDATE
    // ========================================
    
    updateUI() {
        console.log('[Admin] updateUI called, isAdmin:', this.isAdmin);
        
        // Toggle admin-only elements
        document.querySelectorAll('[data-admin-only]').forEach(el => {
            el.style.display = this.isAdmin ? '' : 'none';
        });
        
        // Add/remove admin class on body (CSS expects 'admin-mode')
        document.body.classList.toggle('admin-mode', this.isAdmin);
        document.body.classList.toggle('is-admin', this.isAdmin);
        
        // Show/hide edit buttons (non-news ones)
        document.querySelectorAll('.admin-edit-btn, .article-edit-trigger, [data-admin-edit]').forEach(btn => {
            btn.style.display = this.isAdmin ? '' : 'none';
        });
        
        // News edit buttons are controlled by CSS hover via .admin-mode class
    }
    
    showToast(message) {
        if (window.RIFT?.ui?.Toast) {
            RIFT.ui.Toast.success(message);
        } else {
            console.log('[Admin]', message);
        }
    }
    
    // ========================================
    // PUBLIC API
    // ========================================
    
    checkAdmin() {
        return this.isAdmin;
    }
    
    getAdminUser() {
        return this.adminUser;
    }
}

// Initialize
const RIFTAdmin = new AdminSystem();

// Export for global access
window.RIFTAdmin = RIFTAdmin;

// Alias for backward compatibility
window.RIFT = window.RIFT || {};
window.RIFT.admin = {
    isAdmin: () => RIFTAdmin.isAdmin,
    checkAdmin: () => RIFTAdmin.checkAdmin(),
    getAdminUser: () => RIFTAdmin.getAdminUser()
};

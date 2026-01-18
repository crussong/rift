/**
 * RIFT v2 - Admin System
 * Owner-only access for Mike
 */

class AdminSystem {
    constructor() {
        this.isAdmin = false;
        this.tapCount = 0;
        this.tapTimer = null;
        this.ADMIN_KEY = 'rift_admin_session';
        this.SECRET_HASH = this.hash('Gitarrensolo710');
        
        this.init();
    }
    
    // Simple hash function (not cryptographically secure, but good enough for this)
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    
    init() {
        this.checkAdminSession();
        this.createLoginModal();
        this.bindEvents();
        this.updateUI();
    }
    
    // ========================================
    // SESSION MANAGEMENT
    // ========================================
    
    checkAdminSession() {
        const session = localStorage.getItem(this.ADMIN_KEY);
        if (session) {
            try {
                const data = JSON.parse(session);
                // Session valid for 7 days
                if (data.hash === this.SECRET_HASH && data.expires > Date.now()) {
                    this.isAdmin = true;
                } else {
                    localStorage.removeItem(this.ADMIN_KEY);
                }
            } catch (e) {
                localStorage.removeItem(this.ADMIN_KEY);
            }
        }
    }
    
    createSession() {
        const session = {
            hash: this.SECRET_HASH,
            expires: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
            created: Date.now()
        };
        localStorage.setItem(this.ADMIN_KEY, JSON.stringify(session));
        this.isAdmin = true;
    }
    
    logout() {
        localStorage.removeItem(this.ADMIN_KEY);
        this.isAdmin = false;
        this.updateUI();
        this.closeLoginModal();
    }
    
    // ========================================
    // LOGIN MODAL
    // ========================================
    
    createLoginModal() {
        const modalHTML = `
            <div class="modal-overlay" id="adminLoginModal">
                <div class="modal" style="max-width: 360px;">
                    <div class="modal__header">
                        <h2 class="modal__title" style="color: var(--accent);">🔐 Admin</h2>
                        <button class="modal__close" id="closeAdminLogin">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal__body">
                        <div id="adminLoginForm">
                            <div class="settings-form-group">
                                <label class="settings-label" for="adminPasswordInput">Passwort</label>
                                <input type="password" 
                                       id="adminPasswordInput" 
                                       class="form-input" 
                                       placeholder="••••••••••"
                                       autocomplete="off">
                                <p class="form-hint admin-error" id="adminError" style="color: var(--accent); display: none;">
                                    Falsches Passwort
                                </p>
                            </div>
                        </div>
                        
                        <div id="adminLoggedIn" style="display: none; text-align: center;">
                            <div style="margin-bottom: 16px;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" style="width: 48px; height: 48px;">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                            </div>
                            <p style="color: var(--text); margin-bottom: 8px;">Du bist eingeloggt als <strong>Admin</strong></p>
                            <p style="color: var(--text-muted); font-size: 13px;">Edit-Buttons sind jetzt sichtbar.</p>
                        </div>
                    </div>
                    
                    <div class="modal__footer">
                        <button class="btn btn--secondary" id="cancelAdminLogin">Abbrechen</button>
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
        // Find all RIFT logos (sidebar, footer, etc.)
        // Use more specific selectors and handle dynamically created elements
        const bindTapEvents = () => {
            const logos = document.querySelectorAll('.sidebar__logo, .footer__logo, .login-logo, [data-admin-trigger]');
            
            logos.forEach(logo => {
                // Avoid double-binding
                if (logo.dataset.adminBound) return;
                logo.dataset.adminBound = 'true';
                
                logo.addEventListener('click', (e) => {
                    this.handleLogoTap(e);
                });
            });
        };
        
        // Bind immediately and also after DOM changes (for dynamic layouts)
        bindTapEvents();
        setTimeout(bindTapEvents, 500); // After layout.js finishes
    }
    
    handleLogoTap(e) {
        this.tapCount++;
        
        // Reset after 2 seconds of no tapping
        clearTimeout(this.tapTimer);
        this.tapTimer = setTimeout(() => {
            this.tapCount = 0;
        }, 2000);
        
        // 5 taps opens admin login
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
        const submitBtn = document.getElementById('submitAdminLogin');
        const cancelBtn = document.getElementById('cancelAdminLogin');
        const logoutBtn = document.getElementById('adminLogoutBtn');
        const passwordInput = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminError');
        
        // Show appropriate view
        if (this.isAdmin) {
            loginForm.style.display = 'none';
            loggedIn.style.display = '';
            submitBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
            logoutBtn.style.display = '';
        } else {
            loginForm.style.display = '';
            loggedIn.style.display = 'none';
            submitBtn.style.display = '';
            cancelBtn.style.display = '';
            logoutBtn.style.display = 'none';
            passwordInput.value = '';
            error.style.display = 'none';
        }
        
        modal?.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus password input
        if (!this.isAdmin) {
            setTimeout(() => passwordInput?.focus(), 100);
        }
    }
    
    closeLoginModal() {
        const modal = document.getElementById('adminLoginModal');
        modal?.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    attemptLogin() {
        const passwordInput = document.getElementById('adminPasswordInput');
        const error = document.getElementById('adminError');
        const password = passwordInput?.value || '';
        
        if (this.hash(password) === this.SECRET_HASH) {
            // Success!
            this.createSession();
            this.updateUI();
            this.closeLoginModal();
            
            // Show success feedback
            this.showToast('Admin-Modus aktiviert');
        } else {
            // Wrong password
            error.style.display = '';
            passwordInput.classList.add('error');
            passwordInput.value = '';
            passwordInput.focus();
            
            // Shake animation
            passwordInput.style.animation = 'shake 0.5s ease';
            setTimeout(() => {
                passwordInput.style.animation = '';
            }, 500);
        }
    }
    
    // ========================================
    // UI UPDATE
    // ========================================
    
    updateUI() {
        // Show/hide all admin elements
        document.querySelectorAll('.news-admin-btn, [data-admin-only]').forEach(el => {
            el.style.display = this.isAdmin ? '' : 'none';
        });
        
        // Add admin indicator to body
        document.body.classList.toggle('admin-mode', this.isAdmin);
        
        // Dispatch event for other modules
        window.dispatchEvent(new CustomEvent('adminStatusChanged', { 
            detail: { isAdmin: this.isAdmin } 
        }));
    }
    
    showToast(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = 'admin-toast';
        toast.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            ${message}
        `;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('visible'), 10);
        
        // Remove after 3s
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // ========================================
    // PUBLIC API
    // ========================================
    
    isAdminLoggedIn() {
        return this.isAdmin;
    }
}

// ========================================
// STYLES
// ========================================

const adminStyles = document.createElement('style');
adminStyles.textContent = `
    /* Shake animation for wrong password */
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-8px); }
        40%, 80% { transform: translateX(8px); }
    }
    
    .form-input.error {
        border-color: var(--accent);
    }
    
    /* Admin toast notification */
    .admin-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: var(--success);
        color: white;
        font-weight: 500;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9999;
        opacity: 0;
        transition: all 0.3s ease;
    }
    
    .admin-toast.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
    
    .admin-toast svg {
        width: 20px;
        height: 20px;
    }
    
    /* Admin mode indicator (optional subtle hint) */
    body.admin-mode .sidebar__logo::after {
        content: '⚙️';
        position: absolute;
        top: -4px;
        right: -4px;
        font-size: 12px;
    }
`;
document.head.appendChild(adminStyles);

// ========================================
// INITIALIZATION
// ========================================

let adminSystem;

document.addEventListener('DOMContentLoaded', () => {
    adminSystem = new AdminSystem();
});

// Export
if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.admin = {
        isAdmin: () => adminSystem?.isAdminLoggedIn(),
        openLogin: () => adminSystem?.openLoginModal(),
        logout: () => adminSystem?.logout()
    };
}

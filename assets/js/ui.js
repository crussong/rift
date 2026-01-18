/**
 * RIFT v2 - UI Components
 * Toast Notifications, Loading States, Skeleton Helpers
 */

window.RIFT = window.RIFT || {};
window.RIFT.ui = {};

/* ========================================
   TOAST NOTIFICATIONS
   ======================================== */

RIFT.ui.Toast = (function() {
    let container = null;
    
    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>`
    };
    
    function init() {
        if (container) return;
        
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    function show(options = {}) {
        init();
        
        const {
            type = 'info',
            title = '',
            message = '',
            duration = 4000,
            closable = true
        } = options;
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        
        toast.innerHTML = `
            <div class="toast__icon">${icons[type] || icons.info}</div>
            <div class="toast__content">
                ${title ? `<div class="toast__title">${title}</div>` : ''}
                ${message ? `<div class="toast__message">${message}</div>` : ''}
            </div>
            ${closable ? `
                <button class="toast__close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            ` : ''}
            ${duration > 0 ? `<div class="toast__progress" style="animation-duration: ${duration}ms"></div>` : ''}
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Close button
        const closeBtn = toast.querySelector('.toast__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hide(toast));
        }
        
        // Auto hide
        if (duration > 0) {
            setTimeout(() => hide(toast), duration);
        }
        
        return toast;
    }
    
    function hide(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }
    
    function success(message, title = 'Erfolg') {
        return show({ type: 'success', title, message });
    }
    
    function error(message, title = 'Fehler') {
        return show({ type: 'error', title, message });
    }
    
    function warning(message, title = 'Achtung') {
        return show({ type: 'warning', title, message });
    }
    
    function info(message, title = 'Info') {
        return show({ type: 'info', title, message });
    }
    
    return { show, hide, success, error, warning, info };
})();


/* ========================================
   SKELETON LOADING HELPERS
   ======================================== */

RIFT.ui.Skeleton = {
    /**
     * Create a skeleton element
     * @param {string} type - text, text-sm, text-lg, title, avatar, avatar-sm, avatar-lg, button, card, image
     * @param {string} width - optional width (e.g., '80%', '200px')
     */
    create(type = 'text', width = null) {
        const el = document.createElement('div');
        el.className = `skeleton skeleton--${type}`;
        if (width) el.style.width = width;
        return el;
    },
    
    /**
     * Create a skeleton card with header and body
     * @param {number} lines - number of text lines in body
     */
    createCard(lines = 3) {
        const card = document.createElement('div');
        card.className = 'skeleton-card';
        
        let bodyHTML = '';
        const widths = ['100%', '90%', '75%', '85%', '60%'];
        for (let i = 0; i < lines; i++) {
            bodyHTML += `<div class="skeleton skeleton--text" style="width: ${widths[i % widths.length]}"></div>`;
        }
        
        card.innerHTML = `
            <div class="skeleton-card__header">
                <div class="skeleton skeleton--avatar"></div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div class="skeleton skeleton--text" style="width: 60%"></div>
                    <div class="skeleton skeleton--text-sm" style="width: 40%"></div>
                </div>
            </div>
            <div class="skeleton-card__body">
                ${bodyHTML}
            </div>
        `;
        
        return card;
    },
    
    /**
     * Replace content with skeleton, return function to restore
     * @param {HTMLElement} element 
     * @param {string} skeletonType 
     */
    replace(element, skeletonType = 'text') {
        const original = element.innerHTML;
        const skeleton = this.create(skeletonType);
        skeleton.style.width = '100%';
        element.innerHTML = '';
        element.appendChild(skeleton);
        
        return () => {
            element.innerHTML = original;
        };
    }
};


/* ========================================
   BUTTON LOADING STATE
   ======================================== */

RIFT.ui.Button = {
    /**
     * Set button to loading state
     * @param {HTMLElement} btn 
     * @param {boolean} loading 
     */
    setLoading(btn, loading = true) {
        if (loading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.classList.add('btn--loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('btn--loading');
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
        }
    },
    
    /**
     * Show success state briefly
     * @param {HTMLElement} btn 
     * @param {number} duration 
     */
    showSuccess(btn, duration = 2000) {
        const originalText = btn.innerHTML;
        btn.classList.add('btn--success');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
        
        setTimeout(() => {
            btn.classList.remove('btn--success');
            btn.innerHTML = originalText;
        }, duration);
    }
};


/* ========================================
   LOADING OVERLAY
   ======================================== */

RIFT.ui.Loading = {
    /**
     * Add loading overlay to element
     * @param {HTMLElement} element 
     */
    show(element) {
        let overlay = element.querySelector('.loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="loading-spinner"></div>';
            element.style.position = 'relative';
            element.appendChild(overlay);
        }
        
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    },
    
    /**
     * Remove loading overlay from element
     * @param {HTMLElement} element 
     */
    hide(element) {
        const overlay = element.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        }
    }
};


/* ========================================
   EMPTY STATE HELPER
   ======================================== */

RIFT.ui.EmptyState = {
    /**
     * Create an empty state element
     * @param {object} options 
     */
    create(options = {}) {
        const {
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>`,
            title = 'Keine Daten',
            message = '',
            actionText = '',
            onAction = null
        } = options;
        
        const el = document.createElement('div');
        el.className = 'empty-state';
        
        el.innerHTML = `
            <div class="empty-state__icon">${icon}</div>
            <h3 class="empty-state__title">${title}</h3>
            ${message ? `<p class="empty-state__message">${message}</p>` : ''}
            ${actionText ? `
                <div class="empty-state__action">
                    <button class="btn btn--primary">${actionText}</button>
                </div>
            ` : ''}
        `;
        
        if (actionText && onAction) {
            el.querySelector('.btn').addEventListener('click', onAction);
        }
        
        return el;
    }
};


/* ========================================
   COPY TO CLIPBOARD WITH TOAST
   ======================================== */

RIFT.ui.copyToClipboard = async function(text, successMessage = 'In Zwischenablage kopiert') {
    try {
        await navigator.clipboard.writeText(text);
        RIFT.ui.Toast.success(successMessage);
        return true;
    } catch (err) {
        RIFT.ui.Toast.error('Kopieren fehlgeschlagen');
        return false;
    }
};


/* ========================================
   CONFIRM DIALOG
   ======================================== */

RIFT.ui.confirm = function(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Bestätigung',
            confirmText = 'Bestätigen',
            cancelText = 'Abbrechen',
            danger = false
        } = options;
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal__header">
                    <h2 class="modal__title">${title}</h2>
                </div>
                <div class="modal__body">
                    <p style="color: var(--text-muted); line-height: 1.6;">${message}</p>
                </div>
                <div class="modal__footer">
                    <button class="btn btn--glass" data-action="cancel">${cancelText}</button>
                    <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));
        
        const close = (result) => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(result);
        };
        
        overlay.querySelector('[data-action="cancel"]').onclick = () => close(false);
        overlay.querySelector('[data-action="confirm"]').onclick = () => close(true);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
};

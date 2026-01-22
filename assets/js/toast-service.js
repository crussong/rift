/**
 * RIFT Global Toast Service
 * Real-time notifications visible to all players in a room
 * Uses Firebase Realtime Database for instant sync
 */

window.RIFTToast = {
    // Config
    TOAST_DURATION: 5000,
    MAX_TOASTS: 5,
    
    // State
    initialized: false,
    roomCode: null,
    userId: null,
    userName: null,
    unsubscribe: null,
    processedIds: new Set(),
    container: null,
    
    // Toast types with icons and colors
    types: {
        dice: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`,
            color: '#8b5cf6'
        },
        diceSuccess: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`,
            color: '#22c55e'
        },
        diceFail: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`,
            color: '#ef4444'
        },
        chat: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22Z"/></svg>`,
            color: '#3b82f6'
        },
        whisper: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 1C8.14 1 5 4.14 5 8C5 11.86 12 23 12 23S19 11.86 19 8C19 4.14 15.86 1 12 1ZM12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11Z"/></svg>`,
            color: '#ec4899'
        },
        mention: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C13.5 22 14.92 21.68 16.22 21.12L17.07 22.76C15.53 23.55 13.82 24 12 24C5.37 24 0 18.63 0 12C0 5.37 5.37 0 12 0C18.63 0 24 5.37 24 12V13.5C24 15.43 22.43 17 20.5 17C19.24 17 18.13 16.33 17.5 15.34C16.5 16.35 15.09 17 13.5 17C10.46 17 8 14.54 8 11.5C8 8.46 10.46 6 13.5 6C14.78 6 15.95 6.45 16.88 7.18L17.5 6.5H19V13.5C19 14.33 19.67 15 20.5 15C21.33 15 22 14.33 22 13.5V12C22 6.48 17.52 2 12 2ZM13.5 15C15.16 15 16.5 13.66 16.5 12C16.5 10.34 15.16 9 13.5 9C11.84 9 10.5 10.34 10.5 12C10.5 13.66 11.84 15 13.5 15Z"/></svg>`,
            color: '#f59e0b'
        },
        whiteboard: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355C4.92893 22 7.28595 22 12 22C16.714 22 19.0711 22 20.5355 20.5355C22 19.0711 22 16.714 22 12C22 7.28595 22 4.92893 20.5355 3.46447C19.0711 2 16.714 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447Z"/></svg>`,
            color: '#06b6d4'
        },
        join: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>`,
            color: '#22c55e'
        },
        leave: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19 13H5V11H19V13Z"/></svg>`,
            color: '#6b7280'
        },
        sessionStart: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5V19L19 12L8 5Z"/></svg>`,
            color: '#22c55e'
        },
        sessionEnd: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/></svg>`,
            color: '#ef4444'
        },
        hpGain: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/></svg>`,
            color: '#22c55e'
        },
        hpLoss: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/></svg>`,
            color: '#ef4444'
        },
        levelUp: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`,
            color: '#f59e0b'
        },
        map: {
            icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM13.9563 14.0949C13.763 14.2644 13.5167 14.3629 13.024 14.56C10.7142 15.4839 9.55936 15.9459 8.89971 15.4976C8.7433 15.3913 8.6084 15.2564 8.50212 15.1C8.05386 14.4404 8.51582 13.2855 9.43973 10.9757C9.6368 10.483 9.73533 10.2367 9.9048 10.0434C9.94799 9.99419 9.99435 9.94782 10.0436 9.90464C10.2368 9.73517 10.4832 9.63663 10.9759 9.43956C13.2856 8.51565 14.4405 8.0537 15.1002 8.50196C15.2566 8.60824 15.3915 8.74314 15.4978 8.89954C15.946 9.5592 15.4841 10.7141 14.5602 13.0239C14.3631 13.5165 14.2646 13.7629 14.0951 13.9561C14.0519 14.0054 14.0055 14.0517 13.9563 14.0949Z"/></svg>`,
            color: '#8b5cf6'
        }
    },
    
    // Initialize the toast system
    init() {
        if (this.initialized) return;
        
        // Get room code
        this.roomCode = localStorage.getItem('rift_current_room');
        if (!this.roomCode) {
            console.log('[Toast] No room code, skipping init');
            return;
        }
        
        // Get user info
        const user = firebase.auth().currentUser;
        const stored = JSON.parse(localStorage.getItem('rift_user') || '{}');
        this.userId = user?.uid;
        this.userName = stored.name || stored.displayName || 'Spieler';
        
        // Create container
        this.createContainer();
        
        // Subscribe to toasts
        this.subscribe();
        
        // Subscribe to presence changes (join/leave)
        this.subscribePresence();
        
        // Clean old toasts periodically
        setInterval(() => this.cleanOldToasts(), 60000);
        
        this.initialized = true;
        console.log('[Toast] Initialized for room:', this.roomCode);
    },
    
    // Subscribe to presence changes (join/leave)
    subscribePresence() {
        const cleanCode = this.roomCode.replace(/-/g, '').toUpperCase();
        const playersRef = firebase.database().ref(`rooms/${cleanCode}/players`);
        
        // Track known online states
        this.onlineStates = {};
        
        playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            
            Object.entries(players).forEach(([oderId, data]) => {
                const wasOnline = this.onlineStates[oderId];
                const isOnline = data.online === true;
                const name = data.name || data.displayName || 'Spieler';
                
                // Skip self
                if (oderId === this.userId) {
                    this.onlineStates[oderId] = isOnline;
                    return;
                }
                
                // Detect state change
                if (wasOnline === false && isOnline === true) {
                    // Player joined
                    this.show({ type: 'join', title: `${name} ist beigetreten` });
                } else if (wasOnline === true && isOnline === false) {
                    // Player left
                    this.show({ type: 'leave', title: `${name} hat den Raum verlassen` });
                }
                
                this.onlineStates[oderId] = isOnline;
            });
        });
        
        console.log('[Toast] Subscribed to presence changes');
    },
    
    // Create the toast container
    createContainer() {
        if (document.getElementById('rift-toast-container')) return;
        
        // Check if on chat page for offset
        const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        const isChat = page === 'chat';
        const bottomOffset = isChat ? 100 : 24;
        
        const container = document.createElement('div');
        container.id = 'rift-toast-container';
        container.innerHTML = `
            <style>
                #rift-toast-container {
                    position: fixed;
                    bottom: ${bottomOffset}px;
                    right: 100px;
                    display: flex;
                    flex-direction: column-reverse;
                    gap: 10px;
                    z-index: 9999;
                    pointer-events: none;
                    max-width: 340px;
                }
                
                .rift-toast {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 16px 20px;
                    min-height: 124px;
                    background: rgba(17, 17, 17, 0.95);
                    backdrop-filter: blur(12px);
                    border-radius: 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                    animation: toastSlideIn 0.3s ease;
                    pointer-events: auto;
                    cursor: pointer;
                    transition: transform 0.2s, opacity 0.2s;
                    box-sizing: border-box;
                }
                
                .rift-toast:hover {
                    transform: translateX(-4px);
                }
                
                .rift-toast.hiding {
                    animation: toastSlideOut 0.3s ease forwards;
                }
                
                @keyframes toastSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes toastSlideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(20px);
                    }
                }
                
                .rift-toast__icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                
                .rift-toast__icon svg {
                    width: 24px;
                    height: 24px;
                }
                
                .rift-toast__content {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 4px;
                }
                
                .rift-toast__title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #fff;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .rift-toast__message {
                    font-size: 13px;
                    color: rgba(255,255,255,0.6);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .rift-toast__result {
                    font-size: 28px;
                    font-weight: 700;
                    font-family: 'JetBrains Mono', monospace;
                    flex-shrink: 0;
                    padding-left: 12px;
                }
                
                .rift-toast__result--success {
                    color: #22c55e;
                }
                
                .rift-toast__result--fail {
                    color: #ef4444;
                }
                
                .rift-toast__result--neutral {
                    color: #8b5cf6;
                }
                
                @media (max-width: 768px) {
                    #rift-toast-container {
                        bottom: ${isChat ? 80 : 16}px;
                        right: 80px;
                        max-width: calc(100vw - 100px);
                    }
                    
                    .rift-toast {
                        min-height: 106px;
                        padding: 14px 16px;
                        border-radius: 14px;
                    }
                    
                    .rift-toast__icon {
                        width: 40px;
                        height: 40px;
                    }
                    
                    .rift-toast__icon svg {
                        width: 20px;
                        height: 20px;
                    }
                    
                    .rift-toast__result {
                        font-size: 22px;
                    }
                }
            </style>
        `;
        
        document.body.appendChild(container);
        this.container = container;
    },
    
    // Subscribe to Firebase toasts
    subscribe() {
        const cleanCode = this.roomCode.replace(/-/g, '').toUpperCase();
        const toastsRef = firebase.database().ref(`rooms/${cleanCode}/toasts`);
        
        // Listen for new toasts only (child_added fires for each existing + new)
        // We use limitToLast to avoid loading old history
        this.unsubscribe = toastsRef.orderByChild('timestamp').limitToLast(10).on('child_added', (snapshot) => {
            const toast = snapshot.val();
            const id = snapshot.key;
            
            // Skip if too old (more than 10 seconds ago)
            if (toast.timestamp && Date.now() - toast.timestamp > 10000) return;
            
            // Skip if already processed
            if (this.processedIds.has(id)) return;
            this.processedIds.add(id);
            
            // Skip own join/leave toasts
            if ((toast.type === 'join' || toast.type === 'leave') && toast.userId === this.userId) return;
            
            // Skip chat toasts on chat page
            const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
            if ((toast.type === 'chat' || toast.type === 'whisper' || toast.type === 'mention') && currentPage === 'chat') return;
            
            // Skip whiteboard toasts on whiteboard page
            if (toast.type === 'whiteboard' && currentPage === 'whiteboard') return;
            
            // Skip whisper/mention not for this user
            if ((toast.type === 'whisper' || toast.type === 'mention') && toast.targetUserId && toast.targetUserId !== this.userId) return;
            
            // Skip dice toasts on dice page (they see it directly)
            if ((toast.type === 'dice' || toast.type === 'diceSuccess' || toast.type === 'diceFail') && currentPage === 'dice') return;
            
            // Skip HP/Level toasts on sheet pages (they see it directly)
            if ((toast.type === 'hpGain' || toast.type === 'hpLoss' || toast.type === 'levelUp') && currentPage.startsWith('sheet-')) return;
            
            this.show(toast);
        });
        
        console.log('[Toast] Subscribed to room toasts');
    },
    
    // Show a toast
    show(toast) {
        if (!this.container) return;
        
        const typeConfig = this.types[toast.type] || this.types.dice;
        
        const el = document.createElement('div');
        el.className = 'rift-toast';
        
        // Build result HTML if present
        let resultHtml = '';
        if (toast.result !== undefined) {
            const resultClass = toast.isSuccess === true ? 'success' : toast.isSuccess === false ? 'fail' : 'neutral';
            resultHtml = `<div class="rift-toast__result rift-toast__result--${resultClass}">${toast.result}</div>`;
        }
        
        el.innerHTML = `
            <div class="rift-toast__icon" style="background: ${typeConfig.color}22; color: ${typeConfig.color};">
                ${typeConfig.icon}
            </div>
            <div class="rift-toast__content">
                <div class="rift-toast__title">${this.escapeHtml(toast.title || '')}</div>
                ${toast.message ? `<div class="rift-toast__message">${this.escapeHtml(toast.message)}</div>` : ''}
            </div>
            ${resultHtml}
        `;
        
        // Click to dismiss
        el.addEventListener('click', () => this.dismiss(el));
        
        // Add to container
        this.container.appendChild(el);
        
        // Limit max toasts
        const toasts = this.container.querySelectorAll('.rift-toast:not(.hiding)');
        if (toasts.length > this.MAX_TOASTS) {
            this.dismiss(toasts[0]);
        }
        
        // Auto dismiss
        setTimeout(() => this.dismiss(el), this.TOAST_DURATION);
    },
    
    // Dismiss a toast
    dismiss(el) {
        if (!el || el.classList.contains('hiding')) return;
        el.classList.add('hiding');
        setTimeout(() => el.remove(), 300);
    },
    
    // Send a toast to all users
    async send(type, title, message = '', extra = {}) {
        // Lazy init roomCode if not set
        if (!this.roomCode) {
            this.roomCode = localStorage.getItem('rift_current_room');
        }
        if (!this.roomCode) return;
        
        // Lazy init userId if not set
        if (!this.userId) {
            const user = firebase.auth?.()?.currentUser;
            this.userId = user?.uid;
        }
        if (!this.userName) {
            const stored = JSON.parse(localStorage.getItem('rift_user') || '{}');
            this.userName = stored.name || stored.displayName || 'Spieler';
        }
        
        const cleanCode = this.roomCode.replace(/-/g, '').toUpperCase();
        const toastsRef = firebase.database().ref(`rooms/${cleanCode}/toasts`);
        
        try {
            await toastsRef.push({
                type,
                title,
                message,
                timestamp: Date.now(),
                userId: this.userId,
                userName: this.userName,
                ...extra
            });
        } catch (e) {
            console.error('[Toast] Failed to send:', e);
        }
    },
    
    // Clean old toasts from Firebase (older than 5 minutes)
    async cleanOldToasts() {
        if (!this.roomCode) return;
        
        const cleanCode = this.roomCode.replace(/-/g, '').toUpperCase();
        const toastsRef = firebase.database().ref(`rooms/${cleanCode}/toasts`);
        const cutoff = Date.now() - 300000; // 5 minutes
        
        try {
            const snapshot = await toastsRef.orderByChild('timestamp').endAt(cutoff).once('value');
            const updates = {};
            snapshot.forEach(child => {
                updates[child.key] = null;
            });
            if (Object.keys(updates).length > 0) {
                await toastsRef.update(updates);
            }
        } catch (e) {
            console.error('[Toast] Failed to clean old toasts:', e);
        }
    },
    
    // Helper: Escape HTML
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    
    // ========================================
    // CONVENIENCE METHODS
    // ========================================
    
    // Dice roll
    diceRoll(playerName, result, formula = '', isSuccess = null) {
        const type = isSuccess === true ? 'diceSuccess' : isSuccess === false ? 'diceFail' : 'dice';
        this.send(type, playerName, formula, { result: String(result), isSuccess });
    },
    
    // Chat mention
    chatMention(senderName, preview, targetUserId) {
        this.send('mention', senderName, preview.substring(0, 60), { targetUserId });
    },
    
    // Whisper
    chatWhisper(senderName, preview, targetUserId) {
        this.send('whisper', `Flüstern von ${senderName}`, preview.substring(0, 60), { targetUserId });
    },
    
    // Player joined
    playerJoined(playerName, oderId) {
        this.send('join', `${playerName} ist beigetreten`, '', { oderId });
    },
    
    // Player left
    playerLeft(playerName, oderId) {
        this.send('leave', `${playerName} hat den Raum verlassen`, '', { oderId });
    },
    
    // Session started
    sessionStarted() {
        this.send('sessionStart', 'Session gestartet!', 'Viel Spaß beim Spielen');
    },
    
    // Session ended
    sessionEnded() {
        this.send('sessionEnd', 'Session beendet', 'Bis zum nächsten Mal!');
    },
    
    // HP change
    hpChange(charName, amount) {
        const isGain = amount > 0;
        const type = isGain ? 'hpGain' : 'hpLoss';
        const sign = isGain ? '+' : '';
        this.send(type, charName, `${sign}${amount} HP`, { result: `${sign}${amount}`, isSuccess: isGain });
    },
    
    // Level up
    levelUp(charName, newLevel) {
        this.send('levelUp', `${charName} ist jetzt Level ${newLevel}!`, '🎉 Herzlichen Glückwunsch!');
    },
    
    // Map change
    mapChanged(mapName) {
        this.send('map', 'Neue Karte', mapName);
    },
    
    // Whiteboard activity
    whiteboardActivity(gmName, action = 'zeichnet') {
        this.send('whiteboard', 'Whiteboard', `${gmName} ${action}...`);
    },
    
    // Cleanup on page unload
    destroy() {
        if (this.unsubscribe) {
            const cleanCode = this.roomCode?.replace(/-/g, '').toUpperCase();
            if (cleanCode) {
                firebase.database().ref(`rooms/${cleanCode}/toasts`).off('child_added', this.unsubscribe);
            }
        }
        this.initialized = false;
    }
};

// Auto-initialize when Firebase is ready
document.addEventListener('DOMContentLoaded', () => {
    const initToast = () => {
        if (typeof firebase !== 'undefined' && firebase.database && firebase.auth) {
            // Wait for auth state
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    RIFTToast.init();
                }
            });
        } else {
            setTimeout(initToast, 200);
        }
    };
    initToast();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    RIFTToast.destroy();
});

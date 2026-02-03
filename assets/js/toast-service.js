/**
 * RIFT Global Toast Service
 * Real-time notifications visible to all players in a room
 */

window.RIFTToast = {
    TOAST_DURATION: 5000,
    MAX_TOASTS: 5,
    container: null,
    processedIds: new Set(),
    
    // Toast types
    types: {
        dice: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`, color: '#8b5cf6' },
        diceRolling: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`, color: '#f59e0b' },
        diceSuccess: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`, color: '#22c55e' },
        diceFail: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.47 6.62L12.57 2.18C12.41 2.06 12.21 2 12 2S11.59 2.06 11.43 2.18L3.53 6.62C3.21 6.79 3 7.12 3 7.5V16.5C3 16.88 3.21 17.21 3.53 17.38L11.43 21.82C11.59 21.94 11.79 22 12 22S12.41 21.94 12.57 21.82L20.47 17.38C20.79 17.21 21 16.88 21 16.5V7.5C21 7.12 20.79 6.79 20.47 6.62Z"/></svg>`, color: '#ef4444' },
        mention: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C13.5 22 14.92 21.68 16.22 21.12L17.07 22.76C15.53 23.55 13.82 24 12 24C5.37 24 0 18.63 0 12C0 5.37 5.37 0 12 0C18.63 0 24 5.37 24 12V13.5C24 15.43 22.43 17 20.5 17C19.24 17 18.13 16.33 17.5 15.34C16.5 16.35 15.09 17 13.5 17C10.46 17 8 14.54 8 11.5C8 8.46 10.46 6 13.5 6C14.78 6 15.95 6.45 16.88 7.18L17.5 6.5H19V13.5C19 14.33 19.67 15 20.5 15C21.33 15 22 14.33 22 13.5V12C22 6.48 17.52 2 12 2Z"/></svg>`, color: '#f59e0b' },
        whisper: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C8.14 1 5 4.14 5 8C5 11.86 12 23 12 23S19 11.86 19 8C19 4.14 15.86 1 12 1Z"/></svg>`, color: '#ec4899' },
        join: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>`, color: '#22c55e' },
        leave: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5V11H19V13Z"/></svg>`, color: '#6b7280' },
        sessionStart: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5V19L19 12L8 5Z"/></svg>`, color: '#22c55e' },
        sessionEnd: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"/></svg>`, color: '#ef4444' },
        hpGain: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/></svg>`, color: '#22c55e' },
        hpLoss: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"/></svg>`, color: '#ef4444' },
        levelUp: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`, color: '#f59e0b' },
        map: { icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/></svg>`, color: '#8b5cf6' }
    },
    
    // Fokus element name to icon filename mapping
    fokusIconMap: {
        'feuer': 'fire', 'fire': 'fire',
        'wasser': 'water', 'water': 'water',
        'erde': 'earth', 'earth': 'earth',
        'blitz': 'lightning', 'lightning': 'lightning',
        'gift': 'poison', 'poison': 'poison',
        'illusion': 'illusion',
        'schatten': 'shadow', 'shadow': 'shadow',
        'schall': 'sound', 'sound': 'sound',
        'zeit': 'time', 'time': 'time',
        'raum': 'room', 'room': 'room',
        'wind': 'wind', 'luft': 'wind'
    },
    
    // Skill icon (Tabler book-filled)
    skillIcon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V2a.5.5 0 0 1 .5-.5zM5 4h.5a.5.5 0 0 0 0-1H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-.5a.5.5 0 0 0 0 1h.5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M6 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h5V7H6zm7 0v10h5a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5z"/></svg>`,
    
    // D20 icon for Zweite Chance
    d20Icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.27 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/></svg>`,
    
    getRoom() {
        const code = localStorage.getItem('rift_current_room');
        return code ? code.replace(/-/g, '').toUpperCase() : null;
    },
    
    getUserId() {
        return firebase?.auth?.()?.currentUser?.uid || null;
    },
    
    getUserName() {
        const stored = JSON.parse(localStorage.getItem('rift_user') || '{}');
        return stored.name || stored.displayName || 'Spieler';
    },
    
    createContainer() {
        if (this.container) return;
        
        const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        const isChat = page === 'chat';
        const bottom = isChat ? 100 : 90; // Above dock (72px + padding)
        const bottomMobile = isChat ? 80 : 80;
        
        const el = document.createElement('div');
        el.id = 'rift-toast-container';
        el.innerHTML = `<style>
            #rift-toast-container { position: fixed; bottom: ${bottom}px; right: 100px; display: flex; flex-direction: column-reverse; gap: 10px; z-index: 9999; pointer-events: none; max-width: 340px; }
            .rift-toast { display: flex; align-items: center; gap: 14px; padding: 16px 20px; min-height: 124px; background: rgba(17,17,17,0.95); backdrop-filter: blur(12px); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 32px rgba(0,0,0,0.4); animation: toastIn 0.3s ease; pointer-events: auto; cursor: pointer; transition: transform 0.2s; box-sizing: border-box; }
            .rift-toast:hover { transform: translateX(-4px); }
            .rift-toast.hiding { animation: toastOut 0.3s ease forwards; }
            @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
            .rift-toast__icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .rift-toast__icon svg { width: 24px; height: 24px; }
            .rift-toast__content { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
            .rift-toast__title { font-size: 15px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .rift-toast__message { font-size: 13px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .rift-toast__result { font-size: 28px; font-weight: 700; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; padding-left: 12px; }
            .rift-toast__result--success { color: #22c55e; }
            .rift-toast__result--fail { color: #ef4444; }
            .rift-toast__result--neutral { color: #8b5cf6; }
            @media (max-width: 768px) {
                #rift-toast-container { bottom: ${bottomMobile}px; right: 80px; max-width: calc(100vw - 100px); }
                .rift-toast { min-height: 106px; padding: 14px 16px; border-radius: 14px; }
                .rift-toast__icon { width: 40px; height: 40px; }
                .rift-toast__icon svg { width: 20px; height: 20px; }
                .rift-toast__result { font-size: 22px; }
            }
        </style>`;
        document.body.appendChild(el);
        this.container = el;
    },
    
    show(toast) {
        this.createContainer();
        
        // If this is a dice result, dismiss any rolling toasts first
        if (['dice', 'diceSuccess', 'diceFail'].includes(toast.type)) {
            const rollingToasts = this.container.querySelectorAll('.rift-toast[data-type="diceRolling"]');
            rollingToasts.forEach(t => this.dismiss(t));
        }
        
        const typeConfig = this.types[toast.type] || this.types.dice;
        const el = document.createElement('div');
        el.className = 'rift-toast';
        el.dataset.type = toast.type; // Store type for later reference
        
        // Determine icon based on rollType
        let iconHtml = '';
        let iconColor = typeConfig.color;
        
        if (toast.rollType === 'fokus' && toast.element) {
            // Fokus: Use element icon (PNG)
            const elementKey = toast.element.toLowerCase();
            const iconFile = this.fokusIconMap[elementKey] || 'fire';
            iconHtml = `<img src="assets/icons/icon_focus_${iconFile}.png" style="width:32px;height:32px;" alt="${toast.element}">`;
            iconColor = '#8b5cf6'; // Purple for magic
        } else if (toast.rollType === 'zweitechance') {
            // Zweite Chance: D20 icon
            iconHtml = this.d20Icon;
            iconColor = '#f59e0b'; // Orange
        } else if (toast.rollType === 'skill') {
            // Fähigkeit: Book icon
            iconHtml = this.skillIcon;
            iconColor = '#3b82f6'; // Blue
        } else {
            iconHtml = typeConfig.icon;
        }
        
        // Override color for success/fail states
        if (toast.type === 'diceSuccess') iconColor = '#22c55e';
        if (toast.type === 'diceFail') iconColor = '#ef4444';
        
        let resultHtml = '';
        if (toast.result !== undefined) {
            const cls = toast.isSuccess === true ? 'success' : toast.isSuccess === false ? 'fail' : 'neutral';
            resultHtml = `<div class="rift-toast__result rift-toast__result--${cls}">${toast.result}</div>`;
        }
        
        el.innerHTML = `
            <div class="rift-toast__icon" style="background:${iconColor}22;color:${iconColor};">${iconHtml}</div>
            <div class="rift-toast__content">
                <div class="rift-toast__title">${this.esc(toast.title || '')}</div>
                ${toast.message ? `<div class="rift-toast__message">${this.esc(toast.message)}</div>` : ''}
            </div>
            ${resultHtml}
        `;
        
        el.onclick = () => this.dismiss(el);
        this.container.appendChild(el);
        
        // Limit toasts
        const toasts = this.container.querySelectorAll('.rift-toast:not(.hiding)');
        if (toasts.length > this.MAX_TOASTS) this.dismiss(toasts[0]);
        
        // Shorter duration for rolling toasts (will be replaced by result anyway)
        const duration = toast.type === 'diceRolling' ? 3000 : this.TOAST_DURATION;
        setTimeout(() => this.dismiss(el), duration);
    },
    
    dismiss(el) {
        if (!el || el.classList.contains('hiding')) return;
        el.classList.add('hiding');
        setTimeout(() => el.remove(), 300);
    },
    
    esc(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    
    // ========== SEND ==========
    async send(type, title, message = '', extra = {}) {
        const room = this.getRoom();
        if (!room) { console.log('[Toast] No room'); return; }
        
        if (typeof firebase === 'undefined' || !firebase.database) {
            console.log('[Toast] Firebase not ready');
            return;
        }
        
        const ref = firebase.database().ref(`rooms/${room}/toasts`);
        try {
            await ref.push({
                type,
                title,
                message,
                timestamp: Date.now(),
                oderId: this.getUserId(),
                ...extra
            });
            console.log('[Toast] Sent:', type, title);
        } catch (e) {
            console.error('[Toast] Send failed:', e);
        }
    },
    
    // ========== SUBSCRIBE ==========
    subscribe() {
        const room = this.getRoom();
        if (!room) return;
        
        const ref = firebase.database().ref(`rooms/${room}/toasts`);
        const userId = this.getUserId();
        const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        
        ref.orderByChild('timestamp').limitToLast(5).on('child_added', (snap) => {
            const toast = snap.val();
            const id = snap.key;
            
            // Skip old toasts (> 8 seconds)
            if (toast.timestamp && Date.now() - toast.timestamp > 8000) return;
            
            // Skip if processed
            if (this.processedIds.has(id)) return;
            this.processedIds.add(id);
            
            // Skip own toasts for certain types
            if (toast.oderId === userId) {
                if (['dice', 'diceSuccess', 'diceFail', 'diceRolling', 'hpGain', 'hpLoss', 'levelUp'].includes(toast.type)) return;
            }
            
            // Skip page-specific toasts
            if (['dice', 'diceSuccess', 'diceFail', 'diceRolling'].includes(toast.type) && page === 'dice') return;
            if (['hpGain', 'hpLoss', 'levelUp'].includes(toast.type) && page.startsWith('sheet-')) return;
            if (['mention', 'whisper'].includes(toast.type) && page === 'chat') return;
            
            // Skip whisper/mention for other users
            if (['whisper', 'mention'].includes(toast.type) && toast.targetUserId && toast.targetUserId !== userId) return;
            
            this.show(toast);
        });
        
        console.log('[Toast] Subscribed to:', room);
    },
    
    // ========== PRESENCE ==========
    subscribePresence() {
        const room = this.getRoom();
        if (!room) return;
        
        const ref = firebase.database().ref(`rooms/${room}/players`);
        const userId = this.getUserId();
        let known = {};
        
        ref.on('value', (snap) => {
            const players = snap.val() || {};
            Object.entries(players).forEach(([id, data]) => {
                if (id === userId) { known[id] = data.online; return; }
                
                const was = known[id];
                const is = data.online === true;
                const name = data.name || data.displayName || 'Spieler';
                
                if (was === false && is) this.show({ type: 'join', title: `${name} ist beigetreten` });
                if (was === true && !is) this.show({ type: 'leave', title: `${name} hat verlassen` });
                
                known[id] = is;
            });
        });
    },
    
    // ========== INIT ==========
    init() {
        if (typeof firebase === 'undefined' || !firebase.database) {
            setTimeout(() => this.init(), 500);
            return;
        }
        
        const room = this.getRoom();
        if (!room) {
            console.log('[Toast] No room, skipping init');
            return;
        }
        
        this.createContainer();
        this.subscribe();
        this.subscribePresence();
        console.log('[Toast] Initialized');
    },
    
    // ========== CONVENIENCE ==========
    diceRolling(name, rollLabel = '', rollType = null, element = null) {
        const message = rollLabel ? `würfelt auf ${rollLabel}...` : 'würfelt...';
        this.send('diceRolling', name, message, { rollType, element });
    },
    
    diceRoll(name, result, formula = '', isSuccess = null, rollType = null, element = null) {
        const type = isSuccess === true ? 'diceSuccess' : isSuccess === false ? 'diceFail' : 'dice';
        this.send(type, name, formula, { result: String(result), isSuccess, rollType, element });
    },
    
    chatMention(sender, preview, targetUserId) {
        this.send('mention', sender, preview.substring(0, 60), { targetUserId });
    },
    
    chatWhisper(sender, preview, targetUserId) {
        this.send('whisper', `Flüstern von ${sender}`, preview.substring(0, 60), { targetUserId });
    },
    
    sessionStarted() {
        this.send('sessionStart', 'Session gestartet!', 'Viel Spaß beim Spielen');
    },
    
    sessionEnded() {
        this.send('sessionEnd', 'Session beendet', 'Bis zum nächsten Mal!');
    },
    
    hpChange(charName, amount) {
        const type = amount > 0 ? 'hpGain' : 'hpLoss';
        const sign = amount > 0 ? '+' : '';
        this.send(type, charName, `${sign}${amount} HP`, { result: `${sign}${amount}`, isSuccess: amount > 0 });
    },
    
    levelUp(charName, level) {
        this.send('levelUp', `${charName} ist jetzt Level ${level}!`, '🎉');
    },
    
    mapChanged(mapName) {
        this.send('map', 'Neue Karte', mapName);
    }
};

// Auto-init - works even if loaded after DOMContentLoaded
(function() {
    function tryInit() {
        setTimeout(() => RIFTToast.init(), 500);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        // DOM already loaded, init immediately
        tryInit();
    }
})();

// ========================================
// RIFT BROADCAST SYSTEM
// Forciertes Popup für GM-Nachrichten
// ========================================

(function() {
    'use strict';
    
    const BroadcastListener = {
        lastBroadcastId: null,
        unsubscribe: null,
        
        init() {
            // Get room code from URL or localStorage
            const urlParams = new URLSearchParams(window.location.search);
            let roomCode = urlParams.get('room') || localStorage.getItem('rift_current_room');
            
            // If we got room from URL, ALWAYS save it to localStorage
            if (urlParams.get('room')) {
                localStorage.setItem('rift_current_room', urlParams.get('room'));
                console.log('[Broadcast] Saved room to localStorage:', urlParams.get('room'));
            }
            
            if (!roomCode) {
                console.log('[Broadcast] No room code found, broadcasts disabled');
                return;
            }
            
            console.log('[Broadcast] Initializing with room:', roomCode);
            
            // Restore ambient effect from previous session
            this.restoreAmbientEffect();
            
            // Restore persisted fullscreen broadcasts (prevent skip by refresh)
            this.restorePersistedBroadcasts();
            
            // Wait for Firebase
            this.waitForFirebase().then(() => {
                this.subscribe(roomCode);
            });
        },
        
        // ============ BROADCAST PERSISTENCE ============
        // Persist fullscreen broadcasts to localStorage
        persistBroadcast(type, data) {
            const key = `rift_active_broadcast_${type}`;
            const entry = {
                type,
                data,
                savedAt: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(entry));
            console.log('[Broadcast] Persisted:', type);
        },
        
        // Clear a persisted broadcast
        clearPersistedBroadcast(type) {
            localStorage.removeItem(`rift_active_broadcast_${type}`);
            console.log('[Broadcast] Cleared persisted:', type);
        },
        
        // Close fullscreen broadcast and clear persistence
        closeFullscreen(type, element) {
            this.clearPersistedBroadcast(type);
            const overlay = element.closest('.broadcast-overlay');
            if (overlay) {
                overlay.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => overlay.remove(), 300);
            }
        },
        
        // Restore any persisted broadcasts on page load
        restorePersistedBroadcasts() {
            const persistedTypes = ['boss', 'combat', 'death', 'levelup', 'loot', 'location', 'break', 'coinflip'];
            
            persistedTypes.forEach(type => {
                const key = `rift_active_broadcast_${type}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const entry = JSON.parse(stored);
                        // Check if not too old (max 1 hour for break, 5 min for others)
                        const maxAge = type === 'break' ? 3600000 : 300000;
                        
                        // Special check for break - must have remaining time
                        if (type === 'break' && entry.data.endTime && entry.data.endTime < Date.now()) {
                            localStorage.removeItem(key);
                            console.log('[Broadcast] Break expired, not restoring');
                            return;
                        }
                        
                        if (Date.now() - entry.savedAt < maxAge) {
                            console.log('[Broadcast] Restoring persisted:', type, entry.data);
                            // Re-show the broadcast directly (bypass targeting check)
                            setTimeout(() => {
                                const broadcast = { ...entry.data, _restored: true };
                                // Call the specific show function directly
                                switch(type) {
                                    case 'boss': this.showBossIntro(broadcast); break;
                                    case 'combat': this.showCombatStart(broadcast); break;
                                    case 'death': this.showDeathScreen(broadcast); break;
                                    case 'levelup': this.showLevelUp(broadcast); break;
                                    case 'loot': this.showLootDrop(broadcast); break;
                                    case 'location': this.showLocationBanner(broadcast); break;
                                    case 'break': this.showBreakTimer(broadcast); break;
                                    case 'coinflip': this.showCoinFlip(broadcast); break;
                                }
                            }, 300);
                        } else {
                            // Too old, clear it
                            localStorage.removeItem(key);
                            console.log('[Broadcast] Cleared expired:', type);
                        }
                    } catch (e) {
                        localStorage.removeItem(key);
                        console.error('[Broadcast] Error restoring:', type, e);
                    }
                }
            });
        },
        
        waitForFirebase(timeout = 10000) {
            return new Promise((resolve) => {
                const start = Date.now();
                const check = () => {
                    const db = window.RIFT?.firebase?.getFirestore?.() || window.firebase?.firestore?.();
                    if (db) {
                        resolve(db);
                    } else if (Date.now() - start > timeout) {
                        console.warn('[Broadcast] Firebase timeout');
                        resolve(null);
                    } else {
                        setTimeout(check, 200);
                    }
                };
                check();
            });
        },
        
        subscribe(roomCode) {
            const db = window.RIFT?.firebase?.getFirestore?.() || window.firebase?.firestore?.();
            if (!db) return;
            
            const normalizedCode = roomCode.replace('-', '').toUpperCase();
            
            // Load last seen broadcast ID from localStorage
            this.lastBroadcastId = localStorage.getItem('rift_last_broadcast_id');
            
            // Subscribe to room document
            this.unsubscribe = db.collection('rooms').doc(normalizedCode)
                .onSnapshot((doc) => {
                    if (!doc.exists) return;
                    
                    const data = doc.data();
                    const broadcast = data.broadcast;
                    const poll = data.poll;
                    
                    // Check if current user is GM (GMs don't see their own broadcasts/polls)
                    const isGM = this.checkIfGM(data);
                    
                    // Handle Broadcast (GM doesn't see own broadcasts)
                    if (broadcast && broadcast.id && String(broadcast.id) !== this.lastBroadcastId) {
                        this.lastBroadcastId = String(broadcast.id);
                        localStorage.setItem('rift_last_broadcast_id', String(broadcast.id));
                        
                        if (!isGM) {
                            this.showBroadcast(broadcast);
                        } else {
                            console.log('[Broadcast] Skipping broadcast for GM');
                        }
                    }
                    
                    // Handle Poll Results (when GM resolves poll)
                    if (poll && poll.resolved === true && poll.active === false && poll.results) {
                        // resolvedAt is now a simple number from Date.now()
                        const resolveId = poll.resolvedAt || poll.timestamp?.seconds || 'resolved';
                        const storageKey = 'rift_poll_resolved_' + normalizedCode;
                        const lastResolveId = localStorage.getItem(storageKey);
                        
                        console.log('[Broadcast] Poll resolved detected:', { resolveId, lastResolveId, isGM, hasResults: !!poll.results });
                        
                        if (!isGM && String(resolveId) !== String(lastResolveId)) {
                            console.log('[Broadcast] Showing poll results to player');
                            localStorage.setItem(storageKey, String(resolveId));
                            
                            // Small delay to ensure DOM is ready
                            setTimeout(() => {
                                const alreadyShowing = document.querySelector('.poll-result-overlay');
                                if (!alreadyShowing) {
                                    this.showPollResults(poll);
                                }
                            }, 100);
                        }
                    }
                    
                    // Handle Active Poll (GM doesn't see poll popup, they have their own UI)
                    if (poll && poll.active) {
                        console.log('[Broadcast] Poll detected:', poll);
                        const pollId = poll.timestamp?.seconds || poll.timestamp || Date.now();
                        const hasVoted = localStorage.getItem('rift_poll_voted_' + pollId);
                        const alreadyShowing = document.querySelector('.poll-overlay');
                        
                        console.log('[Broadcast] Poll check - pollId:', pollId, 'hasVoted:', hasVoted, 'alreadyShowing:', !!alreadyShowing, 'isGM:', isGM);
                        
                        if (!isGM && !hasVoted && !alreadyShowing) {
                            console.log('[Broadcast] Showing poll to user');
                            this.showPoll(poll, pollId, normalizedCode);
                        }
                    }
                }, (error) => {
                    console.error('[Broadcast] Subscribe error:', error);
                });
        },
        
        checkIfGM(roomData) {
            const uid = window.firebase?.auth?.()?.currentUser?.uid;
            console.log('[Broadcast] Checking GM status - uid:', uid, 'gmId:', roomData.gmId);
            
            if (!uid) {
                console.log('[Broadcast] No uid, not GM');
                return false;
            }
            
            // Only check Firebase gmId - localStorage can be stale
            const isGM = roomData.gmId === uid;
            console.log('[Broadcast] Is GM:', isGM);
            return isGM;
        },
        
        // Check if current user is targeted
        isTargeted(broadcast) {
            if (!broadcast.targets) return true; // No targets = all players
            const uid = window.firebase?.auth?.()?.currentUser?.uid;
            return broadcast.targets.includes(uid);
        },
        
        showBroadcast(broadcast) {
            // Check if this broadcast is targeted at current user
            if (!this.isTargeted(broadcast)) {
                console.log('[Broadcast] Not targeted at this user');
                return;
            }
            
            // Route to appropriate handler based on type
            const type = broadcast.type || 'info';
            
            switch(type) {
                case 'spotlight':
                    this.showSpotlight(broadcast);
                    break;
                case 'secret':
                    this.showSecretMessage(broadcast);
                    break;
                case 'diceRequest':
                    this.showDiceRequest(broadcast);
                    break;
                case 'handout':
                    this.showHandout(broadcast);
                    break;
                case 'scene':
                    this.showSceneTransition(broadcast);
                    break;
                case 'reveal':
                    this.showReveal(broadcast);
                    break;
                case 'combat':
                    this.showCombatStart(broadcast);
                    break;
                case 'ambient':
                    this.showAmbientChange(broadcast);
                    break;
                case 'reaction':
                    this.showReaction(broadcast);
                    break;
                case 'toast':
                    this.showToast(broadcast);
                    break;
                case 'timer':
                    this.showTimer(broadcast);
                    break;
                case 'statusRequest':
                    this.showStatusRequest(broadcast);
                    break;
                case 'location':
                    this.showLocationBanner(broadcast);
                    break;
                case 'boss':
                    this.showBossIntro(broadcast);
                    break;
                case 'loot':
                    this.showLootDrop(broadcast);
                    break;
                case 'levelup':
                    this.showLevelUp(broadcast);
                    break;
                case 'death':
                    this.showDeathScreen(broadcast);
                    break;
                case 'coinflip':
                    this.showCoinFlip(broadcast);
                    break;
                case 'break':
                    this.showBreakTimer(broadcast);
                    break;
                case 'endbreak':
                    this.endBreak();
                    break;
                case 'cancelTimer':
                    this.cancelTimer();
                    break;
                case 'sound':
                    this.playGlobalSound(broadcast);
                    break;
                case 'timeofday':
                    this.showTimeOfDay(broadcast);
                    break;
                case 'kick':
                    this.handleKick(broadcast);
                    break;
                case 'ban':
                    this.handleBan(broadcast);
                    break;
                case 'pause':
                    this.handlePause(broadcast);
                    break;
                case 'unpause':
                    this.handleUnpause(broadcast);
                    break;
                case 'customSound':
                    this.playCustomSound(broadcast);
                    break;
                case 'stopSound':
                    this.stopCustomSound();
                    break;
                default:
                    this.showStandardBroadcast(broadcast);
            }
        },
        
        // Standard broadcast with types
        showStandardBroadcast(broadcast) {
            const typeConfig = {
                info: { icon: '💡', color: '#3b82f6', label: 'Info' },
                warning: { icon: '⚠️', color: '#f59e0b', label: 'Warnung' },
                danger: { icon: '🚨', color: '#ef4444', label: 'Gefahr' },
                success: { icon: '✅', color: '#22c55e', label: 'Erfolg' },
                epic: { icon: '⚔️', color: '#8b5cf6', label: 'Episch' },
                mystery: { icon: '🔮', color: '#6366f1', label: 'Mysteriös' }
            };
            
            const config = typeConfig[broadcast.type] || typeConfig.info;
            
            // Play sound
            this.playBroadcastSound(broadcast.sound);
            
            // Build image HTML
            const imageHtml = broadcast.image ? `<img src="${broadcast.image}" alt="" style="width:100%; border-radius:10px; margin-bottom:16px;">` : '';
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal" style="border-color: ${config.color}40; box-shadow: 0 0 60px ${config.color}30;">
                    <div class="broadcast-modal__header" style="justify-content: center;">
                        <div class="broadcast-modal__icon" style="background: ${config.color}20;">
                            <span style="font-size: 24px;">${config.icon}</span>
                        </div>
                        <span class="broadcast-modal__badge" style="color: ${config.color};">${config.label}</span>
                    </div>
                    <div class="broadcast-modal__content" style="text-align: center;">
                        ${imageHtml}
                        <p class="broadcast-modal__message" style="text-align: center;">${this.escapeHtml(broadcast.message || '')}</p>
                    </div>
                    <button class="broadcast-modal__btn" style="background: ${config.color};" onclick="BroadcastListener.closeBroadcast(this)">
                        Verstanden
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('broadcast-overlay--visible'));
        },
        
        // Spotlight
        showSpotlight(broadcast) {
            const uid = window.firebase?.auth?.()?.currentUser?.uid;
            const isTarget = broadcast.targetId === uid;
            
            this.playBroadcastSound('fanfare');
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay spotlight-overlay';
            
            if (isTarget) {
                overlay.innerHTML = `
                    <div class="spotlight-modal spotlight-modal--target">
                        <div class="spotlight-content">
                            <div class="spotlight-icon">🌟</div>
                            <h2 class="spotlight-title">${this.escapeHtml(broadcast.message || 'Du bist dran!')}</h2>
                            <p class="spotlight-subtitle">Alle Augen sind auf dich gerichtet!</p>
                        </div>
                        <button class="broadcast-modal__btn" style="margin-top: 24px;" onclick="BroadcastListener.closeBroadcast(this)">
                            Los geht's!
                        </button>
                    </div>
                `;
            } else {
                overlay.innerHTML = `
                    <div class="spotlight-modal spotlight-modal--other">
                        <div class="spotlight-content">
                            <div class="spotlight-icon">👀</div>
                            <h2 class="spotlight-title">${this.escapeHtml(broadcast.targetName)} ist dran!</h2>
                            <p class="spotlight-subtitle">${this.escapeHtml(broadcast.message || '')}</p>
                        </div>
                        <button class="broadcast-modal__btn broadcast-modal__btn--secondary" style="margin-top: 24px;" onclick="BroadcastListener.closeBroadcast(this)">
                            OK
                        </button>
                    </div>
                `;
            }
            
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('broadcast-overlay--visible'));
        },
        
        // Secret message
        showSecretMessage(broadcast) {
            // NO sound for secret messages - always silent
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal secret-modal">
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon" style="background: rgba(99,102,241,0.2);">
                            <span style="font-size: 24px;">🤫</span>
                        </div>
                        <span class="broadcast-modal__badge" style="color: #6366f1;">Geheime Nachricht</span>
                    </div>
                    <div class="broadcast-modal__content">
                        <p class="broadcast-modal__message" style="font-style: italic;">${this.escapeHtml(broadcast.message)}</p>
                        <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 12px;">Nur du kannst diese Nachricht sehen.</p>
                    </div>
                    <button class="broadcast-modal__btn" style="background: #6366f1;" onclick="BroadcastListener.closeBroadcast(this)">
                        Verstanden
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('broadcast-overlay--visible'));
        },
        
        // Dice request
        showDiceRequest(broadcast) {
            this.playBroadcastSound('notification');
            
            // Format dice type for display
            const diceLabels = {
                'd4': 'W4', 'd6': 'W6', 'd10': 'W10', 'd12': 'W12',
                'd20': 'W20', 'd100': 'W100', 'd20+mod': 'W20 + Mod', 'custom': 'Frei'
            };
            const diceLabel = diceLabels[broadcast.diceType] || broadcast.diceType?.toUpperCase() || 'W20';
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal dice-modal">
                    <div class="broadcast-modal__header" style="justify-content: center;">
                        <div class="broadcast-modal__icon" style="background: rgba(245,158,11,0.2);">
                            <span style="font-size: 24px;">🎲</span>
                        </div>
                        <span class="broadcast-modal__badge" style="color: #f59e0b;">Würfelanforderung</span>
                    </div>
                    <div class="broadcast-modal__content" style="text-align: center;">
                        <p class="broadcast-modal__message" style="font-size: 20px; font-weight: 600;">${this.escapeHtml(broadcast.description || 'Würfelprobe')}</p>
                        <p style="color: #f59e0b; font-size: 28px; font-weight: 700; margin-top: 16px;">${diceLabel}</p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="broadcast-modal__btn" style="flex: 1; background: #f59e0b;" onclick="BroadcastListener.openDiceRoller(); BroadcastListener.closeBroadcast(this);">
                            🎲 Zum Würfeln
                        </button>
                        <button class="broadcast-modal__btn broadcast-modal__btn--secondary" style="flex: 1;" onclick="BroadcastListener.closeBroadcast(this)">
                            Später
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('broadcast-overlay--visible'));
        },
        
        openDiceRoller() {
            window.location.href = 'dice.html';
        },
        
        // Handout - full screen image display
        showHandout(broadcast) {
            if (broadcast.sound && broadcast.sound !== 'none') {
                this.playBroadcastSound(broadcast.sound);
            }
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay handout-overlay';
            overlay.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 20px; box-sizing: border-box;">
                    <img src="${broadcast.image}" alt="Handout" style="
                        max-width: 90vw; max-height: 75vh; object-fit: contain;
                        border-radius: 12px; box-shadow: 0 20px 80px rgba(0,0,0,0.8);
                        cursor: zoom-in;
                    " onclick="event.stopPropagation(); BroadcastListener.zoomImage(this.src)">
                    <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 12px;">Klicken zum Vergrößern</p>
                    <button class="handout-close-btn" onclick="this.closest('.broadcast-overlay').classList.remove('broadcast-overlay--visible'); setTimeout(() => this.closest('.broadcast-overlay').remove(), 300);" style="
                        margin-top: 20px; padding: 12px 40px;
                        background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
                        border-radius: 8px; color: white; font-size: 14px; font-weight: 500;
                        cursor: pointer; transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">Okay</button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('broadcast-overlay--visible'));
        },
        
        zoomImage(src) {
            const zoom = document.createElement('div');
            zoom.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.98);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
            zoom.innerHTML = `<img src="${src}" style="max-width:98vw;max-height:98vh;object-fit:contain;">`;
            zoom.onclick = () => zoom.remove();
            document.body.appendChild(zoom);
        },
        
        // Scene transition
        showSceneTransition(broadcast) {
            const overlay = document.createElement('div');
            overlay.className = 'cinematic-overlay scene-transition';
            
            // Apply different animation styles
            const style = broadcast.style || 'fade';
            let textAnimation = 'sceneTextIn 2s ease';
            let overlayIn = 'fadeIn 1s ease';
            let overlayOut = 'fadeOut 1s ease forwards';
            let extraStyle = '';
            let particlesHtml = '';
            let bgStyle = 'background: #000;';
            
            if (style === 'slide') {
                overlayIn = 'sceneSlideIn 0.8s ease';
                overlayOut = 'sceneSlideOut 0.8s ease forwards';
                textAnimation = 'sceneTextSlide 1.5s ease';
            } else if (style === 'zoom') {
                overlayIn = 'sceneZoomIn 0.6s ease';
                overlayOut = 'sceneZoomOut 0.6s ease forwards';
                textAnimation = 'sceneTextZoom 2s ease';
            } else if (style === 'blur') {
                overlayIn = 'sceneBlurIn 1.2s ease';
                overlayOut = 'sceneBlurOut 1.2s ease forwards';
                textAnimation = 'sceneTextBlur 2s ease';
                extraStyle = 'backdrop-filter: blur(20px);';
            } else if (style === 'glitch') {
                overlayIn = 'sceneGlitchIn 0.5s steps(10)';
                overlayOut = 'sceneGlitchOut 0.5s steps(10) forwards';
                textAnimation = 'sceneTextGlitch 2s ease';
            } else if (style === 'shatter') {
                // Shatter effect - glass breaking
                overlayIn = 'sceneShatterIn 0.8s ease';
                overlayOut = 'sceneShatterOut 1s ease forwards';
                textAnimation = 'sceneTextShatter 2s ease';
                bgStyle = 'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);';
                // Create shatter glass pieces
                for (let i = 0; i < 20; i++) {
                    const x = Math.random() * 100;
                    const y = Math.random() * 100;
                    const size = 20 + Math.random() * 60;
                    const delay = Math.random() * 0.5;
                    const rotation = Math.random() * 360;
                    particlesHtml += `<div style="
                        position:absolute; left:${x}%; top:${y}%;
                        width:${size}px; height:${size}px;
                        background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(200,200,255,0.05));
                        border: 1px solid rgba(255,255,255,0.2);
                        transform: rotate(${rotation}deg);
                        animation: shatterPiece 2s ${delay}s ease-out forwards;
                        clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                    "></div>`;
                }
            } else if (style === 'vortex') {
                // Vortex/spiral effect
                overlayIn = 'sceneVortexIn 1s ease';
                overlayOut = 'sceneVortexOut 1s ease forwards';
                textAnimation = 'sceneTextVortex 2s ease';
                bgStyle = 'background: radial-gradient(ellipse at center, #0f0c29 0%, #302b63 50%, #24243e 100%);';
                // Spiral particles
                for (let i = 0; i < 30; i++) {
                    const angle = (i / 30) * 360;
                    const delay = i * 0.05;
                    particlesHtml += `<div style="
                        position:absolute; left:50%; top:50%;
                        width:8px; height:8px; border-radius:50%;
                        background: ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'};
                        box-shadow: 0 0 10px currentColor;
                        animation: vortexSpin 3s ${delay}s linear infinite;
                        transform-origin: ${100 + i * 5}px 0;
                    "></div>`;
                }
            } else if (style === 'flames') {
                // Flames/fire effect
                overlayIn = 'sceneFlamesIn 0.8s ease';
                overlayOut = 'sceneFlamesOut 1s ease forwards';
                textAnimation = 'sceneTextFlames 2s ease';
                bgStyle = 'background: linear-gradient(to top, #1a0000 0%, #000 60%);';
                // Fire particles from bottom
                for (let i = 0; i < 40; i++) {
                    const x = Math.random() * 100;
                    const size = 10 + Math.random() * 30;
                    const delay = Math.random() * 2;
                    const duration = 1 + Math.random() * 2;
                    const color = ['#ff4500', '#ff6600', '#ff8c00', '#ffa500'][Math.floor(Math.random() * 4)];
                    particlesHtml += `<div style="
                        position:absolute; left:${x}%; bottom:-20px;
                        width:${size}px; height:${size * 1.5}px;
                        background: ${color};
                        border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
                        filter: blur(2px);
                        animation: flameRise ${duration}s ${delay}s ease-out infinite;
                        opacity: 0.8;
                    "></div>`;
                }
            } else if (style === 'lightning') {
                // Lightning storm effect
                overlayIn = 'sceneLightningIn 0.3s ease';
                overlayOut = 'sceneLightningOut 0.5s ease forwards';
                textAnimation = 'sceneTextLightning 2s ease';
                bgStyle = 'background: linear-gradient(to bottom, #0c0c1e 0%, #1a1a3e 100%);';
                // Create lightning bolts
                for (let i = 0; i < 5; i++) {
                    const x = 10 + Math.random() * 80;
                    const delay = Math.random() * 1.5;
                    particlesHtml += `<div style="
                        position:absolute; left:${x}%; top:0;
                        width:4px; height:100%;
                        background: linear-gradient(to bottom, #fff 0%, #00d4ff 20%, transparent 100%);
                        filter: blur(1px);
                        animation: lightningBolt 0.2s ${delay}s ease-out;
                        opacity: 0;
                        clip-path: polygon(
                            0% 0%, 100% 0%, 
                            70% 20%, 100% 20%, 
                            40% 45%, 80% 45%, 
                            30% 70%, 60% 70%, 
                            50% 100%, 40% 100%,
                            50% 70%, 20% 70%,
                            30% 45%, 0% 45%,
                            40% 20%, 0% 20%
                        );
                    "></div>`;
                }
                // Add flash effect
                particlesHtml += `<div style="
                    position:absolute; inset:0;
                    background: white;
                    animation: lightningFlash 3s ease infinite;
                    pointer-events: none;
                "></div>`;
            } else if (style === 'portal') {
                // Portal/dimensional rift effect
                overlayIn = 'scenePortalIn 1.2s ease';
                overlayOut = 'scenePortalOut 1s ease forwards';
                textAnimation = 'sceneTextPortal 2s ease';
                bgStyle = 'background: radial-gradient(ellipse at center, #1a0a2e 0%, #0a0a1a 100%);';
                // Portal rings
                for (let i = 0; i < 5; i++) {
                    const size = 100 + i * 80;
                    const delay = i * 0.2;
                    particlesHtml += `<div style="
                        position:absolute; left:50%; top:50%;
                        width:${size}px; height:${size}px;
                        border: 3px solid ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'};
                        border-radius:50%;
                        transform: translate(-50%, -50%);
                        animation: portalRing 2s ${delay}s ease-in-out infinite;
                        box-shadow: 0 0 20px ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'},
                                    inset 0 0 20px ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'};
                    "></div>`;
                }
                // Particles being pulled in
                for (let i = 0; i < 20; i++) {
                    const angle = Math.random() * 360;
                    const distance = 200 + Math.random() * 300;
                    const delay = Math.random() * 2;
                    particlesHtml += `<div style="
                        position:absolute; left:50%; top:50%;
                        width:4px; height:4px; border-radius:50%;
                        background: ${Math.random() > 0.5 ? '#8b5cf6' : '#06b6d4'};
                        animation: portalParticle 2s ${delay}s ease-in infinite;
                        transform: rotate(${angle}deg) translateX(${distance}px);
                    "></div>`;
                }
            }
            
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                ${bgStyle} display: flex; align-items: center; justify-content: center;
                overflow: hidden;
            `;
            overlay.style.animation = overlayIn;
            if (extraStyle) overlay.style.cssText += extraStyle;
            
            const glitchExtra = style === 'glitch' ? `
                <div class="glitch-lines" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">
                    <div style="position:absolute;left:0;right:0;height:2px;background:rgba(255,0,0,0.3);animation:glitchLine 0.2s infinite;"></div>
                    <div style="position:absolute;left:0;right:0;height:1px;background:rgba(0,255,255,0.3);animation:glitchLine 0.15s 0.05s infinite;"></div>
                </div>
            ` : '';
            
            overlay.innerHTML = `
                ${particlesHtml}
                ${glitchExtra}
                <div class="scene-text" style="
                    font-size: clamp(24px, 5vw, 48px); font-weight: 300; color: white; text-align: center;
                    font-style: italic; letter-spacing: 2px; padding: 20px;
                    animation: ${textAnimation}; z-index: 10; position: relative;
                    text-shadow: 0 0 20px rgba(255,255,255,0.5);
                    ${style === 'glitch' ? 'text-shadow: 2px 0 #ff0000, -2px 0 #00ffff;' : ''}
                    ${style === 'flames' ? 'text-shadow: 0 0 30px #ff4500, 0 0 60px #ff6600;' : ''}
                    ${style === 'lightning' ? 'text-shadow: 0 0 20px #00d4ff, 0 0 40px #fff;' : ''}
                    ${style === 'portal' ? 'text-shadow: 0 0 30px #8b5cf6, 0 0 60px #06b6d4;' : ''}
                ">${this.escapeHtml(broadcast.text)}</div>
            `;
            
            // Add dynamic styles for new effects
            if (!document.getElementById('scene-effect-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'scene-effect-styles';
                styleEl.textContent = `
                    @keyframes shatterPiece {
                        0% { transform: rotate(var(--rot, 0deg)) scale(1); opacity: 0.3; }
                        100% { transform: rotate(calc(var(--rot, 0deg) + 180deg)) translateY(100vh) scale(0); opacity: 0; }
                    }
                    @keyframes sceneShatterIn { from { clip-path: circle(0% at 50% 50%); } to { clip-path: circle(150% at 50% 50%); } }
                    @keyframes sceneShatterOut { from { opacity: 1; } to { opacity: 0; transform: scale(1.1); } }
                    @keyframes sceneTextShatter { 0% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.1); } 100% { transform: scale(1); } }
                    
                    @keyframes vortexSpin { from { transform: rotate(0deg) translateX(var(--dist, 150px)); } to { transform: rotate(360deg) translateX(var(--dist, 150px)); } }
                    @keyframes sceneVortexIn { from { transform: rotate(-180deg) scale(0); opacity: 0; } to { transform: rotate(0) scale(1); opacity: 1; } }
                    @keyframes sceneVortexOut { from { transform: rotate(0) scale(1); } to { transform: rotate(180deg) scale(0); } }
                    @keyframes sceneTextVortex { 0% { opacity: 0; transform: rotate(-20deg) scale(0.5); } 100% { opacity: 1; transform: rotate(0) scale(1); } }
                    
                    @keyframes flameRise { 
                        0% { transform: translateY(0) scale(1); opacity: 0.8; } 
                        100% { transform: translateY(-100vh) scale(0.3); opacity: 0; } 
                    }
                    @keyframes sceneFlamesIn { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0); } }
                    @keyframes sceneFlamesOut { from { opacity: 1; } to { opacity: 0; filter: brightness(3); } }
                    @keyframes sceneTextFlames { 0% { opacity: 0; transform: translateY(50px); filter: blur(10px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
                    
                    @keyframes lightningBolt { 
                        0%, 100% { opacity: 0; } 
                        10%, 30% { opacity: 1; } 
                        20%, 40% { opacity: 0.3; } 
                    }
                    @keyframes sceneLightningIn { from { filter: brightness(0); } to { filter: brightness(1); } }
                    @keyframes sceneLightningOut { from { opacity: 1; } to { opacity: 0; } }
                    @keyframes sceneTextLightning { 0% { opacity: 0; text-shadow: none; } 20% { opacity: 1; text-shadow: 0 0 50px #fff; } 100% { text-shadow: 0 0 20px #00d4ff; } }
                    @keyframes lightningFlash { 0%, 89%, 91%, 93%, 95%, 100% { opacity: 0; } 90%, 92%, 94% { opacity: 0.3; } }
                    
                    @keyframes portalRing { 
                        0% { transform: translate(-50%, -50%) scale(0.8) rotateX(75deg); opacity: 0.3; }
                        50% { transform: translate(-50%, -50%) scale(1.2) rotateX(75deg); opacity: 0.8; }
                        100% { transform: translate(-50%, -50%) scale(0.8) rotateX(75deg); opacity: 0.3; }
                    }
                    @keyframes portalParticle { 
                        0% { opacity: 1; transform: rotate(var(--angle, 0deg)) translateX(var(--dist, 300px)); }
                        100% { opacity: 0; transform: rotate(var(--angle, 0deg)) translateX(0); }
                    }
                    @keyframes scenePortalIn { from { clip-path: circle(0% at 50% 50%); } to { clip-path: circle(100% at 50% 50%); } }
                    @keyframes scenePortalOut { from { clip-path: circle(100% at 50% 50%); } to { clip-path: circle(0% at 50% 50%); } }
                    @keyframes sceneTextPortal { 0% { opacity: 0; transform: scale(3); filter: blur(20px); } 100% { opacity: 1; transform: scale(1); filter: blur(0); } }
                `;
                document.head.appendChild(styleEl);
            }
            
            document.body.appendChild(overlay);
            
            // Play sound only if enabled
            if (broadcast.sound && broadcast.sound !== 'none') {
                this.playBroadcastSound(broadcast.sound);
            }
            
            // Auto-close after animation
            setTimeout(() => {
                overlay.style.animation = overlayOut;
                setTimeout(() => overlay.remove(), 1000);
            }, 3000);
        },
        
        // Dramatic reveal
        showReveal(broadcast) {
            // Play sound only if enabled
            if (broadcast.sound && broadcast.sound !== 'none') {
                this.playBroadcastSound(broadcast.sound);
            }
            
            const overlay = document.createElement('div');
            overlay.className = 'cinematic-overlay reveal';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: #000; display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                animation: fadeIn 0.5s ease;
            `;
            overlay.innerHTML = `
                ${broadcast.title ? `<h2 style="font-size: 24px; color: white; margin-bottom: 24px; animation: revealTitle 1s ease;">${this.escapeHtml(broadcast.title)}</h2>` : ''}
                <img src="${broadcast.image}" alt="" style="
                    max-width: 80%; max-height: 70vh; object-fit: contain;
                    border-radius: 12px; animation: revealImage 1.5s ease;
                    box-shadow: 0 0 100px rgba(139,92,246,0.5);
                ">
                <button style="
                    margin-top: 32px; padding: 14px 32px;
                    background: #8b5cf6; border: none; border-radius: 10px;
                    color: white; font-size: 16px; font-weight: 600; cursor: pointer;
                " onclick="this.closest('.cinematic-overlay').remove()">Weiter</button>
            `;
            
            document.body.appendChild(overlay);
        },
        
        // Combat start with pulse effect
        showCombatStart(broadcast) {
            // Persist to survive refresh
            this.persistBroadcast('combat', broadcast);
            
            if (!broadcast._restored) {
                this.playBroadcastSound(broadcast.sound);
            }
            
            // Remove existing
            document.querySelectorAll('.combat-start').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'cinematic-overlay combat-start broadcast-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: linear-gradient(135deg, #1a0a0a, #2d1b1b);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                animation: combatFlash 0.5s ease;
                overflow: hidden;
            `;
            
            // Add particle container if particles enabled
            const particlesHtml = broadcast.particles !== false ? `
                <div class="combat-particles" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">
                    ${Array.from({length: 30}, (_, i) => `
                        <div style="
                            position: absolute;
                            width: ${4 + Math.random() * 8}px;
                            height: ${4 + Math.random() * 8}px;
                            background: ${['#ef4444', '#f97316', '#fbbf24', '#dc2626'][Math.floor(Math.random() * 4)]};
                            border-radius: 50%;
                            left: ${Math.random() * 100}%;
                            top: ${Math.random() * 100}%;
                            opacity: ${0.3 + Math.random() * 0.7};
                            animation: combatParticle ${2 + Math.random() * 3}s ease-in-out infinite;
                            animation-delay: ${Math.random() * 2}s;
                            box-shadow: 0 0 ${6 + Math.random() * 10}px currentColor;
                        "></div>
                    `).join('')}
                </div>
            ` : '';
            
            overlay.innerHTML = `
                ${particlesHtml}
                <div style="animation: combatTitle 0.8s ease; text-align: center; z-index: 1;">
                    <h1 style="
                        font-size: clamp(40px, 10vw, 80px); font-weight: 900; color: #ef4444;
                        text-transform: uppercase; letter-spacing: 8px;
                        text-shadow: 0 0 60px rgba(239,68,68,0.8);
                        animation: combatPulse 1.5s ease-in-out infinite;
                    ">${this.escapeHtml(broadcast.title || 'INITIATIVE!')}</h1>
                    ${broadcast.subtitle ? `<p style="
                        font-size: clamp(16px, 4vw, 28px); color: rgba(255,255,255,0.8); 
                        margin-top: 20px; text-align: center; letter-spacing: 2px;
                    ">${this.escapeHtml(broadcast.subtitle)}</p>` : ''}
                </div>
                <button style="
                    margin-top: 48px; padding: 16px 40px;
                    background: #ef4444; border: none; border-radius: 10px;
                    color: white; font-size: 18px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 2px; cursor: pointer;
                    animation: combatBtn 1s ease;
                    box-shadow: 0 0 30px rgba(239,68,68,0.5);
                    z-index: 1;
                " onclick="BroadcastListener.closeFullscreen('combat', this)">⚔️ Kämpfen!</button>
            `;
            
            // Add particle animation keyframes if not exists
            if (!document.getElementById('combat-particle-styles')) {
                const style = document.createElement('style');
                style.id = 'combat-particle-styles';
                style.textContent = `
                    @keyframes combatParticle {
                        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
                        25% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${20 + Math.random() * 40}px, -${30 + Math.random() * 50}px) scale(1.2); opacity: 0.8; }
                        50% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${40 + Math.random() * 60}px, -${10 + Math.random() * 30}px) scale(0.8); opacity: 0.6; }
                        75% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${10 + Math.random() * 30}px, ${20 + Math.random() * 40}px) scale(1.1); opacity: 0.4; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(overlay);
        },
        
        // Ambient change - persistent overlay effect with localStorage
        showAmbientChange(broadcast) {
            // Remove any existing ambient overlay
            document.querySelectorAll('.ambient-overlay').forEach(el => el.remove());
            
            // "clear" removes the overlay and localStorage
            if (broadcast.effect === 'clear') {
                localStorage.removeItem('rift_ambient_effect');
                return;
            }
            
            // Store in localStorage for persistence
            localStorage.setItem('rift_ambient_effect', broadcast.effect);
            
            this.applyAmbientEffect(broadcast.effect);
        },
        
        // Apply ambient effect (used for both new broadcasts and page load)
        applyAmbientEffect(effectName) {
            // Remove existing
            document.querySelectorAll('.ambient-overlay').forEach(el => el.remove());
            // Stop lightning
            if (this.lightningInterval) {
                clearInterval(this.lightningInterval);
                this.lightningInterval = null;
            }
            
            if (!effectName || effectName === 'clear') return;
            
            const effects = {
                rain: { 
                    css: `background: linear-gradient(transparent 0%, rgba(20,40,60,0.25) 100%);`,
                    particles: 'rain'
                },
                storm: { 
                    css: `background: linear-gradient(transparent 0%, rgba(20,30,50,0.4) 100%);`,
                    particles: 'rain',
                    flash: true
                },
                snow: { 
                    css: `background: linear-gradient(rgba(200,220,255,0.08) 0%, transparent 100%);`,
                    particles: 'snow'
                },
                fog: { 
                    css: `background: linear-gradient(transparent 0%, rgba(150,150,150,0.3) 50%, transparent 100%);`,
                    particles: 'fog'
                },
                fire: { 
                    css: `background: linear-gradient(transparent 40%, rgba(255,100,0,0.25) 100%);`,
                    particles: 'ember'
                },
                darkness: { 
                    css: `background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%);`,
                    particles: 'dust'
                },
                magic: { 
                    css: `background: radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, transparent 70%);`,
                    particles: 'sparkle'
                },
                blood: { 
                    css: `background: linear-gradient(transparent 60%, rgba(180,0,0,0.25) 100%);`,
                    particles: 'drip'
                },
                underwater: { 
                    css: `background: linear-gradient(rgba(0,100,150,0.2) 0%, rgba(0,50,100,0.3) 100%);`,
                    particles: 'bubble'
                },
                poison: { 
                    css: `background: linear-gradient(transparent 50%, rgba(100,180,0,0.25) 100%);`,
                    particles: 'poisonSmoke'
                },
                holy: { 
                    css: `background: radial-gradient(ellipse at top, rgba(255,215,0,0.2) 0%, transparent 60%);`,
                    particles: 'holySparkle'
                },
                sea: { 
                    css: `background: linear-gradient(
                        rgba(255,220,100,0.15) 0%, 
                        rgba(255,200,50,0.1) 20%,
                        rgba(200,230,255,0.05) 45%,
                        rgba(0,100,150,0.2) 50%, 
                        rgba(0,80,130,0.3) 70%,
                        rgba(0,60,100,0.35) 100%
                    );`,
                    particles: 'seaBubbles',
                    sunrays: true
                },
                forest: { 
                    css: `background: linear-gradient(rgba(34,139,34,0.1) 0%, rgba(0,50,0,0.15) 100%);`,
                    particles: 'leaf'
                },
                desert: { 
                    css: `background: linear-gradient(rgba(255,200,100,0.15) 0%, rgba(200,150,50,0.2) 100%);`,
                    particles: 'sand',
                    shimmer: true
                },
                cave: { 
                    css: `background: radial-gradient(ellipse at center, rgba(30,30,30,0.3) 0%, rgba(0,0,0,0.7) 80%);`,
                    particles: 'caveDrip'
                },
                stars: { 
                    css: `background: linear-gradient(rgba(10,10,30,0.3) 0%, rgba(5,5,20,0.4) 100%);`,
                    particles: 'star'
                },
                ash: { 
                    css: `background: linear-gradient(rgba(80,80,80,0.15) 0%, rgba(50,50,50,0.25) 100%);`,
                    particles: 'ash'
                },
                sandstorm: { 
                    css: `background: linear-gradient(rgba(194,154,108,0.3) 0%, rgba(139,90,43,0.4) 100%);`,
                    particles: 'sandstorm'
                },
                aurora: { 
                    css: `background: linear-gradient(rgba(10,10,30,0.2) 0%, transparent 100%);`,
                    particles: 'aurora'
                },
                swamp: { 
                    css: `background: linear-gradient(transparent 30%, rgba(50,80,30,0.3) 70%, rgba(30,50,20,0.4) 100%);`,
                    particles: 'swampBubble'
                },
                void: { 
                    css: `background: radial-gradient(ellipse at center, rgba(20,0,40,0.5) 0%, rgba(0,0,0,0.9) 100%);`,
                    particles: 'voidParticle'
                },
                nightmare: { 
                    css: `background: radial-gradient(ellipse at center, rgba(30,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%);`,
                    particles: 'nightmare'
                },
                sakura: { 
                    css: `background: linear-gradient(rgba(255,182,193,0.1) 0%, transparent 100%);`,
                    particles: 'sakura'
                },
                lightning: { 
                    css: `background: linear-gradient(rgba(10,10,30,0.2) 0%, rgba(20,20,50,0.3) 100%);`,
                    particles: 'none',
                    flash: true
                }
            };
            
            const effect = effects[effectName];
            if (!effect) return;
            
            const overlay = document.createElement('div');
            overlay.className = 'ambient-overlay';
            overlay.dataset.effect = effectName;
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 9998;
                ${effect.css}
                pointer-events: none;
                opacity: 0;
                transition: opacity 2s ease;
            `;
            
            // Add particles based on type
            const particleMap = {
                'rain': () => this.createRainEffect(),
                'snow': () => this.createSnowEffect(),
                'sparkle': () => this.createSparkleEffect(),
                'bubble': () => this.createBubbleEffect(),
                'ember': () => this.createEmberEffect(),
                'fog': () => this.createFogParticles(),
                'dust': () => this.createDustEffect(),
                'drip': () => this.createDripEffect(),
                'smoke': () => this.createSmokeEffect(),
                'wave': () => this.createWaveEffect(),
                'leaf': () => this.createLeafEffect(),
                'sand': () => this.createSandEffect(),
                'star': () => this.createStarEffect(),
                'ash': () => this.createAshEffect(),
                'seafoam': () => this.createSeafoamEffect(),
                'caveDrip': () => this.createCaveDripEffect(),
                'seaBubbles': () => this.createSeaBubblesEffect(),
                'sandstorm': () => this.createSandstormEffect(),
                'aurora': () => this.createAuroraEffect(),
                'swampBubble': () => this.createSwampBubbleEffect(),
                'voidParticle': () => this.createVoidParticleEffect(),
                'nightmare': () => this.createNightmareEffect(),
                'sakura': () => this.createSakuraEffect(),
                'poisonSmoke': () => this.createPoisonSmokeEffect(),
                'holySparkle': () => this.createHolySparkleEffect(),
                'none': () => ''
            };
            
            if (effect.particles && particleMap[effect.particles]) {
                overlay.innerHTML = particleMap[effect.particles]();
            }
            
            // Add lightning flash for storm
            if (effect.flash) {
                this.startLightningEffect();
            }
            
            // Add sunrays for sea
            if (effect.sunrays) {
                overlay.innerHTML += this.createSunraysEffect();
            }
            
            // Add shimmer for desert
            if (effect.shimmer) {
                overlay.style.animation = 'heatShimmer 3s ease-in-out infinite';
            }
            
            document.body.appendChild(overlay);
            
            // Fade in
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
            });
        },
        
        // Restore ambient effect on page load
        restoreAmbientEffect() {
            const savedEffect = localStorage.getItem('rift_ambient_effect');
            if (savedEffect && savedEffect !== 'clear') {
                this.applyAmbientEffect(savedEffect);
            }
        },
        
        // Rain effect particles
        createRainEffect() {
            let drops = '';
            for (let i = 0; i < 60; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 2;
                const duration = 0.4 + Math.random() * 0.4;
                drops += `<div style="
                    position: absolute; top: -20px; left: ${left}%;
                    width: 1px; height: 15px;
                    background: linear-gradient(transparent, rgba(150,200,255,0.5));
                    animation: rainDrop ${duration}s linear ${delay}s infinite;
                "></div>`;
            }
            return drops;
        },
        
        // Snow effect particles
        createSnowEffect() {
            let flakes = '';
            for (let i = 0; i < 40; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 6 + Math.random() * 6;
                const size = 2 + Math.random() * 4;
                flakes += `<div style="
                    position: absolute; top: -20px; left: ${left}%;
                    width: ${size}px; height: ${size}px; border-radius: 50%;
                    background: rgba(255,255,255,0.7);
                    animation: snowDrop ${duration}s linear ${delay}s infinite;
                "></div>`;
            }
            return flakes;
        },
        
        // Sparkle effect for magic/holy
        createSparkleEffect() {
            let sparkles = '';
            for (let i = 0; i < 25; i++) {
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                const delay = Math.random() * 3;
                const duration = 2 + Math.random() * 2;
                const size = 2 + Math.random() * 3;
                sparkles += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(255,255,255,0.8);
                    border-radius: 50%;
                    box-shadow: 0 0 ${size * 2}px rgba(255,255,255,0.5);
                    animation: sparkleFade ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return sparkles;
        },
        
        // Bubble effect for underwater
        createBubbleEffect() {
            let bubbles = '';
            for (let i = 0; i < 20; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 4;
                const duration = 4 + Math.random() * 4;
                const size = 4 + Math.random() * 8;
                bubbles += `<div style="
                    position: absolute; bottom: -20px; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(150,200,255,0.3);
                    border: 1px solid rgba(200,230,255,0.4);
                    border-radius: 50%;
                    animation: bubbleRise ${duration}s ease-in ${delay}s infinite;
                "></div>`;
            }
            return bubbles;
        },
        
        // Ember effect for fire
        createEmberEffect() {
            let embers = '';
            for (let i = 0; i < 30; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 3;
                const duration = 3 + Math.random() * 3;
                const size = 2 + Math.random() * 3;
                embers += `<div style="
                    position: absolute; bottom: -10px; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(255,${100 + Math.random() * 100},0,0.8);
                    border-radius: 50%;
                    box-shadow: 0 0 ${size * 2}px rgba(255,100,0,0.5);
                    animation: emberRise ${duration}s ease-out ${delay}s infinite;
                "></div>`;
            }
            return embers;
        },
        
        // Fog particles
        createFogParticles() {
            let fog = '';
            for (let i = 0; i < 15; i++) {
                const left = Math.random() * 100;
                const top = 20 + Math.random() * 60;
                const delay = Math.random() * 5;
                const duration = 8 + Math.random() * 8;
                const size = 100 + Math.random() * 200;
                fog += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size * 0.4}px;
                    background: radial-gradient(ellipse, rgba(180,180,180,0.3), transparent);
                    border-radius: 50%;
                    animation: fogFloat ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return fog;
        },
        
        // Dust particles for darkness
        createDustEffect() {
            let dust = '';
            for (let i = 0; i < 40; i++) {
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                const delay = Math.random() * 4;
                const duration = 6 + Math.random() * 6;
                const size = 1 + Math.random() * 2;
                dust += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(100,100,100,0.4);
                    border-radius: 50%;
                    animation: dustFloat ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return dust;
        },
        
        // Drip effect for blood
        createDripEffect() {
            let drips = '';
            for (let i = 0; i < 20; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 4;
                const duration = 2 + Math.random() * 2;
                drips += `<div style="
                    position: absolute; top: -10px; left: ${left}%;
                    width: 2px; height: 15px;
                    background: linear-gradient(rgba(180,0,0,0.6), rgba(120,0,0,0.3));
                    border-radius: 0 0 2px 2px;
                    animation: bloodDrip ${duration}s ease-in ${delay}s infinite;
                "></div>`;
            }
            return drips;
        },
        
        // Smoke effect for poison
        createSmokeEffect() {
            let smoke = '';
            for (let i = 0; i < 20; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 3;
                const duration = 4 + Math.random() * 4;
                const size = 20 + Math.random() * 40;
                smoke += `<div style="
                    position: absolute; bottom: -20px; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: radial-gradient(circle, rgba(100,180,0,0.3), transparent);
                    border-radius: 50%;
                    animation: smokeRise ${duration}s ease-out ${delay}s infinite;
                "></div>`;
            }
            return smoke;
        },
        
        // Wave effect for sea
        createWaveEffect() {
            let waves = '';
            for (let i = 0; i < 5; i++) {
                const top = 60 + i * 8;
                const delay = i * 0.5;
                waves += `<div style="
                    position: absolute; bottom: ${100 - top}%; left: -10%;
                    width: 120%; height: 60px;
                    background: linear-gradient(transparent, rgba(100,180,220,0.15), transparent);
                    border-radius: 50%;
                    animation: waveMove ${3 + i * 0.5}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return waves;
        },
        
        // Leaf effect for forest
        createLeafEffect() {
            let leaves = '';
            const leafColors = ['rgba(34,139,34,0.6)', 'rgba(50,150,50,0.5)', 'rgba(80,180,80,0.4)'];
            for (let i = 0; i < 25; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 8 + Math.random() * 8;
                const size = 6 + Math.random() * 8;
                const color = leafColors[Math.floor(Math.random() * leafColors.length)];
                leaves += `<div style="
                    position: absolute; top: -20px; left: ${left}%;
                    width: ${size}px; height: ${size * 0.6}px;
                    background: ${color};
                    border-radius: 0 50% 50% 50%;
                    transform: rotate(45deg);
                    animation: leafFall ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return leaves;
        },
        
        // Sand effect for desert
        createSandEffect() {
            let sand = '';
            for (let i = 0; i < 50; i++) {
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                const delay = Math.random() * 3;
                const duration = 2 + Math.random() * 2;
                const size = 1 + Math.random() * 2;
                sand += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(200,180,140,0.5);
                    border-radius: 50%;
                    animation: sandDrift ${duration}s linear ${delay}s infinite;
                "></div>`;
            }
            return sand;
        },
        
        // Star effect for night sky
        createStarEffect() {
            let stars = '';
            for (let i = 0; i < 60; i++) {
                const left = Math.random() * 100;
                const top = Math.random() * 70;
                const delay = Math.random() * 3;
                const duration = 2 + Math.random() * 3;
                const size = 1 + Math.random() * 2;
                stars += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(255,255,255,0.8);
                    border-radius: 50%;
                    box-shadow: 0 0 ${size * 2}px rgba(255,255,255,0.5);
                    animation: starTwinkle ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return stars;
        },
        
        // Ash effect
        createAshEffect() {
            let ash = '';
            for (let i = 0; i < 40; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 4;
                const duration = 6 + Math.random() * 6;
                const size = 2 + Math.random() * 4;
                ash += `<div style="
                    position: absolute; top: -20px; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(80,80,80,0.6);
                    border-radius: 50%;
                    animation: ashFall ${duration}s ease-in ${delay}s infinite;
                "></div>`;
            }
            return ash;
        },
        
        // Seafoam effect for sea - horizontal foam lines
        createSeafoamEffect() {
            let foam = '';
            // Horizontal foam lines
            for (let i = 0; i < 8; i++) {
                const bottom = 10 + i * 10;
                const delay = i * 0.3;
                const width = 80 + Math.random() * 40;
                foam += `<div style="
                    position: absolute; bottom: ${bottom}%; left: ${-20 + Math.random() * 20}%;
                    width: ${width}%; height: 3px;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(200,230,255,0.4), rgba(255,255,255,0.3), transparent);
                    border-radius: 50%;
                    animation: foamMove ${4 + i * 0.5}s ease-in-out ${delay}s infinite;
                    filter: blur(1px);
                "></div>`;
            }
            // Floating foam spots
            for (let i = 0; i < 20; i++) {
                const left = Math.random() * 100;
                const bottom = Math.random() * 60;
                const delay = Math.random() * 4;
                const size = 3 + Math.random() * 6;
                foam += `<div style="
                    position: absolute; bottom: ${bottom}%; left: ${left}%;
                    width: ${size}px; height: ${size * 0.5}px;
                    background: rgba(255,255,255,0.4);
                    border-radius: 50%;
                    animation: foamBob ${2 + Math.random() * 2}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return foam;
        },
        
        // Cave drip effect - blue/white water drops
        createCaveDripEffect() {
            let drips = '';
            for (let i = 0; i < 15; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 2.5 + Math.random() * 2;
                drips += `<div style="
                    position: absolute; top: -10px; left: ${left}%;
                    width: 2px; height: 12px;
                    background: linear-gradient(rgba(180,220,255,0.7), rgba(100,180,220,0.4));
                    border-radius: 0 0 2px 2px;
                    animation: caveDrip ${duration}s ease-in ${delay}s infinite;
                "></div>`;
            }
            // Occasional splash at bottom
            for (let i = 0; i < 5; i++) {
                const left = 10 + Math.random() * 80;
                const delay = Math.random() * 6;
                drips += `<div style="
                    position: absolute; bottom: 5%; left: ${left}%;
                    width: 8px; height: 4px;
                    background: rgba(180,220,255,0.3);
                    border-radius: 50%;
                    animation: caveSplash 3s ease-out ${delay}s infinite;
                "></div>`;
            }
            return drips;
        },
        
        // Sea bubbles - only at bottom edge
        createSeaBubblesEffect() {
            let bubbles = '';
            for (let i = 0; i < 15; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 4;
                const duration = 3 + Math.random() * 2;
                const size = 3 + Math.random() * 5;
                // Bubbles only rise from bottom 30% of screen
                bubbles += `<div style="
                    position: absolute; bottom: 0; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), rgba(100,180,220,0.3));
                    border-radius: 50%;
                    animation: seaBubbleRise ${duration}s ease-out ${delay}s infinite;
                "></div>`;
            }
            return bubbles;
        },
        
        // Sandstorm effect
        createSandstormEffect() {
            let particles = '';
            for (let i = 0; i < 80; i++) {
                const top = Math.random() * 100;
                const delay = Math.random() * 2;
                const duration = 0.5 + Math.random() * 1;
                const size = 1 + Math.random() * 3;
                particles += `<div style="
                    position: absolute; top: ${top}%; right: -20px;
                    width: ${size}px; height: ${size}px;
                    background: rgba(194,154,108,${0.3 + Math.random() * 0.4});
                    border-radius: 50%;
                    animation: sandstormBlow ${duration}s linear ${delay}s infinite;
                "></div>`;
            }
            return particles;
        },
        
        // Aurora/Northern Lights effect
        createAuroraEffect() {
            let aurora = '';
            const colors = ['rgba(0,255,127,0.2)', 'rgba(0,200,255,0.2)', 'rgba(138,43,226,0.2)', 'rgba(0,255,200,0.2)'];
            for (let i = 0; i < 4; i++) {
                const delay = i * 0.5;
                aurora += `<div style="
                    position: absolute; top: 5%; left: ${10 + i * 20}%;
                    width: 30%; height: 40%;
                    background: linear-gradient(${colors[i]}, transparent);
                    filter: blur(30px);
                    animation: auroraWave ${4 + i}s ease-in-out ${delay}s infinite alternate;
                    transform-origin: top center;
                "></div>`;
            }
            return aurora;
        },
        
        // Swamp bubbles
        createSwampBubbleEffect() {
            let bubbles = '';
            for (let i = 0; i < 12; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 5;
                const duration = 2 + Math.random() * 3;
                const size = 5 + Math.random() * 10;
                bubbles += `<div style="
                    position: absolute; bottom: 10%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: radial-gradient(circle, rgba(80,100,50,0.4), rgba(50,70,30,0.6));
                    border-radius: 50%;
                    animation: swampBubblePop ${duration}s ease-in ${delay}s infinite;
                "></div>`;
            }
            return bubbles;
        },
        
        // Void/darkness particles
        createVoidParticleEffect() {
            let particles = '';
            for (let i = 0; i < 30; i++) {
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                const delay = Math.random() * 4;
                const duration = 3 + Math.random() * 4;
                const size = 3 + Math.random() * 6;
                particles += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: radial-gradient(circle, rgba(100,0,150,0.8), transparent);
                    border-radius: 50%;
                    animation: voidPulse ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return particles;
        },
        
        // Nightmare effect - creepy eyes
        createNightmareEffect() {
            let eyes = '';
            for (let i = 0; i < 8; i++) {
                const left = 10 + Math.random() * 80;
                const top = 10 + Math.random() * 80;
                const delay = Math.random() * 5;
                const size = 10 + Math.random() * 20;
                eyes += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size * 0.5}px;
                    background: radial-gradient(ellipse, rgba(255,0,0,0.8), rgba(150,0,0,0.4), transparent);
                    border-radius: 50%;
                    animation: nightmareEye ${3 + Math.random() * 3}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return eyes;
        },
        
        // Sakura/cherry blossom petals
        createSakuraEffect() {
            let petals = '';
            for (let i = 0; i < 25; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 6;
                const duration = 6 + Math.random() * 4;
                const size = 6 + Math.random() * 8;
                const rotation = Math.random() * 360;
                petals += `<div style="
                    position: absolute; top: -20px; left: ${left}%;
                    width: ${size}px; height: ${size * 0.6}px;
                    background: rgba(255,182,193,0.7);
                    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
                    transform: rotate(${rotation}deg);
                    animation: sakuraFall ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return petals;
        },
        
        // Poison smoke effect
        createPoisonSmokeEffect() {
            let smoke = '';
            for (let i = 0; i < 15; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 3;
                const duration = 4 + Math.random() * 3;
                const size = 30 + Math.random() * 50;
                smoke += `<div style="
                    position: absolute; bottom: -${size}px; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: radial-gradient(circle, rgba(100,200,0,0.3), rgba(50,150,0,0.1), transparent);
                    border-radius: 50%;
                    filter: blur(10px);
                    animation: poisonRise ${duration}s ease-out ${delay}s infinite;
                "></div>`;
            }
            return smoke;
        },
        
        // Holy sparkle effect
        createHolySparkleEffect() {
            let sparkles = '';
            for (let i = 0; i < 30; i++) {
                const left = Math.random() * 100;
                const top = Math.random() * 60;
                const delay = Math.random() * 3;
                const duration = 2 + Math.random() * 2;
                const size = 2 + Math.random() * 4;
                sparkles += `<div style="
                    position: absolute; top: ${top}%; left: ${left}%;
                    width: ${size}px; height: ${size}px;
                    background: rgba(255,215,0,0.9);
                    border-radius: 50%;
                    box-shadow: 0 0 ${size * 3}px rgba(255,215,0,0.6);
                    animation: holySparkle ${duration}s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            // Add rays from top
            for (let i = 0; i < 5; i++) {
                const left = 20 + i * 15;
                sparkles += `<div style="
                    position: absolute; top: 0; left: ${left}%;
                    width: 2px; height: 50%;
                    background: linear-gradient(rgba(255,215,0,0.4), transparent);
                    animation: holyRay ${2 + i * 0.3}s ease-in-out infinite alternate;
                "></div>`;
            }
            return sparkles;
        },
        
        // Sunrays for sea effect
        createSunraysEffect() {
            let rays = '';
            // Create 5 subtle sun rays from top
            for (let i = 0; i < 5; i++) {
                const left = 20 + i * 15;
                const width = 2 + Math.random() * 3;
                const delay = i * 0.3;
                rays += `<div style="
                    position: absolute; top: 0; left: ${left}%;
                    width: ${width}px; height: 45%;
                    background: linear-gradient(rgba(255,220,100,0.15), transparent);
                    transform: rotate(${-10 + i * 5}deg);
                    transform-origin: top center;
                    animation: sunrayPulse 4s ease-in-out ${delay}s infinite;
                "></div>`;
            }
            return rays;
        },
        
        // Lightning flash for storm
        lightningInterval: null,
        startLightningEffect() {
            // Clear existing
            if (this.lightningInterval) clearInterval(this.lightningInterval);
            
            const flash = () => {
                const lightning = document.createElement('div');
                lightning.style.cssText = `
                    position: fixed; inset: 0; z-index: 9999;
                    background: rgba(255,255,255,0.3);
                    pointer-events: none;
                    animation: lightningFlash 0.2s ease;
                `;
                document.body.appendChild(lightning);
                setTimeout(() => lightning.remove(), 200);
            };
            
            // Random lightning flashes
            this.lightningInterval = setInterval(() => {
                if (Math.random() < 0.3) flash();
            }, 3000);
        },
        
        // Reaction
        showReaction(broadcast) {
            this.playBroadcastSound(broadcast.sound);
            
            const hasEmoji = broadcast.emoji && broadcast.emoji.trim();
            const hasMessage = broadcast.message && broadcast.message.trim();
            
            const overlay = document.createElement('div');
            overlay.className = 'reaction-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                display: flex; align-items: center; justify-content: center;
                flex-direction: column; gap: 16px;
                pointer-events: none;
            `;
            overlay.innerHTML = `
                ${hasEmoji ? `<span style="
                    font-size: 120px;
                    animation: reactionPop 1.5s ease forwards;
                ">${broadcast.emoji}</span>` : ''}
                ${hasMessage ? `<span style="
                    font-size: ${hasEmoji ? '24px' : '48px'}; color: white; font-weight: 600;
                    text-shadow: 0 2px 20px rgba(0,0,0,0.8);
                    animation: reactionPop 1.5s ease forwards;
                    padding: 20px 40px;
                    background: rgba(0,0,0,0.6);
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                ">${this.escapeHtml(broadcast.message)}</span>` : ''}
            `;
            
            document.body.appendChild(overlay);
            setTimeout(() => overlay.remove(), 1500);
        },
        
        // Quick Toast - simple notification
        showToast(broadcast) {
            const toast = document.createElement('div');
            toast.className = 'broadcast-toast';
            toast.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: rgba(30,30,30,0.95); border: 1px solid rgba(255,255,255,0.1);
                padding: 16px 32px; border-radius: 12px; z-index: 99999;
                font-size: 18px; color: white; font-weight: 500;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards;
                backdrop-filter: blur(10px);
            `;
            toast.textContent = broadcast.message;
            
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },
        
        // Timer - countdown display
        showTimer(broadcast) {
            // Remove existing timer
            document.querySelectorAll('.broadcast-timer-overlay').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-timer-overlay';
            overlay.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 99998;
                background: rgba(20,20,20,0.95); border: 2px solid rgba(139,92,246,0.5);
                padding: 16px 24px; border-radius: 16px;
                text-align: center; min-width: 150px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                backdrop-filter: blur(10px);
            `;
            
            const label = broadcast.label || 'Timer';
            const endTime = broadcast.startTime + (broadcast.seconds * 1000);
            
            overlay.innerHTML = `
                <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">${this.escapeHtml(label)}</div>
                <div class="timer-display" style="font-size: 48px; font-weight: 700; color: white; font-variant-numeric: tabular-nums;"></div>
            `;
            
            document.body.appendChild(overlay);
            
            const timerDisplay = overlay.querySelector('.timer-display');
            
            const updateTimer = () => {
                const remaining = Math.max(0, endTime - Date.now());
                const seconds = Math.ceil(remaining / 1000);
                
                if (seconds <= 0) {
                    timerDisplay.textContent = '0:00';
                    timerDisplay.style.color = '#ef4444';
                    overlay.style.borderColor = 'rgba(239,68,68,0.5)';
                    overlay.style.animation = 'timerFlash 0.5s ease infinite';
                    
                    // Remove after 5 seconds when done
                    setTimeout(() => {
                        overlay.style.animation = 'fadeOut 0.3s ease forwards';
                        setTimeout(() => overlay.remove(), 300);
                    }, 5000);
                    return;
                }
                
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                
                // Warning colors
                if (seconds <= 10) {
                    timerDisplay.style.color = '#ef4444';
                    overlay.style.borderColor = 'rgba(239,68,68,0.5)';
                } else if (seconds <= 30) {
                    timerDisplay.style.color = '#f59e0b';
                    overlay.style.borderColor = 'rgba(245,158,11,0.5)';
                }
                
                requestAnimationFrame(updateTimer);
            };
            
            updateTimer();
        },
        
        // Status Request - show status picker for player
        showStatusRequest(broadcast) {
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay status-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: rgba(0,0,0,0.8); display: flex;
                align-items: center; justify-content: center;
                animation: fadeIn 0.3s ease;
            `;
            
            overlay.innerHTML = `
                <div style="background: #1a1a1a; border-radius: 20px; padding: 32px; text-align: center; max-width: 420px;">
                    <h2 style="margin: 0 0 8px; font-size: 24px; color: white;">Status Update</h2>
                    <p style="color: rgba(255,255,255,0.6); margin: 0 0 24px;">Wie ist dein Status?</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <button class="status-btn" onclick="BroadcastListener.sendStatus('ready', this)" style="padding: 16px 20px; font-size: 15px; background: rgba(34,197,94,0.2); border: 2px solid #22c55e; border-radius: 12px; color: white; cursor: pointer;">
                            ✅ Bereit
                        </button>
                        <button class="status-btn" onclick="BroadcastListener.sendStatus('notready', this)" style="padding: 16px 20px; font-size: 15px; background: rgba(239,68,68,0.2); border: 2px solid #ef4444; border-radius: 12px; color: white; cursor: pointer;">
                            ❌ Nicht bereit
                        </button>
                        <button class="status-btn" onclick="BroadcastListener.sendStatus('editing', this)" style="padding: 16px 20px; font-size: 15px; background: rgba(245,158,11,0.2); border: 2px solid #f59e0b; border-radius: 12px; color: white; cursor: pointer;">
                            ✏️ Editiere noch
                        </button>
                        <button class="status-btn" onclick="BroadcastListener.sendStatus('needsupport', this)" style="padding: 16px 20px; font-size: 15px; background: rgba(139,92,246,0.2); border: 2px solid #8b5cf6; border-radius: 12px; color: white; cursor: pointer;">
                            🆘 Brauche Hilfe
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
        },
        
        async sendStatus(status, btn) {
            const overlay = btn.closest('.broadcast-overlay');
            const uid = window.firebase?.auth?.()?.currentUser?.uid;
            const roomCode = localStorage.getItem('rift_current_room');
            
            if (!uid || !roomCode) {
                overlay?.remove();
                return;
            }
            
            // Get player name from localStorage or use uid
            const userData = JSON.parse(localStorage.getItem('rift_user_data') || '{}');
            const playerName = userData.name || 'Spieler';
            
            const statusLabels = {
                ready: '✅ Bereit',
                notready: '❌ Nicht bereit',
                editing: '✏️ Editiere noch',
                needsupport: '🆘 Brauche Hilfe'
            };
            
            try {
                // Write to status_responses subcollection (players have write access)
                const normalizedCode = roomCode.replace('-', '').toUpperCase();
                await window.firebase.firestore()
                    .collection('rooms').doc(normalizedCode)
                    .collection('status_responses').doc(uid)
                    .set({
                        status,
                        playerName,
                        playerId: uid,
                        updatedAt: Date.now(),
                        timestamp: window.firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                // Show confirmation toast
                const toast = document.createElement('div');
                toast.style.cssText = `
                    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                    background: rgba(30,30,30,0.95); padding: 12px 24px; border-radius: 8px;
                    color: white; font-size: 14px; z-index: 100001;
                    animation: toastIn 0.3s ease, toastOut 0.3s ease 2s forwards;
                `;
                toast.textContent = `Status: ${statusLabels[status]}`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2300);
            } catch (e) {
                console.error('[Status] Error:', e);
                // Show error toast
                const toast = document.createElement('div');
                toast.style.cssText = `
                    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                    background: rgba(239,68,68,0.95); padding: 12px 24px; border-radius: 8px;
                    color: white; font-size: 14px; z-index: 100001;
                `;
                toast.textContent = 'Fehler beim Senden';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            }
            
            overlay?.remove();
        },
        
        // ============ LOCATION BANNER ============
        showLocationBanner(broadcast) {
            // Persist to survive refresh
            this.persistBroadcast('location', broadcast);
            
            // Remove existing
            document.querySelectorAll('.location-overlay').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay location-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: rgba(0,0,0,0.9); display: flex;
                align-items: center; justify-content: center;
                animation: fadeIn 0.5s ease;
            `;
            
            const hasImage = broadcast.image ? `
                <div style="position: absolute; inset: 0; opacity: 0.3;">
                    <img src="${broadcast.image}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(3px);">
                </div>
            ` : '';
            
            overlay.innerHTML = `
                ${hasImage}
                <div style="text-align: center; z-index: 1; animation: locationSlide 1s ease;">
                    <div style="font-size: 14px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 4px; margin-bottom: 12px;">Ihr betretet</div>
                    <h1 style="font-size: clamp(32px, 6vw, 64px); font-weight: 700; color: white; margin: 0; text-shadow: 0 4px 20px rgba(0,0,0,0.5);">${this.escapeHtml(broadcast.name)}</h1>
                    ${broadcast.subtitle ? `<p style="font-size: 18px; color: rgba(255,255,255,0.7); margin-top: 16px; font-style: italic;">${this.escapeHtml(broadcast.subtitle)}</p>` : ''}
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Auto-close after 4 seconds
            setTimeout(() => {
                this.clearPersistedBroadcast('location');
                overlay.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => overlay.remove(), 500);
            }, 4000);
        },
        
        // ============ BOSS INTRO ============
        showBossIntro(broadcast) {
            // Persist to survive refresh
            this.persistBroadcast('boss', broadcast);
            
            if (broadcast.sound && broadcast.sound !== 'none' && !broadcast._restored) {
                this.playBroadcastSound(broadcast.sound);
            }
            
            // Remove existing
            document.querySelectorAll('.boss-overlay').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay boss-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: linear-gradient(135deg, #1a0a0a, #2d0a0a);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                animation: bossFlash 0.5s ease;
            `;
            
            const imageHtml = broadcast.image ? `
                <img src="${broadcast.image}" style="
                    width: 200px; height: 200px; object-fit: cover;
                    border-radius: 50%; border: 4px solid #ef4444;
                    box-shadow: 0 0 60px rgba(239,68,68,0.5);
                    animation: bossImagePulse 2s ease-in-out infinite;
                    margin-bottom: 24px;
                ">
            ` : '<div style="font-size: 120px; margin-bottom: 24px; animation: bossImagePulse 2s ease-in-out infinite;">👹</div>';
            
            overlay.innerHTML = `
                ${imageHtml}
                <h1 style="font-size: clamp(36px, 8vw, 72px); font-weight: 900; color: #ef4444; margin: 0; text-transform: uppercase; letter-spacing: 4px; text-shadow: 0 0 40px rgba(239,68,68,0.5); animation: bossTitle 1s ease;">${this.escapeHtml(broadcast.name)}</h1>
                ${broadcast.title ? `<p style="font-size: 24px; color: rgba(255,255,255,0.7); margin-top: 12px; font-style: italic; animation: bossSubtitle 1s ease 0.3s both;">${this.escapeHtml(broadcast.title)}</p>` : ''}
                <button style="margin-top: 32px; background: #ef4444; animation: bossBtn 1s ease 0.6s both; padding: 14px 48px; border: none; border-radius: 10px; color: white; font-size: 15px; font-weight: 600; cursor: pointer;" onclick="BroadcastListener.closeFullscreen('boss', this)">
                    Los geht's!
                </button>
            `;
            
            document.body.appendChild(overlay);
        },
        
        // ============ LOOT DROP ============
        showLootDrop(broadcast) {
            // Persist to survive refresh
            this.persistBroadcast('loot', broadcast);
            
            // Play sound only if enabled and not restored
            if (!broadcast._restored && broadcast.sound && broadcast.sound !== 'none') {
                this.playBroadcastSound('coin');
            }
            
            // Remove existing
            document.querySelectorAll('.loot-overlay').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay loot-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: rgba(0,0,0,0.9); display: flex;
                align-items: center; justify-content: center;
                animation: fadeIn 0.3s ease;
            `;
            
            const items = broadcast.items || [];
            const itemsHtml = items.map((item, i) => `
                <div style="
                    padding: 12px 20px; background: rgba(255,255,255,0.1);
                    border-radius: 8px; margin: 6px 0;
                    animation: lootItem 0.5s ease ${i * 0.1}s both;
                    border-left: 3px solid #f59e0b;
                ">
                    <span style="color: #f59e0b; margin-right: 8px;">✦</span>
                    ${this.escapeHtml(item)}
                </div>
            `).join('');
            
            const goldHtml = broadcast.gold > 0 ? `
                <div style="
                    margin-top: ${items.length > 0 ? '16px' : '0'}; padding: 16px 24px;
                    background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,179,8,0.2));
                    border-radius: 12px; border: 2px solid #f59e0b;
                    animation: lootItem 0.5s ease ${items.length * 0.1}s both;
                ">
                    <span style="font-size: 24px;">${broadcast.currencyIcon || '🪙'}</span>
                    <span style="font-size: 28px; font-weight: 700; color: #f59e0b; margin-left: 12px;">${broadcast.gold} ${broadcast.currencyName || 'Gold'}</span>
                </div>
            ` : '';
            
            overlay.innerHTML = `
                <div style="text-align: center; max-width: 400px;">
                    <div style="font-size: 48px; margin-bottom: 16px; animation: lootChest 1s ease;">💰</div>
                    <h2 style="font-size: 28px; color: white; margin: 0 0 24px;">Ihr habt gefunden:</h2>
                    <div style="text-align: left;">
                        ${itemsHtml}
                        ${goldHtml}
                    </div>
                    <button class="broadcast-modal__btn" style="margin-top: 24px; background: #f59e0b;" onclick="BroadcastListener.closeFullscreen('loot', this)">
                        Einsammeln
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
        },
        
        // ============ LEVEL UP ============
        showLevelUp(broadcast) {
            // Persist to survive refresh
            this.persistBroadcast('levelup', broadcast);
            
            if (!broadcast._restored) {
                this.playBroadcastSound('fanfare');
            }
            
            // Remove existing
            document.querySelectorAll('.levelup-overlay').forEach(el => el.remove());
            
            const uid = window.firebase?.auth?.()?.currentUser?.uid;
            const isTarget = broadcast.targetId === uid;
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay levelup-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,179,8,0.1));
                display: flex; align-items: center; justify-content: center;
                animation: fadeIn 0.3s ease;
            `;
            
            // Add confetti
            let confetti = '';
            for (let i = 0; i < 50; i++) {
                const left = Math.random() * 100;
                const delay = Math.random() * 2;
                const duration = 2 + Math.random() * 2;
                const color = ['#f59e0b', '#eab308', '#fbbf24', '#fcd34d', '#fef3c7'][Math.floor(Math.random() * 5)];
                confetti += `<div style="
                    position: absolute; top: -20px; left: ${left}%;
                    width: 10px; height: 10px; background: ${color};
                    animation: confettiFall ${duration}s ease ${delay}s infinite;
                "></div>`;
            }
            
            overlay.innerHTML = `
                <div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none;">${confetti}</div>
                <div style="text-align: center; z-index: 1;">
                    <div style="font-size: 80px; animation: levelUpBounce 0.5s ease;">🎉</div>
                    <h1 style="font-size: 48px; color: #f59e0b; margin: 16px 0; animation: levelUpTitle 1s ease; text-shadow: 0 0 40px rgba(245,158,11,0.5);">LEVEL UP!</h1>
                    <p style="font-size: 24px; color: white; margin: 0;">
                        ${isTarget ? 'Du erreichst' : `${this.escapeHtml(broadcast.targetName)} erreicht`}
                    </p>
                    <div style="font-size: 72px; font-weight: 900; color: white; margin: 16px 0; animation: levelNumber 1s ease 0.3s both;">
                        Level ${broadcast.level}
                    </div>
                    <button class="broadcast-modal__btn" style="background: #f59e0b;" onclick="BroadcastListener.closeFullscreen('levelup', this)">
                        🎊 Großartig!
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
        },
        
        // ============ DEATH SCREEN ============
        showDeathScreen(broadcast) {
            // Persist to survive refresh
            this.persistBroadcast('death', broadcast);
            
            if (!broadcast._restored) {
                this.playBroadcastSound('dramatic');
            }
            
            // Remove existing
            document.querySelectorAll('.death-overlay').forEach(el => el.remove());
            
            const uid = window.firebase?.auth?.()?.currentUser?.uid;
            const isTarget = broadcast.targetId === uid;
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay death-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: #000; display: flex;
                align-items: center; justify-content: center;
                animation: deathFadeIn 2s ease;
            `;
            
            overlay.innerHTML = `
                <div style="text-align: center; animation: deathContent 2s ease;">
                    <div style="font-size: 120px; opacity: 0.8; animation: deathSkull 3s ease-in-out infinite;">💀</div>
                    <h1 style="font-size: 48px; color: #ef4444; margin: 24px 0; font-weight: 300; letter-spacing: 8px; text-transform: uppercase;">
                        ${isTarget ? 'Du bist gefallen' : `${this.escapeHtml(broadcast.targetName)}`}
                    </h1>
                    ${!isTarget ? '<p style="font-size: 24px; color: rgba(255,255,255,0.5); margin: 0;">ist gefallen</p>' : ''}
                    ${broadcast.message ? `<p style="font-size: 18px; color: rgba(255,255,255,0.4); margin-top: 24px; font-style: italic;">"${this.escapeHtml(broadcast.message)}"</p>` : ''}
                    <button class="broadcast-modal__btn" style="margin-top: 32px; background: #333;" onclick="BroadcastListener.closeFullscreen('death', this)">
                        Ruhe in Frieden
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
        },
        
        // ============ COIN FLIP ============
        showCoinFlip(broadcast) {
            // Persist to survive refresh (short duration)
            this.persistBroadcast('coinflip', broadcast);
            
            if (!broadcast._restored) {
                this.playBroadcastSound('coin');
            }
            
            // Remove existing
            document.querySelectorAll('.coinflip-overlay').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay coinflip-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: rgba(0,0,0,0.9); display: flex;
                align-items: center; justify-content: center;
                animation: fadeIn 0.3s ease;
            `;
            
            const isHeads = broadcast.result === 'heads';
            
            // 3D Coin with two sides
            overlay.innerHTML = `
                <div style="text-align: center;">
                    ${broadcast.question ? `<p style="font-size: 18px; color: rgba(255,255,255,0.6); margin-bottom: 24px;">${this.escapeHtml(broadcast.question)}</p>` : ''}
                    <div class="coin-container" style="perspective: 1000px; width: 150px; height: 150px; margin: 0 auto;">
                        <div class="coin-3d" style="
                            width: 100%; height: 100%;
                            position: relative;
                            transform-style: preserve-3d;
                            animation: coin3dFlip 1.5s ease-out forwards;
                            --final-rotation: ${isHeads ? '1800deg' : '1980deg'};
                        ">
                            <div style="
                                position: absolute; inset: 0;
                                background: linear-gradient(145deg, #fcd34d, #b45309);
                                border-radius: 50%;
                                display: flex; align-items: center; justify-content: center;
                                font-size: 60px; font-weight: bold; color: #78350f;
                                backface-visibility: hidden;
                                border: 6px solid #92400e;
                                box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
                            ">👑</div>
                            <div style="
                                position: absolute; inset: 0;
                                background: linear-gradient(145deg, #c4b5fd, #6d28d9);
                                border-radius: 50%;
                                display: flex; align-items: center; justify-content: center;
                                font-size: 48px; font-weight: bold; color: #4c1d95;
                                backface-visibility: hidden;
                                transform: rotateY(180deg);
                                border: 6px solid #5b21b6;
                                box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
                            ">42</div>
                        </div>
                    </div>
                    <h1 class="coin-result" style="font-size: 48px; color: ${isHeads ? '#f59e0b' : '#8b5cf6'}; margin: 24px 0; opacity: 0; animation: coinResultFade 0.5s ease 1.5s forwards;">
                        ${isHeads ? 'KOPF' : 'ZAHL'}
                    </h1>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Auto fade out after 5 seconds
            setTimeout(() => {
                this.clearPersistedBroadcast('coinflip');
                overlay.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => overlay.remove(), 500);
            }, 5000);
        },
        
        // ============ BREAK TIMER ============
        showBreakTimer(broadcast) {
            // Persist break to survive page refresh
            const remaining = broadcast.endTime - Date.now();
            if (remaining > 0) {
                this.persistBroadcast('break', broadcast);
            }
            
            // Remove existing break overlays
            document.querySelectorAll('.break-fullscreen-overlay').forEach(el => el.remove());
            document.querySelectorAll('.break-timer-overlay').forEach(el => el.remove());
            
            // Fullscreen blur overlay that blocks interaction
            const blurOverlay = document.createElement('div');
            blurOverlay.className = 'break-fullscreen-overlay';
            blurOverlay.style.cssText = `
                position: fixed; inset: 0; z-index: 99997;
                backdrop-filter: blur(10px);
                background: rgba(0,0,0,0.7);
                animation: fadeIn 0.5s ease;
            `;
            document.body.appendChild(blurOverlay);
            
            // Timer card on top
            const overlay = document.createElement('div');
            overlay.className = 'break-timer-overlay';
            overlay.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                z-index: 99998; background: rgba(20,20,20,0.98);
                padding: 40px 60px; border-radius: 24px; text-align: center;
                box-shadow: 0 20px 80px rgba(0,0,0,0.8);
                border: 2px solid rgba(139,92,246,0.3);
            `;
            
            overlay.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 16px;">☕</div>
                <h2 style="font-size: 24px; color: white; margin: 0 0 8px;">Pause</h2>
                <p style="color: rgba(255,255,255,0.5); margin: 0 0 16px;">Weiter geht's in</p>
                <div class="break-countdown" style="font-size: 64px; font-weight: 700; color: #8b5cf6; font-variant-numeric: tabular-nums;"></div>
            `;
            
            document.body.appendChild(overlay);
            
            const countdownEl = overlay.querySelector('.break-countdown');
            
            const updateCountdown = () => {
                if (!document.body.contains(overlay)) return; // Check if removed
                
                const remaining = Math.max(0, broadcast.endTime - Date.now());
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                
                if (remaining <= 0) {
                    countdownEl.textContent = 'Weiter geht\'s!';
                    countdownEl.style.color = '#22c55e';
                    overlay.style.borderColor = 'rgba(34,197,94,0.5)';
                    overlay.style.animation = 'breakPulse 1s ease infinite';
                    
                    // Clear persisted broadcast
                    this.clearPersistedBroadcast('break');
                    
                    // Auto-close after 10 seconds when done
                    setTimeout(() => {
                        blurOverlay.style.animation = 'fadeOut 0.5s ease forwards';
                        overlay.style.animation = 'fadeOut 0.5s ease forwards';
                        setTimeout(() => {
                            blurOverlay.remove();
                            overlay.remove();
                        }, 500);
                    }, 10000);
                    return;
                }
                
                countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                requestAnimationFrame(updateCountdown);
            };
            
            updateCountdown();
        },
        
        // End break early
        endBreak() {
            // Clear persisted break
            this.clearPersistedBroadcast('break');
            
            document.querySelectorAll('.break-fullscreen-overlay').forEach(el => {
                el.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => el.remove(), 500);
            });
            document.querySelectorAll('.break-timer-overlay').forEach(el => {
                el.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => el.remove(), 500);
            });
        },
        
        // Cancel timer
        cancelTimer() {
            document.querySelectorAll('.broadcast-timer-overlay').forEach(el => {
                el.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => el.remove(), 300);
            });
        },
        
        // ============ GLOBAL SOUND ============
        playGlobalSound(broadcast) {
            const soundType = broadcast.soundType || broadcast;
            this.playBroadcastSound(soundType);
        },
        
        // ============ TIME OF DAY ============
        showTimeOfDay(broadcast) {
            // Handle clear immediately without transition
            if (broadcast.timeType === 'clear') {
                document.querySelectorAll('.ambient-timeofday-overlay').forEach(el => el.remove());
                document.body.style.filter = '';
                return;
            }
            
            // 50% reduced intensity for subtle effect
            const configs = {
                dawn: {
                    gradient: 'linear-gradient(to bottom, rgba(251,191,36,0.1) 0%, rgba(249,115,22,0.075) 50%, rgba(0,0,0,0) 100%)',
                    icon: '🌅',
                    text: 'Morgengrauen'
                },
                noon: {
                    gradient: 'linear-gradient(to bottom, rgba(251,191,36,0.125) 0%, rgba(0,0,0,0) 60%)',
                    icon: '☀️',
                    text: 'Mittag'
                },
                dusk: {
                    gradient: 'linear-gradient(to bottom, rgba(249,115,22,0.1) 0%, rgba(220,38,38,0.075) 50%, rgba(0,0,0,0.05) 100%)',
                    icon: '🌆',
                    text: 'Abenddämmerung'
                },
                midnight: {
                    gradient: 'linear-gradient(to bottom, rgba(15,23,42,0.2) 0%, rgba(30,58,95,0.15) 50%, rgba(0,0,0,0.1) 100%)',
                    icon: '🌙',
                    text: 'Mitternacht'
                },
                flashback: {
                    gradient: 'none',
                    filter: 'sepia(0.3) contrast(1.05)',
                    icon: '📜',
                    text: 'Flashback'
                },
                vision: {
                    gradient: 'radial-gradient(ellipse at center, rgba(124,58,237,0.1) 0%, rgba(76,29,149,0.15) 100%)',
                    filter: 'blur(0.5px) saturate(1.15)',
                    icon: '👁️',
                    text: 'Vision'
                }
            };
            
            const config = configs[broadcast.timeType] || configs.noon;
            
            // Show transition overlay
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay timeofday-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: rgba(0,0,0,0.8); display: flex;
                align-items: center; justify-content: center;
                animation: fadeIn 0.5s ease;
            `;
            
            overlay.innerHTML = `
                <div style="text-align: center; animation: timeOfDayContent 1s ease;">
                    <div style="font-size: 80px;">${config.icon}</div>
                    <h1 style="font-size: 36px; color: white; margin-top: 16px; font-weight: 300;">${config.text}</h1>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Apply ambient effect
            setTimeout(() => {
                // Remove existing time overlay
                document.querySelectorAll('.ambient-timeofday-overlay').forEach(el => el.remove());
                
                if (broadcast.timeType !== 'clear') {
                    const ambientOverlay = document.createElement('div');
                    ambientOverlay.className = 'ambient-timeofday-overlay';
                    ambientOverlay.style.cssText = `
                        position: fixed; inset: 0; z-index: 9997;
                        pointer-events: none; transition: opacity 1s ease;
                        ${config.gradient !== 'none' ? `background: ${config.gradient};` : ''}
                    `;
                    
                    if (config.filter) {
                        // Apply filter to main content instead
                        document.body.style.filter = config.filter;
                    }
                    
                    document.body.appendChild(ambientOverlay);
                } else {
                    document.body.style.filter = '';
                }
                
                overlay.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => overlay.remove(), 500);
            }, 2000);
        },
        
        // Handle kick broadcast - redirect kicked player to login
        handleKick(broadcast) {
            const uid = firebase.auth().currentUser?.uid;
            if (broadcast.targetId === uid) {
                // This user was kicked!
                // Show a modal before redirecting
                const overlay = document.createElement('div');
                overlay.className = 'broadcast-overlay kick-overlay';
                overlay.style.cssText = `
                    position: fixed; inset: 0; z-index: 100000;
                    background: rgba(0,0,0,0.9); display: flex;
                    align-items: center; justify-content: center;
                `;
                overlay.innerHTML = `
                    <div style="text-align: center; padding: 40px; background: rgba(239,68,68,0.2); border: 2px solid #ef4444; border-radius: 16px; max-width: 400px;">
                        <div style="font-size: 64px; margin-bottom: 16px;">🚪</div>
                        <h2 style="color: #ef4444; font-size: 28px; margin-bottom: 12px;">Gekickt</h2>
                        <p style="color: #fca5a5; font-size: 16px; margin-bottom: 24px;">${broadcast.message || 'Du wurdest aus dem Raum entfernt.'}</p>
                        <p style="color: #999; font-size: 14px;">Du wirst in Kürze weitergeleitet...</p>
                    </div>
                `;
                document.body.appendChild(overlay);
                
                // Clear room data and redirect
                setTimeout(() => {
                    localStorage.removeItem('rift_current_room');
                    window.location.href = 'login.html';
                }, 3000);
            }
        },
        
        // Handle ban broadcast - redirect banned player to login
        handleBan(broadcast) {
            const uid = firebase.auth().currentUser?.uid;
            if (broadcast.targetId === uid) {
                // This user was banned!
                const overlay = document.createElement('div');
                overlay.className = 'broadcast-overlay ban-overlay';
                overlay.style.cssText = `
                    position: fixed; inset: 0; z-index: 100000;
                    background: rgba(0,0,0,0.9); display: flex;
                    align-items: center; justify-content: center;
                `;
                overlay.innerHTML = `
                    <div style="text-align: center; padding: 40px; background: rgba(220,38,38,0.2); border: 2px solid #dc2626; border-radius: 16px; max-width: 400px;">
                        <div style="font-size: 64px; margin-bottom: 16px;">⛔</div>
                        <h2 style="color: #dc2626; font-size: 28px; margin-bottom: 12px;">Gebannt</h2>
                        <p style="color: #fca5a5; font-size: 16px; margin-bottom: 24px;">${broadcast.message || 'Du wurdest aus dem Raum gebannt.'}</p>
                        <p style="color: #999; font-size: 14px;">Du wirst in Kürze weitergeleitet...</p>
                    </div>
                `;
                document.body.appendChild(overlay);
                
                // Clear room data and redirect
                setTimeout(() => {
                    localStorage.removeItem('rift_current_room');
                    window.location.href = 'login.html';
                }, 4000);
            }
        },
        
        // Handle pause broadcast - show blur overlay for paused players
        handlePause(broadcast) {
            const uid = firebase.auth().currentUser?.uid;
            // Check if this user is targeted (or all players if no specific target)
            if (!broadcast.targetId || broadcast.targetId === uid || broadcast.targetId === 'all') {
                // Remove existing pause overlay if any
                document.querySelectorAll('.pause-overlay').forEach(el => el.remove());
                
                const overlay = document.createElement('div');
                overlay.className = 'pause-overlay';
                overlay.style.cssText = `
                    position: fixed; inset: 0; z-index: 99999;
                    background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.3s ease;
                `;
                overlay.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <img src="https://cdn.pixabay.com/animation/2024/04/02/07/57/07-57-40-974_512.gif" style="width: 80px; height: 80px; margin-bottom: 16px;" alt="Pausiert">
                        <h2 style="color: white; font-size: 28px; margin-bottom: 12px;">Pausiert</h2>
                        <p style="color: #9ca3af; font-size: 16px;">${broadcast.message || 'Der Spielleiter hat das Spiel pausiert.'}</p>
                    </div>
                `;
                document.body.appendChild(overlay);
            }
        },
        
        // Handle unpause broadcast - remove blur overlay
        handleUnpause(broadcast) {
            const uid = firebase.auth().currentUser?.uid;
            if (!broadcast.targetId || broadcast.targetId === uid || broadcast.targetId === 'all') {
                document.querySelectorAll('.pause-overlay').forEach(el => {
                    el.style.animation = 'fadeOut 0.3s ease forwards';
                    setTimeout(() => el.remove(), 300);
                });
            }
        },
        
        // Custom sound playback
        currentCustomAudio: null,
        
        playCustomSound(broadcast) {
            // Stop any existing custom sound
            this.stopCustomSound();
            
            if (!broadcast.soundData) return;
            
            try {
                const audio = new Audio(broadcast.soundData);
                audio.volume = 0.7;
                audio.play().catch(e => console.warn('Custom sound play failed:', e));
                this.currentCustomAudio = audio;
                
                // Show playing indicator
                const indicator = document.createElement('div');
                indicator.className = 'custom-sound-indicator';
                indicator.style.cssText = `
                    position: fixed; bottom: 20px; right: 20px; z-index: 99998;
                    background: rgba(0,0,0,0.8); border-radius: 8px; padding: 12px 16px;
                    display: flex; align-items: center; gap: 8px;
                    animation: slideIn 0.3s ease;
                `;
                indicator.innerHTML = `
                    <span style="font-size: 16px;">🎵</span>
                    <span style="color: white; font-size: 13px;">${broadcast.fileName || 'Audio'}</span>
                `;
                document.body.appendChild(indicator);
                
                audio.onended = () => {
                    this.currentCustomAudio = null;
                    indicator.style.animation = 'fadeOut 0.3s ease forwards';
                    setTimeout(() => indicator.remove(), 300);
                };
            } catch (e) {
                console.error('Custom sound error:', e);
            }
        },
        
        stopCustomSound() {
            if (this.currentCustomAudio) {
                this.currentCustomAudio.pause();
                this.currentCustomAudio = null;
            }
            document.querySelectorAll('.custom-sound-indicator').forEach(el => el.remove());
        },
        
        // Sound player with different types
        playBroadcastSound(soundType) {
            if (!soundType || soundType === 'none') return;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const now = audioContext.currentTime;
                
                switch(soundType) {
                    case 'notification':
                        this.playSoundNotification(audioContext, now);
                        break;
                    case 'fanfare':
                        this.playSoundFanfare(audioContext, now);
                        break;
                    case 'dramatic':
                        this.playSoundDramatic(audioContext, now);
                        break;
                    case 'combat':
                        this.playSoundCombat(audioContext, now);
                        break;
                    case 'mystery':
                        this.playSoundMystery(audioContext, now);
                        break;
                    case 'coin':
                        this.playSoundCoin(audioContext, now);
                        break;
                    case 'doorCreak':
                        this.playSoundDoorCreak(audioContext, now);
                        break;
                    case 'thunder':
                        this.playSoundThunder(audioContext, now);
                        break;
                    case 'explosion':
                        this.playSoundExplosion(audioContext, now);
                        break;
                    case 'wolf':
                        this.playSoundWolf(audioContext, now);
                        break;
                    case 'swordClash':
                        this.playSoundSwordClash(audioContext, now);
                        break;
                    case 'magic':
                        this.playSoundMagic(audioContext, now);
                        break;
                    case 'heartbeat':
                        this.playSoundHeartbeat(audioContext, now);
                        break;
                    case 'laugh':
                        this.playSoundLaugh(audioContext, now);
                        break;
                    case 'glass':
                        this.playSoundGlass(audioContext, now);
                        break;
                    case 'chains':
                        this.playSoundChains(audioContext, now);
                        break;
                    case 'whisper':
                        this.playSoundWhisper(audioContext, now);
                        break;
                    default:
                        this.playSoundNotification(audioContext, now);
                }
            } catch (e) {
                console.warn('[Broadcast] Sound failed:', e);
            }
        },
        
        // Standard notification - cheerful ding
        playSoundNotification(ctx, now) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.setValueAtTime(587, now);      // D5
            osc.frequency.setValueAtTime(880, now + 0.1); // A5
            osc.frequency.setValueAtTime(1175, now + 0.2); // D6
            
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            osc.start(now);
            osc.stop(now + 0.5);
        },
        
        // Fanfare - triumphant
        playSoundFanfare(ctx, now) {
            const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.setValueAtTime(freq, now + i * 0.15);
                gain.gain.setValueAtTime(0, now + i * 0.15);
                gain.gain.linearRampToValueAtTime(0.25, now + i * 0.15 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
                
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.5);
            });
        },
        
        // Dramatic - deep suspenseful
        playSoundDramatic(ctx, now) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.setValueAtTime(110, now);  // Low A
            osc.frequency.exponentialRampToValueAtTime(55, now + 1); // Even lower
            
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
            
            osc.start(now);
            osc.stop(now + 1.2);
        },
        
        // Combat - aggressive impact
        playSoundCombat(ctx, now) {
            // Impact hit
            const noise = ctx.createOscillator();
            const noiseGain = ctx.createGain();
            noise.type = 'square';
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            
            noise.frequency.setValueAtTime(150, now);
            noise.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            
            noiseGain.gain.setValueAtTime(0.4, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            
            noise.start(now);
            noise.stop(now + 0.2);
            
            // Rising tension
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.setValueAtTime(220, now + 0.1);
            osc.frequency.linearRampToValueAtTime(440, now + 0.4);
            
            gain.gain.setValueAtTime(0.15, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            osc.start(now + 0.1);
            osc.stop(now + 0.5);
        },
        
        // Mystery - ethereal
        playSoundMystery(ctx, now) {
            const notes = [330, 392, 494]; // E4, G4, B4 (Em chord)
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.frequency.setValueAtTime(freq, now);
                osc.frequency.linearRampToValueAtTime(freq * 1.02, now + 1); // Slight detune
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.12, now + 0.3);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.8);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                
                osc.start(now);
                osc.stop(now + 1.5);
            });
        },
        
        // Coin sound - jingling
        playSoundCoin(ctx, now) {
            [4000, 5000, 6000, 4500].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(freq, now + i * 0.05);
                gain.gain.setValueAtTime(0.15, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3 + i * 0.05);
                osc.start(now + i * 0.05);
                osc.stop(now + 0.4 + i * 0.05);
            });
        },
        
        // Door creak - low frequency sweep
        playSoundDoorCreak(ctx, now) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.5);
            osc.frequency.linearRampToValueAtTime(60, now + 1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
            osc.start(now);
            osc.stop(now + 1);
        },
        
        // Thunder - low rumble with noise
        playSoundThunder(ctx, now) {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.5));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, now);
            const gain = ctx.createGain();
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
            noise.start(now);
            noise.stop(now + 2);
        },
        
        // Explosion - noise burst
        playSoundExplosion(ctx, now) {
            const bufferSize = ctx.sampleRate;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.15));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const gain = ctx.createGain();
            noise.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
            noise.start(now);
            noise.stop(now + 1);
        },
        
        // Wolf howl - rising tone
        playSoundWolf(ctx, now) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(400, now + 0.5);
            osc.frequency.linearRampToValueAtTime(350, now + 1.5);
            osc.frequency.linearRampToValueAtTime(200, now + 2);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.3);
            gain.gain.linearRampToValueAtTime(0.15, now + 1.5);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
            osc.start(now);
            osc.stop(now + 2);
        },
        
        // Sword clash - metallic ring
        playSoundSwordClash(ctx, now) {
            [2000, 3000, 4000, 2500].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            });
        },
        
        // Magic - sparkly ascending
        playSoundMagic(ctx, now) {
            [523, 659, 784, 1047, 1319].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                gain.gain.setValueAtTime(0.15, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5 + i * 0.1);
                osc.start(now + i * 0.1);
                osc.stop(now + 0.6 + i * 0.1);
            });
        },
        
        // Heartbeat - two low thuds
        playSoundHeartbeat(ctx, now) {
            [0, 0.15, 0.8, 0.95].forEach((t, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(i % 2 === 0 ? 60 : 50, now + t);
                gain.gain.setValueAtTime(0.3, now + t);
                gain.gain.exponentialRampToValueAtTime(0.01, now + t + 0.1);
                osc.start(now + t);
                osc.stop(now + t + 0.15);
            });
        },
        
        // Evil laugh - descending
        playSoundLaugh(ctx, now) {
            [400, 350, 300, 400, 350, 300, 250].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(freq, now + i * 0.15);
                gain.gain.setValueAtTime(0.08, now + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.12);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.15);
            });
        },
        
        // Glass breaking
        playSoundGlass(ctx, now) {
            const bufferSize = ctx.sampleRate * 0.5;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(3000, now);
            const gain = ctx.createGain();
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            noise.start(now);
            noise.stop(now + 0.5);
        },
        
        // Chains rattling
        playSoundChains(ctx, now) {
            for (let i = 0; i < 8; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(1000 + Math.random() * 2000, now + i * 0.08);
                gain.gain.setValueAtTime(0.1, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.06);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.08);
            }
        },
        
        // Whisper - filtered noise
        playSoundWhisper(ctx, now) {
            const bufferSize = ctx.sampleRate * 1.5;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.3;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2000, now);
            filter.Q.setValueAtTime(5, now);
            const gain = ctx.createGain();
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
            gain.gain.linearRampToValueAtTime(0.1, now + 1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
            noise.start(now);
            noise.stop(now + 1.5);
        },
        
        closeBroadcast(btn) {
            const overlay = btn.closest('.broadcast-overlay');
            overlay.classList.remove('broadcast-overlay--visible');
            setTimeout(() => overlay.remove(), 300);
        },
        
        showPoll(poll, pollId, roomCode) {
            // Create poll overlay
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay poll-overlay';
            overlay.id = 'poll-overlay-' + pollId;
            
            const isMultiSelect = poll.multiSelect === true;
            
            // Build options HTML with emojis
            const optionsHtml = (poll.options || []).map((opt, i) => {
                const emoji = poll.emojis?.[i] || '';
                const label = emoji ? `${emoji} ${this.escapeHtml(opt)}` : this.escapeHtml(opt);
                const dataAttr = `data-option="${this.escapeHtml(opt)}"`;
                if (isMultiSelect) {
                    return `<button class="poll-option-btn poll-option-multi" ${dataAttr} onclick="BroadcastListener.togglePollOption(this)">${label}</button>`;
                } else {
                    return `<button class="poll-option-btn" onclick="BroadcastListener.votePoll('${this.escapeHtml(opt)}', '${pollId}', '${roomCode}', this)">${label}</button>`;
                }
            }).join('');
            
            // Build image HTML if present
            const imageHtml = poll.image ? `<img src="${poll.image}" alt="Poll" style="width:100%; border-radius:10px; margin-bottom:16px;">` : '';
            
            // Countdown HTML
            const countdownHtml = poll.countdown ? `
                <div class="poll-countdown" id="poll-countdown-${pollId}" style="text-align: center; margin-bottom: 16px;">
                    <span style="font-size: 28px; font-weight: 700; color: #a78bfa;" id="poll-timer-${pollId}">${poll.countdown}</span>
                    <span style="color: rgba(255,255,255,0.5); font-size: 14px;"> Sekunden</span>
                </div>
            ` : '';
            
            // Multi-select submit button
            const submitBtn = isMultiSelect ? `
                <button class="broadcast-modal__btn" style="background: #8b5cf6; margin-bottom: 8px;" onclick="BroadcastListener.submitMultiVote('${pollId}', '${roomCode}', this)">
                    Abstimmen
                </button>
            ` : '';
            
            overlay.innerHTML = `
                <div class="broadcast-modal poll-modal">
                    <div class="broadcast-modal__header" style="justify-content: center;">
                        <div class="broadcast-modal__icon" style="background:rgba(139,92,246,0.15)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#a78bfa">
                                <path d="M18 20V10M12 20V4M6 20v-6"/>
                            </svg>
                        </div>
                        <span class="broadcast-modal__badge" style="color:#a78bfa;">Umfrage${isMultiSelect ? ' (Mehrfach)' : ''}</span>
                    </div>
                    <div class="broadcast-modal__content" style="text-align: center;">
                        ${countdownHtml}
                        ${imageHtml}
                        <p class="broadcast-modal__message" style="font-size:18px;font-weight:600;margin-bottom:16px;">${this.escapeHtml(poll.question)}</p>
                        <div class="poll-options-list" id="poll-options-${pollId}">
                            ${optionsHtml}
                        </div>
                    </div>
                    ${submitBtn}
                    <button class="poll-skip-btn" onclick="BroadcastListener.skipPoll('${pollId}', this)">
                        Überspringen
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.classList.add('broadcast-overlay--visible');
            });
            
            // Start countdown timer if present
            if (poll.countdown) {
                this.startPollCountdown(pollId, poll.countdown);
            }
            
            // Play sound only if enabled in poll settings
            if (poll.withSound !== false) {
                this.playSound();
            }
        },
        
        // Toggle option for multi-select polls
        togglePollOption(btn) {
            btn.classList.toggle('selected');
        },
        
        // Submit multiple votes
        async submitMultiVote(pollId, roomCode, btn) {
            const selectedBtns = document.querySelectorAll(`#poll-options-${pollId} .poll-option-multi.selected`);
            if (selectedBtns.length === 0) {
                return; // No selection
            }
            
            const options = Array.from(selectedBtns).map(b => b.dataset.option);
            
            try {
                const db = window.RIFT?.firebase?.getFirestore?.() || window.firebase?.firestore?.();
                if (!db) return;
                
                const uid = window.firebase?.auth?.()?.currentUser?.uid;
                if (!uid) return;
                
                await db.collection('rooms').doc(roomCode).collection('poll_votes').doc(uid).set({
                    options: options,
                    pollId: pollId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                localStorage.setItem('rift_poll_voted_' + pollId, 'true');
                
                const overlay = btn.closest('.broadcast-overlay');
                overlay.classList.remove('broadcast-overlay--visible');
                setTimeout(() => overlay.remove(), 300);
                
            } catch (e) {
                console.error('[Poll] Multi vote failed:', e);
            }
        },
        
        // Countdown timer for polls
        pollTimers: {},
        startPollCountdown(pollId, seconds) {
            let remaining = seconds;
            const timerEl = document.getElementById('poll-timer-' + pollId);
            
            this.pollTimers[pollId] = setInterval(() => {
                remaining--;
                if (timerEl) timerEl.textContent = remaining;
                
                if (remaining <= 0) {
                    clearInterval(this.pollTimers[pollId]);
                    // Auto-close poll overlay when time runs out
                    const overlay = document.getElementById('poll-overlay-' + pollId);
                    if (overlay) {
                        overlay.classList.remove('broadcast-overlay--visible');
                        setTimeout(() => overlay.remove(), 300);
                    }
                }
            }, 1000);
        },
        
        async votePoll(option, pollId, roomCode, btn) {
            try {
                const db = window.RIFT?.firebase?.getFirestore?.() || window.firebase?.firestore?.();
                if (!db) return;
                
                const uid = window.firebase?.auth?.()?.currentUser?.uid;
                if (!uid) {
                    console.error('[Poll] No user logged in');
                    return;
                }
                
                // Write vote to subcollection instead of updating room doc
                await db.collection('rooms').doc(roomCode).collection('poll_votes').doc(uid).set({
                    option: option,
                    pollId: pollId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Mark as voted locally
                localStorage.setItem('rift_poll_voted_' + pollId, 'true');
                
                // Close overlay
                const overlay = btn.closest('.broadcast-overlay');
                overlay.classList.remove('broadcast-overlay--visible');
                setTimeout(() => overlay.remove(), 300);
                
                console.log('[Poll] Vote submitted:', option);
                
            } catch (e) {
                console.error('[Poll] Vote failed:', e);
                // Still mark as voted to prevent spam
                localStorage.setItem('rift_poll_voted_' + pollId, 'error');
                const overlay = btn.closest('.broadcast-overlay');
                overlay.classList.remove('broadcast-overlay--visible');
                setTimeout(() => overlay.remove(), 300);
            }
        },
        
        skipPoll(pollId, btn) {
            localStorage.setItem('rift_poll_voted_' + pollId, 'skipped');
            const overlay = btn.closest('.broadcast-overlay');
            overlay.classList.remove('broadcast-overlay--visible');
            setTimeout(() => overlay.remove(), 300);
        },
        
        showPollResults(poll) {
            // Build results HTML
            const results = poll.results || [];
            const totalVotes = poll.totalVotes || 0;
            
            const resultsHtml = results.map(r => {
                const pct = totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0;
                const label = r.emoji ? `${r.emoji} ${this.escapeHtml(r.option)}` : this.escapeHtml(r.option);
                const winnerClass = r.isWinner ? 'poll-result-bar--winner' : '';
                return `
                    <div class="poll-result-item">
                        <div class="poll-result-info">
                            <span class="poll-result-label">${label}</span>
                            <span class="poll-result-count">${r.votes} Stimme${r.votes !== 1 ? 'n' : ''}</span>
                        </div>
                        <div class="poll-result-bar">
                            <div class="poll-result-fill ${winnerClass}" style="width:${pct}%"></div>
                            <span class="poll-result-pct">${pct}%</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Build image HTML if present
            const imageHtml = poll.image ? `<img src="${poll.image}" alt="Poll" style="width:100%; border-radius:10px; margin-bottom:16px;">` : '';
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay poll-result-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal poll-result-modal">
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon" style="background:rgba(34,197,94,0.15)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#22c55e">
                                <path d="M12 15l-3-3m0 0l3-3m-3 3h12M19 12a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </div>
                        <span class="broadcast-modal__badge" style="color:#22c55e">Umfrage-Ergebnis</span>
                    </div>
                    <div class="broadcast-modal__content">
                        ${imageHtml}
                        <p class="broadcast-modal__message" style="font-size:18px;font-weight:600;margin-bottom:16px;">${this.escapeHtml(poll.question)}</p>
                        <div class="poll-results-list">
                            ${resultsHtml}
                        </div>
                        <p style="text-align:center;color:rgba(255,255,255,0.4);font-size:12px;margin-top:12px;">
                            ${totalVotes} Stimme${totalVotes !== 1 ? 'n' : ''} insgesamt
                        </p>
                    </div>
                    <button class="broadcast-modal__btn" onclick="BroadcastListener.closePollResults(this)">
                        OK
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.classList.add('broadcast-overlay--visible');
            });
            
            // Play sound
            if (poll.withSound !== false) {
                this.playSound();
            }
        },
        
        closePollResults(btn) {
            const overlay = btn.closest('.broadcast-overlay');
            overlay.classList.remove('broadcast-overlay--visible');
            setTimeout(() => overlay.remove(), 300);
        },
        
        playSound() {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create a pleasant notification sound
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.1); // A5
                oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 0.2); // D6
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.warn('[Broadcast] Sound failed:', e);
            }
        },
        
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML.replace(/\n/g, '<br>');
        },
        
        cleanup() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        }
    };
    
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .broadcast-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0);
            backdrop-filter: blur(0px);
            transition: all 0.3s ease;
            padding: 20px;
        }
        
        .broadcast-overlay--visible {
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
        }
        
        .broadcast-modal {
            width: 100%;
            max-width: 400px;
            background: linear-gradient(145deg, #1a1a1a, #0d0d0d);
            border: 1px solid rgba(255, 70, 85, 0.3);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 0 60px rgba(255, 70, 85, 0.2);
            transform: scale(0.9) translateY(20px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .broadcast-overlay--visible .broadcast-modal {
            transform: scale(1) translateY(0);
            opacity: 1;
        }
        
        .broadcast-modal__header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }
        
        .broadcast-modal__icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 70, 85, 0.15);
            border-radius: 10px;
        }
        
        .broadcast-modal__icon svg {
            width: 24px;
            height: 24px;
            color: #ff4655;
        }
        
        .broadcast-modal__badge {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #ff4655;
        }
        
        .broadcast-modal__content {
            margin-bottom: 24px;
        }
        
        .broadcast-modal__message {
            font-size: 16px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.9);
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
        }
        
        .broadcast-modal__btn {
            width: 100%;
            padding: 14px 24px;
            background: #ff4655;
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .broadcast-modal__btn:hover {
            background: #ff5a67;
            transform: translateY(-1px);
        }
        
        .broadcast-modal__btn:active {
            transform: translateY(0);
        }
        
        /* Poll Styles */
        .poll-options-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .poll-option-btn {
            width: 100%;
            padding: 14px 20px;
            background: rgba(139, 92, 246, 0.15);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 10px;
            color: white;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
        }
        
        .poll-option-btn:hover {
            background: rgba(139, 92, 246, 0.3);
            border-color: rgba(139, 92, 246, 0.5);
            transform: translateY(-2px);
        }
        
        .poll-option-btn:active {
            transform: translateY(0);
        }
        
        .poll-option-multi.selected {
            background: rgba(139, 92, 246, 0.5);
            border-color: #8b5cf6;
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
        }
        
        .poll-skip-btn {
            width: 100%;
            margin-top: 16px;
            padding: 12px;
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 13px;
            cursor: pointer;
            transition: color 0.2s;
        }
        
        .poll-skip-btn:hover {
            color: rgba(255, 255, 255, 0.8);
        }
        
        /* Poll Results Styles */
        .poll-result-modal {
            border-color: rgba(34, 197, 94, 0.3);
            box-shadow: 0 0 60px rgba(34, 197, 94, 0.2);
        }
        
        .poll-results-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        
        .poll-result-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        
        .poll-result-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .poll-result-label {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.9);
        }
        
        .poll-result-count {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.5);
        }
        
        .poll-result-bar {
            height: 28px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            overflow: hidden;
            position: relative;
        }
        
        .poll-result-fill {
            height: 100%;
            background: linear-gradient(90deg, #8b5cf6, #a78bfa);
            transition: width 0.5s ease;
        }
        
        .poll-result-fill.poll-result-bar--winner {
            background: linear-gradient(90deg, #22c55e, #4ade80);
        }
        
        .poll-result-pct {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 13px;
            font-weight: 600;
            color: white;
        }
        
        /* Spotlight Styles */
        .spotlight-modal {
            text-align: center;
            padding: 48px;
            position: relative;
            background: linear-gradient(145deg, #1a1a1a, #0d0d0d);
            border-radius: 20px;
            max-width: 400px;
            width: 90%;
        }
        
        .spotlight-modal--target {
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #8b5cf6;
            box-shadow: 0 0 100px rgba(139,92,246,0.5);
            border-radius: 20px;
            overflow: hidden;
        }
        
        .spotlight-modal--other {
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
        }
        
        .spotlight-content {
            position: relative;
            z-index: 1;
        }
        
        .spotlight-icon {
            font-size: 64px;
            margin-bottom: 16px;
            animation: spotlightBounce 1s ease;
        }
        
        .spotlight-title {
            font-size: 28px;
            font-weight: 700;
            color: white;
            margin: 0 0 8px 0;
        }
        
        .spotlight-subtitle {
            font-size: 16px;
            color: rgba(255,255,255,0.6);
            margin: 0;
        }
        
        /* Cinematic Animations */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        @keyframes sceneTextIn {
            0% { opacity: 0; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        /* Slide scene transitions */
        @keyframes sceneSlideIn {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
        }
        
        @keyframes sceneSlideOut {
            from { transform: translateX(0); }
            to { transform: translateX(100%); }
        }
        
        @keyframes sceneTextSlide {
            0% { opacity: 0; transform: translateX(-50px); }
            30% { opacity: 1; transform: translateX(0); }
            70% { opacity: 1; transform: translateX(0); }
            100% { opacity: 1; transform: translateX(0); }
        }
        
        /* Zoom scene transitions */
        @keyframes sceneZoomIn {
            from { transform: scale(0); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        
        @keyframes sceneZoomOut {
            from { transform: scale(1); opacity: 1; }
            to { transform: scale(2); opacity: 0; }
        }
        
        @keyframes sceneTextZoom {
            0% { opacity: 0; transform: scale(3); }
            40% { opacity: 1; transform: scale(1); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        /* Blur scene transitions */
        @keyframes sceneBlurIn {
            from { opacity: 0; filter: blur(30px); }
            to { opacity: 1; filter: blur(0); }
        }
        
        @keyframes sceneBlurOut {
            from { opacity: 1; filter: blur(0); }
            to { opacity: 0; filter: blur(30px); }
        }
        
        @keyframes sceneTextBlur {
            0% { opacity: 0; filter: blur(20px); transform: scale(1.2); }
            40% { opacity: 1; filter: blur(0); transform: scale(1); }
            100% { opacity: 1; filter: blur(0); transform: scale(1); }
        }
        
        /* Glitch scene transitions */
        @keyframes sceneGlitchIn {
            0% { opacity: 0; transform: translateX(-10px); }
            10% { opacity: 1; transform: translateX(5px); }
            20% { transform: translateX(-5px); }
            30% { transform: translateX(3px); }
            40% { transform: translateX(-3px); }
            50% { transform: translateX(2px); }
            100% { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes sceneGlitchOut {
            0% { opacity: 1; transform: translateX(0); }
            50% { transform: translateX(5px); }
            60% { transform: translateX(-8px); }
            70% { transform: translateX(10px); }
            80% { opacity: 0.5; transform: translateX(-5px); }
            100% { opacity: 0; transform: translateX(20px); }
        }
        
        @keyframes sceneTextGlitch {
            0% { opacity: 0; transform: skewX(-20deg); }
            20% { opacity: 1; transform: skewX(10deg); }
            40% { transform: skewX(-5deg); }
            60% { transform: skewX(2deg); }
            100% { opacity: 1; transform: skewX(0); }
        }
        
        @keyframes glitchLine {
            0% { top: 0%; }
            50% { top: 50%; }
            100% { top: 100%; }
        }
        
        /* Curtain scene transitions */
        @keyframes sceneCurtainIn {
            0% { clip-path: inset(50% 0 50% 0); }
            100% { clip-path: inset(0 0 0 0); }
        }
        
        @keyframes sceneCurtainOut {
            0% { clip-path: inset(0 0 0 0); }
            100% { clip-path: inset(0 50% 0 50%); }
        }
        
        @keyframes sceneTextCurtain {
            0% { opacity: 0; letter-spacing: 20px; }
            40% { opacity: 1; letter-spacing: 2px; }
            100% { opacity: 1; letter-spacing: 2px; }
        }
        
        @keyframes revealTitle {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes revealImage {
            0% { opacity: 0; transform: scale(0.5); }
            70% { transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes combatFlash {
            0% { background: #fff; }
            100% { background: linear-gradient(135deg, #1a0a0a, #2d1b1b); }
        }
        
        @keyframes combatTitle {
            0% { opacity: 0; transform: scale(2) rotate(-5deg); }
            50% { transform: scale(0.9) rotate(2deg); }
            100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        
        @keyframes combatBtn {
            0% { opacity: 0; transform: translateY(30px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes combatPulse {
            0%, 100% { text-shadow: 0 0 60px rgba(239,68,68,0.8); }
            50% { text-shadow: 0 0 100px rgba(239,68,68,1), 0 0 150px rgba(239,68,68,0.6); }
        }
        
        @keyframes ambientPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @keyframes reactionPop {
            0% { opacity: 0; transform: scale(0.3); }
            50% { opacity: 1; transform: scale(1.2); }
            100% { opacity: 0; transform: scale(1.5) translateY(-50px); }
        }
        
        @keyframes spotlightPulse {
            0%, 100% { opacity: 0.3; transform: translateX(-50%) scale(1); }
            50% { opacity: 0.6; transform: translateX(-50%) scale(1.2); }
        }
        
        @keyframes spotlightBounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
        
        /* Ambient effect animations */
        @keyframes rainDrop {
            0% { top: -20px; opacity: 1; }
            100% { top: 100vh; opacity: 0.3; }
        }
        
        @keyframes snowDrop {
            0% { top: -20px; opacity: 1; transform: translateX(0); }
            50% { transform: translateX(20px); }
            100% { top: 100vh; opacity: 0.3; transform: translateX(-10px); }
        }
        
        @keyframes sparkleFade {
            0%, 100% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes bubbleRise {
            0% { bottom: -20px; opacity: 0.8; transform: translateX(0); }
            50% { transform: translateX(10px); }
            100% { bottom: 100vh; opacity: 0; transform: translateX(-5px); }
        }
        
        @keyframes lightningFlash {
            0% { opacity: 0.8; }
            50% { opacity: 0.2; }
            100% { opacity: 0; }
        }
        
        @keyframes emberRise {
            0% { bottom: -10px; opacity: 1; transform: translateX(0); }
            50% { opacity: 0.8; transform: translateX(10px); }
            100% { bottom: 60vh; opacity: 0; transform: translateX(-5px); }
        }
        
        @keyframes fogFloat {
            0% { transform: translateX(-20px); opacity: 0.2; }
            50% { transform: translateX(20px); opacity: 0.4; }
            100% { transform: translateX(-20px); opacity: 0.2; }
        }
        
        @keyframes dustFloat {
            0% { transform: translate(0, 0); opacity: 0.3; }
            25% { transform: translate(5px, -5px); opacity: 0.5; }
            50% { transform: translate(0, -10px); opacity: 0.3; }
            75% { transform: translate(-5px, -5px); opacity: 0.5; }
            100% { transform: translate(0, 0); opacity: 0.3; }
        }
        
        @keyframes bloodDrip {
            0% { top: -10px; opacity: 0.8; }
            100% { top: 100vh; opacity: 0.2; }
        }
        
        @keyframes smokeRise {
            0% { bottom: -20px; opacity: 0.5; transform: scale(0.5) translateX(0); }
            50% { opacity: 0.3; transform: scale(1) translateX(15px); }
            100% { bottom: 70vh; opacity: 0; transform: scale(1.5) translateX(-10px); }
        }
        
        @keyframes fogDrift {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.5; }
        }
        
        @keyframes fireGlow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.5; }
        }
        
        /* New ambient effect animations */
        @keyframes seaSway {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-5px) rotate(0.5deg); }
            50% { transform: translateY(0) rotate(0deg); }
            75% { transform: translateY(5px) rotate(-0.5deg); }
        }
        
        @keyframes waveMove {
            0%, 100% { transform: translateX(-5%) scaleY(1); }
            50% { transform: translateX(5%) scaleY(1.2); }
        }
        
        @keyframes leafFall {
            0% { top: -20px; opacity: 0.8; transform: rotate(45deg) translateX(0); }
            25% { transform: rotate(90deg) translateX(30px); }
            50% { transform: rotate(135deg) translateX(-20px); }
            75% { transform: rotate(180deg) translateX(20px); }
            100% { top: 100vh; opacity: 0.3; transform: rotate(225deg) translateX(-10px); }
        }
        
        @keyframes sandDrift {
            0% { transform: translateX(0); opacity: 0.5; }
            50% { transform: translateX(20px); opacity: 0.3; }
            100% { transform: translateX(40px); opacity: 0.5; }
        }
        
        @keyframes heatShimmer {
            0%, 100% { filter: blur(0px); }
            50% { filter: blur(1px); }
        }
        
        @keyframes starTwinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.3); }
        }
        
        @keyframes ashFall {
            0% { top: -20px; opacity: 0.6; transform: translateX(0) rotate(0deg); }
            50% { transform: translateX(15px) rotate(180deg); }
            100% { top: 100vh; opacity: 0.2; transform: translateX(-10px) rotate(360deg); }
        }
        
        /* Seafoam animations */
        @keyframes foamMove {
            0%, 100% { transform: translateX(-5%) scaleX(1); opacity: 0.3; }
            50% { transform: translateX(10%) scaleX(1.1); opacity: 0.5; }
        }
        
        @keyframes foamBob {
            0%, 100% { transform: translateY(0) translateX(0); }
            25% { transform: translateY(-5px) translateX(3px); }
            50% { transform: translateY(0) translateX(6px); }
            75% { transform: translateY(5px) translateX(3px); }
        }
        
        /* Cave drip animations */
        @keyframes caveDrip {
            0% { top: -10px; opacity: 0.8; }
            100% { top: 95vh; opacity: 0.3; }
        }
        
        @keyframes caveSplash {
            0%, 70% { transform: scale(0); opacity: 0; }
            75% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(2); opacity: 0; }
        }
        
        /* Sea effect animations */
        @keyframes seaBubbleRise {
            0% { bottom: 0; opacity: 0.7; transform: translateX(0); }
            50% { transform: translateX(10px); }
            100% { bottom: 35%; opacity: 0; transform: translateX(-5px); }
        }
        
        @keyframes sunrayPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.8; }
        }
        
        /* Sandstorm animation */
        @keyframes sandstormBlow {
            0% { right: -20px; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { right: 110%; opacity: 0; }
        }
        
        /* Aurora animation */
        @keyframes auroraWave {
            0% { transform: skewX(-10deg) scaleY(0.8); opacity: 0.3; }
            100% { transform: skewX(10deg) scaleY(1.2); opacity: 0.6; }
        }
        
        /* Swamp bubble animation */
        @keyframes swampBubblePop {
            0% { transform: scale(0); opacity: 0; }
            20% { transform: scale(1); opacity: 0.6; }
            80% { transform: scale(1.2); opacity: 0.4; }
            100% { transform: scale(1.5); opacity: 0; }
        }
        
        /* Void pulse animation */
        @keyframes voidPulse {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.5); opacity: 0.7; }
        }
        
        /* Nightmare eye animation */
        @keyframes nightmareEye {
            0%, 90%, 100% { opacity: 0; transform: scale(0.5); }
            10%, 80% { opacity: 0.8; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
        }
        
        /* Sakura fall animation */
        @keyframes sakuraFall {
            0% { top: -20px; opacity: 0; transform: rotate(0deg) translateX(0); }
            10% { opacity: 1; }
            100% { top: 110%; opacity: 0.5; transform: rotate(360deg) translateX(50px); }
        }
        
        /* Poison rise animation */
        @keyframes poisonRise {
            0% { bottom: -50px; opacity: 0; transform: scale(0.5); }
            50% { opacity: 0.5; }
            100% { bottom: 100%; opacity: 0; transform: scale(1.5); }
        }
        
        /* Holy sparkle animation */
        @keyframes holySparkle {
            0%, 100% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes holyRay {
            0% { opacity: 0.2; height: 40%; }
            100% { opacity: 0.5; height: 60%; }
        }
        
        /* Toast animations */
        @keyframes toastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        
        @keyframes toastOut {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
        
        /* Timer animations */
        @keyframes timerFlash {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        /* Location Banner animations */
        @keyframes locationSlide {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Boss Intro animations */
        @keyframes bossFlash {
            0% { background: #fff; }
            100% { background: linear-gradient(135deg, #1a0a0a, #2d0a0a); }
        }
        
        @keyframes bossImagePulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 60px rgba(239,68,68,0.5); }
            50% { transform: scale(1.05); box-shadow: 0 0 80px rgba(239,68,68,0.7); }
        }
        
        @keyframes bossTitle {
            0% { opacity: 0; transform: scale(2); }
            50% { transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes bossSubtitle {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes bossBtn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Loot Drop animations */
        @keyframes lootChest {
            0% { transform: scale(0) rotate(-20deg); }
            50% { transform: scale(1.2) rotate(10deg); }
            100% { transform: scale(1) rotate(0); }
        }
        
        @keyframes lootItem {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        /* Level Up animations */
        @keyframes levelUpBounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.3); }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); }
        }
        
        @keyframes levelUpTitle {
            0% { opacity: 0; transform: scale(3); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes levelNumber {
            0% { opacity: 0; transform: translateY(50px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes confettiFall {
            0% { top: -20px; transform: rotate(0deg); }
            100% { top: 100vh; transform: rotate(720deg); }
        }
        
        /* Death Screen animations */
        @keyframes deathFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes deathContent {
            0% { opacity: 0; transform: scale(0.8); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes deathSkull {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        /* Coin Flip animations */
        @keyframes coin3dFlip {
            0% { transform: rotateY(0deg) scale(0.5); }
            100% { transform: rotateY(var(--final-rotation, 1800deg)) scale(1); }
        }
        
        @keyframes coinResultFade {
            from { opacity: 0; transform: scale(1.5); }
            to { opacity: 1; transform: scale(1); }
        }
        
        /* Break Timer animations */
        @keyframes breakPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.02); }
        }
        
        /* Time of Day animations */
        @keyframes timeOfDayContent {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        
        /* Secondary button style */
        .broadcast-modal__btn--secondary {
            background: rgba(255,255,255,0.1) !important;
        }
        
        .broadcast-modal__btn--secondary:hover {
            background: rgba(255,255,255,0.2) !important;
        }
    `;
    document.head.appendChild(style);
    
    // Expose globally
    window.BroadcastListener = BroadcastListener;
    
    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => BroadcastListener.init());
    } else {
        BroadcastListener.init();
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => BroadcastListener.cleanup());
})();

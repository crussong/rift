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
            const roomCode = localStorage.getItem('rift_current_room');
            if (!roomCode) return;
            
            // Restore ambient effect from previous session
            this.restoreAmbientEffect();
            
            // Wait for Firebase
            this.waitForFirebase().then(() => {
                this.subscribe(roomCode);
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
            this.playBroadcastSound('mystery');
            
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
            this.playBroadcastSound('notification');
            
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
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: #000; display: flex; align-items: center; justify-content: center;
            `;
            
            // Apply different animation styles
            const style = broadcast.style || 'fade';
            let textAnimation = 'sceneTextIn 2s ease';
            let overlayIn = 'fadeIn 1s ease';
            let overlayOut = 'fadeOut 1s ease forwards';
            
            if (style === 'slide') {
                overlayIn = 'sceneSlideIn 0.8s ease';
                overlayOut = 'sceneSlideOut 0.8s ease forwards';
                textAnimation = 'sceneTextSlide 1.5s ease';
            } else if (style === 'zoom') {
                overlayIn = 'sceneZoomIn 0.6s ease';
                overlayOut = 'sceneZoomOut 0.6s ease forwards';
                textAnimation = 'sceneTextZoom 2s ease';
            }
            
            overlay.style.animation = overlayIn;
            
            overlay.innerHTML = `
                <div class="scene-text" style="
                    font-size: clamp(24px, 5vw, 48px); font-weight: 300; color: white; text-align: center;
                    font-style: italic; letter-spacing: 2px; padding: 20px;
                    animation: ${textAnimation};
                ">${this.escapeHtml(broadcast.text)}</div>
            `;
            
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
            this.playBroadcastSound(broadcast.sound);
            
            const overlay = document.createElement('div');
            overlay.className = 'cinematic-overlay combat-start';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: linear-gradient(135deg, #1a0a0a, #2d1b1b);
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                animation: combatFlash 0.5s ease;
            `;
            overlay.innerHTML = `
                <div style="animation: combatTitle 0.8s ease; text-align: center;">
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
                " onclick="this.closest('.cinematic-overlay').remove()">⚔️ Kämpfen!</button>
            `;
            
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
                    particles: 'smoke'
                },
                holy: { 
                    css: `background: radial-gradient(ellipse at top, rgba(255,215,0,0.2) 0%, transparent 60%);`,
                    particles: 'sparkle'
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
                'smoke': () => this.createSmokeEffect()
            };
            
            if (effect.particles && particleMap[effect.particles]) {
                overlay.innerHTML = particleMap[effect.particles]();
            }
            
            // Add lightning flash for storm
            if (effect.flash) {
                this.startLightningEffect();
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

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
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon" style="background: ${config.color}20;">
                            <span style="font-size: 24px;">${config.icon}</span>
                        </div>
                        <span class="broadcast-modal__badge" style="color: ${config.color};">GM ${config.label}</span>
                    </div>
                    <div class="broadcast-modal__content">
                        ${imageHtml}
                        <p class="broadcast-modal__message">${this.escapeHtml(broadcast.message || '')}</p>
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
                        <div class="spotlight-glow"></div>
                        <div class="spotlight-content">
                            <div class="spotlight-icon">🌟</div>
                            <h2 class="spotlight-title">${this.escapeHtml(broadcast.message || 'Du bist dran!')}</h2>
                            <p class="spotlight-subtitle">Alle Augen sind auf dich gerichtet!</p>
                        </div>
                        <button class="broadcast-modal__btn" onclick="BroadcastListener.closeBroadcast(this)">
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
                        <button class="broadcast-modal__btn broadcast-modal__btn--secondary" onclick="BroadcastListener.closeBroadcast(this)">
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
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal dice-modal">
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon" style="background: rgba(245,158,11,0.2);">
                            <span style="font-size: 24px;">🎲</span>
                        </div>
                        <span class="broadcast-modal__badge" style="color: #f59e0b;">Würfelanforderung</span>
                    </div>
                    <div class="broadcast-modal__content">
                        <p class="broadcast-modal__message" style="font-size: 20px; font-weight: 600;">${this.escapeHtml(broadcast.description || 'Würfelprobe')}</p>
                        <p style="color: rgba(255,255,255,0.5); margin-top: 8px;">Der GM möchte, dass du würfelst!</p>
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
        
        // Handout
        showHandout(broadcast) {
            this.playBroadcastSound('notification');
            
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal handout-modal" style="max-width: 600px;">
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon" style="background: rgba(34,197,94,0.2);">
                            <span style="font-size: 24px;">📜</span>
                        </div>
                        <span class="broadcast-modal__badge" style="color: #22c55e;">Handout</span>
                    </div>
                    <div class="broadcast-modal__content">
                        <img src="${broadcast.image}" alt="Handout" style="width: 100%; border-radius: 10px; cursor: zoom-in;" onclick="BroadcastListener.zoomImage(this.src)">
                    </div>
                    <button class="broadcast-modal__btn" style="background: #22c55e;" onclick="BroadcastListener.closeBroadcast(this)">
                        Schließen
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('broadcast-overlay--visible'));
        },
        
        zoomImage(src) {
            const zoom = document.createElement('div');
            zoom.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
            zoom.innerHTML = `<img src="${src}" style="max-width:95%;max-height:95%;object-fit:contain;">`;
            zoom.onclick = () => zoom.remove();
            document.body.appendChild(zoom);
        },
        
        // Scene transition
        showSceneTransition(broadcast) {
            this.playBroadcastSound('dramatic');
            
            const overlay = document.createElement('div');
            overlay.className = 'cinematic-overlay scene-transition';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                background: #000; display: flex; align-items: center; justify-content: center;
                animation: fadeIn 1s ease;
            `;
            overlay.innerHTML = `
                <div class="scene-text" style="
                    font-size: 32px; font-weight: 300; color: white; text-align: center;
                    font-style: italic; letter-spacing: 2px;
                    animation: sceneTextIn 2s ease;
                ">${this.escapeHtml(broadcast.text)}</div>
            `;
            
            document.body.appendChild(overlay);
            
            // Auto-close after animation
            setTimeout(() => {
                overlay.style.animation = 'fadeOut 1s ease forwards';
                setTimeout(() => overlay.remove(), 1000);
            }, 3000);
        },
        
        // Dramatic reveal
        showReveal(broadcast) {
            this.playBroadcastSound('dramatic');
            
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
        
        // Combat start
        showCombatStart(broadcast) {
            this.playBroadcastSound('combat');
            
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
                <div style="animation: combatTitle 0.8s ease;">
                    <h1 style="
                        font-size: 64px; font-weight: 900; color: #ef4444;
                        text-transform: uppercase; letter-spacing: 8px;
                        text-shadow: 0 0 60px rgba(239,68,68,0.8);
                    ">${this.escapeHtml(broadcast.title || 'INITIATIVE!')}</h1>
                    ${broadcast.subtitle ? `<p style="font-size: 24px; color: rgba(255,255,255,0.7); margin-top: 16px;">${this.escapeHtml(broadcast.subtitle)}</p>` : ''}
                </div>
                <button style="
                    margin-top: 48px; padding: 16px 40px;
                    background: #ef4444; border: none; border-radius: 10px;
                    color: white; font-size: 18px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 2px; cursor: pointer;
                    animation: combatBtn 1s ease;
                " onclick="this.closest('.cinematic-overlay').remove()">⚔️ Kämpfen!</button>
            `;
            
            document.body.appendChild(overlay);
        },
        
        // Ambient change
        showAmbientChange(broadcast) {
            this.playBroadcastSound('mystery');
            
            const effects = {
                rain: { emoji: '🌧️', name: 'Regen', css: 'background: linear-gradient(to bottom, #1a2a3a, #0a1520);' },
                fire: { emoji: '🔥', name: 'Feuer', css: 'background: linear-gradient(to bottom, #2d1a0a, #1a0a00);' },
                darkness: { emoji: '🌑', name: 'Dunkelheit', css: 'background: #000;' },
                snow: { emoji: '❄️', name: 'Schnee', css: 'background: linear-gradient(to bottom, #2a3a4a, #1a2535);' },
                fog: { emoji: '🌫️', name: 'Nebel', css: 'background: linear-gradient(to bottom, #2a2a2a, #1a1a1a);' },
                clear: { emoji: '☀️', name: 'Klar', css: 'background: linear-gradient(to bottom, #1a3a5a, #0a2040);' }
            };
            
            const effect = effects[broadcast.effect] || effects.clear;
            
            const overlay = document.createElement('div');
            overlay.className = 'cinematic-overlay ambient-change';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                ${effect.css}
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                animation: fadeIn 1s ease;
            `;
            overlay.innerHTML = `
                <span style="font-size: 80px; animation: ambientPulse 2s ease infinite;">${effect.emoji}</span>
                <h2 style="font-size: 28px; color: white; margin-top: 24px;">${effect.name}</h2>
            `;
            
            document.body.appendChild(overlay);
            
            setTimeout(() => {
                overlay.style.animation = 'fadeOut 1s ease forwards';
                setTimeout(() => overlay.remove(), 1000);
            }, 2500);
        },
        
        // Reaction
        showReaction(broadcast) {
            this.playBroadcastSound('notification');
            
            const overlay = document.createElement('div');
            overlay.className = 'reaction-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 100000;
                display: flex; align-items: center; justify-content: center;
                pointer-events: none;
            `;
            overlay.innerHTML = `
                <span style="
                    font-size: 120px;
                    animation: reactionPop 1.5s ease forwards;
                ">${broadcast.emoji}</span>
            `;
            
            document.body.appendChild(overlay);
            setTimeout(() => overlay.remove(), 1500);
        },
        
        // Sound player
        playBroadcastSound(soundType) {
            if (!soundType || soundType === 'none') return;
            
            // For now, use the default sound
            // TODO: Implement different sounds
            this.playSound();
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
            
            // Build options HTML with emojis
            const optionsHtml = (poll.options || []).map((opt, i) => {
                const emoji = poll.emojis?.[i] || '';
                const label = emoji ? `${emoji} ${this.escapeHtml(opt)}` : this.escapeHtml(opt);
                return `<button class="poll-option-btn" onclick="BroadcastListener.votePoll('${opt}', '${pollId}', '${roomCode}', this)">${label}</button>`;
            }).join('');
            
            // Build image HTML if present
            const imageHtml = poll.image ? `<img src="${poll.image}" alt="Poll" style="width:100%; border-radius:10px; margin-bottom:16px;">` : '';
            
            overlay.innerHTML = `
                <div class="broadcast-modal poll-modal">
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon" style="background:rgba(139,92,246,0.15)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#a78bfa">
                                <path d="M18 20V10M12 20V4M6 20v-6"/>
                            </svg>
                        </div>
                        <span class="broadcast-modal__badge" style="color:#a78bfa">GM Umfrage</span>
                    </div>
                    <div class="broadcast-modal__content">
                        ${imageHtml}
                        <p class="broadcast-modal__message" style="font-size:18px;font-weight:600;margin-bottom:16px;">${this.escapeHtml(poll.question)}</p>
                        <div class="poll-options-list">
                            ${optionsHtml}
                        </div>
                    </div>
                    <button class="poll-skip-btn" onclick="BroadcastListener.skipPoll('${pollId}', this)">
                        Überspringen
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            requestAnimationFrame(() => {
                overlay.classList.add('broadcast-overlay--visible');
            });
            
            // Play sound only if enabled in poll settings
            if (poll.withSound !== false) {
                this.playSound();
            }
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
        }
        
        .spotlight-modal--target {
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #8b5cf6;
            box-shadow: 0 0 100px rgba(139,92,246,0.5);
        }
        
        .spotlight-glow {
            position: absolute;
            top: -100px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(255,215,0,0.3), transparent);
            animation: spotlightPulse 2s ease infinite;
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

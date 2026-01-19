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
                    
                    // Handle Poll (GM doesn't see poll popup, they have their own UI)
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
        
        showBroadcast(broadcast) {
            // Play sound if enabled
            if (broadcast.withSound) {
                this.playSound();
            }
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'broadcast-overlay';
            overlay.innerHTML = `
                <div class="broadcast-modal">
                    <div class="broadcast-modal__header">
                        <div class="broadcast-modal__icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <span class="broadcast-modal__badge">GM Nachricht</span>
                    </div>
                    <div class="broadcast-modal__content">
                        <p class="broadcast-modal__message">${this.escapeHtml(broadcast.message)}</p>
                    </div>
                    <button class="broadcast-modal__btn" onclick="BroadcastListener.closeBroadcast(this)">
                        Verstanden
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Animate in
            requestAnimationFrame(() => {
                overlay.classList.add('broadcast-overlay--visible');
            });
            
            // Focus trap
            overlay.querySelector('.broadcast-modal__btn').focus();
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
                        <p class="broadcast-modal__message" style="font-size:18px;font-weight:600;margin-bottom:16px;">${this.escapeHtml(poll.question)}</p>
                        <div class="poll-options-list">
                            ${(poll.options || []).map(opt => `
                                <button class="poll-option-btn" onclick="BroadcastListener.votePoll('${opt}', '${pollId}', '${roomCode}', this)">
                                    ${this.escapeHtml(opt)}
                                </button>
                            `).join('')}
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
            
            // Play sound
            this.playSound();
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
                    odllId: pollId,
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

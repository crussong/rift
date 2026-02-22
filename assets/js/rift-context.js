/**
 * RiftContext — Single Source of Truth
 * 
 * Subscribes to Firestore sessions ONCE.
 * Determines: next session → priority ruleset → main character.
 * All UI (Dock, MegaNav, Hub, Session Pill) subscribes to this.
 * 
 * Usage:
 *   RiftContext.subscribe(({ sessions, nextSession, liveSession, ruleset, character }) => { ... });
 *   RiftContext.init(); // call once after page load
 */
(function() {
    'use strict';
    
    const RULESET_NORM = {
        '5e2024': 'dnd5e',
        'cyberpunk': 'cyberpunkred',
        '5e': 'dnd5e'
    };
    
    const RULESET_INFO = {
        'worldsapart': { name: 'Worlds Apart', icon: 'ruleset_worldsapart.svg', sheet: '/sheet/worldsapart' },
        'dnd5e':       { name: 'D&D 5e',      icon: 'ruleset_5e_2024.svg',     sheet: '/sheet/5e-de' },
        'htbah':       { name: 'How To Be A Hero', icon: 'ruleset_htbah.svg',   sheet: '/sheet/htbah' },
        'cyberpunkred':{ name: 'Cyberpunk RED', icon: 'ruleset_cyberpunkred.svg', sheet: '/sheet/cyberpunk' }
    };
    
    function normalizeRuleset(rs) {
        if (!rs) return 'worldsapart';
        return RULESET_NORM[rs] || rs;
    }
    
    window.RiftContext = {
        // ---- State ----
        ready: false,
        roomCode: null,
        sessions: [],         // sorted: live first, then upcoming by date, max recent
        nextSession: null,    // next upcoming (determines priority ruleset)
        liveSession: null,    // currently live/paused session
        ruleset: 'worldsapart',
        character: null,      // main character for priority ruleset
        characterId: null,
        
        // ---- Constants ----
        RULESET_INFO: RULESET_INFO,
        
        // ---- Listeners ----
        _listeners: [],
        _sessionUnsub: null,
        _charListenerAttached: false,
        _initCalled: false,
        
        // ---- Public API ----
        
        /**
         * Initialize context. Safe to call multiple times.
         */
        init: function() {
            if (this._initCalled) return;
            this._initCalled = true;
            
            this.roomCode = localStorage.getItem('rift_current_room');
            console.log('[RiftContext] Init, room:', this.roomCode);
            
            if (!this.roomCode) {
                this.ready = true;
                this._emit();
                return;
            }
            
            // Wait for Firestore to be ready, then subscribe to sessions
            this._waitForFirestore();
            
            // Listen for character changes
            this._attachCharacterListeners();
        },
        
        /**
         * Subscribe to context changes. Returns unsubscribe function.
         * Callback receives the full state object.
         * If context is already ready, fires immediately.
         */
        subscribe: function(callback) {
            this._listeners.push(callback);
            // Fire immediately if ready
            if (this.ready) {
                try { callback(this._getState()); } catch (e) { console.warn('[RiftContext] Subscriber error:', e); }
            }
            // Return unsubscribe
            var self = this;
            return function() {
                self._listeners = self._listeners.filter(function(l) { return l !== callback; });
            };
        },
        
        /**
         * Get sorted sessions, limited.
         */
        getSessions: function(limit) {
            return limit ? this.sessions.slice(0, limit) : this.sessions;
        },
        
        /**
         * Get sheet URL for current character.
         */
        getCharacterUrl: function() {
            var rs = RULESET_INFO[this.ruleset] || RULESET_INFO['worldsapart'];
            var url = rs.sheet;
            if (this.characterId && this.characterId !== 'local') {
                url += '?id=' + this.characterId;
                if (this.roomCode) url += '&room=' + this.roomCode;
            } else if (this.roomCode) {
                url += '?room=' + this.roomCode;
            }
            return url;
        },
        
        /**
         * Get ruleset display info.
         */
        getRulesetInfo: function(rs) {
            rs = normalizeRuleset(rs);
            return RULESET_INFO[rs] || RULESET_INFO['worldsapart'];
        },
        
        /**
         * Force refresh (e.g. after character save).
         */
        refresh: function() {
            this._loadCharacter();
            this._emit();
        },
        
        // ---- Internal ----
        
        _getState: function() {
            return {
                ready: this.ready,
                roomCode: this.roomCode,
                sessions: this.sessions,
                nextSession: this.nextSession,
                liveSession: this.liveSession,
                ruleset: this.ruleset,
                character: this.character,
                characterId: this.characterId
            };
        },
        
        _emit: function() {
            var state = this._getState();
            for (var i = 0; i < this._listeners.length; i++) {
                try { this._listeners[i](state); } catch (e) { console.warn('[RiftContext] Subscriber error:', e); }
            }
        },
        
        _waitForFirestore: function() {
            var self = this;
            var tries = 0;
            var maxTries = 60; // 30 seconds
            
            function check() {
                tries++;
                var db = window.RIFT && window.RIFT.firebase && typeof RIFT.firebase.getFirestore === 'function'
                    ? RIFT.firebase.getFirestore() : null;
                var hasSub = window.RIFT && window.RIFT.rooms && typeof RIFT.rooms.subscribeToSessions === 'function';
                
                if (db && hasSub) {
                    console.log('[RiftContext] Firestore ready after', tries, 'checks');
                    self._subscribeToSessions();
                    return;
                }
                
                if (tries < maxTries) {
                    setTimeout(check, 500);
                } else {
                    console.warn('[RiftContext] Firestore not ready after', maxTries, 'checks. Using localStorage fallback.');
                    self._loadFromLocalStorage();
                }
            }
            
            check();
        },
        
        _subscribeToSessions: function() {
            var self = this;
            
            // Unsubscribe previous if any
            if (this._sessionUnsub) {
                this._sessionUnsub();
                this._sessionUnsub = null;
            }
            
            this._sessionUnsub = RIFT.rooms.subscribeToSessions(this.roomCode, function(sessions) {
                console.log('[RiftContext] Sessions update:', sessions.length, 'sessions');
                self._processSessionsAndUpdate(sessions);
            });
        },
        
        _loadFromLocalStorage: function() {
            try {
                var allSessions = JSON.parse(localStorage.getItem('rift_sessions') || '[]');
                var sessions = allSessions.filter(function(s) { return s.roomCode === this.roomCode; }.bind(this));
                this._processSessionsAndUpdate(sessions);
            } catch (e) {
                console.warn('[RiftContext] localStorage fallback failed:', e);
                this.ready = true;
                this._emit();
            }
        },
        
        _processSessionsAndUpdate: function(rawSessions) {
            var now = new Date();
            now.setHours(0, 0, 0, 0);
            
            // Categorize
            var live = [];
            var upcoming = [];
            
            for (var i = 0; i < rawSessions.length; i++) {
                var s = rawSessions[i];
                if (s.status === 'live' || s.status === 'paused') {
                    live.push(s);
                } else if (s.status !== 'ended' && s.date && new Date(s.date) >= now) {
                    upcoming.push(s);
                }
            }
            
            // Sort upcoming by date ascending
            upcoming.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
            
            // Combined: live first, then upcoming
            this.sessions = live.concat(upcoming);
            this.liveSession = live.length > 0 ? live[0] : null;
            
            // Next session: live takes priority, then first upcoming
            this.nextSession = this.liveSession || (upcoming.length > 0 ? upcoming[0] : null);
            
            // Priority ruleset from next session
            var oldRuleset = this.ruleset;
            if (this.nextSession && this.nextSession.ruleset) {
                this.ruleset = normalizeRuleset(this.nextSession.ruleset);
            } else {
                // No sessions — use room focus or default
                this.ruleset = this._getRulesetFromFocus();
            }
            
            console.log('[RiftContext] Next session:', this.nextSession ? this.nextSession.name : 'none',
                '| Ruleset:', this.ruleset, '| Sessions:', this.sessions.length);
            
            // Load character for this ruleset
            this._loadCharacter();
            
            this.ready = true;
            this._emit();
        },
        
        _getRulesetFromFocus: function() {
            // Try RIFT.focus
            if (window.RIFT && window.RIFT.focus && typeof RIFT.focus.getRuleset === 'function') {
                var fr = RIFT.focus.getRuleset();
                if (fr) return normalizeRuleset(fr);
            }
            // Try localStorage
            try {
                var fd = JSON.parse(localStorage.getItem('rift_room_focus') || 'null');
                if (fd && fd.ruleset) return normalizeRuleset(fd.ruleset);
            } catch (e) {}
            return 'worldsapart';
        },
        
        _loadCharacter: function() {
            var charData = null;
            var charId = null;
            var ruleset = this.ruleset;
            
            var isValid = function(d) { return d && d.name && d.name.trim() !== ''; };
            
            // Source 1: worldsapart_character_v5 localStorage (only for WA)
            if (ruleset === 'worldsapart') {
                try {
                    var raw = localStorage.getItem('worldsapart_character_v5');
                    if (raw) {
                        var p = JSON.parse(raw);
                        if (isValid(p)) { charData = p; charId = p.id || 'local'; }
                    }
                } catch (e) {}
            }
            
            // Source 2: CharacterStorage
            if (!charData && typeof CharacterStorage !== 'undefined') {
                // Main character for priority ruleset
                var main = CharacterStorage.getMainCharacter(ruleset);
                if (isValid(main)) {
                    charData = main;
                    charId = main.id;
                }
                
                // Fallback: any character for this ruleset
                if (!charData) {
                    try {
                        var byRs = CharacterStorage.getByRuleset(ruleset);
                        if (byRs && byRs.length > 0 && isValid(byRs[0])) {
                            charData = byRs[0];
                            charId = byRs[0].id;
                        }
                    } catch (e) {}
                }
                
                // Last resort: any character at all
                if (!charData) {
                    try {
                        var all = CharacterStorage.getAll();
                        var any = Object.values(all).filter(isValid);
                        if (any.length > 0) {
                            charData = any[0];
                            charId = charData.id;
                        }
                    } catch (e) {}
                }
            }
            
            this.character = charData;
            this.characterId = charId;
            
            console.log('[RiftContext] Character:', charData ? charData.name : 'none',
                '| Ruleset:', ruleset, '| ID:', charId);
        },
        
        _attachCharacterListeners: function() {
            if (this._charListenerAttached) return;
            this._charListenerAttached = true;
            
            var self = this;
            var reload = function() {
                self._loadCharacter();
                self._emit();
            };
            
            // localStorage changes (cross-tab)
            window.addEventListener('storage', function(e) {
                if (e.key === 'rift_characters' || e.key === 'worldsapart_character_v5') {
                    console.log('[RiftContext] Character storage changed (cross-tab)');
                    setTimeout(reload, 200);
                }
            });
            
            // Same-tab character save
            window.addEventListener('rift-character-saved', function() {
                console.log('[RiftContext] Character saved (same-tab)');
                setTimeout(reload, 200);
            });
            
            // RIFT.state characters:changed (after Firebase sync)
            function attachStateListener() {
                if (window.RIFT && window.RIFT.state && typeof RIFT.state.on === 'function') {
                    RIFT.state.on('characters:changed', function() {
                        console.log('[RiftContext] Characters changed (RIFT.state)');
                        setTimeout(reload, 200);
                    });
                    return true;
                }
                return false;
            }
            
            if (!attachStateListener()) {
                var iv = setInterval(function() {
                    if (attachStateListener()) clearInterval(iv);
                }, 1000);
                setTimeout(function() { clearInterval(iv); }, 30000);
            }
        }
    };
})();

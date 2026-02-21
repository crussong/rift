/**
 * ═══════════════════════════════════════════════════════════════
 *  RIFT — Room Focus Manager
 *  Manages which session/ruleset is currently active in a room.
 *
 *  Firestore: rooms/{roomCode}.focus = {
 *    sessionId, ruleset, sessionName, status, setAt, setBy
 *  }
 *
 *  Loads after: firebase-config.js, rift-state.js, room-service.js
 *  Used by:     session.html, gm.html, gm-characters.js,
 *               layout-unified.js, all character sheets
 *
 *  API:
 *    RIFT.focus.set(data)        — GM sets focus (writes Firestore)
 *    RIFT.focus.clear()          — GM clears focus
 *    RIFT.focus.get()            — Get current focus object
 *    RIFT.focus.getRuleset()     — Shorthand for current ruleset
 *    RIFT.focus.subscribe(fn)    — Listen for changes
 *    RIFT.focus.init(roomCode)   — Start watching (auto-called)
 *
 *  Events (via RIFT.state):
 *    'room:focus:changed'  → { sessionId, ruleset, status, ... }
 *    'room:focus:cleared'  → null
 * ═══════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    const LOG = '[RoomFocus]';

    // ════════════════════════════════════════
    //  STATE
    // ════════════════════════════════════════

    let _roomCode = null;
    let _focus = null;          // Current focus object
    let _unsub = null;          // Firestore unsubscribe
    let _subscribers = [];      // Local callbacks
    let _initialized = false;


    // ════════════════════════════════════════
    //  INIT — Subscribe to room doc focus field
    // ════════════════════════════════════════

    function init(roomCode) {
        if (!roomCode) {
            roomCode = localStorage.getItem('rift_current_room');
        }
        if (!roomCode) {
            console.log(LOG, 'No room code, focus disabled');
            return;
        }

        _roomCode = roomCode.replace(/-/g, '').toUpperCase();

        if (_unsub) _unsub(); // Clean up previous watcher

        const db = _getDb();
        if (!db) {
            console.warn(LOG, 'No Firestore, focus disabled');
            return;
        }

        // Watch room document for focus changes
        _unsub = db.collection('rooms').doc(_roomCode).onSnapshot(function(doc) {
            if (!doc.exists) return;
            const data = doc.data();
            const newFocus = data.focus || null;

            const oldRuleset = _focus?.ruleset;
            const newRuleset = newFocus?.ruleset;
            _focus = newFocus;

            // Sync to RiftState
            if (window.RIFT && RIFT.state) {
                RIFT.state.set('room.focus', newFocus);
            }

            // Sync to localStorage for cross-tab awareness
            if (newFocus) {
                localStorage.setItem('rift_room_focus', JSON.stringify(newFocus));
            } else {
                localStorage.removeItem('rift_room_focus');
            }

            // Notify subscribers
            _notifySubscribers(newFocus);

            // Emit events
            if (window.RIFT && RIFT.state) {
                if (newFocus) {
                    RIFT.state.emit('room:focus:changed', newFocus);
                } else if (oldRuleset) {
                    RIFT.state.emit('room:focus:cleared', null);
                }
            }

            if (oldRuleset !== newRuleset) {
                console.log(LOG, newFocus
                    ? `Focus: ${newFocus.ruleset} — "${newFocus.sessionName || ''}" [${newFocus.status || 'set'}]`
                    : 'Focus cleared');
            }
        }, function(err) {
            console.error(LOG, 'Watch error:', err);
        });

        _initialized = true;
        console.log(LOG, 'Watching room', _roomCode);
    }


    // ════════════════════════════════════════
    //  SET FOCUS — GM action
    // ════════════════════════════════════════

    /**
     * Set room focus to a specific session/ruleset.
     * Only GM should call this.
     *
     * @param {Object} data
     * @param {string} data.ruleset       — 'worldsapart' | 'dnd5e' | 'htbah' | 'cyberpunkred'
     * @param {string} [data.sessionId]   — Session ID (optional for manual toggle)
     * @param {string} [data.sessionName] — Display name
     * @param {string} [data.status]      — 'live' | 'paused' | null
     */
    async function set(data) {
        const db = _getDb();
        const code = _roomCode || localStorage.getItem('rift_current_room')?.replace(/-/g, '').toUpperCase();
        if (!db || !code) {
            console.warn(LOG, 'Cannot set focus: no Firestore or room');
            return false;
        }

        const focus = {
            ruleset: data.ruleset,
            sessionId: data.sessionId || null,
            sessionName: data.sessionName || null,
            status: data.status || 'live',
            setAt: firebase.firestore.FieldValue.serverTimestamp(),
            setBy: firebase.auth().currentUser?.uid || 'unknown'
        };

        try {
            await db.collection('rooms').doc(code).update({ focus: focus });
            console.log(LOG, 'Focus set:', focus.ruleset, focus.sessionName || '');
            return true;
        } catch (err) {
            console.error(LOG, 'Set focus failed:', err);
            return false;
        }
    }


    // ════════════════════════════════════════
    //  UPDATE STATUS — e.g. pause/resume
    // ════════════════════════════════════════

    async function updateStatus(status) {
        const db = _getDb();
        const code = _roomCode || localStorage.getItem('rift_current_room')?.replace(/-/g, '').toUpperCase();
        if (!db || !code) return false;

        try {
            await db.collection('rooms').doc(code).update({
                'focus.status': status,
                'focus.setAt': firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(LOG, 'Status updated:', status);
            return true;
        } catch (err) {
            console.error(LOG, 'Update status failed:', err);
            return false;
        }
    }


    // ════════════════════════════════════════
    //  CLEAR FOCUS
    // ════════════════════════════════════════

    async function clear() {
        const db = _getDb();
        const code = _roomCode || localStorage.getItem('rift_current_room')?.replace(/-/g, '').toUpperCase();
        if (!db || !code) return false;

        try {
            await db.collection('rooms').doc(code).update({
                focus: firebase.firestore.FieldValue.delete()
            });
            console.log(LOG, 'Focus cleared');
            return true;
        } catch (err) {
            console.error(LOG, 'Clear focus failed:', err);
            return false;
        }
    }


    // ════════════════════════════════════════
    //  GETTERS
    // ════════════════════════════════════════

    function get() {
        // Live value from watcher, fallback to localStorage
        if (_focus) return _focus;
        try {
            return JSON.parse(localStorage.getItem('rift_room_focus') || 'null');
        } catch (e) { return null; }
    }

    function getRuleset() {
        const f = get();
        return f?.ruleset || null;
    }

    function isLive() {
        const f = get();
        return f?.status === 'live';
    }


    // ════════════════════════════════════════
    //  SUBSCRIBE
    // ════════════════════════════════════════

    function subscribe(fn) {
        if (typeof fn !== 'function') return function() {};
        _subscribers.push(fn);

        // Immediately call with current state
        if (_focus !== null) fn(_focus);

        return function unsubscribe() {
            _subscribers = _subscribers.filter(function(s) { return s !== fn; });
        };
    }

    function _notifySubscribers(focus) {
        for (var i = 0; i < _subscribers.length; i++) {
            try { _subscribers[i](focus); } catch (e) { console.warn(LOG, 'Subscriber error:', e); }
        }
    }


    // ════════════════════════════════════════
    //  DISCONNECT
    // ════════════════════════════════════════

    function disconnect() {
        if (_unsub) { _unsub(); _unsub = null; }
        _focus = null;
        _subscribers = [];
        _initialized = false;
        console.log(LOG, 'Disconnected');
    }


    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════

    function _getDb() {
        if (window.RIFT?.firebase?.getFirestore) return RIFT.firebase.getFirestore();
        if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
        return null;
    }

    // Ruleset display names
    var RULESET_LABELS = {
        'worldsapart': 'Worlds Apart',
        'dnd5e': 'D&D 5e',
        'htbah': 'How To Be A Hero',
        'cyberpunkred': 'Cyberpunk RED'
    };

    function getRulesetLabel(ruleset) {
        return RULESET_LABELS[ruleset] || ruleset || 'Unbekannt';
    }


    // ════════════════════════════════════════
    //  AUTO-INIT
    //  If room code is in localStorage, start watching
    // ════════════════════════════════════════

    function _autoInit() {
        var code = localStorage.getItem('rift_current_room');
        if (code) {
            // Delay slightly to ensure Firebase is ready
            setTimeout(function() { init(code); }, 500);
        }
    }

    // Cross-tab sync: if another tab changes focus
    window.addEventListener('storage', function(e) {
        if (e.key === 'rift_room_focus') {
            try {
                var newFocus = e.newValue ? JSON.parse(e.newValue) : null;
                if (JSON.stringify(newFocus) !== JSON.stringify(_focus)) {
                    _focus = newFocus;
                    _notifySubscribers(newFocus);
                    if (window.RIFT && RIFT.state) {
                        RIFT.state.set('room.focus', newFocus);
                        RIFT.state.emit('room:focus:changed', newFocus);
                    }
                }
            } catch (e) { /* ignore parse errors */ }
        }
    });


    // ════════════════════════════════════════
    //  EXPOSE API
    // ════════════════════════════════════════

    window.RIFT = window.RIFT || {};
    window.RIFT.focus = {
        init: init,
        set: set,
        clear: clear,
        updateStatus: updateStatus,
        get: get,
        getRuleset: getRuleset,
        isLive: isLive,
        subscribe: subscribe,
        disconnect: disconnect,
        getRulesetLabel: getRulesetLabel,
        RULESET_LABELS: RULESET_LABELS
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _autoInit);
    } else {
        _autoInit();
    }

    console.log(LOG, 'Ready');

})();

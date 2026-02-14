/**
 * RIFT State Manager
 * Central reactive state with event bus, Firebase sync, and cross-page persistence.
 * Loads after firebase-config.js, before other services.
 * 
 * Usage:
 *   RIFT.state.get('user')              // current user object
 *   RIFT.state.get('character')         // active character
 *   RIFT.state.get('room')              // current room data
 *   RIFT.state.get('room.code')         // nested access
 *   RIFT.state.set('theme', 'dark')     // set + emit event
 *   RIFT.state.on('character:changed', fn)
 *   RIFT.state.off('character:changed', fn)
 *   RIFT.state.once('user:ready', fn)   // fire once then auto-remove
 */

(function() {
    'use strict';

    // ════════════════════════════════════════
    // EVENT BUS
    // ════════════════════════════════════════

    const _listeners = {};

    function on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
        return () => off(event, fn); // return unsubscribe
    }

    function off(event, fn) {
        if (!_listeners[event]) return;
        _listeners[event] = _listeners[event].filter(f => f !== fn);
    }

    function once(event, fn) {
        const wrapper = (...args) => {
            off(event, wrapper);
            fn(...args);
        };
        on(event, wrapper);
        return () => off(event, wrapper);
    }

    function emit(event, data) {
        const handlers = _listeners[event];
        if (!handlers) return;
        for (const fn of handlers) {
            try { fn(data); } catch (e) {
                console.warn(`[RiftState] Event handler error (${event}):`, e);
            }
        }
    }


    // ════════════════════════════════════════
    // STATE STORE
    // ════════════════════════════════════════

    const CACHE_KEY = 'rift_state_cache';

    // Namespaces that get persisted to sessionStorage
    const PERSISTENT = ['user', 'character', 'room', 'session', 'party', 'theme', 'preferences'];

    // In-memory state
    let _state = {};

    // Firebase listener unsubscribes
    const _unsubs = [];


    /**
     * Restore state from sessionStorage (survives fullpage reload)
     */
    function _restoreCache() {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (raw) {
                _state = JSON.parse(raw);
            }
        } catch (e) { /* ignore corrupt cache */ }

        // Also pull from existing localStorage keys for backwards compat
        _syncFromLocalStorage();
    }

    /**
     * Backwards compat: read existing localStorage keys into state
     */
    function _syncFromLocalStorage() {
        try {
            const user = localStorage.getItem('rift_user');
            if (user) _state.user = JSON.parse(user);

            const room = localStorage.getItem('rift_current_room');
            if (room) _state.room = { ...(_state.room || {}), code: room };

            const theme = localStorage.getItem('rift_theme');
            if (theme) _state.theme = theme;

            const activeChar = localStorage.getItem('rift_active_character');
            if (activeChar) {
                try { _state.character = JSON.parse(activeChar); }
                catch { _state.character = { id: activeChar }; }
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Persist current state to sessionStorage
     */
    function _persistCache() {
        try {
            const toCache = {};
            for (const ns of PERSISTENT) {
                if (_state[ns] !== undefined) toCache[ns] = _state[ns];
            }
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
        } catch (e) { /* storage full or unavailable */ }
    }


    // ════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════

    /**
     * Get state value. Supports dot notation: get('room.code')
     */
    function get(path) {
        if (!path) return { ..._state };

        const parts = path.split('.');
        let val = _state;
        for (const p of parts) {
            if (val == null) return undefined;
            val = val[p];
        }
        return val;
    }

    /**
     * Set state value + emit change event + persist
     * set('character', {...})  -> emits 'character:changed'
     * set('room.code', 'ABC') -> emits 'room:changed'
     */
    function set(path, value) {
        const parts = path.split('.');
        const namespace = parts[0];
        const old = get(path);

        // Same value? Skip
        if (old === value) return;

        if (parts.length === 1) {
            _state[namespace] = value;
        } else {
            // Deep set
            if (!_state[namespace] || typeof _state[namespace] !== 'object') {
                _state[namespace] = {};
            }
            let target = _state[namespace];
            for (let i = 1; i < parts.length - 1; i++) {
                if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
                    target[parts[i]] = {};
                }
                target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = value;
        }

        _persistCache();

        // Backwards compat: also write to localStorage
        _syncToLocalStorage(namespace);

        // Emit namespaced event
        emit(`${namespace}:changed`, get(namespace));

        // Emit specific path event for deep changes
        if (parts.length > 1) {
            emit(`${path}:changed`, value);
        }
    }

    /**
     * Merge object into namespace (shallow merge)
     * merge('user', { displayName: 'Foo' }) -> merges into user state
     */
    function merge(namespace, obj) {
        const current = _state[namespace];
        if (current && typeof current === 'object' && typeof obj === 'object') {
            _state[namespace] = { ...current, ...obj };
        } else {
            _state[namespace] = obj;
        }
        _persistCache();
        _syncToLocalStorage(namespace);
        emit(`${namespace}:changed`, _state[namespace]);
    }

    /**
     * Backwards compat: write back to localStorage so existing code still works
     */
    function _syncToLocalStorage(namespace) {
        try {
            if (namespace === 'user' && _state.user) {
                localStorage.setItem('rift_user', JSON.stringify(_state.user));
            }
            if (namespace === 'room' && _state.room?.code) {
                localStorage.setItem('rift_current_room', _state.room.code);
            }
            if (namespace === 'theme' && _state.theme) {
                localStorage.setItem('rift_theme', _state.theme);
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Clear a namespace
     */
    function clear(namespace) {
        if (namespace) {
            delete _state[namespace];
            emit(`${namespace}:cleared`, null);
        } else {
            _state = {};
            emit('state:cleared', null);
        }
        _persistCache();
    }


    // ════════════════════════════════════════
    // FIREBASE REALTIME SYNC
    // ════════════════════════════════════════

    /**
     * Subscribe to Firebase realtime updates for a Firestore doc
     */
    function _watchDoc(collection, docId, namespace, transform) {
        const db = window.RIFT?.firebase?.getFirestore?.();
        if (!db || !docId) return null;

        const unsub = db.collection(collection).doc(docId).onSnapshot(
            (snap) => {
                if (snap.exists) {
                    const data = transform ? transform(snap.data(), snap.id) : snap.data();
                    set(namespace, data);
                }
            },
            (err) => console.warn(`[RiftState] Watch ${collection}/${docId} error:`, err)
        );

        _unsubs.push(unsub);
        return unsub;
    }

    /**
     * Subscribe to Firebase Realtime Database path
     */
    function _watchRTDB(path, namespace, transform) {
        const rtdb = window.RIFT?.firebase?.getDatabase?.();
        if (!rtdb || !path) return null;

        const ref = rtdb.ref(path);
        const handler = ref.on('value', (snap) => {
            const val = snap.val();
            if (val) {
                const data = transform ? transform(val) : val;
                set(namespace, data);
            }
        });

        _unsubs.push(() => ref.off('value', handler));
        return handler;
    }

    /**
     * Initialize Firebase listeners once auth is ready
     */
    function _initFirebaseSync() {
        const firebase = window.RIFT?.firebase;
        if (!firebase) return;

        // Wait for auth
        firebase.onAuthStateChanged((firebaseUser) => {
            // Clean up old listeners
            _unsubs.forEach(fn => { try { fn(); } catch(e) {} });
            _unsubs.length = 0;

            if (!firebaseUser) {
                clear();
                return;
            }

            const uid = firebaseUser.uid;

            // Watch user profile
            _watchDoc('users', uid, 'user', (data, id) => ({
                ...data,
                oderId: id,
                uid: id
            }));

            // Watch current room if set
            const roomCode = get('room.code') || localStorage.getItem('rift_current_room');
            if (roomCode) {
                _watchRoom(roomCode, uid);
            }
        });
    }

    /**
     * Watch a specific room + membership
     */
    function _watchRoom(roomCode, uid) {
        if (!roomCode) return;

        // Room document
        _watchDoc('rooms', roomCode, 'room', (data, id) => ({
            ...data,
            code: id
        }));

        // My membership in this room
        const db = window.RIFT?.firebase?.getFirestore?.();
        if (db && uid) {
            const unsub = db.collection('rooms').doc(roomCode)
                .collection('members').doc(uid)
                .onSnapshot((snap) => {
                    if (snap.exists) {
                        merge('room', { membership: snap.data() });
                    }
                });
            _unsubs.push(unsub);
        }

        // Room presence via RTDB
        _watchRTDB(`rooms/${roomCode}/presence`, 'presence');
    }

    /**
     * Switch to a different room (re-subscribes listeners)
     */
    function switchRoom(roomCode) {
        const uid = get('user.uid') || window.RIFT?.firebase?.getCurrentUser?.()?.uid;
        
        // Clear old room state
        clear('room');
        clear('presence');
        clear('party');

        if (roomCode) {
            set('room.code', roomCode);
            _watchRoom(roomCode, uid);
        }
    }


    // ════════════════════════════════════════
    // DEBUG
    // ════════════════════════════════════════

    function debug() {
        console.group('[RiftState] Current State');
        for (const [key, val] of Object.entries(_state)) {
            console.log(`  ${key}:`, val);
        }
        console.log('  listeners:', Object.keys(_listeners).map(k => `${k}(${_listeners[k].length})`));
        console.groupEnd();
    }


    // ════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════

    // Restore cached state immediately (sync, before anything else)
    _restoreCache();

    // Firebase sync when ready (async)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initFirebaseSync);
    } else {
        // Small delay to let firebase-config.js initialize
        setTimeout(_initFirebaseSync, 100);
    }

    // Expose on RIFT global
    window.RIFT = window.RIFT || {};
    window.RIFT.state = {
        // Core
        get,
        set,
        merge,
        clear,

        // Events
        on,
        off,
        once,
        emit,

        // Room management
        switchRoom,

        // Debug
        debug,

        // Direct access (for devtools)
        get _raw() { return _state; },
        get _listeners() { return _listeners; }
    };

    console.log('[RiftState] Ready');

})();

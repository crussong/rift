/**
 * ═══════════════════════════════════════════════════════════════
 *  RiftLink — Real-time Bidirectional Sync Layer
 *  Connects RiftState ↔ Firebase for character data.
 *
 *  Loads after: firebase-config.js, rift-state.js
 *  Used by:     v2-character.js (player sheet), gm.html (GM panel)
 *
 *  Player mode:  RIFT.link.watchChar(charId)
 *  GM mode:      RIFT.link.watchRoom(roomCode)
 *
 *  Flow (Player edits HP):
 *    Sheet save() → RiftState.set('characters.{id}.hp.current', 50)
 *                 → RiftLink intercepts → debounced Firestore write
 *                 → Firestore onSnapshot fires on GM
 *                 → GM RiftLink → RiftState → GM UI updates
 *
 *  Flow (GM modifies HP):
 *    GM → RIFT.link.write(charId, 'hp.current', 30)
 *       → Firestore update
 *       → onSnapshot fires on Player + GM
 *       → RiftLink → RiftState → Sheet re-renders
 * ═══════════════════════════════════════════════════════════════
 */

(function() {
    'use strict';

    // ════════════════════════════════════════
    //  CONSTANTS
    // ════════════════════════════════════════

    const WRITE_DEBOUNCE_MS = 600;      // Debounce local → Firebase writes
    const BATCH_WINDOW_MS   = 100;      // Batch multiple field changes
    const LOG_PREFIX        = '[RiftLink]';

    // Fields that are metadata, not synced back to Firebase
    const META_FIELDS = ['_localDirty', '_lastSyncedAt', '_origin'];


    // ════════════════════════════════════════
    //  INTERNAL STATE
    // ════════════════════════════════════════

    let _roomCode   = null;             // Current room
    let _mode       = null;             // 'player' | 'gm' | null
    let _db         = null;             // Firestore reference
    let _unsubs     = [];               // Firebase listener cleanup
    let _stateUnsubs = [];              // RiftState listener cleanup

    // Per-character tracking
    const _chars = new Map();           // charId → { dirty: Map, timer: null, remoteVersion: {} }

    // Echo suppression: after we write to Firebase, ignore the next
    // onSnapshot for those exact fields to prevent write-back loops
    const _echoGuard = new Map();       // charId → Set<fieldPath>


    // ════════════════════════════════════════
    //  FIREBASE ACCESS
    // ════════════════════════════════════════

    function _getDb() {
        if (_db) return _db;
        _db = window.RIFT?.firebase?.getFirestore?.();
        return _db;
    }

    function _charRef(charId) {
        const db = _getDb();
        if (!db || !_roomCode) return null;
        return db.collection('rooms').doc(_roomCode).collection('characters').doc(charId);
    }

    function _charsCollection() {
        const db = _getDb();
        if (!db || !_roomCode) return null;
        return db.collection('rooms').doc(_roomCode).collection('characters');
    }


    // ════════════════════════════════════════
    //  ECHO GUARD
    //  Prevents: local write → onSnapshot → RiftState set → triggers write again
    // ════════════════════════════════════════

    function _guardEcho(charId, fields) {
        if (!_echoGuard.has(charId)) _echoGuard.set(charId, new Set());
        const guard = _echoGuard.get(charId);
        for (const f of fields) guard.add(f);

        // Auto-clear after a window (snapshot should arrive within this)
        setTimeout(() => {
            for (const f of fields) guard.delete(f);
        }, 2000);
    }

    function _isEchoed(charId, field) {
        const guard = _echoGuard.get(charId);
        if (!guard || !guard.has(field)) return false;
        guard.delete(field);
        return true;
    }


    // ════════════════════════════════════════
    //  PLAYER MODE: Watch single character
    // ════════════════════════════════════════

    /**
     * Start bidirectional sync for one character.
     * Called by the player's sheet after auth + room join.
     *
     * @param {string} charId - Character document ID
     * @param {string} roomCode - Room code (optional, falls back to RiftState)
     */
    function watchChar(charId, roomCode) {
        if (!charId) { console.warn(LOG_PREFIX, 'watchChar: no charId'); return; }

        _roomCode = roomCode || _roomCode || RIFT.state.get('room.code');
        if (!_roomCode) { console.warn(LOG_PREFIX, 'watchChar: no roomCode'); return; }

        _mode = 'player';

        _initCharTracker(charId);

        // 1. Firebase → RiftState (remote changes)
        _subscribeFirebase(charId);

        // 2. RiftState → Firebase (local changes)
        _subscribeState(charId);

        console.log(LOG_PREFIX, `Watching character ${charId} in room ${_roomCode}`);
        RIFT.state.emit('riftlink:connected', { charId, roomCode: _roomCode, mode: 'player' });
    }


    // ════════════════════════════════════════
    //  GM MODE: Watch all characters in room
    // ════════════════════════════════════════

    /**
     * Start watching all characters in a room.
     * Called by GM page on init.
     *
     * @param {string} roomCode
     */
    function watchRoom(roomCode) {
        _roomCode = roomCode || RIFT.state.get('room.code');
        if (!_roomCode) { console.warn(LOG_PREFIX, 'watchRoom: no roomCode'); return; }

        _mode = 'gm';

        const col = _charsCollection();
        if (!col) { console.warn(LOG_PREFIX, 'watchRoom: no Firestore'); return; }

        // Watch entire characters collection
        const unsub = col.onSnapshot(snap => {
            const allChars = {};

            snap.docs.forEach(doc => {
                const charId = doc.id;
                const data = doc.data();

                _initCharTracker(charId);

                // Store remote version
                const tracker = _chars.get(charId);
                tracker.remoteVersion = data;

                // Push to RiftState
                allChars[charId] = { id: charId, ...data };
                RIFT.state.set(`characters.${charId}`, { id: charId, ...data });
            });

            // Emit bulk event for GM panel rendering
            RIFT.state.set('characters._all', allChars);
            RIFT.state.emit('riftlink:characters', allChars);

            // Detect removals
            snap.docChanges().forEach(change => {
                if (change.type === 'removed') {
                    const removedId = change.doc.id;
                    _chars.delete(removedId);
                    RIFT.state.emit('riftlink:char:removed', { charId: removedId });
                }
            });
        }, err => {
            console.error(LOG_PREFIX, 'watchRoom error:', err);
        });

        _unsubs.push(unsub);

        console.log(LOG_PREFIX, `GM watching room ${_roomCode}`);
        RIFT.state.emit('riftlink:connected', { roomCode: _roomCode, mode: 'gm' });
    }


    // ════════════════════════════════════════
    //  FIREBASE → RIFTSTATE (inbound)
    // ════════════════════════════════════════

    function _subscribeFirebase(charId) {
        const ref = _charRef(charId);
        if (!ref) return;

        const unsub = ref.onSnapshot(snap => {
            if (!snap.exists) {
                console.warn(LOG_PREFIX, `Character ${charId} deleted from Firebase`);
                RIFT.state.emit('riftlink:char:removed', { charId });
                return;
            }

            const remote = snap.data();
            const tracker = _chars.get(charId);
            if (tracker) tracker.remoteVersion = remote;

            // Diff against current RiftState to find what actually changed remotely
            const local = RIFT.state.get(`characters.${charId}`) || {};
            const changed = _diffFlat(remote, local);

            if (changed.length === 0) return; // No real changes

            // Filter out echoed fields (changes we just wrote)
            const realChanges = changed.filter(path => !_isEchoed(charId, path));

            if (realChanges.length === 0) return;

            // Apply remote data to RiftState
            // Use full replace to ensure consistency
            RIFT.state.set(`characters.${charId}`, { id: charId, ...remote });

            RIFT.state.emit('riftlink:char:updated', {
                charId,
                fields: realChanges,
                origin: 'remote',
                data: remote
            });

            console.log(LOG_PREFIX, `← Remote update [${charId}]:`, realChanges.join(', '));

        }, err => {
            console.error(LOG_PREFIX, `Firebase watch error [${charId}]:`, err);
        });

        _unsubs.push(unsub);
    }


    // ════════════════════════════════════════
    //  RIFTSTATE → FIREBASE (outbound)
    // ════════════════════════════════════════

    function _subscribeState(charId) {
        // Listen for any change to this character's namespace in RiftState
        const unsub = RIFT.state.on(`characters.${charId}:changed`, (data) => {
            // Skip if this was a remote update we just applied
            if (!data || data._origin === 'remote') return;

            _queueWrite(charId, data);
        });

        _stateUnsubs.push(unsub);
    }

    /**
     * Queue a debounced write to Firebase.
     * Multiple rapid state changes get batched into one Firestore write.
     */
    function _queueWrite(charId, data) {
        const tracker = _chars.get(charId);
        if (!tracker) return;

        // Mark entire data as pending
        tracker.pendingData = data;

        // Debounce
        clearTimeout(tracker.writeTimer);
        tracker.writeTimer = setTimeout(() => {
            _flushWrite(charId);
        }, WRITE_DEBOUNCE_MS);
    }

    /**
     * Actually write pending changes to Firebase.
     */
    async function _flushWrite(charId) {
        const tracker = _chars.get(charId);
        if (!tracker || !tracker.pendingData) return;

        const ref = _charRef(charId);
        if (!ref) return;

        const data = { ...tracker.pendingData };
        tracker.pendingData = null;

        // Clean metadata fields
        for (const meta of META_FIELDS) delete data[meta];
        delete data.id; // Don't write doc ID as field

        // Compute which top-level fields changed vs remote
        const changedFields = _diffTopLevel(data, tracker.remoteVersion || {});
        if (changedFields.length === 0) return;

        // Build partial update (only changed top-level keys)
        const update = {};
        for (const key of changedFields) {
            update[key] = data[key];
        }

        // Add sync metadata
        update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        update.lastModifiedBy = RIFT.state.get('user.uid') || 'unknown';

        // Guard against echo
        _guardEcho(charId, changedFields);

        try {
            await ref.update(update);
            tracker.remoteVersion = { ...tracker.remoteVersion, ...update };
            console.log(LOG_PREFIX, `→ Wrote [${charId}]:`, changedFields.join(', '));
        } catch (err) {
            console.error(LOG_PREFIX, `Write failed [${charId}]:`, err);

            // If doc doesn't exist yet, create it
            if (err.code === 'not-found') {
                try {
                    await ref.set(data);
                    tracker.remoteVersion = data;
                    console.log(LOG_PREFIX, `→ Created [${charId}]`);
                } catch (setErr) {
                    console.error(LOG_PREFIX, `Create failed [${charId}]:`, setErr);
                }
            }
        }
    }


    // ════════════════════════════════════════
    //  DIRECT WRITE (for GM actions)
    // ════════════════════════════════════════

    /**
     * Write a value directly to Firebase for a character.
     * Used by GM panel for immediate stat modifications.
     * Bypasses debounce — writes immediately.
     *
     * @param {string} charId
     * @param {string} path - Dot-notation path within character (e.g. 'hp.current')
     * @param {*} value
     */
    async function write(charId, path, value) {
        const ref = _charRef(charId);
        if (!ref) { console.warn(LOG_PREFIX, 'write: no ref for', charId); return false; }

        // Build Firestore dot-path update
        const update = {
            [path]: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: RIFT.state.get('user.uid') || 'gm'
        };

        // Guard echo on local side too
        _guardEcho(charId, [path.split('.')[0]]);

        try {
            await ref.update(update);
            console.log(LOG_PREFIX, `→ Direct write [${charId}] ${path}:`, value);

            // Also update local RiftState immediately for responsive UI
            RIFT.state.set(`characters.${charId}.${path}`, value);

            RIFT.state.emit('riftlink:char:updated', {
                charId, fields: [path], origin: 'gm', data: { [path]: value }
            });

            return true;
        } catch (err) {
            console.error(LOG_PREFIX, `Direct write failed [${charId}]:`, err);
            return false;
        }
    }

    /**
     * Write multiple fields at once (batch).
     * @param {string} charId
     * @param {Object} updates - { 'hp.current': 50, 'hp.max': 100, ... }
     */
    async function writeBatch(charId, updates) {
        const ref = _charRef(charId);
        if (!ref) return false;

        const batch = {
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: RIFT.state.get('user.uid') || 'gm'
        };

        const topFields = [...new Set(Object.keys(updates).map(k => k.split('.')[0]))];
        _guardEcho(charId, topFields);

        try {
            await ref.update(batch);
            console.log(LOG_PREFIX, `→ Batch write [${charId}]:`, Object.keys(updates).join(', '));

            // Update RiftState
            for (const [path, val] of Object.entries(updates)) {
                RIFT.state.set(`characters.${charId}.${path}`, val);
            }

            RIFT.state.emit('riftlink:char:updated', {
                charId, fields: Object.keys(updates), origin: 'gm', data: updates
            });

            return true;
        } catch (err) {
            console.error(LOG_PREFIX, `Batch write failed [${charId}]:`, err);
            return false;
        }
    }

    /**
     * Write same field change to ALL characters in room.
     * Used for batch GM actions like "heal all 10 HP".
     *
     * @param {string} path - e.g. 'hp.current'
     * @param {Function} transformFn - (currentValue, charData) => newValue
     */
    async function writeAll(path, transformFn) {
        const allChars = RIFT.state.get('characters._all') || {};
        const results = [];

        for (const [charId, charData] of Object.entries(allChars)) {
            if (charId.startsWith('_')) continue; // skip meta keys
            const currentVal = _getNestedValue(charData, path);
            const newVal = transformFn(currentVal, charData);
            if (newVal !== currentVal) {
                results.push(write(charId, path, newVal));
            }
        }

        const settled = await Promise.allSettled(results);
        const ok = settled.filter(r => r.status === 'fulfilled' && r.value).length;
        console.log(LOG_PREFIX, `→ writeAll ${path}: ${ok}/${results.length} succeeded`);
        return ok;
    }


    // ════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════

    function _initCharTracker(charId) {
        if (_chars.has(charId)) return;
        _chars.set(charId, {
            remoteVersion: {},
            pendingData: null,
            writeTimer: null
        });
    }

    /**
     * Flat diff: find all dot-paths where two objects differ.
     * Used for inbound remote change detection.
     */
    function _diffFlat(a, b, prefix) {
        const changed = [];
        prefix = prefix || '';

        const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);

        for (const key of allKeys) {
            if (META_FIELDS.includes(key) || key === 'id') continue;

            const fullPath = prefix ? `${prefix}.${key}` : key;
            const va = a?.[key];
            const vb = b?.[key];

            if (va === vb) continue;

            if (va && vb && typeof va === 'object' && typeof vb === 'object'
                && !Array.isArray(va) && !Array.isArray(vb)) {
                // Recurse into objects (but not arrays — treat arrays as atomic)
                changed.push(..._diffFlat(va, vb, fullPath));
            } else if (JSON.stringify(va) !== JSON.stringify(vb)) {
                changed.push(fullPath);
            }
        }

        return changed;
    }

    /**
     * Top-level diff: find which top-level keys differ.
     * Used for outbound write optimization.
     */
    function _diffTopLevel(local, remote) {
        const changed = [];
        for (const key of Object.keys(local)) {
            if (META_FIELDS.includes(key) || key === 'id') continue;
            if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
                changed.push(key);
            }
        }
        return changed;
    }

    /**
     * Get nested value from object by dot-path.
     */
    function _getNestedValue(obj, path) {
        const parts = path.split('.');
        let val = obj;
        for (const p of parts) {
            if (val == null) return undefined;
            val = val[p];
        }
        return val;
    }


    // ════════════════════════════════════════
    //  LIFECYCLE
    // ════════════════════════════════════════

    /**
     * Disconnect all watchers and clean up.
     */
    function disconnect() {
        // Firebase listeners
        _unsubs.forEach(fn => { try { fn(); } catch(e) {} });
        _unsubs = [];

        // RiftState listeners
        _stateUnsubs.forEach(fn => { try { fn(); } catch(e) {} });
        _stateUnsubs = [];

        // Flush pending writes
        for (const [charId, tracker] of _chars) {
            if (tracker.writeTimer) {
                clearTimeout(tracker.writeTimer);
                _flushWrite(charId); // best-effort final write
            }
        }
        _chars.clear();
        _echoGuard.clear();

        _mode = null;
        console.log(LOG_PREFIX, 'Disconnected');
        RIFT.state.emit('riftlink:disconnected', null);
    }

    /**
     * Get connection status.
     */
    function status() {
        return {
            connected: _unsubs.length > 0,
            mode: _mode,
            roomCode: _roomCode,
            characters: [..._chars.keys()],
            pendingWrites: [..._chars.entries()]
                .filter(([, t]) => t.pendingData !== null)
                .map(([id]) => id)
        };
    }


    // ════════════════════════════════════════
    //  EXPOSE API
    // ════════════════════════════════════════

    window.RIFT = window.RIFT || {};
    window.RIFT.link = {
        // Player mode
        watchChar,

        // GM mode
        watchRoom,

        // Direct writes (GM)
        write,
        writeBatch,
        writeAll,

        // Lifecycle
        disconnect,
        status,

        // Constants (for external tuning)
        get WRITE_DEBOUNCE_MS() { return WRITE_DEBOUNCE_MS; },
    };

    console.log(LOG_PREFIX, 'Ready');

})();

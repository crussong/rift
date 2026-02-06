/**
 * RIFT v2 - Pro Status Service
 * Central helper for RIFT Pro feature gating, limits, and theme access.
 * 
 * This is the single source of truth for whether a user has Pro.
 * All other code should use RIFT.pro.isPro, RIFT.pro.getLimit(), etc.
 * 
 * Firestore Structure:
 * 
 * /users/{uid}
 *   pro: {
 *     active: boolean,
 *     plan: 'monthly' | 'yearly' | 'trial' | 'gift' | 'team',
 *     since: Timestamp,
 *     expiresAt: Timestamp,
 *     stripeCustomerId: string | null,
 *     teamLicenseId: string | null,
 *     giftedBy: string | null,
 *   }
 * 
 * /pro_config/feature_flags   → { diceThemes130: true, backupExport: true, ... }
 * /pro_config/limits          → { free: { ... }, pro: { ... } }
 * /pro_config/theme_gating    → { dice: { themeId: true/false }, ... }
 * /pro_config/trial           → { enabled: boolean, duration: number }
 * 
 * Usage:
 *   await RIFT.pro.init(uid);
 *   if (RIFT.pro.isPro) { ... }
 *   const max = RIFT.pro.getLimit('sessionsPerRoom');
 *   const allowed = RIFT.pro.canUseTheme('dice', 'galaxy_purple');
 *   const canCreate = await RIFT.pro.checkLimit('sessionsPerRoom', currentCount);
 */

// ========================================
// INTERNAL STATE
// ========================================

const _proState = {
    initialized: false,
    uid: null,
    
    // User Pro status
    active: false,
    plan: null,         // monthly | yearly | trial | gift | team
    since: null,
    expiresAt: null,
    
    // Cached config from Firestore (pro_config collection)
    limits: null,       // { free: {...}, pro: {...} }
    featureFlags: null,  // { diceThemes130: true, ... }
    themeGating: null,   // { dice: {...}, number: {...}, arena: {...} }
    trialConfig: null,   // { enabled: boolean, duration: number }
    
    // Listeners
    _listeners: [],
    _userUnsubscribe: null,
};

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize Pro Status for a user.
 * Call this once after auth is confirmed (e.g. in initAuthListener callback).
 * 
 * @param {string} uid - Firebase user UID
 * @returns {Promise<boolean>} - Whether user has active Pro
 */
async function initProStatus(uid) {
    if (!uid) {
        _resetState();
        return false;
    }
    
    const db = RIFT.firebase.getFirestore();
    if (!db) {
        console.error('[ProStatus] Firestore not available');
        return false;
    }
    
    _proState.uid = uid;
    
    try {
        // Load everything in parallel
        const [userDoc, limitsDoc, flagsDoc, gatingDoc, trialDoc] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('pro_config').doc('limits').get(),
            db.collection('pro_config').doc('feature_flags').get(),
            db.collection('pro_config').doc('theme_gating').get(),
            db.collection('pro_config').doc('trial').get(),
        ]);
        
        // --- User Pro Status ---
        const userData = userDoc.data();
        const pro = userData?.pro || {};
        
        _proState.active = _isProActive(pro);
        _proState.plan = pro.plan || null;
        _proState.since = pro.since || null;
        _proState.expiresAt = pro.expiresAt || null;
        
        // Also check Custom Claims on the auth token (set by Cloud Functions)
        const token = await _getTokenClaims();
        if (token?.pro === true && !_proState.active) {
            // Custom Claim says Pro but Firestore doesn't – trust the claim
            // (This handles edge cases where Firestore write was delayed)
            _proState.active = true;
            _proState.plan = token.proPlan || 'unknown';
        }
        
        // --- Pro Config ---
        _proState.limits = limitsDoc.exists ? limitsDoc.data() : _defaultLimits();
        _proState.featureFlags = flagsDoc.exists ? flagsDoc.data() : {};
        _proState.themeGating = gatingDoc.exists ? gatingDoc.data() : {};
        _proState.trialConfig = trialDoc.exists ? trialDoc.data() : { enabled: false, duration: 14 };
        
        _proState.initialized = true;
        
        // Cache to localStorage for offline/fast access
        _saveToCache();
        
        // Set up real-time listener for status changes (upgrades, cancellations)
        _listenForChanges(uid);
        
        console.log(`[ProStatus] Initialized – isPro: ${_proState.active}, plan: ${_proState.plan}`);
        _notifyListeners();
        
        return _proState.active;
        
    } catch (error) {
        console.error('[ProStatus] Init error:', error);
        
        // Try loading from cache as fallback
        _loadFromCache();
        
        return _proState.active;
    }
}

/**
 * Reset state on sign-out
 */
function destroyProStatus() {
    if (_proState._userUnsubscribe) {
        _proState._userUnsubscribe();
        _proState._userUnsubscribe = null;
    }
    _resetState();
    _notifyListeners();
    console.log('[ProStatus] Destroyed');
}

// ========================================
// PUBLIC API – STATUS CHECKS
// ========================================

/**
 * Whether the current user has an active Pro subscription.
 * @returns {boolean}
 */
function getIsPro() {
    return _proState.active === true;
}

/**
 * Get the current plan type.
 * @returns {string|null} 'monthly', 'yearly', 'trial', 'gift', 'team', or null
 */
function getProPlan() {
    return _proState.plan;
}

/**
 * Whether the user is on a trial.
 * @returns {boolean}
 */
function getIsTrial() {
    return _proState.active && _proState.plan === 'trial';
}

/**
 * Get days remaining on current plan (relevant for trials).
 * @returns {number|null} Days remaining, or null if no expiry
 */
function getDaysRemaining() {
    if (!_proState.expiresAt) return null;
    const expires = _proState.expiresAt.toDate ? _proState.expiresAt.toDate() : new Date(_proState.expiresAt);
    const diff = expires - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Full status object for display purposes.
 * @returns {object}
 */
function getProDetails() {
    return {
        active: _proState.active,
        plan: _proState.plan,
        since: _proState.since,
        expiresAt: _proState.expiresAt,
        daysRemaining: getDaysRemaining(),
        isTrial: getIsTrial(),
    };
}

// ========================================
// PUBLIC API – LIMITS
// ========================================

/**
 * Get a specific limit value for the current tier.
 * Returns Infinity for unlimited (value = 0 in config).
 * 
 * @param {string} key - Limit key (e.g. 'sessionsPerRoom', 'participantsPerRoom')
 * @returns {number}
 */
function getLimit(key) {
    const tier = _proState.active ? 'pro' : 'free';
    const limits = _proState.limits || _defaultLimits();
    const val = limits[tier]?.[key];
    
    if (val === undefined || val === null) {
        console.warn(`[ProStatus] Unknown limit key: ${key}`);
        return 1; // Safe fallback
    }
    
    return val === 0 ? Infinity : val;
}

/**
 * Check if a specific count is within the allowed limit.
 * Useful before creating sessions, characters, etc.
 * 
 * @param {string} key - Limit key
 * @param {number} currentCount - Current count
 * @returns {boolean} true if another can be added
 */
function checkLimit(key, currentCount) {
    return currentCount < getLimit(key);
}

/**
 * Get both Free and Pro limits for a key (useful for upsell messaging).
 * 
 * @param {string} key - Limit key
 * @returns {{ free: number, pro: number }}
 */
function getLimitComparison(key) {
    const limits = _proState.limits || _defaultLimits();
    const freeVal = limits.free?.[key] ?? 1;
    const proVal = limits.pro?.[key] ?? 0;
    return {
        free: freeVal === 0 ? Infinity : freeVal,
        pro: proVal === 0 ? Infinity : proVal,
    };
}

// ========================================
// PUBLIC API – FEATURE FLAGS
// ========================================

/**
 * Check if a specific feature is Pro-only.
 * If the feature flag exists and is true, it's a Pro feature.
 * 
 * @param {string} flagKey - Feature flag key (e.g. 'backupExport', 'campaigns')
 * @returns {boolean} true if the feature requires Pro
 */
function isProFeature(flagKey) {
    return _proState.featureFlags?.[flagKey] === true;
}

/**
 * Check if the current user can access a Pro feature.
 * Returns true if: feature is not Pro-gated, OR user has Pro.
 * 
 * @param {string} flagKey - Feature flag key
 * @returns {boolean}
 */
function canUseFeature(flagKey) {
    if (!isProFeature(flagKey)) return true; // Not gated
    return _proState.active === true;
}

// ========================================
// PUBLIC API – THEME GATING
// ========================================

/**
 * Check if a specific theme is available to the current user.
 * 
 * @param {string} type - Theme type: 'dice', 'number', or 'arena'
 * @param {string} themeId - Theme document ID
 * @returns {boolean}
 */
function canUseTheme(type, themeId) {
    if (_proState.active) return true; // Pro users get everything
    
    const gating = _proState.themeGating?.[type];
    if (!gating) return true; // No gating configured = all free
    
    // If gating[themeId] === false, it's free. If true or undefined, it's Pro.
    // Convention: true = Pro (locked), false = Free (unlocked)
    // Default for themes not in the gating map: Pro (locked)
    return gating[themeId] === false;
}

/**
 * Get all accessible theme IDs for the current user.
 * 
 * @param {string} type - Theme type: 'dice', 'number', or 'arena'
 * @param {string[]} allThemeIds - All available theme IDs
 * @returns {string[]} Accessible theme IDs
 */
function getAccessibleThemes(type, allThemeIds) {
    if (_proState.active) return allThemeIds;
    
    const gating = _proState.themeGating?.[type] || {};
    return allThemeIds.filter(id => gating[id] === false);
}

/**
 * Check if a theme is Pro-exclusive (for showing lock icons).
 * 
 * @param {string} type - Theme type
 * @param {string} themeId - Theme document ID
 * @returns {boolean} true if Pro-exclusive
 */
function isProTheme(type, themeId) {
    const gating = _proState.themeGating?.[type];
    if (!gating) return false;
    return gating[themeId] !== false; // true or undefined = Pro
}

// ========================================
// PUBLIC API – UPSELL HELPERS
// ========================================

/**
 * Show a Pro upsell prompt. Pages can override this with a custom handler.
 * 
 * @param {string} reason - Why the feature is locked
 * @param {object} [opts] - Optional context
 * @param {string} [opts.feature] - Feature name for tracking
 * @param {string} [opts.limitKey] - Which limit was hit
 */
function showUpsell(reason, opts = {}) {
    // Fire event for tracking
    _notifyListeners({ type: 'upsell', reason, ...opts });
    
    // Default: use toast if available, link to riftpro.html
    if (typeof showToast === 'function') {
        showToast(`⭐ ${reason}`, 'info');
    }
    
    // Custom handler (pages can set RIFT.pro.onUpsell)
    if (typeof _proState._upsellHandler === 'function') {
        _proState._upsellHandler(reason, opts);
    }
    
    console.log(`[ProStatus] Upsell: ${reason}`, opts);
}

/**
 * Convenience: check a limit and show upsell if exceeded.
 * Returns true if action is allowed.
 * 
 * @param {string} key - Limit key
 * @param {number} currentCount - Current count
 * @param {string} [message] - Custom upsell message
 * @returns {boolean}
 */
function checkLimitOrUpsell(key, currentCount, message) {
    if (checkLimit(key, currentCount)) return true;
    
    const comparison = getLimitComparison(key);
    const defaultMsg = `Limit erreicht (${currentCount}/${comparison.free}). Mit RIFT Pro: bis zu ${comparison.pro === Infinity ? '∞' : comparison.pro}.`;
    showUpsell(message || defaultMsg, { limitKey: key });
    return false;
}

/**
 * Convenience: check a feature flag and show upsell if locked.
 * Returns true if feature is accessible.
 * 
 * @param {string} flagKey - Feature flag key
 * @param {string} [message] - Custom upsell message
 * @returns {boolean}
 */
function checkFeatureOrUpsell(flagKey, message) {
    if (canUseFeature(flagKey)) return true;
    showUpsell(message || `Diese Funktion ist Teil von RIFT Pro.`, { feature: flagKey });
    return false;
}

// ========================================
// PUBLIC API – LISTENERS
// ========================================

/**
 * Register a listener for Pro status changes.
 * Called on init, on real-time status updates, and on upsell events.
 * 
 * @param {function} callback - Called with { isPro, plan, event? }
 * @returns {function} Unsubscribe function
 */
function onProStatusChange(callback) {
    _proState._listeners.push(callback);
    
    // Immediately fire with current state if initialized
    if (_proState.initialized) {
        callback({ isPro: _proState.active, plan: _proState.plan });
    }
    
    return () => {
        _proState._listeners = _proState._listeners.filter(l => l !== callback);
    };
}

/**
 * Set a custom upsell handler (for modals, banners etc.)
 * 
 * @param {function} handler - Called with (reason, opts)
 */
function setUpsellHandler(handler) {
    _proState._upsellHandler = handler;
}

// ========================================
// INTERNAL HELPERS
// ========================================

/**
 * Determine if Pro is active based on Firestore user data.
 */
function _isProActive(proData) {
    if (!proData || proData.active !== true) return false;
    
    // Check expiration
    if (proData.expiresAt) {
        const expires = proData.expiresAt.toDate ? proData.expiresAt.toDate() : new Date(proData.expiresAt);
        if (expires <= new Date()) return false;
    }
    
    return true;
}

/**
 * Get Custom Claims from the Firebase auth token.
 */
async function _getTokenClaims() {
    try {
        const auth = RIFT.firebase.getAuth();
        const user = auth?.currentUser;
        if (!user) return null;
        
        const tokenResult = await user.getIdTokenResult(true); // force refresh
        return tokenResult.claims || {};
    } catch (e) {
        console.warn('[ProStatus] Could not read token claims:', e);
        return null;
    }
}

/**
 * Listen for real-time changes to user's Pro status.
 */
function _listenForChanges(uid) {
    if (_proState._userUnsubscribe) {
        _proState._userUnsubscribe();
    }
    
    const db = RIFT.firebase.getFirestore();
    if (!db) return;
    
    _proState._userUnsubscribe = db.collection('users').doc(uid)
        .onSnapshot(doc => {
            if (!doc.exists) return;
            
            const pro = doc.data()?.pro || {};
            const wasActive = _proState.active;
            _proState.active = _isProActive(pro);
            _proState.plan = pro.plan || null;
            _proState.since = pro.since || null;
            _proState.expiresAt = pro.expiresAt || null;
            
            if (wasActive !== _proState.active) {
                console.log(`[ProStatus] Status changed: ${wasActive} → ${_proState.active}`);
                _saveToCache();
                _notifyListeners({ type: 'statusChange', from: wasActive, to: _proState.active });
            }
        }, err => {
            console.warn('[ProStatus] Listener error:', err);
        });
}

/**
 * Notify all registered listeners.
 */
function _notifyListeners(event = {}) {
    const payload = { isPro: _proState.active, plan: _proState.plan, ...event };
    _proState._listeners.forEach(cb => {
        try { cb(payload); } catch (e) { console.error('[ProStatus] Listener error:', e); }
    });
}

/**
 * Default limits fallback if pro_config/limits doesn't exist yet.
 */
function _defaultLimits() {
    return {
        free: {
            activeSessions: 2,      // GM or player, across all rooms, not ended
            charsPerRuleset: 2,      // Characters per ruleset
            sessionsPerRoom: 2,
            participantsPerRoom: 6,
            participantsPerSession: 6,
            charsPerRoom: 1,
            mapsPerRoom: 3,          // World/environment maps per room
            chatImageUpload: false,  // false = disabled for free
            pdfExport: false,        // false = disabled for free
            diceThemes: 10,
            numberThemes: 6,
            arenaThemes: 12,
        },
        pro: {
            activeSessions: 0,      // 0 = unlimited
            charsPerRuleset: 5,
            sessionsPerRoom: 5,
            participantsPerRoom: 10,
            participantsPerSession: 10,
            charsPerRoom: 3,
            mapsPerRoom: 0,          // 0 = unlimited
            chatImageUpload: true,   // true = enabled for pro
            pdfExport: true,         // true = enabled for pro
            diceThemes: 0,          // 0 = all
            numberThemes: 0,
            arenaThemes: 0,
        }
    };
}

/**
 * Reset internal state.
 */
function _resetState() {
    _proState.initialized = false;
    _proState.uid = null;
    _proState.active = false;
    _proState.plan = null;
    _proState.since = null;
    _proState.expiresAt = null;
    // Keep config cached – it doesn't change per user
}

// ========================================
// LOCAL CACHE (offline / fast load)
// ========================================

const PRO_CACHE_KEY = 'rift_pro_status';

function _saveToCache() {
    try {
        localStorage.setItem(PRO_CACHE_KEY, JSON.stringify({
            uid: _proState.uid,
            active: _proState.active,
            plan: _proState.plan,
            expiresAt: _proState.expiresAt,
            limits: _proState.limits,
            featureFlags: _proState.featureFlags,
            themeGating: _proState.themeGating,
            cachedAt: Date.now(),
        }));
    } catch (e) { /* localStorage full or unavailable */ }
}

function _loadFromCache() {
    try {
        const raw = localStorage.getItem(PRO_CACHE_KEY);
        if (!raw) return;
        
        const cached = JSON.parse(raw);
        
        // Only use cache if it's for the same user and less than 1 hour old
        if (cached.uid !== _proState.uid) return;
        if (Date.now() - cached.cachedAt > 3600000) return;
        
        _proState.active = cached.active || false;
        _proState.plan = cached.plan || null;
        _proState.expiresAt = cached.expiresAt || null;
        _proState.limits = cached.limits || _defaultLimits();
        _proState.featureFlags = cached.featureFlags || {};
        _proState.themeGating = cached.themeGating || {};
        _proState.initialized = true;
        
        console.log('[ProStatus] Loaded from cache (offline fallback)');
    } catch (e) { /* corrupted cache */ }
}

// ========================================
// ADMIN: SET PRO STATUS (for Admin Panel)
// ========================================

/**
 * Grant Pro to a user (from Admin Panel).
 * In production this should be a Cloud Function, but for bootstrapping
 * this allows the admin to set Pro directly.
 * 
 * @param {string} uid - Target user UID
 * @param {object} proData - Pro configuration
 */
async function adminSetProStatus(uid, proData) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firestore not available');
    
    const data = {
        active: proData.active !== false,
        plan: proData.plan || 'monthly',
        since: proData.since || firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: proData.expiresAt || null,
        grantedBy: _proState.uid, // Admin UID
        grantedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    
    // Write to user document
    await db.collection('users').doc(uid).set({ pro: data }, { merge: true });
    
    // Also write to pro_subscribers for admin dashboard
    await db.collection('pro_subscribers').doc(uid).set({
        ...data,
        uid: uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    console.log(`[ProStatus] Admin granted Pro to ${uid}:`, data);
}

/**
 * Revoke Pro from a user (from Admin Panel).
 */
async function adminRevokeProStatus(uid) {
    const db = RIFT.firebase.getFirestore();
    if (!db) throw new Error('Firestore not available');
    
    await db.collection('users').doc(uid).set({
        pro: {
            active: false,
            revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
            revokedBy: _proState.uid,
        }
    }, { merge: true });
    
    await db.collection('pro_subscribers').doc(uid).update({
        active: false,
        revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`[ProStatus] Admin revoked Pro from ${uid}`);
}

// ========================================
// HELPERS: SESSION & CHARACTER COUNTING
// ========================================

/**
 * Count active (non-ended) sessions owned by or involving the current user.
 * Checks both localStorage and Firebase subscribed sessions.
 * 
 * @param {object[]} [firebaseSessions] - Optional array of sessions from Firebase subscription
 * @returns {number}
 */
function getActiveSessionCount(firebaseSessions) {
    const uid = _proState.uid;
    if (!uid) return 0;
    
    let count = 0;
    const countedIds = new Set();
    
    // Count from Firebase sessions (if provided by the calling page)
    if (Array.isArray(firebaseSessions)) {
        firebaseSessions.forEach(s => {
            if (s.status === 'ended') return;
            if (s.ownerId === uid || (s.participants && s.participants[uid])) {
                countedIds.add(s.id);
                count++;
            }
        });
    }
    
    // Also count from localStorage (catches sessions from other rooms)
    try {
        const stored = JSON.parse(localStorage.getItem('rift_sessions') || '[]');
        stored.forEach(s => {
            if (countedIds.has(s.id)) return; // Already counted from Firebase
            if (s.status === 'ended') return;
            if (s.ownerId === uid) {
                count++;
            }
        });
    } catch (e) { /* corrupted localStorage */ }
    
    return count;
}

// ========================================
// EXPORT
// ========================================

if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.pro = {
        // Lifecycle
        init: initProStatus,
        destroy: destroyProStatus,
        
        // Status (getter properties don't work on plain objects, so use functions)
        get isPro() { return getIsPro(); },
        get plan() { return getProPlan(); },
        get isTrial() { return getIsTrial(); },
        get daysRemaining() { return getDaysRemaining(); },
        get details() { return getProDetails(); },
        get initialized() { return _proState.initialized; },
        
        // Limits
        getLimit,
        checkLimit,
        getLimitComparison,
        
        // Features
        isProFeature,
        canUseFeature,
        
        // Themes
        canUseTheme,
        getAccessibleThemes,
        isProTheme,
        
        // Upsell
        showUpsell,
        checkLimitOrUpsell,
        checkFeatureOrUpsell,
        setUpsellHandler,
        
        // Events
        onStatusChange: onProStatusChange,
        
        // Admin
        adminSetPro: adminSetProStatus,
        adminRevokePro: adminRevokeProStatus,
        
        // Counting helpers
        getActiveSessionCount,
    };
}

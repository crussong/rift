/**
 * RIFT v2 - Firebase Configuration
 * Production Firebase Project: rift-app-de805
 */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcoId9a62tLIqIRFaFt_ADMTedTUzf3f8",
    authDomain: "rift-app-de805.firebaseapp.com",
    databaseURL: "https://rift-app-de805-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rift-app-de805",
    storageBucket: "rift-app-de805.firebasestorage.app",
    messagingSenderId: "974596929896",
    appId: "1:974596929896:web:a6542045dae21899d07edd"
};

// Firebase instances
let app = null;
let auth = null;
let db = null;          // Firestore
let rtdb = null;        // Realtime Database (für Presence)

/**
 * Initialize Firebase with all services
 */
async function initFirebase() {
    if (app) {
        console.log('[Firebase] Already initialized');
        return { app, auth, db, rtdb };
    }
    
    try {
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.error('[Firebase] SDK not loaded');
            return null;
        }
        
        // Initialize app
        app = firebase.initializeApp(firebaseConfig);
        
        // Initialize services
        auth = firebase.auth();
        db = firebase.firestore();
        rtdb = firebase.database();
        
        // Firestore settings
        db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
        });
        
        // Enable offline persistence
        await db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('[Firebase] Persistence failed: Multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('[Firebase] Persistence not available');
            }
        });
        
        console.log('[Firebase] Initialized successfully');
        return { app, auth, db, rtdb };
        
    } catch (error) {
        console.error('[Firebase] Init error:', error);
        return null;
    }
}

/**
 * Get current authenticated user
 */
function getCurrentUser() {
    return auth?.currentUser || null;
}

/**
 * Sign in anonymously (for guests)
 */
async function signInAnonymously() {
    if (!auth) await initFirebase();
    
    try {
        const result = await auth.signInAnonymously();
        console.log('[Firebase] Anonymous sign-in:', result.user.uid);
        return result.user;
    } catch (error) {
        console.error('[Firebase] Anonymous sign-in error:', error);
        throw error;
    }
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
    if (!auth) await initFirebase();
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        console.log('[Firebase] Google sign-in:', result.user.displayName);
        return result.user;
    } catch (error) {
        console.error('[Firebase] Google sign-in error:', error);
        throw error;
    }
}

/**
 * Sign out
 */
async function signOut() {
    if (!auth) return;
    
    try {
        await auth.signOut();
        console.log('[Firebase] Signed out');
    } catch (error) {
        console.error('[Firebase] Sign-out error:', error);
        throw error;
    }
}

/**
 * Listen to auth state changes
 */
function onAuthStateChanged(callback) {
    if (!auth) {
        // Auth not ready yet, initialize first
        initFirebase().then(() => {
            if (auth) {
                auth.onAuthStateChanged(callback);
            }
        });
        return () => {}; // Return empty unsubscribe
    }
    return auth.onAuthStateChanged(callback);
}

// ========================================
// EXPORT
// ========================================

if (typeof window !== 'undefined') {
    window.RIFT = window.RIFT || {};
    window.RIFT.firebase = {
        init: initFirebase,
        config: firebaseConfig,
        // Auth
        getCurrentUser,
        signInAnonymously,
        signInWithGoogle,
        signOut,
        onAuthStateChanged,
        // Getters
        getApp: () => app,
        getAuth: () => auth,
        getFirestore: () => db,
        getDatabase: () => rtdb
    };
}

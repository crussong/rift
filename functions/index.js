/**
 * RIFT v2 - Firebase Cloud Functions
 * Room Cleanup & Management
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.database();

// ========================================
// ROOM CLEANUP - 60 Tage Inaktivität
// ========================================

/**
 * Läuft täglich um 3:00 Uhr nachts (UTC)
 * Löscht alle Räume die seit 60 Tagen inaktiv sind
 */
exports.cleanupInactiveRooms = functions.pubsub
    .schedule('0 3 * * *')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const now = Date.now();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000; // 60 Tage in Millisekunden
        const cutoffTime = now - sixtyDaysMs;
        
        console.log(`[CLEANUP] Starting room cleanup. Cutoff: ${new Date(cutoffTime).toISOString()}`);
        
        try {
            const roomsRef = db.ref('rooms');
            const snapshot = await roomsRef.once('value');
            
            if (!snapshot.exists()) {
                console.log('[CLEANUP] No rooms found');
                return null;
            }
            
            const rooms = snapshot.val();
            const deletePromises = [];
            let deletedCount = 0;
            let skippedCount = 0;
            
            for (const [code, room] of Object.entries(rooms)) {
                const lastActivity = room.lastActivity || room.createdAt || 0;
                
                if (lastActivity < cutoffTime) {
                    console.log(`[CLEANUP] Deleting room ${code} - Last activity: ${new Date(lastActivity).toISOString()}`);
                    deletePromises.push(roomsRef.child(code).remove());
                    deletedCount++;
                } else {
                    skippedCount++;
                }
            }
            
            await Promise.all(deletePromises);
            
            console.log(`[CLEANUP] Complete. Deleted: ${deletedCount}, Kept: ${skippedCount}`);
            
            // Optional: Log to admin collection for monitoring
            await db.ref('admin/cleanup_logs').push({
                timestamp: admin.database.ServerValue.TIMESTAMP,
                deleted: deletedCount,
                kept: skippedCount,
                cutoffDate: cutoffTime
            });
            
            return null;
        } catch (error) {
            console.error('[CLEANUP] Error:', error);
            throw error;
        }
    });

// ========================================
// ROOM DELETION BY GM
// ========================================

/**
 * Callable Function - GM kann Raum löschen
 * Prüft ob der aufrufende User tatsächlich GM ist
 */
exports.deleteRoom = functions.https.onCall(async (data, context) => {
    const { roomCode, userId } = data;
    
    if (!roomCode || !userId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'roomCode und userId sind erforderlich'
        );
    }
    
    try {
        const roomRef = db.ref(`rooms/${roomCode}`);
        const snapshot = await roomRef.once('value');
        
        if (!snapshot.exists()) {
            throw new functions.https.HttpsError(
                'not-found',
                'Raum nicht gefunden'
            );
        }
        
        const room = snapshot.val();
        const player = room.players?.[userId];
        
        // Prüfen ob User GM oder Host ist
        if (!player || (!player.isGM && !player.isHost)) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Nur der GM oder Host kann den Raum löschen'
            );
        }
        
        // Raum löschen
        await roomRef.remove();
        
        console.log(`[DELETE] Room ${roomCode} deleted by ${userId}`);
        
        return { success: true, message: 'Raum wurde gelöscht' };
        
    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('[DELETE] Error:', error);
        throw new functions.https.HttpsError('internal', 'Fehler beim Löschen des Raums');
    }
});

// ========================================
// PENDING ROOM CLEANUP
// ========================================

/**
 * Läuft stündlich
 * Löscht Räume im "pending" Status die älter als 1 Stunde sind
 * (Host hat Setup nie abgeschlossen)
 */
exports.cleanupPendingRooms = functions.pubsub
    .schedule('0 * * * *')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;
        const cutoffTime = now - oneHourMs;
        
        console.log(`[PENDING CLEANUP] Starting. Cutoff: ${new Date(cutoffTime).toISOString()}`);
        
        try {
            const roomsRef = db.ref('rooms');
            const snapshot = await roomsRef
                .orderByChild('status')
                .equalTo('pending')
                .once('value');
            
            if (!snapshot.exists()) {
                console.log('[PENDING CLEANUP] No pending rooms found');
                return null;
            }
            
            const rooms = snapshot.val();
            const deletePromises = [];
            let deletedCount = 0;
            
            for (const [code, room] of Object.entries(rooms)) {
                const createdAt = room.createdAt || 0;
                
                if (createdAt < cutoffTime) {
                    console.log(`[PENDING CLEANUP] Deleting abandoned room ${code}`);
                    deletePromises.push(roomsRef.child(code).remove());
                    deletedCount++;
                }
            }
            
            await Promise.all(deletePromises);
            
            console.log(`[PENDING CLEANUP] Complete. Deleted: ${deletedCount} abandoned rooms`);
            
            return null;
        } catch (error) {
            console.error('[PENDING CLEANUP] Error:', error);
            throw error;
        }
    });

// ========================================
// UPDATE ACTIVITY TIMESTAMP
// ========================================

/**
 * Database Trigger - Updated lastActivity bei jeder Änderung im Raum
 */
exports.updateRoomActivity = functions.database
    .ref('/rooms/{roomCode}/players/{userId}')
    .onWrite(async (change, context) => {
        const { roomCode } = context.params;
        
        // Nur wenn nicht gelöscht wird
        if (change.after.exists()) {
            await db.ref(`rooms/${roomCode}/lastActivity`).set(
                admin.database.ServerValue.TIMESTAMP
            );
        }
        
        return null;
    });

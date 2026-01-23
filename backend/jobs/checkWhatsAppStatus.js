const db = require('../config/database');
const { checkWhatsAppMessageStatus } = require('../services/whatsappService');

/**
 * Background job to check status of queued/sent WhatsApp messages
 * Call this function periodically (e.g., every 5 minutes via cron or setInterval)
 */
async function checkPendingMessages() {
  try {
    // Get messages that are still queued or sent (not final status)
    const [messages] = await db.query(
      `SELECT id, queue_id, status, created_at 
       FROM whatsapp_messages 
       WHERE status IN ('queued', 'sent') 
       AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY created_at DESC
       LIMIT 100`
    );

    if (messages.length === 0) {
      return;
    }

    console.log(`[WhatsApp Status Check] Checking ${messages.length} pending messages...`);

    let updated = 0;
    for (const message of messages) {
      try {
        const statusCheck = await checkWhatsAppMessageStatus(message.queue_id);

        if (statusCheck.success && statusCheck.status !== message.status) {
          await db.query(
            `UPDATE whatsapp_messages 
             SET status = ?, 
                 status_updated_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?`,
            [statusCheck.status, message.id]
          );

          updated++;
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Updated message ${message.queue_id}: ${message.status} → ${statusCheck.status}`);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error checking message ${message.queue_id}:`, error.message);
      }
    }

    if (updated > 0) {
      console.log(`[WhatsApp Status Check] Updated ${updated} message statuses`);
    }
  } catch (error) {
    console.error('[WhatsApp Status Check] Error:', error);
  }
}

// Auto-run if enabled via environment variable
if (process.env.ENABLE_WHATSAPP_STATUS_CHECK === 'true') {
  // Run every 5 minutes
  setInterval(checkPendingMessages, 5 * 60 * 1000);
  
  // Run once on startup after 1 minute
  setTimeout(checkPendingMessages, 60 * 1000);
  
  console.log('✅ WhatsApp status check job enabled (runs every 5 minutes)');
}

module.exports = { checkPendingMessages };






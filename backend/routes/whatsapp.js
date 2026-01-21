const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkWhatsAppMessageStatus } = require('../services/whatsappService');
const db = require('../config/database');

// Check message status by queue_id
router.get('/status/:queueId', authenticateToken, async (req, res) => {
  try {
    const { queueId } = req.params;
    const schoolId = req.user.schoolId;

    // First check database
    const [messages] = await db.query(
      'SELECT * FROM whatsapp_messages WHERE queue_id = ? AND school_id = ?',
      [queueId, schoolId]
    );

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[0];

    // If status is already final (delivered, read, failed), return cached status
    if (['delivered', 'read', 'failed'].includes(message.status)) {
      return res.json({
        success: true,
        queueId: message.queue_id,
        status: message.status,
        updatedAt: message.status_updated_at,
        error: message.error_message || null
      });
    }

    // Check with API if status is still queued or sent
    const statusCheck = await checkWhatsAppMessageStatus(queueId);

    if (statusCheck.success) {
      // Update database with new status
      await db.query(
        `UPDATE whatsapp_messages 
         SET status = ?, 
             status_updated_at = NOW(),
             updated_at = NOW()
         WHERE queue_id = ?`,
        [statusCheck.status, queueId]
      );

      return res.json({
        success: true,
        queueId: queueId,
        status: statusCheck.status,
        updatedAt: new Date().toISOString()
      });
    } else {
      // API check failed, but return current database status
      return res.json({
        success: true,
        queueId: queueId,
        status: message.status,
        updatedAt: message.status_updated_at,
        note: 'Status check API unavailable, showing last known status'
      });
    }
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ error: 'Failed to check message status' });
  }
});

// Get all messages for a school (admin only)
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = 'SELECT * FROM whatsapp_messages WHERE school_id = ?';
    const params = [schoolId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [messages] = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM whatsapp_messages WHERE school_id = ?';
    const countParams = [schoolId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      messages: messages,
      total: total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Webhook verification endpoint (GET) - Meta/WhatsApp sends GET for verification
router.get('/webhook', (req, res) => {
  try {
    // Meta/WhatsApp webhook verification
    // They send: GET /webhook?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=YOUR_TOKEN
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify token (set this in your .env)
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'your_webhook_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified successfully');
      // Return the challenge to complete verification
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed', { 
        mode, 
        receivedToken: token, 
        expectedToken: verifyToken ? '***' : 'not set' 
      });
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Error');
  }
});

// Webhook endpoint for status updates (POST) - if 1automations.com supports it
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature if provided
    const signature = req.headers['x-hub-signature-256'];
    
    // Parse webhook payload
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Handle different webhook event types
    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.value?.statuses && Array.isArray(change.value.statuses)) {
              // Process status updates
              for (const statusUpdate of change.value.statuses) {
                const messageId = statusUpdate.id;
                const status = statusUpdate.status; // sent, delivered, read, failed
                const timestamp = statusUpdate.timestamp;

                // Update database
                await db.query(
                  `UPDATE whatsapp_messages 
                   SET status = ?, 
                       status_updated_at = FROM_UNIXTIME(?),
                       updated_at = NOW()
                   WHERE queue_id = ? OR message_id = ?`,
                  [status, timestamp, messageId, messageId]
                );

                console.log(`✅ Updated message ${messageId} status to ${status}`);
              }
            }
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent retries
    res.status(200).send('OK');
  }
});

module.exports = router;


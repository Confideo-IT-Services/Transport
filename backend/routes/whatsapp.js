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
    // Log all query parameters for debugging
    console.log('🔍 Webhook verification request:', {
      query: req.query,
      url: req.url,
      method: req.method
    });

    // Meta/WhatsApp format: hub.mode, hub.verify_token, hub.challenge
    const metaMode = req.query['hub.mode'];
    const metaToken = req.query['hub.verify_token'];
    const metaChallenge = req.query['hub.challenge'];

    // wazzap.in format - they use "challange" (misspelled) and "echo"
    const wazzapChallenge = req.query.challange || req.query.challenge; // Handle misspelling
    const echo = req.query.echo;

    // Standard challenge formats
    const challenge = wazzapChallenge ||
                     req.query.challenge_token || 
                     req.query.token || 
                     req.query.verification_code ||
                     metaChallenge;
    
    const token = req.query.token || 
                  req.query.verify_token || 
                  req.query.verification_token || 
                  req.query.secret ||
                  metaToken;
    
    const mode = req.query.mode || metaMode;

    // Verify token (set this in your .env)
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

    // Handle wazzap.in format - they send echo=true and challange (misspelled)
    if (echo === 'true' && wazzapChallenge) {
      console.log('✅ Webhook verified successfully (wazzap.in format with echo)');
      return res.status(200).send(String(wazzapChallenge));
    }

    // Handle Meta format
    if (metaMode === 'subscribe' && metaToken === verifyToken && metaChallenge) {
      console.log('✅ Webhook verified successfully (Meta format)');
      return res.status(200).send(metaChallenge);
    }

    // Handle wazzap.in format - if challenge exists, return it (they might not require token)
    if (challenge) {
      // If token is provided, verify it
      if (token && verifyToken) {
        if (token === verifyToken) {
          console.log('✅ Webhook verified successfully (wazzap.in format with token)');
          return res.status(200).send(String(challenge));
        } else {
          console.log('❌ Token mismatch:', { 
            received: token, 
            expected: verifyToken ? '***' : 'not set' 
          });
        }
      } else {
        // No token required or not set - just return challenge
        console.log('✅ Webhook verified successfully (wazzap.in format, no token required)');
        return res.status(200).send(String(challenge));
      }
    }

    // If no challenge but token matches, still accept (some services do this)
    if (token && verifyToken && token === verifyToken) {
      console.log('✅ Webhook verified successfully (token only)');
      return res.status(200).send('OK');
    }

    // If no verification token is set in .env, accept any request with challenge
    if (challenge && !verifyToken) {
      console.log('⚠️ No WEBHOOK_VERIFY_TOKEN set, accepting challenge without verification');
      return res.status(200).send(String(challenge));
    }

    // Verification failed
    console.log('❌ Webhook verification failed', { 
      mode: mode || metaMode, 
      receivedToken: token || metaToken, 
      expectedToken: verifyToken ? '***' : 'not set',
      challenge: challenge || metaChallenge,
      wazzapChallenge: wazzapChallenge,
      echo: echo,
      allQuery: req.query
    });
    res.status(403).send('Forbidden');
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
    let payload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('Webhook payload parse error:', parseError);
      return res.status(200).send('OK'); // Return 200 to prevent retries
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('📥 Webhook received:', JSON.stringify(payload, null, 2));
    }

    // Handle Meta/WhatsApp Cloud API format
    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // Handle status updates
            if (change.value?.statuses && Array.isArray(change.value.statuses)) {
              for (const statusUpdate of change.value.statuses) {
                const messageId = statusUpdate.id;
                const status = statusUpdate.status; // sent, delivered, read, failed
                const timestamp = statusUpdate.timestamp;
                const recipientId = statusUpdate.recipient_id;

                // Map Meta status to our status
                let dbStatus = status;
                if (status === 'sent') dbStatus = 'sent';
                else if (status === 'delivered') dbStatus = 'delivered';
                else if (status === 'read') dbStatus = 'read';
                else if (status === 'failed') dbStatus = 'failed';

                // Update database - try queue_id, message_id, then by recipient phone as fallback
                // Also store the wamid in message_id for future updates
                const [updated] = await db.query(
                  `UPDATE whatsapp_messages 
                   SET status = ?, 
                       status_updated_at = to_timestamp(?),
                       updated_at = NOW(),
                       error_message = ?,
                       message_id = COALESCE(message_id, ?)
                   WHERE queue_id = ? 
                      OR message_id = ? 
                      OR (recipient_phone = ? AND created_at > (NOW() - INTERVAL '1 hour'))`,
                  [
                    dbStatus, 
                    timestamp, 
                    statusUpdate.errors?.[0]?.message || null,
                    messageId, // Store wamid as message_id if not already set
                    messageId, // Try queue_id match
                    messageId, // Try message_id match
                    recipientId // Match by phone number as fallback (within last hour)
                  ]
                );

                if (updated.affectedRows > 0) {
                  console.log(`✅ Updated message ${messageId} status: ${status} (recipient: ${recipientId})`);
                } else {
                  console.log(`⚠️ Message ${messageId} not found in database (recipient: ${recipientId})`);
                }
              }
            }

            // Handle messages (incoming messages)
            if (change.value?.messages && Array.isArray(change.value.messages)) {
              for (const message of change.value.messages) {
                console.log('📨 Incoming message received:', message.id);
                // Handle incoming messages if needed
              }
            }
          }
        }
      }
    }

    // Handle 1automations.com format (if different)
    if (payload.message_id || payload.queue_id) {
      const messageId = payload.message_id || payload.queue_id;
      const status = payload.status || payload.message_status;
      
      if (status && messageId) {
        const [updated] = await db.query(
          `UPDATE whatsapp_messages 
           SET status = ?, 
               status_updated_at = NOW(),
               updated_at = NOW()
           WHERE queue_id = ? OR message_id = ?`,
          [status, messageId, messageId]
        );
        
        if (updated.affectedRows > 0) {
          console.log(`✅ Updated message ${messageId} status: ${status}`);
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


const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ============ SEND NOTIFICATION ============

// Send notification (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { title, message, targetType, classIds, priority } = req.body;
    const schoolId = req.user.schoolId;
    const senderId = req.user.id;

    if (!title || !message || !targetType) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'Title, message, and target type are required' });
    }

    if (!schoolId) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: 'School ID is required' });
    }

    const notificationId = uuidv4();

    // Determine target classes based on targetType
    let targetClasses = null;
    if (targetType === 'selected_classes' && classIds && classIds.length > 0) {
      targetClasses = JSON.stringify(classIds);
    } else if (targetType === 'all_classes' || targetType === 'all_parents') {
      // Get all class IDs for the school
      const [allClasses] = await connection.query(
        'SELECT id FROM classes WHERE school_id = ?',
        [schoolId]
      );
      targetClasses = JSON.stringify(allClasses.map(c => c.id));
    }

    // Insert notification
    await connection.query(
      `INSERT INTO notifications 
       (id, school_id, sender_id, sender_role, title, message, target_type, target_classes, priority, status, created_at)
       VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, ?, 'sent', NOW())`,
      [
        notificationId,
        schoolId,
        senderId,
        title,
        message,
        targetType,
        targetClasses,
        priority || 'normal'
      ]
    );

    // Get recipients based on target type
    let recipients = [];

    if (targetType === 'all_teachers') {
      // Get all teachers for the school
      const [teachers] = await connection.query(
        'SELECT id FROM teachers WHERE school_id = ? AND is_active = TRUE',
        [schoolId]
      );
      recipients = teachers.map(t => ({
        notificationId,
        recipientType: 'teacher',
        recipientId: t.id,
        studentId: null
      }));
    } else if (targetType === 'all_classes' || targetType === 'all_parents' || targetType === 'selected_classes') {
      // Get students from target classes
      let classIdsArray = [];
      if (targetType === 'selected_classes' && classIds && classIds.length > 0) {
        classIdsArray = classIds;
      } else if (targetClasses) {
        classIdsArray = JSON.parse(targetClasses);
      }

      if (classIdsArray.length > 0) {
        const placeholders = classIdsArray.map(() => '?').join(',');
        const [students] = await connection.query(
          `SELECT id FROM students 
           WHERE class_id IN (${placeholders}) 
           AND school_id = ? 
           AND status = 'approved'`,
          [...classIdsArray, schoolId]
        );
        
        recipients = students.map(s => ({
          notificationId,
          recipientType: 'parent',
          recipientId: s.id,
          studentId: s.id
        }));
      }
    }

    // Insert recipients
    if (recipients.length > 0) {
      for (const recipient of recipients) {
        await connection.query(
          `INSERT INTO notification_recipients 
           (id, notification_id, recipient_type, recipient_id, student_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            recipient.notificationId,
            recipient.recipientType,
            recipient.recipientId,
            recipient.studentId
          ]
        );
      }
    }

    // Update sent_count
    await connection.query(
      'UPDATE notifications SET sent_count = ? WHERE id = ?',
      [recipients.length, notificationId]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      id: notificationId,
      sentCount: recipients.length,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Send notification error:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message 
    });
  }
});

// ============ GET NOTIFICATIONS ============

// Get all notifications for a school (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ error: 'School ID is required' });
    }

    const [notifications] = await db.query(
      `SELECT n.*, u.name as sender_name
       FROM notifications n
       LEFT JOIN users u ON n.sender_id = u.id
       WHERE n.school_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [schoolId]
    );

    const formattedNotifications = notifications.map(n => {
      let targetClasses = null;
      try {
        if (n.target_classes) {
          targetClasses = typeof n.target_classes === 'string' 
            ? JSON.parse(n.target_classes) 
            : n.target_classes;
        }
      } catch (e) {
        console.error('Error parsing target_classes:', e);
      }

      // Format target display
      let targetDisplay = '';
      if (n.target_type === 'all_teachers') {
        targetDisplay = 'All Teachers';
      } else if (n.target_type === 'all_classes' || n.target_type === 'all_parents') {
        targetDisplay = 'All Classes';
      } else if (n.target_type === 'selected_classes' && targetClasses) {
        targetDisplay = `${targetClasses.length} Selected Class${targetClasses.length > 1 ? 'es' : ''}`;
      }

      return {
        id: n.id,
        title: n.title,
        message: n.message,
        target: targetDisplay,
        targetType: n.target_type,
        priority: n.priority,
        status: n.status,
        sentCount: n.sent_count || 0,
        senderName: n.sender_name || 'Admin',
        createdAt: n.created_at,
        time: formatTimeAgo(n.created_at)
      };
    });

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Helper function to format time ago
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

module.exports = router;


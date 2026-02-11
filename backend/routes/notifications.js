const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireTeacher } = require('../middleware/auth');

// Get inbox notifications
router.get('/inbox', authenticateToken, requireTeacher, async (req, res) => {
  try {
    let query;
    const params = [];

    if (req.user.role === 'teacher') {
      // For teachers: show notifications where they are recipients, exclude their own sent notifications
      // Handle both admin (users table) and teacher (teachers table) senders
      query = `
        SELECT n.*, 
               COALESCE(u.name, t.name) as sender_name,
               COALESCE(u.role, n.sender_role) as sender_role,
               nr.is_read, nr.read_at
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        LEFT JOIN users u ON n.sender_id = u.id AND n.sender_role = 'admin'
        LEFT JOIN teachers t ON n.sender_id = t.id AND n.sender_role = 'teacher'
        WHERE n.sender_id != ?
          AND nr.recipient_type = ? 
          AND nr.recipient_id = ?
        GROUP BY n.id
        ORDER BY n.created_at DESC
      `;
      params.push(req.user.id, 'teacher', req.user.id);
    } else if (req.user.role === 'admin') {
      // For admin: show notifications sent to teachers in their school, exclude their own sent notifications
      // Check if admin has read status via LEFT JOIN
      // Handle both admin (users table) and teacher (teachers table) senders
      query = `
        SELECT n.*, 
               COALESCE(u.name, t.name) as sender_name,
               COALESCE(u.role, n.sender_role) as sender_role,
               COALESCE(admin_nr.is_read, 0) as is_read,
               admin_nr.read_at
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        LEFT JOIN users u ON n.sender_id = u.id AND n.sender_role = 'admin'
        LEFT JOIN teachers t ON n.sender_id = t.id AND n.sender_role = 'teacher'
        LEFT JOIN notification_recipients admin_nr ON n.id = admin_nr.notification_id 
          AND admin_nr.recipient_id = ?
          AND admin_nr.recipient_type = 'teacher'
        WHERE n.sender_id != ?
          AND n.school_id = ?
          AND nr.recipient_type = 'teacher'
        GROUP BY n.id
        ORDER BY n.created_at DESC
      `;
      params.push(req.user.id, req.user.id, req.user.schoolId);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [notifications] = await db.query(query, params);

    res.json(notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      sender: n.sender_name,
      senderRole: n.sender_role,
      priority: n.priority,
      read: n.is_read === 0 || n.is_read === false ? false : true,
      readAt: n.read_at,
      time: n.created_at,
      attachmentUrl: n.attachment_url,
      attachmentName: n.attachment_name,
      attachmentType: n.attachment_type
    })));
  } catch (error) {
    console.error('Get inbox notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get sent notifications
router.get('/sent', authenticateToken, requireTeacher, async (req, res) => {
  try {
    let query = `
      SELECT n.*, 
             COUNT(DISTINCT nr.id) as recipient_count
      FROM notifications n
      LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
      WHERE n.sender_id = ?
    `;
    const params = [req.user.id];

    if (req.user.role === 'admin') {
      query += ' AND n.school_id = ?';
      params.push(req.user.schoolId);
    }

    query += ' GROUP BY n.id ORDER BY n.created_at DESC';

    const [notifications] = await db.query(query, params);

    res.json(notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      targetType: n.target_type,
      priority: n.priority,
      status: n.status,
      recipients: n.recipient_count || 0,
      time: n.created_at,
      attachmentUrl: n.attachment_url,
      attachmentName: n.attachment_name,
      attachmentType: n.attachment_type
    })));
  } catch (error) {
    console.error('Get sent notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch sent notifications' });
  }
});

// Get templates (admin only)
router.get('/templates', authenticateToken, requireTeacher, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [templates] = await db.query(
      'SELECT * FROM notification_templates WHERE school_id = ? ORDER BY created_at DESC',
      [req.user.schoolId]
    );

    res.json(templates.map(t => ({
      id: t.id,
      name: t.name,
      title: t.title,
      message: t.message,
      targetType: t.target_type,
      createdAt: t.created_at
    })));
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Send notification
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { 
      title, 
      message, 
      targetType, 
      targetClasses, 
      targetStudents,
      priority,
      attachmentUrl,
      attachmentName,
      attachmentType,
      eventDate,
      scheduledAt,
      whatsappEnabled
    } = req.body;

    // Validation: Required fields
    if (!title || !message || !targetType) {
      return res.status(400).json({ error: 'Title, message, and target type are required' });
    }

    // Validation: If targetType is selected_classes, targetClasses must not be empty
    if (targetType === 'selected_classes') {
      if (!targetClasses || !Array.isArray(targetClasses) || targetClasses.length === 0) {
        return res.status(400).json({ error: 'Target classes required for selected_classes' });
      }
    }

    // Validation: If scheduledAt exists, must not be in the past
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      if (scheduledDate < now) {
        return res.status(400).json({ error: 'Scheduled time cannot be in the past' });
      }
    }

    const notificationId = uuidv4();
    const schoolId = req.user.schoolId;
    const senderId = req.user.id;
    const senderRole = req.user.role;
    const createdBy = req.user.role === 'admin' ? req.user.id : null; // Only admins can create notifications

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Create notification with new fields
      // Note: If columns don't exist yet, they will be NULL (backward compatible)
      await db.query(
        `INSERT INTO notifications 
         (id, school_id, sender_id, sender_role, title, message, target_type, 
          target_classes, target_students, priority, attachment_url, attachment_name, attachment_type, 
          event_date, scheduled_at, whatsapp_enabled, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`,
        [
          notificationId,
          schoolId,
          senderId,
          senderRole,
          title,
          message,
          targetType,
          targetClasses ? JSON.stringify(targetClasses) : null, // Keep JSON for backward compatibility
          targetStudents ? JSON.stringify(targetStudents) : null,
          priority || 'normal',
          attachmentUrl || null,
          attachmentName || null,
          attachmentType || null,
          eventDate || null,
          scheduledAt || null,
          whatsappEnabled === true ? 1 : 0, // Convert boolean to MySQL TINYINT
          createdBy
        ]
      );

      // If targetType is selected_classes, insert into notification_classes mapping table
      // Note: This will fail silently if table doesn't exist yet (backward compatible)
      if (targetType === 'selected_classes' && targetClasses && targetClasses.length > 0) {
        try {
          for (const classId of targetClasses) {
            await db.query(
              `INSERT INTO notification_classes (id, notification_id, class_id)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE id = id`, // Prevent duplicates
              [uuidv4(), notificationId, classId]
            );
          }
        } catch (mappingError) {
          // If notification_classes table doesn't exist yet, log but don't fail
          console.warn('notification_classes table not found, skipping relational mapping:', mappingError.message);
        }
      }

      // Determine recipients based on target type (only if scheduledAt is NULL - immediate send)
      let recipients = [];
      
      // Only process recipients if scheduledAt is NULL (immediate notification)
      if (!scheduledAt) {
        if (targetType === 'all_teachers') {
          const [teachers] = await db.query(
            'SELECT id FROM teachers WHERE school_id = ?',
            [schoolId]
          );
          recipients = teachers.map(t => ({
            recipientType: 'teacher',
            recipientId: t.id,
            studentId: null
          }));
        } else if (targetType === 'all_classes' || targetType === 'all_parents') {
          // Get all students (for their parents)
          let studentsQuery = 'SELECT id FROM students WHERE school_id = ? AND status = "approved"';
          const studentsParams = [schoolId];

          if (targetClasses && targetClasses.length > 0) {
            studentsQuery += ' AND class_id IN (?)';
            studentsParams.push(targetClasses);
          }

          const [students] = await db.query(studentsQuery, studentsParams);
          recipients = students.map(s => ({
            recipientType: 'parent',
            recipientId: s.id, // parent_id is stored as student_id for parents
            studentId: s.id
          }));
        } else if (targetType === 'selected_classes') {
          const [students] = await db.query(
            'SELECT id FROM students WHERE class_id IN (?) AND status = "approved"',
            [targetClasses]
          );
          recipients = students.map(s => ({
            recipientType: 'parent',
            recipientId: s.id,
            studentId: s.id
          }));
        } else if (targetType === 'specific_students') {
          if (!targetStudents || targetStudents.length === 0) {
            throw new Error('Target students required for specific_students');
          }
          recipients = targetStudents.map(studentId => ({
            recipientType: 'parent',
            recipientId: studentId,
            studentId: studentId
          }));
        }

        // Create recipient records
        for (const recipient of recipients) {
          await db.query(
            `INSERT INTO notification_recipients 
             (id, notification_id, recipient_type, recipient_id, student_id)
             VALUES (?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              notificationId,
              recipient.recipientType,
              recipient.recipientId,
              recipient.studentId
            ]
          );
        }

        // Update sent count
        await db.query(
          'UPDATE notifications SET sent_count = ? WHERE id = ?',
          [recipients.length, notificationId]
        );
      } else {
        // Scheduled notification - set status to 'sent' but recipients will be created when scheduled time arrives
        // (This will be handled by a future scheduler service)
        // For now, we keep status as 'sent' but don't create recipients yet
      }

      // Future WhatsApp integration (commented out for now)
      // if (whatsappEnabled) {
      //   // TODO: Call WhatsApp service here
      //   // await whatsappService.sendNotification(notificationId, recipients);
      // }

      await db.query('COMMIT');

      res.status(201).json({
        success: true,
        message: scheduledAt 
          ? `Notification scheduled for ${new Date(scheduledAt).toLocaleString()}` 
          : `Notification sent to ${recipients.length} recipients`,
        notificationId
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mark notification as read
router.post('/:id/read', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'teacher') {
      // For teachers: update existing recipient record
      const [result] = await db.query(
        `UPDATE notification_recipients 
         SET is_read = TRUE, read_at = NOW() 
         WHERE notification_id = ? 
           AND recipient_type = ? 
           AND recipient_id = ?`,
        [id, 'teacher', req.user.id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Notification recipient record not found' });
      }
    } else if (req.user.role === 'admin') {
      // For admin: verify notification exists and is in their school
      const [notifications] = await db.query(
        'SELECT id, school_id, target_type FROM notifications WHERE id = ? AND school_id = ?',
        [id, req.user.schoolId]
      );

      if (notifications.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      const notification = notifications[0];

      // Check if admin recipient record exists (created when they previously marked as read)
      const [existing] = await db.query(
        `SELECT id FROM notification_recipients 
         WHERE notification_id = ? 
           AND recipient_id = ? 
           AND recipient_type = 'teacher'`,
        [id, req.user.id]
      );

      if (existing.length > 0) {
        // Update existing record
        await db.query(
          `UPDATE notification_recipients 
           SET is_read = TRUE, read_at = NOW() 
           WHERE notification_id = ? 
             AND recipient_id = ? 
             AND recipient_type = 'teacher'`,
          [id, req.user.id]
        );
      } else {
        // Create recipient record for admin (for notifications they can view)
        // We use recipient_type='teacher' since the notification was sent to teachers
        // and recipient_id=admin.id to track admin's read status
        await db.query(
          `INSERT INTO notification_recipients 
           (id, notification_id, recipient_type, recipient_id, student_id, is_read, read_at)
           VALUES (?, ?, ?, ?, ?, TRUE, NOW())`,
          [uuidv4(), id, 'teacher', req.user.id, null]
        );
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// Get all notifications for current user (inbox)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const schoolId = req.user.schoolId;

    let query, params;

    if (userRole === 'teacher') {
      // Teachers see notifications sent to them
      query = `
        SELECT DISTINCT
          n.id,
          n.title,
          n.message,
          n.priority,
          n.target_type,
          n.created_at,
          u.name as sender_name,
          COALESCE(nr.is_read, FALSE) as is_read,
          nr.read_at
        FROM notifications n
        INNER JOIN notification_recipients nr ON n.id = nr.notification_id
        INNER JOIN users u ON n.sender_id = u.id
        WHERE n.school_id = ?
          AND nr.recipient_type = 'teacher'
          AND nr.recipient_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
      `;
      params = [schoolId, userId];
    } else if (userRole === 'admin') {
      // Admins see unique notifications sent to teachers (no duplicates)
      query = `
        SELECT DISTINCT
          n.id,
          n.title,
          n.message,
          n.priority,
          n.target_type,
          n.created_at,
          u.name as sender_name,
          FALSE as is_read,
          NULL as read_at
        FROM notifications n
        INNER JOIN notification_recipients nr ON n.id = nr.notification_id
        INNER JOIN users u ON n.sender_id = u.id
        WHERE n.school_id = ?
          AND nr.recipient_type = 'teacher'
        GROUP BY n.id, n.title, n.message, n.priority, n.target_type, n.created_at, u.name
        ORDER BY n.created_at DESC
        LIMIT 50
      `;
      params = [schoolId];
    } else {
      return res.json([]);
    }

    const [notifications] = await db.query(query, params);

    res.json(notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      sender: n.sender_name,
      priority: n.priority,
      time: n.created_at,
      read: n.is_read || false,
      readAt: n.read_at
    })));
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get sent notifications (notifications sent by current user)
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;

    const [notifications] = await db.query(`
      SELECT 
        n.id,
        n.title,
        n.target_type,
        n.target_classes,
        n.target_students,
        n.sent_count,
        n.status,
        n.created_at,
        COUNT(DISTINCT nr.id) as recipient_count
      FROM notifications n
      LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
      WHERE n.school_id = ? AND n.sender_id = ?
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [schoolId, userId]);

    res.json(notifications.map(n => {
      let recipients = '';
      if (n.target_type === 'all_classes') {
        recipients = 'All Parents';
      } else if (n.target_type === 'all_teachers') {
        recipients = 'All Teachers';
      } else if (n.target_type === 'selected_classes') {
        recipients = `${n.recipient_count} Parents`;
      } else if (n.target_type === 'specific_students') {
        recipients = `${n.recipient_count} Parent(s)`;
      } else {
        recipients = `${n.recipient_count} Recipient(s)`;
      }

      return {
        id: n.id,
        title: n.title,
        recipients: recipients,
        time: n.created_at,
        status: n.status
      };
    }));
  } catch (error) {
    console.error('Get sent notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch sent notifications' });
  }
});

// Get notification templates
router.get('/templates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const [templates] = await db.query(`
      SELECT id, name, title, message
      FROM notification_templates
      WHERE school_id = ?
      ORDER BY name ASC
    `, [schoolId]);

    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create notification template
router.post('/templates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, title, message } = req.body;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;

    if (!name || !title || !message) {
      return res.status(400).json({ error: 'Name, title, and message are required' });
    }

    const templateId = uuidv4();
    await db.query(`
      INSERT INTO notification_templates (id, school_id, name, title, message, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [templateId, schoolId, name, title, message, userId]);

    res.status(201).json({ success: true, id: templateId });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Send notification
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, message, targetType, targetClasses, targetStudents, priority } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const schoolId = req.user.schoolId;

    if (!title || !message || !targetType) {
      return res.status(400).json({ error: 'Title, message, and target type are required' });
    }

    const notificationId = uuidv4();
    const notificationPriority = priority || 'normal';

    // Insert notification
    await db.query(`
      INSERT INTO notifications (
        id, school_id, sender_id, sender_role, title, message,
        target_type, target_classes, target_students, priority, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')
    `, [
      notificationId,
      schoolId,
      userId,
      userRole,
      title,
      message,
      targetType,
      targetClasses ? JSON.stringify(targetClasses) : null,
      targetStudents ? JSON.stringify(targetStudents) : null,
      notificationPriority
    ]);

    // Create recipients based on target type
    let recipients = [];
    let sentCount = 0;

    if (targetType === 'all_teachers') {
      // Get all teachers in the school
      const [teachers] = await db.query(`
        SELECT id FROM teachers WHERE school_id = ? AND is_active = TRUE
      `, [schoolId]);

      recipients = teachers.map(t => ({
        notificationId,
        recipientType: 'teacher',
        recipientId: t.id,
        studentId: null
      }));
    } else if (targetType === 'all_classes' || targetType === 'selected_classes') {
      // Get students from selected classes (or all classes)
      let classIds = [];
      if (targetType === 'selected_classes' && targetClasses && targetClasses.length > 0) {
        classIds = targetClasses;
      } else {
        // All classes
        const [allClasses] = await db.query(`
          SELECT id FROM classes WHERE school_id = ?
        `, [schoolId]);
        classIds = allClasses.map(c => c.id);
      }

      if (classIds.length > 0) {
        const [students] = await db.query(`
          SELECT id FROM students 
          WHERE class_id IN (${classIds.map(() => '?').join(',')}) 
          AND status = 'approved'
          AND parent_phone IS NOT NULL
          AND parent_phone != ''
        `, classIds);

        recipients = students.map(s => ({
          notificationId,
          recipientType: 'parent',
          recipientId: s.id, // For parents, recipient_id is student_id
          studentId: s.id
        }));
      }
    } else if (targetType === 'specific_students' && targetStudents && targetStudents.length > 0) {
      // Get specific students
      const [students] = await db.query(`
        SELECT id FROM students 
        WHERE id IN (${targetStudents.map(() => '?').join(',')}) 
        AND school_id = ?
        AND status = 'approved'
        AND parent_phone IS NOT NULL
        AND parent_phone != ''
      `, [...targetStudents, schoolId]);

      recipients = students.map(s => ({
        notificationId,
        recipientType: 'parent',
        recipientId: s.id,
        studentId: s.id
      }));
    }

    // Insert recipients
    if (recipients.length > 0) {
      // Insert recipients one by one to avoid SQL injection
      for (const recipient of recipients) {
        await db.query(`
          INSERT INTO notification_recipients 
          (id, notification_id, recipient_type, recipient_id, student_id, is_read, read_at, created_at)
          VALUES (?, ?, ?, ?, ?, FALSE, NULL, NOW())
        `, [
          uuidv4(),
          recipient.notificationId,
          recipient.recipientType,
          recipient.recipientId,
          recipient.studentId
        ]);
      }

      sentCount = recipients.length;

      // Update sent_count
      await db.query(`
        UPDATE notifications SET sent_count = ? WHERE id = ?
      `, [sentCount, notificationId]);
    }

    res.json({
      success: true,
      message: `Notification sent to ${sentCount} recipient(s)`,
      notificationId,
      sentCount
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = `
      UPDATE notification_recipients 
      SET is_read = TRUE, read_at = NOW()
      WHERE notification_id = ? AND recipient_type = ? AND recipient_id = ?
    `;

    await db.query(query, [id, userRole === 'teacher' ? 'teacher' : 'parent', userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;


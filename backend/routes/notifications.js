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
      // Get teacher's class IDs to exclude notifications sent to their classes
      const [teacherClasses] = await db.query(
        'SELECT id FROM classes WHERE class_teacher_id = ?',
        [req.user.id]
      );
      const teacherClassIds = teacherClasses.map(c => c.id);
      
      let excludeCondition = '';
      const excludeParams = [];
      if (teacherClassIds.length > 0) {
        // Exclude notifications sent by this teacher (check by sender_role and target classes)
        const classIdChecks = teacherClassIds.map(() => 'JSON_CONTAINS(n.target_classes, ?)').join(' OR ');
        excludeCondition = `AND NOT (
          n.sender_role = 'teacher' 
          AND (
            (n.target_classes IS NOT NULL AND (${classIdChecks}))
            OR (n.target_type IN ('all_classes', 'all_parents') AND n.target_classes IS NULL AND n.school_id = ?)
          )
        )`;
        teacherClassIds.forEach(classId => excludeParams.push(JSON.stringify(classId)));
        excludeParams.push(req.user.schoolId || req.user.school_id);
      }
      
      query = `
        SELECT n.*, 
               COALESCE(u.name, t.name) as sender_name,
               COALESCE(u.role, n.sender_role) as sender_role,
               nr.is_read, nr.read_at
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        LEFT JOIN users u ON n.sender_id = u.id AND n.sender_role = 'admin'
        LEFT JOIN teachers t ON n.sender_id = t.id AND n.sender_role = 'teacher'
        WHERE nr.recipient_type = ? 
          AND nr.recipient_id = ?
          ${excludeCondition}
        GROUP BY n.id
        ORDER BY n.created_at DESC
      `;
      params.push('teacher', req.user.id, ...excludeParams);
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
    let query;
    const params = [];
    
    if (req.user.role === 'teacher') {
      // For teachers: Find notifications where sender_role = 'teacher' and school matches
      // Then filter by checking if notification's target classes/students match teacher's assigned classes
      // First, get teacher's assigned class IDs
      const [teacherClasses] = await db.query(
        'SELECT id FROM classes WHERE class_teacher_id = ?',
        [req.user.id]
      );
      const teacherClassIds = teacherClasses.map(c => c.id);
      
      if (teacherClassIds.length === 0) {
        // Teacher has no classes, return empty
        return res.json([]);
      }
      
      // Build query using JSON_CONTAINS (more compatible than JSON_OVERLAPS)
      // Check if any teacher class ID exists in the target_classes JSON array
      const classIdChecks = teacherClassIds.map(() => 'JSON_CONTAINS(n.target_classes, ?)').join(' OR ');
      const classIdsPlaceholder = teacherClassIds.map(() => '?').join(',');
      
      query = `
        SELECT n.*, 
               COUNT(DISTINCT nr.id) as recipient_count
        FROM notifications n
        LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
        WHERE n.school_id = ?
          AND n.sender_role = 'teacher'
          AND (
            -- Match if notification targets teacher's classes
            (
              n.target_classes IS NOT NULL
              AND (${classIdChecks})
            )
            OR
            -- Match if notification targets specific students that belong to teacher's classes
            (
              n.target_students IS NOT NULL
              AND EXISTS (
                SELECT 1 
                FROM students s
                WHERE s.class_id IN (${classIdsPlaceholder})
                  AND JSON_CONTAINS(n.target_students, JSON_QUOTE(s.id))
                LIMIT 1
              )
            )
            OR
            -- Match if targetType is all_classes/all_parents with NULL target_classes
            -- Verify by checking if recipients include students from teacher's classes
            (
              n.target_type IN ('all_classes', 'all_parents')
              AND n.target_classes IS NULL
              AND EXISTS (
                SELECT 1 
                FROM notification_recipients nr2
                JOIN students s ON nr2.student_id = s.id
                WHERE nr2.notification_id = n.id
                  AND s.class_id IN (${classIdsPlaceholder})
                LIMIT 1
              )
            )
            OR
            -- Match if sender_id was originally teacher's ID (for old notifications before FK fix)
            n.sender_id = ?
          )
      `;
      // Build params: schoolId, classIds as JSON strings for JSON_CONTAINS, classIds for EXISTS (3 times), teacherId
      params.push(req.user.schoolId || req.user.school_id);
      // Add each classId as a JSON string for JSON_CONTAINS check
      teacherClassIds.forEach(classId => params.push(JSON.stringify(classId)));
      // Add classIds for EXISTS queries (3 times)
      params.push(...teacherClassIds, ...teacherClassIds, ...teacherClassIds);
      params.push(req.user.id);
    } else if (req.user.role === 'admin') {
      // For admin: original logic - match by sender_id
      query = `
        SELECT n.*, 
               COUNT(DISTINCT nr.id) as recipient_count
        FROM notifications n
        LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
        WHERE n.sender_id = ?
          AND n.school_id = ?
      `;
      params.push(req.user.id, req.user.schoolId || req.user.school_id);
    } else {
      return res.status(403).json({ error: 'Access denied' });
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
  // Add immediate logging at the start
  console.log('========================================');
  console.log('📨 NOTIFICATION SEND REQUEST RECEIVED');
  console.log('User ID:', req.user.id);
  console.log('User Role:', req.user.role);
  console.log('School ID:', req.user.schoolId || req.user.school_id);
  console.log('========================================');
  
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

    console.log('📝 Request body:', {
      title,
      message,
      targetType,
      targetClasses,
      targetStudents,
      priority
    });

    // Validation: Required fields
    if (!title || !message || !targetType) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Title, message, and target type are required' });
    }

    // Validation: If targetType is selected_classes, targetClasses must not be empty
    if (targetType === 'selected_classes') {
      if (!targetClasses || !Array.isArray(targetClasses) || targetClasses.length === 0) {
        console.log('❌ Validation failed: targetClasses required for selected_classes');
        return res.status(400).json({ error: 'Target classes required for selected_classes' });
      }
    }

    // Validation: If scheduledAt exists, must not be in the past
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      if (scheduledDate < now) {
        console.log('❌ Validation failed: Scheduled time in past');
        return res.status(400).json({ error: 'Scheduled time cannot be in the past' });
      }
    }

    const notificationId = uuidv4();
    const schoolId = req.user.schoolId || req.user.school_id;
    const senderRole = req.user.role;
    
    // FIX: Handle sender_id based on role
    // For teachers, ALWAYS use school admin's ID (teachers don't exist in users table)
    let senderId = req.user.id;
    
    console.log('🔍 Notification send - Initial values:', {
      senderId,
      senderRole,
      schoolId,
      userId: req.user.id,
      username: req.user.username
    });
    
    // If sender is a teacher, ALWAYS check and use admin's ID (teachers don't exist in users table)
    if (senderRole === 'teacher') {
      console.log('👨‍🏫 Teacher detected, looking for admin user...');
      try {
        // ALWAYS use school admin's ID for teachers (teachers don't exist in users table)
        const [admins] = await db.query(
          'SELECT id FROM users WHERE school_id = ? AND role = ? LIMIT 1',
          [schoolId, 'admin']
        );
        
        console.log('🔍 Admin lookup result:', { 
          found: admins.length > 0, 
          schoolId, 
          adminId: admins.length > 0 ? admins[0].id : null 
        });
        
        if (admins.length > 0) {
          // Use admin's ID as sender_id, but keep sender_role as 'teacher'
          senderId = admins[0].id;
          console.log(`✅ Teacher ${req.user.id} sending notification, using admin ${senderId} for FK constraint`);
        } else {
          // If no admin found, try to find any user in the school
          console.log('⚠️ No admin found, trying to find any user in school...');
          const [anyUsers] = await db.query(
            'SELECT id FROM users WHERE school_id = ? LIMIT 1',
            [schoolId]
          );
          
          if (anyUsers.length > 0) {
            senderId = anyUsers[0].id;
            console.log(`✅ Using fallback user ID ${senderId} for teacher notification`);
          } else {
            console.error('❌ No users found in school:', schoolId);
            return res.status(500).json({ 
              error: 'Failed to send notification: Database configuration issue. Please contact administrator.',
              details: 'No valid sender found for school'
            });
          }
        }
      } catch (fkError) {
        console.error('❌ Error looking up admin user:', fkError);
        console.error('Error details:', fkError.message);
        console.error('Stack:', fkError.stack);
        return res.status(500).json({ 
          error: 'Failed to send notification: Database configuration issue.',
          details: fkError.message
        });
      }
    } else {
      console.log('✅ Admin user, using original senderId');
    }
    
    console.log('✅ Final sender values:', { senderId, senderRole, schoolId });
    
    // Verify senderId exists in users table before proceeding
    try {
      const [verifyUser] = await db.query(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [senderId]
      );
      if (verifyUser.length === 0) {
        console.error('❌ CRITICAL: senderId does not exist in users table:', senderId);
        return res.status(500).json({ 
          error: 'Failed to send notification: Invalid sender configuration.',
          details: `Sender ID ${senderId} not found in users table`
        });
      }
      console.log('✅ Verified senderId exists in users table');
    } catch (verifyError) {
      console.error('❌ Error verifying senderId:', verifyError);
      return res.status(500).json({ 
        error: 'Failed to send notification: Database error.',
        details: verifyError.message
      });
    }
    
    // For admins, created_by is the admin's ID
    // For teachers, set to NULL (FK constraint - teachers don't exist in users table)
    const createdBy = req.user.role === 'admin' ? req.user.id : null;

    console.log('🔄 Starting database transaction...');
    // Start transaction
    await db.query('START TRANSACTION');

    try {
      console.log('📝 Inserting notification with senderId:', senderId);
      console.log('📝 Insert parameters:', {
        notificationId,
        schoolId,
        senderId,
        senderRole,
        targetType,
        createdBy
      });
      
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
      console.log('✅ Notification inserted successfully');

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
      console.error('❌ Transaction error in notification send:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        stack: error.stack
      });
      throw error;
    }
  } catch (error) {
    console.error('❌ Send notification error:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    
    // Return detailed error in development, generic in production
    const errorResponse = {
      error: 'Failed to send notification',
      details: error.message || 'Unknown error occurred'
    };
    
    // Always include details for foreign key constraint errors
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.message?.includes('foreign key constraint')) {
      errorResponse.details = error.message || 'Foreign key constraint failed';
    }
    
    res.status(500).json(errorResponse);
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

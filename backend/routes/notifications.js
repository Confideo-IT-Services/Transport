
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
      query = `
        SELECT n.*, u.name as sender_name, u.role as sender_role,
               nr.is_read, nr.read_at
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        JOIN users u ON n.sender_id = u.id
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
      query = `
         SELECT n.*, u.name as sender_name, u.role as sender_role,
           COALESCE(admin_nr.is_read, false) as is_read,
           admin_nr.read_at
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        JOIN users u ON n.sender_id = u.id
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
      senderName: n.sender_name, // Add senderName for consistency
      senderRole: n.sender_role,
      priority: n.priority,
      read: n.is_read === 0 || n.is_read === false ? false : true,
      readAt: n.read_at,
      time: n.created_at,
      createdAt: n.created_at, // Add createdAt for consistency
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
      // For teachers: notifications sent by them (using admin as sender_id)
      // We need to find which admin ID was used for this teacher's school
      // Then find all notifications sent by that admin for this school
      const schoolId = (req.user.schoolId || req.user.school_id || '').toString().trim();
      
      if (!schoolId) {
        console.error('❌ Get sent: School ID not found for teacher:', req.user.id);
        return res.status(400).json({ error: 'School ID not found' });
      }

      // Find admin for this school (same logic as in POST route)
      const [admins] = await db.query(
        'SELECT id FROM users WHERE school_id = ? AND role = ? AND is_active = TRUE LIMIT 1',
        [schoolId, 'admin']
      );

      if (admins.length === 0) {
        console.log('ℹ️ Get sent: No admin found for school, returning empty array');
        return res.json([]); // No admin found, so no sent notifications
      }

      const adminId = admins[0].id;

      query = `
        SELECT n.*, 
               COUNT(DISTINCT nr.id) as recipient_count
        FROM notifications n
        LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
        WHERE n.sender_id = ?
          AND n.school_id = ?
          AND n.sender_role = ?
      `;
      params.push(adminId, schoolId, 'teacher');
    } else if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      // For admin: notifications sent by them
      const schoolId = req.user.schoolId || req.user.school_id;
      query = `
        SELECT n.*, 
               COUNT(DISTINCT nr.id) as recipient_count
        FROM notifications n
        LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
        WHERE n.sender_id = ?
          AND n.school_id = ?
      `;
      params.push(req.user.id, schoolId);
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
      createdAt: n.created_at, // Add createdAt for consistency
      attachmentUrl: n.attachment_url,
      attachmentName: n.attachment_name,
      attachmentType: n.attachment_type
    })));
  } catch (error) {
    console.error('Get sent notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch sent notifications' });
  }
});

// Send notification
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  console.log('🔔 POST /notifications - Request received');
  console.log('🔔 Request body:', JSON.stringify(req.body, null, 2));
  console.log('🔔 User from token:', {
    id: req.user?.id,
    role: req.user?.role,
    schoolId: req.user?.schoolId,
    school_id: req.user?.school_id
  });
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
      attachmentType
    } = req.body;

    if (!title || !message || !targetType) {
      return res.status(400).json({ error: 'Title, message, and target type are required' });
    }

    const notificationId = uuidv4();
    // Normalize schoolId - convert to string and trim
    const schoolId = (req.user.schoolId || req.user.school_id || '').toString().trim();
    const senderRole = req.user.role;
    
    // VALIDATION: Ensure schoolId exists
    if (!schoolId) {
      console.error('❌ CRITICAL: schoolId is null/undefined', {
        schoolId: req.user.schoolId,
        school_id: req.user.school_id,
        userId: req.user.id,
        role: req.user.role,
        allUserProps: Object.keys(req.user)
      });
      return res.status(400).json({
        error: "School ID not found in user token. Please login again."
      });
    }

    // LOGGING: Log notification send attempt
    console.log('📧 Sending notification:', {
      userId: req.user.id,
      role: req.user.role,
      schoolId: schoolId,
      schoolIdType: typeof schoolId,
      schoolIdLength: schoolId.length
    });
    
    // Initialize senderId - for admins, use their ID directly
    // For teachers, we must find an admin from users table
    let senderId = null;

    if (senderRole === 'admin' || senderRole === 'superadmin') {
      // Admins exist in users table, so we can use their ID directly
      senderId = req.user.id;
      console.log(`✅ Admin user, using senderId: ${senderId}`);
    } else if (senderRole === 'teacher') {
      // Teachers exist in teachers table, NOT users table
      // We must find an admin from users table to use as sender_id
      try {
        console.log('🔍 Looking for admin:', {
          schoolId: schoolId,
          schoolIdType: typeof schoolId,
          schoolIdLength: schoolId.length,
          userId: req.user.id,
          role: req.user.role
        });
        
        // First, verify the schoolId exists in schools table
        const [schoolCheck] = await db.query(
          'SELECT id FROM schools WHERE id = ? LIMIT 1',
          [schoolId]
        );
        
        if (schoolCheck.length === 0) {
          console.error('❌ CRITICAL: schoolId does not exist in schools table:', schoolId);
          return res.status(400).json({
            error: "Invalid school ID. Please contact administrator."
          });
        }
        console.log(`✅ Verified schoolId ${schoolId} exists in schools table`);
        
        // Now find admin for this school
        const [admins] = await db.query(
          'SELECT id, email, name, school_id, role FROM users WHERE school_id = ? AND role = ? AND is_active = TRUE LIMIT 1',
          [schoolId, 'admin']
        );

        console.log('🔍 Admin lookup result:', {
          schoolId: schoolId,
          queryUsed: 'SELECT id FROM users WHERE school_id = ? AND role = ? AND is_active = TRUE',
          adminsFound: admins.length,
          adminId: admins.length > 0 ? admins[0].id : null,
          adminDetails: admins.length > 0 ? {
            id: admins[0].id,
            email: admins[0].email,
            name: admins[0].name,
            school_id: admins[0].school_id,
            role: admins[0].role
          } : null,
          allAdmins: admins
        });

        if (admins && admins.length > 0) {
          // Use the raw ID from database - don't transform it
          const rawAdminId = admins[0].id;
          
          // Log the raw ID with all details
          console.log('🔍 Raw admin ID from database:', {
            rawId: rawAdminId,
            rawIdType: typeof rawAdminId,
            rawIdValue: String(rawAdminId),
            rawIdLength: String(rawAdminId).length,
            isBuffer: Buffer.isBuffer(rawAdminId),
            adminRow: admins[0]
          });
          
          // Verify this admin ID exists and matches school - use raw ID
          const [verifyAdmin] = await db.query(
            'SELECT id, school_id, role FROM users WHERE id = ? AND school_id = ? AND role = ? LIMIT 1',
            [rawAdminId, schoolId, 'admin']
          );
          
          if (verifyAdmin.length === 0) {
            console.error('❌ CRITICAL: Admin ID found but verification failed:', {
              rawAdminId: rawAdminId,
              rawAdminIdType: typeof rawAdminId,
              schoolId: schoolId,
              adminFromQuery: admins[0],
              verifyQueryResult: verifyAdmin
            });
            return res.status(400).json({
              error: "Admin verification failed. Please contact administrator."
            });
          }
          
          // Use the ID from verification result (guaranteed to exist in DB)
          senderId = verifyAdmin[0].id;
          
          console.log(`✅ Teacher notification: Using admin ID ${senderId} as sender_id (from verified query)`);
          console.log(`✅ Final senderId details:`, {
            senderId: senderId,
            senderIdType: typeof senderId,
            senderIdValue: String(senderId),
            senderIdLength: String(senderId).length
          });
        } else {
          // Also check if ANY admin exists for debugging
          const [allAdmins] = await db.query(
            'SELECT id, school_id, role, email FROM users WHERE role = ? LIMIT 10',
            ['admin']
          );
          console.error(`❌ No admin user found for school ${schoolId}.`, {
            schoolId: schoolId,
            schoolIdType: typeof schoolId,
            availableAdmins: allAdmins.map(a => ({
              id: a.id,
              school_id: a.school_id,
              email: a.email
            }))
          });
          return res.status(400).json({
            error: "No admin user found for this school. Cannot send notification."
          });
        }
      } catch (adminLookupError) {
        console.error('❌ Error looking up admin user:', adminLookupError);
        return res.status(500).json({
          error: "Failed to validate sender. Please contact administrator."
        });
      }
    } else {
      return res.status(400).json({
        error: "Invalid user role. Cannot send notification."
      });
    }

    // Final validation: Ensure senderId is set and exists in users table
    if (!senderId) {
      console.error('❌ CRITICAL: senderId is null or undefined');
      return res.status(400).json({
        error: "Invalid sender ID. Cannot send notification."
      });
    }

    // Verify senderId exists in users table before proceeding
    try {
      const [verifyUser] = await db.query(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [senderId]
      );
      if (verifyUser.length === 0) {
        console.error('❌ CRITICAL: senderId does not exist in users table:', senderId);
        return res.status(400).json({
          error: "Invalid sender ID. Cannot send notification.",
          debug: `senderId ${senderId} does not exist in users table`
        });
      }
      console.log(`✅ Verified senderId ${senderId} exists in users table`);
    } catch (verifyError) {
      console.error('❌ Error verifying senderId:', verifyError);
      return res.status(400).json({
        error: "Invalid sender ID. Cannot send notification."
      });
    }

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Double-check senderId within transaction (transaction-level verification)
      const [txVerify] = await db.query(
        'SELECT id, school_id, role FROM users WHERE id = ? AND school_id = ? LIMIT 1',
        [senderId, schoolId]  // Verify both ID and school match
      );
      if (txVerify.length === 0) {
        await db.query('ROLLBACK');
        console.error('❌ CRITICAL: senderId invalid in transaction:', {
          senderId: senderId,
          schoolId: schoolId,
          senderIdType: typeof senderId,
          schoolIdType: typeof schoolId
        });
        
        // Last resort: check if senderId exists at all
        const [anyUser] = await db.query('SELECT id, school_id, role FROM users WHERE id = ? LIMIT 1', [senderId]);
        console.error('❌ Debug: User with this ID:', anyUser);
        
        return res.status(400).json({
          error: "Invalid sender ID. Cannot send notification."
        });
      }
      console.log(`✅ Transaction-level verification: senderId ${senderId} is valid for school ${schoolId}`);

      // Final check: Verify senderId one more time with exact value that will be inserted
      console.log("🚨 FINAL CHECK BEFORE INSERT:");
      console.log("senderId to insert:", senderId);
      console.log("senderId type:", typeof senderId);
      console.log("senderId string value:", String(senderId));
      console.log("senderId length:", String(senderId).length);

      const [finalCheck] = await db.query(
        "SELECT id, school_id, role FROM users WHERE id = ?",
        [senderId]
      );

      if (finalCheck.length === 0) {
        await db.query('ROLLBACK');
        console.error("🚨 CRITICAL: senderId does NOT exist right before INSERT!");
        console.error("senderId that failed:", senderId);
        console.error("senderId type:", typeof senderId);
        console.error("senderId as string:", String(senderId));
        
        // Try to find what went wrong
        const [allUsers] = await db.query("SELECT id, school_id, role FROM users WHERE role = 'admin' LIMIT 5");
        console.error("Available admin users:", allUsers);
        
        return res.status(400).json({
          error: "Invalid sender ID. Cannot send notification.",
          debug: `senderId ${senderId} does not exist in users table`
        });
      }

      console.log("✅ Final check passed - user exists:", finalCheck[0]);
      console.log("🚨 FINAL INSERT VALUES:");
      console.log("senderId:", senderId, "(type:", typeof senderId, ")");
      console.log("schoolId:", schoolId, "(type:", typeof schoolId, ")");

      // Create notification
      await db.query(
        `INSERT INTO notifications 
         (id, school_id, sender_id, sender_role, title, message, target_type, 
          target_classes, target_students, priority, attachment_url, attachment_name, attachment_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`,
        [
          notificationId,
          schoolId,
          senderId,
          senderRole,
          title,
          message,
          targetType,
          targetClasses ? JSON.stringify(targetClasses) : null,
          targetStudents ? JSON.stringify(targetStudents) : null,
          priority || 'normal',
          attachmentUrl || null,
          attachmentName || null,
          attachmentType || null
        ]
      );

      // Determine recipients based on target type
      let recipients = [];

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
        let studentsQuery = `SELECT id FROM students WHERE school_id = ? AND status = 'approved'`;
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
        if (!targetClasses || targetClasses.length === 0) {
          throw new Error('Target classes required for selected_classes');
        }
        const [students] = await db.query(
          `SELECT id FROM students WHERE class_id IN (?) AND status = 'approved'`,
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

      await db.query('COMMIT');

      res.status(201).json({
        success: true,
        message: `Notification sent to ${recipients.length} recipients`,
        notificationId
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("====== NOTIFICATION ERROR ======");
    console.error("Full error:", error);
    console.error("Message:", error.message);
    console.error("SQL Message:", error.sqlMessage);
    console.error("SQL Code:", error.code);
    console.error("Stack:", error.stack);
    console.error("===============================");

    return res.status(500).json({
      message: "Failed to send notification",
      debug: error.message
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
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), id, 'teacher', req.user.id, null, true]
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

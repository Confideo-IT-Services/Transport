const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireTeacher } = require('../middleware/auth');

// Get all homework (filtered by class for teacher)
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    let query = `
      SELECT h.*, t.name as teacher_name, c.name as class_name, c.section as class_section
      FROM homework h
      LEFT JOIN teachers t ON h.teacher_id = t.id
      LEFT JOIN classes c ON h.class_id = c.id
    `;
    const params = [];

    if (req.user.role === 'teacher') {
      query += ' WHERE h.teacher_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'admin') {
      query += ' WHERE h.school_id = ?';
      params.push(req.user.schoolId);
    }

    query += ' ORDER BY h.created_at DESC';

    const [homework] = await db.query(query, params);

    res.json(homework.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description,
      subject: h.subject,
      classId: h.class_id,
      className: h.class_name ? `${h.class_name} ${h.class_section || ''}`.trim() : null,
      teacherId: h.teacher_id,
      teacherName: h.teacher_name,
      dueDate: h.due_date,
      status: h.status,
      createdAt: h.created_at
    })));
  } catch (error) {
    console.error('Get homework error:', error);
    res.status(500).json({ error: 'Failed to fetch homework' });
  }
});

// Get homework by class
router.get('/class/:classId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;

    const [homework] = await db.query(`
      SELECT h.*, t.name as teacher_name
      FROM homework h
      LEFT JOIN teachers t ON h.teacher_id = t.id
      WHERE h.class_id = ?
      ORDER BY h.due_date DESC
    `, [classId]);

    res.json(homework.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description,
      subject: h.subject,
      dueDate: h.due_date,
      teacherName: h.teacher_name,
      status: h.status,
      createdAt: h.created_at
    })));
  } catch (error) {
    console.error('Get class homework error:', error);
    res.status(500).json({ error: 'Failed to fetch homework' });
  }
});

// Create homework (Teacher only)
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { title, description, subject, classId, dueDate } = req.body;

    if (!title || !classId) {
      return res.status(400).json({ error: 'Title and class are required' });
    }

    const teacherId = req.user.id;
    const schoolId = req.user.schoolId;

    // Verify teacher has access to this class
    if (req.user.role === 'teacher') {
      const [classes] = await db.query(
        'SELECT id FROM classes WHERE id = ? AND class_teacher_id = ?',
        [classId, teacherId]
      );
      if (classes.length === 0) {
        return res.status(403).json({ error: 'You do not have access to this class' });
      }
    }

    const homeworkId = uuidv4();
    await db.query(
      `INSERT INTO homework (id, title, description, subject, class_id, teacher_id, school_id, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [homeworkId, title, description || null, subject || null, classId, teacherId, schoolId, dueDate || null]
    );

    res.status(201).json({ success: true, homeworkId });
  } catch (error) {
    console.error('Create homework error:', error);
    res.status(500).json({ error: 'Failed to create homework' });
  }
});

// Mark homework as completed
router.post('/:id/complete', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("UPDATE homework SET status = 'completed' WHERE id = ?", [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Complete homework error:', error);
    res.status(500).json({ error: 'Failed to complete homework' });
  }
});

// Get student completions for a homework
router.get('/:id/completions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify access
    let accessQuery = 'SELECT id FROM homework WHERE id = ?';
    const accessParams = [id];

    if (req.user.role === 'teacher') {
      accessQuery += ' AND teacher_id = ?';
      accessParams.push(req.user.id);
    } else if (req.user.role === 'admin') {
      accessQuery += ' AND school_id = ?';
      accessParams.push(req.user.schoolId);
    }

    const [homework] = await db.query(accessQuery, accessParams);
    if (homework.length === 0) {
      return res.status(404).json({ error: 'Homework not found or access denied' });
    }

    const [completions] = await db.query(
      `SELECT student_id, is_completed 
       FROM homework_submissions 
       WHERE homework_id = ?`,
      [id]
    );

    res.json(completions.map(c => ({
      studentId: c.student_id,
      completed: c.is_completed === 1 || c.is_completed === true
    })));
  } catch (error) {
    console.error('Get homework completions error:', error);
    res.status(500).json({ error: 'Failed to fetch completions' });
  }
});

// Update student completion status
router.post('/:id/completions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, completed } = req.body;

    if (!studentId || typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'studentId and completed are required' });
    }

    console.log('Update completion request:', { 
      homeworkId: id, 
      studentId, 
      completed, 
      userId: req.user.id, 
      userRole: req.user.role,
      schoolId: req.user.schoolId 
    });

    // Verify homework exists and user has access
    let accessQuery = 'SELECT h.id, h.teacher_id, h.school_id FROM homework h WHERE h.id = ?';
    const accessParams = [id];

    if (req.user.role === 'teacher') {
      // For teachers, check if they have access to the homework's class or school
      accessQuery += ' AND (h.teacher_id = ? OR h.school_id = ?)';
      accessParams.push(req.user.id, req.user.schoolId);
    } else if (req.user.role === 'admin') {
      accessQuery += ' AND h.school_id = ?';
      accessParams.push(req.user.schoolId);
    }

    const [homework] = await db.query(accessQuery, accessParams);
    
    console.log('Homework access check:', { 
      query: accessQuery, 
      params: accessParams, 
      found: homework.length > 0,
      homework: homework[0] || null
    });
    
    if (homework.length === 0) {
      // Try to find the homework without access restriction to see if it exists
      const [anyHomework] = await db.query('SELECT id, teacher_id, school_id FROM homework WHERE id = ?', [id]);
      if (anyHomework.length === 0) {
        console.log('Homework does not exist in database:', id);
        return res.status(404).json({ error: 'Homework not found' });
      } else {
        console.log('Homework exists but access denied:', { 
          homework: anyHomework[0], 
          user: { id: req.user.id, role: req.user.role, schoolId: req.user.schoolId }
        });
        return res.status(403).json({ error: 'Access denied to this homework' });
      }
    }

    // Insert or update completion status
    try {
      await db.query(
        `INSERT INTO homework_submissions (id, homework_id, student_id, is_completed, completed_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           is_completed = VALUES(is_completed),
           completed_at = VALUES(completed_at),
           updated_at = NOW()`,
        [uuidv4(), id, studentId, completed, completed ? new Date() : null]
      );

      res.json({ success: true });
    } catch (dbError) {
      console.error('Database error updating completion:', dbError);
      // Check if it's a foreign key constraint error
      if (dbError.code === 'ER_NO_REFERENCED_ROW_2' || dbError.code === 'ER_NO_REFERENCED_ROW') {
        return res.status(400).json({ error: 'Invalid student ID or homework ID' });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Update homework completion error:', error);
    const errorMessage = error.message || 'Failed to update completion';
    res.status(500).json({ error: errorMessage });
  }
});

// Update multiple student completions
router.post('/:id/completions/bulk', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { completions } = req.body; // Array of { studentId, completed }

    if (!Array.isArray(completions)) {
      return res.status(400).json({ error: 'completions must be an array' });
    }

    console.log('Bulk update completion request:', { 
      homeworkId: id, 
      completionsCount: completions.length,
      userId: req.user.id, 
      userRole: req.user.role,
      schoolId: req.user.schoolId 
    });

    // Verify homework exists and user has access
    let accessQuery = 'SELECT h.id, h.teacher_id, h.school_id FROM homework h WHERE h.id = ?';
    const accessParams = [id];

    if (req.user.role === 'teacher') {
      // For teachers, check if they have access to the homework's class or school
      accessQuery += ' AND (h.teacher_id = ? OR h.school_id = ?)';
      accessParams.push(req.user.id, req.user.schoolId);
    } else if (req.user.role === 'admin') {
      accessQuery += ' AND h.school_id = ?';
      accessParams.push(req.user.schoolId);
    }

    const [homework] = await db.query(accessQuery, accessParams);
    
    if (homework.length === 0) {
      // Try to find the homework without access restriction
      const [anyHomework] = await db.query('SELECT id, teacher_id, school_id FROM homework WHERE id = ?', [id]);
      if (anyHomework.length === 0) {
        console.log('Homework does not exist in database:', id);
        return res.status(404).json({ error: 'Homework not found' });
      } else {
        console.log('Homework exists but access denied:', { 
          homework: anyHomework[0], 
          user: { id: req.user.id, role: req.user.role, schoolId: req.user.schoolId }
        });
        return res.status(403).json({ error: 'Access denied to this homework' });
      }
    }

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      for (const comp of completions) {
        if (!comp.studentId || typeof comp.completed !== 'boolean') {
          continue; // Skip invalid entries
        }
        try {
          await db.query(
            `INSERT INTO homework_submissions (id, homework_id, student_id, is_completed, completed_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
               is_completed = VALUES(is_completed),
               completed_at = VALUES(completed_at),
               updated_at = NOW()`,
            [uuidv4(), id, comp.studentId, comp.completed, comp.completed ? new Date() : null]
          );
        } catch (dbError) {
          console.error('Database error for student:', comp.studentId, dbError);
          // Check if it's a foreign key constraint error
          if (dbError.code === 'ER_NO_REFERENCED_ROW_2' || dbError.code === 'ER_NO_REFERENCED_ROW') {
            console.error(`Invalid student ID: ${comp.studentId} for homework: ${id}`);
            // Continue with other students instead of failing completely
            continue;
          }
          throw dbError;
        }
      }

      await db.query('COMMIT');
      res.json({ success: true });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Bulk update homework completion error:', error);
    const errorMessage = error.message || 'Failed to update completions';
    res.status(500).json({ error: errorMessage });
  }
});

const { sendWhatsAppTemplateMessage, formatPhoneNumber } = require('../services/whatsappService');

// TEST ENDPOINT - Test WhatsApp API with single message (remove after testing)
router.post('/test-whatsapp', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required for testing' });
    }

    const templateName = process.env.WAZZAP_TEMPLATE_NAME;
    const templateLanguage = process.env.WAZZAP_TEMPLATE_LANGUAGE || 'en';
    
    // Test with sample data matching your template
    const testParams = [
      'Test Student',           // {{1}} - Student name
      'Monday, January 8, 2026', // {{2}} - Date created
      'Mathematics: Complete exercises 1-20 from Chapter 5', // {{3}} - Homework details
      '15 Jan 2026',            // {{4}} - Due date
      'Test School'             // {{5}} - School name
    ];

    const result = await sendWhatsAppTemplateMessage(
      phoneNumber,
      templateName,
      templateLanguage,
      testParams
    );

    res.json({
      success: result.success,
      message: result.success ? 'Test message sent successfully!' : 'Failed to send',
      error: result.error,
      errorCode: result.errorCode,
      statusCode: result.statusCode,
      data: result.data,
      responseData: result.responseData
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Send homework to all parents for a specific date using templates
router.post('/send-to-all', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { date } = req.body; // Date in YYYY-MM-DD format

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get template configuration
    const templateName = process.env.WAZZAP_TEMPLATE_NAME;
    const templateLanguage = process.env.WAZZAP_TEMPLATE_LANGUAGE || 'en';

    if (!templateName) {
      return res.status(500).json({ 
        error: 'WhatsApp template not configured. Please set WAZZAP_TEMPLATE_NAME in environment variables.' 
      });
    }

    // Get school name
    const schoolId = req.user.schoolId;
    const [schools] = await db.query(
      'SELECT name FROM schools WHERE id = ?',
      [schoolId]
    );
    const schoolName = schools.length > 0 ? schools[0].name : 'School';

    // Get all homework created on this date
    let query = `
      SELECT h.*, c.name as class_name, c.section as class_section
      FROM homework h
      LEFT JOIN classes c ON h.class_id = c.id
      WHERE DATE(h.created_at) = ?
    `;
    const params = [date];

    if (req.user.role === 'teacher') {
      query += ' AND h.teacher_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'admin') {
      query += ' AND h.school_id = ?';
      params.push(req.user.schoolId);
    }

    const [homeworkList] = await db.query(query, params);

    if (homeworkList.length === 0) {
      return res.status(404).json({ error: 'No homework found for this date' });
    }

    // Get all unique class IDs
    const classIds = [...new Set(homeworkList.map(h => h.class_id))];
    const placeholders = classIds.map(() => '?').join(',');

    // Get all students with parent phone numbers
    const [students] = await db.query(
      `SELECT s.id, s.name, s.parent_phone, s.class_id, c.name as class_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.class_id IN (${placeholders}) 
       AND s.parent_phone IS NOT NULL 
       AND s.parent_phone != ''
       AND s.status = 'approved'`,
      classIds
    );

    if (students.length === 0) {
      return res.status(404).json({ 
        error: 'No students with valid parent phone numbers found for these classes' 
      });
    }

    // Prepare homework details
    const subjectsList = homeworkList
      .map(h => `${h.subject || 'Subject'}: ${h.description || 'No description'}`)
      .join('; ');

    const dueDates = [...new Set(homeworkList.map(h => h.due_date).filter(Boolean))];
    const dueDateText = dueDates.length === 1
      ? new Date(dueDates[0]).toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        })
      : dueDates.map(d => new Date(d).toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        })).join(', ');

    const dateFormatted = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send messages to all parents
    const results = {
      total: students.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const student of students) {
      const formattedPhone = formatPhoneNumber(student.parent_phone);
      
      if (!formattedPhone) {
        results.failed++;
        results.errors.push({
          student: student.name,
          phone: student.parent_phone,
          error: 'Invalid phone number format'
        });
        continue;
      }

      // Build template parameters - MUST MATCH YOUR TEMPLATE ORDER
      // Template: "Hello {{1}}, 📚 *Homework Alert - {{2}}* {{3}} 📅 *Due Date:* {{4}} ... - {{5}} Management"
      const templateParams = [
        student.name,           // {{1}} - Student name
        dateFormatted,         // {{2}} - Date when homework was created (e.g., "Monday, January 8, 2026")
        subjectsList,          // {{3}} - Homework subjects and descriptions
        dueDateText,           // {{4}} - Due date (e.g., "15 Jan 2026")
        schoolName             // {{5}} - School name
      ];

      // Send template message
      const result = await sendWhatsAppTemplateMessage(
        formattedPhone,
        templateName,
        templateLanguage,
        templateParams
      );

      if (result.success && (result.queueId || result.messageId)) {
        // Use queueId if available, otherwise use messageId (for Meta format responses)
        const queueId = result.queueId || result.messageId;
        
        // Log successful message to database
        try {
          await db.query(
            `INSERT INTO whatsapp_messages 
             (id, queue_id, message_id, recipient_phone, recipient_name, template_name, 
              message_type, status, related_type, related_id, school_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              queueId,
              result.messageId || null,
              formattedPhone,
              student.name,
              templateName,
              'template',
              result.messageStatus || 'sent',
              'homework',
              date, // Store the date as related_id for homework
              schoolId
            ]
          );
        } catch (logError) {
          console.error('Failed to log WhatsApp message:', logError);
          // Don't fail the whole operation if logging fails
        }

        results.successful++;
        // Log only failures in production, all in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Successfully sent to ${student.name} (${formattedPhone}) - Message ID: ${queueId}`);
        }
      } else {
        // Log failed message
        try {
          await db.query(
            `INSERT INTO whatsapp_messages 
             (id, queue_id, recipient_phone, recipient_name, template_name, 
              message_type, status, error_message, error_code, related_type, related_id, school_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              result.queueId || `failed_${Date.now()}`,
              formattedPhone,
              student.name,
              templateName,
              'template',
              'failed',
              result.error || 'Unknown error',
              result.errorCode || null,
              'homework',
              date,
              schoolId
            ]
          );
        } catch (logError) {
          console.error('Failed to log failed WhatsApp message:', logError);
        }

        results.failed++;
        // Always log errors
        console.error(`❌ Failed to send to ${student.name} (${formattedPhone}):`, result.error);
        results.errors.push({
          student: student.name,
          phone: formattedPhone,
          error: result.error,
          errorCode: result.errorCode,
          statusCode: result.statusCode,
          responseData: result.responseData
        });
      }

      // Rate limiting: 200ms delay between messages to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    res.json({
      success: true,
      message: `Template messages sent to ${results.successful} out of ${results.total} parents`,
      results: {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        errors: results.errors.slice(0, 20) // Limit errors in response
      }
    });
  } catch (error) {
    console.error('Send homework to all error:', error);
    res.status(500).json({ 
      error: 'Failed to send homework messages',
      details: error.message 
    });
  }
});

module.exports = router;

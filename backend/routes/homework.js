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

    // Verify homework exists and user has access
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

    // Verify homework exists and user has access
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

module.exports = router;

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

module.exports = router;

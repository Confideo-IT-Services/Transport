const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// Get all students (filtered by school)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const [students] = await db.query(`
      SELECT s.*, c.name as class_name, c.section as class_section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = ?
      ORDER BY s.created_at DESC
    `, [schoolId]);

    res.json(students.map(s => ({
      id: s.id,
      name: s.name,
      rollNo: s.roll_no,
      classId: s.class_id,
      className: s.class_name ? `${s.class_name} ${s.class_section || ''}`.trim() : null,
      parentPhone: s.parent_phone,
      parentEmail: s.parent_email,
      parentName: s.parent_name,
      address: s.address,
      dateOfBirth: s.date_of_birth,
      gender: s.gender,
      bloodGroup: s.blood_group,
      photoUrl: s.photo_url,
      status: s.status,
      createdAt: s.created_at
    })));
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get pending student registrations
router.get('/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const [students] = await db.query(`
      SELECT s.*, c.name as class_name, c.section as class_section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = ? AND s.status = 'pending'
      ORDER BY s.created_at DESC
    `, [schoolId]);

    res.json(students.map(s => ({
      id: s.id,
      name: s.name,
      rollNo: s.roll_no,
      classId: s.class_id,
      className: s.class_name ? `${s.class_name} ${s.class_section || ''}`.trim() : null,
      parentPhone: s.parent_phone,
      parentEmail: s.parent_email,
      parentName: s.parent_name,
      status: s.status,
      createdAt: s.created_at
    })));
  } catch (error) {
    console.error('Get pending students error:', error);
    res.status(500).json({ error: 'Failed to fetch pending students' });
  }
});

// Create student (from registration form - no auth required)
router.post('/', async (req, res) => {
  try {
    const { 
      name, rollNo, classId, schoolId, 
      parentPhone, parentEmail, parentName,
      address, dateOfBirth, gender, bloodGroup, photoUrl
    } = req.body;

    if (!name || !classId || !schoolId) {
      return res.status(400).json({ error: 'Name, class, and school are required' });
    }

    // Verify school and class exist
    const [schools] = await db.query('SELECT id FROM schools WHERE id = ?', [schoolId]);
    if (schools.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const [classes] = await db.query('SELECT id FROM classes WHERE id = ? AND school_id = ?', [classId, schoolId]);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Create student with pending status
    const studentId = uuidv4();
    await db.query(
      `INSERT INTO students (id, name, roll_no, class_id, school_id, parent_phone, parent_email, 
       parent_name, address, date_of_birth, gender, blood_group, photo_url, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [studentId, name, rollNo || null, classId, schoolId, parentPhone || null, 
       parentEmail || null, parentName || null, address || null, dateOfBirth || null,
       gender || null, bloodGroup || null, photoUrl || null]
    );

    res.status(201).json({ success: true, studentId });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Approve student registration
router.post('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    // Verify student belongs to admin's school
    const [students] = await db.query(
      'SELECT id FROM students WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await db.query("UPDATE students SET status = 'approved' WHERE id = ?", [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Approve student error:', error);
    res.status(500).json({ error: 'Failed to approve student' });
  }
});

// Reject student registration
router.post('/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const schoolId = req.user.schoolId;

    // Verify student belongs to admin's school
    const [students] = await db.query(
      'SELECT id FROM students WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await db.query(
      "UPDATE students SET status = 'rejected', rejection_reason = ? WHERE id = ?",
      [reason || null, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reject student error:', error);
    res.status(500).json({ error: 'Failed to reject student' });
  }
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireTeacher } = require('../middleware/auth');

// Get all classes (filtered by school for admin, by assignment for teacher)
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
  try {
    let query = `
      SELECT c.*, t.name as teacher_name,
             (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count
      FROM classes c
      LEFT JOIN teachers t ON c.class_teacher_id = t.id
    `;
    const params = [];

    if (req.user.role === 'admin') {
      query += ' WHERE c.school_id = ?';
      params.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      query += ' WHERE c.school_id = ? AND c.class_teacher_id = ?';
      params.push(req.user.schoolId, req.user.id);
    }

    query += ' ORDER BY c.name, c.section';

    const [classes] = await db.query(query, params);

    res.json(classes.map(c => ({
      id: c.id,
      name: c.name,
      section: c.section,
      classTeacherId: c.class_teacher_id,
      classTeacherName: c.teacher_name,
      studentCount: c.student_count,
      schoolId: c.school_id
    })));
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get all school classes for dropdowns (e.g. change section) - admin and teacher
router.get('/for-dropdown', authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(403).json({ error: 'School context required' });
    }
    const [classes] = await db.query(
      'SELECT id, name, section FROM classes WHERE school_id = ? ORDER BY name, section',
      [schoolId]
    );
    res.json(classes.map(c => ({
      id: c.id,
      name: c.name,
      section: c.section || ''
    })));
  } catch (error) {
    console.error('Get classes for dropdown error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get students in a class (accessible to both admin and teacher)
router.get('/:id/students', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify access to this class
    let accessQuery = 'SELECT id FROM classes WHERE id = ?';
    const accessParams = [id];

    if (req.user.role === 'admin') {
      accessQuery += ' AND school_id = ?';
      accessParams.push(req.user.schoolId);
    } else if (req.user.role === 'teacher') {
      accessQuery += ' AND school_id = ? AND class_teacher_id = ?';
      accessParams.push(req.user.schoolId, req.user.id);
    }

    const [classes] = await db.query(accessQuery, accessParams);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    const [students] = await db.query(
      `SELECT * FROM students WHERE class_id = ? AND status = 'approved' ORDER BY roll_no`,
      [id]
    );

    res.json(students.map(s => {
      // Parse submitted_data JSON if it exists
      let submittedData = null;
      if (s.submitted_data) {
        try {
          submittedData = typeof s.submitted_data === 'string' 
            ? JSON.parse(s.submitted_data) 
            : s.submitted_data;
        } catch (e) {
          console.error('Error parsing submitted_data:', e);
          submittedData = null;
        }
      }

      return {
        id: s.id,
        name: s.name,
        rollNo: s.roll_no,
        parentPhone: s.parent_phone,
        parentEmail: s.parent_email,
        parentName: s.parent_name,
        address: s.address,
        dateOfBirth: s.date_of_birth,
        gender: s.gender,
        bloodGroup: s.blood_group,
        photoUrl: s.photo_url,
        status: s.status,
        admissionNumber: s.admission_number || null,
        submittedData: submittedData,
        // Map submitted_data fields for easy access
        fatherName: submittedData?.fatherName || null,
        motherName: submittedData?.motherName || null,
      };
    }));
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Create class (School Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, section, classTeacherId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Check if class already exists
    const [existingClasses] = await db.query(
      'SELECT id FROM classes WHERE name = ? AND section = ? AND school_id = ?',
      [name, section || '', schoolId]
    );

    if (existingClasses.length > 0) {
      return res.status(400).json({ error: 'Class already exists' });
    }

    // Create class
    const classId = uuidv4();
    const [result] = await db.query(
      `INSERT INTO classes (id, name, section, class_teacher_id, school_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [classId, name, section || null, classTeacherId || null, schoolId]
    );

    // If class teacher assigned, update teacher record
    if (classTeacherId) {
      await db.query('UPDATE teachers SET class_id = ? WHERE id = ?', [classId, classTeacherId]);
    }

    console.log('✅ Class created:', { classId, name, section, schoolId, classTeacherId });

    res.status(201).json({ success: true, classId });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update class teacher (School Admin only)
router.put('/:id/teacher', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }

    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Verify class belongs to school
    const [classes] = await db.query(
      'SELECT id FROM classes WHERE id = ? AND school_id = ?',
      [id, schoolId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found or access denied' });
    }

    // Verify teacher belongs to school
    const [teachers] = await db.query(
      'SELECT id FROM teachers WHERE id = ? AND school_id = ?',
      [teacherId, schoolId]
    );

    if (teachers.length === 0) {
      return res.status(404).json({ error: 'Teacher not found or access denied' });
    }

    // Get old class teacher to clear their class_id
    const [oldClass] = await db.query(
      'SELECT class_teacher_id FROM classes WHERE id = ?',
      [id]
    );

    if (oldClass.length > 0 && oldClass[0].class_teacher_id) {
      // Clear old teacher's class_id
      await db.query(
        'UPDATE teachers SET class_id = NULL WHERE id = ?',
        [oldClass[0].class_teacher_id]
      );
    }

    // Update class teacher
    await db.query(
      'UPDATE classes SET class_teacher_id = ? WHERE id = ?',
      [teacherId, id]
    );

    // Update teacher's class_id
    await db.query(
      'UPDATE teachers SET class_id = ? WHERE id = ?',
      [id, teacherId]
    );

    console.log('✅ Class teacher updated:', { classId: id, teacherId });

    res.json({ success: true });
  } catch (error) {
    console.error('Update class teacher error:', error);
    res.status(500).json({ error: 'Failed to update class teacher' });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all teachers (for school admin - filtered by school)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check if schoolId exists
    if (!req.user.schoolId) {
      return res.status(400).json({ error: 'School ID not found in user token' });
    }

    let query = `
      SELECT t.*, c.name as class_name, c.section as class_section
      FROM teachers t
      LEFT JOIN classes c ON t.class_id = c.id
    `;
    const params = [];

    // School admins can only see their school's teachers
    if (req.user.role === 'admin') {
      query += ' WHERE t.school_id = ?';
      params.push(req.user.schoolId);
    }

    query += ' ORDER BY t.created_at DESC';

    const [teachers] = await db.query(query, params);

    res.json(teachers.map(t => {
      // Safely parse subjects JSON
      let subjects = [];
      if (t.subjects) {
        try {
          if (typeof t.subjects === 'string') {
            subjects = JSON.parse(t.subjects);
          } else if (Array.isArray(t.subjects)) {
            subjects = t.subjects;
          }
        } catch (parseError) {
          console.error('Error parsing subjects for teacher', t.id, ':', parseError);
          subjects = [];
        }
      }

      return {
        id: t.id,
        username: t.username,
        name: t.name,
        email: t.email || null,
        phone: t.phone || null,
        subjects: subjects,
        isActive: !!t.is_active,
        className: t.class_name ? `${t.class_name} ${t.class_section || ''}`.trim() : null
      };
    }));
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers', details: error.message });
  }
});

// Get teacher by ID
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if schoolId exists
    if (req.user.role === 'admin' && !req.user.schoolId) {
      return res.status(400).json({ error: 'School ID not found in user token' });
    }
    
    let query = 'SELECT * FROM teachers WHERE id = ?';
    const params = [id];

    // School admins can only see their school's teachers
    if (req.user.role === 'admin') {
      query += ' AND school_id = ?';
      params.push(req.user.schoolId);
    }

    const [teachers] = await db.query(query, params);

    if (teachers.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const t = teachers[0];
    
    // Safely parse subjects JSON
    let subjects = [];
    if (t.subjects) {
      try {
        if (typeof t.subjects === 'string') {
          subjects = JSON.parse(t.subjects);
        } else if (Array.isArray(t.subjects)) {
          subjects = t.subjects;
        }
      } catch (parseError) {
        console.error('Error parsing subjects for teacher', t.id, ':', parseError);
        subjects = [];
      }
    }

    res.json({
      id: t.id,
      username: t.username,
      name: t.name,
      email: t.email || null,
      phone: t.phone || null,
      subjects: subjects,
      isActive: !!t.is_active
    });
  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher', details: error.message });
  }
});

// Create teacher (School Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, email, phone, subjects, classId } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password, and name are required' });
    }

    // Get school ID from logged in admin
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'School ID not found' });
    }

    // Check if username already exists in this school
    const [existingTeachers] = await db.query(
      'SELECT id FROM teachers WHERE username = ? AND school_id = ?',
      [username, schoolId]
    );

    if (existingTeachers.length > 0) {
      return res.status(400).json({ error: 'Username already exists in this school' });
    }

    // Create teacher
    const teacherId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.query(
      `INSERT INTO teachers (id, username, password, name, email, phone, subjects, school_id, class_id, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true, NOW())`,
      [teacherId, username, hashedPassword, name, email || null, phone || null, 
       subjects ? JSON.stringify(subjects) : null, schoolId, classId || null]
    );

    console.log('✅ Teacher created:', { teacherId, username, name, schoolId });

    res.status(201).json({ success: true, teacherId });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// Update teacher
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, subjects, classId } = req.body;

    // Verify teacher belongs to admin's school
    if (req.user.role === 'admin') {
      const [teachers] = await db.query(
        'SELECT id FROM teachers WHERE id = ? AND school_id = ?',
        [id, req.user.schoolId]
      );
      if (teachers.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }

    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (subjects) { updates.push('subjects = ?'); values.push(JSON.stringify(subjects)); }
    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const [result] = await db.query(
      `UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    console.log('✅ Teacher updated:', { id, affectedRows: result.affectedRows });

    res.json({ success: true });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// Deactivate teacher
router.post('/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify teacher belongs to admin's school
    if (req.user.role === 'admin') {
      const [teachers] = await db.query(
        'SELECT id FROM teachers WHERE id = ? AND school_id = ?',
        [id, req.user.schoolId]
      );
      if (teachers.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }

    await db.query('UPDATE teachers SET is_active = false WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Deactivate teacher error:', error);
    res.status(500).json({ error: 'Failed to deactivate teacher' });
  }
});

module.exports = router;

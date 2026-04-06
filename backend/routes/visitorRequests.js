const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { parentDisplayNameFatherFirst } = require('../utils/parentDisplayName');

// Parent: Create visitor request
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { studentId, classId, visitorName, visitorRelation, visitReason, otherReason } = req.body;
    
    if (!studentId || !classId || !visitorName || !visitorRelation || !visitReason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fix phone number matching - try multiple formats
    const parentPhone = req.user.phone || req.user.id.replace('parent-', '');
    const cleanedPhone = parentPhone.replace(/\D/g, '');

    // Verify parent owns the student - try with cleaned phone and also check without cleaning
    const [students] = await db.query(
      `SELECT id, school_id, class_id, parent_phone FROM students 
       WHERE id = ? AND status = ? 
       AND (REPLACE(REPLACE(REPLACE(REPLACE(parent_phone, ' ', ''), '-', ''), '(', ''), ')', '') = ? 
            OR parent_phone = ? 
            OR parent_phone = ?)`,
      [studentId, 'approved', cleanedPhone, cleanedPhone, parentPhone]
    );

    if (students.length === 0) {
      console.error('Student not found:', { studentId, cleanedPhone, parentPhone, userId: req.user.id });
      return res.status(403).json({ error: 'Student not found or access denied' });
    }

    const student = students[0];

    // Verify class matches student's class
    if (student.class_id !== classId) {
      return res.status(400).json({ error: 'Class does not match student' });
    }

    const requestId = uuidv4();
    await db.query(
      `INSERT INTO visitor_requests 
       (id, school_id, student_id, class_id, parent_phone, visitor_name, visitor_relation, visit_reason, other_reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [requestId, student.school_id, studentId, classId, cleanedPhone, visitorName, visitorRelation, visitReason, otherReason || null]
    );

    console.log('✅ Visitor request created:', { requestId, studentId, visitorName, visitorRelation });

    res.json({ success: true, requestId });
  } catch (error) {
    console.error('Create visitor request error:', error);
    res.status(500).json({ error: 'Failed to create visitor request' });
  }
});

// Parent: Get their visitor requests
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parentPhone = req.user.phone || req.user.id.replace('parent-', '');
    const cleanedPhone = parentPhone.replace(/\D/g, '');

    const [requests] = await db.query(
      `SELECT vr.*, s.name as student_name, c.name as class_name, c.section as class_section,
              t.name as teacher_name, t.phone as teacher_phone
       FROM visitor_requests vr
       JOIN students s ON s.id = vr.student_id
       JOIN classes c ON c.id = vr.class_id
       LEFT JOIN teachers t ON t.id = c.class_teacher_id
       WHERE vr.parent_phone = ?
       ORDER BY vr.created_at DESC`,
      [cleanedPhone]
    );

    res.json(requests);
  } catch (error) {
    console.error('Get visitor requests error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor requests' });
  }
});

// Teacher: Get visitor requests for their class
router.get('/teacher', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [requests] = await db.query(
      `SELECT vr.*, s.name as student_name, s.parent_name, s.parent_phone, s.submitted_data,
              c.name as class_name, c.section as class_section
       FROM visitor_requests vr
       JOIN students s ON s.id = vr.student_id
       JOIN classes c ON c.id = vr.class_id
       WHERE c.class_teacher_id = ? AND vr.school_id = ?
       ORDER BY vr.created_at DESC`,
      [req.user.id, req.user.schoolId]
    );

    res.json(
      requests.map((r) => {
        const { submitted_data, ...rest } = r;
        const resolved =
          parentDisplayNameFatherFirst({ submitted_data, parent_name: r.parent_name }) ||
          r.parent_name ||
          null;
        return { ...rest, parent_name: resolved };
      })
    );
  } catch (error) {
    console.error('Get teacher visitor requests error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor requests' });
  }
});

// Teacher: Accept visitor request
router.patch('/:id/teacher-accept', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Verify request belongs to teacher's class
    const [requests] = await db.query(
      `SELECT vr.* FROM visitor_requests vr
       JOIN classes c ON c.id = vr.class_id
       WHERE vr.id = ? AND c.class_teacher_id = ? AND vr.school_id = ?`,
      [id, req.user.id, req.user.schoolId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found or access denied' });
    }

    await db.query(
      `UPDATE visitor_requests 
       SET teacher_approval_status = 'accepted', 
           teacher_approval_at = NOW(),
           status = CASE 
             WHEN admin_approval_status = 'accepted' THEN 'admin_accepted'
             ELSE 'teacher_accepted'
           END
       WHERE id = ?`,
      [id]
    );

    console.log('✅ Teacher accepted visitor request:', { requestId: id });

    res.json({ success: true });
  } catch (error) {
    console.error('Teacher accept visitor request error:', error);
    res.status(500).json({ error: 'Failed to accept visitor request' });
  }
});

// Admin: Get all visitor requests
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [requests] = await db.query(
      `SELECT vr.*, s.name as student_name, s.parent_name, s.parent_phone, s.submitted_data,
              c.name as class_name, c.section as class_section,
              t.name as teacher_name, t.phone as teacher_phone
       FROM visitor_requests vr
       JOIN students s ON s.id = vr.student_id
       JOIN classes c ON c.id = vr.class_id
       LEFT JOIN teachers t ON t.id = c.class_teacher_id
       WHERE vr.school_id = ?
       ORDER BY vr.created_at DESC`,
      [req.user.schoolId]
    );

    res.json(
      requests.map((r) => {
        const { submitted_data, ...rest } = r;
        const resolved =
          parentDisplayNameFatherFirst({ submitted_data, parent_name: r.parent_name }) ||
          r.parent_name ||
          null;
        return { ...rest, parent_name: resolved };
      })
    );
  } catch (error) {
    console.error('Get admin visitor requests error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor requests' });
  }
});

// Admin: Accept visitor request
router.patch('/:id/admin-accept', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Verify request belongs to school
    const [requests] = await db.query(
      'SELECT * FROM visitor_requests WHERE id = ? AND school_id = ?',
      [id, req.user.schoolId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Request not found or access denied' });
    }

    await db.query(
      `UPDATE visitor_requests 
       SET admin_approval_status = 'accepted', 
           admin_approval_at = NOW(),
           status = 'admin_accepted'
       WHERE id = ?`,
      [id]
    );

    console.log('✅ Admin accepted visitor request:', { requestId: id });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin accept visitor request error:', error);
    res.status(500).json({ error: 'Failed to accept visitor request' });
  }
});

module.exports = router;

